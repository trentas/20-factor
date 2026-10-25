---
layout: page
importance: 12
category: "Tier 3: Operation"
title: "12. Stateless Processes with Intelligent Caching"
nav_order: 4
description: "Stateless workers with semantic, embedding, and provider prompt caching for AI operations."
---

# Factor 12: Stateless Processes with Intelligent Caching

> Execute the application as stateless processes that share nothing — and use semantic caching, embedding caching, and context caching to manage the cost and latency of AI operations. Durable, long-running agent execution state lives in Factor 13 (Durable Agent Runtime), not here.

## Motivation

The original factor mandated stateless, share-nothing processes. Any data that needs to persist is stored in a backing service (database, cache, object store). This enables horizontal scaling, fault tolerance, and simple deployment. Processes can be started, stopped, or moved without data loss.

AI applications challenge this principle not by invalidating it, but by making caching dramatically more important. LLM inference is expensive (dollars per million tokens) and slow (seconds per request). Without intelligent caching, every semantically identical request incurs full cost and latency. Caching in AI systems goes beyond exact-match key-value caching — it includes semantic caching (similar but not identical queries), embedding caching (avoid re-computing vectors for unchanged content), and context caching (reuse expensive prompt preambles).

## What This Replaces

**Original Factor #6 / Beyond 15 #12: Stateless Processes** — "Execute the app as one or more stateless processes."

This update retains the stateless process requirement and adds intelligent caching strategies specific to AI workloads:

- Semantic caching for LLM responses
- Embedding caching for vector operations
- Context/prefix caching for repeated prompt preambles
- KV cache management for model serving
- Conversation state externalization

## How AI Changes This

> **Scope vs. Factor 13**: This factor covers (a) **stateless workers** (no in-process state survives a restart) and (b) **caching** (semantic, embedding, prefix/prompt cache, KV cache). It does **not** cover long-running agent execution state — multi-step plans, journaled tool calls, human-approval pauses across hours/days. Those belong to Factor 13 (Durable Agent Runtime). The two factors are complementary: workers are stateless; agent workflows are durable.

### AI-Assisted Development
- AI coding assistants maintain conversation context — but this state lives in the tool (or the AI provider's session), not in the application process. The principle of stateless processes still applies.

### AI-Native Applications
- **Semantic caching**: Two users asking "What's the refund policy?" and "How do I get a refund?" should potentially hit the same cached response. This requires similarity-based cache lookup, not exact-match.
- **Embedding caching**: Computing embeddings for a document is deterministic for a given model version. Cache embeddings keyed on `(content_hash, model_version)` to avoid recomputation.
- **Context caching**: Many LLM providers support prefix caching — if the first N tokens of a request match a previous request, computation is reused. Design prompts with stable prefixes to maximize cache hits.
- **Conversation state**: Chat history is state, but it belongs in a backing service (database, Redis), not in the process. This enables any process instance to handle any request in a conversation.

## In Practice

### Stateless Process Design

A request handler keeps nothing between requests. Everything it needs arrives with the request or is loaded from a backing service (Factor 10), and everything that must outlive the request is written back before it returns:

- **Inject dependencies; don't hold request state.** The model client, cache, and vector store are backing services wired in at startup; nothing specific to one request or conversation stays on the handler.
- **Load, act, persist.** Load conversation state by conversation ID, process the request, and save the updated state, so the next turn can land on any instance.
- **Check the cache before calling the model, store after.** Every lookup and write carries the request's cache scope — tenant plus data permissions (see below).
- **Move long-running work off the request path.** Multi-step agent runs and approval pauses belong in a durable runtime (Factor 13), not in a handler that keeps them in memory.

### Semantic Caching

> Semantic caching integrates naturally with RAG pipelines (Factor 17). Cache lookups happen before the retrieval stage — if a semantically similar query was recently answered with the same context, skip the full pipeline.

A semantic cache is a vector index of past queries that points to stored responses. Similarity decides *which* entry matches; exact filters decide *which entries are eligible at all*:

| Part of the entry | Matched how | Why |
|-------------------|-------------|-----|
| Query embedding | Similarity above a tuned threshold | Paraphrases of the same question reach the same answer |
| Tenant and data-permission scope | Exact filter | An answer built from data one caller may see must never reach another |
| Context digest (retrieved document IDs and versions, prompt version) | Exact filter | The same question over different context is a different answer |
| Model version | Exact filter | A model change retires the old model's answers (see Cache Invalidation) |
| Source documents, producing request, creation time | Stored, not matched | Lets content changes, revocations, and poisoned entries be traced and purged |

Rules for the mechanism:

- **Build keys from stable digests.** Python's built-in `hash()` of a string is salted per process, so two replicas compute different values for the same context and never share entries. Use a cryptographic digest over a canonical serialization (see Embedding Caching).
- **Tune the threshold per route.** It is a quality parameter, not a constant: set it by measuring false hits in the eval suite (Factor 6), and re-measure whenever the embedding model changes.
- **Expire the index entry and the stored response together.** A vector whose response has expired is a miss; an orphaned vector must not keep matching.

**Scope the cache, or it becomes a leak and an attack surface.** A semantic cache serves an answer that was generated for someone else, which brings two failure modes:

- **Cross-tenant and cross-permission leakage**: a response generated from tenant A's documents, or from data only an admin may see, is served to tenant B or a less-privileged user whose question happens to be similar. Key every entry by tenant *and* by the permission scope of the data that produced it, and bypass the cache for personalized answers.
- **Cache poisoning**: an attacker elicits a manipulated answer once — for example through prompt injection in retrieved content — and the cache then serves it to every user whose query lands nearby in embedding space. Similarity thresholds are not a security boundary. Cache only responses that passed output guardrails (Factor 7), never cache responses built from untrusted tool output or web content, keep *shared* caches to vetted, FAQ-style content, and record which request produced each entry so a poisoned one can be traced and purged (OWASP LLM08, ASI06).

### Embedding Caching

Embeddings are deterministic for a given model and input, so recomputing them for unchanged content is pure waste. The cache key must identify everything that changes the vector: a digest of the content, the embedding model and its version, and any preprocessing that alters the input or output (normalization, chunking, output dimensions). Look up a whole batch at once, embed only the misses, and write them back.

The key must also be stable across processes and restarts:

```python
# WRONG — str hash() is salted per process: every replica builds different keys
key = f"emb:{model_version}:{hash(text)}"

# RIGHT — a stable digest over a defined encoding
key = f"emb:{model_version}:{hashlib.sha256(text.encode('utf-8')).hexdigest()}"
```

When a key is derived from a sensitive identifier (an email address, an account number), use an HMAC with a managed secret instead of a plain digest, so the identifier cannot be recovered by hashing guesses. And a stable hash is not anonymization: the cache still holds the content or values derived from it, which follow the same retention and erasure rules as their source (Factor 7, Factor 19).

Further reading: Python, [Data model — `object.__hash__`](https://docs.python.org/3/reference/datamodel.html#object.__hash__) (hash randomization); Python, [`hmac`](https://docs.python.org/3/library/hmac.html).

### Provider-Level Prompt Caching

Major LLM providers (Anthropic, OpenAI, Google) now offer **native prompt caching** as a first-class feature. When the prefix of a request matches a previously cached prefix, the provider reuses cached computation — reducing input token costs by up to 90–95% and latency by up to 85%. This is one of the highest-leverage cost optimizations available.

Some providers cache eligible prefixes automatically; others require an explicit cache marker on the blocks to reuse. Either way, responses report cache writes and cache reads separately in their usage data: reads are billed at a fraction of the normal input price, and some providers charge a premium on writes. Track both per route — a hit rate that falls after a deploy usually means something now varies inside the prefix.

**Design patterns that maximize provider cache hit rates:**
- **Stable prefix, variable suffix**: Put system prompts, knowledge bases, and few-shot examples *before* the variable user content. The prefix must match byte-for-byte.
- **Order matters**: Rearranging content invalidates the cache. Keep the order of system prompt sections consistent across requests.
- **Minimum cacheable length**: Providers require a minimum prefix to activate caching, and it varies by model — for Anthropic it ranges from 512 tokens on the newest models to 4096 on some older ones, and it is not monotonic across generations. Below the threshold, caching silently no-ops, so re-check it whenever you change the pinned model.
- **Cache lifetime**: Provider caches are ephemeral — a default 5-minute TTL, with a 1-hour TTL available (at a higher write cost) for bursty or low-traffic endpoints. High-traffic endpoints benefit most.
- **Multi-turn conversations**: In chat applications, the conversation history grows but the system prompt prefix stays the same — naturally benefiting from prefix caching.
- **Deterministic tool lists**: Tool definitions render at the very start of the prompt, so a tool list whose order changes between requests invalidates everything after it. The MCP 2026-07-28 revision asks servers to return `tools/list` in deterministic order for exactly this reason; sort tool definitions in your own harness as well.
- **Append-only history**: Change the conversation only by appending. Editing or deleting an earlier turn invalidates the cache from that point on — and on newer reasoning models it can also invalidate preserved reasoning state. When history must shrink, compact it at a deliberate checkpoint (Factor 17) instead of trimming a little on every turn.

This is distinct from the application-level semantic caching above. Provider-level caching is exact-match and provider-managed. Semantic caching is application-level, similarity-based, and manages LLM *responses*. Use both for maximum cost reduction.

### Prompt Prefix Design for Caching

Order every request from most to least stable, so the cacheable prefix is as long as possible:

```
┌─ Stable prefix — cached ─────────────────────────────┐
│ tool definitions (deterministic order)               │
│ system prompt, safety instructions                   │
│ knowledge base, few-shot examples (stable per task)  │
├─ Grows by appending — cached up to the last turn ────┤
│ conversation history                                 │
├─ Variable suffix — never cached ─────────────────────┤
│ current user message, per-request retrieved context  │
│ anything with timestamps or request IDs              │
└──────────────────────────────────────────────────────┘
```

Monitor the share of input tokens served from cache and the savings per route, and alert when a route's hit rate falls below its own baseline; check prefix stability first.

### Conversation State Externalization

Conversation state lives in a backing service, keyed by conversation ID, so any instance can serve any turn:

- **Append atomically.** Two requests for the same conversation can arrive at once (a retry, a second browser tab). Use an append operation or a version check on save; a plain load-modify-save silently drops one of the turns.
- **Never rewrite earlier turns.** History changes only by appending. When it exceeds its budget, compact it at a checkpoint (one deliberate cache break) instead of trimming on every turn, which breaks prefix caching each time (Factor 17).
- **Let retention follow the content, not the store.** A TTL bounds how long idle conversations are kept, but conversations often contain personal data: their retention, access, and erasure follow the same policy as any other personal data, including the summaries and cache entries derived from them (Factor 7, Factor 19).

### PagedAttention and Prefix Tree KV Cache (Self-Hosted Inference)

For self-hosted model serving, the KV (key-value) cache is the primary performance and cost lever. vLLM's **PagedAttention** manages KV cache entries as fixed-size memory pages — eliminating fragmentation and dramatically improving GPU memory utilization compared to contiguous allocation. The **prefix tree** (radix tree / block prefix sharing) extends PagedAttention to share identical prefix blocks across concurrent requests, achieving de-facto provider-level prefix caching for self-hosted engines.

The engine settings that matter most (names vary by engine):

| Setting | What it controls | Trade-off |
|---------|------------------|-----------|
| GPU memory fraction | Share of VRAM the engine claims for weights, activations, and KV-cache pages | More KV pages mean more concurrent sequences, but less headroom for spikes |
| Prefix caching | Sharing identical prefix blocks across requests | Large win for long shared prompts; confirm it is on for your engine version |
| Maximum concurrent sequences | Batch width per replica | Throughput versus per-request latency |
| CPU offload / swap space | Where KV pages go when VRAM is full | Extends capacity at the cost of latency |
| Block (page) size | Tokens per KV page | Granularity of sharing versus bookkeeping overhead |

Further reading: vLLM, [Automatic Prefix Caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html).

When long system prompts or shared knowledge bases are prepended to every request, prefix caching can eliminate 80–90% of redundant prefill computation — the same economics as provider-side prompt caching but at the inference-engine level.

At cluster scale the same idea moves into the router: **llm-d** (a CNCF Sandbox project built on vLLM) and the Kubernetes **Gateway API Inference Extension** route each request to the replica most likely to already hold its prefix in KV cache, instead of round-robin — a single replica's prefix cache is worth little if the load balancer scatters a conversation across the pool. See Factor 14 for disaggregated serving.

### Speculative Decoding

Speculative decoding uses a small "draft" model to propose token sequences that the larger "target" model verifies in parallel. Because verification is cheaper than generation, this yields 2–6× throughput improvement for output-heavy workloads at no quality cost. EAGLE-3 achieves ~6.5× speedup in benchmark conditions.

Requirements:
- Draft and target models must share the same vocabulary/tokenizer
- Quality is identical to standard decoding (acceptance sampling guarantees this mathematically)
- Most benefit on long-output tasks (code generation, document summarization); minimal benefit on short-output tasks (classification)

Speculative decoding is built into vLLM, SGLang, and TensorRT-LLM as a runtime toggle — evaluate it as an architecture optimization per task type (Factor 14), not a global configuration.

### Multi-Region Cache Replication

For globally distributed applications, caches that are region-local reduce cross-region latency but risk inconsistency when the same semantic query hits different regions:

- **Write-through replication**: cache writes propagate to all regions immediately — consistent reads at higher write cost; suitable for infrequently written, globally shared caches (e.g., FAQ responses)
- **Regional caches with cross-region fallback**: each region has its own cache; on a miss, the request falls through to the origin — acceptable for read-heavy workloads where staleness is tolerable
- **Consistent hashing with regional preference**: route cache reads/writes to the same region by key, minimizing cross-region traffic while containing inconsistency to intra-key scope

Cache replication strategy must align with the data residency requirements of the underlying content (Factor 11): cached LLM responses containing user-specific PII must not replicate across regions that violate data residency rules.

### Cache Invalidation
AI caches need careful invalidation strategies:

- **Time-based TTL**: LLM responses may become stale as the world changes. Set appropriate TTLs.
- **Content-based invalidation**: When source documents change, invalidate cached responses that were generated from those documents.
- **Model-based invalidation**: When the model version changes, cached responses from the old model should be invalidated.
- **Feedback-based invalidation**: When a user marks a cached response as unhelpful, remove it from the cache.
- **Protocol cache hints**: MCP list and read results carry `ttlMs` (freshness) and `cacheScope` (`public` may be cached by shared intermediaries such as a gateway; `private` only by the requesting client). Honor them — a tool list that varies by the caller's authorization must not be served from a shared cache to another caller.
- **Permission-based invalidation**: When a user loses access or a document's permissions change, entries derived from that content must stop reaching callers who no longer qualify. Scope entries by permission and purge them by source document (see Semantic Caching).
- **Erasure reaches derived entries**: When source data is deleted for privacy reasons, delete the cached responses, embeddings, and summaries derived from it as well; don't rely on a TTL alone to honor an erasure request (Factor 19).

## Compliance Checklist

- [ ] Application processes are stateless — no in-process state survives a restart
- [ ] Conversation history and session data are stored in backing services
- [ ] Semantic caching reduces redundant LLM calls for similar queries
- [ ] Semantic cache entries are scoped by tenant and data-permission scope; only guardrail-passed responses built from trusted content are cached, and every entry can be traced and purged
- [ ] Embedding caching avoids recomputation of embeddings for unchanged content
- [ ] Provider-level prompt caching is enabled and prompts are structured for maximum cache hit rates (stable prefix, variable suffix)
- [ ] Prompt caching metrics (hit rate, cost savings) are monitored
- [ ] Conversation history is append-only between deliberate compaction points, and tool definitions are serialized in deterministic order
- [ ] Cached MCP discovery results honor the server's `ttlMs` and `cacheScope` hints
- [ ] Cache invalidation strategies account for time, content changes, and model updates
- [ ] Cache hit rates and cost savings are monitored (Factor 15)
- [ ] Any process instance can handle any request — no sticky sessions required
- [ ] KV cache management is configured for self-hosted model serving
- [ ] Cache storage itself is a backing service (Factor 10), not local process memory
- [ ] Self-hosted inference engines have PagedAttention and prefix-tree KV caching configured; GPU memory utilization and prefix cache hit rate are monitored
- [ ] Speculative decoding is evaluated for output-heavy task types and enabled where it improves throughput without quality loss
- [ ] Multi-region cache replication strategy is defined (write-through vs. regional with fallback) and respects data residency constraints
