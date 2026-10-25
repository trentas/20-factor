---
layout: page
importance: 5
category: "Tier 2: Construction"
title: "05. Immutable Build Pipeline"
nav_order: 1
description: "Build once, deploy everywhere — with prompt compilation, model pinning, and eval gates."
---

# Factor 5: Immutable Build Pipeline

> Build once, deploy everywhere — and extend the pipeline to compile prompts, pin model versions, and gate releases on evaluation results.

## Motivation

The original factor emphasized strict separation of build, release, and run stages with immutable releases. Every release is a unique, immutable artifact tagged with a timestamp or version. You never patch a running deployment — you build a new release and deploy it.

AI applications raise the stakes. A "build" now includes more than compiling code and bundling assets. It may include compiling prompt templates, resolving model version references, bundling evaluation datasets, and running quality gates that go beyond traditional tests. The non-deterministic nature of AI outputs makes the pipeline more complex: you can't just assert that a function returns the expected value — you need statistical evaluation of output quality.

## What This Replaces

**Original Factor #5 / Beyond 15 #4: Build, Release, Run** — "Strictly separate build and run stages."

This update retains the immutability principle and extends the pipeline to include:

- Prompt template compilation and validation
- Model version resolution and pinning
- Evaluation gates (quality, safety, cost) as CI checks
- AI artifact bundling alongside traditional build outputs

## How AI Changes This

### AI-Assisted Development
- AI can assist in pipeline authoring (generating CI configs, Dockerfiles, deployment manifests) but pipeline definitions must be reviewed and versioned like any other code (Factor 1).
- AI-assisted code review can be a stage in the pipeline — automated review comments, security scanning, and style checking.
- **Autonomous coding agents** (Claude Code, Devin, Codex) can trigger the full build-eval-release pipeline on their own branches. The pipeline must be robust enough to validate agent-generated code without human supervision — evaluation gates (quality, safety, cost) are the automated quality bar that agent contributions must clear before human review.

### AI-Native Applications
- **Prompt compilation**: Prompt templates with variables, includes, and conditional sections are compiled into concrete prompts at build time. This catches template errors before runtime.
- **Model version pinning**: The build stage resolves model references (e.g., a floating alias) to specific, immutable model identifiers and records them in the release manifest — along with the provider API version and protocol versions (MCP, A2A) the release was tested against. What counts as immutable differs by provider; see Factor 16.
- **Evaluation gates**: Before a release is promoted, automated evaluations run against golden datasets. Releases that fail quality thresholds (accuracy, safety, cost) are blocked.
- **Artifact composition**: A release artifact includes the application binary, compiled prompts, model version manifest, evaluation results, and deployment configuration — all immutable and tied to a single version.

## In Practice

### The Extended Pipeline

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌───────┐
│ BUILD   │───▶│ EVAL    │───▶│ RELEASE │───▶│ DEPLOY   │───▶│ RUN   │
│         │    │         │    │         │    │          │    │       │
│ Compile │    │ Quality │    │ Tag +   │    │ Roll out │    │ Serve │
│ Test    │    │ Safety  │    │ Seal    │    │          │    │       │
│ Bundle  │    │ Cost    │    │         │    │          │    │       │
└─────────┘    └─────────┘    └─────────┘    └──────────┘    └───────┘
```

### Build Stage
The build stage produces a deterministic artifact. Whatever CI system runs it, the stage:

- **Installs dependencies from a lockfile** (Factor 3), never from floating version ranges.
- **Compiles and validates prompt templates**: every variable is bound, every include resolves, and structured-output schemas are valid. A template error fails the build instead of a request at runtime.
- **Resolves model references to pinned identifiers** and writes them into the model manifest (Factor 16).
- **Runs the unit tests, builds the container image, and scans it for vulnerabilities** before anything can be released.

### Evaluation Stage
Evaluations are the AI equivalent of integration tests — they gate the pipeline. They run against the build's own model manifest, so the release is evaluated with exactly the models it will ship with:

| Gate | Example threshold | Blocks the release when |
|------|-------------------|-------------------------|
| **Quality** | Accuracy ≥ 0.92 on the golden dataset | The score falls below the threshold (judged on its confidence interval — Factor 6) or regresses against the current release |
| **Safety** | Toxic outputs ≤ 1% and PII leaks ≤ 0.1% of cases | Any safety threshold is exceeded |
| **Cost** | Mean cost ≤ $0.05 per request; p99 output ≤ 4,096 tokens | The release would cost more to run than budgeted (Factor 20) |

### Release Manifest
The release artifact is immutable and self-describing. A minimal manifest:

```json
{
  "version": "2026.10.22-abc123f",
  "source": "git+https://example.com/app@abc123f",
  "artifacts": {
    "container": "registry.example.com/app@sha256:…",
    "prompts": "sha256:…",
    "skills": "sha256:…",
    "sbom": "sha256:…"
  },
  "models": {
    "summarization": { "id": "<pinned model ID>", "effort": "medium", "provider_api_version": "<pinned>" }
  },
  "protocols": { "mcp": "2026-07-28", "mcp_servers": { "knowledge-base": "2.3.1" } },
  "evaluations": { "report": "sha256:…", "quality_accuracy": 0.94, "safety_toxicity": 0.003 },
  "config_hash": "sha256:…"
}
```

- **Reference every artifact by content digest**, not by a mutable tag or path — a tag can be repointed after the release is sealed.
- **Record what the release was tested against**: pinned model IDs with their effort settings, the provider API version, and the MCP/A2A protocol and server versions (Factor 2, Factor 16).
- **Attach the evaluation report, not just the scores.** It is the evidence that this release passed its gates.

### AI Bill of Materials (AIBOM/MLBOM)

By 2026 the build is expected to emit a machine-readable **AI Bill of Materials** — the equivalent of an SBOM, but for AI artifacts. The two consolidating standards:

- **CycloneDX 1.6** with the ML/AI extension — describes models, datasets, evaluation suites, and guardrails as bill-of-materials components
- **SPDX 3.0 AI profile** — alternative format with similar semantics

A minimal AIBOM entry per model includes: model identifier and version, weights checksum, training dataset references with licenses, evaluation results, intended use, known limitations.

Generate the AIBOM in the build from the model manifest, the evaluation results, the dataset lockfile, and the guardrail configuration, and sign it together with the other release artifacts (see below).

The AIBOM travels with the release. Downstream consumers (compliance, procurement, customers) verify it before deployment. No regulation mandates an AIBOM format, but several ask for the same information: the EU AI Act's technical documentation for high-risk systems (Annex IV) covers software versions, data sets, and model design (see Factor 7), and the EU Cyber Resilience Act makes a component inventory part of the technical documentation for products on the EU market (obligations from December 2027; vulnerability reporting already since September 2026 — see Factor 3). The NIST AI RMF is voluntary; customer and procurement contracts are where a specific format is most often required. Keep every release's SBOM and AIBOM queryable, so an advisory can be matched to the releases that ship the affected component within hours.

### Provenance, Signing, and Reproducibility

- **SLSA provenance, at a declared level**: emit provenance for every release artifact — container images, prompt bundles, fine-tuned model weights — stating what was built, from what source, on which build platform. SLSA Build levels describe the *build platform*, not the attestation file: Build L1 means provenance exists; L2 means the provenance is signed and generated by a hosted build platform; L3 requires a hardened build platform that isolates builds from one another and keeps the provenance-signing key out of reach of user-defined build steps. Generating and signing an attestation from your own build script does not make a release L3. State the level each artifact targets, chosen by its risk, and the evidence that your build platform meets it.
- **Sigstore / cosign signatures**: sign container images, prompt bundles, fine-tuned model weights, and the AIBOM. Verify signatures at deploy time — unsigned artifacts are refused.
- **Reproducible builds for ML**: re-running the same build with the same inputs produces byte-identical artifacts (where the toolchain allows). For non-deterministic training, capture seeds and dataset hashes so the *result* — not the bits — is reproducible to within statistical tolerance.

Further reading: [SLSA 1.2 — Build track basics](https://slsa.dev/spec/v1.2/build-track-basics); [SLSA 1.2 — Build requirements](https://slsa.dev/spec/v1.2/build-requirements).

### Immutability Rules
- **Never mutate a released artifact**. If a prompt needs changing, create a new release.
- **Never introduce a model version into a running deployment.** A flag may switch only among model / prompt / parameter combinations that this release contains and that passed its evaluation gates — for example, the evaluated fallback (Factor 4). Any other combination, including a new model version, is a new release.
- **Evaluation results are part of the release**. They're not just CI output — they're the evidence that this release meets quality standards.
- **Rollback is deployment of a previous release**, not manual surgery on a running system.

### Data Migrations and Backfills

The original twelve-factor rule for admin processes still holds: run one-off tasks against the same release and configuration as the app ([12-Factor: Admin Processes](https://12factor.net/admin-processes)). Schema migrations and backfills are part of the release:

- **Same artifact, narrow identity.** A migration runs as a job built from the release artifact and its configuration (Factor 4), under an identity that can change the schema and little else (Factor 8).
- **Expand, then contract.** During a rolling or canary deployment, old and new code run against the same data. Add new structures first, ship code that works with both shapes, backfill, and remove the old structures only in a later release — so rolling back the application never requires rolling back the schema.
- **Resumable, idempotent backfills.** Process in batches with a recorded checkpoint, throttle against production load, and make re-running a batch harmless (Factor 13).
- **One runner at a time.** A lock, or the migration tool's own bookkeeping, keeps two runners from applying the same migration concurrently.
- **Verify before depending on it.** Check counts, constraints, and invariants after a backfill, before the code that relies on it ships. Re-embedding a vector index after an embedding-model change follows the same pattern: build the new index next to the old one, verify, then switch (Factor 17).

### Progressive Delivery
For AI applications, progressive delivery is essential because behavior changes are harder to predict:

- **Canary deployments**: Route a small percentage of traffic to the new release and monitor quality metrics.
- **Shadow deployments**: Run the new release alongside production, compare outputs, but don't serve the new outputs to users.
- **Feature flags for AI features**: Gate AI-powered features behind flags that can be toggled without redeployment.

## Compliance Checklist

- [ ] Build, evaluation, release, and run stages are strictly separated
- [ ] Build artifacts are immutable — never patched in place
- [ ] Each release has a unique, traceable version identifier
- [ ] Prompt templates are compiled and validated during the build stage
- [ ] Model versions are resolved and pinned at build time, recorded in the release manifest together with effort settings, provider API version, and MCP/A2A protocol and server versions
- [ ] Automated evaluations gate the pipeline — failed evals block the release
- [ ] Evaluation results (quality, safety, cost) are recorded as part of the release metadata
- [ ] Container images are scanned for vulnerabilities before release
- [ ] Rollback is achieved by deploying a previous immutable release
- [ ] Progressive delivery mechanisms (canary, shadow) are used for AI feature releases
- [ ] An AI Bill of Materials (CycloneDX 1.6 ML or SPDX 3.0 AI) is emitted as a release artifact and signed, and every supported release's SBOM/AIBOM stays queryable for vulnerability matching
- [ ] SLSA provenance attestations are generated for container images, prompt bundles, and fine-tuned model weights
- [ ] Release artifacts are signed (sigstore/cosign) and signatures are verified at deploy time
- [ ] Builds are reproducible — same inputs produce byte-identical outputs (with documented exceptions for non-deterministic training, where seeds and dataset hashes are captured)
- [ ] Schema migrations and backfills run as jobs from the same release, stay backward-compatible during rollout (expand/contract), and are resumable and verified before dependent code ships
