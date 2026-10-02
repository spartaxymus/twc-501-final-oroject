# Manual alignment

The form accompanies the final-project manual. This checklist maps its requirements to the implementation.

| Manual requirement | Implementation |
| --- | --- |
| One column at every size | A single form column, with layouts checked at desktop, tablet and narrow mobile widths. |
| Full name | One visible label and input; rejects empty/whitespace-only input, no arbitrary two-character minimum. |
| Email address | Visible `you@example.com` example; browser format validation on a trimmed copy. No ownership claim. |
| Concert session | Native fieldset/legend and afternoon/evening radio options, with times and no default. |
| Attendees | Whole decimal number 1–4, including the registrant; distinct empty, minimum, maximum and format messages. |
| Get Ticket / Get Tickets | Quantity-aware button label. Persistent practice notice avoids suggesting a real booking. |
| Dynamic validation | First check on field/group exit; recheck previously validated fields while editing; all fields checked on submit. IME composition is deferred. |
| Preserve entries | No automatic reset on validation or service failure. Reset/Start again clears explicitly. |
| Below-field errors | One current error per field; group error below both session choices. |
| Form-level feedback | Progress, service problems and success above the action button after an attempt. |
| Keyboard and screen-reader support | Native controls, error/hint associations, first-invalid focus on failed submit, polite announcements. Human assistive-technology evaluation remains necessary. |
| External scenario controls | Buttons outside the attendee form set the next valid submission outcome without immediately showing it. |
| No connection | Explicitly simulated pre-send failure. Actual browser offline reports are a separate, qualified hint and never block local work. |
| Unknown outcome | A status check replaces blind resubmission; editing entries does not resolve an uncertain earlier attempt. |
| Supplementary designs | Shared CSS tokens support consistent Figma layouts. |

## Scope decisions

- The October 2 PDF is the content baseline. The later requested heading is “Simulated Concert registration”; feedback uses ordinary registration language, with practice-only disclosure outside the form.
- The empty name message matches Table 3: “Enter your name.” Other field messages retain the manual's wording.
- “Registering…” is accompanied by “Please wait while we process your registration.”
- The requested recovery label “Check status” replaces the manual's older “Check simulated status.” The PDF itself remains unchanged.
- Each feedback tone uses a colored icon and explanatory text. Icons are hidden from screen readers to avoid repeating the message.
- Stopping a wait or editing pending entries requires a status check before retrying. This avoids implying that stopping a wait cancels a request already sent in a real service.
- Only field validity is real. Server outcomes and wait intervals are teaching simulations.
- Passwords, payments, real booking confirmation emails, and account sessions are outside this four-field form.
- The code includes no top error summary, consistent with the selected short-form layout. The error-summary pattern can be appropriate for other forms.
- After a session-full outcome, the selected unavailable option stays visible and selected until the user deliberately chooses the alternate option.
- Browser offline status alone does not prove that any specific server is unreachable.

## Remaining academic deliverables

Remaining items: app screenshots, verified project links, evaluation findings, and a separate self-assessment. Full accessibility conformance requires manual evaluation beyond the automated checks in this repository.
