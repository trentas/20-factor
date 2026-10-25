---
layout: page
importance: 14
category: "Tier 3: Operation"
title: "14. Adaptive Concurrency"
nav_order: 6
description: "Scale independently across CPU, GPU, rate limits, and cost budgets."
---

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
- **Rate limits are hard ceilings**: Adding more processes doesn't help if the bottleneck is a provider's rate limit of 60,000 tokens per minute. You need to pace requests and tokens *within* the rate limit — and a rate is not a concurrency cap.
- **Cost scales linearly with usage**: Unlike CPU (which you pay for whether idle or busy), LLM costs scale directly with usage. More concurrency = more cost. Scaling must be cost-aware.
- **Latency vs. throughput trade-offs**: Batch inference is cheaper per token but higher latency. Interactive requests need low latency. These require different scaling strategies.

## In Practice

### Process Types for AI Applications

Each process type scales on the resource that actually limits it, not on CPU by default. A typical AI application runs at least four:

| Process type | Limiting resource | Scale on | Watch out for |
|--------------|-------------------|----------|---------------|
| Web / API | CPU, open connections | Request rate, p95 latency | Holding a request thread for the whole duration of a slow model call — stream, or hand off to a worker |
| Self-hosted inference | GPU memory and compute | Queue depth, GPU and KV-cache utilization | Capacity comes in whole GPUs, and a new replica needs minutes to load weights before it serves traffic |
| Embedding / ingestion | CPU or GPU; provider tokens-per-minute | Backlog (queue depth) | A bulk re-index consuming the rate limit that interactive traffic shares |
| Agent orchestration | Little compute; many long-lived workflows | Active workflows, task-queue latency | Counting parked workflows as load — a workflow waiting on approval holds no worker (Factor 13) |

### Rate Limits Are Not Concurrency Limits

Calling a model provider involves four separate controls. Conflating them is the usual cause of 429 storms, stalled queues, and runaway retries:

| Control | Question it answers | Typical mechanism |
|---------|---------------------|-------------------|
| **Concurrency** | How many calls are in flight right now? | Semaphore or connection pool |
| **Rate** | How many requests and tokens per time window? | Token bucket or sliding window per provider quota (RPM, input TPM, output TPM) |
| **Queue** | What waits when capacity is full, and in what order? | Bounded priority queue drained by a dispatcher |
| **Budget** | How much may this tenant or task spend? | Reservation against a cost budget (Factor 20) |

A semaphore sized to the requests-per-minute quota caps calls *in flight*, not calls *per minute*: sixty fast calls finish in two seconds, release their slots, and sixty more go out. A correct client follows these rules:

- **Enforce rate per time window, for requests and tokens.** Reserve the estimated tokens before sending, then reconcile with the actual usage the response reports. Reasoning tokens are billed as output tokens, so output estimates for reasoning routes must include them.
- **Treat the quota as global.** A provider quota applies to an organization, project, or API key — not to one process. Ten replicas that each enforce the full limit send up to ten times the quota. Enforce it in one shared place (an AI gateway, Factor 10, or a shared limiter), or give each replica an explicit share.
- **Bound the queue and drain it.** A dispatcher releases work as rate and concurrency allow. Interactive requests go first, but waiting batch work gains priority over time so it is not starved, and each tenant gets a fair share so one tenant cannot consume the whole quota. When the queue is full, reject immediately with a retry hint instead of growing memory.
- **Send retries back through the limiter.** On 429 or 503, honor the provider's `Retry-After` header (or its rate-limit headers); otherwise back off exponentially with jitter. Release the concurrency slot while waiting, cap the number of attempts, and never retry past the caller's deadline. A retry that holds its slot or bypasses the limiter amplifies the overload it is reacting to.
- **Propagate deadlines and cancellation.** When the caller gives up, its request leaves the queue and stops consuming quota.

Further reading: Google SRE, [Handling Overload](https://sre.google/sre-book/handling-overload/); AWS Builders' Library, [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/); [RFC 9110, `Retry-After`](https://www.rfc-editor.org/rfc/rfc9110#field.retry-after).

### Cost-Aware Auto-Scaling

- **Scale up on demand, within hard caps.** Queue depth and p95 latency trigger scale-up; a maximum instance count and a maximum cost rate ($/hour) bound it.
- **Use leading signals for GPUs.** Queue depth rises before utilization does, and a new GPU replica takes minutes to become useful. Keep a warm minimum for interactive routes instead of scaling from zero.
- **Damp oscillation.** Apply a cooldown after each scaling action, and scale down only after a sustained quiet period (for example, GPU utilization below 20% for 10 minutes).
- **Scale down by draining.** A replica being removed finishes or hands off its in-flight work first (Factor 9).
- **Let budget pressure change behavior before it stops service.** Alert at a threshold (for example, 80% of the period budget), freeze scale-up near the limit, and defer batch work before touching interactive traffic. Freezing scale-up caps infrastructure spend only; spend on provider APIs needs the budget controls in Factor 20.

### Multi-Provider Load Balancing

An **AI Gateway** (Factor 10) can handle multi-provider routing at the infrastructure level, centralizing rate limit management, failover, and cost tracking across all application instances. Whether routing lives in the gateway or in the application, the same rules apply:

- **Route only to providers with capacity left** under their current rate limits. When none has capacity, queue (bounded) or reject with a retry hint.
- **Optimize per workload**: lowest latency for interactive requests, lowest cost for batch.
- **Route only among evaluated equivalents.** The same model served by two providers can differ in supported parameters, limits, and output behavior. Every routing target must have passed the evaluation suite for that task (Factor 6, Factor 16); a fallback that was never evaluated is an unannounced quality change.

### Batch Processing Patterns

Throughput-oriented work has two levels of batching:

- **Micro-batching in the client.** Group small requests (embeddings are the classic case) and send the batch when it is full or when a short maximum wait expires, whichever comes first. Size batches to the provider's per-request limits, and return each item's result or error to its own caller — one failed item must not fail, or silently drop, the others.
- **Provider batch APIs.** For work that can wait hours, the asynchronous batch endpoints that major providers offer are typically discounted relative to synchronous calls and draw on a separate quota. Results can arrive in any order, so match them by request ID, not by position. Treat a batch API as a queue with a completion window, not as a faster API.

### Thinking-Token Budgets as a Concurrency Dimension

Reasoning models (Claude with extended thinking, OpenAI's GPT-5 series with reasoning effort, DeepSeek R-series, Gemini reasoning modes) introduced a new resource axis: **thinking tokens**. A request with 500 output tokens may consume 10,000–50,000 thinking tokens internally, billed as output tokens even when the reasoning itself is not returned. Concurrency planning must treat thinking tokens as a first-class budget.

By 2026 the per-call control shifted from raw thinking-token budgets (`budget_tokens`) to **effort levels** (low through max), usually combined with adaptive thinking, in which the model decides how deeply to reason within that bound. On several current models thinking cannot be turned off at all, and the default effort differs by model, so set effort explicitly for each route.

Production patterns:

- **Route by reasoning depth, not just by model**: classification → effort=low; multi-step plans → effort=medium; research/repair tasks → effort=high. This is orthogonal to model selection and often more impactful for cost.
- **Cap thinking-token rate per tenant**: high-effort traffic from one tenant can exhaust shared quota. Give thinking tokens their own per-tenant rate limit, alongside the output-token limit.
- **Track thinking-token ratio** as a saturation signal: if `thinking_tokens / output_tokens` rises above expected baseline for a given route, either the task is harder than intended (alert) or a prompt regression is causing wasted reasoning (investigate).
- **Don't over-route to reasoning**: many workloads see no quality gain from extended thinking (classification, format conversion, factual lookup). Default new routes to `effort=low` and prove a quality lift before escalating.

### Edge / NPU vs GPU vs Cloud Routing

By 2026, hybrid cloud+edge inference is mainstream. On-device NPUs (Apple A19 Pro Neural Accelerators ~75 TOPS, Gemini Nano via Android AICore, Phi-4-mini and Llama-3.2-1B running on low-RAM devices) handle a growing share of latency-sensitive and privacy-sensitive traffic. Cloud handles the rest. Treat **inference placement** as a per-request scheduling decision:

| Request characteristic | Placement | Trade-off |
|------------------------|-----------|-----------|
| Sensitive data, capable on-device NPU | On device, small model | Data stays on the device; lowest capability |
| Short and latency-critical | Edge region, small fast model | Shortest round trip; limited context and reasoning |
| Needs extended reasoning | Cloud, frontier model, higher effort | Highest capability; highest cost and latency |
| Everything else | Cloud, mid-tier model, moderate effort | Default balance |

The trilemma is **latency-privacy-cost**: device wins on privacy and latency but loses on capability; cloud wins on capability but loses on per-request cost and round-trip latency. The router enforces the policy, and each placement serves a different model — evaluate every option on the task before it receives traffic (Factor 6).

### Inference-Engine Selection as an Architectural Decision

For self-hosted inference, the **inference engine** choice has compounding effects on throughput, cost, and operational complexity. The 2026 landscape:

| Engine | Strength | Notable techniques |
|--------|----------|---------------------|
| **vLLM** | Mature general-purpose serving | PagedAttention, continuous batching, prefix caching, speculative decoding |
| **TensorRT-LLM** | Maximum NVIDIA GPU throughput | NVFP4 (Blackwell), fused MoE kernels, custom CUDA |
| **TGI** (HuggingFace) | *Maintenance mode since Dec 2025* — Hugging Face now recommends vLLM or SGLang | Plan a migration for existing deployments; don't start new ones |
| **SGLang** | Programmable serving with structured outputs | Constrained decoding, control flow in serving |

The compounding effect comes from stacking optimizations:

- **Speculative decoding** (e.g., EAGLE-3 reporting ~6.5× speedup) — a small draft model proposes tokens, the target model verifies in parallel
- **NVFP4 / FP4 quantization** on Blackwell — roughly 2–4× the throughput of FP16 with minimal quality loss for many models
- **Continuous batching with chunked prefill** — table stakes
- **KV-cache offload** to CPU/SSD for long-context workloads
- **Fused MoE kernels** for sparse-expert models

These choices belong at architectural decision time, not as runtime tuning. Pin the engine version, measure tokens-per-second-per-watt and tokens-per-second-per-dollar, and make the choice explicit in the release manifest (Factor 5).

### Distributed Inference: Disaggregation and KV-Aware Routing

Above a handful of replicas, the engine is no longer the whole story — the *routing and serving topology* is. Two 2026 patterns have moved into the mainstream Kubernetes stack:

- **Prefill/decode disaggregation**: prompt processing (prefill) is compute-bound and bursty; token generation (decode) is memory-bandwidth-bound and steady. Running them on separate pools, with the KV cache transferred between them, lets each scale on its own signal and stops long prompts from stalling everyone else's token stream.
- **KV-cache-aware routing**: the router sends each request to the replica that already holds its prefix in cache (see Factor 12), weighed against queue depth and load — instead of round-robin, which throws prefix-cache hits away.

| Building block | Role |
|----------------|------|
| **Gateway API Inference Extension** (Kubernetes SIG Network) | Model-aware routing on standard Gateway API: an `InferencePool` groups model-server pods, and an endpoint picker chooses the replica per request |
| **llm-d** (CNCF Sandbox) | Kubernetes-native distributed serving on vLLM + the Inference Extension: prefix-cache-aware scheduling, prefill/decode disaggregation, multi-accelerator support |
| **NVIDIA Dynamo** | Distributed serving framework with disaggregation and KV-cache transfer, aimed at large NVIDIA deployments |

Adopt these when a single engine replica can no longer hold your traffic or when long-context workloads dominate; below that scale, a well-tuned engine behind a plain load balancer is simpler and usually enough.

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
- [ ] AI provider rate limits (requests and tokens per time window) are enforced by a rate limiter shared across replicas and separate from concurrency caps, with bounded queues and retries that honor Retry-After
- [ ] Cost budgets are enforced as scaling constraints — circuit breakers aligned with Factor 20 budget hierarchy
- [ ] Auto-scaling signals include AI-specific metrics (queue depth, token throughput, cost rate)
- [ ] Interactive and batch workloads use different scaling strategies
- [ ] Multi-provider routing balances load across providers based on capacity and cost, and routes only to targets evaluated for the task
- [ ] Batch processing is used for throughput-oriented workloads
- [ ] Scale-down respects graceful shutdown (Factor 9) with drain timeouts
- [ ] Scaling decisions and cost impact are observable (Factor 15)
- [ ] Thinking-token budgets are configured per route (adaptive thinking + effort levels low/medium/high/xhigh/max) and rate-limited separately from output tokens
- [ ] Inference placement (edge/NPU vs GPU vs cloud) is a routing decision, not hardcoded
- [ ] Inference-engine choice (vLLM / SGLang / TensorRT-LLM) is pinned per release and measured in tokens/sec/dollar and tokens/sec/watt; deployments on maintenance-mode engines (e.g., TGI) have a migration plan
- [ ] Multi-replica self-hosted inference uses KV-cache-aware routing (e.g., Gateway API Inference Extension, llm-d) rather than round-robin, and prefill/decode disaggregation is evaluated for long-context workloads
- [ ] Inference optimizations (speculative decoding, FP4/INT4 quantization, continuous batching, PagedAttention) are evaluated as architectural levers, not runtime knobs
- [ ] Spot/preemptible GPU usage is tested for graceful drain and recovery (cross-ref Factor 9, Factor 13)
