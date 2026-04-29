# Factor 16: Model Lifecycle Management

> Manage models as versioned, tested, and deployable artifacts with their own lifecycle — from selection through fine-tuning, deployment, monitoring, and deprecation.

## Motivation

In traditional software, the application binary is the primary artifact. You build it, test it, deploy it, and monitor it. AI applications have a second primary artifact: the model. Whether you use a hosted model (API-based) or a self-hosted model, it has a lifecycle that must be managed with the same rigor as application code.

Models get updated by providers (sometimes without notice), new models emerge that may be cheaper or more capable, fine-tuned models need retraining as data evolves, and deprecated models need migration plans. Without explicit model lifecycle management, organizations discover model changes through production incidents — a summarization feature degrades because the provider silently updated the model, or a classification pipeline breaks because a deprecated model was removed.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology assumed that application behavior was determined entirely by code. Models introduce a new axis of change that requires its own lifecycle management.

## How AI Changes This

This factor *is* the AI change. It exists because:

- **Models are a separate axis of change**: Code can stay constant while model behavior changes (provider updates), or models can stay constant while code changes.
- **Model selection is an ongoing decision**: New models emerge regularly. The model chosen at project start may not be the right choice six months later.
- **Fine-tuned models are custom artifacts**: If you fine-tune, the resulting model is your artifact to version, test, deploy, and maintain.
- **Deprecation is real**: Providers deprecate models on schedules. If you don't have a migration plan, you'll scramble when a deprecation notice arrives.

## In Practice

### Model Registry

Maintain a registry of all models used in the application:

```yaml
# model-registry.yaml
models:
  summarization-primary:
    provider: anthropic
    model_id: claude-sonnet-4-5-20250929
    api_version: "2025-01-01"
    purpose: "Document summarization"
    status: active
    deployed_date: "2025-03-15"
    eval_scores:
      accuracy: 0.94
      relevance: 0.91
      cost_per_1k_requests: 12.50
    owner: team-ai-platform

  summarization-candidate:
    provider: anthropic
    model_id: claude-sonnet-4-6-20260115  # newer version
    purpose: "Document summarization — evaluation candidate"
    status: evaluating
    eval_scores:
      accuracy: 0.95
      relevance: 0.93
      cost_per_1k_requests: 11.80
    notes: "5% quality improvement, 6% cost reduction. A/B test started 2025-06-10."

  classification-v2:
    type: fine-tuned
    base_model: gpt-4o-mini
    fine_tune_id: ft:gpt-4o-mini:org:classification-v2:abc123
    training_data: "s3://ml-data/classification/training-v2.jsonl"
    training_date: "2025-05-20"
    purpose: "Support ticket classification"
    status: active
    eval_scores:
      accuracy: 0.97
      f1: 0.95
    retrain_schedule: quarterly
    owner: team-support

  embedding-production:
    provider: openai
    model_id: text-embedding-3-small
    purpose: "Document embedding for RAG"
    status: active
    dimension: 1536
    notes: "Changing this model requires re-embedding all documents (~2M docs, ~$500, ~4h)"
```

### Model Selection Framework

```python
class ModelSelector:
    """Structured process for evaluating and selecting models."""

    async def evaluate_candidate(
        self,
        candidate: ModelConfig,
        current: ModelConfig,
        eval_suite: EvalSuite,
    ) -> ModelEvaluation:
        # Run evaluation suite against both models
        current_results = await eval_suite.run(current)
        candidate_results = await eval_suite.run(candidate)

        return ModelEvaluation(
            candidate=candidate,
            current=current,
            quality_comparison=self.compare_quality(current_results, candidate_results),
            cost_comparison=self.compare_cost(current_results, candidate_results),
            latency_comparison=self.compare_latency(current_results, candidate_results),
            recommendation=self.generate_recommendation(
                current_results, candidate_results
            ),
        )
```

### Version Pinning Strategy

```yaml
# Version pinning levels
pinning:
  # Level 1: Pin to specific model version (strictest)
  strict:
    model: claude-sonnet-4-5-20250929
    note: "Exact version — behavior is fully reproducible"

  # Level 2: Pin to model family (moderate)
  family:
    model: claude-sonnet-4-5-*
    note: "Allows minor updates within the same model family"

  # Level 3: Pin to capability tier (loosest)
  tier:
    model: claude-sonnet-*
    note: "Allows model generation changes — requires eval gates"

  # Recommended: Use strict pinning in production with eval-gated upgrades
```

### A/B Testing Models

```python
class ModelABTest:
    """Run controlled experiments comparing model versions."""

    def __init__(self, control: ModelConfig, treatment: ModelConfig, traffic_split: float):
        self.control = control
        self.treatment = treatment
        self.traffic_split = traffic_split  # e.g., 0.10 = 10% to treatment

    async def route(self, request: Request) -> ModelConfig:
        # Deterministic routing based on user ID for consistent experience
        if hash(request.user_id) % 100 < self.traffic_split * 100:
            return self.treatment
        return self.control

    async def analyze(self) -> ABTestResult:
        control_metrics = await self.collect_metrics(self.control)
        treatment_metrics = await self.collect_metrics(self.treatment)

        return ABTestResult(
            quality_delta=treatment_metrics.quality - control_metrics.quality,
            cost_delta=treatment_metrics.cost - control_metrics.cost,
            latency_delta=treatment_metrics.latency - control_metrics.latency,
            statistical_significance=self.calculate_significance(
                control_metrics, treatment_metrics
            ),
            recommendation=self.recommend(control_metrics, treatment_metrics),
        )
```

### Deprecation Planning

```yaml
# Model deprecation timeline
deprecation_plan:
  model: claude-3-sonnet-20240229
  status: deprecated
  timeline:
    announced: "2025-01-15"
    soft_deadline: "2025-06-01"     # Warnings in logs
    hard_deadline: "2025-09-01"      # Model removed by provider
  migration:
    target: claude-sonnet-4-5-20250929
    eval_status: passed              # New model passed eval suite
    migration_steps:
      - "Update model-registry.yaml"
      - "Run full eval suite against new model"
      - "Deploy to staging, run smoke tests"
      - "A/B test in production (10% traffic for 1 week)"
      - "Full rollout"
    estimated_effort: "2 developer-days"
    cost_impact: "-15% per request"
    quality_impact: "+3% accuracy"
```

### Model Distillation

Distillation uses a larger, more capable model (the "teacher") to generate training data for a smaller, cheaper model (the "student"). Unlike fine-tuning on human-labeled data, distillation leverages the teacher model's capabilities to create high-quality training data at scale — then produces a student model that approximates the teacher's quality at a fraction of the inference cost.

```yaml
# distillation-pipeline.yaml
distillation:
  teacher:
    model: claude-opus-4-6-20250515
    purpose: "Generate high-quality labeled data for student training"

  student:
    base_model: claude-haiku-4-5-20251001   # or open-source base model
    purpose: "Production inference at 10-20x lower cost than teacher"

  pipeline:
    - step: generate_training_data
      source: production_inputs             # real production queries
      teacher_model: claude-opus-4-6-20250515
      output_format: jsonl
      sample_size: 50000
      quality_filter:
        # Only keep teacher outputs that pass quality checks
        min_confidence: 0.9
        human_spot_check_rate: 0.02         # verify 2% of teacher outputs

    - step: train_student
      method: supervised_fine_tuning
      dataset: distillation_output.jsonl
      hyperparameters:
        epochs: 3
        learning_rate_multiplier: 1.5

    - step: evaluate_student
      compare_against:
        - teacher_model                     # quality gap vs. teacher
        - current_production_model          # improvement vs. current
      threshold:
        quality_vs_teacher: 0.90            # student must be ≥90% of teacher quality
        cost_reduction: 0.70                # student must be ≥70% cheaper

    - step: deploy
      strategy: ab_test
      traffic_split: 0.10
      monitor: [quality_score, cost_per_request, latency_p95]
```

**Teacher licensing in distillation**: Check the teacher model's terms of service before using its outputs as training data. Some providers have historically prohibited using model outputs to train competing models. Document the legal basis for distillation — the teacher model name, its license at the time of distillation, and the permitted use case — in the model registry entry alongside the distillation pipeline reference.

**When to distill vs. fine-tune:**
- **Distill** when you have a capable teacher model and want to reduce inference cost for a well-defined task. The teacher generates the training labels.
- **Fine-tune** when you have human-labeled data for a task that off-the-shelf models don't handle well. Humans generate the training labels.
- **Both** are part of the model lifecycle (this factor) and should follow the same versioning, evaluation, and deployment discipline.

### Parameter-Efficient Fine-Tuning (LoRA, PEFT, Adapters)

Full fine-tuning modifies all model weights — cost-prohibitive for models above ~7B parameters. Parameter-efficient fine-tuning (PEFT) techniques modify a small fraction of parameters:

- **LoRA** (Low-Rank Adaptation): injects trainable low-rank matrices into attention layers. The adapter is ~100MB vs. 70GB for a full model copy — independently versionable and deployable.
- **QLoRA**: quantizes the frozen base model to 4-bit and applies LoRA on top, cutting VRAM requirements ~4× vs. standard LoRA with minimal quality loss.
- **Adapters**: small bottleneck layers inserted between transformer blocks; compatible with most architectures.

Lifecycle implications:
- The adapter *is* the fine-tuned model for registry and deployment purposes. Register adapters as first-class entries in `model-registry.yaml` with their base model reference, training data version, and eval scores.
- Multiple adapters can target the same base model; adapter switching at inference time enables multi-task serving without loading multiple base model copies.
- Adapter merging (via `mergekit` or `peft.merge_adapter`) produces a standalone model for export or deployment where runtime adapter swapping isn't supported.

### Alignment Techniques: RLHF, DPO, and RLAIF

Alignment fine-tuning — making a model follow instructions, be helpful, and avoid harm — uses techniques beyond supervised fine-tuning (SFT):

- **RLHF** (Reinforcement Learning from Human Feedback): human preference labels train a reward model, which guides policy optimization via PPO. The gold standard for alignment but expensive in labeler time.
- **DPO** (Direct Preference Optimization): optimizes directly on preference pairs without a separate reward model. Simpler, cheaper, and often competitive with RLHF.
- **RLAIF** (RL from AI Feedback): replaces human labelers with a capable AI judge model (cross-ref distillation in this factor). Enables scale at a fraction of human-labeling cost.

These techniques live fully in the model lifecycle: training data versioning, evaluation against alignment metrics (refusal rate, helpfulness, safety), and the same deployment discipline as SFT. Track which alignment technique and dataset version each model in the registry used.

### Open-Weights Self-Hosted Lifecycle

Open-weight models (Llama 4, Mistral, Qwen, Gemma, Phi-4) have community-driven rather than provider-driven release cycles:

- New base model releases typically every 6–18 months; instruction-tuned variants appear within days on Hugging Face
- Quantized variants (GGUF, AWQ, GPTQ) trade quality for VRAM/speed — evaluate each quantization method on your eval suite before adopting
- Pin to a specific commit hash on Hugging Face Hub (not a floating branch alias), and store the hash in `model-registry.yaml`
- VRAM requirements must be documented in the registry entry: a Llama 4 Scout requires different infrastructure than a Phi-4-mini
- Monitor for community-discovered vulnerabilities or jailbreaks in open-weight models — the threat surface is different from hosted providers because model weights are publicly available

### Fine-Tuning Pipeline

```yaml
# Fine-tuning lifecycle
fine_tuning:
  trigger:
    schedule: quarterly
    or: eval_score_drops_below_threshold

  pipeline:
    - step: collect_training_data
      source: production_feedback
      filter: human_verified_only
      min_samples: 5000

    - step: prepare_dataset
      format: jsonl
      split: {train: 0.8, validation: 0.1, test: 0.1}

    - step: fine_tune
      base_model: gpt-4o-mini
      hyperparameters:
        epochs: 3
        learning_rate_multiplier: 1.8

    - step: evaluate
      suite: evals/classification/
      threshold:
        accuracy: 0.95
        f1: 0.93
      compare_against: current_production_model

    - step: register
      registry: model-registry.yaml
      status: candidate

    - step: deploy
      strategy: ab_test
      traffic_split: 0.10
      duration: 7d

    - step: promote_or_rollback
      decision: based_on_ab_test_results
```

## Compliance Checklist

- [ ] A model registry documents all models in use (provider, version, purpose, status, owner)
- [ ] Production models are pinned to specific versions, not "latest"
- [ ] A structured evaluation process exists for evaluating model candidates
- [ ] Model A/B testing infrastructure enables controlled rollout of model changes
- [ ] Deprecation plans exist for every model in use, with migration timelines
- [ ] Provider model deprecation notices are tracked and acted on proactively
- [ ] Fine-tuned models follow a versioned pipeline (data → train → eval → deploy)
- [ ] Model distillation pipelines (teacher → student) are evaluated for quality gap vs. cost reduction
- [ ] Model changes are tracked in the same release process as code changes (Factor 5)
- [ ] Embedding model changes are planned as data migration events
- [ ] Model performance is continuously monitored in production (Factor 15)
- [ ] LoRA/QLoRA adapters are registered as first-class model artifacts with base model reference, training data version, and eval scores
- [ ] Alignment technique (RLHF/DPO/RLAIF) and training dataset version are recorded in the model registry for every fine-tuned model
- [ ] Teacher model license is verified and documented before using its outputs as distillation training data
- [ ] Open-weight models are pinned to a specific Hugging Face commit hash with VRAM requirements declared in the model registry
