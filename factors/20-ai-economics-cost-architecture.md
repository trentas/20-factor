---
title: "20. AI Economics & Cost Architecture"
parent: "Tier 4: Intelligence"
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

```yaml
# cost-model.yaml — understand your cost drivers
cost_model:
  models:
    claude-sonnet-4-5-20250929:
      input_per_1m_tokens: 3.00
      output_per_1m_tokens: 15.00
      cache_read_per_1m_tokens: 0.30
      typical_use: "Complex reasoning, document analysis"

    claude-opus-4-6-20250515:
      input_per_1m_tokens: 15.00
      output_per_1m_tokens: 75.00
      cache_read_per_1m_tokens: 1.50
      thinking_tokens_per_1m: 75.00    # thinking tokens billed as output
      typical_use: "Complex reasoning, multi-step analysis, research"
      note: "Extended thinking can generate 10-100x more thinking tokens than visible output"

    claude-haiku-4-5-20251001:
      input_per_1m_tokens: 0.80
      output_per_1m_tokens: 4.00
      cache_read_per_1m_tokens: 0.08
      typical_use: "Classification, simple Q&A, routing"

    text-embedding-3-small:
      input_per_1m_tokens: 0.02
      typical_use: "Document embedding, semantic search"

  # Reasoning models introduce thinking token economics
  reasoning:
    thinking_tokens: "Internal reasoning tokens generated before the visible response"
    cost_impact: "A 500-token response may consume 10,000-30,000 thinking tokens"
    pricing: "Thinking tokens are typically billed at output token rates"
    optimization: "Budget thinking tokens per task type — not all tasks benefit from extended reasoning"
    note: "See Factor 17 for reasoning budget configuration per task profile"

  # Multimodal inputs have different token economics
  multimodal:
    image_tokens: "A 1024x1024 image ≈ 1,000 tokens; cost scales with resolution"
    audio: "Pre-transcription recommended — transcription cost + text tokens < raw audio tokens"
    note: "See Factor 17 for multimodal context budget allocation"

  # Estimate costs per feature
  features:
    document_summary:
      avg_input_tokens: 4500
      avg_output_tokens: 500
      model: claude-sonnet-4-5-20250929
      estimated_cost_per_request: 0.021
      monthly_volume: 50000
      estimated_monthly_cost: 1050

    support_chat:
      avg_input_tokens: 2000
      avg_output_tokens: 300
      model: claude-haiku-4-5-20251001
      estimated_cost_per_request: 0.003
      monthly_volume: 200000
      estimated_monthly_cost: 600
      cache_hit_rate: 0.30
      estimated_monthly_cost_with_cache: 420

    ticket_classification:
      avg_input_tokens: 500
      avg_output_tokens: 50
      model: claude-haiku-4-5-20251001
      estimated_cost_per_request: 0.0006
      monthly_volume: 100000
      estimated_monthly_cost: 60
```

### Intelligent Model Routing

```python
class CostAwareRouter:
    """Route requests to the most cost-effective model that meets quality requirements."""

    def __init__(self, models: list[ModelConfig], classifier: ComplexityClassifier):
        self.models = sorted(models, key=lambda m: m.cost_per_token)
        self.classifier = classifier

    async def route(self, request: AIRequest) -> ModelConfig:
        complexity = await self.classifier.classify(request)

        match complexity:
            case Complexity.SIMPLE:
                # Simple tasks: cheapest model, no extended thinking
                # Examples: classification, yes/no questions, format conversion
                return self.get_model("haiku")

            case Complexity.MODERATE:
                # Moderate tasks: mid-tier model, no extended thinking
                # Examples: summarization, Q&A with context
                return self.get_model("sonnet")

            case Complexity.COMPLEX:
                # Complex tasks: most capable model
                # Examples: multi-step reasoning, creative writing, code generation
                return self.get_model("sonnet", thinking_budget=16000)

            case Complexity.RESEARCH:
                # Deep reasoning tasks: reasoning model with high thinking budget
                # Examples: multi-step analysis, research synthesis, complex planning
                return self.get_model("opus", thinking_budget=32000)

    async def route_with_fallback(self, request: AIRequest) -> ModelConfig:
        """Try cheaper model first, escalate if quality is insufficient."""
        cheap_model = self.get_cheapest_viable(request)
        response = await cheap_model.complete(request)

        if await self.quality_check(response) >= request.quality_threshold:
            return response

        # Escalate to more capable model
        better_model = self.get_next_tier(cheap_model)
        return await better_model.complete(request)
```

### Budget Circuit Breakers

```python
class BudgetCircuitBreaker:
    """Hard limits that prevent runaway AI costs."""

    def __init__(self, budgets: BudgetConfig):
        self.budgets = budgets
        self.usage = CostTracker()

    async def check_budget(self, request: AIRequest) -> BudgetResult:
        estimated_cost = self.estimate_cost(request)

        # Per-request limit
        if estimated_cost > self.budgets.max_cost_per_request:
            return BudgetResult.rejected(
                f"Estimated cost ${estimated_cost:.3f} exceeds "
                f"per-request limit ${self.budgets.max_cost_per_request:.3f}"
            )

        # Per-user hourly limit
        user_hourly = await self.usage.get_user_hourly(request.user_id)
        if user_hourly + estimated_cost > self.budgets.max_cost_per_user_per_hour:
            return BudgetResult.rejected("User hourly budget exceeded")

        # Per-tenant daily limit
        tenant_daily = await self.usage.get_tenant_daily(request.tenant_id)
        if tenant_daily + estimated_cost > self.budgets.max_cost_per_tenant_per_day:
            return BudgetResult.rejected("Tenant daily budget exceeded")

        # Global daily limit
        global_daily = await self.usage.get_global_daily()
        if global_daily + estimated_cost > self.budgets.max_cost_per_day:
            return BudgetResult.rejected("Global daily budget exceeded")

        return BudgetResult.approved(estimated_cost)
```

### Budget Configuration

```yaml
budgets:
  per_request:
    max_usd: 0.50              # No single request can cost more than $0.50
    alert_threshold: 0.25       # Alert on requests costing > $0.25

  per_user:
    hourly_max_usd: 5.00
    daily_max_usd: 25.00

  per_tenant:
    daily_max_usd: 500.00
    monthly_max_usd: 10000.00

  global:
    hourly_max_usd: 200.00
    daily_max_usd: 3000.00
    monthly_max_usd: 50000.00

  alerts:
    - threshold: 0.50           # 50% of budget
      action: notify_team
    - threshold: 0.80           # 80% of budget
      action: notify_team_and_management
    - threshold: 0.95           # 95% of budget
      action: throttle_non_critical
    - threshold: 1.00           # 100% of budget
      action: block_all_non_critical
```

### Cost Attribution

```python
class CostAttributor:
    """Attribute AI costs to features, teams, users, and tenants."""

    async def record(self, request: AIRequest, response: AIResponse):
        cost = self.calculate_cost(response.model, response.token_usage)

        # Multi-dimensional attribution
        await self.metrics.record(
            cost_usd=cost,
            dimensions={
                "feature": request.feature,           # e.g., "document_summary"
                "team": request.team,                 # e.g., "product"
                "user": request.user_id,
                "tenant": request.tenant_id,
                "model": response.model,
                "provider": response.provider,
                "cache_hit": response.cache_hit,
                "thinking_tokens": response.thinking_tokens,  # reasoning model overhead
            },
        )
```

### Caching ROI Measurement

```python
class CachingROI:
    """Measure the cost savings from semantic caching."""

    async def report(self, period: TimePeriod) -> CacheROIReport:
        cache_hits = await self.metrics.count("cache_hit=true", period)
        cache_misses = await self.metrics.count("cache_hit=false", period)
        total_requests = cache_hits + cache_misses

        hit_rate = cache_hits / total_requests if total_requests > 0 else 0

        # Cost saved = cache hits × average cost per uncached request
        avg_uncached_cost = await self.metrics.avg("cost_usd", "cache_hit=false", period)
        cost_saved = cache_hits * avg_uncached_cost

        # Cost of cache infrastructure
        cache_infra_cost = await self.get_cache_infrastructure_cost(period)

        return CacheROIReport(
            hit_rate=hit_rate,
            requests_served_from_cache=cache_hits,
            cost_saved_usd=cost_saved,
            cache_infrastructure_cost_usd=cache_infra_cost,
            net_savings_usd=cost_saved - cache_infra_cost,
            roi_percentage=((cost_saved - cache_infra_cost) / cache_infra_cost) * 100
                if cache_infra_cost > 0 else float('inf'),
        )
```

### Cost Optimization Strategies

| Strategy | Savings Potential | Complexity | Trade-off |
|----------|------------------|------------|-----------|
| **Model routing** (cheap model for simple tasks) | 30-60% | Medium | Slightly lower quality on edge cases |
| **Semantic caching** | 20-40% | Medium | Stale responses possible |
| **Prompt optimization** (shorter prompts) | 10-30% | Low | May reduce quality |
| **Batch processing** (batch API discounts) | 50% | Low | Higher latency (24h) |
| **Provider prompt caching** (Anthropic/OpenAI/Google) | 80-90% on cached input | Low | Requires stable prompt prefixes, min token threshold, ephemeral cache TTL |
| **Output length control** (max_tokens) | 10-20% | Low | May truncate useful content |
| **Thinking budget tuning** (limit reasoning tokens) | 20-50% | Low | May reduce quality on complex tasks |
| **Fine-tuning** (smaller fine-tuned model) | 40-70% | High | Training cost, maintenance burden |
| **Model distillation** (large model → small specialist) | 50-80% | High | Distillation cost, narrow task scope |
| **Provider negotiation** (volume discounts) | 10-30% | Low | Vendor lock-in |

### AI Gateway as the Cost Control Plane

By 2026 putting an **AI Gateway** in front of every LLM call is the production default. Direct SDK-to-provider calls suffice for prototypes; production workloads route through a gateway because cost, routing, caching, and observability are cross-cutting concerns that don't belong scattered across application code.

Production-grade options: **LiteLLM**, **Portkey**, **Kong AI Gateway**, **Cloudflare AI Gateway**, **TrueFoundry**, hyperscaler-native (Bedrock, Azure AI Gateway). Whether built or bought, the gateway centralizes:

- **Multi-provider routing**: a single API surface for OpenAI, Anthropic, Google, Bedrock, Azure, self-hosted, and others — with per-route policies
- **Semantic and prompt caching**: a unified cache layer across providers (cross-ref Factor 12)
- **Budget circuit breakers**: per-tenant, per-feature, per-user (cross-ref this factor)
- **Rate-limit shaping**: client-side rate limiting normalized across providers (cross-ref Factor 14)
- **Guardrails**: input/output filtering before the model and before the user (cross-ref Factor 7)
- **Audit and observability**: every call logged with the same correlation IDs as application traces (cross-ref Factor 15)

The architectural rule: **no application code calls a model provider directly**. All traffic flows through the gateway, and policies are centralized.

```yaml
# ai-gateway-policy.yaml — minimal example
gateway:
  routes:
    - name: customer-support
      pin_model: anthropic/claude-sonnet-4-6   # mandatory model-pin
      cache: { semantic: true, similarity_threshold: 0.95 }
      budget:
        per_tenant_daily_usd: 50
        per_user_hourly_usd: 1
        on_breach: block                       # circuit breaker
      guardrails: [pii_redact_input, content_safety_output]

    - name: research-assistant
      pin_model: anthropic/claude-opus-4-7
      thinking: { effort: high }
      cache: { semantic: false }
      budget:
        per_request_usd: 5
        on_breach: fallback                    # downgrade to sonnet
      fallback_chain:
        - anthropic/claude-sonnet-4-6
        - openai/gpt-5.1                       # last resort
```

### Mandatory Model-Pinning per Job

Every scheduled job, every production route, every batch process **must explicitly declare which model it uses**. Implicit "use the latest" or relying on provider aliases is a recipe for silent cost and quality drift.

The 2026 pattern: a release manifest entry per job with model + version + thinking-effort + max-cost. The gateway refuses to dispatch a request that doesn't match the manifest.

```yaml
jobs:
  - name: nightly-content-summarization
    model: anthropic/claude-sonnet-4-6
    thinking: { effort: low }
    max_cost_per_run_usd: 25
    expected_output_tokens_p99: 4000
    fallback_policy: fail_loudly   # do NOT silently fall back to a more expensive model
```

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

**EU AI Act serious-incident reporting (Art. 73)**: Operators of high-risk AI systems must notify competent authorities within 15 business days of a serious incident. This requires an **AI incident log** separate from general application logs, capturing: model version at time of incident, sanitized input/output (where permitted by data minimization rules), safety flag activations, and the timeline of detection and remediation.

**Model insurance**: Insurance products from Munich Re, Lloyds, and others now cover financial loss from AI-related incidents — hallucinations causing contract errors, classification errors in insurance or lending decisions, IP infringement from training data. Review coverage options annually as model capabilities and legal precedents evolve.

**Vendor liability clauses**: AI vendor MSAs now include explicit liability caps, indemnification for model behavior, and IP indemnification for training data. Review these annually and ensure your use case falls within the covered scope. Document the vendor's liability obligations alongside the model entry in the registry (Factor 16).

Architectural implications:
- Maintain an AI incident log at the application level, distinct from standard observability (Factor 15), to satisfy regulatory reporting cadences
- Store model version, inference parameters, and sanitized I/O for a minimum retention period aligned with your jurisdiction's AI Act requirements
- If your application falls in an EU AI Act high-risk category, complete a Conformity Assessment before the August 2, 2026 enforcement deadline

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
- [ ] Reasoning model thinking tokens are budgeted per task type and tracked separately from output tokens
- [ ] AI cost is a line item in capacity planning and business case analysis
- [ ] All production model traffic flows through an AI Gateway (LiteLLM, Portkey, Kong AI, Cloudflare AI Gateway, or equivalent), not via direct SDK calls
- [ ] Every scheduled job and production route declares an explicit pinned model + version + thinking-effort; "latest" aliases are forbidden
- [ ] Steady-state high-volume workloads run on reserved/provisioned throughput (Bedrock PT, Azure PTUs, enterprise commits, or reserved GPU)
- [ ] Carbon-per-request (gCO₂e) is tracked alongside dollar cost, with regional grid factors
- [ ] Fallback chains are explicitly defined per route, including a "fail loudly" option for cost-sensitive jobs
- [ ] FinOps maturity is at least Level 3 (chargeback) before major product expansion involving new AI features
- [ ] An AI incident log is maintained (separate from general observability) capturing model version, sanitized I/O, and safety activations for potential EU AI Act Art. 73 reporting
- [ ] Vendor MSA liability terms (caps, indemnification, IP coverage) are reviewed annually and documented alongside model registry entries
- [ ] Applications in EU AI Act high-risk categories have completed or scheduled a Conformity Assessment ahead of the August 2, 2026 enforcement deadline
