# 0003 — Multi-layer memory on files plus SQLite

**Status:** Accepted
**Date:** 2026-09

## Context

A tutor that forgets is worse than no tutor. The failure mode to design
against is the agent asking *"where did we leave off?"* — the learner should
never have to reconstruct their own history.

But "remember everything" is not a design. Different kinds of memory have
genuinely different access patterns, lifetimes, and writers, and collapsing
them into one store makes all of them worse.

## Decision

Four layers, each with its own store, chosen by access pattern.

### Working memory — `_meta/WORKING_MEMORY.md`

A Markdown learner profile injected into **every** agent call through an
`agent.instructions(...)` hook, so it is re-read fresh per call rather than
frozen at construction.

Edited one section at a time (`update_working_memory`), never wholesale. A
whole-document rewrite lets the model silently drop sections it did not feel
like repeating — the failure is invisible and permanent.

### Episodes and observations — `_meta/EPISODES.jsonl`, `_meta/OBSERVATIONS.json`

Episodes are append-only session records: what was reached, what was
extracted, where the friction was. JSONL because the operation is always
"append one" or "read all", never "update the third field of row 12".

Observations are short durable facts captured mid-session, the moment they are
noticed, without waiting for session close.

### Living library and audit graph — `_meta/LIBRARY.md`, `EVIDENCES.json`, `ARCS.json`

The long-term layer, structured as a three-level chain:

- **L3 Capability Arcs** — the skill map.
- **L2 Evidence** — auditable claims, each with a metric and a reproduction
  command.
- **L1 Traces** — the episodes the evidence came from.

The invariant: **a capability is only "verified" if it traces to reproducible
L2 evidence.** `auditHealthScore` is exactly the share of verified
capabilities that actually do, which makes contradictory or unbacked claims
visible instead of accumulating silently.

### Workspaces — `workspace/<slug>/`, plus SQLite for threads

Per-project directories scope context to one repo or project: SPEC.md,
STATE.md, phase artifacts. Conversation threads, messages, and tool events go
to SQLite (`db.py`) — high write volume, needs real queries and ordering.

## Why files for memory and SQLite only for threads

Memory is written rarely, read constantly by a model, and needs to be
inspectable by a human. Markdown and JSON are diffable, greppable, editable by
hand, and survive the application being uninstalled. A model can also edit a
Markdown section far more reliably than it can emit a correct UPDATE.

Threads are the opposite: thousands of rows, ordering and filtering matter,
nobody reads them by hand. That is a database.

## Consequences

**Single-writer discipline is manual.** PROFILE.md is written only by the
Harvester; nothing enforces that but convention. Two writers would silently
clobber sections.

**Section replacement is regex over Markdown.** Concentrated in
`markdown.py::replace_section` so there is one place to get it right —
including using a replacement *callable*, since agent-authored content
containing `\1` would otherwise be interpreted as a backreference.

**No seeded evidence.** A fresh install starts with zero evidence and zero
verified capabilities. Shipping example evidence would fabricate an audit
trail the user never earned, which contradicts the invariant the whole layer
exists to enforce. Default Arcs ship as an empty curriculum template only.

**No vector search.** Recall is keyword search over episodes
(`episodes_search`) and explicit reads. Adequate at one learner's scale;
revisit if it stops being.
