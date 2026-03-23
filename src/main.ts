import { generateTimeSlots, isSlotAvailable, isSunday, authenticateUser, escapeHTML, type Booking, type User } from './logic';
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
let notificationsEnabled = true;

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
const notificationCheckbox = document.getElementById('notification-checkbox') as HTMLInputElement;
const notificationsContainer = document.getElementById('notifications-container') as HTMLDivElement;

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
        if (error) {
           showNotification('Error deleting appointments.');
        } else {
           existingBookings = [];
           renderBookings();
           showNotification('All appointments have been deleted.');
        }
      }
    }
  });

  notificationCheckbox.addEventListener('change', (e) => {
    notificationsEnabled = (e.target as HTMLInputElement).checked;
    if (currentUser) {
      localStorage.setItem(`notify_${currentUser.id}`, String(notificationsEnabled));
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

  // Periodic check
  setInterval(checkUpcomingAppointments, 15000);
}

// Supabase Logic
async function fetchBookings() {
   const { data, error } = await supabase
     .from('bookings')
     .select('*');
   
   if (error) {
     console.error('Error fetching bookings:', error);
     if (error.code === 'PGRST205') {
       showNotification(`Database Error: Table "bookings" is missing! Please run the SQL in src/schema.sql in your Supabase Editor.`);
     } else {
       showNotification(`Database Error: ${error.message}`);
     }
     return;
   }


   existingBookings = data || [];
   renderBookings();
   renderStandardSlots(); 
}

function showNotification(message: string) {
  if (!notificationsEnabled) return;
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
  notificationsContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

function checkUpcomingAppointments() {
  if (!notificationsEnabled) return;
  const now = new Date();
  
  existingBookings.forEach(b => {
    if (b.missed || b.notified) return;
    
    const bDate = new Date(b.datetime_iso);
    const diffMs = bDate.getTime() - now.getTime();
    
    if (diffMs > 0 && diffMs <= 5 * 60000) {
      showNotification(`${b.patient_name} ${b.patient_last_name} is arriving soon!`);
      b.notified = true;
      supabase.from('bookings').update({ notified: true }).eq('id', b.id).then(({error}) => {
        if (error) console.error('Failed to update notification status:', error);
      });
    }
  });
}

function loginUser(user: User) {
  currentUser = user;
  currentUserDisplay.textContent = `(${user.username})`;
  
  const savedPref = localStorage.getItem(`notify_${user.id}`);
  notificationsEnabled = savedPref === null ? true : savedPref === 'true';
  notificationCheckbox.checked = notificationsEnabled;

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

function renderStandardSlots() {
  standardSlotsContainer.innerHTML = '';
  if (!selectedDateString) return;

  const [year, month, day] = selectedDateString.split('-').map(Number);
  const selectedDateObj = new Date(year, month - 1, day);

  const slots = generateTimeSlots(selectedDateObj);
  const now = new Date();

  slots.forEach(slotDate => {
    const isAvailable = isSlotAvailable(slotDate, existingBookings, editingBookingId || undefined);
    
    let isPast = slotDate <= now;
    if (editingBookingId) {
      const existing = existingBookings.find(b => b.id === editingBookingId);
      if (existing && new Date(existing.datetime_iso).getTime() === slotDate.getTime()) {
        isPast = false;
      }
    }

    const timeString = formatTime(slotDate);

    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = timeString;
    btn.disabled = !isAvailable || isPast;
    
    if (selectedTimeStandardSlotObj && selectedTimeStandardSlotObj.getTime() === slotDate.getTime()) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTimeStandardSlotObj = slotDate;
      validateSelection();
      bookingError.classList.add('hidden');
      bookingSuccess.classList.add('hidden');
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
        <h4>${escapeHTML(b.patient_name)} ${escapeHTML(b.patient_last_name)} ${b.missed ? '<span style="color:var(--error-text);font-size:0.85rem;">(Missed)</span>' : ''}</h4>
        ${b.patient_phone ? `<div class="patient_phone" style="font-size:0.9rem; color:var(--text-secondary); margin-bottom: 0.25rem;">📞 ${escapeHTML(b.patient_phone)}</div>` : ''}
        <div class="datetime">${dateText}</div>
        ${auditTrailHtml}
      </div>
      <div class="action-buttons">
        <button class="mark-missed-btn" data-id="${b.id}">${b.missed ? 'Undo Missed' : 'Mark Missed'}</button>
        <button class="edit-action-btn" data-id="${b.id}">Edit</button>
      </div>
    `;
    
    if (b.missed) {
      li.classList.add('missed-appointment');
    }
    
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
}

async function toggleMissed(id: string) {
  const booking = existingBookings.find(b => b.id === id);
  if (!booking) return;
  const newMissed = !booking.missed;
  
  const updateData: any = { missed: newMissed };
  if (currentUser) {
    updateData.updated_by = currentUser.username;
    updateData.updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from('bookings').update(updateData).eq('id', id);
  if (!error) {
    await fetchBookings();
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Start
document.addEventListener('DOMContentLoaded', init);
