---
layout: page
importance: 18
category: "Tier 4: Intelligence"
title: "18. Agent Orchestration and Bounded Autonomy"
nav_order: 3
description: "Agent architecture, tool permissions, execution budgets, human-in-the-loop gates."
---

# Factor 18: Agent Orchestration and Bounded Autonomy

> Design AI agents with explicit capabilities, clear boundaries, execution budgets, and human-in-the-loop gates — orchestrated through well-defined patterns.

## Motivation

AI agents — systems that can plan, use tools, and take actions autonomously — represent the most powerful and most dangerous capability in AI applications. An agent that can browse the web, write code, send emails, and modify databases can accomplish in seconds what would take a human hours. It can also cause damage in seconds that takes days to undo.

The temptation is to give agents broad capabilities and rely on the model's judgment to use them wisely. This is the architectural equivalent of running everything as root. Bounded autonomy means agents have explicit, enforced limits on what they can do, how much they can spend, how long they can run, and when they must ask for human approval. These boundaries are architectural, not prompt-based — they're enforced by code, not by instructions the model might ignore.

> **Relationship with Factor 8 (Identity, Access, and Trust)**: Factor 8 defines *who* the agent is and *what* it's allowed to do — identity, permissions, and trust boundaries. This factor defines *how* the agent operates within those boundaries — orchestration patterns, execution budgets, checkpointing, and runtime guardrails. Factor 8 is the authorization model; Factor 18 is the execution model.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology had no concept of autonomous AI agents, as these are a recent architectural pattern in AI applications.

## How AI Changes This

This factor *is* the AI change. It addresses:

- **Agent architecture patterns**: How to structure agents for reliability, observability, and control.
- **Tool permission management**: What tools an agent can use, with what parameters, and under what conditions — including MCP-based tool discovery.
- **Execution budgets**: Hard limits on time, tokens, cost, and actions per agent invocation.
- **Human-in-the-loop design**: When and how to involve humans in agent decision-making.
- **Multi-agent orchestration**: Patterns for coordinating multiple agents, including standardized protocols (A2A) and agent frameworks.
- **Agent SDKs and frameworks**: Leveraging standardized toolkits that implement these patterns natively.

## In Practice

### Harness Engineering: The Discipline Around the Agent Loop

By 2026, the practice of building everything *around* the model — to turn raw reasoning into a reliable agent — acquired its own name: **harness engineering**. It is framed as the third phase of AI engineering maturity, succeeding prompt engineering (2022–2023) and context engineering (2024–2025), and it is where the bulk of engineering investment now goes. The anchoring formula is:

```
Agent = Model + Harness
```

The discipline draws a useful distinction between two layers, and this factor owns the second:

- **Scaffold** — the *behavior-defining* layer: system prompt, tool descriptions, output-format rules, and what enters each model call. This is the domain of Factor 17 (Prompt and Context Engineering) and Factor 2 (Contract-First Interfaces, for tool schemas).
- **Harness** — the *execution* layer: the agent loop, tool-call routing, stop conditions, error handling, and guardrails. This is the domain of *this* factor.

A production harness is commonly described as five layers, each of which maps onto a 20-Factor concern — which is the point: harness engineering asks *how* to assemble the agent loop, while these factors define *which properties* that loop must have.

| Harness layer | 20-Factor home |
|---------------|----------------|
| Tool orchestration | **F18** (this factor) + **F2** tool contracts |
| Verification loops | **F6** Evaluation-Driven Development |
| Context & memory | **F17** Prompt & Context · **F19** Agent Memory |
| Guardrails | **F7** Responsible AI · **F8** Identity, Access & Trust |
| Observability | **F15** Full-Spectrum Observability · **F20** AI Economics |

The harness is also where execution must survive interruption — see **Factor 13 (Durable Agent Runtime)** for journaling, idempotent tool calls, and resumable human-in-the-loop interrupts.

Harnesses now come in three deployment shapes: a loop you write yourself; a harness-only SDK you host (Claude Agent SDK, OpenAI Agents SDK, Google ADK); and managed agent platforms that run both the loop and the tool sandbox for you (for example Claude Managed Agents, Amazon Bedrock AgentCore, Vertex AI Agent Engine). The properties in this factor apply to all three. With a managed platform, the question becomes whether it exposes the controls you need — budgets, permission policies, approval hooks, traces — for you to set and observe, rather than whether you have to build them.

The empirical case for treating the harness as a first-class artifact: in 2026 the LangChain team moved a coding agent from 30th to 5th place on Terminal Bench 2.0 *without changing the underlying model* — the entire gain came from harness optimization. A decent model with a strong harness beats a strong model with a weak one. This is the same claim this factor makes from the safety side: agent behavior is determined architecturally, not by asking the model nicely (Guiding Principle 3). Harness engineering is that principle applied to the whole agent loop. The industry has noticed: Gartner's Top Strategic Technology Trends for 2027 (October 2026) list the *AI coding agent harness* and *AI agent identity* as trends in their own right — the same two concerns this factor and Factor 8 treat as architecture.

### Agent Architecture Patterns

**Pattern 1: Simple Tool-Use Agent**
Single agent with a fixed set of tools:

```
User → Agent → [Tool A, Tool B, Tool C] → Response
```

**Pattern 2: Router Agent**
A routing agent delegates to specialized sub-agents:

```
User → Router Agent → Specialist Agent A → Response
                   → Specialist Agent B → Response
```

**Pattern 3: Pipeline Agent**
Agents connected in a processing pipeline:

```
User → Research Agent → Analysis Agent → Writing Agent → Response
```

**Pattern 4: Hierarchical Agent**
A supervisor agent coordinates worker agents:

```
User → Supervisor Agent → Worker Agent 1 ─┐
                        → Worker Agent 2 ──┤→ Supervisor → Response
                        → Worker Agent 3 ─┘
```

### Bounded Autonomy Definition

Every agent has a versioned definition (Factor 1) that the harness enforces in code. It declares:

| Element | What it states | Example |
|---------|----------------|---------|
| **Purpose** | The one job the agent exists for | "Research topics using web search and the knowledge base" |
| **Model** | A pinned model version (Factor 16) | — |
| **Tools and permissions** | Each tool is *autonomous*, *requires human approval*, or *denied*, with a per-tool rate limit | Web search: autonomous, 10/min · Send email: approval · Write to database: denied |
| **Execution budget** | Maximum steps, tokens, cost, wall-clock time, and retries per invocation, nested inside the user and tenant budgets of Factor 20 | 25 steps, 50k tokens, $1.00, 120 s, 3 retries |
| **Safety** | Rule-of-Two capability review (Factor 7), checkpoint interval, and how partial work is undone on failure | Checkpoint every 5 steps; compensate on failure |

### Execution Budget Enforcement

The budget has to hold on every path through the loop, not only the successful one:

- **Count every model call.** The call that produces the final answer and the call whose tool request is then denied or rejected both cost tokens. A budget that records usage only after a successful tool execution undercounts — and a model that keeps requesting a forbidden tool loops forever, because nothing it does consumes the budget.
- **Reserve before dispatch, reconcile after.** Before each call, reserve its estimated tokens and cost against what remains; after the response, record actual usage and release the difference. A call that times out counts as spent until reconciled (Factor 20).
- **Count steps for every iteration**, including denied and rejected tool calls, and check wall-clock time on each turn.
- **Check permissions in code at execution time**, every time — not once at the start — so a revoked permission takes effect mid-run (Factor 8).
- **Stop cleanly on exhaustion**: return partial results with an explicit `budget_exhausted` status and a budget report. Never continue silently.
- **Checkpoint** on a fixed interval, or durably on every step with Factor 13, so a failure after step 20 does not start over.

### Human-in-the-Loop Patterns

This factor defines the *execution mechanisms* for human approval. Factor 7 defines *when* approval is triggered (safety scores, confidence thresholds), and Factor 8 defines *who* is authorized to approve.

**Approval Gate**: the agent pauses before a gated action and resumes on a decision. The gate must be:

- **Durable**: the pending request is persisted, and the decision arrives as a persisted signal or event (Factor 13) — not through an in-memory queue that a restart or deploy wipes out. Waiting must not hold a worker.
- **Bound to the exact action**: the approval record carries an operation ID, the tool, a hash of the exact arguments, the target object and its version, the authorized approver (Factor 8), an expiry, and a single-use flag. If the agent changes any argument, the approval no longer applies.
- **Re-checked before execution**: after a long pause, confirm that the approval is unexpired and unused and that the agent's and approver's access still holds, then execute.
- **Deny by default**: a request that times out is denied, and the agent is told so.
- **Legible**: the approver sees the action, its parameters, the trigger that required approval, and its consequences. The agent's stated plan is context, not justification.

**Supervised Mode**: a human reviews every action before execution and can approve, modify, reject, or stop. A modified action is a new action — it is re-validated against permissions and budget before it runs. Stop ends the run and cancels any tool calls in flight.

### Multi-Agent Orchestration

In the supervisor pattern, one agent plans the work, delegates steps to specialist workers, and synthesizes their results. The boundaries apply at both levels:

- **Each worker runs under its own bounded budget**, and the supervisor holds an aggregate budget that covers all workers and its own calls.
- **Worker failures follow an explicit policy**: retry with a revised task (a bounded number of times), skip the step, or escalate to a human — decided by code or by the supervisor within its budget, never an open-ended loop.
- **Cancellation propagates**: stopping the supervisor stops its workers and their tool calls.
- **Start simple**: compare a single agent, or a deterministic workflow that calls the model at fixed points, against the multi-agent design on the same evaluation set (Factor 6) before adopting it. More agents mean more cost, more latency, and more failure modes.

### Agent Observability

Every agent run emits a trace (Factor 15) that records, at minimum:

| Field | Why |
|-------|-----|
| Trace ID, agent ID and version, task | Correlates the run with its definition and its request |
| Status (completed, budget exhausted, stopped, failed) | Distinguishes outcomes, not just errors |
| Budget used vs. limit — steps, tokens, cost, duration | Shows how close agents run to their limits, and which limits bind |
| Tools used, with counts; tool calls denied | Reveals drift in agent behavior and attempts to exceed permissions |
| Approvals requested, granted, denied, expired | Measures the human load and the gate's effect |
| Errors and retries | Separates tool flakiness from agent mistakes |
| Quality score, where an online evaluator runs (Factor 6) | Connects cost to the quality of the result |

### Agent SDKs and Frameworks

The orchestration patterns described above (router, pipeline, supervisor) are now implemented natively by standardized Agent SDKs. Rather than building agent infrastructure from scratch, use these frameworks and focus engineering effort on the business logic, tool definitions, and boundary enforcement that are unique to your application.

**Standardized Agent SDKs:**

| Framework | Provider | Strengths |
|-----------|----------|-----------|
| **Claude Agent SDK** | Anthropic | Native Claude integration, tool use, guardrails, agent loops with built-in budget enforcement |
| **OpenAI Agents SDK** | OpenAI | Handoffs between agents, guardrails, tracing, built-in orchestration primitives |
| **Google ADK** | Google | Multi-agent orchestration, A2A protocol support, Vertex AI integration |

These SDKs share common architectural patterns:
- **Agent loop with tool use**: The core loop (plan → tool call → observe → repeat) is built-in, with configurable termination conditions.
- **Handoffs / delegation**: Agents can delegate to sub-agents, implementing the router and supervisor patterns natively.
- **Guardrails integration**: Input/output validation, content filtering, and safety checks are first-class features (Factor 7).
- **Tracing and observability**: Agent steps, tool calls, and token usage are automatically traced (Factor 15).

**When to use an SDK vs. custom orchestration:**
- **Use an SDK** when your orchestration follows standard patterns (tool use loops, delegation, pipelines). SDKs handle the infrastructure correctly — retries, error handling, token counting, tracing — so you don't have to.
- **Build custom** when you need orchestration logic that SDKs don't support (custom scheduling, domain-specific checkpoint/resume, proprietary tool protocols).
- **Combine both**: Use an SDK for the agent loop and tool execution, but layer your own budget enforcement, approval gates, and observability on top.

The bounded autonomy principles from this factor (execution budgets, tool permissions, human-in-the-loop gates) apply regardless of whether you use an SDK or build custom. SDKs provide the *mechanism*; you define the *policy*.

### MCP for Agent Tool Integration

The [**Model Context Protocol (MCP)**](https://modelcontextprotocol.io/specification/2026-07-28) standardizes how agents discover and invoke tools. Instead of hardcoding tool definitions per agent, agents connect to MCP servers that expose tools dynamically. In the agent definition, each MCP server is a backing service (Factor 10) declared with:

- **How it is reached**: remote servers over Streamable HTTP (the older HTTP+SSE transport is deprecated), with the protocol version pinned; local servers over stdio, launched from a pinned version of a scoped package (Factor 3).
- **A permission for each tool it exposes** — autonomous, human approval, or denied — using the same model as directly defined tools. A server can host both a harmless `search_documents` and a consequential `update_document`.
- **A default for tools that appear later**: a tool the server starts advertising after review is denied until someone assigns it a permission.

MCP enables key capabilities for agent orchestration:
- **Dynamic tool discovery**: Agents discover available tools at runtime via `tools/list`, adapting to the tools available in their environment.
- **Swappable tool providers**: Replace an MCP server without changing agent code — the agent discovers the new server's tools automatically (Factor 10).
- **Permission layering**: MCP defines what tools *exist*; the agent's permission model (above) defines what tools it's *allowed to use*. These are separate concerns.
- **Resource access**: Beyond tools, MCP servers can expose resources (files, data) and prompt templates that agents can use contextually.
- **Human input through the protocol**: since 2026-07-28, a server that needs a confirmation or a credential returns an `input_required` result and the client retries with the answer (multi round-trip requests). Route those requests through the same approval gates as any other human-in-the-loop decision, and persist them durably (Factor 13).
- **Servers are dependencies you execute or trust**: pin each server's version, install from verified publishers under scoped package names, and review updates like any other dependency (Factor 3). An MCP server's tool descriptions go straight into the model's context, so a malicious or compromised server is a prompt-injection vector as well as a code-execution one.

### A2A for Multi-Agent Interoperability

For multi-agent systems where agents may be built by different teams, use different frameworks, or run on different infrastructure, the **Agent-to-Agent (A2A) protocol** provides a standard communication layer.

An orchestrator delegating over A2A discovers the remote agent through its Agent Card, and verifies the card's signature (A2A v1.0) against trusted issuers before relying on anything it claims (Factor 8). It then submits a task and follows its updates until a terminal state, with an overall timeout. Every task state needs a defined handling:

| Task state | Handling |
|------------|----------|
| Working | Record progress in the trace |
| Input required | Route the question through the same human-in-the-loop gates as any other request for human input |
| Auth required | Obtain a scoped, delegated credential for this task (Factor 8) — never forward the user's own token |
| Completed | Validate the result against the expected contract (Factor 2) before using it |
| Failed, canceled, rejected | Terminal: apply the orchestrator's failure policy (retry, skip, escalate) |
| No terminal state before the timeout | Cancel the task and treat it as failed |

A2A and MCP are complementary in multi-agent systems:
- **MCP** = how agents use tools (agent → tool)
- **A2A** = how agents delegate to each other (agent → agent)
- An orchestrator uses A2A to delegate tasks to specialist agents, and each agent uses MCP to interact with its tools.

### Computer Use and GUI Agents

A new class of agent capability has emerged: **computer use** — agents that interact with graphical user interfaces by seeing screenshots and performing mouse/keyboard actions. Unlike structured tool calls (where the agent invokes a well-defined API), computer use involves visual interpretation of dynamic, unstructured interfaces.

This fundamentally challenges bounded autonomy because:
- **Actions are less predictable**: A tool call to `send_email(to, subject, body)` has a clear contract. Clicking on a UI element has emergent outcomes that depend on the application state.
- **Observation is continuous**: The agent must repeatedly screenshot, interpret, and act — consuming significantly more tokens per step than structured tool calls.
- **Rollback is harder**: GUI actions (clicking "Submit", "Delete", "Send") may be irreversible and don't have programmatic undo.

A computer use policy, enforced by the harness rather than the prompt, states:

- **Where the agent may act**: an allowlist of applications or domains (for example, the internal CRM and the issue tracker), plus blocked patterns it must never touch, such as payment flows and account deletion.
- **How much it may observe**: a screenshot budget per task, on top of the usual execution budget.
- **When it must stop and ask**: before submitting a form, and before navigating away from the target application.

**Key design principles for computer use agents:**
- **Prefer structured tools over computer use**: If an API or MCP server exists for the task, use it. Computer use should be the last resort for systems that don't expose programmatic interfaces.
- **Sandbox the environment**: Run computer use agents in isolated browser sessions or VMs. Never give them access to the host system. The same applies to any agent that executes code or shell commands — see Factor 8 for sandbox isolation levels.
- **Tighter budgets**: Computer use consumes far more tokens (screenshots) and has higher risk per action. Apply stricter execution budgets than for structured tool agents.
- **Visual confirmation gates**: Show the human what the agent sees (screenshot) and what it plans to do before executing high-risk GUI actions.

### The Skills Primitive

A **Skill** is a packaged unit of agent capability — instructions plus optional scripts, references, and assets — in the open Agent Skills format (`SKILL.md`; see Factor 2). Skills sit above raw tools: a tool is a single function; a skill encodes the *procedure and context* for using tools correctly, and is loaded only when relevant (progressive disclosure).

For orchestration, this means:
- **Breadth without context bloat**: each skill costs roughly its name and description (~100 tokens) until activated, so an agent can carry a broad repertoire without a huge system prompt (Factor 17).
- **Skills are not permissions**: activating a skill must not widen what the agent can do. Tool permissions and execution budgets stay in the agent definition and are enforced in code. Treat a third-party skill's experimental `allowed-tools` field as something to review, not a grant your harness honors automatically.
- **Versioned, evaluated, and supply-chain-checked**: skills are committed (Factor 1), validated in CI, and evaluated like prompts (Factor 6). Third-party skills are dependencies that can carry scripts and instructions someone else wrote (Factor 3).
- **Reuse and discovery**: the same skill directory works across agents and across tools that support the standard, and can be published to agent directory services (Factor 2).

### Agents That Transact

Agentic commerce turns "bounded autonomy" into a question about money. Protocols for agent-initiated checkout and payment (AP2, ACP, UCP, x402; see Factor 8) let an agent buy on a user's behalf — a ticket, a subscription, an API call. Apply the bounded-autonomy model with the strictest settings: purchases run only under an explicit, scoped, expiring mandate from the user; amount and velocity limits are enforced by the payment layer, not the prompt; anything above a threshold, or outside the mandate's merchant or category scope, goes to a human gate; and every purchase is reconciled against the mandate and the agent trace (Factor 15, Factor 20).

### Voice and Realtime Agents

Real-time speech agents (OpenAI Realtime API, Pipecat, LiveKit Agents, AWS Bedrock AgentCore, Hume AI) operate under engineering constraints that differ from standard request/response agents:

- **Sub-300ms time-to-first-audio-byte**: user-perceptible as natural conversation; requires streaming execution where each agent step begins before the prior step's response completes
- **End-of-turn detection**: Voice Activity Detection (VAD) determines when the user stops speaking; barge-in (user interrupting the agent mid-speech) must be handled gracefully without dropping context
- **Session durability**: voice conversations are long-lived sessions; use Factor 13 (Durable Agent Runtime) for session state persistence across network interruptions
- **Observability**: Factor 15 voice SLOs apply — track TTFT, TTFA (time-to-first-audio), end-of-turn latency, and barge-in latency separately from text agent metrics

The bounded autonomy principles from this factor apply equally: voice agents have tool permissions, execution budgets, and human escalation paths. The difference is latency sensitivity, and it does not extend to approvals: no human decides in hundreds of milliseconds. When a voice agent reaches a gated action, it asks the user for an explicit spoken confirmation that restates the action, parks the action in a durable pause and tells the user what happens next, or hands the conversation to a human. The audio latency SLO governs the agent's speech, not the time allowed for a human decision.

### Reflexion and Self-Critique Loops

Reflexion (Shinn et al., 2023) patterns an agent to critique its own output and generate a revised response before returning to the user. In production, the loop is generate → critique → revise only if the critique finds issues, with a fixed maximum number of rounds and its own token budget.

Apply reflexion selectively: it doubles token consumption and latency. Gate reflexion on task complexity (Factor 20) and measure quality improvement in your eval suite (Factor 6) before enabling broadly. Track the critique step's reasoning effort and token spend separately from the generation step.

### Agent Swarms (CrewAI, Microsoft Agent Framework, MetaGPT)

Multi-agent frameworks — CrewAI, the Microsoft Agent Framework (which unified AutoGen and Semantic Kernel), MetaGPT, and others — implement coordinated agent swarms where multiple LLM-backed agents collaborate by taking on roles (researcher, coder, reviewer, critic). Each agent in a swarm is a bounded agent as defined by this factor; the swarm adds an orchestration layer on top.

Apply bounded autonomy at both levels:
- **Per-agent budgets**: each agent in the swarm has its own step limit, token budget, cost limit, and tool permissions
- **Aggregate swarm budget**: the swarm-level orchestrator tracks total cost and steps across all agents; the swarm has its own circuit breaker
- **Human gates at the swarm level**: some decisions require human approval that isn't visible to any individual agent — wire this into the orchestrator, not into each agent

Swarm frameworks accelerate prototyping but require explicit budget enforcement and observability wiring before production. Don't inherit the framework's default unlimited concurrency — apply the same constraints you'd apply to any other agent.

### Anti-Patterns
- **Unbounded agents**: Agents with no step limit, cost limit, or time limit. They can run indefinitely and spend without constraint.
- **Prompt-only boundaries**: "Don't use this tool unless necessary" in the prompt is not a boundary — it's a suggestion. Enforce boundaries in code.
- **God agents**: A single agent with every tool and permission. Prefer specialized agents with minimal tool sets.
- **No checkpoint/resume**: If an agent fails after 20 steps, it has to start over. Checkpoint state to enable resume.
- **Silent agents**: Agents that act without logging. Every tool call, every decision, every error should be traced.
- **NIH orchestration**: Building custom agent loops, retry logic, and tracing when a standard Agent SDK handles it correctly. Use frameworks for infrastructure; focus custom code on business logic and boundaries.
- **Unreviewed dynamic tool sets**: Letting an agent use whatever tools a server advertises at runtime. A fixed, reviewed tool set is fine — often the safer choice; dynamic discovery (MCP) earns its place when tools change often or are shared across agents. Either way, each tool has a contract (Factor 2) and an assigned permission.
- **Computer use for API-available tasks**: Using screenshot-based computer use when a structured API or MCP server exists. Computer use is slower, more expensive, and less reliable than structured tool calls.
- **The lethal trifecta by accident**: giving one agent session private data, untrusted input, and an outbound channel at once — usually by adding "just one more" tool or MCP server (Factor 7).
- **Floating tool servers**: launching MCP servers with unpinned `npx`/`latest` commands, so whatever was published last runs with the agent's permissions.

## Compliance Checklist

- [ ] The agent harness (loop, tool routing, context assembly, guardrails, observability) is treated as a versioned, tested artifact — tuned and benchmarked independently of the model, not left as ad-hoc glue code
- [ ] Every agent has a defined purpose, tool set, and execution budget
- [ ] Tool permissions are enforced architecturally (code), not just through prompts
- [ ] Execution budgets (steps, tokens, cost, time) are enforced with hard limits
- [ ] Human-in-the-loop gates exist for high-risk actions
- [ ] Agent actions are fully observable with distributed tracing (Factor 15)
- [ ] Multi-agent orchestration uses defined patterns (router, pipeline, supervisor) — via Agent SDKs or custom implementation
- [ ] Agents checkpoint state periodically to enable resume after failures
- [ ] Failed agent actions can be rolled back where possible
- [ ] Agent identities and permissions follow Factor 8 (Identity, Access, Trust)
- [ ] Agent tools are provided via MCP servers where possible, enabling dynamic discovery and swappability (Factor 10)
- [ ] Multi-agent communication uses standardized protocols (A2A) for cross-team and cross-framework interoperability
- [ ] Computer use agents run in sandboxed environments with tighter budgets and confirmation gates for GUI actions
- [ ] Agent execution patterns and budget usage are monitored for optimization
- [ ] Skills follow the Agent Skills format and are versioned, reviewed artifacts; activating a skill never widens tool permissions or budgets
- [ ] Every agent profile passes a Rule-of-Two capability review (private data / untrusted input / external action) before deployment (Factor 7)
- [ ] MCP servers are pinned to versions from verified publishers; remote servers use Streamable HTTP, and MCP input requests route through the same approval gates as other human-in-the-loop decisions
- [ ] Cross-organization A2A agents are trusted only after verifying their signed Agent Cards, and all terminal task states (failed, canceled, rejected) are handled
- [ ] Agents that can initiate purchases act only under scoped, expiring user mandates with payment-layer amount and velocity limits (Factor 8, Factor 20)
- [ ] Voice/realtime agents have TTFA SLOs configured, VAD barge-in handling implemented, and session state persisted via Factor 13
- [ ] Reflexion / self-critique loops are gated on task complexity with token budget tracked separately; quality improvement is validated against the eval suite before broad enablement
- [ ] Agent swarms (CrewAI, Microsoft Agent Framework, MetaGPT, etc.) have aggregate swarm-level budgets and circuit breakers in addition to per-agent limits
