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

These frameworks implement the defense-in-depth architecture above as reusable components. Use them to accelerate guardrail implementation — but remember that frameworks provide *mechanisms*; you must define the *policies* specific to your application.

```python
# Example: NeMo Guardrails declarative configuration
# config.yml
rails:
  input:
    flows:
      - self check input        # block prompt injection
      - check jailbreak         # block jailbreak attempts
  output:
    flows:
      - self check output       # filter harmful content
      - check hallucination     # verify against source documents
      - check pii               # block PII in outputs
```

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

Detection remains useful — to log, alert, and raise the attacker's cost:

```python
# Detection layer — useful signal, never the only control
class InputGuardrail:
    def check(self, text: str, source: str) -> GuardrailResult:
        results = [
            self.pattern_detector.scan(text),          # known injection patterns
            self.injection_classifier.classify(text),  # ML-based classifier
        ]
        # Check untrusted sources too (web pages, emails, tool output), not only user input
        return GuardrailResult.aggregate(results, source=source)
```

### OWASP Top 10s as the Threat Checklist

Two OWASP GenAI Security Project lists are the common vocabulary for AI threats in reviews and audits: the **Top 10 for LLM Applications (2025)** and the **Top 10 for Agentic Applications (2026)**, published in December 2025. Map each entry to a control and to an adversarial eval (see Red Teaming below):

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
Detect and handle personally identifiable information at system boundaries:

```yaml
pii_policy:
  input:
    detection_enabled: true
    action: redact_and_log           # redact_and_log | block | allow_and_flag
    entity_types:
      - email
      - phone_number
      - ssn
      - credit_card
      - address
      - date_of_birth

  output:
    detection_enabled: true
    action: block                     # Stricter on output — never leak PII
    fallback_response: "I can't include personal information in my response."

  storage:
    redacted_in_logs: true
    redacted_in_traces: true
    retention_days: 30
```

### Bias Monitoring
Continuously monitor for systematic biases in AI outputs:

```python
# Bias monitoring across demographic dimensions
class BiasMonitor:
    def evaluate(self, requests, responses):
        # Segment by demographic indicators
        segments = self.segment_by_demographics(requests)

        for dimension in ["gender", "ethnicity", "age_group", "language"]:
            metrics = {}
            for segment_value, segment_data in segments[dimension].items():
                metrics[segment_value] = {
                    "quality_score": self.evaluate_quality(segment_data),
                    "refusal_rate": self.measure_refusal_rate(segment_data),
                    "response_length": self.measure_response_length(segment_data),
                    "sentiment": self.measure_sentiment(segment_data),
                }

            # Alert on significant disparities
            if self.detect_disparity(metrics):
                self.alert(dimension, metrics)
```

### Human-in-the-Loop Gates
Define clear criteria for *when* human oversight is required. This factor owns the trigger conditions; Factor 8 defines *who* can approve, and Factor 18 defines *how* approval is executed at runtime.

```yaml
human_review_triggers:
  # Content-based triggers
  - condition: safety_score < 0.7
    action: block_and_queue_for_review
    approval_timeout_seconds: 1800

  # Action-based triggers
  - condition: agent_action in [delete, publish, send_email, financial_transaction]
    action: require_approval_before_execution
    approval_timeout_seconds: 300

  # Confidence-based triggers
  - condition: model_confidence < 0.5
    action: flag_for_review_before_serving
    approval_timeout_seconds: 900

  # Volume-based triggers
  - condition: user_requests_per_hour > 100
    action: sample_and_review
    sample_rate: 0.10
```

### Transparency and Explainability
Make AI decisions auditable:

- **Disclosure**: Clearly indicate when content is AI-generated.
- **Attribution**: When RAG is used, cite the source documents.
- **Reasoning traces**: Log the chain-of-thought or reasoning steps for important decisions.
- **Confidence indicators**: Surface confidence scores to users and downstream systems.
- **Appeal mechanisms**: Provide paths for users to contest AI decisions.

### Data Governance for AI
AI systems consume, generate, and store data with unique governance challenges:

```yaml
data_governance:
  training_data:
    provenance: documented        # track origin of all training/fine-tuning data
    licensing: verified           # confirm data usage rights before training
    pii_handling: anonymized      # no PII in training datasets without consent

  conversation_logs:
    retention_days: 90            # define retention period per regulation
    right_to_erasure: supported   # users can request deletion of their data
    use_for_training: opt_in      # never use production logs for training without consent

  rag_sources:
    provenance: tracked           # document source, update date, license
    refresh_cadence: weekly       # stale data degrades quality
    access_controls: enforced     # respect source document permissions

  synthetic_data:
    labeled_as_synthetic: true    # never mix synthetic with real without labeling
    generation_method: documented # reproducibility
```

### Regulatory Compliance (GDPR / LGPD)
AI applications that process personal data must comply with data protection regulations. These requirements are architectural — they must be built into the system, not bolted on after launch.

- **Legal basis for processing**: Document the legal basis (consent, legitimate interest, contractual necessity) for every AI feature that processes personal data. Consent must be granular — "use my data to improve the product" is not valid consent for AI training.
- **Data minimization**: Collect and process only the data strictly necessary for the AI task. If a summarization feature doesn't need the user's name, strip it before sending to the model.
- **Right to erasure**: Users can request deletion of their personal data, including data used in conversation logs, fine-tuning datasets, and vector stores. The system must be able to locate and delete all instances.
- **Data Processing Impact Assessment (DPIA)**: High-risk AI features — those that profile users, make automated decisions, or process sensitive data — require a DPIA before launch.
- **Cross-border data transfers**: When AI models or APIs are hosted in a different jurisdiction than the user's data, ensure adequate transfer mechanisms (SCCs, adequacy decisions) are in place.
- **Data processor agreements**: Third-party AI providers (model APIs, embedding services) are data processors. Ensure DPAs are signed and their data handling policies are compatible with your obligations.

### EU AI Act Compliance
The EU AI Act establishes a risk-based classification framework that imposes architectural requirements on AI systems. Unlike GDPR (which focuses on data), the AI Act regulates the *AI system itself* — how it's built, tested, deployed, and monitored. Compliance is not optional for systems operating in or affecting EU citizens.

**Risk classification determines architectural requirements:**

```yaml
eu_ai_act:
  system_classification:
    # Step 1: Classify your AI system by risk level
    risk_level: high               # unacceptable | high | limited | minimal
    category: "AI system that profiles natural persons"
    determination_date: "2025-08-01"
    review_cadence: on_significant_change

  # High-risk systems must implement all of the following:
  high_risk_requirements:
    risk_management:
      system: documented            # continuous risk management system
      residual_risks: documented    # identify and mitigate residual risks
      testing: "pre-deployment and ongoing"

    data_governance:
      training_data: documented     # provenance, relevance, representativeness
      bias_testing: "across protected characteristics"
      data_quality_criteria: defined

    technical_documentation:
      system_description: complete  # purpose, intended use, limitations
      architecture: documented      # model, training, evaluation methodology
      performance_metrics: published

    record_keeping:
      automatic_logging: enabled    # system must log events for traceability
      log_retention: "as required by deployer, minimum per regulation"
      audit_trail: complete         # decisions traceable to inputs and model version

    transparency:
      user_notification: required   # users must know they're interacting with AI
      instructions_for_use: provided # deployers receive clear operating instructions
      capabilities_and_limitations: documented

    human_oversight:
      mechanism: defined            # human can understand, monitor, and override
      override_capability: "stop button or manual override"
      monitoring_dashboard: required

    accuracy_robustness_cybersecurity:
      accuracy_levels: documented   # declared and tested accuracy metrics
      robustness: "tested against adversarial inputs and edge cases"
      cybersecurity: "protected against manipulation of training data and inputs"

  # Limited-risk systems (e.g., chatbots) require transparency
  limited_risk_requirements:
    disclosure: "Users must be informed they are interacting with an AI system"
    ai_generated_content: "Must be labeled as AI-generated (deepfakes, synthetic text)"

  # Conformity assessment
  conformity:
    assessment_type: internal       # internal | third_party (depends on category)
    eu_database_registration: required  # high-risk systems must register
    ce_marking: required            # before placing on EU market
```

**Architectural implications:**
- **Automatic logging** is not optional for high-risk systems — Factor 15 (Observability) must capture every decision input and output for traceability.
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

```yaml
content_provenance:
  c2pa:
    enabled: true
    sign_with: cosign-key-prod         # cryptographic signing key
    metadata:
      assertions:
        - c2pa.created_by: "ExampleApp v2.3"
        - c2pa.actions:
            - action: c2pa.created
              softwareAgent: "claude-sonnet-5-5"
        - c2pa.training_mining: notAllowed   # opt-out signal for crawlers

  watermark:
    enabled: true
    method: synthid                    # or equivalent
    apply_to: [image, audio, text_long_form]
    minimum_detection_confidence: 0.95

  monitoring:
    detection_test_corpus: weekly       # verify watermark survives normal handling
    c2pa_signature_verification: required_at_publish
```

Open problem: C2PA-vs-watermark contradictions can arise when content is re-edited. Define your handling policy explicitly (re-sign, drop, flag).

### ISO/IEC 42001 and NIST AI RMF Alignment

EU AI Act is the legal layer. The de-facto compliance stack pairs it with two methodological frameworks:

- **ISO/IEC 42001** (AI Management System, AIMS) — certifiable AI management standard, analogous to ISO 27001 for security. Required by an increasing share of enterprise procurement RFPs.
- **NIST AI RMF** + **NIST GenAI Profile** + **Critical Infrastructure Profile** (Apr 2026 concept note, SP 800-53 AI Control Overlays through 2026) — methodology and controls catalog used by US federal procurement and many regulated industries.

The mapping isn't 1:1, but the controls overlap heavily. Build a single internal control set that satisfies all three. Keep evidence in one place; cross-map at audit time.

```yaml
compliance_evidence_map:
  control_set: internal_v3
  source_frameworks:
    - eu_ai_act_high_risk
    - iso_42001_aims_clauses
    - nist_ai_rmf_govern_map_measure_manage
    - nist_genai_profile
  evidence_store: s3://compliance-evidence/
  controls:
    risk_management:
      eu_ai_act: art.9
      iso_42001: clause_6.1
      nist_ai_rmf: GOVERN-3.1, MAP-1.1
      evidence: risk-register.yaml
    automatic_logging:
      eu_ai_act: art.12
      iso_42001: clause_8.4
      nist_ai_rmf: MEASURE-2.4
      evidence: factor-15-observability/
```

### Training Data Licensing and Copyright

Generative AI raised unsettled but high-stakes questions about training data licensing and the IP status of model outputs. Treat these as architectural concerns, not legal afterthoughts:

- **Training data provenance**: every dataset used (pre-training, fine-tuning, RAG corpus) carries a license declaration. Refuse to ingest data without one. Capture in the AIBOM (Factor 5).
- **Output IP risk**: for code-generation features, document the model provider's indemnification posture. Some providers offer customer indemnification for output IP claims (Microsoft, Google, Anthropic for specific tiers); others don't.
- **Opt-out signals**: respect `robots.txt`, `noai`/`noimageai` meta tags, C2PA `training_mining: notAllowed` assertions when crawling for RAG.
- **PII in training data**: training/fine-tuning datasets are subject to GDPR/LGPD just like operational data. Right-to-erasure may require re-training or differential-privacy mitigation.

### Non-Production Data Anonymization
Non-production environments (dev, staging, QA) must never contain real personal data. This is one of the most common — and most preventable — regulatory violations.

```yaml
non_production_data:
  policy: anonymize_before_copy     # never copy production data without anonymization

  anonymization:
    strategy: pseudonymization       # pseudonymization | synthetic_generation | k-anonymity
    fields:
      - type: name
        method: fake_name            # generate realistic fake names
      - type: email
        method: hash_and_domain      # user@company.com → a3f8c@test.example.com
      - type: phone
        method: randomize            # preserve format, randomize digits
      - type: address
        method: generalize           # keep city/state, remove street
      - type: free_text
        method: ner_redact           # NER-based PII redaction in unstructured text
      - type: date_of_birth
        method: shift                # shift by random offset, preserve age distribution

  validation:
    scan_after_copy: true            # run PII scanner on anonymized dataset
    block_on_pii_detected: true      # fail pipeline if PII leaks through
    audit_log: true                  # log who copied what and when

  refresh_cadence: monthly           # re-anonymize from production monthly for freshness
```

This is especially critical when AI agents autonomously create branches and spin up ephemeral environments (Factor 11) — automated pipelines must use anonymized datasets by default, never production data.

### Red Teaming and Adversarial Testing
Defensive guardrails are necessary but not sufficient. You must actively test them. Red teaming is the practice of systematically probing an AI system for vulnerabilities — prompt injection bypasses, harmful output generation, PII extraction, bias exploitation, and jailbreaks.

```yaml
red_team_program:
  cadence: quarterly                  # full red team exercise
  continuous: true                    # automated adversarial evals run in CI

  attack_categories:
    - prompt_injection:               # attempts to override system instructions
        methods: [direct_injection, indirect_injection, payload_splitting]
    - jailbreak:                      # attempts to bypass safety boundaries
        methods: [roleplay, encoding_tricks, multi_turn_escalation]
    - data_extraction:                # attempts to extract training data or PII
        methods: [memorization_probing, context_extraction, system_prompt_leak]
    - bias_exploitation:              # attempts to trigger biased outputs
        methods: [demographic_probing, stereotype_elicitation]
    - output_manipulation:            # attempts to generate harmful content
        methods: [indirect_harmful, dual_use, gradual_escalation]
    - agentic:                        # OWASP Agentic Top 10 scenarios
        methods: [goal_hijack_via_tool_output, tool_misuse, memory_poisoning, exfiltration_via_rendered_links]

  adversarial_eval_dataset:
    source: evals/adversarial.jsonl   # versioned alongside code (Factor 1)
    min_samples: 200
    refresh: after_each_exercise      # add new attack vectors discovered

  response:
    vulnerability_found:
      - add_to_adversarial_dataset
      - create_guardrail_or_fix
      - re_run_eval_suite
      - update_incident_playbook
```

Red teaming is not a one-time audit — it's a continuous practice. Every model upgrade, prompt change, or new feature should trigger adversarial evaluation. Automated adversarial eval suites (Factor 6) complement but do not replace human-led exercises.

### Incident Response for AI
AI incidents require specific response procedures:

```yaml
ai_incident_playbook:
  severity_1_harmful_output:
    - immediately: disable_affected_feature
    - within_1h: identify_root_cause_and_affected_scope
    - within_4h: deploy_fix_or_guardrail
    - within_24h: conduct_retrospective
    - within_1w: add_to_eval_suite

  severity_2_bias_detected:
    - immediately: flag_for_investigation
    - within_24h: quantify_impact_and_scope
    - within_1w: implement_mitigation
    - ongoing: enhanced_monitoring

  # Regulatory clocks run in parallel with the technical response, from the moment of awareness
  regulatory_reporting:
    eu_ai_act_art_73:                 # serious incidents, high-risk systems; calendar days
      widespread_or_critical_infrastructure: 2d
      death_of_a_person: 10d
      other_serious_incident: 15d
    eu_cra_art_14:                    # products with digital elements; applies since 11 Sep 2026
      actively_exploited_vulnerability: { early_warning: 24h, notification: 72h, final_report: "14d after fix available" }
      severe_security_incident: { early_warning: 24h, notification: 72h, final_report: "1 month" }
    personal_data_breach:
      gdpr: 72h                       # to the supervisory authority
      lgpd: "3 working days"          # to the ANPD (Resolution CD/ANPD 15/2024)
```

One incident can trigger several regimes at once — a prompt-injection exfiltration from a high-risk system can be an AI Act serious incident, a CRA severe incident, and a personal-data breach. Decide in advance who owns each clock, and log the moment of awareness with a timestamp you can defend (cross-ref Factor 20's AI incident log).

## Compliance Checklist

- [ ] Prompt injection is mitigated architecturally: every agent profile passes a Rule-of-Two review (private data / untrusted content / external action), with detection classifiers as an additional layer on user input and untrusted sources
- [ ] OWASP LLM Top 10 (2025) and Agentic Top 10 (2026) risks are mapped to controls and covered by the adversarial eval suite
- [ ] PII is detected at input and output boundaries with configurable handling policies
- [ ] Content safety classifiers screen AI outputs before serving to users
- [ ] Bias monitoring evaluates output quality, refusal rates, and sentiment across demographic segments on a defined cadence
- [ ] Human-in-the-loop gates are defined for high-risk actions and low-confidence outputs
- [ ] AI-generated content is clearly disclosed to users
- [ ] Non-production environments use anonymized data with automated PII scanning to prevent leaks
- [ ] Regulatory compliance (GDPR/LGPD) is addressed: legal basis, data minimization, right to erasure, and DPIA for high-risk AI features
- [ ] EU AI Act risk classification is determined and documented for each AI system
- [ ] High-risk AI systems implement mandatory requirements — risk management, data governance, technical documentation, record-keeping, transparency, human oversight, and accuracy/robustness testing — before their application date under Regulation (EU) 2026/1744 (2 Dec 2027 for Annex III, 2 Aug 2028 for Annex I)
- [ ] An AI incident response playbook exists and is practiced, including the regulatory reporting clocks (EU AI Act Art. 73, Cyber Resilience Act, GDPR/LGPD) and an owner for each
- [ ] Red teaming exercises run on a defined cadence with adversarial eval datasets maintained in CI
- [ ] AI-generated content carries C2PA Content Credentials and/or SynthID-class watermarks (EU AI Act Article 50: applies since 2 Aug 2026; 2 Dec 2026 for generative systems already on the market)
- [ ] An ISO/IEC 42001 AIMS or equivalent management system is in place, with cross-mapping to NIST AI RMF and EU AI Act controls
- [ ] Training data, fine-tuning data, and RAG corpora carry license declarations captured in the AIBOM (Factor 5)
- [ ] Crawlers and ingestion pipelines respect AI opt-out signals (robots.txt, noai/noimageai, C2PA training_mining)
- [ ] EU AI Act Article 50 transparency disclosures (deepfakes, AI-generated public-interest text, system disclosure) are implemented at content-publish boundaries
