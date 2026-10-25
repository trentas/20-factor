---
layout: page
importance: 13
category: "Tier 3: Operation"
title: "13. Durable Agent Runtime"
nav_order: 5
description: "Persist long-running agent execution state with journaling, idempotent tool calls, and durable HITL interrupts."
---

# Factor 13: Durable Agent Runtime

> Long-running agent execution state — multi-step plans, tool-call journals, human approvals, retries — is persisted in a durable runtime. Workers stay stateless; workflow state is journaled, replayable, and resumable across crashes, deploys, and human-in-the-loop pauses.

## Motivation

The 12-factor "stateless processes" rule was written for request handlers — short-lived units of work that complete in milliseconds and never need to survive a restart. Modern AI agents don't fit that model. A coding agent that reviews a PR for an hour, a research agent that runs a 30-step plan over a weekend, or a customer-success agent that pauses for 8 hours of human approval and then resumes: these are not request handlers. They are **workflows**.

Treating agents as stateless handlers leads to predictable failure modes: lost work on worker preemption, double-billing on tool retry, broken human approval flows, and agents that "forget" what they were doing after a deploy. The fix is not to make the worker stateful — it's to externalize execution state into a **durable runtime** that journals every step and lets the workflow be replayed deterministically.

Durable execution engines (Temporal, Restate, DBOS, Inngest, Dapr Workflows) made this the default in 2025–2026, and agent frameworks increasingly integrate with them. The distinction matters: an agent SDK (Claude Agent SDK, OpenAI Agents SDK, Google ADK) supplies the agent *loop*; durability — journaling every step and resuming after a crash — comes from the engine or persistence layer underneath it. The worker stays stateless; the workflow is durable.

## What This Replaces

This factor doesn't replace any single 12/15-factor predecessor — it carves out a domain that the original "stateless processes" rule does not address. The 12-factor rule still applies to **workers** (and to caching, covered in Factor 12). What's new in this factor is the explicit recognition that **agent execution state is durable, not stateless**.

This factor governs:

- Where agent execution state lives (journal/event log)
- How workflows are replayed deterministically
- How tool calls become idempotent under retry
- How human-in-the-loop approvals are modeled as durable interrupts
- How recovery from worker preemption, crashes, and deploys is exercised
- How workflow versions evolve without breaking in-flight executions

Cross-references: Factor 12 covers stateless workers and caching. Factor 18 covers agent *architecture* (orchestration patterns, tool permissions, bounded autonomy). Factor 13 sits between them — it's the **runtime substrate** that makes long-running agents safe and resumable.

## How AI Changes This

### AI-Assisted Development
- Autonomous coding agents (Claude Code, Codex, Devin, Cursor background agents, GitHub Copilot coding agent) run for hours per task. They must survive editor restarts, network disconnects, and human review pauses without losing context.
- Background coding agents that open PRs typically execute as durable workflows: each commit, each tool call, each test run is a journaled step. Failures don't restart from zero — they replay from the last successful checkpoint.

### AI-Native Applications
- **Multi-step business workflows** (claims processing, onboarding, research, code review) run for minutes to days. The 12-factor rule "any process can handle any request" still holds for the *worker* — but the *workflow* is anchored to a durable identifier and resumes anywhere.
- **Tool failures are routine**, not exceptional. LLM provider 5xx, vector DB timeouts, third-party APIs flaking — agents must retry with idempotency to avoid double-charging cards, double-sending emails, or double-creating tickets.
- **Human-in-the-loop is asynchronous**. An approval that takes 8 hours cannot block a worker. The workflow pauses, waits on a durable signal, and resumes when the human responds — possibly on a different worker, in a different process, after a deploy.
- **Spot/preemptible GPUs** are economically attractive for inference but require the workflow to recover from arbitrary worker termination. The journal makes preemption a non-event.

## In Practice

### Choosing a Durable Execution Engine

Production-grade options as of 2026:

| Tool | Strengths | Best for |
|------|-----------|----------|
| **Temporal** | Mature, battle-tested, polyglot SDKs, strong typing, observability | General-purpose long-running workflows; teams that want a cluster |
| **Restate** | Self-contained single binary, lightweight, RPC-style, journaled state machines | Teams that want durable execution without a separate cluster |
| **DBOS** | Postgres-native durable execution (state lives in your Postgres) | Teams already on Postgres that want durability without new infra |
| **Inngest** | Serverless-first, event-driven, simple developer ergonomics | Event-driven agents, JAMstack/serverless deployments |
| **Dapr Workflows** | Kubernetes-native, sidecar pattern, multi-language | K8s shops with existing Dapr investment |
| **Claude Agent SDK / OpenAI Agents SDK** | Agent-loop harness (context, tools, memory) — pair with a durable engine above for journaling and crash-safe resume | Teams building agents on a single provider's stack |
| **LangGraph** | Python-first, graph-of-state model, integrates with LangChain ecosystem — durable only when backed by a persistent checkpointer (e.g., Postgres) | RAG-heavy and multi-agent supervised workflows |
| **Pydantic AI** | Type-safe, Pydantic-native, lightweight — durable execution via its Temporal/DBOS integrations | Python teams that want strict typing on top of an existing engine |

**The test for "durable":** kill the worker mid-step, restart it, and check that the run resumes from its last completed step without re-executing side effects. An engine passes on its own; an agent SDK or framework passes only when it runs on top of an engine or a persistent checkpointer. An SDK running its loop in process memory does not — however good its context and tool handling.

The architectural pattern is the same across all of them: **define a workflow** (deterministic), **call activities/tools** (non-deterministic), **journal every input/output**. On replay, the engine returns journaled results instead of re-executing — making retry safe and resumption fast.

### Workflow / Activity Separation

Every durable engine splits agent code into two kinds of step:

| | Workflow | Activity (model or tool call) |
|---|---|---|
| **Role** | Drives the plan: decides which step runs next | Does the work: calls the model, a tool, an external API |
| **Determinism** | Must be deterministic — replay must reproduce the same decisions | May be non-deterministic |
| **May do** | Branch on journaled results, wait on signals and timers, start activities | Network and disk I/O, model calls, side effects |
| **Must not do** | Direct I/O, read the wall clock, generate random IDs, call external systems | Keep state that must survive a crash |
| **On failure** | Resumes from the journal on any worker | Retried by the engine under its retry policy |

The workflow code is **deterministic**: no `datetime.now()`, no random IDs, no direct I/O — use the engine's own clock and random helpers where it provides them. All other non-determinism is delegated to activities. This guarantees that replay produces the same plan that was originally executed.

Give every activity a per-attempt timeout, a bounded retry policy with exponential backoff and jitter, and a heartbeat if it runs long, so the engine can tell a slow step from a lost worker.

### Idempotency Keys for Tool Calls

Engines retry activities — after a timeout, an error, or a worker crash — and that is what makes them durable. It also means any activity can run more than once. The engine guarantees that the *workflow* resumes; it does not make an external charge, email, or ticket happen exactly once. That is the job of idempotency.

Every external side effect — payment, email send, ticket creation, model call with cost — must carry an idempotency key derived from the workflow run, not from local randomness:

```python
# WRONG — generates a new key on each retry; double-charges the customer
idem_key = str(uuid.uuid4())

# RIGHT — deterministic per workflow + step; the same on every retry
idem_key = f"{workflow_id}::refund::{step_index}"
```

The key only helps if the **destination** deduplicates on it. Many payment, messaging, and ticketing APIs do so natively (Stripe `Idempotency-Key` header, AWS SQS `MessageDeduplicationId`). When a destination doesn't:

- **A local `(idem_key → result)` cache is not enough.** If the effect happens and the worker crashes before the result is recorded, the retry finds no entry and repeats the effect.
- **Commit intent and effect together** when the effect is a write to a database you control — for example, with a transactional outbox — and still make downstream consumers tolerate duplicates.
- **Treat each attempt as having three outcomes**: success, confirmed failure, or *unknown* (timeout, dropped connection, crash mid-call). Retry directly only after a confirmed failure. For an unknown outcome, reconcile first — look the operation up at the destination by its key or a business identifier — then retry or record the result.
- **Define a compensation for what cannot be deduplicated** (refund, retraction, follow-up message), and who triggers it.

Further reading: Temporal, [What is idempotency? And why it matters for durable systems](https://temporal.io/blog/idempotency-and-durable-execution); AWS Prescriptive Guidance, [Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

### Human-in-the-Loop as Durable Interrupt

The naive pattern blocks a worker on a synchronous approval call: the worker is held for hours, and the pending approval dies with the process.

The durable pattern parks the workflow instead:

1. An activity notifies the approver (email, chat, ticket), identifying the workflow and the exact action to approve.
2. The workflow waits on a durable condition — "a decision has arrived" — with a timeout. No worker is held while it waits.
3. The approver's response reaches your API, which sends the workflow a **signal**. The signal handler stores the decision in workflow state, and the engine resumes the workflow on the next available worker — possibly in a different process, after a deploy.
4. The workflow reads the decision from that state and acts on it.

Two details are easy to get wrong. The wait primitive is a condition, not a channel: Temporal's `wait_condition`, for example, returns nothing — it resumes when the condition holds or the timeout expires — so read the decision from the state the signal handler set, never from the wait call. And a timeout is an outcome, not an error: decide in advance whether an unanswered request expires, escalates, or is rejected. Factor 18 defines what an approval must be bound to (the exact action, an authorized approver, an expiry), so a decision recorded hours ago cannot authorize something else.

This is what makes 24-hour and multi-day approval workflows feasible. Further reading: Temporal, [Workflow message passing (Python)](https://docs.temporal.io/develop/python/workflows/message-passing).

### Long-Running Tools over MCP

The same durability rules apply when the slow step is a *tool* on an MCP server rather than an activity in your own engine. The MCP 2026-07-28 revision gives you two primitives that map directly onto this factor:

- **Tasks** (now the official `io.modelcontextprotocol/tasks` extension): a tool call can return a task handle instead of blocking. The client polls with `tasks/get` and sends follow-up input with `tasks/update`. Store the task handle in the workflow journal like any other activity result, and poll from an activity — never from deterministic workflow code.
- **Multi round-trip requests (MRTR)**: when a server needs more input (a confirmation, a credential, a form), it returns an `input_required` result; the client retries the original request with the answers, carrying back the server's opaque `requestState`. Treat each round trip as a journaled step and the human answer as a durable signal — the same pattern as the approval above.

Because MCP removed protocol-level sessions and stream resumability, a dropped connection loses the in-flight request and the client must re-issue it with a new request ID. That makes idempotency keys on side-effecting MCP tools mandatory, not optional.

### Workflow Versioning

Workflows in flight when you deploy a new version need a determinism guarantee. The journal was recorded against the *old* code path — replaying it against new code can break.

Two safe options:

- **Branch by version inside the workflow** with the engine's versioning primitive (Temporal's patching API, for example): in-flight runs replay the old branch, new runs take the new one, and the old branch is removed once no run that needs it remains.
- **Run old and new code side by side**: route new workflows to the new code through a separate queue or task list, and let in-flight workflows finish on the old workers.

Versioning is the single most under-tested aspect of durable workflows. Add a CI test that replays a fixed set of historical journals against current code and fails if any step diverges.

### Recovery from Worker Preemption

Workers on spot or preemptible nodes — GPU inference especially — must treat termination as routine:

- **Drain on SIGTERM**: stop polling for new tasks, let in-flight steps finish or heartbeat within the grace period, then exit (Factor 9). The workflow keeps running on another worker; its state is in the journal, not in this process.
- **Heartbeat long activities** and set per-attempt timeouts, so the engine detects a lost worker quickly and reschedules the step.
- **Test it in CI**: start a workflow, kill every worker while a side-effecting step is in flight, restart the workers, and assert that the workflow completes *and* that the external effect happened exactly once. Cover a kill before the external call commits and a kill after it commits but before the result is journaled — the second case is the one a local cache gets wrong.

### Observability Integration

Durable engines emit step-by-step traces natively. Wire them into the broader telemetry pipeline (Factor 15) so a single trace shows: workflow plan → activity execution → LLM call → tool result → workflow continuation. Propagate trace context from the workflow into each activity, so model-call spans nest under the step that issued them, and tag spans with the workflow ID so any user report can be traced to its run.

Key signals to alert on:

- **Stuck workflows**: workflows running > expected p99 duration
- **Replay divergence**: workflow code changed and an in-flight workflow can't replay
- **Signal/timeout deadlocks**: workflows parked on a signal that never arrives
- **Activity error rate**: per-activity failure rate vs. baseline

### Multi-Tenancy and Isolation

A single agent platform serves many tenants. Workflows must be tenant-scoped to prevent cross-tenant data leakage and to enable per-tenant rate/cost limits:

- **The tenant is part of the workflow's input**, recorded in the journal — never looked up from ambient process state.
- **Activities act with tenant-scoped clients and credentials** (Factor 8); a worker never reuses one tenant's token for another tenant's step.
- **Limits apply per tenant**: rate and concurrency limits in the worker pools (Factor 14), cost budgets and circuit breakers (Factor 20). Tenants that need hard isolation get their own task queues or worker pools.

Pair with Factor 8 (Identity) for tenant identity, Factor 14 (Adaptive Concurrency) for per-tenant rate-limited worker pools, and Factor 20 (AI Economics) for per-tenant cost budgets and circuit breakers.

## Compliance Checklist

- [ ] Long-running agent execution state is persisted in a durable runtime (Temporal, Restate, DBOS, Inngest, Dapr Workflows, or equivalent); an agent SDK or framework counts only when it runs on one of these or on a persistent checkpointer that resumes from the last completed step after a crash
- [ ] Long-running MCP tool calls (tasks, multi round-trip requests) are journaled and polled from activities, and side-effecting MCP tools carry idempotency keys
- [ ] Workflow definitions are deterministic — no direct I/O, no `datetime.now()`, no random IDs in workflow code
- [ ] Tool calls are idempotent or guarded by deterministic idempotency keys derived from the workflow run and honored by the destination; attempts with an unknown outcome are reconciled before retry
- [ ] Human-in-the-loop gates are implemented as durable interrupts (signals/events), not synchronous blocks
- [ ] Recovery from worker preemption (spot GPU, OOM, deploy) is exercised in CI
- [ ] Long-running workflow timeouts and step heartbeats are configured per activity
- [ ] Step-by-step traces are emitted from the workflow engine and correlated with Factor 15 telemetry
- [ ] Per-tool retry policies are bounded with exponential backoff and jitter
- [ ] Workflow versioning is handled explicitly (engine versioning primitive or queue/task list separation)
- [ ] In-flight workflow replay is tested against new code in CI before deploy
- [ ] Workflows are tenant-scoped for isolation, rate limits, and cost attribution (cross-ref Factor 8, Factor 14, Factor 20)
