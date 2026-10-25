---
layout: page
importance: 20
category: "Tier 4: Intelligence"
title: "20. AI Economics and Cost Architecture"
nav_order: 5
description: "Per-token cost modeling, model routing, semantic caching ROI, budget circuit breakers."
---

# Factor 20: AI Economics and Cost Architecture

> Treat AI cost as a first-class architectural concern — with per-token cost modeling, intelligent model routing, semantic caching ROI, budget circuit breakers, and cost attribution.

## Motivation

Traditional cloud applications have relatively predictable cost profiles. You provision resources (compute, storage, bandwidth) and pay whether they're used or not. Costs are infrastructure-driven and scale with provisioned capacity. Optimization means right-sizing resources and reducing waste.

AI applications introduce usage-based costs that scale with *demand*, not capacity. Every LLM call costs money — measured in tokens consumed. A single user request that triggers a complex agent workflow can cost dollars, not fractions of a cent. Costs vary by orders of magnitude across model tiers (frontier vs. lightweight models), by task complexity (a simple classification vs. a multi-step research task), and by caching effectiveness. Without cost architecture, AI features can silently become the dominant line item in your cloud bill — or worse, a runaway cost incident can drain budgets in hours.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology assumed infrastructure-based cost models where scaling and cost were managed through resource provisioning. The per-token, per-request cost model of AI services is fundamentally different.

## How AI Changes This

This factor *is* the AI change. It addresses:

- **Per-token cost modeling**: Understanding and predicting costs at the token level across different models and providers.
- **Model routing for cost optimization**: Sending simple requests to cheap models and complex requests to expensive ones.
- **Semantic caching ROI**: Measuring the cost savings from caching strategies.
- **Budget circuit breakers**: Hard limits that prevent runaway costs.
- **Cost attribution**: Allocating AI costs to features, teams, users, and tenants.

## In Practice

### Cost Model

A cost model makes the drivers of spend explicit for every feature — before launch, and kept current afterward:

| Driver | What to record | Why it matters |
|--------|----------------|----------------|
| Volume | Requests or tasks per month, and their growth | Usage-based cost scales with demand, not capacity |
| Tokens per call | Uncached input, cache writes and reads, output — including thinking tokens, which are billed as output | Output and thinking tokens usually dominate on reasoning routes |
| Calls per task | Model calls per completed task, including retries, judges, routers, and fallbacks | Agent loops multiply every per-call cost |
| Cache hit ratio | Share of input served from the provider's prompt cache | Cache reads cost a fraction of uncached input |
| Model and effort | Pinned model version and effort level per route | Price differs by tier; effort drives thinking-token spend (Factor 17) |
| Success rate | Share of tasks that complete acceptably | Failed attempts are paid for too |
| Multimodal inputs | Image resolution; audio duration, often cheaper transcribed first (Factor 17) | Non-text inputs are priced differently from text |

For agentic features, the unit is the **completed task**:

```
cost per completed task =
    ( Σ over every billable call in the period:
          uncached input × input price
        + cache writes × write price  +  cache reads × read price
        + output, including thinking × output price
      + paid tool calls )
    ÷ tasks completed successfully
  + human review and rework per completed task
```

"Every billable call" includes retries, routers and classifiers, LLM judges, fallbacks, and responses that were discarded; the cost of failed tasks lands on the ones that succeeded.

**Keep prices out of code and prose.** Prices, model names, and discounts change faster than architecture. Keep them in one dated, sourced price table that the cost model and the gateway read, and re-check it whenever a pinned model changes (Factor 16). This page deliberately lists none.

Two things follow from how models are priced. First, the spread between tiers is wide — input prices between a provider's smallest and mid tiers commonly differ by an order of magnitude or more — so pushing high-volume, low-complexity traffic down to the smaller tier is still the largest single lever. Second, the expensive unit is no longer the request but the **task**: an agent loop that re-reads a growing context on every step costs orders of magnitude more than any single call, and its cost is dominated by loop length, cache hit ratio, and reasoning effort. Model it per completed task, and budget it per task (see Budget Circuit Breakers below and Factor 18's execution budgets).

### Intelligent Model Routing

Route each request to the cheapest configuration that meets the quality bar for its task class:

| Task class | Examples | Starting configuration |
|------------|----------|------------------------|
| Simple | Classification, yes/no questions, format conversion | Smallest tier, low effort |
| Moderate | Summarization, Q&A with context | Mid tier, low effort |
| Complex | Multi-step reasoning, code generation | Mid tier at high effort, or the most capable tier |
| Research | Multi-step analysis, research synthesis, complex planning | Most capable tier, high effort; max only where evals show a gain |

- **Pick each class's configuration with evals, not intuition** (Factor 6), and repeat the comparison when models change (Factor 16).
- **Count the router.** Whatever assigns the class — a rule set or a classifier model — has its own cost, latency, and error rate. Misrouted complex requests show up as quality regressions, not as savings.
- **A cascade pays for every rung.** "Try the cheap model, escalate if a quality check fails" pays for the cheap attempt, the quality check, and the escalated call.

Before building a multi-model cascade, measure the simpler alternative: the more capable model at a *lower* reasoning effort. On current models, lower effort often matches the previous generation at high effort, and a cascade has a hidden cost — provider prompt caches are scoped per model, so every escalation re-pays the full uncached prompt. Judge both options on cost per *completed* task, not cost per request: a cheaper request that needs retries or extra turns is not cheaper.

### Budget Circuit Breakers

A budget breaker must hold under concurrency and must see every dollar. Reading current usage and approving in a separate step is a race: two concurrent requests both see $40 left, and both spend $30. Enforce budgets as **reserve → dispatch → reconcile**:

| Step | What happens | Invariant |
|------|--------------|-----------|
| Reserve | Before dispatch, atomically add the estimated cost to every budget the request falls under — request, user, tenant, global — or reject it | All levels reserve or none do; concurrent requests cannot approve the same remaining balance |
| Dispatch | The call runs while its reservation counts against those budgets | In-flight spend is visible to every other request |
| Reconcile | Replace the reservation with the actual cost from the response's usage data and release the remainder | Reported usage, not the estimate, is what accumulates |

Rules around the cycle:

- **Count every attempt.** Retries, responses discarded by guardrails or cascades, LLM judges, routers and classifiers, fallbacks, and paid tool calls all reserve and reconcile against the same budgets. A breaker that only sees successful final answers under-counts; Factor 18 applies the same rule to agent execution budgets.
- **Expire reservations deliberately.** A reservation whose call never reports back (crash, timeout) must not hold budget forever — but it must not be released while the provider may still bill for the call. Treat the outcome as unknown and keep it counted until the provider's usage or billing data settles it.
- **Choose the failure policy per route.** If the budget store is unavailable, either fail closed (reject; safe for cost) or fail open under a small local cap (available; bounded overspend). Decide in advance rather than letting an exception handler decide.
- **Know what the limit guarantees.** A limit enforced on estimates and reconciled afterward bounds spend only approximately: estimate error and calls already in flight can overshoot it. Size that margin (roughly, calls in flight × the largest per-call cost), present the limit as a guardrail rather than an exact invoice ceiling, and use provider-side spend limits, where offered, as a backstop.

### Budget Configuration

Define a budget at every level that has an owner, each with its own windows:

| Level | Typical windows | Purpose |
|-------|-----------------|---------|
| Per request | One call or one task | Stops a single pathological request (a runaway loop, a huge input) |
| Per user | Hourly, daily | Contains abuse and runaway clients |
| Per tenant | Daily, monthly | Enforces contracts and plans |
| Global | Hourly, daily, monthly | Caps total exposure |

Escalate as a budget fills, with critical traffic defined in advance:

| Budget used | Action |
|-------------|--------|
| 50% | Notify the owning team |
| 80% | Notify the team and management |
| 95% | Throttle non-critical traffic |
| 100% | Block non-critical traffic |

Also alert on individual requests whose cost crosses a lower threshold, even when they stay under the per-request limit — they are early signs of prompt bloat or loops.

### Cost Attribution

Every billable call — retries, judges, and fallbacks included — emits one cost record with these dimensions:

| Dimension | Example | Used for |
|-----------|---------|----------|
| Feature | `document_summary` | Cost by feature, unit economics |
| Team | `product` | Showback and chargeback |
| Tenant and user | Tenant and user IDs | Per-customer cost, abuse detection |
| Model, version, provider, effort | Pinned identifiers | Cost by model, routing decisions |
| Token breakdown | Input, cache reads and writes, output, thinking | Cache savings, thinking-token ratio |
| Task or trace ID, attempt type | Primary, retry, judge, fallback | Rolling calls up to cost per completed task (Factor 15) |

Keep high-cardinality dimensions such as user ID on the cost records themselves (events or logs), not on metric labels, so the metrics backend stays within its cardinality limits (Factor 15).

### Caching ROI Measurement

Judge caching by its net effect per route, not by hit rate alone:

- **Savings**: for each hit, what the request would have cost uncached — estimated from comparable misses on the same route, not from a global average. For provider prompt caching, compute it directly from usage data: cached tokens × (input price − cache-read price), minus any write premium.
- **Costs**: the cache infrastructure, plus the lookup paid on *every* request, hit or miss (embedding the query, searching the index).
- **Quality**: the false-hit rate — cached answers that a fresh call would have answered differently or better — measured by sampling hits against fresh responses in the eval suite (Factor 6).
- **Report all three together.** Savings that rise with the false-hit rate are a quality regression, not a win.

### Cost Optimization Strategies

| Strategy | Savings Potential | Complexity | Trade-off |
|----------|------------------|------------|-----------|
| **Model routing** (cheap model for simple tasks) | 30-60% | Medium | Slightly lower quality on edge cases |
| **Semantic caching** | 20-40% | Medium | Stale responses possible |
| **Prompt optimization** (shorter prompts) | 10-30% | Low | May reduce quality |
| **Batch processing** (batch API discounts) | 50% | Low | Higher latency (24h) |
| **Provider prompt caching** (Anthropic/OpenAI/Google) | 80-95% on cached input | Low | Requires stable prompt prefixes, min token threshold, ephemeral cache TTL |
| **Output length control** (max_tokens) | 10-20% | Low | May truncate useful content |
| **Reasoning-effort tuning** (lower effort level) | 20-50% | Low | May reduce quality on complex tasks |
| **Fine-tuning** (smaller fine-tuned model) | 40-70% | High | Training cost, maintenance burden |
| **Model distillation** (large model → small specialist) | 50-80% | High | Distillation cost, narrow task scope |
| **Provider negotiation** (volume discounts) | 10-30% | Low | Vendor lock-in |

### AI Gateway as the Cost Control Plane

Cost, routing, caching, and observability are cross-cutting concerns that don't belong scattered across application code. The rule, shared with Factor 10: **production model traffic passes through one enforced control point** — an AI gateway or a shared client library — that applies cost limits, identity, routing, and telemetry. A separate gateway service is the default when several applications or teams share providers; a single application can enforce the same controls in-process. Ad hoc SDK calls scattered through the code are for prototypes only.

Production-grade gateway options: **LiteLLM**, **Portkey**, **Kong AI Gateway**, **Cloudflare AI Gateway**, **TrueFoundry**, hyperscaler-native (Bedrock, Azure AI Gateway). Whether gateway or shared library, built or bought, the control point centralizes:

- **Multi-provider routing**: a single API surface for OpenAI, Anthropic, Google, Bedrock, Azure, self-hosted, and others — with per-route policies
- **Semantic and prompt caching**: a unified cache layer across providers (cross-ref Factor 12)
- **Budget circuit breakers**: per-tenant, per-feature, per-user (cross-ref this factor)
- **Rate-limit shaping**: client-side rate limiting normalized across providers (cross-ref Factor 14)
- **Guardrails**: input/output filtering before the model and before the user (cross-ref Factor 7)
- **Audit and observability**: every call logged with the same correlation IDs as application traces (cross-ref Factor 15)

Policies are declared per route, not in application code. Each route states its pinned model and effort level, its cache policy, its budgets and what happens on a breach (block, or fall back), its input and output guardrails, and its fallback chain. Every model in a fallback chain is pinned and has passed the route's evals (Factor 6, Factor 14); a fallback to a model — or another provider's model — that was never evaluated is a silent quality change.

### Mandatory Model-Pinning per Job

Every scheduled job, every production route, every batch process **must explicitly declare which model it uses**. Implicit "use the latest" or relying on provider aliases is a recipe for silent cost and quality drift. Pin an *immutable* identifier — and know which kind your provider issues: some IDs are dated snapshots, some undated IDs are themselves immutable, and some names are floating aliases (see Factor 16).

The 2026 pattern: a release manifest entry per job, versioned with the release (Factor 5), and a control point that refuses to dispatch any request that doesn't match it. Each entry declares:

- **Model and immutable version**, plus the effort level
- **Maximum cost per run**, enforced as a budget (see Budget Circuit Breakers)
- **Expected output size** (for example, p99 output tokens), so drift is detectable
- **Fallback policy**: an explicit, evaluated fallback chain — or *fail loudly*, so a cost-sensitive job never silently falls back to a more expensive model

### Reserved Capacity and Provisioned Throughput

For predictable, high-volume workloads, **reserved/provisioned throughput** beats on-demand pricing significantly. Available shapes in 2026:

- **AWS Bedrock Provisioned Throughput** — model units reserved per hour
- **Azure OpenAI PTUs** (Provisioned Throughput Units) — sustained TPM commitments
- **Anthropic, OpenAI, Google enterprise contracts** — committed-spend discounts and dedicated capacity
- **Self-hosted reserved GPU** (managed K8s with Spot fallback for cost-tolerant traffic)

Architectural pattern: **base load on provisioned, spikes on on-demand**. Forecast your steady-state TPM, reserve 70–80% of it, let elastic on-demand absorb the peak. Re-evaluate the reservation level monthly.

### Carbon as a Cost Dimension

Cost has two units now: dollars and gCO₂e. EU procurement and several enterprise vendor reviews require both. The architectural treatment is symmetric to dollar cost:

- Track per-request `g_co2e` alongside `usd` (cross-ref Factor 15)
- Set per-tenant or per-feature carbon budgets where customer contracts require
- Region routing as a knob: route batch workloads to low-carbon-grid regions when latency permits (cross-ref Factor 14)
- Report energy and carbon in the same dashboards as dollars

This isn't replacing dollar cost as a concern — it's adding a parallel one. Modeling both prevents teams from being surprised when a procurement RFP asks for carbon disclosure.

### Model Liability and Incident Reporting

AI model liability is a financial and legal concern as of 2026, requiring architectural preparation:

**EU AI Act serious-incident reporting (Art. 73)**: Providers of high-risk AI systems must report a serious incident to the market surveillance authority of the Member State where it occurred — immediately after establishing a causal link (or its reasonable likelihood), and **no later than 15 days** after becoming aware of it. These are calendar days: EU time limits expressed in days include weekends and public holidays unless the text says "working days" (Regulation (EEC, Euratom) No 1182/71). Shorter limits apply: **2 days** for a widespread infringement or a serious disruption of critical infrastructure, and **10 days** where a person has died. An incomplete initial report may be filed first, followed by a complete one. Deployers that identify a serious incident must inform the provider immediately (Art. 26(5)). Because Art. 73 attaches to high-risk systems — whose classification rules apply from 2 Dec 2027 (Annex III) or 2 Aug 2028 (Annex I) under Regulation (EU) 2026/1744 — the duty effectively starts on those dates; build the pipeline before them, since a 2-day window leaves no time to improvise one.

If the product is also a *product with digital elements* under the EU Cyber Resilience Act, actively exploited vulnerabilities and severe security incidents have been reportable since 11 Sep 2026 on a tighter clock (24-hour early warning, 72-hour notification). Run one incident pipeline that can satisfy both regimes (cross-ref Factor 7).

All of this requires an **AI incident log** separate from general application logs, capturing: model version at time of incident, sanitized input/output (where permitted by data minimization rules), safety flag activations, and the timeline of detection and remediation — timestamped well enough to prove when you "became aware".

**Model insurance**: Insurance products from Munich Re, Lloyds, and others now cover financial loss from AI-related incidents — hallucinations causing contract errors, classification errors in insurance or lending decisions, IP infringement from training data. Review coverage options annually as model capabilities and legal precedents evolve.

**Vendor liability clauses**: AI vendor MSAs now include explicit liability caps, indemnification for model behavior, and IP indemnification for training data. Review these annually and ensure your use case falls within the covered scope. Document the vendor's liability obligations alongside the model entry in the registry (Factor 16).

Architectural implications:
- Maintain an AI incident log at the application level, distinct from standard observability (Factor 15), to satisfy regulatory reporting cadences
- Store model version, inference parameters, and sanitized I/O for a minimum retention period aligned with your jurisdiction's AI Act requirements
- If your application falls in an EU AI Act high-risk category, complete the conformity assessment before your application date under Regulation (EU) 2026/1744: 2 Dec 2027 for standalone (Annex III) systems, 2 Aug 2028 for AI in products covered by Annex I legislation

### Agent-Initiated Spend

Tokens are no longer the only money an AI system moves. Agents that can buy — through agentic-commerce and agent-payment protocols (AP2, ACP, UCP, x402; see Factor 8) — open a second spend channel that token budgets don't see. Treat it with the same architecture as token cost, but stricter:

- **Separate ledgers**: token spend and agent-initiated purchases are attributed separately (a $0.40 agent run that books a $90 ticket is a $90.40 event, with very different owners)
- **Hard per-mandate caps**: every purchase authority carries an amount ceiling, merchant/category scope, and expiry — enforced by the payment layer, not by the prompt
- **Circuit breakers on money movement**: velocity limits per user, per agent, and per merchant, with a human gate above a threshold (cross-ref Factor 18)
- **Reconciliation**: every agent purchase is reconciled against the mandate that authorized it, the trace that produced it (Factor 15), and the user who granted it

### FinOps Maturity for AI

The 2026 State of FinOps shows real-time AI cost visibility as the top tooling request. Practical maturity model:

- **Level 1 (Visibility)**: cost is visible per feature/tenant in a daily/weekly cadence
- **Level 2 (Attribution)**: showback in monthly reviews; teams see their own spend
- **Level 3 (Chargeback)**: actual financial allocation; per-team budgets enforced
- **Level 4 (Optimization)**: routing, caching, and reservation decisions are made on cost data, not gut feel
- **Level 5 (Forecasting)**: cost is a forecasted line item in product business cases; new features carry a $/unit-economics model before launch

Most production AI orgs in 2026 are at Level 2–3. Level 4 is the practical bar to aim for before the next major product expansion.

### Cost Dashboards

Essential views:
- **Cost by feature**: Which AI features cost the most?
- **Cost by model**: Where is spend concentrated?
- **Cost by tenant**: Which tenants drive the most cost?
- **Cost trend**: Is spending growing faster than usage?
- **Cache savings**: How much is caching saving?
- **Budget utilization**: How close are we to budget limits?
- **Cost per interaction**: What does each user interaction cost on average?
- **Thinking token ratio**: How many thinking tokens are consumed per output token? Are reasoning models being used for tasks that don't benefit?

## Compliance Checklist

- [ ] A cost model documents expected per-request and per-feature costs
- [ ] Model routing directs requests to the most cost-effective model that meets quality needs
- [ ] Budget circuit breakers enforce per-request, per-user, per-tenant, and global spending limits
- [ ] Cost is attributed to features, teams, users, and tenants for accountability
- [ ] Semantic caching ROI is measured and reported
- [ ] Cost alerts fire at configurable thresholds before budgets are exhausted
- [ ] Cost dashboards provide visibility into spending by feature, model, and tenant
- [ ] Prompt and output token budgets are configured to prevent waste
- [ ] Cost optimization strategies (routing, caching, batching) are actively used
- [ ] Reasoning effort is set per task type and thinking tokens are tracked separately from output tokens
- [ ] AI cost is a line item in capacity planning and business case analysis
- [ ] All production model traffic passes through one enforced control point — an AI gateway (LiteLLM, Portkey, Kong AI, Cloudflare AI Gateway, or equivalent) or a shared client library — that applies cost limits, identity, routing, and telemetry
- [ ] Every scheduled job and production route declares an explicit pinned model + version + thinking-effort; "latest" aliases are forbidden
- [ ] Steady-state high-volume workloads run on reserved/provisioned throughput (Bedrock PT, Azure PTUs, enterprise commits, or reserved GPU)
- [ ] Carbon-per-request (gCO₂e) is tracked alongside dollar cost, with regional grid factors
- [ ] Fallback chains are explicitly defined per route, including a "fail loudly" option for cost-sensitive jobs
- [ ] FinOps maturity is at least Level 3 (chargeback) before major product expansion involving new AI features
- [ ] An AI incident log is maintained (separate from general observability) capturing model version, sanitized I/O, and safety activations for potential EU AI Act Art. 73 reporting
- [ ] The incident runbook meets the EU AI Act Art. 73 limits in calendar days (2 days widespread/critical infrastructure, 10 days death, 15 days otherwise) and, where the Cyber Resilience Act applies, its 24h/72h clock
- [ ] Vendor MSA liability terms (caps, indemnification, IP coverage) are reviewed annually and documented alongside model registry entries
- [ ] Applications in EU AI Act high-risk categories have completed or scheduled a conformity assessment ahead of their application date under Regulation (EU) 2026/1744 (2 Dec 2027 for Annex III, 2 Aug 2028 for Annex I)
- [ ] Features are costed per completed task — every billable call, including retries and failed attempts, plus human review, divided by tasks completed successfully (see Cost Model) — not only per request
- [ ] Agent-initiated purchases are capped per mandate, rate-limited, attributed separately from token spend, and reconciled against the authorizing mandate
