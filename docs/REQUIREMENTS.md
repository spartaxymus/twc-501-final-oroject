# Manual alignment

The supplied final-project Word draft controls the field labels, hint text and ticket-button wording. Later drafted sections supply message-writing, accessibility, demonstration, testing and troubleshooting requirements. The Word document remains unchanged.

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
| Supplementary designs | Shared CSS tokens support later Figma alignment. This task does not create or update a Figma file. |

## Scope decisions

- The draft’s “No internet connection” example is labelled “simulated” so it does not falsely describe the user’s device.
- Names and email examples in error messages match the latest Full name / you@example.com labels, rather than the older concept’s Name / alex@example.com copy.
- “Registering…” is accompanied by “Checking your practice registration. No real registration is sent.”
- Only field validity is real. Server outcomes and wait intervals are teaching simulations.
- Passwords, payments, real booking confirmation emails, and account sessions are outside this four-field form.
- The code includes no top error summary, consistent with the selected short-form layout. The error-summary pattern can be appropriate for other forms.
- After a session-full outcome, the selected unavailable option stays visible and selected until the user deliberately chooses the alternate option.
- Browser offline status alone does not prove that any specific server is unreachable.

## Remaining academic deliverables

Use actual app screenshots in the manual. Add real repository/demo and Figma links only when verified. Record actual evaluation findings and a self-assessment separately; this project does not fabricate participant results or claim full accessibility conformance.
