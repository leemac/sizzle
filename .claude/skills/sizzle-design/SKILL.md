---
name: sizzle-design
description: Design and refine Sizzle UI flows, interaction feedback, and motion. Use when implementing or reviewing recipe/import screens or polishing Sizzle UX.
---

# Sizzle UI/UX

Make the next action clear and its result easy to see. The experience should feel polished,
quick, simple, and quietly playful. Work within the existing tokens and conventions in
`AGENTS.md` and `app/frontend/entrypoints/application.css`.

## Forms become visible results

- Keep a submitted item close to the control that created it. For imports, place the newly
  accepted batch directly below the form, ahead of older activity.
- Clear the input after the server accepts the submission. Keep the user's work when validation
  fails or a duplicate needs a choice; confirmation should complete that same handoff.
- Show immediate submission feedback, prevent accidental double submission, and distinguish
  acceptance into a queue from a recipe actually being saved. Avoid invented progress or timing.
- Let inline progress carry the confirmation when it is sufficient. Avoid repeating it in a
  large banner that shifts the form away from its result.
- Keep the same item in place as its status changes, with an obvious link when ready and a
  nearby recovery action when it fails. Reveal the recipe's photo when available, reserving
  its space and retaining a useful fallback if it cannot load. Preserve the ability to submit
  another recipe.
- Keep incidental history compact: show about three recent imports with a human-readable time
  and an exact timestamp available on inspection. Retain older records for the future history
  view rather than deleting data to simplify the screen.
- Preserve keyboard focus where it remains useful. If the result would be out of view, reveal
  the nearest relevant item with minimal scrolling; avoid forcing the mobile keyboard open.

## Motion explains the handoff

- Use a small fade and short travel to show an item arriving. A brief stagger can help a batch
  read as a group; cap its total delay so a large batch still feels quick.
- A quiet working indicator may suggest a gentle simmer. Keep its movement small and its pace
  relaxed. A small settling cue can acknowledge completion without distracting from the recipe.
- Animate an arrival once. Polling, rerenders, and status updates should not replay the queue's
  entrance. Keep keys stable and use real status changes for completion feedback.
- Prefer opacity and transform animations. Motion must not delay interaction or convey the only
  indication of success or failure. Avoid confetti, exaggerated bounce, or attention-seeking loops.
- Under `prefers-reduced-motion: reduce`, remove decorative movement and smooth scrolling while
  keeping the same status, ordering, and actions.

## Check the experience

Walk through one link, a batch, duplicate review, an error, and completion at 390px and 1280px.
Check keyboard use, reduced motion, long labels, and a second submission while the first runs.
Verify that polling does not clear a new draft, duplicate items, replay entrances, or move focus.
Capture the meaningful before/after states; report visual checks separately from builds and tests.
