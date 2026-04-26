# Operating Rules

These are the rules every change to this repo must follow. They exist to keep `master` deployable, the docs accurate, and the handoff between sessions clean.

---

## 1. One narrow job at a time

Each commit / PR addresses **a single, narrowly scoped task**. Don't bundle:

- Don't fix an unrelated bug "while you're in there."
- Don't refactor surrounding code that isn't part of the task.
- Don't add features that weren't asked for.
- Don't touch styling unless styling is the task.

If you notice something else that needs fixing, **note it for a follow-up task** — don't expand the current one. Narrow scope makes the diff easy to read, easy to revert, and easy to redeploy.

---

## 2. Push after each completed fix — and update the docs

When a task is done, **all** of the following happen before moving on:

1. **Push to `master`.** This is the deploy branch — Cloudflare auto-deploys on push.
2. **Update `README.md`** if the change altered user-facing workflow, deploy model, or test checklist.
3. **Update `CHANGELOG.md`** with a one-line entry and the commit hash, in reverse-chronological order.
4. **Update `RUNBOOK.md`** if the change affected backups, secrets, schema, or recovery procedure.

Docs are part of the work, not an afterthought. A fix without a doc update is incomplete.

---

## 3. Keep the checklist and handoff current

Every change must leave the repo in a state where the next person (or the next agent) can pick up cold:

- **Basic test checklist** in `README.md` reflects the actual paths a reviewer should click through.
- **`CHANGELOG.md`** is current — no undocumented commits sitting on `master`.
- **`RUNBOOK.md`** — if any step in it would now be wrong because of this change, fix the runbook in the same commit.
- **No half-finished implementations** on `master`. If a task can't be completed, revert rather than leaving broken state.

---

## Why these rules exist

- `master` is the live deploy. A bad push is visible to staff immediately.
- There is no staging environment. The test checklist and the docs ARE the safety net.
- The app is maintained by a small number of people across long gaps. Stale docs cost more time than they save.
