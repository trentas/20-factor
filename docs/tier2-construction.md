---
title: "Tier 2: Construction"
nav_order: 3
has_children: true
description: "How software is built, tested, and secured for deployment."
---

# Tier 2: Construction

How software is built, tested, and secured for deployment.

Two of these four factors are entirely new to the AI era — non-deterministic systems require new testing paradigms, and responsible AI must be built in from the start, not bolted on.

---

<table class="factors-table">
  <thead>
    <tr><th>#</th><th>Factor</th><th>Summary</th><th>Origin</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>5</td>
      <td><a href="{{ '/factors/05-immutable-build-pipeline/' | relative_url }}">Immutable Build Pipeline</a></td>
      <td>Build once, deploy everywhere — with prompt compilation, model pinning, and eval gates</td>
      <td>Updated from original #5</td>
    </tr>
    <tr>
      <td>6</td>
      <td><a href="{{ '/factors/06-evaluation-driven-development/' | relative_url }}">Evaluation-Driven Development</a></td>
      <td>Use evaluations, statistical quality gates, and LLM-as-judge for non-deterministic systems</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>7</td>
      <td><a href="{{ '/factors/07-responsible-ai-by-design/' | relative_url }}">Responsible AI by Design</a></td>
      <td>Build safety, fairness, and accountability into the architecture from the start</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>8</td>
      <td><a href="{{ '/factors/08-identity-access-trust/' | relative_url }}">Identity, Access & Trust</a></td>
      <td>Every actor — human, service, and AI agent — has verifiable identity and scoped permissions</td>
      <td>Updated from 15-Factor #15</td>
    </tr>
  </tbody>
</table>

---

{: .warning }
> **Factors 6 and 7 are the most commonly skipped** in AI projects. Teams that skip them discover the problem in production — through quality regressions they can't detect, and safety incidents they can't explain.

## What's New in the AI Era

| Factor | AI-era additions |
|--------|-----------------|
| [5. Immutable Build Pipeline]({{ '/factors/05-immutable-build-pipeline/' | relative_url }}) | Prompt compilation, eval gates in CI, AIBOM/MLBOM generation, SLSA provenance, sigstore signing |
| [6. Evaluation-Driven Development]({{ '/factors/06-evaluation-driven-development/' | relative_url }}) | Statistical quality gates, LLM-as-judge, golden datasets, synthetic eval generation, calibration drift |
| [7. Responsible AI by Design]({{ '/factors/07-responsible-ai-by-design/' | relative_url }}) | Guardrails, PII detection, EU AI Act Art. 50 (C2PA/SynthID), ISO/IEC 42001, NIST AI RMF, red teaming |
| [8. Identity, Access & Trust]({{ '/factors/08-identity-access-trust/' | relative_url }}) | Agent identity, computer-use sandboxes, GPU TEE attestation, MCP OAuth 2.1 |
