---
title: Home
nav_order: 1
description: "20 principles for building cloud-native AI applications — extending the original 12-Factor methodology for LLMs, agents, and AI-native systems."
permalink: /
---

<div class="home-hero">
  <p class="hero-tagline">Cloud-Native Application Development in the AI Era</p>
  <p class="hero-desc">
    An open methodology extending the original 12-Factor App for teams building
    LLM-powered products, autonomous agents, and AI-native systems.
  </p>
  <div class="hero-btns">
    <a href="{{ site.baseurl }}/assessment.html" class="btn-primary">📊 Maturity Assessment</a>
    <a href="{{ '/docs/tier1-foundation/' | relative_url }}" class="btn-outline">Read the Factors →</a>
  </div>
  <div class="stat-row">
    <div class="stat"><div class="stat-num">20</div><div class="stat-label">Factors</div></div>
    <div class="stat"><div class="stat-num">4</div><div class="stat-label">Tiers</div></div>
    <div class="stat"><div class="stat-num">235+</div><div class="stat-label">Checklist Items</div></div>
    <div class="stat"><div class="stat-num">2026</div><div class="stat-label">Edition</div></div>
  </div>
</div>

---

## The 4 Tiers

<div class="tier-grid">

<div class="tier-card tc-f">
  <div class="tier-badge">Tier 1</div>
  <div class="tier-title">🔵 Foundation</div>
  <ul>
    <li><a href="{{ '/factors/01-declarative-codebase/' | relative_url }}">1. Declarative Codebase</a></li>
    <li><a href="{{ '/factors/02-contract-first-interfaces/' | relative_url }}">2. Contract-First Interfaces</a></li>
    <li><a href="{{ '/factors/03-dependency-management/' | relative_url }}">3. Dependency Management</a></li>
    <li><a href="{{ '/factors/04-configuration-credentials-context/' | relative_url }}">4. Config, Credentials & Context</a></li>
  </ul>
  <a href="{{ '/docs/tier1-foundation/' | relative_url }}" class="tier-more">Explore Tier 1 →</a>
</div>

<div class="tier-card tc-c">
  <div class="tier-badge">Tier 2</div>
  <div class="tier-title">🟡 Construction</div>
  <ul>
    <li><a href="{{ '/factors/05-immutable-build-pipeline/' | relative_url }}">5. Immutable Build Pipeline</a></li>
    <li><a href="{{ '/factors/06-evaluation-driven-development/' | relative_url }}">6. Evaluation-Driven Development</a></li>
    <li><a href="{{ '/factors/07-responsible-ai-by-design/' | relative_url }}">7. Responsible AI by Design</a></li>
    <li><a href="{{ '/factors/08-identity-access-trust/' | relative_url }}">8. Identity, Access & Trust</a></li>
  </ul>
  <a href="{{ '/docs/tier2-construction/' | relative_url }}" class="tier-more">Explore Tier 2 →</a>
</div>

<div class="tier-card tc-o">
  <div class="tier-badge">Tier 3</div>
  <div class="tier-title">🟢 Operation</div>
  <ul>
    <li><a href="{{ '/factors/09-disposability-graceful-lifecycle/' | relative_url }}">9. Disposability & Graceful Lifecycle</a></li>
    <li><a href="{{ '/factors/10-intelligent-backing-services/' | relative_url }}">10. Intelligent Backing Services</a></li>
    <li><a href="{{ '/factors/11-environment-parity/' | relative_url }}">11. Environment Parity</a></li>
    <li><a href="{{ '/factors/12-stateless-processes-intelligent-caching/' | relative_url }}">12. Stateless Processes + Smart Cache</a></li>
    <li><a href="{{ '/factors/13-durable-agent-runtime/' | relative_url }}">13. Durable Agent Runtime</a></li>
    <li><a href="{{ '/factors/14-adaptive-concurrency/' | relative_url }}">14. Adaptive Concurrency</a></li>
    <li><a href="{{ '/factors/15-full-spectrum-observability/' | relative_url }}">15. Full-Spectrum Observability</a></li>
  </ul>
  <a href="{{ '/docs/tier3-operation/' | relative_url }}" class="tier-more">Explore Tier 3 →</a>
</div>

<div class="tier-card tc-i">
  <div class="tier-badge">Tier 4</div>
  <div class="tier-title">🟣 Intelligence</div>
  <ul>
    <li><a href="{{ '/factors/16-model-lifecycle-management/' | relative_url }}">16. Model Lifecycle Management</a></li>
    <li><a href="{{ '/factors/17-prompt-context-engineering/' | relative_url }}">17. Prompt & Context Engineering</a></li>
    <li><a href="{{ '/factors/18-agent-orchestration-bounded-autonomy/' | relative_url }}">18. Agent Orchestration & Autonomy</a></li>
    <li><a href="{{ '/factors/19-agent-memory-architecture/' | relative_url }}">19. Agent Memory Architecture</a></li>
    <li><a href="{{ '/factors/20-ai-economics-cost-architecture/' | relative_url }}">20. AI Economics & Cost Architecture</a></li>
  </ul>
  <a href="{{ '/docs/tier4-intelligence/' | relative_url }}" class="tier-more">Explore Tier 4 →</a>
</div>

</div>

---

## How to Use This Methodology

**For traditional cloud-native apps** — Tiers 1–3 (Factors 1–15) apply directly. Tier 4 becomes relevant when you add AI capabilities.

**For AI-native applications** — All 20 factors apply. Start with Foundation and build upward.

Each factor document covers **Motivation**, **In Practice** (with code examples), and a **Compliance Checklist**. Use the [Maturity Assessment]({{ site.baseurl }}/assessment.html) to benchmark your application across all 235+ checklist items, visualize results as a radar chart, and export per-application profiles.

---

## Guiding Principles

<div class="principles-grid">

<div class="principle-card">
  <strong>Extend, don't discard</strong>
  The original 12/15 factors were right. This methodology builds on them rather than replacing them.
</div>

<div class="principle-card">
  <strong>AI is a tool AND a component</strong>
  Covers both using AI to <em>build</em> software and building software that <em>contains</em> AI.
</div>

<div class="principle-card">
  <strong>Architecture over prompts</strong>
  When controlling AI behavior, code-level enforcement beats asking the model nicely.
</div>

<div class="principle-card">
  <strong>Non-determinism is the default</strong>
  AI outputs are probabilistic. Testing and monitoring must account for distributions, not single values.
</div>

<div class="principle-card">
  <strong>Cost is first-class</strong>
  Unlike traditional compute, AI costs scale at the token level. Cost architecture matters as much as system architecture.
</div>

<div class="principle-card">
  <strong>Agent state is durable</strong>
  Workers stay stateless, but agent execution state — plans, tool-call journals, human approvals — is persisted and resumable.
</div>

</div>

---

## What Changed from the Original 15 Factors

See the [Factor Mapping]({{ '/docs/mapping/' | relative_url }}) for a detailed mapping of every original factor.

| Change | Count |
|--------|-------|
| Factors updated for the AI era | 10 |
| Factors merged | 2 |
| Factors retired (now table-stakes) | 2 |
| New factors introduced | 8 |
| **Total** | **20** |
