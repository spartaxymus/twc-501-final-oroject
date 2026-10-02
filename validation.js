export const FIELD_ORDER = ['fullName', 'email', 'session', 'attendees'];
export const FIELD_LABELS = { fullName: 'Full name', email: 'Email address', session: 'Concert session', attendees: 'Number of attendees' };

export function quantityError(value) {
  const text = String(value).trim();
  if (!text) return 'Enter the number of attendees.';
  // ASCII decimal integers only: do not interpret 1e0 or silently round fractions.
  if (!/^-?\d+$/.test(text)) return 'Enter a whole number from 1 to 4.';
  const number = Number(text);
  if (number < 1) return 'Enter at least 1 attendee.';
  if (number > 4) return 'Enter no more than 4 attendees.';
  return '';
}

export function validateField(field, values, emailFormatIsValid, unavailableSession = '') {
  const value = String(values[field] ?? '').trim();
  if (field === 'fullName') return value ? '' : 'Enter your name.';
  if (field === 'email') {
    if (!value) return 'Enter your email address.';
    return emailFormatIsValid(value) ? '' : 'Enter an email address in the format you@example.com.';
  }
  if (field === 'session') {
    if (!['afternoon', 'evening'].includes(value)) return 'Select a concert session.';
    return value === unavailableSession ? 'Select the other available concert session.' : '';
  }
  if (field === 'attendees') return quantityError(value);
  throw new Error('Unknown field');
}
