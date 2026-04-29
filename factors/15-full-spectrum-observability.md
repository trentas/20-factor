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

```json
{
  "timestamp": "2025-06-15T14:30:00.123Z",
  "level": "info",
  "service": "document-assistant",
  "trace_id": "abc123",
  "span_id": "def456",
  "event": "llm_completion",
  "model": "claude-sonnet-4-5-20250929",
  "provider": "anthropic",
  "input_tokens": 1250,
  "output_tokens": 340,
  "total_tokens": 1590,
  "cost_usd": 0.012,
  "latency_ms": 2340,
  "cache_hit": false,
  "quality_score": 0.91,
  "safety_flags": [],
  "user_id": "user_789",
  "tenant_id": "tenant_acme",
  "feature": "document_summary",
  "request_id": "req_xyz"
}
```

### Distributed Tracing for AI Pipelines

```
[Trace: document-summary-request]
│
├── [Span: api-handler] 5ms
│   └── Parse and validate request
│
├── [Span: document-retrieval] 45ms
│   ├── [Span: embed-query] 15ms
│   │   └── model: text-embedding-3-small, tokens: 12
│   ├── [Span: vector-search] 20ms
│   │   └── results: 10, similarity_min: 0.82
│   └── [Span: rerank] 10ms
│       └── model: rerank-v3, results_after: 5
│
├── [Span: context-assembly] 2ms
│   └── total_context_tokens: 3200
│
├── [Span: llm-generation] 2340ms
│   ├── model: claude-sonnet-4-5-20250929
│   ├── input_tokens: 4450
│   ├── output_tokens: 340
│   ├── cache_hit: prefix (3200 tokens cached)
│   └── cost: $0.012
│
├── [Span: safety-check] 50ms
│   ├── content_safety: pass
│   ├── pii_check: pass
│   └── hallucination_check: pass (3/3 citations verified)
│
└── [Span: response] 2ms
    └── total_latency: 2444ms
```

### AI-Specific Metrics

```yaml
# Token Economics Metrics
metrics:
  - name: ai_tokens_total
    type: counter
    labels: [model, provider, direction, feature, tenant]
    description: "Total tokens consumed"

  - name: ai_cost_usd_total
    type: counter
    labels: [model, provider, feature, tenant]
    description: "Total cost in USD"

  - name: ai_request_duration_seconds
    type: histogram
    labels: [model, provider, feature]
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    description: "LLM request latency"

  # Quality Metrics
  - name: ai_quality_score
    type: histogram
    labels: [feature, model]
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    description: "AI output quality scores from online evaluation"

  - name: ai_cache_hit_ratio
    type: gauge
    labels: [cache_type, feature]
    description: "Semantic cache hit rate"

  # Safety Metrics
  - name: ai_safety_trigger_total
    type: counter
    labels: [trigger_type, action, feature]
    description: "Safety guardrail activations"

  - name: ai_pii_detection_total
    type: counter
    labels: [entity_type, boundary, action]
    description: "PII detected at input/output boundaries"

  # Operational Metrics
  - name: ai_provider_error_total
    type: counter
    labels: [provider, error_type]
    description: "AI provider errors (rate limit, timeout, 5xx)"

  - name: ai_rate_limit_remaining
    type: gauge
    labels: [provider, limit_type]
    description: "Remaining rate limit capacity"
```

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

```yaml
alerts:
  - name: high_ai_cost_rate
    condition: rate(ai_cost_usd_total[1h]) > 50
    severity: warning
    message: "AI spending exceeds $50/hour"

  - name: quality_regression
    condition: avg(ai_quality_score{feature="summarization"}[1h]) < 0.85
    severity: critical
    message: "Summary quality dropped below threshold"

  - name: safety_spike
    condition: rate(ai_safety_trigger_total[15m]) > 10
    severity: critical
    message: "Elevated safety guardrail triggers"

  - name: provider_degradation
    condition: ai_request_duration_seconds_p99 > 10
    severity: warning
    message: "AI provider latency exceeding 10s at p99"

  - name: rate_limit_approaching
    condition: ai_rate_limit_remaining < 100
    severity: warning
    message: "Approaching AI provider rate limit"
```

### Business Observability

Technical metrics tell you *how* your AI features are performing. Business observability tells you *whether they matter*. Without this link, cost dashboards are just scary numbers and quality scores are vanity metrics.

Connect AI operations to business outcomes:

```yaml
# Business Observability Metrics
metrics:
  # User Adoption
  - name: ai_feature_adoption_rate
    type: gauge
    labels: [feature, user_segment]
    description: "Percentage of eligible users actively using AI feature"

  - name: ai_feature_fallback_total
    type: counter
    labels: [feature, reason]
    description: "Users who abandoned AI output and did the task manually"

  # Task Effectiveness
  - name: ai_task_completion_rate
    type: gauge
    labels: [feature]
    description: "Tasks successfully completed with AI assistance vs. total attempts"

  - name: ai_time_saved_seconds
    type: histogram
    labels: [feature, user_segment]
    description: "Time saved per task compared to manual baseline"

  # Revenue & ROI
  - name: ai_influenced_revenue_usd
    type: counter
    labels: [feature, tenant]
    description: "Revenue from transactions where AI feature was used"

  - name: ai_feature_roi
    type: gauge
    labels: [feature]
    description: "ROI = (business_value - ai_cost) / ai_cost"
```

**Business Dashboard** (complements the technical dashboards above)
- Feature adoption rate over time — are users actually using it?
- AI vs. manual fallback rate — when users reject AI output, why?
- Time saved per task by feature — quantified productivity gain
- Revenue influenced by AI features — ties AI cost to business value
- ROI per feature — cost from Factor 20 vs. business value generated

This closes the loop between Factor 15 (observability) and Factor 20 (AI Economics): cost without business context is just a number, and business value without cost context is just hope.

### AI Service Level Objectives (SLOs)
Traditional SLOs cover availability and latency. AI features need SLOs for quality, cost, and safety — bridging observability (this factor) with economics (Factor 20).

```yaml
# ai-slos.yaml
slos:
  document_summary:
    quality:
      target: 0.90                     # 90% of responses score ≥ threshold on eval
      measurement: ai_quality_score{feature="summarization"}
      window: 7d
      burn_rate_alert: 2x              # alert if error budget burns 2x faster than expected

    latency:
      p50_target_ms: 2000
      p99_target_ms: 8000
      measurement: ai_request_duration_seconds{feature="summarization"}
      window: 7d

    cost_per_interaction:
      target_usd: 0.03                 # average cost per request
      max_usd: 0.50                    # no single request exceeds this
      measurement: ai_cost_usd{feature="summarization"}
      window: 30d

    safety:
      guardrail_trigger_rate: 0.01     # < 1% of requests trigger safety guardrails
      hallucination_rate: 0.05         # < 5% of responses flagged by hallucination detection
      window: 7d

  support_chat:
    quality:
      target: 0.85
      window: 7d
    latency:
      p50_target_ms: 1500
      p99_target_ms: 5000
    resolution_rate:
      target: 0.70                     # 70% of conversations resolved without human escalation
      window: 30d
```

SLOs turn metrics into actionable contracts. When an error budget burns down, the team prioritizes reliability work over features — the same discipline applied to traditional services, extended to AI quality and cost.

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
