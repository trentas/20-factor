---
layout: page
importance: 19
category: "Tier 4: Intelligence"
title: "19. Agent Memory Architecture"
nav_order: 4
description: "Vector, graph, and episodic memory layers with identity-bound lifecycle, decay, and right-to-erasure."
---

# Factor 19: Agent Memory Architecture

> Long-term agent memory — vector, graph, and episodic — is a curated, mutable, identity-bound layer with its own lifecycle: write, recall, decay, redact, audit. It is distinct from caching (reactive, ephemeral) and from RAG (read-mostly knowledge) and demands its own design and compliance posture.

## Motivation

Agents that learn from interaction — a coding assistant that remembers your preferences, a customer-success agent that remembers a user's history across months, a research agent that builds a working understanding of a domain — need **memory**. Memory is not the same as cache and not the same as RAG.

- **Cache (Factor 12)** is *reactive*: an automatic, ephemeral lookup keyed on content hash or semantic similarity. It accelerates repeated work. Cache is correct or stale, never authoritative.
- **RAG (Factor 17)** is *read-mostly knowledge*: documents, policies, manuals, code, data. It is curated by ingestion pipelines, owned by editorial/data teams, and changes on a publication cadence.
- **Memory (this factor)** is *curated and mutable*: facts, preferences, episodes, and relationships scoped to a user, tenant, or agent identity. Memory is written by the agent during interaction, decays over time, must be auditable and erasable, and is constitutive of the agent's behavior — not just an optimization.

Mem0, Letta (production MemGPT), Zep, Cognee, and graph-memory systems consolidated this layer in 2025–2026. Without explicit treatment, teams conflate memory with cache (and lose right-to-erasure), with RAG (and lose user-scope), or with conversation history (and lose anything beyond a single session).

## What This Replaces

This factor doesn't replace a 12/15-factor predecessor. It splits long-term, identity-bound, mutable state out of three places where it currently hides:

- Out of **Factor 12** (Stateless Processes + Caching): cache is keyed on content; memory is keyed on identity. They have opposite invalidation rules.
- Out of **Factor 17** (Prompt and Context Engineering): RAG is read-mostly knowledge owned by the platform; memory is mutable, written by the agent, owned by the user.
- Out of **Factor 18** (Agent Orchestration): orchestration governs *how the agent acts*; memory governs *what the agent remembers*.

## How AI Changes This

### AI-Assisted Development
- Coding agents that remember your repo conventions, your test style, your code-review preferences across sessions need durable, user-scoped memory — not a cache, not a context file, not chat history.
- Memory enables agent personalization without re-training. The user controls *what* the agent remembers and *for how long*.

### AI-Native Applications
- **Vector memory**: semantic recall of past interactions ("the last time the user asked about pricing, they were comparing Plan B vs Plan C").
- **Graph memory**: relational facts ("Alice manages Bob, who owns the billing-service repo"). Powers agents that reason about org structure, code ownership, and entity relationships.
- **Episodic memory**: ordered sequences of events ("on 2026-04-12, the user reported issue X; on 2026-04-15, we shipped a fix; on 2026-04-18, the issue recurred"). Powers temporal reasoning and timeline summaries.
- **Working / scratchpad memory**: short-lived agent thoughts that span steps within one task. Often kept inside the workflow journal (cross-ref Factor 13) rather than the long-term memory store.
- **Memory poisoning is a real attack surface**: a malicious user can prompt-inject content that, if persisted, biases the agent in future sessions or other users' sessions. Memory write paths must defend against this explicitly.

## In Practice

### Memory Layers — Choose Explicitly

Pick a layer per use case. Conflating them is the most common mistake.

| Layer | What it stores | Retrieval | Mutation | Example |
|-------|----------------|-----------|----------|---------|
| **Vector** | Episodes/facts as embeddings | k-NN similarity | Append, decay, delete | "Find similar past requests from this user" |
| **Graph** | Entities + relationships | Graph traversal | CRUD on nodes/edges | "Who is the engineering manager of the auth team?" |
| **Episodic** | Time-ordered events | Range / window queries | Append-only with TTL | "What did we do for this customer last quarter?" |
| **Working** | Step-level scratchpad | Direct read | Workflow-scoped | "The plan I'm executing now" — usually in the workflow journal |

A typical agent uses 2–3 layers in combination, fronted by a single memory service.

### A Minimal Memory Service Interface

```python
class AgentMemory(Protocol):
    """Identity-bound, multi-layer memory."""

    async def write(
        self,
        identity: MemoryIdentity,        # tenant + user + agent
        layer: Literal["vector", "graph", "episodic"],
        record: MemoryRecord,
        provenance: Provenance,          # who/when/source — required
    ) -> MemoryId: ...

    async def recall(
        self,
        identity: MemoryIdentity,
        query: RecallQuery,              # natural language or structured
        layers: list[str] = ["vector"],
        limit: int = 10,
        min_relevance: float = 0.6,
    ) -> list[ScoredMemory]: ...

    async def forget(
        self,
        identity: MemoryIdentity,
        scope: ForgetScope,              # specific record / by category / all
        reason: ErasureReason,           # gdpr_request | poisoning | decay | manual
    ) -> ForgetReceipt: ...

    async def audit(
        self,
        identity: MemoryIdentity,
        time_range: TimeRange,
    ) -> list[MemoryAuditEvent]: ...     # who wrote what when, who read it
```

Every operation is identity-scoped. The memory service refuses to recall or write without an identity. Cross-tenant access is structurally impossible, not policy-controlled.

### Memory Lifecycle — Six Operations

**Write**: agent decides what's worth remembering. Use a *write filter*, not a write-everything policy:

```python
async def maybe_persist_memory(turn: ConversationTurn, agent_memory: AgentMemory):
    classification = await classify_turn(turn)
    if classification.contains_pii and not classification.user_consented_to_remember:
        return  # never persist non-consented PII
    if classification.salience < SALIENCE_THRESHOLD:
        return  # not worth remembering
    if classification.is_likely_prompt_injection:
        log_security_event(turn, classification)
        return  # poisoning defense — see below
    await agent_memory.write(
        identity=turn.identity,
        layer="vector",
        record=MemoryRecord(content=classification.summary, tags=classification.tags),
        provenance=Provenance(source="conversation", turn_id=turn.id, model=turn.model),
    )
```

**Recall**: every recall is scored, filtered, and budgeted before injection into the prompt. Memory drives prompt growth — see Factor 17 for token budget integration.

```python
memories = await agent_memory.recall(identity, query, limit=20, min_relevance=0.7)
budget = prompt_budget.allocate(component="memory", max_tokens=2000)
selected = budget.fit(memories, prioritize=["recency", "relevance", "user-pinned"])
```

**Decay**: memories lose relevance over time. Implement decay policies per layer:

```yaml
memory_decay:
  vector_layer:
    half_life_days: 60
    minimum_relevance: 0.3   # below this, mark for compaction
  episodic_layer:
    retention_days: 365
    summarize_after_days: 90  # collapse old episodes into summaries
  graph_layer:
    edges:
      stale_after_days: 180
      action: confirm_or_delete   # ask the user to confirm stale relationships
```

**Forget (right-to-erasure)**: GDPR/LGPD apply to memory. A user can request erasure of all memory about them. The implementation must reach **every memory store** (vector, graph, episodic, plus any caches that materialized memory content). Test this:

```python
async def test_right_to_erasure_is_complete():
    user = await create_test_user()
    await populate_all_memory_layers(user.identity)
    await agent_memory.forget(user.identity, scope=ForgetScope.ALL,
                              reason=ErasureReason.GDPR_REQUEST)

    # Assert ZERO records remain — across every layer
    assert await count_records_anywhere(user.identity) == 0

    # Assert downstream caches/embeddings/derived stores are also purged
    assert await count_derived_records(user.identity) == 0
```

**Redact**: a partial form of forget — a single fact corrected, not the whole user wiped. Useful for "I changed jobs, forget I work at X" without losing the rest of the user's history.

**Audit**: every write and every recall is auditable. The auditor can answer: *what does the agent remember about this user, where did each memory come from, who has read it, and when?*

### Memory Poisoning Defenses

A user can prompt-inject content that, if persisted, biases future responses — possibly across other users' sessions, if scopes leak. Defenses:

1. **Classify before persist**: run a guardrail on candidate memory writes (cross-ref Factor 7). Block writes that look like instructions, system overrides, or attempts to plant persistent biases.
2. **Summarize, don't store raw**: persist agent-generated summaries of user input rather than verbatim user input. The summarization step strips most injection attempts.
3. **Per-identity scoping is structural**: a memory written by user A is *never* recalled when serving user B. No cross-tenant similarity search.
4. **Quarantine new memories**: new memories are recallable only after a soak period (e.g., 1h) during which they can be reviewed by automated heuristics or sampling.
5. **Explicit user provenance label**: every memory carries `source=user_input` vs `source=agent_inference` vs `source=system`. Recall ranking can down-weight `user_input` when content is sensitive.

### Distinguishing Memory from Cache and RAG

```
Request comes in
  ├─ Factor 12 cache: was this exact (or semantically similar) request answered recently?
  │     → if yes, return cached response
  │
  ├─ Factor 19 memory: what does the agent remember about THIS user/tenant?
  │     → recall, score, budget, inject into prompt
  │
  ├─ Factor 17 RAG: what authoritative knowledge applies?
  │     → retrieve, rerank, budget, inject into prompt
  │
  └─ Generate
       └─ post-generation: should this turn produce a new memory write? (Factor 19)
```

Each path has different ownership, lifecycle, and compliance:

| Aspect | Cache (F12) | RAG (F17) | Memory (F19) |
|--------|-------------|-----------|--------------|
| Owner | Platform | Editorial / data team | User / tenant |
| Mutability | Auto-invalidated | Republished | Mutated by agent + user |
| Scope | Global or content-keyed | Global or tenant-scoped | Identity-scoped |
| Compliance | TTL is enough | License + provenance | Right-to-erasure required |
| Failure mode if missing | Slow / expensive | Worse retrieval quality | Agent feels amnesic |

### Tooling Landscape (2026)

- **Mem0** — multi-layer memory with broad framework integrations
- **Letta** (production MemGPT) — OS-style paged memory, hierarchical context management
- **Zep** — temporal/episodic memory with knowledge graph
- **Cognee** — graph-first knowledge memory with ingestion pipelines
- **Postgres + pgvector + custom schema** — viable for teams that want full ownership and don't need cross-product features

The choice is less important than the *discipline* of treating memory as a separate layer with its own contract, lifecycle, and compliance surface.

### Observability for Memory

Memory operations belong on the same telemetry plane as model calls (Factor 15):

```yaml
metrics:
  - memory_write_total{layer, identity_type, source}
  - memory_recall_total{layer, identity_type, hit_above_threshold}
  - memory_recall_latency_seconds{layer}
  - memory_forget_total{reason}
  - memory_poisoning_blocked_total{guardrail}
  - memory_recall_token_budget_consumed
```

Alert on: memory recall latency p95 spiking (often a sign of unbounded growth); poisoning-block rate spiking (active attack); right-to-erasure failures; cross-tenant access attempts.

## Compliance Checklist

- [ ] Memory layers (vector, graph, episodic) are explicitly modeled and named for the agent
- [ ] Memory writes are scoped by tenant + end-user identity; cross-tenant recall is structurally impossible
- [ ] Memory recall is scored, filtered, and budgeted before injection into the prompt (cross-ref Factor 17)
- [ ] Memory decay, summarization, or pruning policies are defined and enforced per layer
- [ ] Right-to-erasure (GDPR/LGPD) reaches every memory store, including derived/cached records, and is tested in CI
- [ ] Memory provenance is auditable — every record carries origin, author, source, and timestamp
- [ ] Cross-session persistent memory is clearly distinguished from ephemeral cache (Factor 12) and from RAG knowledge stores (Factor 17)
- [ ] Memory write paths defend against poisoning (classify, summarize, quarantine, provenance-label)
- [ ] Memory access latency is monitored alongside generation latency (Factor 15)
- [ ] A memory inspection / replay tool exists to debug agent behavior and answer user queries about what the agent remembers
- [ ] The agent's "forget me" UX path exists and is reachable by end users without a support ticket
