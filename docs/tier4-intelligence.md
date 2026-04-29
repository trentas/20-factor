---
title: "Tier 4: Intelligence"
nav_order: 5
has_children: true
description: "Factors unique to AI-native applications — managing AI-specific capabilities."
---

# Tier 4: Intelligence

Factors unique to AI-native applications — managing the AI-specific capabilities.

All five factors in this tier are new — they have no predecessors in the original 12 or 15-factor methodologies. They exist because LLMs, agents, and AI-specific economics require architectural patterns that simply didn't exist before.

---

<table class="factors-table">
  <thead>
    <tr><th>#</th><th>Factor</th><th>Summary</th><th>Origin</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>16</td>
      <td><a href="{{ '/factors/16-model-lifecycle-management/' | relative_url }}">Model Lifecycle Management</a></td>
      <td>Model registry, version pinning, A/B testing, deprecation planning, fine-tuning pipelines</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>17</td>
      <td><a href="{{ '/factors/17-prompt-context-engineering/' | relative_url }}">Prompt & Context Engineering</a></td>
      <td>Prompt versioning, context window management, RAG pipeline design, token budgeting</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>18</td>
      <td><a href="{{ '/factors/18-agent-orchestration-bounded-autonomy/' | relative_url }}">Agent Orchestration & Bounded Autonomy</a></td>
      <td>Agent architecture, tool permissions, execution budgets, human-in-the-loop gates</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>19</td>
      <td><a href="{{ '/factors/19-agent-memory-architecture/' | relative_url }}">Agent Memory Architecture</a></td>
      <td>Vector, graph, and episodic memory layers with identity-bound lifecycle, decay, and right-to-erasure</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>20</td>
      <td><a href="{{ '/factors/20-ai-economics-cost-architecture/' | relative_url }}">AI Economics & Cost Architecture</a></td>
      <td>Per-token cost modeling, model routing, semantic caching ROI, budget circuit breakers</td>
      <td><strong>New</strong></td>
    </tr>
  </tbody>
</table>

---

{: .highlight }
> **For teams starting with AI capabilities**, Factor 20 (AI Economics) is the highest-leverage factor to address first — cost surprises are the most common production incident in new AI deployments. Then Factor 17 (Prompt Engineering) to establish prompt discipline, and Factor 18 (Agent Orchestration) if you're building autonomous agents.

## Key Themes in Tier 4

**Models are a separate axis of change** (Factor 16)
Code can stay constant while model behavior changes due to provider updates. Models have their own lifecycle — selection, fine-tuning, deployment, deprecation — independent of the application lifecycle.

**Context is a managed resource** (Factor 17)
The context window is finite and expensive. What you include (and exclude) directly impacts quality, cost, and latency. Prompt engineering is software engineering.

**Bounded autonomy, not unlimited agency** (Factor 18)
AI agents can accomplish remarkable things, but the architecture must define clear boundaries, escalation paths, and human oversight. Boundaries are enforced by code, not by prompts.

**Memory is not cache** (Factor 19)
Long-term agent memory — what an agent remembers about a user, project, or entity across sessions — is a distinct architectural layer from both stateless caching (Factor 12) and RAG knowledge stores (Factor 17).

**Cost at the token level** (Factor 20)
Unlike traditional compute, AI costs scale with usage at the token level. A single agent workflow can cost dollars. Cost architecture — routing, caching, budgets, circuit breakers — is as important as system architecture.
