---
layout: page
title: factors
permalink: /factors/
description: All 20 factors organized by tier.
nav: true
nav_order: 1
display_categories: ["Tier 1: Foundation", "Tier 2: Construction", "Tier 3: Operation", "Tier 4: Intelligence"]
horizontal: false
---

<!-- pages/factors.md -->
<div class="projects">
{% if site.enable_project_categories and page.display_categories %}
  {% for category in page.display_categories %}
  <a id="{{ category }}" href=".#{{ category }}">
    <h2 class="category">{{ category }}</h2>
  </a>
  {% assign categorized_projects = site.projects | where: "category", category %}
  {% assign sorted_projects = categorized_projects | sort: "importance" %}
  <div class="row row-cols-1 row-cols-md-3">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
  {% endfor %}
{% endif %}
</div>
