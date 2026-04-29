---
title: "01. Declarative Codebase"
parent: "Tier 1: Foundation"
nav_order: 1
description: "Every artifact — code, infrastructure, prompts — lives in version control as a declarative specification."
---

# Factor 1: Declarative Codebase

> Every artifact — application code, infrastructure, configuration, and AI prompts — lives in version control as a declarative, reproducible specification.

## Motivation

A codebase is the single source of truth for a system. In the original 12-Factor App, this meant "one codebase tracked in revision control, many deploys." That principle remains, but the scope of what constitutes a "codebase" has expanded dramatically. Infrastructure-as-Code (IaC), GitOps pipelines, and now prompt-as-code mean the declarative codebase encompasses far more than application source files.

When AI is both a tool used in development and a component of the running system, the boundary of "code" blurs. A system prompt is as much a part of the application's behavior as a controller or service class. If it isn't versioned, reviewed, and deployed through the same pipeline, it's shadow configuration — invisible, unauditable, and unreproducible.

## What This Replaces

**Original Factor #1: Codebase** — "One codebase tracked in revision control, many deploys."

The original factor focused on the relationship between a codebase and its deploys. This update retains that principle and extends it to cover:

- Infrastructure definitions (Terraform, Pulumi, CloudFormation)
- GitOps manifests (Kubernetes YAML, Helm charts, Kustomize overlays)
- AI prompts, system instructions, and agent tool definitions
- Evaluation datasets and quality benchmarks
- Pipeline definitions (CI/CD as code)

## How AI Changes This

### AI-Assisted Development
- AI coding assistants (Copilot, Claude Code, Cursor) generate code that must still pass the same review, lint, and test gates as human-written code. The codebase is the arbiter, not the generation method.
- AI-generated code should be indistinguishable from human-written code in the repository — no special markers or second-class treatment.
- Context files (`.cursorrules`, `CLAUDE.md`, `.github/copilot-instructions.md`) that guide AI coding assistants are themselves part of the codebase and should be versioned.
- **Autonomous coding agents** (Claude Code, Devin, Codex) can create branches, write code, run tests, and open pull requests autonomously. The codebase must be prepared for this: CI gates, evaluation suites (Factor 6), and ephemeral environments (Factor 11) must validate agent-generated changes without human intervention in the loop. The human reviews the output, not the process.

### AI-Native Applications
- **Prompt-as-code**: System prompts, few-shot examples, and chain-of-thought templates are versioned alongside application code. They go through pull requests, code review, and CI checks.
- **Agent tool schemas**: Tool definitions (JSON Schema, OpenAPI specs) that define what an AI agent can do are declarative specifications that belong in the codebase.
- **Evaluation datasets**: The golden datasets used to evaluate AI output quality are versioned artifacts, analogous to test fixtures.
- **Model configuration**: Model selection, temperature, token limits, and other inference parameters are declared in config files, not buried in application code.

## In Practice

### Repository Structure
Organize AI artifacts alongside traditional code:

```
repo/
├── src/                    # Application source
├── infra/                  # IaC definitions
├── k8s/                    # GitOps manifests
├── prompts/                # Versioned prompt templates
│   ├── system.md
│   ├── few-shot-examples/
│   └── chains/
├── evals/                  # Evaluation datasets and configs
│   ├── golden-set.jsonl
│   └── eval-config.yaml
├── tools/                  # Agent tool schemas
│   └── tool-definitions.json
├── .cursorrules            # AI coding assistant context
├── CLAUDE.md               # AI coding assistant context (Claude Code)
├── .github/copilot-instructions.md  # AI coding assistant context (Copilot)
└── pipeline.yaml           # CI/CD definition
```

### Prompt Versioning
Treat prompts as first-class code artifacts with variable interpolation:

```markdown
# prompts/summarization/system.md
You are a document summarizer for {{company_name}}.

## Instructions
- Summarize the document in {{language}}, max {{max_sentences}} sentences.
- Preserve all numerical data and proper nouns.
- If the document contains PII, replace it with [REDACTED].

## Context
{{retrieved_context}}
```

```python
# Prompts are loaded, rendered, and validated — not hardcoded strings
prompt = PromptTemplate.load("prompts/summarization/system.md")
rendered = prompt.render(
    company_name="Acme Corp",
    language="en",
    max_sentences=5,
    retrieved_context=context,
)
```

Use pull requests for prompt changes — diffs are meaningful and reviewable. Tag prompt versions that correspond to production deployments.

### CI Validation for AI Artifacts
Validate prompts and schemas in the CI pipeline, just like application code:

```yaml
# .github/workflows/ai-checks.yaml
ai-validation:
  steps:
    - name: Validate prompt templates
      run: |
        python -m promptlint prompts/          # check syntax, undefined variables
    - name: Validate tool schemas
      run: |
        jsonschema-lint tools/*.json           # valid JSON Schema
    - name: Check context budgets
      run: |
        python scripts/check_token_budgets.py  # prompts fit within allocated budgets
    - name: Run eval quick-suite
      run: |
        python -m eval run --suite quick       # fast subset of evals (Factor 6)
```

### GitOps for AI
Declare model versions, endpoint configurations, and feature flags in Git:

```yaml
# deploy/ai-config.yaml — GitOps deploys this on merge to main
models:
  summarization:
    model: claude-sonnet-4-5-20250929
    version_pinned: "2025-09-29"
    rollback_to: claude-sonnet-4-5-20250514    # previous known-good
  classification:
    model: claude-haiku-4-5-20251001

feature_flags:
  use_new_rag_pipeline: false                  # toggle without redeploy
  enable_streaming: true
```

Rollback is a `git revert`, not a manual infrastructure change.

### AIBOM as a Build Output

A Software Bill of Materials (SBOM) catalogs every software component in a release. For AI applications, this extends to an **AI Bill of Materials (AIBOM)** — also called an MLBOM — listing model identifiers, prompt versions, evaluation scores, and training data references. Generate AIBOMs in SPDX 3.0 (AI Profile) or CycloneDX 1.6 (ML Extension) format as part of the build pipeline (Factor 5).

The AIBOM is a versioned artifact alongside application code, answering: "What model is in this release? What prompt? What eval score did it achieve?" It is required for supply-chain audits and increasingly expected by enterprise procurement.

### Secrets in Git: SOPS and Sealed Secrets

GitOps workflows often need encrypted values committed to the repository. [Mozilla SOPS](https://github.com/mozilla/sops) encrypts file values using AWS KMS, GCP KMS, or age keys — keeping structure visible in diffs while keeping values encrypted. [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) for Kubernetes encrypts secrets with a cluster-side public key so only the cluster can decrypt them. Both patterns allow AI API keys, model registry tokens, and vector database credentials to be managed in Git without plaintext exposure.

### Monorepo vs. Multi-repo
The original factor's "one codebase, many deploys" still applies. Whether using a monorepo or multi-repo strategy, each deployable unit has a single codebase. Shared libraries are dependencies (Factor 3), not copy-pasted code.

## Compliance Checklist

- [ ] All application code is in version control with a clear branching strategy
- [ ] Infrastructure is defined as code (Terraform, Pulumi, CDK, etc.) and versioned
- [ ] Deployment manifests are declarative and versioned (Helm, Kustomize, etc.)
- [ ] CI/CD pipelines are defined as code, not configured through UIs
- [ ] AI system prompts and templates are versioned alongside application code
- [ ] Agent tool definitions and schemas are in the repository
- [ ] Evaluation datasets and benchmarks are versioned artifacts
- [ ] AI coding assistant context files are maintained and versioned
- [ ] Model configuration (selection, parameters) is declared in config files
- [ ] Every production deployment is traceable to a specific commit
- [ ] An AIBOM/MLBOM is generated as a build output in SPDX 3.0 or CycloneDX 1.6 format
- [ ] Encrypted secrets committed to Git use SOPS or Sealed Secrets — no plaintext secrets in any branch
