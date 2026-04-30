---
layout: page
importance: 17
category: "Tier 4: Intelligence"
title: "17. Prompt and Context Engineering"
nav_order: 2
description: "Prompt versioning, context window management, RAG pipeline design, token budgeting."
---

# Factor 17: Prompt and Context Engineering

> Treat prompts as versioned software artifacts and context as a managed resource — with intentional design for prompt structure, context window utilization, RAG pipelines, and token budgeting.

## Motivation

Prompts are the most influential code in an AI application. A single word change in a system prompt can dramatically alter application behavior. Yet prompts are often treated as casual strings — edited ad hoc, untested, and deployed without review. Similarly, context window management — deciding what information to include in the model's context and how to structure it — is often an afterthought that becomes a scaling bottleneck.

Prompt engineering is software engineering. Context management is resource management. Both deserve the same rigor, tooling, and processes that we apply to traditional code.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology had no concept of prompts or context windows, as these are unique to AI applications.

## How AI Changes This

This factor *is* the AI change. It addresses:

- **Prompt versioning and lifecycle**: Prompts are code that changes application behavior — they need version control, review, and testing.
- **Context window as a resource**: The context window is finite and expensive. What you include (and exclude) directly impacts quality, cost, and latency.
- **RAG pipeline design**: Retrieval-augmented generation is an architectural pattern that requires intentional design, not ad hoc assembly.
- **Token budgeting**: Every token in the context window has a cost and displaces other potential context. Budget allocation is an engineering decision.

## In Practice

### Prompt Architecture

Design prompts with clear structure and separation of concerns:

```markdown
# prompts/customer-support/system.md

## Role and Identity
You are a customer support assistant for {{company_name}}.
You help customers with questions about their accounts, orders, and products.

## Core Instructions
- Always be helpful, accurate, and concise.
- If you don't know the answer, say so — never fabricate information.
- Refer to the knowledge base context provided below for factual answers.

## Knowledge Base Context
{{retrieved_context}}

## Conversation Guidelines
- Greet returning customers by name.
- For billing questions, always verify the account first.
- For technical issues, gather system information before troubleshooting.

## Output Format
- Use clear, short paragraphs.
- Use bullet points for lists of steps.
- Include relevant links from the knowledge base when available.

## Safety Boundaries
- Never share other customers' information.
- Never process refunds over ${{refund_threshold}} without escalation.
- If the customer is upset, acknowledge their frustration before solving.
```

### Prompt Versioning

```
prompts/
├── customer-support/
│   ├── system.md                 # Current production prompt
│   ├── system.v2-candidate.md    # Under evaluation
│   ├── few-shot-examples.jsonl   # Few-shot examples
│   └── eval-config.yaml          # Evaluation configuration for this prompt
├── summarization/
│   ├── system.md
│   ├── chain-of-thought.md       # CoT template
│   └── eval-config.yaml
└── classification/
    ├── system.md
    └── labels.json                # Valid classification labels
```

### Context Window Budget

```yaml
# context-budget.yaml — allocate the context window intentionally
context_budget:
  model: claude-sonnet-4-5-20250929
  max_context_tokens: 200000       # models now support up to 1M+ tokens
  max_output_tokens: 4096

  allocation:
    system_prompt:
      budget: 2000
      priority: 1              # Always included
      source: prompts/system.md

    safety_instructions:
      budget: 500
      priority: 1              # Always included
      source: prompts/safety.md

    few_shot_examples:
      budget: 3000
      priority: 2              # Included when budget allows
      source: prompts/few-shot-examples.jsonl
      strategy: select_most_relevant  # Pick examples similar to current query

    retrieved_context:
      budget: 8000
      priority: 2
      source: rag_pipeline
      strategy: rerank_and_truncate

    conversation_history:
      budget: 4000
      priority: 3              # Trimmed first when budget is tight
      strategy: keep_recent    # Keep most recent turns, summarize older ones

    user_message:
      budget: 2000
      priority: 1              # Always included in full

  overflow_strategy: trim_lowest_priority
  reserved_for_output: 4096    # Always reserve space for model output

  # Large context window considerations (200K-1M+ tokens)
  # Having a large context window doesn't mean you should fill it.
  # More context ≠ better quality. Key trade-offs:
  #
  # - Cost scales linearly with input tokens (unless cached — see Factor 12)
  # - Latency increases with context length (time-to-first-token)
  # - "Needle in a haystack" degradation: models may miss relevant info
  #   buried in very large contexts. Reranking and context assembly
  #   remain important even with 1M+ token windows.
  # - Provider prompt caching (Factor 12) mitigates cost for stable prefixes
  #
  # Rule of thumb: use large context for breadth (many documents),
  # use RAG + reranking for precision (finding the right passages).
```

### RAG Pipeline Design

> The query-time pipeline below works with Factor 12's semantic caching (cache lookups before retrieval) and Factor 2's contract definitions (schema for the retrieval-to-generation interface). For the ingestion side — chunking, embedding, and indexing — see the RAG Ingestion Pipeline section below.

```python
class RAGPipeline:
    """Structured retrieval-augmented generation pipeline."""

    def __init__(self, embedder, vector_store, reranker, llm):
        self.embedder = embedder
        self.vector_store = vector_store
        self.reranker = reranker
        self.llm = llm

    async def generate(self, query: str, context_budget: int) -> RAGResponse:
        # Stage 1: Query understanding
        search_queries = await self.expand_query(query)

        # Stage 2: Retrieval (cast a wide net)
        candidates = []
        for search_query in search_queries:
            embedding = await self.embedder.embed(search_query)
            results = await self.vector_store.query(
                vector=embedding,
                top_k=20,  # Retrieve more than needed
            )
            candidates.extend(results)

        # Stage 3: Deduplication
        candidates = self.deduplicate(candidates)

        # Stage 4: Reranking (narrow to most relevant)
        reranked = await self.reranker.rerank(
            query=query,
            documents=candidates,
            top_k=5,
        )

        # Stage 5: Context assembly (fit within budget)
        context = self.assemble_context(
            documents=reranked,
            token_budget=context_budget,
        )

        # Stage 6: Generation
        response = await self.llm.complete(
            system=self.system_prompt,
            context=context,
            query=query,
        )

        return RAGResponse(
            answer=response.text,
            sources=[doc.metadata for doc in context.documents],
            token_usage=response.token_usage,
        )

    def assemble_context(self, documents, token_budget):
        """Fit documents into the token budget, preserving the most relevant."""
        assembled = []
        tokens_used = 0

        for doc in documents:  # Already sorted by relevance
            doc_tokens = self.count_tokens(doc.content)
            if tokens_used + doc_tokens <= token_budget:
                assembled.append(doc)
                tokens_used += doc_tokens
            else:
                # Try to include a truncated version
                remaining = token_budget - tokens_used
                if remaining > 200:  # Minimum useful context
                    truncated = self.truncate_to_tokens(doc.content, remaining)
                    assembled.append(doc.with_content(truncated))
                break

        return ContextBundle(documents=assembled, total_tokens=tokens_used)
```

### RAG Ingestion Pipeline
The query-time pipeline above assumes documents are already chunked, embedded, and indexed. The ingestion side is equally important — and often harder to get right:

```python
class RAGIngestionPipeline:
    """Ingest documents into the vector store for retrieval."""

    def __init__(self, chunker, embedder, vector_store, metadata_extractor):
        self.chunker = chunker
        self.embedder = embedder
        self.vector_store = vector_store
        self.metadata_extractor = metadata_extractor

    async def ingest(self, document: Document) -> IngestionResult:
        # Stage 1: Extract and clean text
        text = await self.extract_text(document)  # handles PDF, DOCX, HTML, etc.

        # Stage 2: Extract metadata
        metadata = self.metadata_extractor.extract(document)  # title, author, date, source

        # Stage 3: Chunk with overlap
        chunks = self.chunker.chunk(
            text=text,
            strategy="recursive",         # recursive character splitting
            chunk_size=512,                # tokens per chunk
            chunk_overlap=64,              # overlap prevents losing context at boundaries
        )

        # Stage 4: Embed chunks (with caching — Factor 12)
        embeddings = await self.embedder.embed([c.text for c in chunks])

        # Stage 5: Upsert to vector store with metadata
        vectors = [
            Vector(
                id=f"{document.id}:chunk:{i}",
                values=embedding,
                metadata={
                    **metadata,
                    "chunk_index": i,
                    "source_document_id": document.id,
                    "ingested_at": now().isoformat(),
                },
            )
            for i, embedding in enumerate(embeddings)
        ]
        await self.vector_store.upsert(vectors)

        return IngestionResult(document_id=document.id, chunks=len(chunks))
```

```yaml
# ingestion-config.yaml
ingestion:
  chunking:
    strategy: recursive               # recursive | sentence | semantic | fixed
    chunk_size_tokens: 512
    chunk_overlap_tokens: 64
    respect_boundaries: true           # don't split mid-sentence or mid-paragraph

  scheduling:
    mode: incremental                  # incremental | full_reindex
    trigger: on_document_change        # webhook, file watcher, or scheduled
    full_reindex_cadence: monthly      # catch any drift or missed updates

  deletion:
    strategy: cascade                  # when source doc is deleted, remove all chunks
    orphan_detection: weekly           # scan for chunks without valid source docs

  quality:
    min_chunk_length_tokens: 50        # discard very short chunks (noise)
    deduplication: content_hash        # skip re-ingestion of unchanged documents
    validation: spot_check             # sample 1% of ingested chunks for quality review
```

### Prompt Testing

```python
# Test prompts like code
class PromptTests:
    def test_system_prompt_within_budget(self):
        prompt = load_prompt("customer-support/system.md")
        tokens = count_tokens(prompt.render(default_vars))
        assert tokens <= CONTEXT_BUDGET["system_prompt"]

    def test_prompt_variables_all_defined(self):
        prompt = load_prompt("customer-support/system.md")
        required_vars = prompt.extract_variables()
        for var in required_vars:
            assert var in KNOWN_VARIABLES, f"Undefined variable: {var}"

    def test_few_shot_examples_valid(self):
        examples = load_examples("customer-support/few-shot-examples.jsonl")
        for example in examples:
            assert "input" in example
            assert "output" in example
            assert count_tokens(example["output"]) <= MAX_EXAMPLE_TOKENS

    async def test_prompt_produces_valid_output(self):
        prompt = load_prompt("customer-support/system.md")
        response = await llm.complete(prompt.render(test_vars))
        assert is_valid_format(response)
        assert not contains_pii(response)
```

### Multimodal Context Management
Modern models accept images, audio, PDFs, and video alongside text. Multimodal inputs consume context budget differently and require explicit handling:

```yaml
# multimodal-budget.yaml
multimodal_policy:
  images:
    max_per_request: 5
    max_resolution: 2048x2048       # higher resolution = more tokens
    token_estimation: auto           # provider-specific calculation
    preprocessing:
      - resize_if_above: 1568x1568  # balance quality vs. token cost
      - strip_exif: true            # remove metadata (may contain PII)
    budget_allocation: 4000          # tokens reserved for image context

  audio:
    max_duration_seconds: 300
    transcription_strategy: pre_transcribe  # transcribe before sending to LLM
    model: whisper-large-v3
    budget_allocation: 2000          # tokens for transcript

  documents:
    formats: [pdf, docx, xlsx]
    strategy: extract_and_chunk      # extract text, chunk, embed for RAG
    max_pages: 50

  video:
    strategy: frame_sampling         # extract key frames as images
    sample_rate: 1_per_10_seconds
    max_frames: 20
```

Key multimodal engineering decisions:
- **Image tokens are expensive**: A single high-resolution image can consume thousands of tokens. Resize to the minimum resolution that preserves the information needed. Factor 20 cost models must account for image token pricing, which differs from text.
- **Pre-process when possible**: Transcribe audio to text, extract text from PDFs, and sample frames from video *before* sending to the model. This gives you control over token budget and lets you cache intermediate results (Factor 12).
- **Multimodal observability**: Log input modality types and token consumption per modality. Factor 15 metrics should distinguish between text and image token costs.

### Multimodal Output Generation
Models now generate not just text but also images, audio, and structured visual content as outputs. This introduces new engineering concerns:

```yaml
multimodal_outputs:
  image_generation:
    models: [dall-e-3, claude-with-image-gen]
    output_validation:
      - content_safety_scan: true       # scan generated images for policy violations
      - watermark: ai_generated         # label AI-generated images (Factor 7 transparency)
      - format: png                     # standardize output format
      - max_resolution: 2048x2048
    cost_tracking:
      unit: per_image                   # image generation is priced per image, not per token
      note: "Factor 20 cost model must include image generation as separate line item"

  audio_generation:
    models: [tts-1, tts-1-hd]
    output_validation:
      - content_safety_scan: true
      - label_as_synthetic: true        # disclose AI-generated audio
      - max_duration_seconds: 300
    cost_tracking:
      unit: per_character               # TTS is typically priced per character

  structured_visual:
    types: [charts, diagrams, code_rendering]
    strategy: generate_spec_then_render # model generates spec (Mermaid, SVG), renderer produces image
    note: "Cheaper and more controllable than direct image generation"
```

**Key engineering decisions for multimodal outputs:**
- **Safety scanning is mandatory**: Generated images and audio must pass content safety checks before serving to users (Factor 7). A text response that passes safety filters can still generate an unsafe image.
- **Disclosure**: AI-generated images and audio must be labeled as synthetic (Factor 7 transparency, EU AI Act requirements).
- **Cost modeling differs**: Image generation is priced per image (not per token), audio per character. Factor 20 cost models must account for these different units.
- **Prefer spec-based rendering**: When possible, have the model generate a structured specification (SVG, Mermaid, chart config) and render it deterministically. This is cheaper, cacheable, and more controllable than direct image generation.

### Extended Thinking and Reasoning Models

Reasoning models (Claude's extended thinking, OpenAI o1/o3/o4-mini, DeepSeek R1) introduce a fundamentally different token economy: **thinking tokens**. These models generate internal reasoning chains before producing a visible response, and those thinking tokens consume budget, incur cost, and affect latency — but are not shown to the user.

This changes context engineering in several ways:

```yaml
# reasoning-budget.yaml — budget thinking tokens explicitly
reasoning_budget:
  model: claude-opus-4-6-20250515
  extended_thinking:
    enabled: true
    max_thinking_tokens: 32000       # hard cap on internal reasoning
    budget_strategy: task_adaptive   # simple tasks get less thinking budget

  task_profiles:
    classification:
      thinking_budget: 1024          # simple tasks need minimal reasoning
      note: "Reasoning adds latency with little quality gain for classification"

    code_generation:
      thinking_budget: 16000         # complex tasks benefit from deep reasoning
      note: "More thinking tokens = better code quality and fewer bugs"

    multi_step_analysis:
      thinking_budget: 32000         # max budget for complex analytical tasks
      note: "Research, planning, and multi-step reasoning benefit most"

    simple_qa:
      thinking_budget: 0             # disable extended thinking entirely
      note: "Use a non-reasoning model or disable thinking for simple retrieval"
```

**Key engineering decisions for reasoning models:**
- **Thinking tokens are invisible but expensive**: A response with 500 output tokens may consume 10,000+ thinking tokens. Factor 20 cost models must account for this — thinking tokens are typically priced differently from output tokens.
- **Not all tasks benefit from reasoning**: Classification, simple Q&A, and format conversion see little quality improvement from extended thinking. Use reasoning models selectively — route simple tasks to standard models (Factor 20 model routing).
- **Thinking budget as a quality lever**: More thinking tokens generally improve quality for complex tasks, but with diminishing returns. Tune the thinking budget per task type based on evaluation results (Factor 6).
- **Streaming considerations**: With reasoning models, the first visible token may take significantly longer to appear (the model is "thinking" first). Design UIs to handle this latency — show a "thinking" indicator rather than an empty response.
- **Summarized thinking for observability**: Some providers return a summarized version of the thinking process. Log this for debugging and quality analysis (Factor 15), but be aware it's a summary, not the full chain.

### GraphRAG for Knowledge Graph Retrieval

GraphRAG (Microsoft Research, 2024) extends RAG by indexing documents as a knowledge graph — extracting entities, relationships, and community summaries — enabling queries requiring multi-hop reasoning or global document-collection summarization. Standard vector RAG excels at local, point-in-time retrieval; GraphRAG excels at "what patterns span this entire corpus?"

The query pipeline splits into local (vector search for precise factual lookup) and global (graph community summaries for broad synthesis) modes based on query type. This requires dedicated ingestion: entity extraction, relationship graph construction, and community detection — significantly more compute than standard embedding ingestion. Use GraphRAG when your retrieval tasks require connecting entities across documents; use standard vector RAG when point retrieval suffices (Factor 10 covers the knowledge graph as a backing service).

### ColBERT and Late-Interaction Retrieval

ColBERT's late-interaction approach stores **token-level embeddings** for each document — not a single document-level embedding — and computes relevance as the sum of maximum cosine similarities between each query token and its closest document token. This provides higher retrieval precision than single-vector dense retrieval for queries where specific terms matter.

Use when: retrieval precision on domain-specific terminology is critical and you can afford ~10× storage vs. single-vector retrieval. Implementations: ColBERT v2, RAGatouille, Vespa. Late interaction can be layered on top of a standard ANN index as a re-ranking stage, limiting storage cost to the top-K candidates.

### Automatic Prompt Optimization (DSPy, TextGrad, APE)

Manual prompt engineering is iterative and doesn't optimize globally across diverse inputs. Automatic prompt optimization frameworks treat prompt design as an optimization problem grounded in your evaluation suite:

- **DSPy** (Stanford): programs are written as module signatures; optimizers (BootstrapFewShot, MIPROv2) automatically tune prompts and few-shot examples using your labeled eval set. The optimized prompt is compiled to a concrete string committed back to version control.
- **TextGrad**: uses LLM-generated "textual gradients" — critique and improvement suggestions — to iteratively refine prompts without labeled data.
- **APE** (Automatic Prompt Engineer): searches a candidate instruction space and selects by eval score; useful when you have labeled examples and want to discover better instruction phrasings.

These tools connect directly to Factor 6 (eval suites provide the optimization signal) and Factor 1 (optimized prompts are committed as versioned artifacts). The risk: auto-optimized prompts can overfit to the eval set — always validate on a held-out test partition and production shadow traffic (Factor 11).

### Long-Context Degradation

Models with large context windows (200K–1M+ tokens) can still degrade when relevant information is buried in the middle of a long context — the "lost in the middle" effect. Mitigations:

- **Position-aware context assembly**: place the most relevant retrieved passages immediately before or after the query, not buried mid-context
- **Reranking before context assembly**: use a reranker (Factor 10) to ensure the top-K passages by relevance are positioned where the model attends best
- **Summary hierarchies for large corpora**: for breadth-oriented queries, summarize document groups at multiple granularities rather than injecting full documents
- **Monitor retrieval recall vs. context position**: measure whether the model correctly uses passages at different positions in your eval suite; degrade gracefully by shortening context if recall drops below threshold

### Prompt Optimization Strategies

- **Prompt compression**: Remove redundant instructions. Models understand concise prompts well.
- **Dynamic few-shot selection**: Don't include all examples — select the most relevant ones for the current query.
- **Conversation summarization**: Instead of passing full conversation history, summarize older turns.
- **Structured output over prose**: JSON schemas for output reduce tokens and improve reliability.
- **Chain-of-thought budgeting**: If using CoT, budget tokens for reasoning steps that won't be shown to the user.
- **Reasoning model routing**: Not every request needs extended thinking. Route simple tasks to standard models and reserve reasoning models for tasks where quality measurably improves (see Factor 20 for cost-aware routing).

## Compliance Checklist

- [ ] All prompts are stored in version control as named, reviewable files
- [ ] Prompt changes go through pull request review and evaluation (Factor 6)
- [ ] Context window utilization is budgeted with explicit allocations per component
- [ ] RAG pipelines have defined stages (retrieval, reranking, assembly) with quality metrics
- [ ] Token budgets account for system prompt, context, conversation history, and output reservation
- [ ] Few-shot examples are curated, versioned, and selected dynamically based on relevance
- [ ] Prompt templates are validated at build time (variables defined, within budget)
- [ ] Conversation history management has a defined strategy (truncation, summarization)
- [ ] Prompt effectiveness is measured through evaluations (Factor 6) and production monitoring (Factor 15)
- [ ] Context assembly strategies handle overflow gracefully (truncation, prioritization)
- [ ] Extended thinking / reasoning token budgets are configured per task type with cost awareness (Factor 20)
- [ ] GraphRAG is used for queries requiring multi-hop entity reasoning; standard vector RAG is used for point-in-time retrieval
- [ ] Retrieval recall vs. context position is monitored in the eval suite; context assembly places highest-relevance passages in positions the model attends best
- [ ] Automatic prompt optimization (DSPy, TextGrad, or equivalent) is evaluated for high-traffic prompts; optimized prompts are committed as versioned artifacts validated on held-out test data
