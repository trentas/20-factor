---
layout: page
title: factors
permalink: /factors/
description: All 20 factors organized by tier.
nav: true
nav_order: 1
horizontal: false
tiers:
  - num: "01"
    category: "Tier 1: Foundation"
    name: "Foundation"
    range: "Factors 1 – 4"
    desc: "Codebase, contracts, dependencies, and configuration."
  - num: "02"
    category: "Tier 2: Construction"
    name: "Construction"
    range: "Factors 5 – 8"
    desc: "Build pipeline, evaluation, responsible AI, and identity."
  - num: "03"
    category: "Tier 3: Operation"
    name: "Operation"
    range: "Factors 9 – 15"
    desc: "Lifecycle, backing services, parity, caching, durable execution, concurrency, and observability."
  - num: "04"
    category: "Tier 4: Intelligence"
    name: "Intelligence"
    range: "Factors 16 – 20"
    desc: "Models, prompts, agents, memory, and economics."
---

<style>
  .tf-factors {
    font-feature-settings: "kern", "liga", "ss01";
  }

  .tf-tier-header {
    display: grid;
    grid-template-columns: 3.25rem 11rem 1fr;
    column-gap: 2rem;
    padding: 1.4rem 0.25rem;
    border-top: 1px solid var(--global-divider-color);
    border-bottom: 1px solid var(--global-divider-color);
    align-items: baseline;
    margin: 2.75rem 0 1.75rem;
    text-decoration: none;
  }
  .tf-tier-header:hover { text-decoration: none; }
  .tf-factors > .tf-tier-header:first-of-type { margin-top: 0.5rem; }

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
    .tf-tier-header {
      grid-template-columns: 2.5rem 1fr;
      grid-template-rows: auto auto;
      column-gap: 1rem;
      row-gap: 0.45rem;
      padding: 1.15rem 0.1rem;
    }
    .tf-tier-num { grid-row: 1 / span 2; padding-top: 0.15rem; }
    .tf-tier-meta { grid-column: 2; }
    .tf-tier-desc { grid-column: 2; font-size: 0.92rem; }
  }
</style>

<div class="projects tf-factors">
{% if site.enable_project_categories and page.tiers %}
  {% for tier in page.tiers %}
  <a id="{{ tier.category }}" href="#{{ tier.category }}" class="tf-tier-header">
    <span class="tf-tier-num">{{ tier.num }}</span>
    <div class="tf-tier-meta">
      <span class="tf-tier-name">{{ tier.name }}</span>
      <span class="tf-tier-range">{{ tier.range }}</span>
    </div>
    <p class="tf-tier-desc">{{ tier.desc }}</p>
  </a>
  {% assign categorized_projects = site.projects | where: "category", tier.category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endfor %}
{% endif %}
</div>
