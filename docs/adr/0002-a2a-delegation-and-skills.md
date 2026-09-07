# 0002 — A2A delegation and Skills as two mechanisms

**Status:** Accepted
**Date:** 2026-09

## Context

The system has one conversational voice: the learner talks only to the Tutor.
Behind it sit a dozen personas — Challenger, Teacher, Reviewer, Planner,
Scaffolder, Breaker, Assigner, Researcher, Pair, Architect, Harvester.

The obvious implementation is one `Agent` per persona, each invoked as a tool.
That was the first pass, and it was wrong for most of them.

Delegating to a separate agent means a stateless round-trip: the callee gets
the prompt you hand it and **nothing else**. It does not see the conversation.
For a Teacher asked to explain the thing the learner just struggled with, or a
Reviewer auditing judgment shown three messages ago, that history *is* the
input. Delegation was actively destroying the context these personas needed,
in exchange for isolation they had no use for.

## Decision

Two mechanisms, chosen by one question: **does this persona run an autonomous
multi-step tool loop whose output would pollute the Tutor's context?**

**Yes → a full `Agent`, invoked over A2A** (`tools/delegation.py`).

- `assigner` — reads arcs and workspace, then decides what to write.
- `researcher` — iterative search; isolating its noisy tool output from the
  Tutor's context is the entire point of delegating it.

**No → a Skill** (`backend/.agents/skills/<name>/SKILL.md`), loaded into the
Tutor's own context via `load_capability`.

- `challenger`, `teacher`, `reviewer`, `planner`, `scaffolder`, `breaker`.

A Skill is a prompt-shaped behavior with no tool loop of its own. Loading it
in-context costs no round-trip and keeps the full thread history available.

`pair` and `architect` are siblings, not delegates: the learner selects them
directly via `agentId`. `harvester` is a full agent with no caller yet (ADR
0001).

## Consequences

**Skills are cheaper and better for their cases, not a downgrade.** The
mechanism follows the need for context isolation, not the persona's
importance.

**Skill invocations need explicit UI plumbing.** Every Skill call arrives as a
tool named `load_capability` with the real id in its arguments, so
`server.py`'s `_skill_id_from_args` unwraps it. Without that, every Skill is
indistinguishable from a generic tool call in the transcript.

**Two places to look when adding a persona.** The criteria live in
CONTRIBUTING.md so the choice is made deliberately rather than by copying
whichever example was nearest.

**A2A calls are invisible to thread history unless persisted.** Tool call and
result events are written to `db.tool_events` as they stream, so delegation
survives a page reload instead of existing only in the live DOM.
