# A small marketing kit for a solo maintainer

## Positioning to reuse

**Short:** Every recipe you love, minus the life story.

**One sentence:** Sizzle is an open-source cookbook you host yourself: save recipes from the web, find something worth cooking, and remember what you made.

**Audience:** Home cooks with a home server, NAS, or private-network setup who want a recipe collection they control.

**Next step:** Install Sizzle. For a development update, ask readers to try one specific workflow or give feedback on one specific rough edge.

## Four useful stories

| Story                | Show                                        | Reader's payoff                           |
| -------------------- | ------------------------------------------- | ----------------------------------------- |
| Rescue the open tabs | Batch link import and the resulting recipe  | Get saved recipes into one place          |
| What's for dinner?   | Food gallery, ingredient search and filters | Find something useful in the collection   |
| Keep your place      | Ingredient check-off and active step        | Follow a recipe while cooking             |
| Make that again      | Favorite and cooking history                | Return to recipes that earned their place |

Rotate among these stories when a relevant improvement ships. Avoid repeating the same full gallery screenshot for every update. Use different meals and close crops, and show an actual action/result pair when possible.

## One shipped feature → one small batch

A practical timebox is about 45 minutes after a user-visible change: verify the feature, capture one useful view, draft a release paragraph and one community post, and review the claims yourself. Skip the batch when the release has no useful user-facing story. A regular posting quota is optional.

For a public draft, include: the cooking problem, what changed, one screenshot, a useful limitation, and one next action. Keep community-specific rules and relevance in view; do not repost identical announcements everywhere. Never have an agent publish by default.

Example draft based on the current app; verify these behaviors before reusing:

> I kept losing recipes across tabs and bookmarks, so I’m building Sizzle, a self-hosted cookbook. Paste a recipe link and it keeps the ingredients, method and photo. You can check ingredients off while cooking and mark recipes as made afterward. Structured recipe imports work without AI; Claude is an optional fallback. It’s early software, and there’s no login yet, so keep it on a private network. Source and install guide: https://github.com/leemac/sizzle. I’d be interested in feedback on the save-to-cook flow.

## Prompts that save actual work

**Find the story in a diff**

> Use $sizzle-marketing. Read this release diff and the current UI. Pick the one change a home cook would notice most. Return: the action/result, source evidence, a screenshot plan, a 70-word release paragraph, and one 120-word community draft. Flag unsupported claims. Do not publish.

**Make the screenshot do the explaining**

> Use $sizzle-marketing to capture the current [workflow] in a local seeded demo at 390px and 1280px. Lead with food variety. Show a complete row for the gallery and close crops for controls. Write captions and alt text. Inspect the images, and return a local page preview.

**Turn support friction into useful content**

> Read these redacted support questions. Identify a recurring setup or cooking problem that the current app already solves. Draft one short answer with an exact action and a screenshot suggestion. Separate bugs from documentation gaps. Do not promise new features.

**Review the claims before publishing**

> Check this draft against the current README and implementation. For each product claim, give evidence or revise it. Check AI optionality, YouTube limitations, early-development status, and network/login guidance. Remove hype and invented social proof. Preserve my voice.

**Keep a human voice**

> Edit this rough paragraph to be clearer and shorter. Keep the concrete reason I built the feature, my first-person voice, and the limitation. Don't add adjectives, claims, numbers, or a new call to action.

Give the agent the diff and one target audience rather than asking it to “do marketing.” Reuse the verified facts and screenshots in later drafts. Keep tokens, `.env`, private cookbook data and unredacted support messages out of the prompt.

## A tiny feedback loop

Choose one learning question per batch, such as “Can someone save a link and find the result?” Watch for specific installation blockers, unsupported sites, and confusing actions. Reactions and stars show attention; successful setup and useful bug reports give stronger evidence that someone tried it.

A private local note is enough: date, feature, draft/link, screenshot, feedback, next change. Avoid adding tracking infrastructure just to publish a screenshot. Revisit positioning after repeated feedback, not after every post.
