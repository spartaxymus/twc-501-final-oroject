import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
const submissions = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (request.method() !== 'GET') submissions.push(request.url()); });
const results = [];
const base = process.env.TEST_URL || 'http://127.0.0.1:8081';
async function check(name, fn) {
  try { await fn(); results.push({ name, result: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, result: 'FAIL', error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
const state = () => page.locator('#registration').getAttribute('data-state');
const waitState = (value) => page.waitForFunction((expected) => document.getElementById('registration').dataset.state === expected, value);
const reset = () => page.locator('#reset-button').click();
async function fill() {
  await page.locator('#full-name').fill('Alex Morgan');
  await page.locator('#email').fill('alex@example.com');
  await page.locator('#afternoon').check();
  await page.locator('#attendees').fill('2');
}
async function select(scenario) {
  const button = page.locator(`[data-scenario="${scenario}"]`);
  if (!(await button.isVisible())) await page.locator('summary').click();
  await button.click();
}
async function begin(scenario) { await reset(); await fill(); await select(scenario); await page.locator('#submit-button').click(); }
async function screenshot(name) { await page.screenshot({ path: new URL(name, output).pathname, fullPage: true }); }
async function axe(name) {
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await writeFile(new URL(`axe-${name}.json`, output), JSON.stringify(scan.violations, null, 2));
  assert.deepEqual(scan.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })), []);
}
try {
  await page.goto(base);
  await check('Initial state and single-column layout', async () => {
    assert.equal(await page.title(), 'Simulated Concert registration');
    assert.equal(await state(), 'ready');
    assert.equal(await page.locator('.field-error:visible').count(), 0);
    assert.equal(await page.locator('#feedback').isVisible(), false);
    const boxes = await Promise.all(['#full-name', '#email', '#attendees'].map((id) => page.locator(id).boundingBox()));
    assert(boxes.every((box) => Math.abs(box.x - boxes[0].x) < 1));
    await screenshot('desktop-ready.png');
  });
  await check('No premature error, blur validation and live correction', async () => {
    await page.locator('#email').fill('alex');
    assert.equal(await page.locator('#email-error').isVisible(), false);
    await page.locator('#attendees').focus();
    assert.equal(await page.locator('#email-error').isVisible(), true);
    await page.locator('#email').fill('alex@example.com');
    assert.equal(await page.locator('#email-error').isVisible(), false);
    assert.equal(await page.locator('#email').getAttribute('aria-invalid'), null);
    assert.equal(await page.locator('#email').getAttribute('aria-describedby'), 'email-hint');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'email');
  });
  await check('Empty submit shows four errors and focuses first field', async () => {
    await reset(); await page.locator('#submit-button').click();
    assert.equal(await page.locator('.field-error:visible').count(), 4);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'full-name');
    assert.equal(await page.locator('#feedback').isVisible(), false);
    await screenshot('desktop-errors.png');
    await axe('errors');
  });
  await check('Partial correction preserves entries and focuses next invalid field', async () => {
    await page.locator('#full-name').fill('李');
    await page.locator('#submit-button').click();
    assert.equal(await page.locator('.field-error:visible').count(), 3);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'email');
    assert.equal(await page.locator('#full-name').inputValue(), '李');
  });
  await check('Email and attendee errors match the manual', async () => {
    await reset(); await fill(); await page.locator('#email').fill('alex.example.com');
    await page.locator('#attendees').fill('0'); await page.locator('#submit-button').click();
    assert.match(await page.locator('#email-error').innerText(), /you@example.com/);
    assert.match(await page.locator('#attendees-error').innerText(), /at least 1/);
    await page.locator('#attendees').fill('5');
    assert.match(await page.locator('#attendees-error').innerText(), /no more than 4/);
    await page.locator('#attendees').fill('1.5');
    assert.match(await page.locator('#attendees-error').innerText(), /whole number/);
  });
  await check('IME composition does not validate unfinished text', async () => {
    await reset(); await page.locator('#submit-button').click();
    await page.locator('#full-name').dispatchEvent('compositionstart');
    await page.locator('#full-name').fill('李');
    assert.equal(await page.locator('#fullName-error').isVisible(), true);
    await page.locator('#full-name').dispatchEvent('compositionend');
    assert.equal(await page.locator('#fullName-error').isVisible(), false);
  });
  await check('Radio navigation stays in group without premature group error', async () => {
    await reset(); await page.locator('#afternoon').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#evening').isChecked(), true);
    assert.equal(await page.locator('#session-error').isVisible(), false);
  });
  await check('Scenario selection alone never displays a service outcome', async () => {
    await reset(); await select('offline');
    assert.equal(await page.locator('#feedback').isVisible(), false);
    await page.locator('#submit-button').click();
    assert.equal(await page.locator('#feedback').isVisible(), false);
    assert.equal(await page.locator('.field-error:visible').count(), 4);
  });
  await check('Normal completion, plural label and duplicate guard', async () => {
    await reset(); await fill();
    assert.equal(await page.locator('#submit-button').innerText(), 'Get Tickets');
    await page.locator('#submit-button').click();
    await page.locator('#registration').dispatchEvent('submit');
    await waitState('complete');
    assert.match(await page.locator('#feedback').innerText(), /You registered 2 attendees/);
    assert.equal(await page.locator('#submit-button').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('#full-name').inputValue(), 'Alex Morgan');
    await screenshot('desktop-success.png');
    await axe('success');
  });
  await check('Simulated connection failure and safe retry', async () => {
    await begin('offline'); await waitState('retry');
    assert.match(await page.locator('#feedback').innerText(), /Your request was not sent/);
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
    await page.locator('#recovery-button').click(); await waitState('retry');
    assert.equal(await page.locator('#email').inputValue(), 'alex@example.com');
    await screenshot('desktop-connection-error.png');
    await axe('connection-error');
  });
  await check('Unavailable service retains all entries', async () => {
    await begin('unavailable'); await waitState('retry');
    assert.match(await page.locator('#feedback').innerText(), /service is unavailable/);
    assert.equal(await page.locator('#attendees').inputValue(), '2');
  });
  await check('Unknown outcome blocks resubmission and status check resolves', async () => {
    await begin('unknown'); await waitState('unknown');
    await page.locator('#registration').dispatchEvent('submit');
    assert.equal(await state(), 'unknown');
    await page.locator('#recovery-button').click(); await waitState('complete');
    assert.match(await page.locator('#feedback').innerText(), /Your registration was received/);
  });
  await check('Unresolved status remains uncertain with no blind retry', async () => {
    await begin('unresolved'); await waitState('unknown');
    await page.locator('#recovery-button').click(); await waitState('unresolved');
    assert.equal(await page.locator('#submit-button').getAttribute('aria-disabled'), 'true');
    assert.match(await page.locator('#feedback').innerText(), /Check again before submitting/);
  });
  await check('Unexpected response routes to status check', async () => {
    await begin('unexpected'); await waitState('unknown');
    assert.equal(await page.locator('#recovery-button').innerText(), 'Check status');
  });
  await check('Rate limit blocks retry then explicitly enables it', async () => {
    await begin('rate'); await waitState('rate');
    await page.locator('#registration').dispatchEvent('submit'); assert.equal(await state(), 'rate');
    await waitState('retry');
    await page.locator('#recovery-button').click(); await waitState('complete');
  });
  await check('Full session is retained, never silently switched', async () => {
    await begin('full'); await waitState('retry');
    assert.equal(await page.locator('#afternoon').isChecked(), true);
    assert.equal(await page.locator('#afternoon').isDisabled(), true);
    assert.equal(await page.locator('#evening').isChecked(), false);
    await page.locator('#evening').check(); await page.locator('#submit-button').click(); await waitState('complete');
  });
  await check('Closed registration blocks submission without a false recovery', async () => {
    await begin('closed'); await waitState('closed');
    assert.equal(await page.locator('#submit-button').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('#recovery-button').isVisible(), false);
    await select('normal');
    assert.equal(await state(), 'ready');
  });
  await check('Slow response can be stopped without clearing data', async () => {
    await begin('slow'); await page.locator('#recovery-button').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#recovery-button').innerText(), 'Stop waiting');
    await page.locator('#recovery-button').click();
    assert.equal(await state(), 'unknown');
    assert.equal(await page.locator('#recovery-button').innerText(), 'Check status');
    assert.equal(await page.locator('#full-name').inputValue(), 'Alex Morgan');
    await page.locator('#recovery-button').click(); await waitState('complete');
  });
  await check('Slow response completes when the user keeps waiting', async () => {
    await begin('slow'); await waitState('complete');
    assert.match(await page.locator('#feedback').innerText(), /Registration complete/);
  });
  await check('Reset during processing cancels the obsolete outcome', async () => {
    await begin('normal'); await reset(); await page.waitForTimeout(1200);
    assert.equal(await state(), 'ready');
    assert.equal(await page.locator('#feedback').isVisible(), false);
    assert.equal(await page.locator('#full-name').inputValue(), '');
  });
  await check('Edits do not resolve an unknown earlier attempt', async () => {
    await begin('unknown'); await waitState('unknown');
    await page.locator('#full-name').fill('New sample');
    assert.equal(await state(), 'unknown');
    await page.locator('#recovery-button').click();
    await page.locator('#full-name').fill('Another sample');
    assert.equal(await state(), 'unknown');
    await page.waitForTimeout(1400);
    assert.equal(await state(), 'unknown');
    assert.equal(await page.locator('#full-name').inputValue(), 'Another sample');
  });
  await check('Editing pending data cancels obsolete response', async () => {
    await begin('normal'); await page.locator('#full-name').fill('Updated sample');
    assert.equal(await state(), 'unknown');
    await page.waitForTimeout(1200);
    assert.equal(await state(), 'unknown');
    assert.match(await page.locator('#feedback').innerText(), /details changed/);
  });
  await check('Changing scenarios cancels pending work without clearing entries', async () => {
    await begin('normal'); await select('offline'); await page.waitForTimeout(1200);
    assert.equal(await state(), 'ready');
    assert.equal(await page.locator('#feedback').isVisible(), false);
    assert.equal(await page.locator('#email').inputValue(), 'alex@example.com');
  });
  await check('Real offline hint never blocks the local demo', async () => {
    await reset(); await fill(); await context.setOffline(true);
    assert.equal(await page.locator('#connection-note').isVisible(), false);
    await page.locator('#submit-button').click(); await waitState('complete');
    assert.match(await page.locator('#connection-note').innerText(), /may be offline/);
    await context.setOffline(false);
    await page.waitForFunction(() => document.getElementById('connection-note').textContent.includes('back online'));
    assert.equal(await state(), 'complete');
  });
  await check('Reset clears all states, errors and selections', async () => {
    await reset();
    assert.equal(await state(), 'ready');
    assert.equal(await page.locator('#full-name').inputValue(), '');
    assert.equal(await page.locator('#session-group :checked').count(), 0);
    assert.equal(await page.locator('.field-error:visible').count(), 0);
    assert.equal(await page.locator('[data-scenario="normal"]').getAttribute('aria-pressed'), 'true');
    await axe('ready');
  });
  for (const width of [768, 390, 320]) {
    await check(`Responsive layout at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 844 }); await reset();
      await page.locator('#submit-button').click();
      const sizes = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert(sizes.content <= sizes.viewport, JSON.stringify(sizes));
      for (const id of ['#full-name', '#email', '#attendees', '#submit-button']) {
        const bounds = await page.locator(id).boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
      }
      if (width === 390) { await screenshot('mobile-errors.png'); await axe('mobile-errors'); }
      if (width === 768) await screenshot('tablet-errors.png');
    });
  }
  await check('No-JavaScript fallback cannot submit data', async () => {
    const inert = await browser.newContext({ javaScriptEnabled: false });
    const p = await inert.newPage(); await p.goto(base);
    assert.equal(await p.locator('#script-fallback').isVisible(), true);
    assert.equal(await p.locator('#submit-button').isDisabled(), true);
    assert.equal(await p.locator('#full-name').isDisabled(), true);
    await inert.close();
  });
  await check('Mobile service feedback stays above the action button', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await begin('offline'); await waitState('retry');
    const feedback = await page.locator('#feedback').boundingBox();
    const button = await page.locator('#submit-button').boundingBox();
    assert(feedback.y + feedback.height <= button.y);
    await screenshot('mobile-connection-error.png');
    await axe('mobile-service');
  });
  await check('No runtime errors, data transmission or app storage', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(submissions, []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  });
  await check('Ticket label follows every valid attendee count', async () => {
    await reset();
    for (const count of ['1', '2', '3', '4', '5', '1']) {
      await page.locator('#attendees').fill(count);
      assert.equal(await page.locator('#submit-button').innerText(), count === '1' ? 'Get Ticket' : 'Get Tickets');
    }
  });
  await check('Keyboard follows the form and then the test controls', async () => {
    await reset();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'full-name');
    for (const id of ['email', 'afternoon']) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), id);
    }
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'evening');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'attendees');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'submit-button');
    const outline = await page.locator('#submit-button').evaluate(el => getComputedStyle(el).outlineWidth);
    assert.equal(outline, '3px');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.scenario), 'normal');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'submit-button');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'full-name');
  });
  await check('Errors have text, decorative icons and valid descriptions', async () => {
    await reset(); await page.locator('#submit-button').click();
    for (const id of ['full-name', 'email', 'afternoon', 'evening', 'attendees']) {
      const input = page.locator(`#${id}`);
      assert.equal(await input.getAttribute('aria-invalid'), 'true');
      const ids = (await input.getAttribute('aria-describedby')).split(' ');
      for (const description of ids) assert.equal(await page.locator(`#${description}`).isVisible(), true);
    }
    for (const error of await page.locator('.field-error').all()) {
      assert.equal(await error.locator('span').first().getAttribute('aria-hidden'), 'true');
      assert((await error.locator('.error-copy').innerText()).length > 0);
    }
    assert.equal(await page.locator('[role="status"]').count(), 1);
    assert.equal(await page.locator('#announcer').getAttribute('aria-atomic'), 'true');
    await page.locator('#full-name').fill('Alex Morgan');
    await page.waitForFunction(() => document.getElementById('announcer').textContent.includes('error cleared'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'full-name');
    assert.equal(await page.locator('#full-name').getAttribute('aria-invalid'), null);
  });
  await check('Feedback uses distinct colored icons and ordinary service wording', async () => {
    const colors = new Set();
    for (const [scenario, expectedState, tone] of [['normal', 'complete', 'success'], ['offline', 'retry', 'error'], ['unknown', 'unknown', 'warning']]) {
      await begin(scenario); await waitState(expectedState);
      assert.equal(await page.locator('#feedback').getAttribute('data-tone'), tone);
      assert.doesNotMatch(await page.locator('#feedback').innerText(), /simulat|practice/i);
      assert.equal(await page.locator('#feedback-icon').getAttribute('aria-hidden'), 'true');
      colors.add(await page.locator('#feedback-icon').evaluate(el => getComputedStyle(el).backgroundColor));
    }
    assert.equal(colors.size, 3);
  });
  await check('Status result refers to original entries after an edit', async () => {
    await begin('unknown'); await waitState('unknown');
    await page.locator('#attendees').fill('4');
    await page.locator('#recovery-button').click(); await waitState('complete');
    assert.match(await page.locator('#feedback').innerText(), /2 attendees/);
    assert.equal(await page.locator('#attendees').inputValue(), '4');
  });
  await check('Enlarged text keeps controls within a narrow viewport', async () => {
    await page.setViewportSize({ width: 320, height: 844 }); await reset();
    await page.evaluate(() => document.styleSheets[0].insertRule('body, input, button, label, legend, .hint, .field-error, .feedback p, .radio-option span { font-size: 34px !important; }', document.styleSheets[0].cssRules.length));
    await page.locator('#submit-button').click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await screenshot('mobile-enlarged-text.png');
    await page.reload();
  });
  await check('Forced colors retains feedback and focus boundaries', async () => {
    await page.emulateMedia({ forcedColors: 'active' });
    await reset(); await page.locator('#submit-button').click();
    assert.notEqual(await page.locator('.field-error > span').first().evaluate(el => getComputedStyle(el).borderTopStyle), 'none');
    await screenshot('forced-colors-errors.png');
    await page.emulateMedia({ forcedColors: 'none' });
  });
} finally {
  await writeFile(new URL('browser-results.json', output), JSON.stringify({ date: new Date().toISOString(), browser: browser.version(), platform: process.platform, results }, null, 2));
  await browser.close();
}
console.log(`${results.filter((r) => r.result === 'PASS').length}/${results.length} browser checks passed.`);
if (results.some((r) => r.result === 'FAIL')) process.exitCode = 1;
