# Factor 4: Configuration, Credentials, and Context

> Store configuration in the environment, credentials in secrets management, and AI context in versioned, structured files — never hardcode any of them.

## Motivation

The original factor had one rule: store config in the environment. It drew a clean line between code (which doesn't change between deploys) and config (which does). That principle holds, but AI applications have introduced an entirely new category of configuration that demands its own discipline.

AI systems require configuration that goes beyond traditional environment variables: model selection, temperature and sampling parameters, token limits, cost budgets, safety thresholds, and prompt routing rules. Some of these look like config (model name, temperature), some look like code (prompt templates), and some look like policy (cost limits, safety thresholds). Misclassifying them leads to either unsafe practices (credentials in code) or operational rigidity (behavior that should be tunable locked in source).

## What This Replaces

**Original Factor #3 / Beyond 15 #5: Config** — "Store config in the environment."

This update splits the original concept into three distinct categories with different handling:

- **Configuration**: Environment-specific values (URLs, feature flags, model parameters)
- **Credentials**: Secrets that grant access (API keys, tokens, certificates)
- **Context**: AI-specific structured config (model selection, inference parameters, cost budgets)

## How AI Changes This

### AI-Assisted Development
- AI tools need API keys to function. These must go through secrets management — never committed to repos, even in `.env.example` files with placeholder values that get accidentally filled in.
- Configuration for AI coding assistants (which model, which context, which rules) should be in versioned config files, not scattered across tool settings UIs.

### AI-Native Applications
- **Model selection as config**: Which model handles which request is a configuration decision, not a code decision. It should be changeable without redeployment.
- **Inference parameters**: Temperature, top-p, max tokens, stop sequences — these are tunable per environment. A staging environment might use higher temperature for diversity testing; production uses lower values for consistency.
- **Cost budgets**: Per-request, per-user, and per-tenant cost limits are configuration values that operators must be able to adjust without code changes.
- **Safety thresholds**: Content filtering sensitivity, PII detection thresholds, and human-in-the-loop triggers are policy decisions expressed as configuration.
- **Provider routing**: Rules for routing requests to different model providers (primary, fallback, cost-optimized) are config, not code.

## In Practice

### The Three Categories

**1. Configuration (Environment Variables / Config Files)**
Changes between environments. Never contains secrets. Safe to log.

```bash
# Traditional config
DATABASE_URL=postgres://db:5432/myapp
FEATURE_FLAG_NEW_UI=true

# AI-specific config
AI_DEFAULT_MODEL=claude-sonnet-4-5-20250929
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.3
AI_COST_BUDGET_DAILY_USD=500          # see Factor 20 for full budget hierarchy
AI_RATE_LIMIT_RPM=1000
```

**2. Credentials (Secrets Manager)**
Grants access to services. Never in environment variables on disk. Rotated regularly. Audited on access.

```yaml
# These go in Vault, AWS Secrets Manager, GCP Secret Manager, etc.
# NEVER in .env files, config maps, or environment variables in CI logs
secrets:
  - ANTHROPIC_API_KEY
  - OPENAI_API_KEY
  - PINECONE_API_KEY
  - DATABASE_PASSWORD
  - VECTOR_DB_TOKEN
```

**3. AI Context (Versioned Config Files)**
Structured configuration specific to AI behavior. Too complex for flat env vars. Needs versioning and review.

```yaml
# ai-config.yaml — versioned in repo, values vary by environment
models:
  summarization:
    provider: anthropic
    model: claude-sonnet-4-5-20250929
    temperature: 0.3
    max_tokens: 1024
    cost_limit_per_request_usd: 0.05  # Factor 20 defines the full budget hierarchy
    timeout_seconds: 30
    fallback:
      provider: anthropic
      model: claude-haiku-4-5-20251001

  classification:
    provider: openai
    model: gpt-4o-mini
    temperature: 0.0
    max_tokens: 100

safety:
  content_filter_threshold: 0.8
  pii_detection_enabled: true
  human_review_threshold: 0.6

rate_limits:
  per_user_rpm: 20
  per_tenant_daily_tokens: 1000000
```

### Environment-Specific Overrides
Use layered configuration with environment-specific overrides:

```
ai-config.yaml                  # Base configuration (committed)
ai-config.staging.yaml          # Staging overrides (committed)
ai-config.production.yaml       # Production overrides (committed)
ai-config.local.yaml            # Local overrides (gitignored)
```

### Anti-Patterns to Avoid
- **API keys in environment variables on disk**: Use mounted secrets or runtime injection from a secrets manager.
- **Model names hardcoded in source**: Changing a model shouldn't require a code change and redeploy.
- **Temperature values in application code**: These are tuning parameters, not business logic.
- **Cost limits only in code**: Operators need to adjust budgets without developer involvement.
- **Mixing credentials and configuration**: Don't put API keys in the same config map as feature flags. Different sensitivity levels require different storage.

### OIDC and Workload Identity (Keyless Auth)

Long-lived API keys are a credential rotation liability and a breach vector. Replace them with **Workload Identity Federation**: cloud platforms issue short-lived OIDC tokens that services exchange for AI provider credentials at runtime — no static secrets to rotate or leak.

- **GCP Workload Identity**: Kubernetes service accounts federate to GCP IAM roles
- **AWS IAM Roles for Service Accounts (IRSA)**: pods assume IAM roles via projected service account tokens
- **SPIFFE/SPIRE**: platform-agnostic workload identity for multi-cloud or on-prem environments

Most major AI providers (Anthropic, Google, AWS Bedrock) support workload identity federation for API access as of 2025-2026. The pattern: the application requests a short-lived token from the cloud identity provider and presents it to the AI provider — no `ANTHROPIC_API_KEY` in environment variables.

### OpenFeature for Dynamic Configuration

[OpenFeature](https://openfeature.dev) (CNCF standard) decouples feature flag evaluation from implementation. Instead of bespoke flag systems for model selection, A/B routing, or capability toggles, use an OpenFeature-compatible provider (LaunchDarkly, Flagsmith, Unleash, Flipt, Harness). This enables:
- Integration-testing flag evaluation without a live flag service dependency
- Consistent flag semantics across services using different providers
- Model routing decisions expressed as flag evaluations, observable and auditable

```python
client = OpenFeature.get_client()
model = client.get_string_value("ai.summarization.model", "claude-sonnet-4-6", ctx)
```

### HSM/KMS for AI Context Encryption

Sensitive AI context — RAG documents containing PII, medical records, or financial data injected into prompts — must be encrypted at rest and in transit. Use hardware-backed keys:

- **AWS KMS** / **GCP Cloud KMS** / **Azure Key Vault** for cloud-hosted applications
- **HashiCorp Vault Transit** secrets engine for multi-cloud or on-prem
- **HSMs** (Hardware Security Modules) for regulated industries requiring FIPS 140-2 Level 3

Encryption keys must never coexist with the encrypted context in the same config file or the same environment variable set. Apply envelope encryption: the data key encrypts the context; the master key (HSM/KMS-backed) encrypts the data key.

### Configuration Validation
Validate AI configuration at startup — fail fast if configuration is invalid:

```python
# Validate at startup, not at first request
def validate_ai_config(config):
    assert config.temperature >= 0.0 and config.temperature <= 2.0
    assert config.max_tokens > 0 and config.max_tokens <= model_context_limit
    assert config.cost_limit_per_request > 0
    assert config.model in SUPPORTED_MODELS
    assert config.timeout_seconds > 0
```

## Compliance Checklist

- [ ] No credentials (API keys, tokens, passwords) exist in source code or config files
- [ ] Credentials are managed through a dedicated secrets manager with access auditing
- [ ] Environment-specific configuration is injected at runtime, not baked into builds
- [ ] AI model selection and parameters are externalized configuration, not hardcoded
- [ ] Cost budgets and rate limits are configurable without code changes
- [ ] Safety thresholds and content filtering settings are configurable per environment
- [ ] AI configuration files are validated at application startup
- [ ] Configuration changes are auditable (who changed what, when)
- [ ] Local development uses `.env` or equivalent files that are gitignored
- [ ] Sensitive configuration values are never logged or exposed in error messages
- [ ] AI service credentials use Workload Identity Federation (OIDC/IRSA/SPIFFE) rather than static API keys wherever the provider supports it
- [ ] Feature flags for model selection and routing use an OpenFeature-compatible provider, not bespoke flag systems
- [ ] Sensitive AI context (PII-containing RAG documents, medical/financial data) is encrypted with HSM/KMS-backed keys; encryption keys are never co-located with encrypted data
