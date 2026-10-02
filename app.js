import { FIELD_ORDER, FIELD_LABELS, validateField, quantityError } from './validation.js';

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
  normal: 'Normal completion: valid entries lead to a practice confirmation. No ticket is issued.',
  slow: 'Slow response: the simulation waits 8 seconds. You can stop waiting without clearing your entries.',
  offline: 'No connection: a simulated connection problem prevents the request from being sent. Your device stays connected.',
  unavailable: 'Service unavailable: the simulated service cannot accept the registration. Your entries remain on this page.',
  unknown: 'Outcome unknown: confirmation is lost. Check the simulated status before making another attempt.',
  unresolved: 'Status unavailable: both the simulated submission result and the follow-up status check remain uncertain.',
  rate: 'Too many attempts: a simulated 5-second retry interval temporarily blocks another attempt. No countdown is announced.',
  full: 'Session full: your selected session becomes unavailable in the simulation. Choose the other session to continue.',
  closed: 'Registration closed: this scenario does not accept registrations. Choose another scenario to continue.',
  unexpected: 'Unexpected response: an unreadable simulated response leaves the result unknown. Use the status check.'
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
  const plural = !quantityError(values().attendees) && Number(values().attendees.trim()) > 1;
  const blocked = ['processing', 'checking', 'unknown', 'unresolved', 'rate', 'closed', 'complete'].includes(state);
  submit.setAttribute('aria-disabled', String(blocked));
  submit.textContent = ['processing', 'checking'].includes(state) ? (state === 'checking' ? 'Checking status…' : 'Registering…')
    : state === 'complete' ? 'Practice complete' : plural ? 'Get Tickets' : 'Get Ticket';
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
  const text = offline ? 'Your browser reports that you may be offline. You can continue using this local practice form.'
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
  showFeedback(fromStatus ? 'The simulated registration was received.' : 'Practice registration complete.', 'No booking was made. No ticket or confirmation email was sent.', 'success');
  setRecovery('Start again', reset);
}
function statusCheck() {
  if (!['unknown', 'unresolved'].includes(state)) return;
  cancelWork();
  setState('checking');
  setRecovery();
  showFeedback('Checking simulated status…', 'This check does not submit another registration.');
  later(() => {
    if (scenario === 'unresolved') {
      setState('unresolved');
      showFeedback('The simulated registration status is still unavailable.', 'Do not submit again while the outcome is unknown. A real service needs a status or support route. Choose another test scenario to continue this demonstration.', 'warning');
      setRecovery('Check simulated status', statusCheck);
    } else complete(true);
  }, 1200);
}
function showUnknown(title) {
  firstUnknownMessage = title;
  setState('unknown');
  showFeedback(title, 'Check the simulated status before making another attempt. Your entries are still on this page.', 'warning');
  setRecovery('Check simulated status', statusCheck);
}
function stopWaiting() {
  if (state !== 'processing') return;
  cancelWork();
  setState('ready');
  setRecovery();
  showFeedback('You stopped waiting for the simulated response.', 'Your entries are still on this page. No real request was sent.');
}
function finishScenario() {
  if (scenario === 'offline') {
    setState('retry');
    showFeedback('No internet connection — simulated.', 'The simulated request was not sent. Your entries are still on this page. Your actual connection has not changed.', 'error');
    setRecovery('Try again', attempt);
  } else if (scenario === 'unavailable') {
    setState('retry');
    showFeedback('The simulated registration service is unavailable.', 'No simulated registration was accepted. Try again later or choose another test scenario. Your entries are still on this page.', 'error');
    setRecovery('Try again', attempt);
  } else if (['unknown', 'unresolved', 'unexpected'].includes(scenario)) {
    showUnknown(scenario === 'unexpected' ? 'We couldn’t confirm the simulated registration result.' : 'We couldn’t confirm whether the simulated registration was received.');
  } else if (scenario === 'rate' && !rateSatisfied) {
    setState('rate');
    showFeedback('Please wait before trying again.', 'This simulation has a 5-second retry interval. Your entries are still on this page.', 'warning');
    later(() => {
      rateSatisfied = true;
      setState('retry');
      showFeedback('You can try again now.', 'The simulated waiting period has ended.');
      setRecovery('Try again', attempt);
    }, 5000);
  } else if (scenario === 'full' && !unavailableSession) {
    markUnavailable(snapshot.session);
    const label = snapshot.session === 'afternoon' ? 'afternoon' : 'evening';
    setState('retry');
    showFeedback(`The ${label} session is now full — simulated.`, 'Choose the other available session. Your other entries are still on this page.', 'warning');
    setRecovery('Choose another session', () => controls.session.find((input) => input.value !== unavailableSession).focus());
  } else if (scenario === 'closed') {
    setState('closed');
    showFeedback('Registration for this event has closed — simulated.', 'This scenario cannot accept a registration. Your entries are still on this page. Choose another test scenario to continue.', 'warning');
    setRecovery('Choose a test scenario', () => document.querySelector('[data-scenario="normal"]').focus());
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
  showFeedback('Registering…', 'Checking your practice registration. No real registration is sent.');
  if (scenario === 'slow') {
    later(() => { showFeedback('This is taking longer than expected.', 'You can keep waiting or stop the simulated response.'); setRecovery('Stop waiting', stopWaiting); }, 2000);
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
      showFeedback(firstUnknownMessage || 'The previous simulated result is still unknown.', 'Your edits do not resolve the earlier attempt. Check simulated status before submitting again.', 'warning');
      setRecovery('Check simulated status', statusCheck);
    } else {
      setState('ready');
      setRecovery();
      showFeedback('Your details changed.', 'Submit again to check the updated information. The previous simulation was stopped.');
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
    showFeedback('The demonstration was paused when you left this page.', 'Submit again to run a new simulation.');
  }
});

// Enable the form only after all handlers are attached. Without JavaScript, it stays inert.
$('form-controls').disabled = false;
$('script-fallback').hidden = true;
document.querySelectorAll('[data-scenario], #reset-button').forEach((button) => { button.disabled = false; });
setState('ready');
