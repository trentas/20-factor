---
layout: page
importance: 3
category: "Tier 1: Foundation"
title: "03. Dependency Management"
nav_order: 3
description: "Explicitly declare and isolate all dependencies, including AI SDKs and model weights."
---

# Factor 3: Dependency Management

> Explicitly declare and isolate all dependencies — including AI SDKs, model weights, native ML libraries, and hardware-specific runtimes.

## Motivation

The original factor was clear: never rely on implicit system-wide packages. Declare every dependency explicitly and use isolation tools to prevent leakage from the host system. This principle is more important than ever, and the dependency surface has expanded significantly.

AI applications introduce dependencies that don't fit neatly into traditional package managers. ML frameworks depend on specific CUDA versions. Model weights are multi-gigabyte artifacts that need their own versioning and distribution. AI SDKs evolve rapidly with breaking changes. Native extensions require precise build environments. The gap between "it works on my machine" and "it works in production" grows when GPU drivers, BLAS libraries, and model files enter the picture.

## What This Replaces

**Original Factor #2: Dependencies** — "Explicitly declare and isolate dependencies."

This update retains the core principle and extends it to cover:

- AI/ML SDK dependencies and their rapid version churn
- Native ML library dependencies (CUDA, cuDNN, MKL, BLAS)
- Model weights and artifacts as versioned dependencies
- Hardware-specific runtime dependencies (GPU drivers, TPU runtimes)
- Python-specific challenges (virtual environments, conda, system packages)

## How AI Changes This

### AI-Assisted Development
- AI coding assistants may suggest dependencies. Review these carefully — AI models are trained on historical data and may suggest outdated, deprecated, or vulnerable packages.
- **Hallucinated packages ("slopsquatting")**: models sometimes recommend packages that don't exist — a 2025 USENIX Security study measured roughly 5% of suggested packages from commercial models and over 20% from open models as non-existent, often repeatably. Attackers register those names with malicious code. A coding agent that installs packages on its own turns a hallucination into code execution. Check that a new dependency exists, has history and a real maintainer, and is approved before it is installed — and route installs through a proxy registry or allowlist.
- **MCP servers and Agent Skills are dependencies too.** A server launched with `npx` or `uvx` is code running with the agent's permissions, and a skill can bundle scripts. In 2026, squatted MCP server packages appeared on npm under unscoped names imitating official servers (for example `mcp-server-figma`), running install-time scripts that sent host details to an attacker. Pin exact versions, prefer scoped packages from verified publishers, and disable install scripts where you can.
- Use lockfiles and version pinning to ensure deterministic builds regardless of who (or what) added the dependency.
- AI tools can help audit dependency trees for vulnerabilities, license compliance, and bloat.

### AI-Native Applications
- **AI SDK pinning**: The OpenAI SDK, Anthropic SDK, LangChain, LlamaIndex, and similar libraries release frequently with breaking changes. Pin exact versions and test upgrades explicitly.
- **Model weights as dependencies**: A model is a dependency. It must be versioned, pinned, and retrievable. Use model registries (MLflow, Weights & Biases, HuggingFace Hub) with explicit version references.
- **Native ML dependencies**: PyTorch, TensorFlow, and ONNX Runtime depend on specific CUDA/cuDNN versions. These must be declared, not assumed to exist on the host.
- **Hardware abstraction**: Dependencies on specific GPU architectures (NVIDIA, AMD, Apple Silicon) must be explicit and handled through build variants or runtime detection.

## In Practice

### Layered Dependency Management
AI applications typically have multiple layers of dependencies:

```
Layer 1: Language dependencies     → package.json, requirements.txt, go.mod
Layer 2: Native/ML dependencies    → CUDA 12.4, cuDNN 9.x, MKL
Layer 3: Model dependencies        → model-registry://org/model@v2.1.0
Layer 4: Hardware dependencies     → NVIDIA Driver >= 550, GPU with >= 24GB VRAM
```

Each layer needs its own management strategy.

### Containerized Dependency Isolation
Use multi-stage builds to manage the complexity:

```dockerfile
# Stage 1: Build with full toolchain
FROM nvidia/cuda:12.4.1-devel-ubuntu22.04 AS builder
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime with minimal footprint
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /app/models /app/models
```

### Model Dependency Declaration
Declare model dependencies explicitly, just like code dependencies:

```yaml
# model-dependencies.yaml
models:
  embedding:
    registry: huggingface
    name: BAAI/bge-large-en-v1.5
    version: "e8c4f2a"   # pinned commit SHA, not a floating branch/PR ref
    sha256: "abc123..."
    size: 1.34GB
    required_memory: 3GB

  generation:
    provider: anthropic
    model: claude-sonnet-5-5
    pinned: true
    fallback: claude-haiku-5-5

  reranker:
    registry: internal
    name: custom-reranker
    version: "2.1.0"
    artifact: "s3://models/reranker/v2.1.0/model.onnx"
```

### AI SDK Version Strategy
- **Pin exact versions** in lockfiles — not ranges. AI SDKs change behavior across minor versions.
- **Test SDK upgrades** in isolation before merging. A new SDK version may change model behavior, token counting, or error handling.
- **Vendor API compatibility**: When using hosted model APIs (OpenAI, Anthropic, Google), pin API versions in headers or configuration, not just SDK versions.
- **Abstraction layers**: Consider thin abstraction layers over vendor SDKs to make provider switching feasible without rewriting application code.

### Lockfiles for Python AI Stacks

Most AI stacks are Python, and Python's lockfile story finally converged. **PEP 751** (accepted 2025) defines a standard lockfile format, `pylock.toml`, with growing tool support, and **uv** has become a common default for fast, reproducible resolution (`uv.lock`, exportable to `pylock.toml`). Whichever you use: commit the lockfile, install from it with hashes in CI and in container builds (`uv sync --frozen`, or a hash-checked install), and treat a lockfile change as a reviewable diff — it is where a malicious or hallucinated dependency first becomes visible.

### SLSA Provenance and sigstore for AI Artifacts

Beyond checksums, supply-chain security for AI artifacts requires provenance attestations that prove a model came from a known source and wasn't tampered with in transit. **SLSA provenance** records link a model artifact to its build pipeline. [sigstore/cosign](https://github.com/sigstore/cosign) can sign model weights and prompt artifacts at publish time and verify signatures at deploy time — blocking unsigned or tampered artifacts.

For models sourced from Hugging Face or other registries, prefer models with a verified commit hash over floating branch references, and pin the commit SHA in your model-dependencies manifest.

### Model Cards and Dataset Cards as Versioned Metadata

A **model card** (Hugging Face standard) documents intended use, limitations, training data summary, known biases, and evaluation results. A **dataset card** documents data provenance, licensing terms, and statistical characteristics. These should be stored alongside `model-dependencies.yaml` as versioned artifacts — they are part of the model dependency record, not separate documentation.

When using a third-party dataset for fine-tuning or evaluation, verify the license allows your intended use case (commercial, derivative works, etc.) and record this in the dataset card.

### AI Accelerator Diversity

AI workloads increasingly run on hardware beyond NVIDIA CUDA. Declare accelerator-specific dependencies explicitly and provide runtime detection or build variants:

- **AWS Trainium (Trn1/Trn2)** and **AWS Inferentia (Inf2)** — inference-optimized ASICs via the Neuron SDK
- **Google Cloud TPU (v5e, v6e "Trillium", v7 "Ironwood")** — requires JAX/XLA or PyTorch-XLA runtime
- **AMD ROCm** — HIP-compatible GPU compute, covers Instinct MI300X / MI325X / MI350 series
- **Apple Silicon / Metal** — MLX framework or Core ML for on-device/edge inference

Containers targeting specific accelerators use different base images and runtime libraries. Pin these alongside standard CUDA dependencies, and test the fallback path when the target accelerator is unavailable.

### Dependency Auditing
- Run vulnerability scans on AI-specific dependencies — ML libraries have had supply-chain attacks (malicious model files, compromised pip packages).
- Audit transitive dependencies — AI SDKs pull in large dependency trees.
- Monitor for model provenance — ensure model weights come from trusted sources with verified checksums.
- Prefer `safetensors` over pickle-based model formats, which can execute arbitrary code on load; scan any pickle-based artifact you can't avoid.
- Include MCP servers, Agent Skills, and model artifacts in the SBOM/AIBOM, so a vulnerability or compromise in any of them can be matched to the releases that ship it.

### EU Cyber Resilience Act: Dependencies Become Obligations

The **Cyber Resilience Act (CRA)** makes dependency hygiene a legal duty for anyone placing software on the EU market. Its reporting obligations have applied since **11 September 2026**: manufacturers must report actively exploited vulnerabilities and severe security incidents through ENISA's single reporting platform — a 24-hour early warning, a 72-hour notification, and a final report (14 days after a fix is available for vulnerabilities; one month for incidents). This applies to products already on the market, not only new ones. Most other obligations — including documenting components in an SBOM, handling vulnerabilities for the support period, and shipping security updates — apply from **11 December 2027**. Open-source stewards have a lighter regime, but a company shipping open-source components commercially is a manufacturer.

Architecturally, a 24-hour clock means you must be able to answer "do any of our shipped releases contain this component?" within hours, not days:

- Generate an SBOM (and AIBOM) per release and keep it queryable (Factor 5).
- Match new advisories against every supported release continuously, not only at build time.
- Cover the AI-specific components — ML libraries, model files, MCP servers, skills — in the same pipeline.
- For high-risk AI systems, meeting the CRA's essential requirements also creates a presumption of conformity with the EU AI Act's cybersecurity requirement (Factor 7).

## Compliance Checklist

- [ ] All language-level dependencies are declared in manifest files with lockfiles for deterministic resolution (for Python, `uv.lock` or PEP 751 `pylock.toml`), installed with hash verification
- [ ] No dependency relies on implicit system-wide installation
- [ ] AI/ML SDKs are pinned to exact versions, not ranges
- [ ] Native ML dependencies (CUDA, cuDNN, etc.) are declared in container definitions or environment specs
- [ ] Model weights are versioned, checksummed, and declared as explicit dependencies
- [ ] Model API versions are pinned in configuration, not just SDK versions
- [ ] Dependency trees are audited for vulnerabilities, including AI-specific supply chain risks
- [ ] Container images use multi-stage builds to minimize runtime attack surface
- [ ] Hardware requirements (GPU type, memory, drivers) are documented as system dependencies
- [ ] A process exists to test and roll out AI SDK upgrades safely
- [ ] SLSA provenance attestations are generated and verified for model artifacts; cosign signatures block unsigned weights at deploy time
- [ ] Model cards and dataset cards are versioned alongside model-dependency manifests, including license and intended-use records
- [ ] AI accelerator dependencies (CUDA, ROCm, Neuron SDK, TPU runtimes) are declared per container variant with fallback paths documented
- [ ] New dependencies proposed or installed by AI tools are checked for existence, history, and maintainer before install (slopsquatting defense), via an allowlist or proxy registry
- [ ] MCP servers and Agent Skills are pinned to exact versions from verified publishers and included in the SBOM/AIBOM
- [ ] Model artifacts use `safetensors` (or are scanned) rather than unscanned pickle-based formats
- [ ] Products on the EU market can identify affected releases and meet the Cyber Resilience Act's 24h/72h vulnerability reporting clock
