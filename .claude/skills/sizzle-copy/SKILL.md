---
name: sizzle-copy
description: Write and trim Sizzle interface text — headings, intros, hints, helper text, empty states, buttons and errors. Use whenever adding or changing words on a Sizzle screen, and when reviewing a UI diff, to keep out filler such as taglines, eyebrows, section blurbs and text that repeats what the controls already say.
---

# Sizzle interface copy

Every line of text on a screen must help someone do something or avoid a mistake. If removing a
line loses nothing a person needs, leave it out. Headings, labels and controls usually say enough.

## Cut on sight

These were removed from Sizzle because they add reading without adding information:

| Kind | Removed example | Why it goes |
|------|-----------------|-------------|
| Eyebrow above a heading | "Make yourself at home" over **Settings** | Decoration; the heading already names the page. |
| Page intro restating the page | "A few choices for how you browse and cook. Preferences are saved in this browser, so everyone can have their own." | Says what the page obviously is. The one useful fact (saved in this browser) already shows beside the Save button. |
| Section tagline | "A look that feels right, day or night." · "Make the recipe easier to follow at the counter." · "Open your cookbook the way you like it." · "Your cookbook belongs to you." | Mood, not information. The section title and its controls carry the meaning. |
| Pointer to another place | "You can also change the order in your cookbook. Grid or list view is remembered there too." | Explains the app instead of letting the control be where people look for it. |
| Instructions for visible buttons | "Try these again, write them yourself, or dismiss them to clear the alert." above Try again / Write a recipe / Dismiss | The buttons are the instructions. |
| Repeated detail | Export limits spread over three paragraphs before the Download button | Edge-case detail belongs in a collapsed `<details>`, after the action. |

## Keep

- **Facts that change a decision**: costs ("This may incur API charges"), privacy ("sent to
  Anthropic"), scope ("applies to imports from this browser"), irreversible effects.
- **Errors** that say what happened and what to do next, naming the exact button to press.
- **Field help** for a format or limit people can't guess ("one link per line, up to 20").
- **Status** that reflects real state ("Saved in this browser", "3 importing · 1 saved").

## How to write what stays

- Lead with the control, not a sentence about it. A labelled select needs no blurb.
- One sentence beats two. Drop the second if the first does the job.
- Plain and specific, sentence case, no exclamation marks, no puns in functional text. Sizzle's
  playfulness lives in names (theme names, "What's for breakfast?"), motion and small touches,
  never in explanatory copy.
- Use the same words as the UI: if the tab says **Write a recipe**, buttons and errors say
  "Write a recipe" too, not "Write manually".
- Put rare details (limits, caveats, how it works) behind `<details>` or on the docs site, not in
  the main flow.
- Prefer a number or noun phrase to a sentence: "20 recipes, 22 photos" over "Download all 20
  recipes and 22 photos, including…".

## Check before you finish

Read the screen top to bottom and, for each line of non-control text, ask: *would anyone miss
this?* If not, delete it. Then check that what remains still explains any cost, privacy effect,
or failure a person needs to know about.
