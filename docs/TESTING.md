# Verification record

## Local verification

Environment: macOS, headless Google Chrome 154.0.8037.93. Browser evidence records its own UTC timestamp in `test-results/browser-results.json`.

- **37/37 unit tests passed.** Names, required entries, email validation delegation, whitespace preservation, session availability, and attendee ranges/formats.
- **38/38 browser checks passed.** Initial and dynamic validation, first-invalid focus, partial correction, IME composition, radio navigation, all ten scenarios, slow-response completion/status recovery, stale-response prevention, unknown-outcome editing, reset, real offline hints, no-JavaScript fallback and no app storage/transmission. Added checks cover ticket labels, forward/reverse tab order, visible focus, error associations, a single live region, ordinary feedback copy, colored icons, original-submission counts, enlarged text and forced colors.
- **Six axe scans reported no violations** for the enabled WCAG 2 A/AA, 2.1 AA and 2.2 AA tags: ready, errors, success, connection error, mobile errors and mobile service feedback. This is an automated result, not a full accessibility certification.
- Layout checks covered **1440, 768, 390 and 320 CSS pixels**. Text fields remained aligned in a single column; checked controls stayed in the viewport, with no page-wide horizontal overflow.
- Desktop and mobile error screenshots were visually reviewed for clipping, overlap and spacing. The mobile service screenshot checks the placement of feedback above the action button.
- No JavaScript page errors, non-GET form requests or local/session storage entries were observed by the suite.
- At 320 CSS pixels, a test-only stylesheet change enlarges body/control text to 34px; content remains within the viewport. This is not a substitute for actual browser zoom or physical-device testing.
- GitHub Pages now requires the browser suite to pass before deployment.

## Bug found and corrected

The first browser run found that displaying an error on blur could move the submit button between pointer-down and pointer-up. Validation now finishes after the pointer action; submit, reset and scenario selection clear deferred blur checks. The regression test passes.

The October 2 Linux check also found that enlarged text can overflow under different system font metrics. Long text now wraps within the page, and flex children can shrink to fit. The deployment gate checks this case before publication.

## Evidence

Run `npm run test:browser` to regenerate:

- `test-results/browser-results.json` — environment and per-check results.
- `test-results/axe-*.json` — automated accessibility findings.
- `test-results/desktop-ready.png`, `desktop-errors.png`, `desktop-success.png`, `desktop-connection-error.png`.
- `test-results/tablet-errors.png`, `mobile-errors.png`, `mobile-connection-error.png`.

Screenshots use sample entries in the working app. GitHub Actions runs the checks and saves the results as a workflow artifact.

## Still needs human evaluation

- VoiceOver/Safari and NVDA/Firefox or Chrome: actual speech, repeated-submit behavior and announcement timing. The automated suite checks DOM associations, not a human screen-reader experience.
- Physical phones/tablets, browser zoom, text enlargement, touch, high-contrast modes and speech input.
- People using the manual to write/revise a message and recover from the demonstrated errors.
- Other browser engines. Local results are Chrome results only.

These manual checks remain pending. Automated results do not establish full WCAG conformance, and simulated responses do not establish real-service reliability.
