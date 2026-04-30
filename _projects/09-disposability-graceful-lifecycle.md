---
layout: page
importance: 9
category: "Tier 3: Operation"
title: "09. Disposability and Graceful Lifecycle"
nav_order: 1
description: "Fast startup, graceful shutdown — with GPU release and LLM request draining."
---

# Factor 9: Disposability and Graceful Lifecycle

> Processes start fast, shut down gracefully, and handle interruptions cleanly — including GPU resource release, model unloading, and LLM request draining.

## Motivation

The original disposability factor emphasized fast startup and graceful shutdown. Processes should be disposable — started or stopped at a moment's notice. This enables elastic scaling, rapid deployment, and robust fault recovery. The principle remains critical, but AI workloads introduce new lifecycle challenges.

AI processes are often heavyweight. Loading a model into GPU memory can take minutes. Inference requests can run for seconds (or minutes for complex chains). GPU resources are expensive and scarce — a process that fails to release GPU memory on shutdown wastes resources that other processes need. The tension between disposability (start/stop quickly) and AI resource management (models are slow to load, requests are slow to complete) requires new patterns.

## What This Replaces

**Original Factor #9 / Beyond 15 #7: Disposability** — "Maximize robustness with fast startup and graceful shutdown."

This update retains the core principle and extends it for AI workloads:

- Model loading and warm-up during startup
- GPU memory allocation and release during lifecycle transitions
- Long-running LLM request draining during shutdown
- Checkpoint and resume for interrupted inference
- Health check patterns for model-serving processes

## How AI Changes This

### AI-Assisted Development
- Development environments with local model serving need clean startup/shutdown to avoid GPU memory leaks during rapid iteration.
- AI-powered development tools should start quickly and not block developer workflow with model loading times.

### AI-Native Applications
- **Model loading startup**: Loading a 7B parameter model into GPU memory takes 10-30 seconds. Loading a 70B model can take minutes. This fundamentally changes startup time expectations.
- **GPU resource management**: GPU memory must be explicitly managed. A process that crashes without releasing GPU memory can leave resources stranded until the GPU is reset.
- **Request draining**: LLM inference requests can take 5-30+ seconds (especially with streaming). Graceful shutdown must drain in-flight requests, not drop them.
- **Warm-up probes**: A process with a loaded model needs distinct health checks: readiness (model loaded, ready to serve) vs. liveness (process is alive but may still be loading).

## In Practice

### Startup Sequence
Implement a structured startup that separates phases:

```python
class AIServiceLifecycle:
    async def startup(self):
        # Phase 1: Fast startup — accept health checks immediately
        self.health = HealthStatus.STARTING
        self.start_liveness_server()  # Kubernetes liveness probe passes

        # Phase 2: Load dependencies
        await self.load_configuration()
        await self.connect_to_backing_services()

        # Phase 3: Load model (slow)
        self.logger.info("Loading model into GPU memory...")
        self.model = await self.model_loader.load(
            model_id=self.config.model_id,
            device=self.config.gpu_device,
            quantization=self.config.quantization,
        )
        self.logger.info(f"Model loaded in {elapsed}s, GPU memory: {gpu_mem_used}MB")

        # Phase 4: Warm-up (optional but recommended)
        await self.warm_up_model()  # Run a dummy inference to JIT compile

        # Phase 5: Ready to serve
        self.health = HealthStatus.READY  # Kubernetes readiness probe passes
        self.logger.info("Service ready to accept traffic")
```

### Health Check Patterns

```yaml
# kubernetes deployment
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  # "Is the process alive?" — passes as soon as the HTTP server starts

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 30        # Give time for model loading
  periodSeconds: 5
  # "Is the model loaded and ready to serve?" — only passes after warm-up

startupProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 30           # Allow up to 5 minutes for model loading
  # Protects slow-starting containers from being killed during model load
```

### Graceful Shutdown

```python
async def shutdown(self, signal):
    self.logger.info(f"Received {signal}, initiating graceful shutdown")

    # Phase 1: Stop accepting new requests
    self.health = HealthStatus.DRAINING
    await self.deregister_from_load_balancer()

    # Phase 2: Drain in-flight requests
    self.logger.info(f"Draining {len(self.active_requests)} in-flight requests")
    try:
        await asyncio.wait_for(
            self.drain_active_requests(),
            timeout=self.config.drain_timeout_seconds  # e.g., 60 seconds
        )
    except asyncio.TimeoutError:
        self.logger.warning(f"Drain timeout — {len(self.active_requests)} requests will be interrupted")
        await self.cancel_remaining_requests()

    # Phase 3: Release GPU resources
    self.logger.info("Unloading model and releasing GPU memory")
    await self.model_loader.unload(self.model)
    torch.cuda.empty_cache()  # Explicitly free GPU memory

    # Phase 4: Close connections
    await self.close_backing_service_connections()

    self.logger.info("Shutdown complete")
```

### Request Draining Strategies

```python
async def drain_active_requests(self):
    """Wait for all in-flight requests to complete."""
    # For streaming responses, signal clients to expect end-of-stream
    for request in self.active_requests:
        if request.is_streaming:
            # Send a completion signal so clients know the stream ended intentionally
            await request.send_completion_event()

    # Wait for all requests to finish
    await asyncio.gather(*[r.completion_future for r in self.active_requests])
```

### Preloading and Caching Strategies
Mitigate slow model loading:

- **Persistent model cache**: Store loaded models on fast local storage (NVMe) so subsequent startups load from cache, not from remote storage.
- **Model preloading**: In environments with predictable scaling patterns, preload models on standby instances before they receive traffic.
- **Shared GPU memory**: In multi-process setups, share model weights across processes using memory-mapped files.
- **Quantization**: Use quantized models (INT8, INT4) for faster loading and lower memory footprint, trading some accuracy for operational agility.

### Kubernetes GPU Node Cordoning and Draining

GPU nodes require careful handling before maintenance or scale-down. Cordon the node first to prevent new pods from scheduling, then use a `PodDisruptionBudget` to guarantee minimum availability during draining.

```yaml
# PodDisruptionBudget — always keep at least 1 inference pod running during drain
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: inference-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: inference-server
```

```bash
# Safe drain sequence for a GPU node
kubectl cordon <gpu-node>                         # stop new pods scheduling
kubectl drain <gpu-node> --grace-period=120       # wait 120s for in-flight requests
# Pod SIGTERM handler should: stop accepting traffic, drain requests, release GPU, exit
```

For vLLM and other inference servers, the shutdown hook must flush the KV cache and release GPU memory via `torch.cuda.empty_cache()` before process exit — stranded GPU memory on a partially drained node blocks the next scheduled pod from starting.

### Spot and Preemptible GPU Instances

GPU spot instances (AWS EC2 Spot, GCP Spot/Preemptible, Azure Spot) cost 60–90% less than on-demand but can be reclaimed with 30-second to 2-minute notice. Prepare for preemption:

- Register a SIGTERM handler that immediately stops accepting requests, drains in-flight inference, and saves checkpoint state before exit
- Pair with Factor 13 (Durable Agent Runtime) for multi-step workflows that span preemption events — the workflow resumes on a new node from the last durable checkpoint
- Use Kubernetes `priorityClass` to ensure inference pods are evicted before lower-priority batch pods when the node is reclaimed
- Test preemption handling in CI by injecting SIGTERM mid-inference and verifying graceful recovery

### CRIU for Warm Model Pools

[CRIU (Checkpoint/Restore in Userspace)](https://criu.org) captures the full process memory state — including loaded model weights and GPU allocations — to disk. Restoring from a CRIU checkpoint is orders of magnitude faster than cold model loading, enabling fast horizontal scaling and burst-warm instances without the GPU memory loading penalty.

This is particularly valuable for models with long load times (30B+ parameter models) where cold-start latency violates readiness SLOs. The CRIU checkpoint is itself a versioned artifact stored in object storage (Factor 10) and invalidated when the model version changes.

### Crash Recovery

```python
# Implement idempotent request handling for crash recovery
class RequestHandler:
    async def handle(self, request):
        # Check if this request was already processed (idempotency key)
        if cached_result := await self.cache.get(request.idempotency_key):
            return cached_result

        # Process the request
        result = await self.process(request)

        # Cache the result for crash recovery
        await self.cache.set(request.idempotency_key, result, ttl=3600)
        return result
```

## Compliance Checklist

- [ ] Processes have structured startup sequences with distinct liveness and readiness phases
- [ ] Kubernetes (or equivalent) health checks distinguish between liveness, readiness, and startup probes
- [ ] Startup probes allow sufficient time for model loading without being killed prematurely
- [ ] Graceful shutdown drains in-flight requests before terminating
- [ ] Shutdown explicitly releases GPU memory and unloads models
- [ ] Drain timeouts are configured and handle the case where requests cannot complete in time
- [ ] Streaming responses send proper completion signals during shutdown
- [ ] Model loading is optimized through caching, preloading, or quantization
- [ ] Request handling is idempotent to support crash recovery
- [ ] SIGTERM handlers are registered and tested
- [ ] Kubernetes PodDisruptionBudgets protect inference pods during node drain; GPU memory is explicitly released on shutdown
- [ ] Spot/preemptible GPU instance handling is tested: SIGTERM mid-inference triggers graceful drain and checkpoint before exit
- [ ] CRIU checkpoint-restore is evaluated for model-serving pods with startup times exceeding readiness SLO targets
