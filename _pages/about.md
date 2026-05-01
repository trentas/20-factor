---
layout: about
title: The 20-Factor App
permalink: /
description: A methodology for cloud-native AI applications, extending the original 12-Factor App for teams shipping LLM-powered products, autonomous agents, and AI-native systems.

profile:
  align: right
  image:
  image_circular: false
  more_info:

news: false
selected_papers: false
social: false
---

<style>
  .tf-home {
    font-feature-settings: "kern", "liga", "ss01";
  }
  .tf-home p { font-size: 1rem; line-height: 1.65; }

  .tf-eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--global-text-color-light);
    font-weight: 500;
    margin: 0 0 0.85rem;
  }

  .tf-actions {
    display: flex;
    gap: 2.25rem;
    flex-wrap: wrap;
    margin: 1.25rem 0 0;
    font-size: 0.95rem;
  }
  .tf-actions a {
    color: var(--global-text-color);
    text-decoration: none;
    border-bottom: 1px solid var(--global-divider-color);
    padding-bottom: 0.2rem;
  }
  .tf-actions a:hover {
    border-bottom-color: var(--global-text-color);
    color: var(--global-text-color);
  }

  .tf-rule {
    border: none;
    border-top: 1px solid var(--global-divider-color);
    margin: 3.25rem 0 2.5rem;
  }

  .tf-section-label {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--global-text-color-light);
    font-weight: 500;
    margin: 0 0 0.5rem;
  }
  .tf-section-intro {
    color: var(--global-text-color);
    margin: 0 0 1.75rem;
    max-width: 44rem;
  }

  .tf-tiers {
    border-top: 1px solid var(--global-divider-color);
    margin: 0;
  }
  .tf-tier-details {
    border-bottom: 1px solid var(--global-divider-color);
  }
  .tf-tier-details > summary {
    list-style: none;
    cursor: pointer;
  }
  .tf-tier-details > summary::-webkit-details-marker { display: none; }
  .tf-tier {
    display: grid;
    grid-template-columns: 3.25rem 11rem 1fr 2rem;
    column-gap: 2rem;
    padding: 1.4rem 0.25rem;
    align-items: baseline;
    transition: background-color 0.15s ease;
  }
  .tf-tier-details > summary:hover .tf-tier,
  .tf-tier-details > summary:focus-visible .tf-tier {
    background-color: var(--global-code-bg-color, rgba(0,0,0,0.02));
  }
  .tf-tier-chevron {
    font-variant-numeric: tabular-nums;
    font-size: 1.1rem;
    line-height: 1;
    color: var(--global-text-color-light);
    text-align: right;
    transition: transform 0.2s ease, color 0.2s ease;
    user-select: none;
  }
  .tf-tier-details[open] .tf-tier-chevron {
    transform: rotate(45deg);
    color: var(--global-text-color);
  }
  .tf-tier-projects {
    padding: 0.5rem 0 1.75rem;
  }
  .tf-tier-num {
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--global-text-color-light);
  }
  .tf-tier-name {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: -0.005em;
    display: block;
    color: var(--global-text-color);
  }
  .tf-tier-range {
    display: block;
    font-size: 0.78rem;
    color: var(--global-text-color-light);
    margin-top: 0.2rem;
    letter-spacing: 0.02em;
  }
  .tf-tier-desc {
    color: var(--global-text-color);
    margin: 0;
    font-size: 0.96rem;
    line-height: 1.55;
  }

  @media (max-width: 720px) {
    .tf-tier {
      grid-template-columns: 2.5rem 1fr 1.5rem;
      grid-template-rows: auto auto;
      column-gap: 1rem;
      row-gap: 0.45rem;
      padding: 1.15rem 0.1rem;
    }
    .tf-tier-num { grid-row: 1 / span 2; padding-top: 0.15rem; }
    .tf-tier-meta { grid-column: 2; }
    .tf-tier-desc { grid-column: 2; font-size: 0.92rem; }
    .tf-tier-chevron { grid-column: 3; grid-row: 1 / span 2; align-self: center; }
  }

  .tf-compare {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    font-size: 0.96rem;
  }
  .tf-compare th, .tf-compare td {
    padding: 1rem 1.2rem 1rem 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--global-divider-color);
    line-height: 1.55;
  }
  .tf-compare thead th {
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--global-text-color-light);
    border-bottom: 1px solid var(--global-text-color);
    padding-bottom: 0.7rem;
  }
  .tf-compare tbody th {
    width: 9rem;
    font-weight: 600;
    color: var(--global-text-color);
    white-space: nowrap;
  }
  .tf-compare tbody tr:last-child th,
  .tf-compare tbody tr:last-child td {
    border-bottom: none;
  }
  .tf-compare em { font-style: normal; font-weight: 600; }
  .tf-compare .tf-sep { color: var(--global-divider-color); margin: 0 0.5rem; }

  @media (max-width: 720px) {
    .tf-compare tbody th { width: auto; }
    .tf-compare th, .tf-compare td { padding: 0.85rem 0.6rem 0.85rem 0; }
  }

  .tf-coda {
    color: var(--global-text-color-light);
    font-size: 0.96rem;
    line-height: 1.65;
    max-width: 44rem;
    margin: 1.75rem 0 0;
  }
</style>

<div class="tf-home" markdown="0">

<nav class="tf-actions" aria-label="Primary">
  <a href="{{ '/assessment.html' | relative_url }}">Maturity assessment &rarr;</a>
</nav>

<hr class="tf-rule">

<p class="tf-section-label">Structure</p>
<p class="tf-section-intro">
  Twenty factors organized in four tiers — from foundational engineering practices
  to AI-specific intelligence layers. Click a tier to reveal its factors.
</p>

{% assign tier_data = "01|Foundation|Factors 1 – 4|Codebase, contracts, dependencies, and configuration.|Tier 1: Foundation,02|Construction|Factors 5 – 8|Build pipeline, evaluation, responsible AI, and identity.|Tier 2: Construction,03|Operation|Factors 9 – 15|Lifecycle, backing services, parity, caching, durable execution, concurrency, and observability.|Tier 3: Operation,04|Intelligence|Factors 16 – 20|Models, prompts, agents, memory, and economics.|Tier 4: Intelligence" | split: "," %}

<div class="tf-tiers projects">
  {% for entry in tier_data %}
    {% assign parts = entry | split: "|" %}
    {% assign t_num = parts[0] %}
    {% assign t_name = parts[1] %}
    {% assign t_range = parts[2] %}
    {% assign t_desc = parts[3] %}
    {% assign t_category = parts[4] %}
    {% assign anchor = t_category | replace: " ", "-" | replace: ":", "" %}
    <details class="tf-tier-details" id="{{ anchor }}">
      <summary class="tf-tier">
        <span class="tf-tier-num">{{ t_num }}</span>
        <div class="tf-tier-meta">
          <span class="tf-tier-name">{{ t_name }}</span>
          <span class="tf-tier-range">{{ t_range }}</span>
        </div>
        <p class="tf-tier-desc">{{ t_desc }}</p>
        <span class="tf-tier-chevron" aria-hidden="true">+</span>
      </summary>
      {% assign categorized_projects = site.projects | where: "category", t_category %}
      {% assign sorted_projects = categorized_projects | sort: "importance" %}
      <div class="row row-cols-1 row-cols-md-3 tf-tier-projects">
        {% for project in sorted_projects %}
          {% include projects.liquid %}
        {% endfor %}
      </div>
    </details>
  {% endfor %}
</div>

<hr class="tf-rule">

<p class="tf-section-label">What changed from 12-Factor</p>
<p class="tf-section-intro">
  The original 12 factors still hold. Eight new ones address what software didn't yet need in 2011.
</p>

<table class="tf-compare">
  <thead>
    <tr>
      <th></th>
      <th>Original 12-Factor</th>
      <th>The 20-Factor App</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>Era</th>
      <td>2011 — Heroku era</td>
      <td>2026 — LLM &amp; agent era</td>
    </tr>
    <tr>
      <th>Artifacts</th>
      <td>Code + config</td>
      <td>Code + config + <em>models + prompts</em></td>
    </tr>
    <tr>
      <th>Scale</th>
      <td>Stateless web apps</td>
      <td>Stateless apps + <em>durable agent workflows</em></td>
    </tr>
    <tr>
      <th>New factors</th>
      <td>—</td>
      <td>
        F6 Evaluation-Driven Dev<span class="tf-sep">·</span>F7 Responsible AI<span class="tf-sep">·</span>F13 Durable Runtime<span class="tf-sep">·</span>F16 Model Lifecycle<span class="tf-sep">·</span>F17 Prompts<span class="tf-sep">·</span>F18 Agents<span class="tf-sep">·</span>F19 Memory<span class="tf-sep">·</span>F20 Economics
      </td>
    </tr>
  </tbody>
</table>

<p class="tf-coda">
  Eight new factors cover concerns that didn't exist in 2011 — LLM inference cost,
  model versioning, prompt engineering, agent orchestration, long-term memory, and AI safety.
  The methodology extends, rather than replaces, the original twelve.
</p>

</div>
