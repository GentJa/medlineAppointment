export interface User {
  id: string;
  username: string;
  role: string;
}

export interface Booking {
  id: string; // UUID in Supabase
  datetimeIso: string; 
  
  // Patient Info
  patientName: string;
  patientLastName: string;
  patientPhone?: string;

  // Audit Trail
  createdBy: string; 
  createdAt: string; 
  updatedBy?: string; 
  updatedAt?: string; 

  // Status flags
  missed?: boolean;
  notified?: boolean;
}

/**
 * Checks if a given date is a Sunday.
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Checks if a given date is a standard working day (Monday - Saturday).
 */
export function isStandardDay(date: Date): boolean {
  return !isSunday(date);
}

/**
 * Generates available standard time slots for a given date.
 * Standard slots start from 17:00 and go in 15-minute intervals up to 23:45.
 */
export function generateTimeSlots(date: Date): Date[] {
  const slots: Date[] = [];
  const baseDate = new Date(date);
  baseDate.setHours(17, 0, 0, 0); // Start at 17:00

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  let currentSlot = new Date(baseDate);
  while (currentSlot <= endDate) {
    slots.push(new Date(currentSlot));
    // Add 15 minutes
    currentSlot = new Date(currentSlot.getTime() + 15 * 60000);
  }

  return slots;
}

/**
 * Validates if the given time is a valid standard slot.
 */
export function isValidStandardSlot(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  if (hours < 17) return false;
  if (minutes % 15 !== 0) return false;
  if (seconds !== 0 || ms !== 0) return false;

  return true;
}

/**
 * Checks if a slot is available (not exactly duplicate with any existing booking).
 * Pass an optional `excludeBookingId` to ignore the current booking when editing.
 */
export function isSlotAvailable(_queryDate: Date, _bookings: Booking[], _excludeBookingId?: string): boolean {
  // Now always returns true to allow multiple appointments per slot
  return true;
}

export const MOCK_USERS: User[] = [
  { id: 'user_a', username: 'Admin', role: 'admin' },
  { id: 'user_b', username: 'Leutrim', role: 'doctor' },
  { id: 'user_c', username: 'Venera', role: 'nurse' }
];

const MOCK_PASSWORDS: Record<string, string> = {
  'Admin': 'medline1!',
  'Leutrim': 'Leutrim1!',
  'Venera': 'Venera1!'
};

export function authenticateUser(username: string, password: string): User | null {
  const user = MOCK_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (user && MOCK_PASSWORDS[user.username] === password) {
    return user;
  }
  return null;
}

/**
 * Escapes HTML characters to prevent XSS.
 */
export function escapeHTML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
