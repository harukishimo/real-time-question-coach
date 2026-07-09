# Realtime Question Coach Design

This MVP follows the intent of `voltagent/awesome-design-md`: design decisions are documented as implementation constraints, not decorative guidance.

## Product Shape

- The first screen is the working app, not a marketing landing page.
- Primary flow: Login -> Session Setup -> Realtime Session -> Session Report.
- Session Setup is separate from the transcript screen.
- Realtime Session uses a two-pane work surface: transcript on the left, AI coach cards on the right.
- Report view focuses on heard items, missed items, next actions, export, local save, and discard.

## Interaction Rules

- Active AI cards are capped at 3.
- Overflow cards stay queued until the user marks active cards as heard, later, or dismissed.
- Cards must be short enough to scan during a live conversation.
- Browser memory is the primary session store.
- Server APIs must not persist audio, transcript body, card body, LLM input, LLM output, or report body.

## Visual System

- Dense operational layout with restrained surfaces.
- Cards use an 8px radius.
- Buttons use clear commands and compact spacing.
- Colors distinguish state and priority: green for primary action, blue for neutral context, amber/red for risk or urgency.
- No marketing hero, decorative blobs, or nested card-in-card layouts.
