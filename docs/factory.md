# The Sizzle software factory

Sizzle is built by a small team of humans and AI coding agents (Claude Code, Codex, and others)
working from the same queue of GitHub issues. Humans decide *what* to build and review every
change. Agents do most of the building. This document describes how that works.

## The loop

```
 idea ──► issue (needs-spec) ──► spec written ──► agent-ready ──► agent builds on a branch
                                                                         │
             merged ◄── human review ◄── CI green ◄── pull request ◄─────┘
```

1. **Capture.** Anyone opens an issue. New feature issues start as `needs-spec`.
2. **Specify.** A maintainer, or an agent asked to draft one, rewrites the issue into a spec:
   context, acceptance criteria, out-of-scope items, and pointers to relevant files. Then they
   label it `agent-ready`. A good spec is the single biggest factor in a good agent result.
3. **Build.** An agent picks up an `agent-ready` issue, works on its own branch (a separate git
   worktree when several agents run at once), follows [AGENTS.md](../AGENTS.md), and opens a pull
   request that closes the issue.
4. **Verify.** CI runs tests, linters, type checks, Brakeman, dependency audits, CodeQL, and a
   hardened Docker boot. Nothing merges red.
5. **Review.** A human reads the diff, checks the security checklist, and merges or requests
   changes. Agents never merge.

The GitHub Project board mirrors these columns: **Backlog → Spec → Ready → In progress → In review → Done**.

## Labels

| Label | Meaning |
|-------|---------|
| `needs-spec` | An idea or request that isn't specified enough to build yet. |
| `agent-ready` | Fully specified; any agent or human can pick it up. Only maintainers apply it. |
| `in-progress` | Someone (or some agent) is on it. Comment with which agent is working it. |
| `human-only` | Needs judgement, credentials or access an agent shouldn't have (releases, infra, security fixes). |
| `security` | Touches the threat model. Needs extra review. |
| `area:import`, `area:ui`, `area:infra`, `area:docs` | Where the work lives. |
| `size:s`, `size:m`, `size:l` | Rough effort. Prefer splitting `size:l` before marking it agent-ready. |
| `good first issue` | Small and well-specified, good for new human contributors. |

## Writing an agent-ready issue

Write it so someone with no context could finish it in one pull request:

- **Context:** why this matters and what the user sees today.
- **Acceptance criteria:** checkable bullets. Include the edge cases you care about, and the tests
  you expect ("a model test proves X").
- **Out of scope:** what not to touch. Agents follow this literally.
- **Pointers:** the files and patterns to follow (e.g. "follow `RecipeImages` for downloads").
- **Security notes:** anything in the threat model the change touches.

## Running agents

Agents run **locally**, on a maintainer's machine, not from GitHub Actions. That's deliberate.
The repository is public, so issue and comment text is written by strangers, and an agent that
CI triggers with write access is a prompt-injection target. Running locally keeps credentials
off GitHub and keeps a human in the loop at the start of every run.

Typical run, one issue per worktree:

```sh
git worktree add ../sizzle-123 -b agent/123-cook-mode main
cd ../sizzle-123 && bin/setup --seed
# Claude Code:
claude "Work on issue #123 (gh issue view 123). Follow AGENTS.md. Open a PR when bin/ci passes."
# or Codex:
codex "Work on issue #123 (gh issue view 123). Follow AGENTS.md. Open a PR when bin/ci passes."
```

When running agents:

- Give them the issue number, not a paraphrase. The issue is the spec.
- Let them use `gh` to read issues and open pull requests. Don't give them tokens that can merge,
  change settings, or read other repositories.
- Real API keys stay in your `.env`. Tests never need them.

### If we automate triggers later

If we add the Claude Code GitHub Action or Codex cloud tasks, they must:

- trigger only on the `agent-ready` label, which only maintainers can apply, never on comments
  from arbitrary users;
- run with the minimum permissions (`contents: write` on a branch, `pull-requests: write`),
  never `admin` or access to secrets beyond the model API key;
- open pull requests for human review, never push to `main`.

## Releases

Releases are `human-only`: a maintainer tags a version, CI builds and publishes the container
image to `ghcr.io/leemac/sizzle`, and the release notes are drafted from merged pull requests.
