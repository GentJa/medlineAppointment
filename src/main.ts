import { generateTimeSlots, isSunday, authenticateUser, escapeHTML, type Booking, type User } from './logic';
import { supabase } from './supabase';

// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

// Global State
let existingBookings: Booking[] = [];
let currentUser: User | null = null;
let currentMode: 'standard' | 'custom' = 'standard';
let selectedDateString: string = '';
let selectedTimeString: string = '';
let selectedTimeStandardSlotObj: Date | null = null;
let editingBookingId: string | null = null;

// DOM Elements
const loginModal = document.getElementById('login-modal') as HTMLDivElement;
const appMain = document.getElementById('app-main') as HTMLElement;
const currentUserDisplay = document.getElementById('current-user-display') as HTMLSpanElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const usernameInput = document.getElementById('username-input') as HTMLInputElement;
const passwordInput = document.getElementById('password-input') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLDivElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const deleteAllBtn = document.getElementById('delete-all-btn') as HTMLButtonElement;

const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
const firstNameInput = document.getElementById('first-name-input') as HTMLInputElement;
const lastNameInput = document.getElementById('last-name-input') as HTMLInputElement;
const phoneInput = document.getElementById('phone-input') as HTMLInputElement;
const dateInput = document.getElementById('date-input') as HTMLInputElement;
const sundayWarning = document.getElementById('sunday-warning') as HTMLDivElement;
const standardSlotsContainer = document.getElementById('standard-slots-container') as HTMLDivElement;
const customTimeContainer = document.getElementById('custom-time-container') as HTMLDivElement;
const customTimeInput = document.getElementById('custom-time-input') as HTMLInputElement;
const bookButton = document.getElementById('book-button') as HTMLButtonElement;
const cancelEditBtn = document.getElementById('cancel-edit-btn') as HTMLButtonElement;
const bookingError = document.getElementById('booking-error') as HTMLDivElement;
const bookingSuccess = document.getElementById('booking-success') as HTMLDivElement;
const bookingsList = document.getElementById('bookings-list') as HTMLUListElement;
const formSubtitle = document.getElementById('form-subtitle') as HTMLParagraphElement;

// Tab Elements
const showNewTab = document.getElementById('show-new-tab') as HTMLButtonElement;
const showListTab = document.getElementById('show-list-tab') as HTMLButtonElement;
const newAppointmentSection = document.getElementById('new-appointment-section') as HTMLElement;
const bookingsListSection = document.getElementById('bookings-list-section') as HTMLElement;

// Initialization
function init() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  dateInput.value = todayStr;

  selectedDateString = dateInput.value;

  handleDateChange();

  // Restore Session
  const savedUser = localStorage.getItem('medline_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      loginUser(user);
    } catch (e) {
      localStorage.removeItem('medline_user');
    }
  }

  // Attach Event Listeners
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = usernameInput.value.trim();
    const p = passwordInput.value.trim();

    if (u && p) {
      const authUser = authenticateUser(u, p);
      if (authUser) {
        loginError.classList.add('hidden');
        loginUser(authUser);
      } else {
        loginError.classList.remove('hidden');
      }
    }
  });

  logoutBtn.addEventListener('click', logoutUser);

  deleteAllBtn.addEventListener('click', async () => {
    if (currentUser?.role === 'admin') {
      if (confirm('Are you sure you want to delete all appointments? This action cannot be undone.')) {
        const { error } = await supabase.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (!error) {
          existingBookings = [];
          renderBookings();
        }
      }
    }
  });


  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentMode = (e.target as HTMLInputElement).value as 'standard' | 'custom';
      handleModeChange();
    });
  });

  dateInput.addEventListener('change', (e) => {
    selectedDateString = (e.target as HTMLInputElement).value;
    handleDateChange();
  });

  customTimeInput.addEventListener('change', (e) => {
    selectedTimeString = (e.target as HTMLInputElement).value;
    validateSelection();
  });

  firstNameInput.addEventListener('input', validateSelection);
  lastNameInput.addEventListener('input', validateSelection);

  bookButton.addEventListener('click', handleBooking);
  cancelEditBtn.addEventListener('click', cancelEdit);

  showNewTab.addEventListener('click', () => switchTab('new'));
  showListTab.addEventListener('click', () => switchTab('list'));

  // Setup Realtime Sync
  setupRealtime();
}

function setupRealtime() {
  supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings'
      },
      (payload: any) => {
        console.log('Realtime change received:', payload);
        fetchBookings();
      }
    )
    .subscribe();
}

function switchTab(tab: 'new' | 'list') {
  if (tab === 'new') {
    showNewTab.classList.add('active');
    showListTab.classList.remove('active');
    newAppointmentSection.classList.remove('hidden');
    bookingsListSection.classList.add('hidden');
  } else {
    showNewTab.classList.remove('active');
    showListTab.classList.add('active');
    newAppointmentSection.classList.add('hidden');
    bookingsListSection.classList.remove('hidden');
    fetchBookings();
  }
}

// Supabase Logic
async function fetchBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*');

  if (error) {
    console.error('Error fetching bookings:', error);
    if (error.code === 'PGRST205') {
      alert(`Database Error: Table "bookings" is missing! Please run the SQL in src/schema.sql in your Supabase Editor.`);
    } else {
      alert(`Database Error: ${error.message}`);
    }
    return;
  }


  existingBookings = data || [];
  renderBookings();
  renderStandardSlots();
}


function loginUser(user: User) {
  currentUser = user;
  localStorage.setItem('medline_user', JSON.stringify(user));
  currentUserDisplay.textContent = `(${user.username})`;

  if (currentUser.role === 'admin') {
    deleteAllBtn.classList.remove('hidden');
  } else {
    deleteAllBtn.classList.add('hidden');
  }

  loginModal.style.opacity = '0';
  setTimeout(async () => {
    loginModal.classList.add('hidden');
    appMain.classList.remove('hidden');
    await fetchBookings();
  }, 300);
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('medline_user');
  appMain.classList.add('hidden');
  loginModal.classList.remove('hidden');
  usernameInput.value = '';
  passwordInput.value = '';
  loginError.classList.add('hidden');
  void loginModal.offsetWidth;
  loginModal.style.opacity = '1';
  cancelEdit();
}

function handleModeChange() {
  selectedTimeString = '';
  selectedTimeStandardSlotObj = null;
  customTimeInput.value = '';
  bookingError.classList.add('hidden');
  bookingSuccess.classList.add('hidden');

  if (currentMode === 'standard') {
    standardSlotsContainer.classList.remove('hidden');
    customTimeContainer.classList.add('hidden');
    renderStandardSlots();
  } else {
    standardSlotsContainer.classList.add('hidden');
    customTimeContainer.classList.remove('hidden');
  }

  validateSelection();
}

function handleDateChange() {
  renderBookings();

  if (!selectedDateString) {
    sundayWarning.classList.add('hidden');
    dateInput.classList.remove('is-sunday');
    standardSlotsContainer.innerHTML = '';
    validateSelection();
    return;
  }

  const [year, month, day] = selectedDateString.split('-').map(Number);
  const selectedDateObj = new Date(year, month - 1, day);

  if (isSunday(selectedDateObj)) {
    sundayWarning.classList.remove('hidden');
    dateInput.classList.add('is-sunday');
  } else {
    sundayWarning.classList.add('hidden');
    dateInput.classList.remove('is-sunday');
  }

  selectedTimeStandardSlotObj = null;
  selectedTimeString = '';
  if (currentMode === 'custom') customTimeInput.value = '';

  if (currentMode === 'standard') {
    renderStandardSlots();
  }

  validateSelection();
}

// Shared floating tooltip for patient names
let slotTooltip: HTMLDivElement | null = null;

function getOrCreateTooltip(): HTMLDivElement {
  if (!slotTooltip) {
    slotTooltip = document.createElement('div');
    slotTooltip.className = 'slot-tooltip';
    slotTooltip.id = 'slot-tooltip';
    document.body.appendChild(slotTooltip);

    // Dismiss on outside click
    document.addEventListener('click', (e) => {
      if (slotTooltip && !slotTooltip.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest('.slot-btn')) {
        hideSlotTooltip();
      }
    });
  }
  return slotTooltip;
}

function showSlotTooltip(btn: HTMLButtonElement, slotDate: Date, timeString: string) {
  const tooltip = getOrCreateTooltip();
  const bookingsForSlot = existingBookings.filter(
    b => new Date(b.datetime_iso).getTime() === slotDate.getTime()
  );

  // Build content
  let html = `<div class="slot-tooltip-header">🕐 ${timeString}</div>`;
  bookingsForSlot.forEach(b => {
    const statusParts: string[] = [];
    if (b.checked) statusParts.push('<span class="status-label checked-label">✓</span>');
    if (b.missed) statusParts.push('<span class="status-label missed-label">✗</span>');
    html += `<div class="slot-tooltip-row">
      <span class="slot-tooltip-name">${escapeHTML(b.patient_name)} ${escapeHTML(b.patient_last_name)}</span>
      ${statusParts.length ? `<span class="slot-tooltip-status">${statusParts.join('')}</span>` : ''}
    </div>`;
  });

  tooltip.innerHTML = html;
  tooltip.classList.add('visible');

  // Position: above the button, horizontally centered on it
  const rect = btn.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  // Temporarily make visible to measure
  tooltip.style.visibility = 'hidden';
  tooltip.style.top = '0px';
  tooltip.style.left = '0px';

  requestAnimationFrame(() => {
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;

    let top = rect.top + scrollY - tipH - 8;
    let left = rect.left + scrollX + rect.width / 2 - tipW / 2;

    // Keep within viewport horizontally
    const vw = window.innerWidth;
    if (left < 8) left = 8;
    if (left + tipW > vw - 8) left = vw - tipW - 8;

    // If not enough room above, show below
    if (top < scrollY + 8) {
      top = rect.bottom + scrollY + 8;
      tooltip.classList.add('tooltip-below');
    } else {
      tooltip.classList.remove('tooltip-below');
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = 'visible';
  });
}

function hideSlotTooltip() {
  if (slotTooltip) {
    slotTooltip.classList.remove('visible');
  }
  document.querySelectorAll('.slot-btn.previewing').forEach(b => b.classList.remove('previewing'));
}

function renderStandardSlots() {
  standardSlotsContainer.innerHTML = '';
  if (!selectedDateString) return;

  const [year, month, day] = selectedDateString.split('-').map(Number);
  const selectedDateObj = new Date(year, month - 1, day);

  const standardSlots = generateTimeSlots(selectedDateObj);
  const standardTimes = new Set(standardSlots.map(s => s.getTime()));
  const now = new Date();

  // Find custom-time bookings for this date that don't match a standard slot
  const customSlotTimes = new Map<number, Date>();
  existingBookings
    .filter(b => b.datetime_iso.startsWith(selectedDateString))
    .forEach(b => {
      const dt = new Date(b.datetime_iso);
      if (!standardTimes.has(dt.getTime()) && !customSlotTimes.has(dt.getTime())) {
        customSlotTimes.set(dt.getTime(), dt);
      }
    });

  // Merge and sort all slots chronologically
  const allSlots = [...standardSlots, ...customSlotTimes.values()]
    .sort((a, b) => a.getTime() - b.getTime());

  allSlots.forEach(slotDate => {
    const isCustomSlot = !standardTimes.has(slotDate.getTime());
    let isPast = slotDate <= now;
    if (editingBookingId) {
      const existing = existingBookings.find(b => b.id === editingBookingId);
      if (existing && new Date(existing.datetime_iso).getTime() === slotDate.getTime()) {
        isPast = false;
      }
    }

    const timeString = formatTime(slotDate);

    // Count bookings for this slot using getTime() for robustness
    const countForSlot = existingBookings.filter(b => new Date(b.datetime_iso).getTime() === slotDate.getTime()).length;

    const btn = document.createElement('button')  as HTMLButtonElement;
    btn.className = 'slot-btn';
    if (isCustomSlot) {
      btn.classList.add('custom-slot');
    }
    if (countForSlot > 1) {
      btn.classList.add('has-multiple');
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeString;
    btn.appendChild(timeSpan);

    if (countForSlot > 0) {
      const badge = document.createElement('span');
      badge.className = 'slot-badge';
      badge.textContent = String(countForSlot);
      btn.appendChild(badge);
    }

    btn.disabled = isPast; // Allow multiple bookings per slot, just disable if past

    if (selectedTimeStandardSlotObj && selectedTimeStandardSlotObj.getTime() === slotDate.getTime()) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Always select the slot for booking
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTimeStandardSlotObj = slotDate;
      validateSelection();
      bookingError.classList.add('hidden');
      bookingSuccess.classList.add('hidden');

      if (countForSlot > 0) {
        // Also toggle tooltip to show patient names
        const isOpen = btn.classList.contains('previewing');
        hideSlotTooltip();
        if (!isOpen) {
          btn.classList.add('previewing');
          showSlotTooltip(btn, slotDate, timeString);
        }
      } else {
        hideSlotTooltip();
      }
    });

    standardSlotsContainer.appendChild(btn);
  });
}

function validateSelection() {
  let isValid = false;
  const hasName = firstNameInput.value.trim().length > 0;
  const hasLastName = lastNameInput.value.trim().length > 0;
  const now = new Date();

  if (bookingError.textContent && (bookingError.textContent.includes('past') || bookingError.textContent.includes('booked'))) {
    bookingError.classList.add('hidden');
  }

  if (selectedDateString && hasName && hasLastName) {
    if (currentMode === 'standard' && selectedTimeStandardSlotObj) {
      isValid = true;
    } else if (currentMode === 'custom' && selectedTimeString) {
      const [year, month, day] = selectedDateString.split('-').map(Number);
      const [hours, minutes] = selectedTimeString.split(':').map(Number);
      const finalDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      let keepingPast = false;
      if (editingBookingId) {
        const existing = existingBookings.find(b => b.id === editingBookingId);
        if (existing && new Date(existing.datetime_iso).getTime() === finalDateTime.getTime()) {
          keepingPast = true;
        }
      }

      if (finalDateTime < now && !keepingPast) {
        bookingError.textContent = 'Cannot select a past custom time.';
        bookingError.classList.remove('hidden');
      } else {
        isValid = true;
      }
    }
  }
  bookButton.disabled = !isValid;
}

async function handleBooking() {
  if (!currentUser) return;
  bookingError.classList.add('hidden');
  bookingSuccess.classList.add('hidden');
  bookButton.disabled = true;

  let finalDateTime: Date;

  if (currentMode === 'standard' && selectedTimeStandardSlotObj) {
    finalDateTime = selectedTimeStandardSlotObj;
  } else if (currentMode === 'custom' && selectedTimeString && selectedDateString) {
    const [year, month, day] = selectedDateString.split('-').map(Number);
    const [hours, minutes] = selectedTimeString.split(':').map(Number);
    finalDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  } else {
    bookButton.disabled = false;
    return;
  }

  const fn = firstNameInput.value.trim();
  const ln = lastNameInput.value.trim();
  const phone = phoneInput.value.trim();

  try {
    if (editingBookingId) {
      const { error } = await supabase
        .from('bookings')
        .update({
          datetime_iso: finalDateTime.toISOString(),
          patient_name: fn,
          patient_last_name: ln,
          patient_phone: phone || null,
          updated_by: currentUser.username,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingBookingId);

      if (error) throw error;
      bookingSuccess.textContent = 'Appointment updated successfully!';
      cancelEdit();
    } else {
      const { error } = await supabase
        .from('bookings')
        .insert([{
          datetime_iso: finalDateTime.toISOString(),
          patient_name: fn,
          patient_last_name: ln,
          patient_phone: phone || null,
          created_by: currentUser.username,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      bookingSuccess.textContent = 'Appointment saved successfully!';

      if (currentMode === 'standard') {
        selectedTimeStandardSlotObj = null;
        renderStandardSlots();
      } else {
        customTimeInput.value = '';
        selectedTimeString = '';
      }
      firstNameInput.value = '';
      lastNameInput.value = '';
      phoneInput.value = '';
    }

    await fetchBookings();
    bookingSuccess.classList.remove('hidden');
  } catch (err: any) {
    console.error('Booking error:', err);
    if (err.code === 'PGRST205') {
      bookingError.textContent = 'Error: The "bookings" table is missing in Supabase! Please run the SQL in src/schema.sql.';
    } else {
      bookingError.textContent = `Error: ${err.message || 'Failed to save appointment. Please try again.'}`;
    }
    bookingError.classList.remove('hidden');
  } finally {


    bookButton.disabled = false;
    validateSelection();
  }
}

function startEdit(id: string) {
  const booking = existingBookings.find(b => b.id === id);
  if (!booking) return;

  // Switch to the form tab so the user sees the edit form immediately
  switchTab('new');

  editingBookingId = booking.id;
  firstNameInput.value = booking.patient_name;
  lastNameInput.value = booking.patient_last_name;
  phoneInput.value = booking.patient_phone || '';

  const d = new Date(booking.datetime_iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  dateInput.value = `${year}-${month}-${day}`;
  selectedDateString = dateInput.value;

  // Decide Mode and Select Time based on precision
  const hours = d.getHours();
  const mins = d.getMinutes();
  const isStandard = (hours >= 17) && (mins % 15 === 0) && !isSunday(new Date(year, d.getMonth(), d.getDate()));

  currentMode = isStandard ? 'standard' : 'custom';
  (document.querySelector(`input[name="mode"][value="${currentMode}"]`) as HTMLInputElement).checked = true;

  handleModeChange();
  handleDateChange();

  if (currentMode === 'standard') {
    selectedTimeStandardSlotObj = d;
    renderStandardSlots();
  } else {
    selectedTimeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    customTimeInput.value = selectedTimeString;
  }

  // Update UI State
  bookButton.textContent = 'Update Appointment';
  formSubtitle.textContent = 'Edit existing appointment';
  cancelEditBtn.classList.remove('hidden');
  bookingSuccess.classList.add('hidden');
  bookingError.classList.add('hidden');

  validateSelection();

  // scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingBookingId = null;
  bookButton.textContent = 'Book Appointment';
  formSubtitle.textContent = 'Select preferred date, time, and patient details';
  cancelEditBtn.classList.add('hidden');
  firstNameInput.value = '';
  lastNameInput.value = '';
  phoneInput.value = '';

  // Reset date to today
  const today = new Date();
  dateInput.value = today.toISOString().split('T')[0];
  selectedDateString = dateInput.value;

  currentMode = 'standard';
  (document.querySelector(`input[name="mode"][value="standard"]`) as HTMLInputElement).checked = true;
  handleModeChange();
  handleDateChange();
}

function renderBookings() {
  bookingsList.innerHTML = '';
  // Filter by selected date and sort ascending
  const selectedDateBookings = existingBookings.filter(b => b.datetime_iso.startsWith(selectedDateString));
  const sorted = [...selectedDateBookings].sort((a, b) => new Date(a.datetime_iso).getTime() - new Date(b.datetime_iso).getTime());

  // Update Header Count
  const listTitle = document.getElementById('bookings-list-title');
  if (listTitle) {
    listTitle.textContent = `Existing Bookings ( ${selectedDateBookings.length} )`;
  }

  sorted.forEach(b => {
    const li = document.createElement('li');
    li.className = 'booking-item';

    const d = new Date(b.datetime_iso);
    const dateText = `${d.toLocaleDateString()} at ${formatTime(d)}`;

    let auditTrailHtml = `<div class="audit-trail">
      <span>Added by <strong>${escapeHTML(b.created_by)}</strong></span>`;

    if (b.updated_by) {
      auditTrailHtml += `<span>Last modified by <strong>${escapeHTML(b.updated_by)}</strong></span>`;
    }
    auditTrailHtml += `</div>`;

    li.innerHTML = `
      <div class="booking-info">
        <h4>${escapeHTML(b.patient_name)} ${escapeHTML(b.patient_last_name)} 
          ${b.checked ? '<span class="status-label checked-label">(checked)</span>' : ''}
          ${b.missed ? '<span class="status-label missed-label">(missed)</span>' : ''}
        </h4>
        ${b.patient_phone ? `<div class="patient_phone" style="font-size:0.9rem; color:var(--text-secondary); margin-bottom: 0.25rem;">📞 ${escapeHTML(b.patient_phone)}</div>` : ''}
        <div class="datetime">${dateText}</div>
        ${auditTrailHtml}
      </div>
      <div class="action-buttons">
        <button class="mark-checked-btn" data-id="${b.id}">${b.checked ? 'Uncheck' : 'Check'}</button>
        <button class="mark-missed-btn" data-id="${b.id}">${b.missed ? 'Undo Missed' : 'Mark Missed'}</button>
        <button class="edit-action-btn" data-id="${b.id}">Edit</button>
        ${currentUser?.role === 'admin' ? `<button class="delete-action-btn" data-id="${b.id}">Delete</button>` : ''}
      </div>
    `;

    bookingsList.appendChild(li);
  });

  // Attach edit listeners
  document.querySelectorAll('.edit-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
      if (id) startEdit(id);
    });
  });

  // Attach mark missed listeners
  document.querySelectorAll('.mark-missed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
      if (id) toggleMissed(id);
    });
  });

  // Attach mark checked listeners
  document.querySelectorAll('.mark-checked-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
      if (id) toggleChecked(id);
    });
  });

  // Attach delete listeners (admin only)
  document.querySelectorAll('.delete-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLButtonElement).getAttribute('data-id');
      if (id) deleteBooking(id);
    });
  });
}

async function deleteBooking(id: string) {
  const booking = existingBookings.find(b => b.id === id);
  if (!booking || currentUser?.role !== 'admin') return;

  const name = `${booking.patient_name} ${booking.patient_last_name}`;
  if (!confirm(`Are you sure you want to delete the appointment for ${name}?`)) return;

  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (!error) {
    existingBookings = existingBookings.filter(b => b.id !== id);
    renderBookings();
    renderStandardSlots();
  } else {
    console.error('Error deleting booking:', error);
    alert(`Could not delete: ${error.message}`);
  }
}

async function toggleChecked(id: string) {
  const booking = existingBookings.find(b => b.id === id);
  if (!booking) return;
  const newChecked = !booking.checked;

  const updateData: any = { checked: newChecked, missed: false }; // Clear missed if checking
  if (currentUser) {
    updateData.updated_by = currentUser.username;
    updateData.updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from('bookings').update(updateData).eq('id', id);
  if (!error) {
    booking.checked = newChecked;
    booking.missed = false;
    renderBookings();
    renderStandardSlots();
  } else {
    console.error('Error toggling checked:', error);
    alert(`Could not update status: ${error.message}`);
  }
}

async function toggleMissed(id: string) {
  const booking = existingBookings.find(b => b.id === id);
  if (!booking) return;
  const newMissed = !booking.missed;

  const updateData: any = { missed: newMissed, checked: false }; // Clear checked if marking missed
  if (currentUser) {
    updateData.updated_by = currentUser.username;
    updateData.updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from('bookings').update(updateData).eq('id', id);
  if (!error) {
    booking.missed = newMissed;
    booking.checked = false;
    renderBookings();
    renderStandardSlots();
  } else {
    console.error('Error toggling missed:', error);
    alert(`Could not update status: ${error.message}`);
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Start
document.addEventListener('DOMContentLoaded', init);
