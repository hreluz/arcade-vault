---
name: spec-impl-game
description: Implements an approved game spec exactly like /spec-impl, then runs the skin-designer agent and, once it finishes, the mobile-porter agent on that game.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implement a game spec, then skin it and review it on mobile

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instructions

Follow these phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phases 1–4 — Implement the spec, as /spec-impl does

Read `.agents/skills/spec-impl/SKILL.md` and follow its Phases 1–4 exactly, using `$ARGUMENTS` as the received argument and the session context above. That file is the single source of truth for finding the spec, the Approved-only gate, the branch, the pause after each step and the no-commit rule.

- All of its stop conditions apply. If any of them stops the run, Phases 5–7 do not run.
- Hold back its closing "All steps of the plan are implemented" message. It is replaced by the closing message at the end of this file.

---

### Phase 5 — Resolve the game id

Once the last step of the plan is implemented, continue without asking.

Take the id from the spec file name (`NN-<id>-game.md`) and confirm it is a key of `ENGINES` in `lib/engines/index.ts`.

- If it is not a key but the spec is a game spec, ask the user for the id and wait.
- If the spec is not a game spec, say so, skip Phases 6–7 and go to the closing message.

---

### Phase 6 — Run skin-designer

Make one `Agent` call with `subagent_type: "skin-designer"` and the prompt `Skin <id>.`

Wait for its completion notification, then relay its result to the user.

If it ends blocked (`tsc` or lint failing, or a `Blocked:` status), skip Phase 7 and go to the closing message, saying that `mobile-porter` did not run and why. A layout review on a broken build proves nothing.

---

### Phase 7 — Run mobile-porter

Only after Phase 6 has finished, make one `Agent` call with `subagent_type: "mobile-porter"` and this prompt:

```
Review <id> only: /games/<id> and /games/<id>/play, in every player state and viewport of your review matrix, including the SKIN and MODE buttons.
```

Wait for its completion notification, then relay its report to the user.

**Hard rule:** the two agents never run in parallel. Never send both `Agent` calls in the same message, and never start `mobile-porter` before `skin-designer` has reported back.

---

### Closing message

```
✅ All steps of the plan are implemented.

skin-designer: [outcome]
mobile-porter: [outcome, or "did not run" and why]

Nothing has been committed.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" (or the equivalent
in your repo's language) and make the final commit before merging this branch.
```
