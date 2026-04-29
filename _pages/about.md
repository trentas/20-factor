---
layout: about
title: about
permalink: /
description: 20 principles for building cloud-native AI applications.

profile:
  align: right
  image:
  image_circular: false
  more_info:

news: false
selected_papers: false
social: false
---

## The 20-Factor App

A methodology for building cloud-native AI applications — extending the original [12-Factor App](https://12factor.net) for teams shipping LLM-powered products, autonomous agents, and AI-native systems.

The methodology is organized in **4 tiers** that build on each other, from foundational practices to AI-specific intelligence layers.

---

<div class="row mt-3">
  <div class="col-sm-6 col-lg-3 mb-3">
    <div class="card h-100" style="border-left: 4px solid #2563eb;">
      <div class="card-body">
        <h5 class="card-title fw-bold" style="color:#2563eb;">Tier 1 — Foundation</h5>
        <p class="card-text small">Factors 1–4. Codebase, contracts, dependencies, and configuration.</p>
      </div>
    </div>
  </div>
  <div class="col-sm-6 col-lg-3 mb-3">
    <div class="card h-100" style="border-left: 4px solid #d97706;">
      <div class="card-body">
        <h5 class="card-title fw-bold" style="color:#d97706;">Tier 2 — Construction</h5>
        <p class="card-text small">Factors 5–8. Build pipeline, evaluation, responsible AI, identity.</p>
      </div>
    </div>
  </div>
  <div class="col-sm-6 col-lg-3 mb-3">
    <div class="card h-100" style="border-left: 4px solid #059669;">
      <div class="card-body">
        <h5 class="card-title fw-bold" style="color:#059669;">Tier 3 — Operation</h5>
        <p class="card-text small">Factors 9–14. Lifecycle, backing services, parity, caching, durable execution.</p>
      </div>
    </div>
  </div>
  <div class="col-sm-6 col-lg-3 mb-3">
    <div class="card h-100" style="border-left: 4px solid #7c3aed;">
      <div class="card-body">
        <h5 class="card-title fw-bold" style="color:#7c3aed;">Tier 4 — Intelligence</h5>
        <p class="card-text small">Factors 15–20. Observability, models, prompts, agents, memory, economics.</p>
      </div>
    </div>
  </div>
</div>

<div class="row mt-4">
  <div class="col text-center">
    <a href="{{ '/factors/' | relative_url }}" class="btn btn-outline-primary btn-lg me-3">Browse All 20 Factors →</a>
    <a href="{{ '/assessment.html' | relative_url }}" class="btn btn-outline-secondary btn-lg">📊 Maturity Assessment</a>
  </div>
</div>

---

### What Changed from 12-Factor?

| | Original 12-Factor | The 20-Factor App |
|---|---|---|
| **Era** | 2011 — Heroku era | 2026 — LLM/agent era |
| **Artifacts** | Code + config | Code + config + **models + prompts** |
| **Scale** | Stateless web apps | Stateless apps + **durable agent workflows** |
| **New factors** | — | F7 Responsible AI, F13 Durable Runtime, F16 Model Lifecycle, F17 Prompts, F18 Agents, F19 Memory, F20 Economics |

The 8 new factors cover concerns that didn't exist in 2011: LLM inference cost, model versioning, prompt engineering, agent orchestration, long-term memory, and AI safety.
