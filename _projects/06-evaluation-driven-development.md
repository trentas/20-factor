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

- **LLM outputs are non-deterministic**: Even with fixed settings — and many reasoning models no longer expose sampling controls at all — outputs vary from run to run and across provider infrastructure changes.
- **Quality is subjective and multi-dimensional**: A response can be accurate but not concise, helpful but not safe, fluent but factually wrong.
- **Regression is subtle**: A prompt change that improves one dimension may degrade another. Only broad evaluation suites catch these trade-offs.
- **Model updates change behavior**: When a provider updates a model, your application's behavior changes without any code change on your part.

## In Practice

### Evaluation Types

| Type | Use when | What it checks | Watch out for |
|------|----------|----------------|---------------|
| **Deterministic** | An exact answer or a checkable structure exists | Label match for classification, field match for extraction, schema validation for structured output | A validator that raises on bad output crashes the run — record a failed case instead |
| **Heuristic** | Properties can be checked without judging content | Length within the token limit, no PII detected, valid markup, no unverified URLs, expected response language | A passing heuristic is a precondition, not evidence of quality |
| **LLM-as-judge** | Quality is subjective or multi-dimensional | Accuracy, relevance, completeness, and conciseness, each scored on a defined scale against a rubric | Uncalibrated judges drift silently — see calibration below |
| **Human** | Stakes are high or outputs are ambiguous | A sampled share of production outputs (for example 5%) on accuracy, helpfulness, and safety | Single reviewers hide disagreement |
| **Agent trajectory** | The system is an agent | The outcome *and* the path — see below | A correct-looking final answer can hide a bad run |

**LLM-as-judge rules.** Give the judge the user's question, the response, and a reference answer when one exists; score each dimension separately on an explicit scale (for example 1–5) with a rubric that says what each score means; and request structured output so scores are machine-readable. A judge is a model: version its prompt and model like any other (Factor 1, Factor 16) and calibrate it against humans before trusting it.

**Human evaluation rules.** Use at least two reviewers per sampled output so inter-annotator agreement can be measured, and escalate cases where reviewers disagree beyond a set threshold.

**Agent trajectory evaluations.** For agents, a correct-looking final answer can hide a bad run: the wrong tool, a mutated record, forty wasted steps. Grade the *path* as well as the outcome, from the full transcript of each trial — every model call, tool call, argument, and result:

| Check | What it verifies |
|-------|------------------|
| **Outcome** | The task is complete, verified against the environment's end state — not the agent's own claim |
| **Required tools** | Every tool the task needs was called |
| **Forbidden actions** | No tool outside the allowed set was called |
| **Arguments** | Every tool call's arguments are valid for that tool and case |
| **Step and cost budgets** | The run stayed within the steps and cost the task should take |
| **Plan quality** (only when needed) | A judge scores the plan against a rubric — after the deterministic checks above |

Practices that matter for agents:
- **Verify the end state, not the report.** Check the database row, the file, the ticket — the environment — rather than trusting the agent's final message.
- **Run each case several times.** Agents vary across runs. Report pass@k (succeeded at least once in k trials) for capability and pass^k (succeeded in all k) for reliability. Per-step reliability compounds: a 95%-per-step agent over eight steps succeeds end to end only about two-thirds of the time.
- **Deterministic checks before judges.** Tool choice, argument validity, ordering, and budgets are cheap to check in code; reserve LLM-as-judge for plan quality and other calls code can't make.
- **Evaluate the harness, not just the model.** The same model scores very differently under different harnesses (Factor 18). Record the harness version with every result and re-run the suite when either side changes.
- **Build cases from production failures.** Every bad trajectory found in traces (Factor 15) becomes a regression case.

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
Evaluations produce distributions, not single pass/fail results. Define gates per feature and per quality dimension:

- **Gate on the confidence bound, not the point estimate.** "Accuracy ≥ 0.90" means the lower bound of the 95% confidence interval is at or above 0.90 — which requires a minimum sample size (for example, 100 cases) before the gate means anything. For metrics where lower is better — harmful-output or policy-violation rates — gate on the *upper* bound instead, and size the sample to the risk: a rate near zero needs many cases before its upper bound is small.
- **Choose metrics per task.** Summarization might gate on judged accuracy (≥ 0.90) and relevance (≥ 0.85); classification on accuracy (≥ 0.95) and F1 (≥ 0.92).
- **Gate cost alongside quality.** Mean and p95 output tokens per request (for example 500 and 1,200) catch a prompt change that buys quality by making every answer much longer.
- **Compare against the current release, not only a fixed threshold**, so a regression is caught even while scores remain above the bar.

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

Golden datasets are bottlenecked by the availability of human-labeled examples. Synthetic data generation unlocks scale: use a capable model to generate candidate examples by category — edge cases, adversarial inputs, rare language patterns — then filter for quality before adding them to the eval set.

Key practices:
- Always seed synthetic generation with real examples to preserve domain characteristics
- Apply quality filtering — reject synthetic examples the judge model itself rates as low-quality
- Document the generation model and prompt in the dataset card (Factor 3)
- Periodically validate that synthetic examples predict real production failure modes

### LLM-as-Judge Calibration Drift

LLM judges degrade over time as the underlying judge model is updated by the provider. Detect calibration drift by maintaining a "human anchor" set:

1. Collect 100–200 examples with locked human scores (scored once and never re-scored), versioned in the repository with the rest of the eval suite
2. Run the judge against this set on a cadence (weekly for high-stakes features)
3. Track judge-vs-human agreement using Cohen's kappa or Spearman correlation
4. Alert when agreement drops below the calibration threshold (typically 0.75–0.85)
5. When drift is detected: either re-calibrate by updating the judge prompt, or switch to a more stable judge model version

### Public Benchmarks as Reference Points

Public benchmarks provide a shared vocabulary for capability comparisons when evaluating models or tracking regression. Prefer current, discriminative benchmarks — older ones like MMLU, HellaSwag, and HumanEval are saturated at the frontier and no longer separate top models:

| Benchmark | What it measures | Use case |
|-----------|-----------------|----------|
| **GPQA Diamond** | Graduate-level science reasoning | Frontier reasoning capability |
| **MMLU-Pro** | Broad knowledge (harder successor to MMLU) | General capability baseline |
| **SWE-bench Verified** | Software engineering (issue → patch) | Coding agent capability |
| **LiveCodeBench** | Contamination-resistant code generation | Code quality without benchmark leakage |
| **Terminal-Bench** | End-to-end agentic terminal tasks | Agent / harness capability |
| **AIME** | Competition mathematics | Multi-step quantitative reasoning |

Use these as calibration points when selecting models (Factor 16), not as the primary evaluation signal. Application-specific evaluations always take precedence over generic benchmarks — a model that scores highest on a public benchmark may still perform worse than a cheaper model on your specific task.

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

The methodology is tool-agnostic — what matters is that evaluations exist, run in CI, and gate releases. Pick the tool that fits your stack, but keep the datasets and graders in your repository. Hosted eval platforms get retired like models do — OpenAI's hosted Evals platform goes read-only on 31 Oct 2026 and shuts down on 30 Nov 2026 — and an eval suite that lives only in a vendor's UI leaves with it (Factor 16).

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
- [ ] Public benchmarks (GPQA Diamond, SWE-bench Verified, Terminal-Bench, etc.) are used as reference points during model selection, not as primary eval gates
- [ ] Agents are evaluated on full trajectories — end-state verification, tool selection and arguments, step and cost budgets — with repeated trials reporting pass^k
- [ ] Eval datasets and graders live in the repository, not only in a hosted eval platform
