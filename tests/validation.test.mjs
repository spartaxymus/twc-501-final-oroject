import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityError, validateField } from '../validation.js';

const values = { fullName: '', email: '', session: '', attendees: '' };
for (const name of ['A', '李', 'สมชาย', 'Élodie', "O’Connor", 'Alex Morgan', '  Alex  ']) {
  test(`Accept nonblank name ${name}`, () => assert.equal(validateField('fullName', { ...values, fullName: name }), ''));
}
for (const name of ['', ' ', '\t\n']) {
  test(`Reject blank name ${JSON.stringify(name)}`, () => assert.equal(validateField('fullName', { ...values, fullName: name }), 'Enter your full name.'));
}
for (const value of ['1', '2', '3', '4', ' 2 ', '02']) test(`Quantity accepts ${JSON.stringify(value)}`, () => assert.equal(quantityError(value), ''));
for (const value of ['0', '-1']) test(`Quantity minimum ${value}`, () => assert.equal(quantityError(value), 'Enter at least 1 attendee.'));
for (const value of ['5', '100', '999999999999999999999999']) test(`Quantity maximum ${value}`, () => assert.equal(quantityError(value), 'Enter no more than 4 attendees.'));
for (const value of ['1.5', '1e0', 'one', '+2', '2,0', 'NaN', 'Infinity', '๑']) test(`Reject nondecimal entry ${value}`, () => assert.equal(quantityError(value), 'Enter a whole number from 1 to 4.'));
test('Empty attendee entry has a required message', () => assert.equal(quantityError(' '), 'Enter the number of attendees.'));
test('Email required before format', () => assert.equal(validateField('email', values, () => true), 'Enter your email address.'));
test('Email check uses a trimmed copy', () => {
  let checked;
  const original = { ...values, email: ' alex@example.com ' };
  assert.equal(validateField('email', original, (text) => { checked = text; return true; }), '');
  assert.equal(checked, 'alex@example.com');
  assert.equal(original.email, ' alex@example.com ');
});
test('Invalid email gives format correction', () => assert.match(validateField('email', { ...values, email: 'abc' }, () => false), /you@example.com/));
test('Session is required', () => assert.equal(validateField('session', values), 'Select a concert session.'));
test('Only named sessions are accepted', () => assert.equal(validateField('session', { ...values, session: 'night' }), 'Select a concert session.'));
test('Unavailable session needs deliberate correction', () => assert.equal(validateField('session', { ...values, session: 'evening' }, null, 'evening'), 'Select the other available concert session.'));
test('Available alternate session passes', () => assert.equal(validateField('session', { ...values, session: 'afternoon' }, null, 'evening'), ''));
