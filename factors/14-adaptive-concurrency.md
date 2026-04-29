# Factor 14: Adaptive Concurrency

> Scale each process type independently, adapting to heterogeneous resource demands — CPU, GPU, memory, token-per-minute rate limits, and cost budgets.

## Motivation

The original concurrency factor used the Unix process model: scale out by running more processes. Web processes handle HTTP requests; worker processes handle background jobs. Scale each type independently based on load. Simple, effective, and well-understood.

AI applications break this simple model. They have heterogeneous resource demands that don't scale on a single axis. A model-serving process needs GPU memory. An embedding process needs CPU and network bandwidth. An orchestration process needs minimal compute but manages complex coordination. Rate limits from AI providers create artificial ceilings that can't be overcome by adding more processes. Token budgets create financial constraints that interact with scaling decisions. Scaling an AI application means balancing CPU, GPU, memory, rate limits, token budgets, and cost — simultaneously.

## What This Replaces

**Original Factor #8 / Beyond 15 #13: Concurrency** — "Scale out via the process model."

This update retains the process-model scaling principle and extends it to handle:

- Heterogeneous hardware scaling (CPU vs. GPU vs. TPU)
- AI provider rate limits (requests per minute, tokens per minute)
- Token budget constraints and cost-aware scaling
- Mixed workload scheduling (latency-sensitive inference vs. batch processing)
- Auto-scaling signals beyond CPU/memory (queue depth, token usage, cost rate)

## How AI Changes This

### AI-Assisted Development
- AI coding assistants run in the developer's environment and don't directly affect application concurrency. However, AI-assisted development may lead to architectures that are easier (or harder) to scale — AI tools should be guided toward scalable patterns.

### AI-Native Applications
- **GPU scaling is discrete**: You can't add 0.3 GPUs. GPU instances come in fixed sizes. Scaling decisions are coarser than CPU scaling.
- **Rate limits are hard ceilings**: Adding more processes doesn't help if the bottleneck is a provider's rate limit of 60,000 tokens per minute. You need to manage concurrency *within* the rate limit.
- **Cost scales linearly with usage**: Unlike CPU (which you pay for whether idle or busy), LLM costs scale directly with usage. More concurrency = more cost. Scaling must be cost-aware.
- **Latency vs. throughput trade-offs**: Batch inference is cheaper per token but higher latency. Interactive requests need low latency. These require different scaling strategies.

## In Practice

### Process Types for AI Applications

```yaml
# Process types with heterogeneous resource requirements
processes:
  web:
    type: cpu
    description: "API server — handles HTTP requests, orchestrates AI calls"
    scaling:
      metric: request_rate
      min: 2
      max: 20
    resources:
      cpu: 1
      memory: 2Gi

  inference:
    type: gpu
    description: "Self-hosted model serving"
    scaling:
      metric: gpu_utilization
      target: 70%
      min: 1
      max: 8
    resources:
      gpu: 1  # NVIDIA A100
      gpu_memory: 40Gi
      cpu: 4
      memory: 32Gi

  embedding:
    type: cpu_intensive
    description: "Embedding computation for ingestion pipeline"
    scaling:
      metric: queue_depth
      target: 100  # messages in queue
      min: 1
      max: 10
    resources:
      cpu: 4
      memory: 8Gi

  orchestrator:
    type: lightweight
    description: "Agent orchestration — coordinates multi-step AI workflows"
    scaling:
      metric: active_workflows
      min: 2
      max: 10
    resources:
      cpu: 0.5
      memory: 1Gi
```

### Rate-Limit-Aware Concurrency

```python
class RateLimitedConcurrency:
    """Manage concurrency within AI provider rate limits."""

    def __init__(self, provider_limits: ProviderLimits):
        self.rpm_semaphore = asyncio.Semaphore(
            provider_limits.requests_per_minute
        )
        self.tpm_budget = TokenBudget(
            provider_limits.tokens_per_minute
        )
        self.queue = asyncio.PriorityQueue()

    async def execute(self, request: AIRequest) -> AIResponse:
        # Priority queue: interactive > batch
        priority = 0 if request.is_interactive else 1
        await self.queue.put((priority, request))

        # Wait for rate limit capacity
        async with self.rpm_semaphore:
            # Check token budget
            estimated_tokens = request.estimate_tokens()
            await self.tpm_budget.acquire(estimated_tokens)

            try:
                response = await self.provider.complete(request)
                # Adjust token budget based on actual usage
                self.tpm_budget.adjust(estimated_tokens, response.actual_tokens)
                return response
            except RateLimitError:
                # Back off and retry
                await asyncio.sleep(self.backoff.next())
                return await self.execute(request)
```

### Cost-Aware Auto-Scaling

```yaml
# Auto-scaling that considers cost constraints
autoscaling:
  inference_workers:
    scale_up:
      conditions:
        - metric: request_queue_depth > 50
        - metric: p95_latency > 5s
      constraints:
        - max_cost_per_hour_usd: 100
        - max_instances: 8
      action:
        add_instances: 1
        cooldown: 300s

    scale_down:
      conditions:
        - metric: gpu_utilization < 20%
        - duration: 10m
      constraints:
        - min_instances: 1
      action:
        remove_instances: 1
        drain_timeout: 60s  # Factor 9: graceful shutdown

    cost_circuit_breaker:             # Factor 20 defines the full budget hierarchy
      daily_budget_usd: 2000
      alert_threshold: 0.80     # Alert at 80% of budget
      action_threshold: 0.95    # Stop scaling at 95% of budget
      action: freeze_scaling    # No new instances until next budget period
```

### Multi-Provider Load Balancing

An **AI Gateway** (Factor 10) can handle multi-provider routing at the infrastructure level, centralizing rate limit management, failover, and cost tracking across all application instances. When using a gateway, the application delegates routing decisions to the gateway; when managing routing in-app, implement it as follows:

```python
class MultiProviderRouter:
    """Route requests across providers based on rate limits and cost."""

    def __init__(self, providers: list[ProviderConfig]):
        self.providers = providers

    async def route(self, request: AIRequest) -> ProviderConfig:
        available = []
        for provider in self.providers:
            capacity = await provider.available_capacity()
            if capacity.can_handle(request):
                available.append((provider, capacity))

        if not available:
            # All providers at capacity — queue or reject
            raise CapacityExhaustedError()

        # Route based on strategy
        if request.is_interactive:
            # Lowest latency for interactive requests
            return min(available, key=lambda p: p[1].estimated_latency)
        else:
            # Lowest cost for batch requests
            return min(available, key=lambda p: p[1].cost_per_token)
```

### Batch Processing Patterns
For throughput-oriented workloads:

```python
class BatchProcessor:
    """Process AI workloads in batches for cost efficiency."""

    def __init__(self, batch_size: int = 20, max_wait_ms: int = 100):
        self.batch_size = batch_size
        self.max_wait_ms = max_wait_ms
        self.buffer = []

    async def process(self, request: AIRequest) -> AIResponse:
        future = asyncio.Future()
        self.buffer.append((request, future))

        if len(self.buffer) >= self.batch_size:
            await self.flush()
        else:
            # Wait briefly for more requests to batch together
            await asyncio.sleep(self.max_wait_ms / 1000)
            if not future.done():
                await self.flush()

        return await future

    async def flush(self):
        batch = self.buffer[:self.batch_size]
        self.buffer = self.buffer[self.batch_size:]

        # Send batch to provider (embedding APIs support batching natively)
        results = await self.provider.batch_process([r for r, _ in batch])

        for (_, future), result in zip(batch, results):
            future.set_result(result)
```

### Scaling Signals
Go beyond CPU and memory for auto-scaling decisions:

| Signal | What It Means | Scaling Action |
|--------|--------------|----------------|
| Request queue depth | Requests waiting for processing | Scale up inference workers |
| GPU utilization | GPU compute saturation | Scale up GPU instances |
| Token throughput | Tokens processed per second | Monitor against rate limits |
| Provider rate limit errors | Hitting provider ceilings | Route to alternate provider or queue |
| Cost rate ($/hour) | Spending velocity | Throttle or pause scaling |
| P95 latency | User experience degradation | Scale up or optimize routing |
| Embedding queue depth | Ingestion backlog | Scale up embedding workers |

## Compliance Checklist

- [ ] Each process type is independently scalable with appropriate resource definitions
- [ ] GPU workloads scale on GPU-specific metrics (utilization, memory), not CPU
- [ ] AI provider rate limits are respected through client-side concurrency control
- [ ] Cost budgets are enforced as scaling constraints — circuit breakers aligned with Factor 20 budget hierarchy
- [ ] Auto-scaling signals include AI-specific metrics (queue depth, token throughput, cost rate)
- [ ] Interactive and batch workloads use different scaling strategies
- [ ] Multi-provider routing balances load across providers based on capacity and cost
- [ ] Batch processing is used for throughput-oriented workloads
- [ ] Scale-down respects graceful shutdown (Factor 9) with drain timeouts
- [ ] Scaling decisions and cost impact are observable (Factor 15)
