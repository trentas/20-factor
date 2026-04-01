# Factor 18: AI Economics and Cost Architecture

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
    note: "See Factor 16 for reasoning budget configuration per task profile"

  # Multimodal inputs have different token economics
  multimodal:
    image_tokens: "A 1024x1024 image ≈ 1,000 tokens; cost scales with resolution"
    audio: "Pre-transcription recommended — transcription cost + text tokens < raw audio tokens"
    note: "See Factor 16 for multimodal context budget allocation"

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
| **Context caching** (prefix caching) | 30-50% on input | Low | Requires stable prompt prefixes |
| **Output length control** (max_tokens) | 10-20% | Low | May truncate useful content |
| **Thinking budget tuning** (limit reasoning tokens) | 20-50% | Low | May reduce quality on complex tasks |
| **Fine-tuning** (smaller fine-tuned model) | 40-70% | High | Training cost, maintenance burden |
| **Model distillation** (large model → small specialist) | 50-80% | High | Distillation cost, narrow task scope |
| **Provider negotiation** (volume discounts) | 10-30% | Low | Vendor lock-in |

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
