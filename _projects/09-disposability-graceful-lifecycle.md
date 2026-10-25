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
- **Disposable tool servers**: Since the MCP 2026-07-28 revision removed protocol-level sessions, remote MCP servers can be ordinary disposable processes behind a load balancer — any replica serves any request. The flip side: a dropped stream loses the in-flight request and the client must re-issue it, so side-effecting tools need idempotency keys (Factor 13), and a server shutting down should finish or explicitly fail in-flight calls rather than cut the stream.
- **Agent sandboxes**: per-session code-execution sandboxes (Factor 8) are disposable by design — created per task, destroyed afterwards. Their startup latency is the new cold-start problem; pre-warmed sandbox pools are the equivalent of model preloading.

## In Practice

### Startup Sequence

Split startup into phases, so the platform always knows whether the process is alive, still loading, or ready to serve:

| Phase | What happens | Probe state |
|-------|--------------|-------------|
| 1. Process up | The health endpoint answers immediately | Liveness passes; readiness fails |
| 2. Dependencies | Load configuration and connect to backing services (Factor 4, Factor 10); fail fast on missing or invalid configuration | Not ready |
| 3. Model load | Load weights into GPU memory — the slow phase; log load time and memory used | Not ready; the startup probe protects it |
| 4. Warm-up | Run a representative inference to trigger compilation and allocate caches before real traffic arrives | Not ready |
| 5. Serving | The instance accepts traffic | Readiness passes |

### Health Check Patterns

Each probe answers a different question, and conflating them causes restart loops:

| Probe | Question | Passes when | AI-specific rule |
|-------|----------|-------------|------------------|
| **Liveness** | Is the process alive? | As soon as the HTTP server starts | Never depends on the model being loaded or a provider being reachable — otherwise a slow load or a provider outage restarts every replica |
| **Readiness** | Should this instance receive traffic now? | After model load and warm-up | Fails again as soon as shutdown begins, so the load balancer stops routing new requests |
| **Startup** | Is a slow start still in progress? | Typically the readiness check | Its budget (failure threshold × period) must exceed the worst-case model load time — for example, 30 failures × 10 s allows 5 minutes |

Further reading: Kubernetes, [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/).

### Graceful Shutdown

On SIGTERM, shut down in this order:

1. **Stop accepting new work.** Fail readiness and deregister from the load balancer.
2. **Drain in-flight requests within a bounded timeout.** Streaming responses end with an explicit completion or error event rather than a cut connection, so clients can tell a deliberate end from a failure. When the timeout expires, cancel what remains and return a retryable error.
3. **Unload models through the serving engine's supported path.** Use the inference server's documented shutdown or unload mechanism, then let the process exit. `torch.cuda.empty_cache()` is not a release mechanism: it returns PyTorch's cached, unused blocks to the driver, does not free memory still held by live tensors, and does nothing for engines that manage GPU memory themselves.
4. **Close connections and flush telemetry**, so the last logs and spans of the drained requests are not lost (Factor 15).
5. **Finish inside the platform's grace period.** Drain timeout plus unload time must be shorter than the termination grace period (Kubernetes `terminationGracePeriodSeconds`); otherwise the process is killed mid-drain.

Before the node or GPU takes new work, verify that the old process has exited and its device memory is free.

Further reading: Kubernetes, [Pod termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination); PyTorch, [CUDA semantics — memory management](https://docs.pytorch.org/docs/main/notes/cuda.html).

### Preloading and Caching Strategies
Mitigate slow model loading:

- **Persistent model cache**: Store loaded models on fast local storage (NVMe) so subsequent startups load from cache, not from remote storage.
- **Model preloading**: In environments with predictable scaling patterns, preload models on standby instances before they receive traffic.
- **Shared GPU memory**: In multi-process setups, share model weights across processes using memory-mapped files.
- **Warm pools for agent sandboxes**: Keep a small pool of pre-started, unassigned sandboxes (gVisor or microVM) so an agent session doesn't pay the boot cost; assign one per session and never return a used sandbox to the pool.
- **Quantization**: Use quantized models (FP8, INT8, FP4/NVFP4, INT4) for faster loading and lower memory footprint, trading some accuracy for operational agility. On current Hopper/Blackwell GPUs, FP8 and FP4/MXFP4 are the relevant formats.

### Kubernetes GPU Node Cordoning and Draining

GPU nodes require careful handling before maintenance or scale-down:

- **Cordon first**, so no new pods schedule onto the node.
- **Drain with a grace period** at least as long as the worst-case request drain, so each pod's SIGTERM handler can stop accepting traffic, drain, unload, and exit.
- **Protect capacity with a `PodDisruptionBudget`** (for example, `minAvailable: 1` for the inference deployment), so a drain never takes down the last serving replica.
- **Verify the GPU is free before the next pod schedules.** vLLM and other inference servers manage their weights and KV cache themselves; shut them down through their own path rather than relying on a framework cache call. Stranded GPU memory on a partially drained node blocks the next scheduled pod from starting.

### Spot and Preemptible GPU Instances

GPU spot instances (AWS EC2 Spot, GCP Spot/Preemptible, Azure Spot) cost 60–90% less than on-demand but can be reclaimed with 30-second to 2-minute notice. Prepare for preemption:

- Register a SIGTERM handler that immediately stops accepting requests, drains in-flight inference, and saves checkpoint state before exit
- Pair with Factor 13 (Durable Agent Runtime) for multi-step workflows that span preemption events — the workflow resumes on a new node from the last durable checkpoint
- Use Kubernetes `priorityClass` to ensure inference pods are evicted before lower-priority batch pods when the node is reclaimed
- Test preemption handling in CI by injecting SIGTERM mid-inference and verifying graceful recovery

### CRIU for Warm Model Pools

[CRIU (Checkpoint/Restore in Userspace)](https://criu.org) captures the full process memory state — including loaded model weights — to disk. (Vanilla CRIU does not checkpoint GPU/CUDA device state; capturing GPU memory additionally requires NVIDIA's `cuda-checkpoint` tool and the CRIU CUDA plugin.) Restoring from a CRIU checkpoint is orders of magnitude faster than cold model loading, enabling fast horizontal scaling and burst-warm instances without the GPU memory loading penalty.

This is particularly valuable for models with long load times (30B+ parameter models) where cold-start latency violates readiness SLOs. The CRIU checkpoint is itself a versioned artifact stored in object storage (Factor 10) and invalidated when the model version changes.

### Crash Recovery

A process can die at any point, so a retried request must be safe to run again:

- **Carry an idempotency key from the caller**, stable across retries of the same request.
- **Deduplicate where the effect happens.** A result cache written *after* the work does not make it idempotent: a process that dies after the side effect and before writing the cache repeats the effect on retry. Deduplicate at the destination (many payment and messaging APIs accept an idempotency key), or record the key in the same transaction as the effect (Factor 13).
- **Know what a retry repeats.** Retrying a model call with no side effects only costs tokens; retrying a tool call that sends, pays, or writes needs the deduplication above.

## Compliance Checklist

- [ ] Processes have structured startup sequences with distinct liveness and readiness phases
- [ ] Kubernetes (or equivalent) health checks distinguish between liveness, readiness, and startup probes
- [ ] Startup probes allow sufficient time for model loading without being killed prematurely
- [ ] Graceful shutdown drains in-flight requests before terminating
- [ ] Shutdown unloads models through the serving engine's supported path, and GPU memory is verified free before the node takes new work
- [ ] Drain timeouts are configured and handle the case where requests cannot complete in time
- [ ] Streaming responses send proper completion signals during shutdown
- [ ] Model loading is optimized through caching, preloading, or quantization
- [ ] Request handling is idempotent to support crash recovery
- [ ] SIGTERM handlers are registered and tested
- [ ] Kubernetes PodDisruptionBudgets protect inference pods during node drain; GPU memory is verified released before the next pod schedules
- [ ] Spot/preemptible GPU instance handling is tested: SIGTERM mid-inference triggers graceful drain and checkpoint before exit
- [ ] CRIU checkpoint-restore is evaluated for model-serving pods with startup times exceeding readiness SLO targets
- [ ] Remote MCP servers run as stateless, load-balanced replicas that finish or explicitly fail in-flight calls on shutdown
- [ ] Agent sandboxes are single-use per session, with a pre-warmed pool sized to hide startup latency
