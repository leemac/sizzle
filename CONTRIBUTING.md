# Contributing

Thanks for helping make Sizzle better. Contributions from people and from AI agents are both
welcome, and both follow the same path: an issue, a branch, a pull request, a human review.

## Before you start

- **Bugs:** open an issue using the bug template. Security problems go through
  [private reporting](SECURITY.md) instead.
- **Features:** open an issue first so we can agree on the shape before code is written. Issues
  labelled `agent-ready` are fully specified and ready for anyone, human or agent, to pick up.
- Read [AGENTS.md](AGENTS.md). It covers the architecture, the conventions and the security rules
  every change must follow.

## Making a change

```sh
bin/setup --seed
git switch -c fix/123-short-description
# …make the change, with tests…
bin/ci
```

Open a pull request that links the issue (`Closes #123`), says how you verified the change, and
includes screenshots at phone and desktop widths for UI changes. Keep pull requests small and
focused. Follow-up ideas belong in new issues.

## Using AI agents

You're welcome to use Claude Code, Codex or any other assistant. You're responsible for what you
submit: read the diff, run `bin/ci`, and make sure the security checklist in the pull request
template is true. Note in the pull request which agent you used.

## Licensing

By contributing, you agree that your contributions are licensed under the [AGPL-3.0](LICENSE).

## Conduct

Be kind and assume good faith. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
