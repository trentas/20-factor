---
layout: page
importance: 7
category: "Tier 2: Construction"
title: "07. Responsible AI by Design"
nav_order: 3
description: "Build safety, fairness, and accountability into the architecture from the start."
---

# Factor 7: Responsible AI by Design

> Build safety, fairness, and accountability into the architecture from the start — not as an afterthought or a compliance checkbox.

## Motivation

Traditional application security focuses on protecting the system from external threats: injection attacks, unauthorized access, data breaches. AI systems introduce a new class of risks that come from within the system itself. A model can generate harmful content, leak private information from its training data, produce biased outputs that discriminate against protected groups, or be manipulated through adversarial prompts.

These aren't bugs in the traditional sense — they're emergent properties of systems that learn from data and generate novel outputs. You can't fix them with a patch. They require architectural patterns: guardrails, monitoring, human oversight, and continuous evaluation. Responsible AI isn't a feature — it's a cross-cutting architectural concern, like security or observability.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology predates the era where applications could generate harmful, biased, or misleading content as a normal part of their operation.

The closest analogue is security best practices, but responsible AI encompasses fairness, transparency, privacy, and safety concerns that go beyond traditional security.

## How AI Changes This

This factor *is* the AI change. It exists because AI systems can:

- **Generate harmful content**: Toxic, violent, sexual, or otherwise harmful outputs.
- **Leak private information**: Models can memorize and reproduce training data, including PII.
- **Produce biased outputs**: Systematic discrimination based on protected characteristics.
- **Be manipulated**: Prompt injection, jailbreaking, and adversarial inputs can subvert intended behavior.
- **Hallucinate**: Confidently state false information, including fabricated citations and non-existent URLs.
- **Act beyond intended scope**: Agents may take actions that exceed their intended authority.

## In Practice

### Safety Layers Architecture
Implement defense in depth — multiple layers, each catching different issues:

```
┌──────────────────────────────────────────────┐
│              INPUT GUARDRAILS                │
│  Prompt injection detection                  │
│  Input validation and sanitization           │
│  PII detection and redaction                 │
│  Content policy pre-screening                │
├──────────────────────────────────────────────┤
│              MODEL LAYER                     │
│  System prompt with safety instructions      │
│  Constrained output schemas                  │
│  Least-privilege tool/data scoping           │
├──────────────────────────────────────────────┤
│              OUTPUT GUARDRAILS               │
│  Content safety classification               │
│  PII detection in outputs                    │
│  Hallucination detection                     │
│  Fact-checking against sources               │
├──────────────────────────────────────────────┤
│              MONITORING LAYER                │
│  Safety metric tracking                      │
│  Bias detection and alerting                 │
│  Human review queues                         │
│  Incident response triggers                  │
└──────────────────────────────────────────────┘
```

### Guardrails Frameworks

The guardrails patterns described in this factor (input validation, output safety, PII detection) are now implemented by mature open-source frameworks that provide declarative, configurable safety layers:

| Framework | Approach | Strengths |
|-----------|----------|-----------|
| **NeMo Guardrails** (NVIDIA) | Colang-based dialogue rails | Programmable conversation flows, topic control, fact-checking rails |
| **Guardrails AI** | Pydantic-style validators for LLM outputs | Structured output validation, type checking, custom validators |
| **LLM Guard** | Input/output scanner pipeline | Prompt injection detection, PII scanning, toxicity, bias |

These frameworks implement the defense-in-depth architecture above as reusable components, typically as declarative rails or validators attached to the input and output sides of each model call. Use them to accelerate guardrail implementation — but remember that frameworks provide *mechanisms*; you must define the *policies* specific to your application.

**Key selection criteria:**
- **Input protection**: Does it detect prompt injection and jailbreak attempts? (NeMo, LLM Guard)
- **Output validation**: Can it validate structured outputs against schemas? (Guardrails AI)
- **PII scanning**: Does it detect and redact PII in inputs and outputs? (LLM Guard, NeMo)
- **Customizability**: Can you define domain-specific rules? (all of the above)
- **Latency impact**: What overhead does the guardrail layer add? (critical for real-time applications)

### Prompt Injection Defense
Prompt injection cannot be filtered out. Any text the model reads — a user message, a retrieved document, a web page, a tool result, an email the agent is summarizing — can carry instructions, and no classifier catches all of them. Detection still earns its place as one layer, but the primary defense is architectural (Guiding Principle 3): design so that a *successful* injection cannot cause serious harm.

**The lethal trifecta and the Rule of Two.** An agent becomes exploitable when a single session combines three capabilities: (A) access to private or sensitive data, (B) exposure to untrusted content, and (C) the ability to communicate externally or change state. Simon Willison named the combination the "lethal trifecta"; Meta's "Agents Rule of Two" (Oct 2025) turned it into a design rule: until injection can be reliably detected, a session holds at most two of the three, and if it genuinely needs all three, a human approves each consequential step. Make it a design-review check for every agent profile and tool set:

```yaml
# agent-capability-review.yaml — evaluated in CI for each agent profile
agent: support-email-triage
capabilities:
  private_data: true        # reads the customer's order history
  untrusted_input: true     # reads inbound emails
  external_action: false    # cannot send email, call webhooks, or browse
rule_of_two: pass           # adding any outbound tool requires per-action human approval
```

**Patterns that hold the line** (choose per use case):
- **Capability separation**: a privileged agent holds the data and tools; a quarantined one reads untrusted content and returns only schema-validated values (the dual-LLM pattern). CaMeL (Google DeepMind, 2025) extends this: the privileged side plans in code and tracks data provenance, so untrusted values can fill parameters but never steer control flow.
- **Plan-then-execute**: fix the tool plan before reading untrusted content; content can supply arguments but cannot add steps.
- **Egress control**: no outbound network by default, allowlisted destinations, and no rendering of model-generated URLs or images that could smuggle data out in a query string.
- **Secrets never enter context**: credentials are injected out of band at the tool or network layer, never placed in the prompt (Factor 4, Factor 8).
- **Least-privilege tools**: read-only by default; write tools scoped to the current user and object (Factor 8, Factor 18).
- **Separate channels**: operator instructions travel in the system channel; untrusted content is delimited and labeled as data. This reduces risk but does not remove it.

Detection remains useful — to log, alert, and raise the attacker's cost — as long as it is never the only control:

- **Scan every untrusted source**, not only the user's message: retrieved documents, web pages, emails, and tool output carry injections too. Record which source each detection came from.
- **Combine signals**: known-pattern matching catches the cheap attacks; an ML classifier catches paraphrases. Neither is complete, and both produce false positives.
- **Route detections to monitoring and response**, not only to a block decision: a spike in detections from one source or tenant is an incident signal (Factor 15).

### OWASP Top 10s as the Threat Checklist

Two OWASP GenAI Security Project lists are the common vocabulary for AI threats in reviews and audits: the [**Top 10 for LLM Applications (2025)**](https://genai.owasp.org/llm-top-10/) and the **Top 10 for Agentic Applications (2026)**, published in December 2025. Map each entry to a control and to an adversarial eval (see Red Teaming below):

| OWASP LLM Top 10 (2025) | Primary factors |
|---|---|
| LLM01 Prompt Injection | F7 (this factor), F18 |
| LLM02 Sensitive Information Disclosure | F7 PII handling, F19 |
| LLM03 Supply Chain | F3, F5 |
| LLM04 Data and Model Poisoning | F7 data governance, F16 |
| LLM05 Improper Output Handling | F2 output schemas, F7 |
| LLM06 Excessive Agency | F8, F18 |
| LLM07 System Prompt Leakage | F4 (no secrets in prompts), F17 |
| LLM08 Vector and Embedding Weaknesses | F10, F12, F19 |
| LLM09 Misinformation | F6, F7 |
| LLM10 Unbounded Consumption | F14, F20 |

| OWASP Agentic Top 10 (2026) | Primary factors |
|---|---|
| ASI01 Agent Goal Hijack | F7 prompt injection, F18 |
| ASI02 Tool Misuse and Exploitation | F2, F18 |
| ASI03 Identity and Privilege Abuse | F8 |
| ASI04 Agentic Supply Chain Vulnerabilities | F3, F5 |
| ASI05 Unexpected Code Execution | F8 sandboxing |
| ASI06 Memory & Context Poisoning | F12, F19 |
| ASI07 Insecure Inter-Agent Communication | F2 (A2A), F8 |
| ASI08 Cascading Failures | F13, F18 |
| ASI09 Human-Agent Trust Exploitation | F7 human-in-the-loop, F18 |
| ASI10 Rogue Agents | F15, F18 |

### PII Handling
Detect and handle personally identifiable information at system boundaries — emails, phone numbers, national ID numbers, payment card numbers, addresses, dates of birth, and whatever identifiers your domain adds:

| Boundary | Default handling | Notes |
|----------|------------------|-------|
| **Input** (user messages, retrieved content, tool results) | Redact before the model sees it, unless the task needs the value | Strip what the task doesn't need (data minimization); block only where policy requires it |
| **Output** (to users and downstream systems) | Stricter than input: block or redact, with a safe fallback response | The model can surface PII it read from context or memorized in training |
| **Storage** (logs, traces, caches, eval datasets) | Redacted by default, with a defined retention period | Prompts and responses copied into telemetry are personal data too (Factor 15) |

### Bias Monitoring
Continuously monitor for systematic biases in AI outputs:

- **Segment** traffic or evaluation sets along the dimensions that matter for your users — for example gender, ethnicity, age group, and language — using only data you are allowed to process for this purpose (see the AI Act's bias-detection basis below).
- **Compare the same metrics across segments**: output quality, refusal rate, response length, and sentiment.
- **Alert on disparities**, not on single values, and only when the segment is large enough for the difference to be meaningful.
- **Close the loop**: a confirmed disparity becomes an eval case (Factor 6) and an incident if it caused harm (see Incident Response below).

### Human-in-the-Loop Gates
Define clear criteria for *when* human oversight is required. This factor owns the trigger conditions; Factor 8 defines *who* can approve, and Factor 18 defines *how* approval is executed at runtime.

| Trigger | Example condition | Action |
|---------|-------------------|--------|
| **Content** | Safety classifier score below threshold | Block, and queue for human review |
| **Action** | The agent wants to delete, publish, send an email, or move money | Require approval before execution (Factor 18) |
| **Confidence** | A *calibrated* uncertainty signal — verifier score, disagreement across samples, retrieval coverage — below threshold | Flag for review before serving |
| **Volume** | Unusually high request rate from one user or tenant | Sample a share of outputs for review |

Thresholds are set from evaluation data (Factor 6), not guessed, and each trigger has a timeout with a safe default (usually deny). The model's self-reported confidence is not a probability: use it only after it has been calibrated against observed error rates.

### Transparency and Explainability
Make AI decisions auditable:

- **Disclosure**: Clearly indicate when content is AI-generated.
- **Attribution**: When RAG is used, cite the source documents.
- **Decision records**: For important decisions, log observable facts — model and prompt versions, retrieved sources, tool calls with sanitized arguments, policy decisions, approvals, results, and any rationale the API exposes. Do not treat reasoning text or reasoning summaries as proof of why the model decided: research shows models' stated reasoning is not always faithful to what drove the answer ([Anthropic, 2025](https://www.anthropic.com/research/reasoning-models-dont-say-think)), and many providers return only summaries.
- **Confidence indicators**: Surface calibrated confidence to users and downstream systems.
- **Appeal mechanisms**: Provide paths for users to contest AI decisions.

### Data Governance for AI
AI systems consume, generate, and store data with unique governance challenges:

| Data | Governance rules |
|------|------------------|
| **Training and fine-tuning data** | Origin documented; usage rights verified before training; personal data minimized and used only with a legal basis — pseudonymized data still counts as personal data |
| **Conversation logs** | Retention period defined per regulation; deletion requests honored; used for training only with opt-in consent |
| **RAG sources** | Source, update date, and license tracked; refreshed on a defined cadence; source-document permissions enforced at retrieval (Factor 17) |
| **Synthetic data** | Labeled as synthetic, never mixed with real data unlabeled; generation method documented for reproducibility |

Derived copies — embeddings, caches, traces, agent memory, eval datasets — inherit the rules of the data they came from, including retention and deletion (Factor 12, Factor 19).

### Regulatory Compliance (GDPR / LGPD)
AI applications that process personal data must comply with data protection regulations. These requirements are architectural — they must be built into the system, not bolted on after launch.

- **Legal basis for processing**: Document the legal basis (consent, legitimate interest, contractual necessity) for every AI feature that processes personal data. Consent must be granular — "use my data to improve the product" is not valid consent for AI training.
- **Data minimization**: Collect and process only the data strictly necessary for the AI task. If a summarization feature doesn't need the user's name, strip it before sending to the model.
- **Right to erasure**: Users can request deletion of their personal data, including data used in conversation logs, fine-tuning datasets, and vector stores. The system must be able to locate and delete all instances.
- **Data Processing Impact Assessment (DPIA)**: High-risk AI features — those that profile users, make automated decisions, or process sensitive data — require a DPIA before launch.
- **Cross-border data transfers**: When AI models or APIs are hosted in a different jurisdiction than the user's data, ensure adequate transfer mechanisms (SCCs, adequacy decisions) are in place.
- **Data processor agreements**: Third-party AI providers (model APIs, embedding services) are data processors. Ensure DPAs are signed and their data handling policies are compatible with your obligations.
- **Brazil beyond LGPD**: the AI bill PL 2338/2023, passed by the Senate in December 2024, was still awaiting a vote in the Chamber of Deputies as of late 2026, so none of it is in force. Its risk-based structure mirrors the EU AI Act, so systems built to the EU structure below will map onto it; track it rather than build to a draft.

### EU AI Act Compliance
The EU AI Act establishes a risk-based classification framework that imposes architectural requirements on AI systems. Unlike GDPR (which focuses on data), the AI Act regulates the *AI system itself* — how it's built, tested, deployed, and monitored. Compliance is not optional for systems operating in or affecting EU citizens.

**Risk classification determines architectural requirements.** Classify each AI system — unacceptable (prohibited), high, limited, or minimal risk — record the reasoning, and review the classification whenever the system's purpose or capabilities change significantly. High-risk systems must implement all of the following:

| Requirement | What the architecture must provide |
|-------------|------------------------------------|
| **Risk management** (Art. 9) | A continuous risk-management process; residual risks identified and mitigated; testing before deployment and in operation |
| **Data governance** (Art. 10) | Training, validation, and test data documented for provenance, relevance, and representativeness; bias examined across protected characteristics; data-quality criteria defined |
| **Technical documentation** (Art. 11) | Purpose, intended use, and limitations; model, training, and evaluation methodology; performance metrics |
| **Record-keeping** (Art. 12) | Automatic event logging, so decisions can be traced to inputs and model version, retained as the regulation requires |
| **Transparency to deployers** (Art. 13) | Instructions for use, capabilities, and limitations |
| **Human oversight** (Art. 14) | People can understand, monitor, and override the system, including stopping it |
| **Accuracy, robustness, cybersecurity** (Art. 15) | Declared and tested accuracy levels; robustness against adversarial inputs and edge cases; protection against manipulation of training data and inputs |

Limited-risk systems such as chatbots carry transparency duties instead: users must know they are interacting with an AI system, and AI-generated content must be labeled (Article 50, below). High-risk systems also need a conformity assessment — internal or third-party depending on the category — registration in the EU database, and CE marking before they are placed on the EU market.

**Architectural implications:**
- **Automatic logging** is required for high-risk systems (Article 12): the system records the events needed to trace its operation, identify risks, and support post-market monitoring, with specific minimum fields for some categories (such as remote biometric identification). That is not a mandate to store every input and output — decide per system which events and content to keep, and apply data minimization (sampling, redaction, retention limits; Factor 15).
- **Human oversight mechanisms** must be architectural, not advisory — Factor 18 (Agent Orchestration) human-in-the-loop gates satisfy this when properly implemented.
- **Risk management** is continuous, not a one-time assessment — integrate AI Act risk reviews into your CI/CD pipeline (Factor 5) and evaluation suite (Factor 6).
- **Conformity assessment** must be completed before deployment. For high-risk systems, this may require third-party audit.

The AI Act also prohibits certain AI practices outright (social scoring, real-time biometric identification in public spaces with exceptions, manipulation of vulnerable groups). Ensure your system does not fall into the "unacceptable risk" category.

**Application timeline** — as amended by **Regulation (EU) 2026/1744** (the "Digital Omnibus on AI", published 24 Jul 2026, in force since 27 Jul 2026):

| Date | Milestone |
|------|-----------|
| 2 Feb 2025 | Prohibited AI practices (Art. 5) and AI literacy (Art. 4) apply |
| 2 Aug 2025 | GPAI model obligations apply; models already on the market must comply by 2 Aug 2027 |
| **2 Aug 2026** | **General application; Article 50 transparency obligations apply; Commission enforcement powers over GPAI providers activate** |
| 2 Dec 2026 | Art. 50(2) machine-readable marking for generative systems placed on the market before 2 Aug 2026; new prohibitions on non-consensual intimate imagery and child sexual abuse material apply |
| 2 Aug 2027 | Pre-existing GPAI models reach full compliance; national AI regulatory sandboxes operational |
| **2 Dec 2027** | **High-risk obligations for standalone systems (Annex III — e.g., employment, credit scoring, education, access to essential services)** |
| **2 Aug 2028** | **High-risk obligations for AI in products covered by Annex I harmonisation legislation** |
| 2 Aug 2030 | Legacy high-risk systems used by public authorities must comply |

The Omnibus moved deadlines; it did not remove obligations. High-risk requirements are unchanged in substance, so treat the extra time as build time, not as a reason to postpone design. Other changes worth knowing:

- **AI literacy (Art. 4)** is now an obligation to *support* literacy among staff, not to guarantee a specific level.
- **Bias detection (new Art. 4a)** gives an explicit legal basis for processing special-category personal data to detect and correct bias, under strict, cumulative conditions — relevant to the Bias Monitoring pattern above.
- **SMEs and small mid-caps** get simplified technical documentation and quality-management requirements.
- **Cyber Resilience Act link (Art. 42(3))**: high-risk systems that meet the CRA's essential cybersecurity requirements are presumed to meet the AI Act's cybersecurity requirement (Art. 15).

### Article 50: Content Provenance and Watermarking

EU AI Act Article 50 imposes **transparency obligations on AI-generated and AI-manipulated content**. Since 2 Aug 2026, providers and deployers of generative AI systems must ensure the following (generative systems already on the market before that date have until 2 Dec 2026 for the machine-readable marking in Art. 50(2)):

- AI-generated images, audio, video, and text are **detectable as AI-generated** through machine-readable signals (watermarks, metadata, cryptographic provenance, or other techniques)
- Deepfakes are clearly disclosed
- AI-generated text published to inform the public on matters of public interest is disclosed (with limited exceptions for editorial review)

The two consolidating technical layers:

- **C2PA Content Credentials** (Content Authenticity Initiative): cryptographically signed metadata attached to media — describes who/what/when/how the content was created, including AI involvement. Adopted by Adobe, Microsoft, Google, OpenAI. Verify-on-display.
- **SynthID-class watermarks** (Google SynthID for text/image/video/audio, Meta Video Seal): signal-in-content watermarks that survive lossy compression and minor edits. Detect-by-tool.

These are complementary, not alternatives. Production AI systems generating user-visible content should:

- **Attach Content Credentials at creation**: record what created the content (application and version, the generating model) and how, signed with the organization's C2PA signing certificate held in a key-management service — not a general-purpose artifact-signing key.
- **Watermark where the medium supports it**: images, audio, video, and long-form text, using a SynthID-class or equivalent scheme, with the detection threshold set from testing.
- **Verify at publish**: check credentials before content leaves the system, and periodically test a corpus of outputs to confirm the watermark survives normal handling (compression, resizing, light edits).
- **Carry opt-out preferences** where you publish them, so crawlers can see that the content is not available for AI training.

Open problem: C2PA-vs-watermark contradictions can arise when content is re-edited. Define your handling policy explicitly (re-sign, drop, flag).

### ISO/IEC 42001 and NIST AI RMF Alignment

EU AI Act is the legal layer. The de-facto compliance stack pairs it with two methodological frameworks:

- **ISO/IEC 42001** (AI Management System, AIMS) — certifiable AI management standard, analogous to ISO 27001 for security. Required by an increasing share of enterprise procurement RFPs.
- **NIST AI RMF** + **NIST GenAI Profile** + **Critical Infrastructure Profile** (Apr 2026 concept note) + **Control Overlays for Securing AI Systems** (COSAiS — SP 800-53 overlays, drafts through 2026, with single- and multi-agent use cases) — methodology and controls catalog used by US federal procurement and many regulated industries.
- **ISO/IEC 27090** (2026) — guidance on AI-specific security threats (data poisoning, evasion, model theft) across the AI life cycle. It is guidance, not a certifiable standard: it extends ISO/IEC 27001/27002 controls for AI systems, while certification still runs through 27001 and 42001.

The mapping isn't 1:1, but the controls overlap heavily. Build a single internal control set that satisfies all of them. Keep evidence in one place; cross-map at audit time. Use the OWASP Top 10 mappings above as the threat-side index into the same control set.

Each internal control lists the clauses it satisfies in every framework and points at its evidence. One risk-management control, for example, can cover the AI Act's risk-management requirement (Art. 9), ISO/IEC 42001's risk assessment and treatment clauses, and the NIST AI RMF Govern and Map functions, with the risk register as its evidence; an automatic-logging control (Art. 12) points at the observability pipeline of Factor 15. Version the control set and the mapping like code, so an auditor can see which version of each control was in force on a given date.

### Training Data Licensing and Copyright

Generative AI raised unsettled but high-stakes questions about training data licensing and the IP status of model outputs. Treat these as architectural concerns, not legal afterthoughts:

- **Training data provenance**: every dataset used (pre-training, fine-tuning, RAG corpus) carries a license declaration. Refuse to ingest data without one. Capture in the AIBOM (Factor 5).
- **Output IP risk**: for code-generation features, document the model provider's indemnification posture. Some providers offer customer indemnification for output IP claims (Microsoft, Google, Anthropic for specific tiers); others don't.
- **Opt-out signals**: respect `robots.txt`, `noai`/`noimageai` meta tags, C2PA `training_mining: notAllowed` assertions when crawling for RAG.
- **PII in training data**: training/fine-tuning datasets are subject to GDPR/LGPD just like operational data. Right-to-erasure may require re-training or differential-privacy mitigation.

### Non-Production Data Anonymization
Non-production environments (dev, staging, QA) must not contain real personal data by default. This is one of the most common — and most preventable — regulatory violations.

**Pseudonymization is not anonymization.** Swapping names for fake ones, hashing emails, or shifting dates keeps records linkable — to each other and, with enough auxiliary data, to the people behind them. A hashed email can be matched by hashing a list of candidates. Under GDPR, pseudonymized data that can be attributed to a person with additional information is still personal data, with all the obligations that brings. Choose data for non-production use in this order:

1. **Synthetic data** generated to match the shapes and distributions the tests need — the default for development and for automated agent environments.
2. **Effectively anonymized data**: transformations such as generalization, aggregation, suppression of rare values, and removal of identifiers from free text, validated against re-identification — including linkage with other data you hold. "Anonymized" is a claim you test, not a label you apply.
3. **Pseudonymized or real personal data only as a documented exception**: a stated purpose and legal basis, restricted access, the same protection as production, and a retention limit.

Whatever the source, scan every copied dataset for PII — including NER-based detection in free text — fail the pipeline if any leaks through, and log who copied what, when, and under which exception.

This is especially critical when AI agents autonomously create branches and spin up ephemeral environments (Factor 11) — automated pipelines must use synthetic or anonymized datasets by default, never production data. Further reading: EDPB, [Guidelines 01/2025 on Pseudonymisation](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2025/guidelines-012025-pseudonymisation_en).

### Red Teaming and Adversarial Testing
Defensive guardrails are necessary but not sufficient. You must actively test them. Red teaming is the practice of systematically probing an AI system for vulnerabilities — prompt injection bypasses, harmful output generation, PII extraction, bias exploitation, and jailbreaks.

| Attack category | Goal | Typical methods |
|-----------------|------|-----------------|
| **Prompt injection** | Override system instructions | Direct and indirect (via retrieved content or tool output) injection, payload splitting |
| **Jailbreak** | Bypass safety boundaries | Role-play, encoding tricks, multi-turn escalation |
| **Data extraction** | Extract training data, PII, or the system prompt | Memorization probing, context extraction, system-prompt leakage |
| **Bias exploitation** | Trigger biased outputs | Demographic probing, stereotype elicitation |
| **Harmful output** | Generate harmful content | Indirect requests, dual-use framing, gradual escalation |
| **Agentic** (OWASP Agentic Top 10) | Make an agent act against its user | Goal hijack via tool output, tool misuse, memory poisoning, exfiltration via rendered links |

Run a full human-led exercise on a fixed cadence (for example, quarterly) and automated adversarial evals in CI on every change. Keep the adversarial dataset versioned alongside the code (Factor 1) and grow it after each exercise. Every confirmed vulnerability follows the same loop: add it to the adversarial dataset, ship a fix or guardrail, re-run the eval suite, and update the incident playbook.

Red teaming is not a one-time audit — it's a continuous practice. Every model upgrade, prompt change, or new feature should trigger adversarial evaluation. Automated adversarial eval suites (Factor 6) complement but do not replace human-led exercises.

### Incident Response for AI
AI incidents require specific response procedures:

| Severity | Immediately | Then |
|----------|-------------|------|
| **Sev 1 — harmful output** | Disable the affected feature | Root cause and affected scope within 1 hour; fix or guardrail within 4 hours; retrospective within 24 hours; regression case in the eval suite within a week |
| **Sev 2 — bias detected** | Flag for investigation | Impact and scope quantified within 24 hours; mitigation within a week; enhanced monitoring afterwards |

Regulatory clocks run in parallel with the technical response, from the moment of awareness:

| Regime | Event | Deadline |
|--------|-------|----------|
| **EU AI Act Art. 73** (serious incidents, high-risk systems; calendar days) | Widespread infringement or critical-infrastructure disruption | 2 days |
| | Death of a person | 10 days |
| | Other serious incident | 15 days |
| **Cyber Resilience Act Art. 14** (products with digital elements; applies since 11 Sep 2026) | Actively exploited vulnerability | Early warning 24h, notification 72h, final report 14 days after a fix is available |
| | Severe security incident | Early warning 24h, notification 72h, final report within 1 month |
| **GDPR** | Personal data breach | 72h, to the supervisory authority |
| **LGPD** | Personal data breach | 3 working days, to the ANPD (Resolution CD/ANPD 15/2024) |

One incident can trigger several regimes at once — a prompt-injection exfiltration from a high-risk system can be an AI Act serious incident, a CRA severe incident, and a personal-data breach. Decide in advance who owns each clock, and log the moment of awareness with a timestamp you can defend (cross-ref Factor 20's AI incident log).

## Compliance Checklist

- [ ] Prompt injection is mitigated architecturally: every agent profile passes a Rule-of-Two review (private data / untrusted content / external action), with detection classifiers as an additional layer on user input and untrusted sources
- [ ] OWASP LLM Top 10 (2025) and Agentic Top 10 (2026) risks are mapped to controls and covered by the adversarial eval suite
- [ ] PII is detected at input and output boundaries with configurable handling policies
- [ ] Content safety classifiers screen AI outputs before serving to users
- [ ] Bias monitoring evaluates output quality, refusal rates, and sentiment across demographic segments on a defined cadence
- [ ] Human-in-the-loop gates are defined for high-risk actions and low-confidence outputs
- [ ] AI-generated content is clearly disclosed to users
- [ ] Non-production environments use synthetic or effectively anonymized data (pseudonymized data counts as personal data), with automated PII scanning to prevent leaks and documented exceptions
- [ ] Regulatory compliance (GDPR/LGPD) is addressed: legal basis, data minimization, right to erasure, and DPIA for high-risk AI features
- [ ] EU AI Act risk classification is determined and documented for each AI system
- [ ] High-risk AI systems implement mandatory requirements — risk management, data governance, technical documentation, record-keeping, transparency, human oversight, and accuracy/robustness testing — before their application date under Regulation (EU) 2026/1744 (2 Dec 2027 for Annex III, 2 Aug 2028 for Annex I)
- [ ] An AI incident response playbook exists and is practiced, including the regulatory reporting clocks (EU AI Act Art. 73, Cyber Resilience Act, GDPR/LGPD) and an owner for each
- [ ] Red teaming exercises run on a defined cadence with adversarial eval datasets maintained in CI
- [ ] AI-generated content carries C2PA Content Credentials and/or SynthID-class watermarks (EU AI Act Article 50: applies since 2 Aug 2026; 2 Dec 2026 for generative systems already on the market)
- [ ] An ISO/IEC 42001 AIMS or equivalent management system is in place, with cross-mapping to NIST AI RMF, ISO/IEC 27090, and EU AI Act controls
- [ ] Training data, fine-tuning data, and RAG corpora carry license declarations captured in the AIBOM (Factor 5)
- [ ] Crawlers and ingestion pipelines respect AI opt-out signals (robots.txt, noai/noimageai, C2PA training_mining)
- [ ] EU AI Act Article 50 transparency disclosures (deepfakes, AI-generated public-interest text, system disclosure) are implemented at content-publish boundaries
