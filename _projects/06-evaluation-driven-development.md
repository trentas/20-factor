---
layout: page
importance: 6
category: "Tier 2: Construction"
title: "06. Evaluation-Driven Development"
nav_order: 2
description: "Use evaluations, statistical quality gates, and LLM-as-judge for non-deterministic systems."
---

# Factor 6: Evaluation-Driven Development

> Non-deterministic systems demand a new testing paradigm — use evaluations, statistical quality gates, and LLM-as-judge to maintain confidence in AI outputs.

## Motivation

Traditional software testing rests on determinism: given input X, expect output Y. Unit tests assert exact values. Integration tests verify specific behaviors. This paradigm breaks down with AI systems. Ask the same question to the same model twice and you may get different responses — both correct, neither identical. Traditional assertion-based testing cannot adequately cover AI behavior.

Evaluation-driven development (EDD) is the AI-native complement to test-driven development. Where TDD uses assertions, EDD uses evaluations. Where TDD expects exact matches, EDD measures statistical quality across a distribution of outputs. Where TDD has pass/fail, EDD has quality scores with confidence intervals.

This is not optional. Without evaluations, AI development becomes intuition-driven — "it seems to work" replaces "it passes the tests." Evaluations are the only way to have confidence that changes to prompts, models, or system design actually improve (or at least don't degrade) output quality.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology assumed deterministic behavior that could be validated through traditional testing.

The closest analogue is the general practice of testing, but EDD is fundamentally different in approach and requires its own tooling, datasets, and quality gates.

## How AI Changes This

This factor *is* the AI change. It exists because AI systems introduced non-determinism at the application layer. Specifically:

- **LLM outputs are non-deterministic**: Even at temperature 0, outputs can vary across provider infrastructure changes.
- **Quality is subjective and multi-dimensional**: A response can be accurate but not concise, helpful but not safe, fluent but factually wrong.
- **Regression is subtle**: A prompt change that improves one dimension may degrade another. Only broad evaluation suites catch these trade-offs.
- **Model updates change behavior**: When a provider updates a model, your application's behavior changes without any code change on your part.

## In Practice

### Evaluation Types

**1. Deterministic Evaluations**
Where exact answers exist, use them:

```python
# Classification tasks, entity extraction, structured output
def eval_classification(output, expected):
    return output.label == expected.label

def eval_json_schema(output, schema):
    return jsonschema.validate(output, schema) is None
```

**2. Heuristic Evaluations**
Rule-based checks for structure, format, and constraints:

```python
# Check response properties without judging content
def eval_response_properties(response):
    checks = {
        "within_token_limit": len(tokenize(response)) <= 500,
        "no_pii_detected": not pii_detector.scan(response),
        "valid_markdown": markdown_parser.is_valid(response),
        "no_hallucinated_urls": not contains_urls(response),
        "appropriate_language": language_detector.detect(response) == "en",
    }
    return checks
```

**3. LLM-as-Judge Evaluations**
Use a capable model to evaluate output quality:

```python
# LLM-as-judge for subjective quality dimensions
judge_prompt = """
Evaluate the following response on these dimensions.
Score each from 1-5.

**Accuracy**: Does the response contain only factually correct information?
**Relevance**: Does the response address the user's question?
**Completeness**: Does the response cover all important aspects?
**Conciseness**: Is the response appropriately brief without losing substance?

User Question: {question}
Response to Evaluate: {response}
Reference Answer: {reference}

Return JSON: {"accuracy": N, "relevance": N, "completeness": N, "conciseness": N}
"""
```

**4. Human Evaluations**
For high-stakes decisions, sample outputs for human review:

```yaml
human_eval_config:
  sample_rate: 0.05            # Review 5% of production outputs
  dimensions:
    - accuracy
    - helpfulness
    - safety
  reviewers_per_sample: 2       # Inter-annotator agreement
  escalation_threshold: 0.3     # Disagreement triggers review
```

### Golden Datasets
Maintain curated evaluation datasets:

```jsonl
{"input": "Summarize the Q3 earnings report", "reference": "Revenue grew 15%...", "tags": ["summarization", "finance"]}
{"input": "Is this email a phishing attempt?", "reference": "Yes, because...", "tags": ["classification", "security"]}
{"input": "Explain quantum entanglement simply", "reference": "Quantum entanglement is...", "tags": ["explanation", "science"]}
```

Golden datasets should:
- Be versioned with the same rigor as code (Factor 1) — small datasets in-repo, large datasets pinned by manifest/hash to object storage, never an unversioned blob in a shared bucket
- Cover edge cases and adversarial inputs
- Include diverse examples across all supported use cases
- Be updated when new failure modes are discovered

### Versioning Eval Datasets at Scale

Eval datasets are not test fixtures — ML eval corpora often run gigabytes to terabytes, far past what Git handles directly. But "too big for Git" is not a license to skip versioning: an unversioned eval dataset means evaluation scores cannot be reproduced or compared across model versions, which dissolves the whole point of EDD.

The pattern is the same across tools: **the repo holds an immutable pointer; the storage holds the bytes.**

| Tool | Pointer location | Storage | Best for |
|------|------------------|---------|----------|
| **Git LFS** | LFS pointer file in repo | Git LFS server / S3 backend | Datasets up to ~hundreds of GB; transparent to developers |
| **DVC** | `dvc.lock` + `.dvc` files | Any object store (S3/GCS/Azure) | Pipelines mixing data + models; reproducible workflows |
| **lakeFS** | Commit SHA referenced in repo | S3-compatible storage | Git semantics over very large data lakes |
| **Hugging Face Datasets** | Revision SHA in code | HF Hub | Public or shared eval sets; community datasets |
| **MLflow / W&B artifacts** | Run ID + artifact version in repo | Object store + tracking server | Tying eval datasets to specific training runs |
| **S3 Object Versioning + manifest** | `dataset.manifest.json` (URIs + SHA256) | Versioned S3 bucket | Minimal tooling; full control |

The non-negotiable: every eval result must be traceable to (model version, prompt version, **dataset version**, eval code version). A score of "87% accuracy" without all four is a number, not a measurement.

### Statistical Quality Gates
Evaluations produce distributions, not single pass/fail results:

```yaml
quality_gates:
  summarization:
    accuracy:
      threshold: 0.90
      confidence: 0.95          # 95% confidence interval must be above threshold
      min_samples: 100
    relevance:
      threshold: 0.85
    cost:
      mean_tokens: 500
      p95_tokens: 1200

  classification:
    accuracy:
      threshold: 0.95
    f1_score:
      threshold: 0.92
```

### Evaluation in the Development Workflow

```
Human-driven workflow:                  Agent-driven workflow:
1. Write/modify prompt or AI logic      1. Agent writes/modifies code
2. Run eval suite locally (quick)       2. Agent runs eval suite locally
3. Open pull request                    3. Agent opens pull request
4. CI runs full eval suite              4. CI runs full eval suite
5. Compare results against baseline     5. Compare results against baseline
6. Review regression/improvement        6. Agent iterates if gates fail
7. Merge only if quality gates pass     7. Human reviews when gates pass
8. Post-deploy monitoring               8. Post-deploy monitoring
```

Autonomous coding agents (Claude Code, Devin, Codex) make evaluation gates *more* critical, not less. When an agent can generate dozens of PRs per day, the eval suite is the primary quality gate — the human reviews what passed, not what was generated. Without robust evaluations, agent-generated code bypasses the quality bar that human intuition would otherwise provide.

### Synthetic Evaluation Data Generation

Golden datasets are bottlenecked by the availability of human-labeled examples. Synthetic data generation unlocks scale: use a capable model to generate adversarial examples, edge cases, and realistic inputs, then filter for quality before adding to the eval set.

```python
generator = LLM("claude-opus-4-7")
for category in ["edge_cases", "adversarial_inputs", "rare_language_patterns"]:
    candidates = generator.generate_eval_examples(
        task_description=task.description,
        seed_examples=golden_set[:20],  # seed with real examples
        count=500,
        category=category,
    )
    verified = [ex for ex in candidates if quality_check(ex) >= 0.85]
    eval_dataset.add(verified)
```

Key practices:
- Always seed synthetic generation with real examples to preserve domain characteristics
- Apply quality filtering — reject synthetic examples the judge model itself rates as low-quality
- Document the generation model and prompt in the dataset card (Factor 3)
- Periodically validate that synthetic examples predict real production failure modes

### LLM-as-Judge Calibration Drift

LLM judges degrade over time as the underlying judge model is updated by the provider. Detect calibration drift by maintaining a "human anchor" set:

1. Collect 100–200 examples with locked human scores (scored once and never re-scored)
2. Run the judge against this set on a cadence (weekly for high-stakes features)
3. Track judge-vs-human agreement using Cohen's kappa or Spearman correlation
4. Alert when agreement drops below the calibration threshold (typically 0.75–0.85)
5. When drift is detected: either re-calibrate by updating the judge prompt, or switch to a more stable judge model version

```yaml
judge_calibration:
  anchor_set: evals/human-anchor-set.jsonl  # 200 locked human-scored examples
  metrics: [cohens_kappa, spearman_rho]
  alert_threshold: 0.75
  check_cadence: weekly
  on_drift: alert_and_open_ticket
```

### Public Benchmarks as Reference Points

Public benchmarks provide a shared vocabulary for capability comparisons when evaluating models or tracking regression:

| Benchmark | What it measures | Use case |
|-----------|-----------------|----------|
| **MMLU** | Broad knowledge across 57 subjects | General capability baseline |
| **SWE-bench** | Software engineering (issue → patch) | Coding agent capability |
| **HellaSwag** | Commonsense reasoning | Language understanding |
| **HumanEval** | Code generation (Python) | Code quality |
| **TruthfulQA** | Truthfulness vs. plausible hallucination | Hallucination tendency |
| **MT-Bench** | Multi-turn instruction following | Chat quality |

Use these as calibration points when selecting models (Factor 16), not as the primary evaluation signal. Application-specific evaluations always take precedence over generic benchmarks — a model that scores highest on MMLU may still perform worse than a cheaper model on your specific task.

### Continuous Evaluation
Evaluations don't stop at deployment:

- **Online evaluation**: Sample production inputs/outputs and run evaluations continuously.
- **Drift detection**: Alert when evaluation scores trend downward, which may indicate model degradation, data drift, or changing user patterns.
- **A/B evaluation**: When testing a new model or prompt, run evaluations on both variants with real traffic.

### Tooling Landscape
The evaluation ecosystem is maturing rapidly. Choose tools based on your needs:

| Tool | Strength | Best For |
|------|----------|----------|
| **promptfoo** | Open-source, CLI-first, CI-friendly | Prompt regression testing, A/B comparisons |
| **Braintrust** | Logging + evals + datasets platform | Teams needing an integrated eval workflow |
| **Langsmith** (LangChain) | Tracing + eval tied to LangChain | LangChain-based applications |
| **RAGAS** | RAG-specific metrics (faithfulness, relevance) | Evaluating RAG pipeline quality |
| **DeepEval** | Pytest-style eval framework | Teams wanting evals that feel like unit tests |
| **Arize Phoenix** | Open-source observability + evals | Production monitoring with eval integration |

Key selection criteria:
- **CI integration**: Can it gate a pull request? (promptfoo, DeepEval, Braintrust)
- **Custom metrics**: Can you define domain-specific evaluation criteria? (all of the above)
- **Human eval support**: Does it support human review workflows? (Braintrust, Langsmith)
- **LLM-as-judge**: Does it support model-graded evaluations? (all of the above)
- **RAG-specific**: Does it have built-in RAG metrics? (RAGAS, DeepEval)

The methodology is tool-agnostic — what matters is that evaluations exist, run in CI, and gate releases. Pick the tool that fits your stack.

## Compliance Checklist

- [ ] Every AI feature has an evaluation suite with defined quality dimensions
- [ ] Golden datasets exist, are immutably versioned (in-repo for small sets; manifest/hash pointing to object storage for large corpora), and cover core use cases and edge cases
- [ ] Every recorded eval result is traceable to a specific (model version, prompt version, dataset version, eval code version) tuple
- [ ] Evaluation suites run in CI and gate releases (Factor 5)
- [ ] Statistical thresholds are defined for each quality dimension with confidence intervals
- [ ] LLM-as-judge evaluations are calibrated against human judgments
- [ ] Human evaluation processes exist for high-stakes or ambiguous outputs
- [ ] Evaluation results are tracked over time to detect trends and regressions
- [ ] New failure modes discovered in production are added to evaluation datasets
- [ ] Model upgrades and prompt changes are evaluated before deployment
- [ ] Online evaluation continuously monitors production output quality
- [ ] Synthetic eval data generation pipelines exist to scale coverage beyond human-labeled examples
- [ ] LLM-as-judge calibration is tracked against a locked human anchor set, with alerts for calibration drift
- [ ] Public benchmarks (MMLU, SWE-bench, HumanEval, etc.) are used as reference points during model selection, not as primary eval gates
