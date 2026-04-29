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

```python
class AIRequestHandler:
    """Stateless handler — all state is in backing services."""

    def __init__(self, llm: LLMProvider, cache: CacheService, vector_db: VectorStore):
        # Dependencies are injected, not stored in process memory
        self.llm = llm
        self.cache = cache
        self.vector_db = vector_db

    async def handle(self, request: Request) -> Response:
        # Conversation history comes from the request or backing service
        conversation = await self.load_conversation(request.conversation_id)

        # Check semantic cache before calling LLM
        cached = await self.cache.semantic_lookup(request.message, conversation.context)
        if cached and cached.similarity > 0.95:
            return cached.response

        # Process request — no local state
        response = await self.process(request, conversation)

        # Store conversation state in backing service
        await self.save_conversation(request.conversation_id, conversation)

        # Cache the response for future similar queries
        await self.cache.store(request.message, conversation.context, response)

        return response
```

### Semantic Caching

> Semantic caching integrates naturally with RAG pipelines (Factor 17). Cache lookups happen before the retrieval stage — if a semantically similar query was recently answered with the same context, skip the full pipeline.

```python
class SemanticCache:
    """Cache LLM responses using semantic similarity, not exact match."""

    def __init__(self, vector_store: VectorStore, response_store: ResponseStore):
        self.vector_store = vector_store
        self.response_store = response_store

    async def lookup(self, query: str, context: str) -> CacheResult | None:
        # Embed the query
        query_embedding = await self.embed(query)

        # Search for similar cached queries
        results = await self.vector_store.query(
            vector=query_embedding,
            top_k=1,
            filter={"context_hash": hash(context)},  # Same context
            threshold=0.95,  # High similarity required
        )

        if results:
            response = await self.response_store.get(results[0].id)
            return CacheResult(
                response=response,
                similarity=results[0].score,
                cache_hit=True,
            )
        return None

    async def store(self, query: str, context: str, response: str):
        query_embedding = await self.embed(query)
        cache_id = generate_id()

        await self.vector_store.upsert([Vector(
            id=cache_id,
            values=query_embedding,
            metadata={"context_hash": hash(context), "timestamp": now()},
        )])
        await self.response_store.set(cache_id, response, ttl=3600)
```

### Embedding Caching

```python
class EmbeddingCache:
    """Cache embeddings by content hash to avoid recomputation."""

    def __init__(self, cache: KeyValueStore, embedding_service: EmbeddingService):
        self.cache = cache
        self.embedding_service = embedding_service
        self.model_version = embedding_service.model_version

    async def embed(self, texts: list[str]) -> list[list[float]]:
        results = [None] * len(texts)
        uncached_indices = []

        # Check cache for each text
        for i, text in enumerate(texts):
            cache_key = f"emb:{self.model_version}:{hash(text)}"
            cached = await self.cache.get(cache_key)
            if cached:
                results[i] = cached
            else:
                uncached_indices.append(i)

        # Compute only uncached embeddings
        if uncached_indices:
            uncached_texts = [texts[i] for i in uncached_indices]
            new_embeddings = await self.embedding_service.embed(uncached_texts)

            for idx, embedding in zip(uncached_indices, new_embeddings):
                results[idx] = embedding
                cache_key = f"emb:{self.model_version}:{hash(texts[idx])}"
                await self.cache.set(cache_key, embedding)

        return results
```

### Provider-Level Prompt Caching

Major LLM providers (Anthropic, OpenAI, Google) now offer **native prompt caching** as a first-class feature. When the prefix of a request matches a previously cached prefix, the provider reuses cached computation — reducing input token costs by up to 90% and latency by up to 85%. This is one of the highest-leverage cost optimizations available.

```python
# Anthropic prompt caching — mark stable content with cache_control
response = await client.messages.create(
    model="claude-sonnet-4-5-20250929",
    system=[
        {
            "type": "text",
            "text": large_system_prompt,        # ~4000 tokens
            "cache_control": {"type": "ephemeral"}  # cache this block
        },
        {
            "type": "text",
            "text": large_knowledge_base,        # ~10000 tokens
            "cache_control": {"type": "ephemeral"}  # cache this block
        }
    ],
    messages=[
        {"role": "user", "content": user_message}  # variable per request
    ],
)

# Result: first request pays full price + small cache write fee
# Subsequent requests with same prefix: 90% discount on cached tokens
# response.usage.cache_creation_input_tokens → tokens written to cache
# response.usage.cache_read_input_tokens → tokens read from cache (discounted)
```

**Design patterns that maximize provider cache hit rates:**
- **Stable prefix, variable suffix**: Put system prompts, knowledge bases, and few-shot examples *before* the variable user content. The prefix must match byte-for-byte.
- **Order matters**: Rearranging content invalidates the cache. Keep the order of system prompt sections consistent across requests.
- **Minimum cacheable length**: Most providers require a minimum prefix length (e.g., 1024 tokens for Anthropic) to activate caching.
- **Cache lifetime**: Provider caches are ephemeral (typically 5 minutes). High-traffic endpoints benefit most; low-traffic endpoints may see few cache hits.
- **Multi-turn conversations**: In chat applications, the conversation history grows but the system prompt prefix stays the same — naturally benefiting from prefix caching.

```yaml
# prompt-caching-config.yaml
prompt_caching:
  strategy: prefix_stable
  min_cacheable_tokens: 1024

  # Structure: cached sections first, variable sections last
  sections_order:
    - system_prompt          # stable — always cached
    - safety_instructions    # stable — always cached
    - knowledge_base         # stable per session — cached
    - few_shot_examples      # stable per task type — cached
    - conversation_history   # grows per turn — partially cached
    - user_message           # variable — never cached

  monitoring:
    track_cache_hit_rate: true          # % of input tokens served from cache
    track_cost_savings: true            # $ saved vs. uncached requests
    alert_on_low_hit_rate:
      threshold: 0.30                   # alert if <30% cache hits
      action: investigate_prefix_stability
```

This is distinct from the application-level semantic caching above. Provider-level caching is automatic, exact-match, and provider-managed. Semantic caching is application-level, similarity-based, and manages LLM *responses*. Use both for maximum cost reduction.

### Prompt Prefix Design for Caching
Design prompts to maximize provider-side prefix caching:

```python
# Structure prompts so the prefix is stable across requests
system_prompt = """
[STABLE PREFIX — same for all requests, cached by provider]
You are a customer support agent for ExampleCorp.

Company policies:
{large_policy_document}

Product catalog:
{large_product_catalog}

Instructions:
{detailed_instructions}
"""

# Variable part comes AFTER the stable prefix
user_message = f"""
[VARIABLE SUFFIX — unique per request]
Customer: {customer_message}
Context: {conversation_history}
"""
```

### Conversation State Externalization

```python
class ConversationStore:
    """Externalize conversation state to a backing service."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def load(self, conversation_id: str) -> Conversation:
        data = await self.redis.get(f"conv:{conversation_id}")
        if data:
            return Conversation.deserialize(data)
        return Conversation.new()

    async def save(self, conversation_id: str, conversation: Conversation):
        await self.redis.set(
            f"conv:{conversation_id}",
            conversation.serialize(),
            ex=86400,  # 24h TTL
        )

    async def append_turn(self, conversation_id: str, role: str, content: str):
        conversation = await self.load(conversation_id)
        conversation.add_turn(role, content)
        # Trim to fit context window budget
        conversation.trim_to_token_budget(max_history_tokens=4000)
        await self.save(conversation_id, conversation)
```

### PagedAttention and Prefix Tree KV Cache (Self-Hosted Inference)

For self-hosted model serving, the KV (key-value) cache is the primary performance and cost lever. vLLM's **PagedAttention** manages KV cache entries as fixed-size memory pages — eliminating fragmentation and dramatically improving GPU memory utilization compared to contiguous allocation. The **prefix tree** (radix tree / block prefix sharing) extends PagedAttention to share identical prefix blocks across concurrent requests, achieving de-facto provider-level prefix caching for self-hosted engines.

```yaml
# vLLM serving configuration for KV cache optimization
gpu_memory_utilization: 0.90   # fraction of GPU VRAM for KV cache pages
enable_prefix_caching: true    # share identical prefix blocks across requests
max_num_seqs: 256              # max parallel sequences per GPU
swap_space_gb: 4               # CPU RAM for overflowed KV pages (extends effective KV cache)
block_size: 16                 # tokens per KV page (tune for workload)
```

When long system prompts or shared knowledge bases are prepended to every request, prefix caching can eliminate 80–90% of redundant prefill computation — the same economics as provider-side prompt caching but at the inference-engine level.

### Speculative Decoding

Speculative decoding uses a small "draft" model to propose token sequences that the larger "target" model verifies in parallel. Because verification is cheaper than generation, this yields 2–6× throughput improvement for output-heavy workloads at no quality cost. EAGLE-3 achieves ~6.5× speedup in benchmark conditions.

Requirements:
- Draft and target models must share the same vocabulary/tokenizer
- Quality is identical to standard decoding (acceptance sampling guarantees this mathematically)
- Most benefit on long-output tasks (code generation, document summarization); minimal benefit on short-output tasks (classification)

Speculative decoding is built into vLLM, TGI, and TensorRT-LLM as a runtime toggle — evaluate it as an architecture optimization per task type (Factor 14), not a global configuration.

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

## Compliance Checklist

- [ ] Application processes are stateless — no in-process state survives a restart
- [ ] Conversation history and session data are stored in backing services
- [ ] Semantic caching reduces redundant LLM calls for similar queries
- [ ] Embedding caching avoids recomputation of embeddings for unchanged content
- [ ] Provider-level prompt caching is enabled and prompts are structured for maximum cache hit rates (stable prefix, variable suffix)
- [ ] Prompt caching metrics (hit rate, cost savings) are monitored
- [ ] Cache invalidation strategies account for time, content changes, and model updates
- [ ] Cache hit rates and cost savings are monitored (Factor 15)
- [ ] Any process instance can handle any request — no sticky sessions required
- [ ] KV cache management is configured for self-hosted model serving
- [ ] Cache storage itself is a backing service (Factor 10), not local process memory
- [ ] Self-hosted inference engines have PagedAttention and prefix-tree KV caching configured; GPU memory utilization and prefix cache hit rate are monitored
- [ ] Speculative decoding is evaluated for output-heavy task types and enabled where it improves throughput without quality loss
- [ ] Multi-region cache replication strategy is defined (write-through vs. regional with fallback) and respects data residency constraints
