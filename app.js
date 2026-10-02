import { FIELD_ORDER, FIELD_LABELS, validateField } from './validation.js';

const $ = (id) => document.getElementById(id);
const form = $('registration');
const controls = { fullName: [$('full-name')], email: [$('email')], session: [$('afternoon'), $('evening')], attendees: [$('attendees')] };
const hints = { fullName: '', email: 'email-hint', session: '', attendees: 'attendees-hint' };
const submit = $('submit-button');
const recovery = $('recovery-button');
const probe = document.createElement('input');
probe.type = 'email';
const checked = new Set();
const composing = new Set();
const timers = new Set();
let scenario = 'normal';
let state = 'ready';
let attempted = false;
let generation = 0;
let speechTimer;
let validationSpeechTimer;
let unavailableSession = '';
let lastOffline = false;
let recoveryAction = null;
let snapshot = null;
let rateSatisfied = false;
let firstUnknownMessage = '';
let pointerDown = false;
const deferredBlur = new Set();

const scenarios = {
  normal: 'Normal completion: valid entries lead to a confirmation message.',
  slow: 'Slow response: wait 8 seconds for a result, or stop waiting and check status. Entries stay on the page.',
  offline: 'No connection: explore a request that cannot be sent. This test does not change your device’s connection.',
  unavailable: 'Service unavailable: explore a service problem without losing your entries.',
  unknown: 'Outcome unknown: check status before making another attempt.',
  unresolved: 'Status unavailable: the submission result and the follow-up status check remain uncertain.',
  rate: 'Too many attempts: wait 5 seconds before trying again.',
  full: 'Session full: choose the other session when your first choice becomes unavailable.',
  closed: 'Registration closed: this scenario does not accept registrations. Choose another scenario to continue.',
  unexpected: 'Unexpected response: an unreadable response leaves the result unknown. Use the status check.'
};

function values() {
  return { fullName: controls.fullName[0].value, email: controls.email[0].value,
    session: controls.session.find((input) => input.checked)?.value || '', attendees: controls.attendees[0].value };
}
function emailFormatIsValid(text) { probe.value = text; return probe.validity.valid; }
function cancelWork() {
  generation += 1;
  timers.forEach(clearTimeout);
  timers.clear();
}
function later(callback, delay) {
  const current = generation;
  const timer = setTimeout(() => { timers.delete(timer); if (current === generation) callback(); }, delay);
  timers.add(timer);
}
function silence() {
  deferredBlur.clear();
  clearTimeout(speechTimer);
  clearTimeout(validationSpeechTimer);
  $('announcer').textContent = '';
}
function announce(message, delay = 80) {
  clearTimeout(speechTimer);
  $('announcer').textContent = '';
  speechTimer = setTimeout(() => { $('announcer').textContent = message; }, delay);
}
function showFeedback(title, detail = '', tone = 'info', speak = true) {
  $('feedback').hidden = false;
  $('feedback').dataset.tone = tone;
  $('feedback-title').textContent = title;
  $('feedback-detail').textContent = detail;
  $('feedback-detail').hidden = !detail;
  $('feedback-icon').textContent = tone === 'success' ? '✓' : tone === 'error' || tone === 'warning' ? '!' : 'i';
  if (speak) announce([title, detail].filter(Boolean).join(' '));
}
function clearFeedback() {
  $('feedback').hidden = true;
  $('feedback-title').textContent = '';
  $('feedback-detail').textContent = '';
}
function setRecovery(label = '', action = null) {
  const hadFocus = document.activeElement === recovery;
  recoveryAction = action;
  recovery.textContent = label;
  recovery.hidden = !label;
  if (hadFocus && !label) submit.focus({ preventScroll: true });
}
function updateButton() {
  const count = Number(values().attendees.trim());
  const plural = Number.isInteger(count) && count > 1;
  const blocked = ['processing', 'checking', 'unknown', 'unresolved', 'rate', 'closed', 'complete'].includes(state);
  submit.setAttribute('aria-disabled', String(blocked));
  submit.textContent = ['processing', 'checking'].includes(state) ? (state === 'checking' ? 'Checking status…' : 'Registering…')
    : state === 'complete' ? 'Registration complete' : plural ? 'Get Tickets' : 'Get Ticket';
}
function setState(next) { state = next; form.dataset.state = state; updateButton(); }
function paintError(field, message) {
  const node = $(`${field}-error`);
  const previous = node.querySelector('.error-copy').textContent;
  node.querySelector('.error-copy').textContent = message;
  node.hidden = !message;
  for (const control of controls[field]) {
    if (message) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
    const descriptions = [hints[field], message && `${field}-error`].filter(Boolean).join(' ');
    if (descriptions) control.setAttribute('aria-describedby', descriptions);
    else control.removeAttribute('aria-describedby');
  }
  return previous !== message;
}
function validate(field, shouldAnnounce = false) {
  checked.add(field);
  const message = validateField(field, values(), emailFormatIsValid, unavailableSession);
  const changed = paintError(field, message);
  if (changed && shouldAnnounce) {
    clearTimeout(validationSpeechTimer);
    validationSpeechTimer = setTimeout(() => announce(message ? `${FIELD_LABELS[field]}: ${message}` : `${FIELD_LABELS[field]}: error cleared.`), 650);
  }
  return message;
}
function updateConnection(speak = false) {
  if (!attempted) return;
  const offline = navigator.onLine === false;
  if (!offline && !lastOffline) return;
  const text = offline ? 'Your browser reports that you may be offline. Your entries are still on this page.'
    : 'Your browser reports that you’re back online. No registration was automatically submitted.';
  $('connection-note').textContent = text;
  $('connection-note').hidden = false;
  lastOffline = offline;
  if (speak) announce(text);
}
function markUnavailable(session) {
  unavailableSession = session;
  for (const input of controls.session) {
    const full = input.value === session;
    input.disabled = full;
    $(`${input.value}-availability`).hidden = !full;
  }
}
function complete(fromStatus = false) {
  setState('complete');
  const count = Number(snapshot?.attendees || values().attendees);
  showFeedback(fromStatus ? 'Your registration was received.' : 'Registration complete.', `You registered ${count} ${count === 1 ? 'attendee' : 'attendees'}.`, 'success');
  setRecovery('Start again', reset);
}
function statusCheck() {
  if (!['unknown', 'unresolved'].includes(state)) return;
  cancelWork();
  setState('checking');
  setRecovery();
  showFeedback('Checking registration status…', 'This check does not submit another registration.');
  later(() => {
    if (scenario === 'unresolved') {
      setState('unresolved');
      showFeedback('Registration status is still unavailable.', 'Your result is not confirmed. Check again before submitting another registration.', 'warning');
      setRecovery('Check status', statusCheck);
    } else complete(true);
  }, 1200);
}
function showUnknown(title) {
  firstUnknownMessage = title;
  setState('unknown');
  showFeedback(title, 'Check status before submitting again. Your entries are still on this page.', 'warning');
  setRecovery('Check status', statusCheck);
}
function stopWaiting() {
  if (state !== 'processing') return;
  cancelWork();
  showUnknown('You stopped waiting. Your registration result is not confirmed.');
}
function finishScenario() {
  if (scenario === 'offline') {
    setState('retry');
    showFeedback('No internet connection.', 'Your request was not sent. Check your connection and try again. Your entries are still on this page.', 'error');
    setRecovery('Try again', attempt);
  } else if (scenario === 'unavailable') {
    setState('retry');
    showFeedback('The registration service is unavailable.', 'Try again later. Your entries are still on this page.', 'error');
    setRecovery('Try again', attempt);
  } else if (['unknown', 'unresolved', 'unexpected'].includes(scenario)) {
    showUnknown(scenario === 'unexpected' ? 'We couldn’t read the registration response.' : 'We couldn’t confirm whether your registration was received.');
  } else if (scenario === 'rate' && !rateSatisfied) {
    setState('rate');
    showFeedback('Please wait before trying again.', 'Try again in 5 seconds. Your entries are still on this page.', 'warning');
    later(() => {
      rateSatisfied = true;
      setState('retry');
      showFeedback('You can try again now.', 'The waiting period has ended.');
      setRecovery('Try again', attempt);
    }, 5000);
  } else if (scenario === 'full' && !unavailableSession) {
    markUnavailable(snapshot.session);
    const label = snapshot.session === 'afternoon' ? 'afternoon' : 'evening';
    setState('retry');
    validate('session');
    showFeedback(`The ${label} session is now full.`, 'Choose the other available session. Your other entries are still on this page.', 'warning');
    setRecovery('Choose another session', () => controls.session.find((input) => input.value !== unavailableSession).focus());
  } else if (scenario === 'closed') {
    setState('closed');
    showFeedback('Registration for this event has closed.', 'New registrations are no longer accepted. Your entries are still on this page.', 'warning');
    setRecovery();
  } else complete();
}
function attempt(event) {
  event?.preventDefault();
  if (['processing', 'checking', 'unknown', 'unresolved', 'rate', 'closed', 'complete'].includes(state)) return;
  silence();
  attempted = true;
  updateConnection();
  const invalid = FIELD_ORDER.filter((field) => validate(field));
  if (invalid.length) {
    cancelWork();
    setState('ready');
    setRecovery();
    clearFeedback();
    const first = controls[invalid[0]].find((input) => !input.disabled) || controls[invalid[0]][0];
    const alreadyFocused = document.activeElement === first;
    first.focus();
    if (alreadyFocused) announce(`${FIELD_LABELS[invalid[0]]}: ${$(`${invalid[0]}-error`).querySelector('.error-copy').textContent}`);
    return;
  }
  cancelWork();
  snapshot = { ...values() };
  setState('processing');
  setRecovery();
  showFeedback('Registering…', 'Please wait while we process your registration.');
  if (scenario === 'slow') {
    later(() => { showFeedback('This is taking longer than expected.', 'You can keep waiting or stop waiting and check your registration status.'); setRecovery('Stop waiting', stopWaiting); }, 2000);
    later(finishScenario, 8000);
  } else later(finishScenario, 1000);
}
function inputChanged(field, event) {
  clearTimeout(validationSpeechTimer);
  if (['processing', 'checking'].includes(state)) {
    const wasChecking = state === 'checking';
    cancelWork();
    if (wasChecking) {
      setState('unknown');
      showFeedback(firstUnknownMessage || 'Your previous registration result is still unknown.', 'Your edits do not change the earlier attempt. Check status before submitting again.', 'warning');
      setRecovery('Check status', statusCheck);
    } else {
      setState('ready');
      setRecovery();
      showUnknown('Your details changed. The earlier registration result is not confirmed.');
    }
  } else if (state === 'complete') {
    setState('ready'); setRecovery(); clearFeedback();
  }
  if (!event?.isComposing && !composing.has(field) && checked.has(field)) validate(field, true);
  updateButton();
}
function selectScenario(next) {
  if (!Object.hasOwn(scenarios, next)) return;
  cancelWork(); silence();
  scenario = next;
  rateSatisfied = false;
  snapshot = null;
  markUnavailable('');
  if (checked.has('session')) validate('session');
  document.querySelectorAll('[data-scenario]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.scenario === next)));
  $('scenario-description').textContent = scenarios[next];
  setState('ready'); setRecovery(); clearFeedback();
}
function reset() {
  cancelWork(); silence();
  // Clear intentionally; errors, service failures and scenario changes never do this.
  form.reset(); checked.clear(); composing.clear();
  FIELD_ORDER.forEach((field) => paintError(field, ''));
  attempted = false; lastOffline = false; firstUnknownMessage = '';
  $('connection-note').hidden = true; $('connection-note').textContent = '';
  selectScenario('normal');
  controls.fullName[0].focus();
  announce('Demonstration reset. All entries cleared. Normal completion selected.');
}

form.addEventListener('submit', attempt);
// A blur error can shift the button or radio under a pointer before its click ends.
// Finish the pointer action first. Submit/reset/scenario actions clear this queue.
document.addEventListener('pointerdown', () => { pointerDown = true; });
function finishPointer() {
  pointerDown = false;
  setTimeout(() => {
    for (const field of deferredBlur) {
      if (!controls[field].includes(document.activeElement) && !composing.has(field)) validate(field, true);
    }
    deferredBlur.clear();
  }, 0);
}
document.addEventListener('pointerup', finishPointer);
document.addEventListener('pointercancel', finishPointer);
recovery.addEventListener('click', () => recoveryAction?.());
$('reset-button').addEventListener('click', reset);
document.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', () => selectScenario(button.dataset.scenario)));
for (const field of FIELD_ORDER) {
  for (const control of controls[field]) {
    control.addEventListener('compositionstart', () => composing.add(field));
    control.addEventListener('compositionend', () => { composing.delete(field); inputChanged(field); });
    control.addEventListener('input', (event) => inputChanged(field, event));
    control.addEventListener('focusout', (event) => {
      if (event.relatedTarget === $('reset-button') || event.relatedTarget?.dataset.scenario) return;
      if (field === 'session' && $('session-group').contains(event.relatedTarget)) return;
      if (pointerDown) { deferredBlur.add(field); return; }
      if (!composing.has(field)) validate(field, true);
    });
  }
}
// Native disabled radio options cannot be selected by mouse or arrow keys.
// Their visible labels explain availability; no alternative is silently selected.
window.addEventListener('offline', () => updateConnection(true));
window.addEventListener('online', () => updateConnection(true));
window.addEventListener('pagehide', () => { cancelWork(); silence(); });
window.addEventListener('pageshow', (event) => {
  if (event.persisted && ['processing', 'checking'].includes(state)) {
    setState('ready'); setRecovery();
    showUnknown('Your registration result is not confirmed.');
  }
});

// Enable the form only after all handlers are attached. Without JavaScript, it stays inert.
$('form-controls').disabled = false;
$('script-fallback').hidden = true;
document.querySelectorAll('[data-scenario], #reset-button').forEach((button) => { button.disabled = false; });
setState('ready');
