# Factor 11: Environment Parity

> Keep development, staging, and production as similar as possible — including model behavior, vector database content representativeness, and AI service configurations.

## Motivation

The original factor warned against gaps between development and production: time gaps (code written weeks before deployment), personnel gaps (developers write, ops deploy), and tooling gaps (different backing services in dev vs. prod). These gaps cause bugs that only appear in production.

AI applications amplify the parity problem. A prompt that works well with one model version may fail with another. A RAG pipeline that performs brilliantly against a curated staging dataset may struggle with the messiness of production data. Evaluation scores in development may not predict production quality. The gap between "works on my laptop" and "works in production" widens when model behavior, data quality, and AI service configurations can diverge across environments.

## What This Replaces

**Original Factor #10 / Beyond 15 #9: Dev/Prod Parity** — "Keep development, staging, and production as similar as possible."

This update retains the core parity principle and extends it to cover:

- Model version parity across environments
- AI service configuration parity (temperature, token limits, safety settings)
- Vector database data representativeness in non-production environments
- Evaluation benchmark consistency across environments
- Cost and rate limit simulation in development

## How AI Changes This

### AI-Assisted Development
- Developers using AI coding assistants get a different experience than CI/CD pipelines that may use different (or no) AI tools. This is an acceptable divergence — the codebase (Factor 1) is the source of truth, not the development tool.
- **Autonomous coding agents** (Claude Code, Devin, Codex) amplify the need for ephemeral environments. An agent generating code on a branch cannot manually verify "it works on staging" — it needs an automated, production-parity environment that spins up, validates, and reports results. See the Ephemeral Environments section below.

### AI-Native Applications
- **Model behavior parity**: If production uses `claude-sonnet-4-5-20250929`, staging should use the same model version, not `claude-haiku-4-5-20251001` to save costs. Behavior differences between models are the most common source of staging-vs-production surprises.
- **Data representativeness**: Production vector databases contain millions of documents with real-world messiness. Staging vector databases with 100 curated documents don't surface the same retrieval challenges.
- **Configuration drift**: If staging uses `temperature=0.7` while production uses `temperature=0.3`, you're testing different systems.
- **Safety and guardrail parity**: If content safety filters are disabled in staging "to make development easier," you won't catch safety issues until production.

## In Practice

### Parity Dimensions

| Dimension | Anti-Pattern | Best Practice |
|-----------|-------------|---------------|
| Model version | Staging uses a cheaper model | Same model version across all environments |
| Model config | Different temperature/tokens per env | Same inference parameters, or intentional and documented differences |
| Vector DB data | Staging has 100 docs, prod has 1M | Staging has a representative sample (10K+) with real-world data characteristics |
| Safety filters | Disabled in dev for convenience | Enabled in all environments; dev has a bypass for specific test cases |
| Rate limits | No limits in dev | Simulated limits in dev that match production constraints |
| Embedding model | Different model in dev to save costs | Same embedding model — changing it requires re-embedding |

### Representative Staging Data
Create staging vector databases that reflect production reality:

```yaml
# staging-data-config.yaml
vector_db_staging:
  source: production_snapshot
  sampling_strategy: stratified
  sample_size: 50000
  stratify_by:
    - document_type
    - language
    - date_range
    - content_length

  # Include edge cases that production data contains
  include:
    - long_documents_over_10k_tokens: 500
    - multilingual_documents: 1000
    - documents_with_tables: 500
    - documents_with_code: 500
    - recently_updated_documents: 2000

  # Refresh cadence
  refresh_schedule: weekly
  pii_handling: anonymize_before_copy
```

### Environment Configuration Parity

```yaml
# Use the same base config with minimal, documented overrides
# base-ai-config.yaml (shared)
models:
  summarization:
    model: claude-sonnet-4-5-20250929
    temperature: 0.3
    max_tokens: 1024

# staging-overrides.yaml (minimal differences, documented)
overrides:
  rate_limits:
    reason: "Lower rate limits to control staging costs"
    per_user_rpm: 5   # prod: 20

  cost_budgets:
    reason: "Lower budgets in staging"
    daily_limit_usd: 50  # prod: 500

# NEVER override in staging:
# - model version
# - temperature
# - safety settings
# - prompt templates
```

### Local Development with AI Services
Balance parity with practicality for local development:

```yaml
local_development:
  # Option 1: Use the same cloud AI services (best parity)
  llm_provider: anthropic  # Same as production
  api_key: developer_personal_key
  cost_alert_usd: 5.00  # Daily cost alert for dev

  # Option 2: Use local models for rapid iteration (lower parity)
  llm_provider: ollama
  model: llama3.1:8b
  note: "Use for rapid iteration only. Run eval suite against production model before PR."

  # Vector DB: Use a local instance with representative sample
  vector_db: qdrant_local
  data_sample: fixtures/vector-db-sample.tar.gz
```

### Continuous Parity Validation
Automate parity checks:

```python
class EnvironmentParityChecker:
    def check_parity(self, env_a: str, env_b: str):
        checks = {
            "model_version": self.compare_model_versions(env_a, env_b),
            "model_config": self.compare_model_configs(env_a, env_b),
            "prompt_versions": self.compare_prompt_hashes(env_a, env_b),
            "safety_settings": self.compare_safety_configs(env_a, env_b),
            "embedding_model": self.compare_embedding_models(env_a, env_b),
            "vector_db_stats": self.compare_vector_db_statistics(env_a, env_b),
        }

        for check, result in checks.items():
            if not result.is_parity:
                if result.is_intentional:
                    self.logger.info(f"Intentional divergence: {check} — {result.reason}")
                else:
                    self.logger.warning(f"PARITY VIOLATION: {check} — {result.detail}")
```

### Ephemeral Environments for Autonomous Validation

AI coding agents can work around the clock, generating code across multiple branches and producing several candidate solutions for the same problem. Validating this volume of changes requires non-production environments that spin up on demand, run the full evaluation and test suite, and tear down automatically — without competing for shared staging resources or blocking other work.

Ephemeral environments provide production-parity validation at branch level. Each AI-generated branch gets its own isolated environment with the same model versions, configurations, and representative data. This enables parallel validation of competing solutions and gives human reviewers confidence that what the agent built actually works before they ever look at the code.

```yaml
# ephemeral-environment.yaml
ephemeral_environments:
  trigger:
    - pull_request
    - agent_branch  # AI agent creates a branch → environment spins up

  provisioning:
    method: kubernetes_namespace  # or serverless, VM, container
    ttl: 4h                      # auto-destroy after 4 hours of inactivity
    max_concurrent: 10           # limit parallel environments

  parity:
    model_versions: production   # same model versions as prod
    inference_config: production # same temperature, tokens, safety
    vector_db: staging_snapshot  # representative data sample
    safety_filters: enabled      # never skip guardrails

  validation:
    run_on_create:
      - unit_tests
      - integration_tests
      - eval_suite              # Factor 6 evaluation gates
      - safety_checks           # Factor 7 guardrails
      - cost_estimation         # Factor 20 budget check
    report_to: pull_request     # post results as PR comment

  cost_controls:
    budget_per_environment_usd: 10
    shutdown_on_budget_exceeded: true
```

This pattern is especially powerful when combined with Factor 18 (Agent Orchestration): an autonomous agent creates a branch, the ephemeral environment validates it, and the results feed back to the agent for iteration — or surface to a human reviewer when the solution passes all gates.

### Dev Containers for Environment Parity

[Dev containers](https://containers.dev) (VS Code Dev Containers, GitHub Codespaces, Gitpod) standardize the local development environment as code — a `devcontainer.json` specifying the base image, CUDA drivers, Python version, environment variables, and VS Code extensions. For AI applications, the dev container spec closes the "works on my machine" gap for model serving dependencies.

The dev container spec is versioned alongside application code (Factor 1), meaning new developers and CI pipelines share the same environment. This is especially valuable for teams where some members have NVIDIA GPUs and others have Apple Silicon — the dev container uses the appropriate base image per platform via multi-arch variants.

### Region and Data-Residency Parity

For applications with data residency requirements (GDPR, LGPD, data sovereignty laws), environment parity extends to cloud regions. Staging must be in the same cloud region as production, and AI provider API calls must route to the same data-processing region.

A "data must stay in EU" requirement violated in staging creates gaps that only appear in production compliance audits. Key parity dimensions:
- **AI provider region**: Anthropic, OpenAI, Google all offer EU-based API endpoints — ensure staging and production call the same one
- **Vector database region**: embeddings of user data must co-locate with the data residency requirements of the source documents
- **Object store region**: multimodal assets (images, documents) must be stored in the required geography

Document region assignments in the environment config alongside model versions.

### Traffic Mirroring / Shadow Mode

Traffic mirroring (shadow traffic, dark launch) runs new model versions or prompt changes against real production traffic without serving results to users. The shadow response is logged and evaluated, providing production-fidelity validation before cutover.

```yaml
# AI Gateway shadow routing config
routes:
  - name: document-summary
    primary: anthropic/claude-sonnet-4-6
    shadow:
      model: anthropic/claude-opus-4-7   # evaluate new model on live traffic
      sample_rate: 0.10                  # mirror 10% of requests
      log_responses: true
      evaluate_quality: true             # run Factor 6 eval on shadow responses
      compare_against: primary           # surface quality diff in dashboard
```

Shadow mode is the production-safe way to validate Factor 6 quality gates against real traffic distributions, not just golden datasets. Implement via your AI Gateway's routing layer (Factor 10) to avoid shadow traffic logic in application code.

### Accepted Divergences
Some differences are intentional and acceptable if documented:

- **Cost controls**: Lower spending limits in non-production environments.
- **Rate limits**: Reduced limits in staging to control costs.
- **Data volume**: Staging doesn't need the full production dataset — but needs a representative sample.
- **Credentials**: Different API keys per environment (obviously).
- **Observability detail**: More verbose logging in development.

What should **never** diverge:
- Model versions (unless explicitly testing a model upgrade)
- Inference parameters (temperature, top-p, etc.)
- Safety and guardrail settings
- Prompt template content
- Embedding model (requires re-embedding to change)

## Compliance Checklist

- [ ] Production and staging use the same model versions for all AI services
- [ ] Inference parameters (temperature, max tokens, etc.) are consistent across environments
- [ ] Safety filters and guardrails are enabled in all environments, including development
- [ ] Staging vector databases contain representative samples of production data
- [ ] Embedding models are consistent across environments
- [ ] Intentional environment divergences are documented with rationale
- [ ] Automated parity checks compare configurations across environments
- [ ] Ephemeral environments spin up per branch to validate AI-generated code with production parity
- [ ] Staging data is refreshed on a regular cadence
- [ ] The evaluation suite (Factor 6) runs against the same model configuration used in production
- [ ] Dev container specs are versioned in the repository and include AI-specific dependencies (CUDA, model files, environment variables)
- [ ] Data-residency parity is validated: staging AI provider calls and data stores use the same region/geography as production
- [ ] Traffic mirroring (shadow mode) is available via the AI Gateway for validating new models or prompts against production traffic distributions
