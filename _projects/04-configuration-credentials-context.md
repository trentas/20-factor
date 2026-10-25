---
layout: page
importance: 4
category: "Tier 1: Foundation"
title: "04. Configuration, Credentials, and Context"
nav_order: 4
description: "Store config in the environment, credentials in secrets management, AI context in versioned files."
---

# Factor 4: Configuration, Credentials, and Context

> Store configuration in the environment, credentials in secrets management, and AI context in versioned, structured files — never hardcode any of them.

## Motivation

The original factor had one rule: store config in the environment. It drew a clean line between code (which doesn't change between deploys) and config (which does). That principle holds, but AI applications have introduced an entirely new category of configuration that demands its own discipline.

AI systems require configuration that goes beyond traditional environment variables: model selection, reasoning effort, token limits, cost budgets, safety thresholds, and prompt routing rules. Some of these look like config (model name, effort level), some look like code (prompt templates), and some look like policy (cost limits, safety thresholds). Misclassifying them leads to either unsafe practices (credentials in code) or operational rigidity (behavior that should be tunable locked in source).

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
- **Model selection as config**: Which model handles which request is a configuration decision, not a code decision. Switching among models that a release has already evaluated should not require a redeploy; introducing a model that has never been evaluated is a new release (Factor 5).
- **Inference parameters**: Reasoning effort, max tokens, stop sequences, and — only where the model still accepts them — sampling parameters such as temperature and top-p. These are tunable per environment, but the parameter *set* is model-specific: reasoning models increasingly fix sampling (Claude 4.7 and later accept only the default values, and from Anthropic API version `2026-10-21` sending `temperature`, `top_p`, or `top_k` is an error on every Claude model), and effort has become the main quality/cost knob. Validate parameters against what the pinned model supports instead of assuming a universal set.
- **Cost budgets**: Per-request, per-user, and per-tenant cost limits are configuration values that operators must be able to adjust without code changes.
- **Safety thresholds**: Content filtering sensitivity, PII detection thresholds, and human-in-the-loop triggers are policy decisions expressed as configuration.
- **Provider routing**: Rules for routing requests to different model providers (primary, fallback, cost-optimized) are config, not code.

## Runtime vs. Init-Time Configuration

This factor sits in the Foundation tier because it defines the **contract** between code and configuration — where values live, how they're classified, how they're validated. That contract is foundational; build, identity, and every operational concern downstream assume it holds. But configuration is consumed at two distinct moments, and conflating them leads to design mistakes.

**Init-time configuration** is read once when the process starts: database URLs, default model selection, max token limits, the schema of `ai-config.yaml`. It's validated at startup (fail-fast — see "Configuration Validation" below) and treated as immutable for the lifetime of that process. Changing it requires a redeploy or a process restart. This is the territory the original 12-Factor Config rule was written for.

**Runtime configuration** changes while the process is live: feature flags toggling a new model, cost budgets tightened mid-incident, safety thresholds raised in response to a regression, provider routing flipping during a provider outage. Operators must be able to adjust these *without a deploy*. The mechanism is different (flag provider, dynamic config service, hot-reloaded file) but the contract is the same: the value is still externalized, classified, audited, and never in code.

The same value can be either, depending on the system: `AI_DEFAULT_MODEL` as an env var is init-time; the same decision expressed as an OpenFeature flag is runtime. Choosing between them is a deliberate tradeoff between simplicity (init-time, restart to change) and operational agility (runtime, change without deploy, but adds a runtime dependency on the flag provider — see Factor 10).

**Why both belong in this factor**: the *contract* is foundational. The *enforcement and observability* of runtime changes belongs to the Operation tier:

- **Factor 15 (Observability)** — runtime config changes must be auditable: who flipped which flag, when, with what blast radius.
- **Factor 18 (Agent Orchestration)** — bounded autonomy is partially expressed as runtime config (autonomy levels, tool allowlists) that operators tune live.
- **Factor 20 (AI Economics)** — cost budgets and per-tenant limits are runtime knobs operators must adjust as usage shifts.

Treat init-time config as the default. Promote a value to runtime config only when there's a concrete operational need to change it without a deploy — every runtime knob is a surface that can be misconfigured in production.

**Runtime model switching has a boundary.** A flag or dynamic config may select only among model / prompt / parameter combinations that shipped in the current release and passed its evaluation gates (Factor 5, Factor 6) — for example, flipping to the evaluated fallback during a provider outage. Record the policy version and the effective selection on every execution (Factor 15). A combination that has never been evaluated is not a configuration change: it needs an evaluation run and a new release.

## In Practice

### The Three Categories

| Category | Examples | Where it lives | Handling |
|----------|----------|----------------|----------|
| **Configuration** | Database URL, feature flags, default model, effort level, max tokens, daily cost budget, rate limits | Environment variables or config files | Changes between environments. Never contains secrets. Safe to log. |
| **Credentials** | Model-provider API keys, vector-store tokens, database passwords | A secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager, …), mounted or injected at runtime | Never in `.env` files, config maps, or CI logs. Rotated regularly. Audited on access. |
| **AI context** | Per-task model routing, effort and token limits, fallbacks, safety thresholds, per-user and per-tenant limits | Versioned, reviewed structured files (for example `ai-config.yaml`) | Too structured for flat environment variables. Changes go through review like code. |

A structured AI context file groups settings by task. For each task it names:

- **The model**: provider and pinned model ID, plus an evaluated fallback (Factor 16).
- **Inference parameters**: effort level, max output tokens, and sampling parameters only where the pinned model accepts them. Keep them next to the model pin — they are model-specific, so a model change forces you to revisit them.
- **Limits**: timeout and per-request cost limit (Factor 20 defines the full budget hierarchy).

Alongside the tasks, the same file holds the safety thresholds (content-filter sensitivity, PII detection, the score that triggers human review) and the per-user and per-tenant limits.

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
- **Inference parameters in application code**: Effort levels and sampling values are tuning parameters, not business logic — and they are model-specific, so they belong next to the model pin, where a model change forces you to revisit them.
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
- Model routing decisions expressed as flag evaluations, observable and auditable — choosing only among evaluated combinations (see "Runtime model switching has a boundary" above)

### HSM/KMS for AI Context Encryption

Sensitive AI context — RAG documents containing PII, medical records, or financial data injected into prompts — must be encrypted at rest and in transit. Use hardware-backed keys:

- **AWS KMS** / **GCP Cloud KMS** / **Azure Key Vault** for cloud-hosted applications
- **HashiCorp Vault Transit** secrets engine for multi-cloud or on-prem
- **HSMs** (Hardware Security Modules) for regulated industries requiring FIPS 140-3 Level 3

Encryption keys must never coexist with the encrypted context in the same config file or the same environment variable set. Apply envelope encryption: the data key encrypts the context; the master key (HSM/KMS-backed) encrypts the data key.

**Plan for post-quantum crypto-agility.** AI data with a long confidentiality lifetime — agent memory (Factor 19), conversation archives, fine-tuning datasets — is exposed to "harvest now, decrypt later": traffic and ciphertext captured today can be decrypted once large quantum computers exist. Hybrid post-quantum key exchange (X25519 + ML-KEM-768) is already enabled by default in major browsers and supported by mainstream TLS libraries. Inventory where AI data is encrypted and for how long it must stay confidential, keep algorithm choices in configuration rather than code, and adopt the NIST post-quantum standards (ML-KEM for key establishment, ML-DSA for signatures) as your KMS/HSM and TLS stacks support them.

### Configuration Validation
Validate AI configuration at startup, not at the first request — fail fast if it is invalid:

- **Check it against the pinned model's capabilities**: the model is supported, the effort level is one the model offers, sampling parameters are present only if the model accepts them (many reasoning models accept none), and max tokens is positive and within the model's output limit.
- **Check limits are set and sane**: per-request cost limit and timeout are positive and within policy.
- **Fail with explicit errors, not `assert`.** Python removes `assert` statements when run with `-O`, so assert-based validation can silently disappear from an optimized production build. Raise a dedicated error that names the field, the value, and what is allowed, and stop the process before it takes traffic.

```python
# WRONG — stripped under `python -O`; invalid config reaches production
assert config.effort in caps.effort_levels

# RIGHT — explicit check; the process refuses to start with a clear message
if config.effort not in caps.effort_levels:
    raise ConfigError(f"effort={config.effort!r} is not supported by {config.model}; "
                      f"allowed: {sorted(caps.effort_levels)}")
```

Further reading: Python reference, [The `assert` statement](https://docs.python.org/3/reference/simple_stmts.html#the-assert-statement).

## Compliance Checklist

- [ ] No credentials (API keys, tokens, passwords) exist in source code or config files
- [ ] Credentials are managed through a dedicated secrets manager with access auditing
- [ ] Environment-specific configuration is injected at runtime, not baked into builds
- [ ] AI model selection and parameters are externalized configuration, not hardcoded
- [ ] Cost budgets and rate limits are configurable without code changes
- [ ] Safety thresholds and content filtering settings are configurable per environment
- [ ] AI configuration files are validated at application startup, including inference parameters against the pinned model's supported set (effort levels; sampling parameters only where the model accepts them)
- [ ] Configuration changes are auditable (who changed what, when)
- [ ] Each configuration value is explicitly classified as init-time (immutable for the process lifetime, requires restart to change) or runtime (changeable while the process is live via flag provider, dynamic config service, or hot-reload), and runtime changes are audited with the same rigor as deploys
- [ ] Local development uses `.env` or equivalent files that are gitignored
- [ ] Sensitive configuration values are never logged or exposed in error messages
- [ ] AI service credentials use Workload Identity Federation (OIDC/IRSA/SPIFFE) rather than static API keys wherever the provider supports it
- [ ] Feature flags for model selection and routing use an OpenFeature-compatible provider, not bespoke flag systems
- [ ] Sensitive AI context (PII-containing RAG documents, medical/financial data) is encrypted with HSM/KMS-backed keys; encryption keys are never co-located with encrypted data
- [ ] Encrypted AI data with a long confidentiality lifetime is inventoried, with a crypto-agility plan for post-quantum algorithms (hybrid ML-KEM in transit, PQC-capable KMS/HSM at rest)
