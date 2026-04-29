# Factor Mapping: Original 15 → The 20-Factor App

This document maps every factor from the original [12-Factor App](https://12factor.net) and Kevin Hoffman's [Beyond the Twelve-Factor App](https://www.oreilly.com/library/view/beyond-the-twelve-factor/9781492042631/) to The 20-Factor App, with rationale for each change.

---

## Mapping Table

| Original # | Original Factor | 20-Factor # | 20-Factor App | Status | Rationale |
|------------|----------------|--------------|-------------------|--------|-----------|
| 12F #1 | Codebase | **1** | [Declarative Codebase](factors/01-declarative-codebase.md) | **Updated** | Extended to include IaC, GitOps manifests, prompt-as-code, eval datasets, and AI assistant context files |
| 12F #2 | Dependencies | **3** | [Dependency Management](factors/03-dependency-management.md) | **Updated** | Extended to cover AI SDK pinning, native ML dependencies (CUDA), model weights as versioned dependencies, and hardware-specific runtimes |
| 12F #3 | Config | **4** | [Configuration, Credentials, and Context](factors/04-configuration-credentials-context.md) | **Updated** | Split into three categories: config (env vars), credentials (secrets management), and AI context (model selection, temperature, cost budgets, safety thresholds) |
| 12F #4 | Backing Services | **10** | [Intelligent Backing Services](factors/10-intelligent-backing-services.md) | **Updated** | Extended to include LLM providers, vector databases, embedding services, rerankers, and content safety APIs as attached resources |
| 12F #5 | Build, Release, Run | **5** | [Immutable Build Pipeline](factors/05-immutable-build-pipeline.md) | **Updated** | Extended with prompt compilation, model version pinning, evaluation gates (quality, safety, cost), and AI artifact bundling |
| 12F #6 | Processes | **12** | [Stateless Processes with Intelligent Caching](factors/12-stateless-processes-intelligent-caching.md) | **Updated** | Retained stateless principle for workers; added semantic caching, embedding caching, context/prefix caching, and conversation state externalization. Long-running agent execution state moved to new Factor 13 (Durable Agent Runtime). |
| 12F #7 | Port Binding | — | — | **Retired** | Table-stakes for containerized applications in 2025. Every container runtime, service mesh, and orchestrator assumes port binding. No longer needs a dedicated factor. |
| 12F #8 | Concurrency | **14** | [Adaptive Concurrency](factors/14-adaptive-concurrency.md) | **Updated** | Extended beyond CPU process scaling to heterogeneous hardware (GPU/TPU/NPU), AI provider rate limits, token budgets (including thinking-token budgets), cost-aware auto-scaling, edge/cloud inference routing, and inference-engine selection |
| 12F #9 | Disposability | **9** | [Disposability and Graceful Lifecycle](factors/09-disposability-graceful-lifecycle.md) | **Updated** | Extended for AI workloads: model loading during startup, GPU memory release during shutdown, LLM request draining, health check patterns for model-serving processes |
| 12F #10 | Dev/Prod Parity | **11** | [Environment Parity](factors/11-environment-parity.md) | **Updated** | Extended to cover model version parity, AI service configuration consistency, vector DB data representativeness, and safety/guardrail parity across environments |
| 12F #11 | Logs | **15** | [Full-Spectrum Observability](factors/15-full-spectrum-observability.md) | **Merged** | Merged with Telemetry (15F #14) into unified observability covering logs, traces, metrics, token economics, quality scores, safety monitoring, cost attribution, and (in 2026) carbon-per-request and OTel GenAI semantic conventions |
| 12F #12 | Admin Processes | — | — | **Retired** | Subsumed by Factor 1 (everything as code in version control) and Factor 5 (pipeline automation). One-off admin tasks are now CI/CD jobs, IaC operations, or GitOps workflows — not manual processes. |
| 15F #2 | API First | **2** | [Contract-First Interfaces](factors/02-contract-first-interfaces.md) | **Updated** | Broadened from REST APIs to all interface boundaries: gRPC, GraphQL, event schemas, agent tool definitions, structured output contracts, MCP, A2A, and agent-to-agent communication protocols |
| 15F #5 | Config (expanded) | **4** | [Configuration, Credentials, and Context](factors/04-configuration-credentials-context.md) | **Updated** | See 12F #3 above |
| 15F #14 | Telemetry | **15** | [Full-Spectrum Observability](factors/15-full-spectrum-observability.md) | **Merged** | See 12F #11 above |
| 15F #15 | Security | **8** | [Identity, Access, and Trust](factors/08-identity-access-trust.md) | **Updated** | Extended beyond traditional security to include AI agent identity, scoped tool permissions, bounded autonomy enforcement, trust delegation, computer-use delegated identity, GPU TEE attestation, and agent action audit trails |

---

## New Factors (No Predecessor)

| 20-Factor # | Factor | Why It's New |
|--------------|--------|-------------|
| **6** | [Evaluation-Driven Development](factors/06-evaluation-driven-development.md) | AI outputs are non-deterministic — traditional assertion-based testing is insufficient. Evaluations with statistical quality gates, LLM-as-judge, and golden datasets are the AI-native testing paradigm. |
| **7** | [Responsible AI by Design](factors/07-responsible-ai-by-design.md) | AI systems can generate harmful content, leak PII, produce biased outputs, and be manipulated through adversarial inputs. Safety, fairness, and accountability must be architectural concerns, not afterthoughts. |
| **13** | [Durable Agent Runtime](factors/13-durable-agent-runtime.md) | Agents run for hours, days, or longer — across tool failures, worker preemption, and human approval gates. Their execution state is durable, journaled, and resumable. The 12-factor "stateless processes" rule applies to workers, not to agent state — durable execution (Temporal, Restate, Inngest, agent SDKs) is now a first-class architectural concern distinct from caching. |
| **16** | [Model Lifecycle Management](factors/16-model-lifecycle-management.md) | Models are a new axis of change independent of code. They need versioning, registry management, A/B testing, deprecation planning, and fine-tuning pipelines — lifecycle management distinct from code deployment. |
| **17** | [Prompt and Context Engineering](factors/17-prompt-context-engineering.md) | Prompts are the most influential code in AI applications. Context windows are finite, expensive resources. Both need versioning, budgeting, testing, and structured management. |
| **18** | [Agent Orchestration and Bounded Autonomy](factors/18-agent-orchestration-bounded-autonomy.md) | AI agents that use tools and take autonomous actions need architectural boundaries: explicit capabilities, execution budgets, permission enforcement, and human-in-the-loop gates. |
| **19** | [Agent Memory Architecture](factors/19-agent-memory-architecture.md) | Long-term agent memory (vector, graph, episodic) is a curated, mutable, identity-bound layer distinct from caching (reactive) and RAG (read-mostly knowledge). It has its own lifecycle — write, recall, decay, redact, audit — and its own compliance surface (right-to-erasure across memory stores). |
| **20** | [AI Economics and Cost Architecture](factors/20-ai-economics-cost-architecture.md) | AI costs scale per-token with usage, not per-resource with provisioning. Cost modeling, intelligent routing through AI gateways, budget circuit breakers, semantic-cache ROI, carbon-per-token, and cost attribution are first-class architectural concerns. |

---

## Retired Factors

### Port Binding (Original #7)
**Status**: Retired — table-stakes in 2025.

In 2011, "export services via port binding" was a meaningful architectural principle that distinguished cloud-native apps from apps deployed into web server containers (Tomcat, IIS). In 2025, every containerized application binds to a port. Every Kubernetes pod, Docker container, and serverless function assumes this. It no longer warrants a dedicated factor — it's a baseline assumption.

### Administrative Processes (Original #12)
**Status**: Retired — subsumed by other factors.

The original factor advised running admin/management tasks as one-off processes in the same environment. In 2025:
- Database migrations are CI/CD pipeline steps (Factor 5: Immutable Build Pipeline)
- Infrastructure changes are IaC/GitOps operations (Factor 1: Declarative Codebase)
- Data backfills are declarative jobs defined in code (Factor 1)
- Console/REPL access is replaced by observability tooling (Factor 15)

The principle hasn't been discarded — it's been absorbed into the broader principles of everything-as-code and pipeline automation.

---

## Cross-Reference: How Original Concerns Are Covered

For readers familiar with the original 12/15 factors, here's where each original concern lives:

| Original Concern | Covered In |
|-----------------|------------|
| One codebase, many deploys | Factor 1: Declarative Codebase |
| Explicit dependency declaration | Factor 3: Dependency Management |
| Config in the environment | Factor 4: Configuration, Credentials, and Context |
| Backing services as attached resources | Factor 10: Intelligent Backing Services |
| Strict build/release/run separation | Factor 5: Immutable Build Pipeline |
| Stateless processes (workers) | Factor 12: Stateless Processes with Intelligent Caching |
| Long-running agent execution state | Factor 13: Durable Agent Runtime *(new — replaces the misapplied "stateless" rule for agents)* |
| Port binding | Retired (baseline assumption) |
| Scale via process model | Factor 14: Adaptive Concurrency |
| Fast startup, graceful shutdown | Factor 9: Disposability and Graceful Lifecycle |
| Dev/prod parity | Factor 11: Environment Parity |
| Logs as event streams | Factor 15: Full-Spectrum Observability |
| Admin processes as one-off tasks | Retired (subsumed by Factors 1 and 5) |
| API-first design | Factor 2: Contract-First Interfaces |
| Telemetry | Factor 15: Full-Spectrum Observability |
| Security | Factor 8: Identity, Access, and Trust |
| Long-term agent memory across sessions | Factor 19: Agent Memory Architecture *(new — distinct from cache and RAG)* |
