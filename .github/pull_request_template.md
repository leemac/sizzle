Closes #

## What changed

<!-- A short description of the change and why. -->

## How I verified it

<!-- Tests added, commands run, screenshots at 390px and 1280px for UI changes. -->

- [ ] `bin/ci` passes locally

## Security checklist

- [ ] Untrusted URLs are fetched only through `SafeHttp`
- [ ] No shell commands built from strings; no imported HTML rendered as HTML
- [ ] Model output and user input are validated before use
- [ ] No secrets, tokens or personal data in code, fixtures or logs
- [ ] New settings default to the safe option and are documented in `.env.example`
- [ ] Not applicable: this change doesn't touch input handling, fetching, storage or config

## Agent disclosure

<!-- If an AI agent wrote this change, which one? (e.g. Claude Code, Codex.) A human must still review it. -->
