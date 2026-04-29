# Factor 13: Durable Agent Runtime

> Long-running agent execution state — multi-step plans, tool-call journals, human approvals, retries — is persisted in a durable runtime. Workers stay stateless; workflow state is journaled, replayable, and resumable across crashes, deploys, and human-in-the-loop pauses.

## Motivation

The 12-factor "stateless processes" rule was written for request handlers — short-lived units of work that complete in milliseconds and never need to survive a restart. Modern AI agents don't fit that model. A coding agent that reviews a PR for an hour, a research agent that runs a 30-step plan over a weekend, or a customer-success agent that pauses for 8 hours of human approval and then resumes: these are not request handlers. They are **workflows**.

Treating agents as stateless handlers leads to predictable failure modes: lost work on worker preemption, double-billing on tool retry, broken human approval flows, and agents that "forget" what they were doing after a deploy. The fix is not to make the worker stateful — it's to externalize execution state into a **durable runtime** that journals every step and lets the workflow be replayed deterministically.

Durable execution engines (Temporal, Restate, Inngest, Dapr Workflows) and agent SDKs (Anthropic Agent SDK, OpenAI Agents SDK, Google ADK, LangGraph, Pydantic AI) made this the default in 2025–2026. The worker stays stateless; the workflow is durable.

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
- Autonomous coding agents (Claude Code, Devin, Cursor background agents, GitHub Copilot Workspace) run for hours per task. They must survive editor restarts, network disconnects, and human review pauses without losing context.
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
| **Restate** | Postgres-backed, lightweight, RPC-style, journaled state machines | Teams that want durable execution without a separate cluster |
| **Inngest** | Serverless-first, event-driven, simple developer ergonomics | Event-driven agents, JAMstack/serverless deployments |
| **Dapr Workflows** | Kubernetes-native, sidecar pattern, multi-language | K8s shops with existing Dapr investment |
| **Anthropic Agent SDK / OpenAI Agents SDK** | Built-in durable execution for agent loops; integrated with model APIs | Teams building agents on a single provider's stack |
| **LangGraph** | Python-first, graph-of-state model, integrates with LangChain ecosystem | RAG-heavy and multi-agent supervised workflows |
| **Pydantic AI** | Type-safe, Pydantic-native, lightweight | Python teams that want strict typing without a workflow cluster |

The architectural pattern is the same across all of them: **define a workflow** (deterministic), **call activities/tools** (non-deterministic), **journal every input/output**. On replay, the engine returns journaled results instead of re-executing — making retry safe and resumption fast.

### Workflow / Activity Separation

```python
# Temporal-style example — same pattern applies to other engines

# Activities (non-deterministic — call external systems)
@activity.defn
async def call_llm(prompt: str, model: str) -> LLMResponse:
    return await anthropic_client.messages.create(model=model, messages=[...])

@activity.defn
async def issue_refund(order_id: str, amount: float, idempotency_key: str) -> RefundReceipt:
    # Idempotency key MUST be deterministic and survive retry — see next section
    return await payments.refund(order_id=order_id, amount=amount, key=idempotency_key)

# Workflow (deterministic — drives the plan, never calls external systems directly)
@workflow.defn
class CustomerSupportAgent:
    @workflow.run
    async def run(self, ticket: Ticket) -> Resolution:
        # Every activity result is journaled; on replay these return journaled values
        analysis = await workflow.execute_activity(
            analyze_ticket, ticket,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=3, backoff=ExponentialBackoff()),
        )

        if analysis.requires_human_approval:
            # Durable interrupt — workflow pauses, worker freed
            decision = await workflow.wait_condition(
                lambda: self.human_decision is not None,
                timeout=timedelta(hours=24),
            )
            if decision.action == "reject":
                return Resolution(status="rejected", reason=decision.reason)

        # Idempotency key derived from workflow run — stable across retries
        idem_key = f"refund-{workflow.info().workflow_id}-{ticket.id}"
        receipt = await workflow.execute_activity(
            issue_refund, ticket.order_id, ticket.amount, idem_key,
        )
        return Resolution(status="completed", receipt=receipt)

    @workflow.signal
    def submit_human_decision(self, decision: HumanDecision):
        # Durable signal handler — runs on the next workflow turn
        self.human_decision = decision
```

The workflow code is **deterministic**: no `datetime.now()`, no random IDs, no direct I/O. All non-determinism is delegated to activities. This guarantees that replay produces the same plan that was originally executed.

### Idempotency Keys for Tool Calls

Every external side effect — payment, email send, ticket creation, model call with cost — must carry an idempotency key derived from the workflow run, not from local randomness:

```python
# WRONG — generates a new key on each retry; double-charges the customer
idem_key = str(uuid.uuid4())

# RIGHT — deterministic per workflow run + step; safe under retry
idem_key = f"{workflow.info().workflow_id}::refund::{step_index}"
```

The destination service (payment provider, email provider, ticketing API) deduplicates on this key. Most providers offer this natively (Stripe `Idempotency-Key`, AWS SQS deduplication, Slack `client_msg_id`). For services that don't, wrap them with a thin `(idem_key → result)` cache.

### Human-in-the-Loop as Durable Interrupt

The naive pattern blocks a worker on a synchronous approval call:

```python
# ANTI-PATTERN — blocks the worker for hours
decision = await human_approval_api.wait_for_decision(approval_id, timeout=8 * 3600)
```

The durable pattern parks the workflow and waits for a signal:

```python
# PATTERN — workflow paused, worker freed; resumes when signal arrives
@workflow.run
async def run(self, request):
    self.pending_decision = None
    await self.notify_approver(request)        # send notification (activity)
    await workflow.wait_condition(             # park here, no worker held
        lambda: self.pending_decision is not None,
        timeout=timedelta(hours=24),
    )
    if self.pending_decision == "approve":
        ...

@workflow.signal
def submit_decision(self, decision: str):
    self.pending_decision = decision
```

The approver clicks the link in their email; the API handler emits a workflow signal; the engine resumes the workflow on the next available worker. No worker is held during the wait. This is what makes 24-hour and multi-day approval workflows feasible.

### Workflow Versioning

Workflows in flight when you deploy a new version need a determinism guarantee. The journal was recorded against the *old* code path — replaying it against new code can break.

Two safe options:

```python
# Option 1 — branch by version using the engine's versioning primitive
version = workflow.patched("retry-with-backoff-v2")
if version:
    await workflow.execute_activity(new_retry_activity, ...)
else:
    await workflow.execute_activity(legacy_retry_activity, ...)

# Option 2 — pin in-flight workflows to old code by deploying old + new side by side
# (queue/task list separation; new workflows go to new code, old finish on old)
```

Versioning is the single most under-tested aspect of durable workflows. Add a CI test that replays a fixed set of historical journals against current code and fails if any step diverges.

### Recovery from Worker Preemption

```yaml
# kubernetes — workers run on spot/preemptible GPU nodes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-worker
spec:
  template:
    spec:
      tolerations:
        - key: preemptible
          value: "true"
      terminationGracePeriodSeconds: 30   # graceful drain (Factor 9)
      containers:
        - name: worker
          env:
            - name: TEMPORAL_TASK_QUEUE
              value: "agent-tasks"
          # On SIGTERM the worker stops polling, finishes in-flight steps,
          # and exits. The workflow keeps running on another worker — its
          # state is durable, not in this process.
```

CI test for preemption recovery:

```python
async def test_workflow_survives_worker_preemption():
    workflow_handle = await client.start_workflow(CustomerSupportAgent.run, ticket)

    # Wait for the workflow to enter activity execution
    await wait_until_activity_started(workflow_handle, "analyze_ticket")

    # Kill the worker mid-execution
    await kill_all_workers()

    # Restart workers and assert workflow completes
    await start_workers()
    result = await workflow_handle.result(timeout=60)
    assert result.status == "completed"
```

### Observability Integration

Durable engines emit step-by-step traces natively. Wire them into the broader telemetry pipeline (Factor 15) so a single trace shows: workflow plan → activity execution → LLM call → tool result → workflow continuation.

```python
# Workflow events emitted as OpenTelemetry spans, correlated with LLM call spans
@workflow.run
async def run(self, request):
    with workflow.trace.span("plan-generation"):
        plan = await workflow.execute_activity(generate_plan, request)
    for step in plan.steps:
        with workflow.trace.span(f"step:{step.name}"):
            await workflow.execute_activity(execute_step, step)
```

Key signals to alert on:

- **Stuck workflows**: workflows running > expected p99 duration
- **Replay divergence**: workflow code changed and an in-flight workflow can't replay
- **Signal/timeout deadlocks**: workflows parked on a signal that never arrives
- **Activity error rate**: per-activity failure rate vs. baseline

### Multi-Tenancy and Isolation

A single agent platform serves many tenants. Workflows must be tenant-scoped to prevent cross-tenant data leakage and to enable per-tenant rate/cost limits:

```python
@workflow.defn
class TenantScopedAgent:
    @workflow.run
    async def run(self, ctx: TenantContext, request):
        # All activities receive tenant-scoped clients
        await workflow.execute_activity(
            call_llm,
            ctx.tenant_id,
            request.prompt,
            # Per-tenant rate limit at the worker pool level — see Factor 14
            task_queue=f"tenant-{ctx.tenant_id}-agents",
        )
```

Pair with Factor 8 (Identity) for tenant identity, Factor 14 (Adaptive Concurrency) for per-tenant rate-limited worker pools, and Factor 20 (AI Economics) for per-tenant cost budgets and circuit breakers.

## Compliance Checklist

- [ ] Long-running agent execution state is persisted in a durable runtime (Temporal, Restate, Inngest, Dapr Workflows, or framework SDK)
- [ ] Workflow definitions are deterministic — no direct I/O, no `datetime.now()`, no random IDs in workflow code
- [ ] Tool calls are idempotent or guarded by deterministic idempotency keys derived from the workflow run
- [ ] Human-in-the-loop gates are implemented as durable interrupts (signals/events), not synchronous blocks
- [ ] Recovery from worker preemption (spot GPU, OOM, deploy) is exercised in CI
- [ ] Long-running workflow timeouts and step heartbeats are configured per activity
- [ ] Step-by-step traces are emitted from the workflow engine and correlated with Factor 15 telemetry
- [ ] Per-tool retry policies are bounded with exponential backoff and jitter
- [ ] Workflow versioning is handled explicitly (engine versioning primitive or queue/task list separation)
- [ ] In-flight workflow replay is tested against new code in CI before deploy
- [ ] Workflows are tenant-scoped for isolation, rate limits, and cost attribution (cross-ref Factor 8, Factor 14, Factor 20)
