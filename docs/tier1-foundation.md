---
title: "Tier 1: Foundation"
nav_order: 2
has_children: true
description: "The bedrock principles — how code, interfaces, dependencies, and configuration are organized."
---

# Tier 1: Foundation

The bedrock principles — how code, interfaces, dependencies, and configuration are organized.

These four factors apply to every application regardless of whether it uses AI. They establish the fundamental disciplines that everything else builds on.

---

<table class="factors-table">
  <thead>
    <tr><th>#</th><th>Factor</th><th>Summary</th><th>Origin</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td><a href="{{ '/factors/01-declarative-codebase/' | relative_url }}">Declarative Codebase</a></td>
      <td>Every artifact — code, infrastructure, prompts — lives in version control as a declarative specification</td>
      <td>Updated from original #1</td>
    </tr>
    <tr>
      <td>2</td>
      <td><a href="{{ '/factors/02-contract-first-interfaces/' | relative_url }}">Contract-First Interfaces</a></td>
      <td>Define interfaces before implementation — for APIs, events, and agent tool schemas</td>
      <td>Updated from 15-Factor #2</td>
    </tr>
    <tr>
      <td>3</td>
      <td><a href="{{ '/factors/03-dependency-management/' | relative_url }}">Dependency Management</a></td>
      <td>Explicitly declare and isolate all dependencies, including AI SDKs and model weights</td>
      <td>Updated from original #2</td>
    </tr>
    <tr>
      <td>4</td>
      <td><a href="{{ '/factors/04-configuration-credentials-context/' | relative_url }}">Configuration, Credentials & Context</a></td>
      <td>Store config in the environment, credentials in secrets management, AI context in versioned files</td>
      <td>Updated from 15-Factor #5</td>
    </tr>
  </tbody>
</table>

---

{: .note }
> **Start here.** If your team is new to this methodology, Tier 1 is the entry point. These factors are prerequisites for everything in Tiers 2–4.

## What's New in the AI Era

| Factor | AI-era additions |
|--------|-----------------|
| [1. Declarative Codebase]({{ '/factors/01-declarative-codebase/' | relative_url }}) | Prompts-as-code, agent tool schemas, eval datasets as versioned artifacts, AIBOM/MLBOM as build output |
| [2. Contract-First Interfaces]({{ '/factors/02-contract-first-interfaces/' | relative_url }}) | MCP tool schemas, A2A agent contracts, LLM structured output schemas, MCP Gateway with OAuth 2.1 |
| [3. Dependency Management]({{ '/factors/03-dependency-management/' | relative_url }}) | AI SDK pinning, model weights as versioned deps, CUDA/ROCm/Trainium accelerator variants, SLSA provenance |
| [4. Config, Credentials & Context]({{ '/factors/04-configuration-credentials-context/' | relative_url }}) | Model selection as config, cost budgets, Workload Identity (keyless auth), OpenFeature, HSM/KMS for context |
