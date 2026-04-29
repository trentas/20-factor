# The 20-Factor App

## Cloud-Native Application Development in the AI Era

The original [12-Factor App](https://12factor.net) (Heroku, 2011) and Kevin Hoffman's [Beyond the Twelve-Factor App](https://www.oreilly.com/library/view/beyond-the-twelve-factor/9781492042631/) (2016, 15 factors) defined the principles of cloud-native application development. Those principles were written before the AI revolution.

**The 20-Factor App** reimagines cloud-native application principles for the AI era, covering both **AI-assisted development** (using AI tools to build software) and **AI-native applications** (software that incorporates AI as a core capability).

This methodology extends the original 15 factors to **20 factors organized in 4 tiers**, updating existing principles for the AI era and introducing new factors for evaluation, responsible AI, durable agent runtimes, model management, prompt engineering, agent orchestration, agent memory, and AI economics.

---

## The 20 Factors

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            TIER 4: INTELLIGENCE                                  │
│                                                                                  │
│  16 Model Lifecycle   17 Prompt & Context  18 Agent Orch. &   19 Agent Memory    │
│     Management           Engineering          Bounded Autonomy   Architecture    │
│                                                                                  │
│  20 AI Economics &                                                               │
│     Cost Arch.                                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                             TIER 3: OPERATION                                    │
│                                                                                  │
│   9 Disposability &  10 Intelligent       11 Environment     12 Stateless Proc.  │
│     Graceful Lifecycle   Backing Services    Parity             + Smart Cache    │
│                                                                                  │
│  13 Durable Agent     14 Adaptive          15 Full-Spectrum                      │
│     Runtime              Concurrency          Observability                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                            TIER 2: CONSTRUCTION                                  │
│                                                                                  │
│   5 Immutable Build    6 Evaluation-Driven  7 Responsible     8 Identity, Access │
│     Pipeline             Development          AI by Design      & Trust          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                             TIER 1: FOUNDATION                                   │
│                                                                                  │
│   1 Declarative        2 Contract-First     3 Dependency      4 Configuration,   │
│     Codebase             Interfaces           Management        Credentials &    │
│                                                                 Context          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### Tier 1: FOUNDATION

The bedrock principles — how code, interfaces, dependencies, and configuration are organized.

| # | Factor | Summary | Origin |
|---|--------|---------|--------|
| 1 | [**Declarative Codebase**](factors/01-declarative-codebase.md) | Every artifact — code, infrastructure, prompts — lives in version control as a declarative specification | Updated from original #1 |
| 2 | [**Contract-First Interfaces**](factors/02-contract-first-interfaces.md) | Define interfaces before implementation — for APIs, events, and agent tool schemas | Updated from 15-Factor #2 |
| 3 | [**Dependency Management**](factors/03-dependency-management.md) | Explicitly declare and isolate all dependencies, including AI SDKs and model weights | Updated from original #2 |
| 4 | [**Configuration, Credentials, and Context**](factors/04-configuration-credentials-context.md) | Store config in the environment, credentials in secrets management, AI context in versioned files | Updated from 15-Factor #5 |

### Tier 2: CONSTRUCTION

How software is built, tested, and secured for deployment.

| # | Factor | Summary | Origin |
|---|--------|---------|--------|
| 5 | [**Immutable Build Pipeline**](factors/05-immutable-build-pipeline.md) | Build once, deploy everywhere — with prompt compilation, model pinning, and eval gates | Updated from original #5 |
| 6 | [**Evaluation-Driven Development**](factors/06-evaluation-driven-development.md) | Use evaluations, statistical quality gates, and LLM-as-judge for non-deterministic systems | **New** |
| 7 | [**Responsible AI by Design**](factors/07-responsible-ai-by-design.md) | Build safety, fairness, and accountability into the architecture from the start | **New** |
| 8 | [**Identity, Access, and Trust**](factors/08-identity-access-trust.md) | Every actor — human, service, and AI agent — has verifiable identity and scoped permissions | Updated from 15-Factor #15 |

### Tier 3: OPERATION

How applications run, scale, and are monitored in production.

| # | Factor | Summary | Origin |
|---|--------|---------|--------|
| 9 | [**Disposability and Graceful Lifecycle**](factors/09-disposability-graceful-lifecycle.md) | Fast startup, graceful shutdown — with GPU release and LLM request draining | Updated from original #9 |
| 10 | [**Intelligent Backing Services**](factors/10-intelligent-backing-services.md) | Treat LLM providers, vector DBs, and embedding services as attached resources | Updated from original #4 |
| 11 | [**Environment Parity**](factors/11-environment-parity.md) | Keep dev, staging, and production similar — including model behavior and data representativeness | Updated from original #10 |
| 12 | [**Stateless Processes with Intelligent Caching**](factors/12-stateless-processes-intelligent-caching.md) | Stateless workers with semantic, embedding, and provider prompt caching for AI operations | Updated from original #6 |
| 13 | [**Durable Agent Runtime**](factors/13-durable-agent-runtime.md) | Persist long-running agent execution state with journaling, idempotent tool calls, and durable human-in-the-loop interrupts | **New** |
| 14 | [**Adaptive Concurrency**](factors/14-adaptive-concurrency.md) | Scale independently across CPU, GPU, rate limits, and cost budgets | Updated from original #8 |
| 15 | [**Full-Spectrum Observability**](factors/15-full-spectrum-observability.md) | Logs, traces, and metrics — plus token economics, quality scores, and safety monitoring | Merged from original #11 + 15-Factor #14 |

### Tier 4: INTELLIGENCE

Factors unique to AI-native applications — managing the AI-specific capabilities.

| # | Factor | Summary | Origin |
|---|--------|---------|--------|
| 16 | [**Model Lifecycle Management**](factors/16-model-lifecycle-management.md) | Model registry, version pinning, A/B testing, deprecation planning, fine-tuning pipelines | **New** |
| 17 | [**Prompt and Context Engineering**](factors/17-prompt-context-engineering.md) | Prompt versioning, context window management, RAG pipeline design, token budgeting | **New** |
| 18 | [**Agent Orchestration and Bounded Autonomy**](factors/18-agent-orchestration-bounded-autonomy.md) | Agent architecture, tool permissions, execution budgets, human-in-the-loop gates | **New** |
| 19 | [**Agent Memory Architecture**](factors/19-agent-memory-architecture.md) | Vector, graph, and episodic memory layers with identity-bound lifecycle, decay, and right-to-erasure | **New** |
| 20 | [**AI Economics and Cost Architecture**](factors/20-ai-economics-cost-architecture.md) | Per-token cost modeling, model routing, semantic caching ROI, budget circuit breakers | **New** |

---

## What Changed from the Original 15 Factors

See [MAPPING.md](MAPPING.md) for a detailed mapping of every original factor to the new methodology, including rationale for updates, merges, and retirements.

**Summary of changes:**
- **10 factors updated** for the AI era (new concerns layered on top of original principles)
- **2 factors merged** (Logs + Telemetry → Full-Spectrum Observability)
- **2 factors retired** (Port Binding, Admin Processes — now table-stakes)
- **8 new factors** introduced (Evaluation-Driven Development, Responsible AI, Durable Agent Runtime, Model Lifecycle, Prompt Engineering, Agent Orchestration, Agent Memory, AI Economics)

---

## Maturity Assessment

Use the interactive **[Maturity Assessment Tool](assessment.html)** to evaluate your applications against all 20 factors (235 checklist items). Features:

- **Radar chart** updates in real time as you check off compliance items
- **Maturity scoring** (0–5 per factor) based on percentage of applicable items completed
- **N/A support** — mark items as not applicable so they don't penalize your score
- **Multiple profiles** — assess each application independently
- **Export/Import JSON** — save and share assessments per application
- **Compare mode** — overlay multiple application radars side by side

---

## How to Use This Methodology

**For teams building traditional cloud-native apps**: Tiers 1-3 (Factors 1-15) apply directly. Tier 4 factors become relevant when you add AI capabilities.

**For teams building AI-native applications**: All 20 factors apply. Start with the Foundation tier and build upward.

**For each factor**, the document covers:
- **Motivation**: Why this factor exists
- **What This Replaces**: Mapping to original factors
- **How AI Changes This**: What's new in the AI era
- **In Practice**: Concrete guidance and code examples
- **Compliance Checklist**: Actionable items to verify compliance

---

## Guiding Principles

1. **Extend, don't discard.** The original 12/15 factors were right. This methodology builds on them rather than replacing them.

2. **AI is a tool AND a component.** The methodology addresses both using AI to *build* software and building software that *contains* AI.

3. **Architectural enforcement over prompt instructions.** When controlling AI behavior, code-level enforcement beats asking the model nicely. Guardrails, permissions, and budgets are enforced architecturally.

4. **Non-determinism is the default.** AI outputs are probabilistic. Testing, monitoring, and quality management must account for distributions, not just single values.

5. **Cost is a first-class concern.** Unlike traditional compute, AI costs scale with usage at the token level. Cost architecture is as important as system architecture.

6. **Humans remain in the loop.** AI agents can take autonomous action, but the architecture must define clear boundaries, escalation paths, and human oversight mechanisms.

7. **Agent state is durable, not stateless.** Workers stay stateless, but agent execution state — multi-step plans, tool-call journals, human approvals — is persisted and resumable. Long-running agents are workflows, not request handlers.

---

## Contributing

This is a living methodology. As AI capabilities, tooling, and best practices evolve, so should these factors. Contributions, challenges, and real-world case studies are welcome.

---

## License

This work is licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
