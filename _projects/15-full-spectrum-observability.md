---
layout: page
importance: 15
category: "Tier 3: Operation"
title: "15. Full-Spectrum Observability"
nav_order: 7
description: "Logs, traces, and metrics — plus token economics, quality scores, and safety monitoring."
---

# Factor 15: Full-Spectrum Observability

> Emit structured logs, distributed traces, and metrics — augmented with token economics, AI quality scores, safety monitoring, and cost attribution.

## Motivation

The original 12-Factor App had a single, elegant rule for logs: treat them as event streams, write to stdout, and let the execution environment handle routing. A later extension added telemetry as a separate factor. In practice, modern observability combines logs, metrics, and traces into a unified framework (the "three pillars"). AI applications need all three — plus new dimensions.

When your application makes LLM calls, you need to know: How many tokens did that cost? How long did inference take? Did the response pass safety checks? What was the quality score? Which model version produced this output? Without full-spectrum observability, AI applications are black boxes — expensive, unpredictable, and unaccountable.

## What This Replaces

**Merges Original Factor #11 / Beyond 15 #6 (Logs) + Beyond 15 #14 (Telemetry)** — "Treat logs as event streams" + "Every component must be observable."

This merged and updated factor creates a unified observability strategy that covers:

- Structured logging with AI-specific context
- Distributed tracing across AI pipelines (retrieval → augmentation → generation)
- Metrics for token economics, quality, safety, and cost
- AI-specific dashboards and alerting

## How AI Changes This

### AI-Assisted Development
- AI tools can help interpret logs, suggest alert thresholds, and generate dashboards. But the telemetry itself must be intentionally designed, not generated after the fact.

### AI-Native Applications
- **Token economics**: Every LLM call has a cost. Track input tokens, output tokens, model used, and cost per request, per user, per feature.
- **Quality metrics**: Continuously measure output quality using the same evaluation dimensions from Factor 6, but on production traffic.
- **Safety monitoring**: Track guardrail trigger rates, content filter activations, and PII detection events.
- **Latency decomposition**: An AI request chain involves multiple steps (embedding, retrieval, reranking, generation). Trace each step to identify bottlenecks.
- **Model performance**: Track model-level metrics (latency, error rate, quality) to detect degradation from provider-side model updates.

## In Practice

### Structured Logging for AI Operations

Every model call emits one structured event, written to stdout and routed by the platform. Its fields fall into four groups:

| Group | Fields | Why |
|-------|--------|-----|
| Correlation | Timestamp, service, trace and span IDs, request ID | Joins the event to its trace (below) |
| Attribution | Feature, tenant, user (a pseudonymous ID, never an email address) | Cost and quality per feature and tenant (Factor 20) |
| Model | Provider, pinned model ID, API version | Ties behavior to the exact model and request surface (Factor 16) |
| Usage and outcome | Input, cached, output, and reasoning tokens; cost; latency; stop reason; cache hit; quality score; safety flags | Token economics, debugging, and online evaluation |

### Distributed Tracing for AI Pipelines

Trace every step of the pipeline, so latency, tokens, and cost are attributed to the step that spent them:

```
[Trace: document-summary-request]  2444 ms
├── api-handler                       5 ms
├── document-retrieval               45 ms
│   ├── embed-query                  15 ms   12 tokens
│   ├── vector-search                20 ms   10 results, min similarity 0.82
│   └── rerank                       10 ms   5 results kept
├── context-assembly                  2 ms   3,200 context tokens
├── llm-generation                 2340 ms   4,450 in (3,200 from prefix cache), 340 out, $0.006
├── safety-check                     50 ms   content safety, PII, citations: pass
└── response                          2 ms
```

### AI-Specific Metrics

| Metric | Type | Labels | Measures |
|--------|------|--------|----------|
| Tokens | Counter | model, provider, direction (input / cached / output / reasoning), feature, tenant | Token consumption |
| Cost | Counter | model, provider, feature, tenant | Spend in USD |
| Request duration | Histogram | model, provider, feature | LLM latency |
| Quality score | Histogram | feature, model | Online evaluation scores (Factor 6) |
| Cache hit ratio | Gauge | cache type, feature | Semantic, embedding, and prefix cache effectiveness (Factor 12) |
| Safety triggers | Counter | trigger type, action, feature | Guardrail activations |
| PII detections | Counter | entity type, boundary, action | PII found at input and output boundaries |
| Provider errors | Counter | provider, error type | Rate limits, timeouts, 5xx |
| Refusals | Counter | model, category, feature | Refusals returned inside successful responses (Factor 10) |
| Rate-limit headroom | Gauge | provider, limit type | Remaining provider quota (Factor 14) |

**Keep label cardinality bounded.** Model and feature are small, bounded sets; user IDs, request IDs, and prompt text are not. Tenant sits in between: with thousands of tenants it can exceed what the metrics backend handles, so keep it as a label only when its measured cardinality fits, and otherwise attribute per tenant from traces, logs, and cost records. Put per-request detail on traces and logs, never in metric labels.

### Dashboards

Design dashboards around key operational questions:

**Cost Dashboard**
- Cost per hour/day/month by model and feature
- Cost per request by feature
- Cost per tenant
- Budget utilization and burn rate
- Cost savings from caching

**Quality Dashboard**
- Quality scores over time by feature
- Quality score distributions
- Regression detection (score drops after deployments)
- Evaluation pass rates in CI vs. production

**Safety Dashboard**
- Guardrail trigger rate over time
- PII detection events by type
- Content safety filter activations
- Human review queue depth and SLA compliance

**Performance Dashboard**
- Latency by pipeline stage (retrieval, generation, safety check)
- Token throughput by model and provider
- Cache hit rates by type (semantic, embedding, prefix)
- Provider error rates and availability

### Alerting Rules

Alert on rates and ratios against a baseline, not on raw counts — a raw count rises with traffic alone:

| Alert | Fires when (example) | Severity |
|-------|----------------------|----------|
| Cost rate | Spend exceeds a budgeted rate, e.g., $50/hour | Warning |
| Quality regression | Online quality for a feature stays below its threshold over a window, e.g., under 0.85 for an hour | Critical |
| Safety spike | Guardrail triggers per request rise well above baseline — an attack or a wave of false positives; triage before acting | Critical |
| Provider degradation | p99 latency exceeds a ceiling, e.g., 10 s | Warning |
| Rate-limit exhaustion | Remaining provider quota falls below a safety margin | Warning |
| Refusal spike | Refusals per request double against baseline — often false positives after a model or prompt change | Warning |

### Business Observability

Technical metrics tell you *how* your AI features are performing. Business observability tells you *whether they matter*. Without this link, cost dashboards are just scary numbers and quality scores are vanity metrics.

Connect AI operations to business outcomes:

| Metric | Measures | Caveat |
|--------|----------|--------|
| Feature adoption | Share of eligible users actively using the AI feature, by segment | — |
| Manual fallback | Users who abandoned the AI output and did the task by hand, by reason | — |
| Task completion | Tasks completed with AI assistance vs. attempts | Define "completed" per feature |
| Time saved | Task duration vs. a manual baseline | Needs a measured baseline, not an assumed one |
| AI-influenced revenue | Revenue from transactions where the feature was used | Correlation, not causation — claim impact only from holdouts or experiments |
| ROI per feature | (business value − AI cost) / AI cost, with cost from Factor 20 | Only as sound as the value estimate |

**Business Dashboard** (complements the technical dashboards above)
- Feature adoption rate over time — are users actually using it?
- AI vs. manual fallback rate — when users reject AI output, why?
- Time saved per task by feature — quantified productivity gain
- Revenue influenced by AI features — ties AI cost to business value
- ROI per feature — cost from Factor 20 vs. business value generated

This closes the loop between Factor 15 (observability) and Factor 20 (AI Economics): cost without business context is just a number, and business value without cost context is just hope.

### AI Service Level Objectives (SLOs)
Traditional SLOs cover availability and latency. AI features need SLOs for quality, cost, and safety — bridging observability (this factor) with economics (Factor 20).

Each SLO states its indicator precisely — for ratios, the numerator and the denominator — plus a target and a window:

| SLO | Indicator | Example target |
|-----|-----------|----------------|
| Quality | Responses scoring at or above the quality threshold / evaluated responses | 90% over 7 days; alert when the error budget burns 2× faster than planned |
| Latency | Requests faster than the threshold / all requests | 50% under 2 s and 99% under 8 s, over 7 days |
| Cost | Mean cost per interaction, and interactions above a hard ceiling | Mean under $0.03, none above $0.50, over 30 days |
| Resolution (support chat) | Conversations resolved without human escalation / all conversations | 70% over 30 days |

**Safety needs more than one indicator.** A guardrail activation rate is not a safety SLO on its own: a higher rate can mean more blocked attacks or more false positives, and a lower rate can mean a broken detector. Track separately:

- **Detections** — guardrail activations per request, by category.
- **False positives** — the share of activations that human review finds unwarranted, from a sampled review queue.
- **Estimated false negatives** — harmful outputs found in a reviewed sample of traffic the guardrails passed.
- **Confirmed harmful events** — incidents verified by review or user reports; the outcome the SLO exists to protect.

The same caution applies to automated quality and hallucination scores: an LLM judge's score, or a model's self-reported confidence, is not a probability. Calibrate it against human-labeled samples and report the observed error rate.

SLOs turn metrics into actionable contracts. When an error budget burns down, the team prioritizes reliability work over features — the same discipline applied to traditional services, extended to AI quality and cost.

Further reading: Google SRE Workbook, [Implementing SLOs](https://sre.google/workbook/implementing-slos/) and [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/).

### OpenTelemetry GenAI Semantic Conventions

The **OpenTelemetry GenAI semantic conventions** are the common contract for AI telemetry. In June 2026 they moved to their own repository (`open-telemetry/semantic-conventions-genai`), and the `gen_ai.*` attributes are still at *Development* stability — adopt them, pin the convention version your instrumentation emits, and expect renames (`gen_ai.system`, for example, became `gen_ai.provider.name`). They make traces and metrics portable across observability stacks (Langfuse, LangSmith, Arize Phoenix, Helicone, W&B Weave, Datadog, Honeycomb) and across teams.

Agent work is modeled as a span tree: an `invoke_agent` span parents the `chat` and `execute_tool` spans of each step. Span attributes (subset):

```text
gen_ai.operation.name                  = "chat" | "invoke_agent" | "execute_tool" | ...
gen_ai.provider.name                   = "anthropic" | "openai" | "gcp.vertex_ai" | ...
gen_ai.request.model                   = "<pinned model ID>"
gen_ai.request.max_tokens              = 4096
gen_ai.usage.input_tokens              = 1250
gen_ai.usage.output_tokens             = 6140
gen_ai.usage.cache_read.input_tokens   = 980
gen_ai.usage.reasoning.output_tokens   = 5800
gen_ai.response.finish_reasons         = ["end_turn"]
gen_ai.conversation.id                 = "conv_7f3a"
gen_ai.tool.name                       = "search_knowledge_base"
gen_ai.tool.call.id                    = "tool_call_abc123"
gen_ai.agent.id                        = "research-agent-v3"
gen_ai.agent.name                      = "research-agent"
```

Totals include their subsets: `gen_ai.usage.input_tokens` includes cached reads, and `gen_ai.usage.output_tokens` includes reasoning — this call produced 6,140 output tokens, of which 5,800 were reasoning and 340 visible text. Normalize every provider's usage to this shape before storing it, and price each kind of token once: adding reasoning on top of output counts it twice.

Metric names follow the same convention (e.g., `gen_ai.client.token.usage`). Treat the OTel GenAI spec as an inbound contract (cross-ref Factor 2) — your telemetry conforms to it.

**Trace context across MCP.** The MCP 2026-07-28 revision standardizes W3C trace context (`traceparent`, `tracestate`, `baggage`) in each request's `_meta`, so a tool call on a remote MCP server joins the same trace as the model call that requested it. Propagate it from your harness and extract it in your servers; otherwise every remote tool call starts an orphan trace.

### Carbon and Energy as a Standard Metric

Sustainability metrics moved from "nice to have" to dashboard-default in 2026. Google's disclosure benchmark of ~0.24 Wh and ~0.03 gCO₂e (plus ~0.26 mL of water) per median Gemini text prompt set the public reference. EU procurement and several enterprise vendor reviews now require Wh-per-100-tokens and gCO₂e-per-request reporting. Stanford AI Index emphasizes tokens-per-second-per-watt and tokens-per-joule as serving efficiency metrics.

Track these per request, and label them as estimates — record the estimation method and the grid-intensity source with each value:

- Energy per request (Wh)
- Estimated carbon per request (gCO₂e), with the regional grid factor applied
- Tokens per joule — serving efficiency
- Water per request, for hyperscaler workloads where reporting is available

Source the carbon factor from a regional grid intensity API (e.g., Electricity Maps) rather than a static average — it varies 10× across regions and across hours. Cross-ref Factor 20 for cost-equivalent treatment.

### New Signal Surfaces (2026)

Beyond model calls, these signal classes need first-class observability now:

- **Thinking-token ratio**: `thinking_tokens / output_tokens` per route. Sudden rise = harder task or prompt regression. Cross-ref Factor 14, Factor 17, Factor 20.
- **Computer-use action traces**: per-session traces of the actions a browser/desktop agent took (click, type, navigate), with screenshot redaction. Required to debug bad agent behavior and to satisfy audit obligations under EU AI Act high-risk classifications. Cross-ref Factor 8, Factor 18.
- **Voice / realtime latency** (when applicable): time-to-first-token, time-to-first-audio-byte, end-of-turn detection latency, barge-in latency, audio packet loss. Sub-300ms TTFT is the user-perceptible threshold for voice.
- **Memory read/write events**: counts of memory writes, recall hits, recall above-threshold hits, forget operations, and poisoning blocks, with per-identity detail kept in the audit log rather than in metric labels. Cross-ref Factor 19.
- **Steps and cost per completed agent task**: how many model calls and tool calls a task took, and what it cost end to end (cross-ref Factor 20). A rising step count for the same task mix is often the first visible sign of a harness, prompt, or model regression.
- **Refusals**: refusal rate per category and model (cross-ref Factor 10). A jump after a model upgrade usually means false positives on legitimate traffic.

### Fallback-Drift Detection

Multi-provider routing and fallback chains (cross-ref Factor 14, Factor 20) silently shift cost and quality when upstream providers degrade. A common production incident in 2025–2026: a primary provider intermittently fails and the fallback runs at 5–10× the cost without a visible alert. Detect this as a metric: count fallback invocations by primary model, fallback model, and reason.

Alert when fallback rate exceeds expected baseline (typically <1%). Most teams discover fallback drift only on the cost report.

### Trace Sampling for High-Volume AI Traffic

LLM-call traces are large (full prompts, full completions). At scale, full-fidelity tracing is unaffordable. Use stratified sampling:

- **100% sample** for: all errors, all guardrail triggers, all human-approval gates, all sessions with negative user feedback
- **Statistical sample** for: normal successful traffic (e.g., 1–5%, with rate adapting to volume)
- **PII-aware redaction** before storage in any case

Make the sampling rule explicit in code, not in the observability vendor's UI — it's part of the production contract.

### Observability Anti-Patterns
- **Logging prompts and completions in plain text**: These may contain PII. Log hashes or redacted versions.
- **No cost attribution**: If you can't attribute cost to features, teams, or tenants, you can't optimize.
- **Missing trace context**: If LLM calls aren't part of distributed traces, you can't debug latency issues.
- **Alert fatigue**: Don't alert on every guardrail trigger — alert on *rates* and *trends*.

## Compliance Checklist

- [ ] All AI operations emit structured log events with token counts, cost, latency, and model version
- [ ] Distributed traces span the full AI pipeline (retrieval → generation → safety check)
- [ ] Token economics metrics are tracked by model, provider, feature, and tenant
- [ ] Quality metrics from online evaluation are tracked and visualized
- [ ] Safety monitoring tracks guardrail triggers, PII detections, and content filter activations
- [ ] Cost dashboards show spend by feature, model, and tenant with budget tracking
- [ ] Alert rules cover cost anomalies, quality regressions, safety spikes, and provider degradation
- [ ] Prompt and completion logging respects PII policies (redacted or hashed)
- [ ] Business outcomes (adoption, task completion, revenue impact) are tracked per AI feature
- [ ] Observability data is retained long enough to support trend analysis and incident investigation
- [ ] Telemetry conforms to a pinned version of the OpenTelemetry GenAI semantic conventions (`gen_ai.*` attributes and metrics), and trace context propagates into MCP tool calls via `_meta`
- [ ] Carbon-per-request and energy-per-request are tracked as standard metrics, with regional grid factors
- [ ] Thinking-token ratio is monitored per route as a saturation signal
- [ ] Computer-use action traces are captured (with screenshot redaction) when computer-use agents are deployed
- [ ] Voice/realtime workloads track TTFT, end-of-turn latency, and barge-in latency
- [ ] Agent memory read/write/forget operations are emitted as observable events (cross-ref Factor 19)
- [ ] Fallback-drift detection alerts when multi-provider fallback rate exceeds baseline
- [ ] Model refusals are counted per category and alert on spikes after model or prompt changes
- [ ] Agent runs report steps and cost per completed task, not only per call
- [ ] Trace sampling is explicitly defined in code (100% on errors/guardrails/HITL; statistical sample on normal traffic)
