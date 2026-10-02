# Concert registration practice form

A working companion to **A Guide to Writing Accessible Error Messages for Online Forms**, Pratik K Basu’s TWC 501 final project at Arizona State University.

Built with HTML, CSS, and vanilla JavaScript. The centered form stays in one column on desktop, tablet, and mobile. **This is a teaching demonstration, not a ticket-booking service.**

**[Open the live demo](https://spartaxymus.github.io/twc-501-final-oroject/)**

GitHub Pages publishes the four application files from `main`. Tests, documentation, and local development tools are excluded from the deployed site.

## Run locally

Requires Node.js 20 or newer. There are no runtime dependencies.

```sh
npm start
```

Open **http://localhost:8081**. Use a server rather than double-clicking `index.html`, because the JavaScript uses modules. For a different port, run `PORT=8082 npm start`.

## Try it

1. Submit the empty form. Each field shows a specific error and focus moves to the first invalid field.
2. Enter sample details: Alex Morgan, alex@example.com, an afternoon or evening session, and 1–4 attendees.
3. Choose a button under **Test scenarios**, outside the form.
4. Select **Get Ticket** or **Get Tickets**. Local validation runs before the simulated service response.
5. Follow the recovery action, or use **Reset demonstration** to clear entries and start over.

The button changes to **Get Tickets** for a valid quantity above one. Names need only be nonblank; single names, short names, accents, and non-Latin characters are accepted. Email checks format, not existence or ownership.

## Features

- Visible labels and persistent hints; field errors immediately below their controls.
- Validation after leaving a field, while correcting previously validated input, and on submit. No errors during initial typing or unfinished input-method composition.
- First-invalid-field focus only after failed submission. Values remain intact during recovery.
- Progress, service failures, uncertain outcomes, and success directly above the action button, after submission.
- Native radio grouping, associated hints/errors, visible keyboard focus, text alongside color cues, and restrained polite announcements.
- Timer cancellation prevents old responses from replacing current work after edits, scenario changes, or reset.
- Duplicate-activation guards; uncertain results require a status check rather than a blind retry.
- Separate browser-reported connection hints do not disable the local demonstration or automatically resubmit it.
- A safe JavaScript-unavailable fallback leaves the form disabled rather than transmitting entries.

## Scenarios

| Scenario | Behavior |
| --- | --- |
| Normal completion | Confirmation explicitly says no booking, ticket, or email was created. |
| Slow response | Waiting feedback after 2 seconds; completion after 8 seconds; optional Stop waiting. |
| No connection | Simulated pre-send failure with retained entries and Try again. Does not change the device’s connection. |
| Service unavailable | Service-level failure, without marking valid inputs as incorrect. |
| Outcome unknown | Blocks repeat submission; Check simulated status resolves the sample outcome. |
| Status unavailable | Follow-up check remains uncertain; no fabricated support contact or blind retry. |
| Too many attempts | Fixed, explicitly simulated 5-second retry interval, then retry becomes available. |
| Session full | Selected session becomes unavailable; the user chooses the alternate session. No silent switch. |
| Registration closed | Submission stays blocked for that scenario; choose another scenario to continue. |
| Unexpected response | Unreadable response follows the unknown-outcome/status-check route. |

Simulation delays are demonstration settings, not measured service performance.

## Privacy and limits

Use sample information only. The app does not send form entries anywhere, use analytics, write cookies, or deliberately store entries in local/session storage. Entries live in page memory. Browser autofill or restoration may preserve values independently; refresh/closure persistence is not guaranteed. Hosting providers may log ordinary page requests.

There is no registration backend, database, authentication, email verification, payment, or actual email delivery. A real service needs server-side validation, authorization, secure processing, durable status/idempotency handling, and its own privacy review. A loaded page works offline, but loading the page for the first time without a connection is not supported. Simulations do not prove real-service reliability.

The layout is designed for accessibility; neither automated checks nor screenshots establish complete WCAG conformance. See [testing notes](docs/TESTING.md) for the evidence and remaining manual checks.

## Tests

```sh
npm test
npm ci
npx playwright install chromium
npm start
# In another terminal:
npm run test:browser
```

For an existing Chrome installation, set `CHROME_PATH` when running the browser suite. The browser suite generates screenshots, axe results, and `browser-results.json` under ignored `test-results/`. It does not contact a registration service.

## Files

- `index.html` — content, controls, labels, and feedback containers.
- `styles.css` — shared color/spacing tokens and responsive layouts.
- `validation.js` — field rules and exact error messages.
- `app.js` — validation timing, focus, announcements, and simulated outcomes.
- `server.mjs` — local, read-only preview server bound to loopback.
- `tests/` — repeatable validation and browser checks.
- `docs/REQUIREMENTS.md` — how the demonstration matches the manual.
- `docs/TESTING.md` — verification and remaining limitations.

## Design references

- [W3C — Labeling controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C — Form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/)
- [W3C — Grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
- [W3C — User notification](https://www.w3.org/WAI/tutorials/forms/notifications/)
- [W3C — Understanding status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [GOV.UK — Error message](https://design-system.service.gov.uk/components/error-message/)
- [GOV.UK — Names](https://design-system.service.gov.uk/patterns/names/)
- [MDN — Navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)

The message copy and simulated concert rules are project examples. Below-field placement and blur/live-correction timing are specific design choices, not universal requirements from these sources.
