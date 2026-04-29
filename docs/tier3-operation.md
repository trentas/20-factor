---
title: "Tier 3: Operation"
nav_order: 4
has_children: true
description: "How applications run, scale, and are monitored in production."
---

# Tier 3: Operation

How applications run, scale, and are monitored in production.

This tier has the most factors — seven — because operating AI applications in production introduces the most new complexity: GPU lifecycle management, AI provider rate limits, durable agent execution, and full-spectrum observability beyond logs and metrics.

---

<table class="factors-table">
  <thead>
    <tr><th>#</th><th>Factor</th><th>Summary</th><th>Origin</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>9</td>
      <td><a href="{{ '/factors/09-disposability-graceful-lifecycle/' | relative_url }}">Disposability & Graceful Lifecycle</a></td>
      <td>Fast startup, graceful shutdown — with GPU release and LLM request draining</td>
      <td>Updated from original #9</td>
    </tr>
    <tr>
      <td>10</td>
      <td><a href="{{ '/factors/10-intelligent-backing-services/' | relative_url }}">Intelligent Backing Services</a></td>
      <td>Treat LLM providers, vector DBs, and embedding services as attached resources</td>
      <td>Updated from original #4</td>
    </tr>
    <tr>
      <td>11</td>
      <td><a href="{{ '/factors/11-environment-parity/' | relative_url }}">Environment Parity</a></td>
      <td>Keep dev, staging, and production similar — including model behavior and data representativeness</td>
      <td>Updated from original #10</td>
    </tr>
    <tr>
      <td>12</td>
      <td><a href="{{ '/factors/12-stateless-processes-intelligent-caching/' | relative_url }}">Stateless Processes + Smart Cache</a></td>
      <td>Stateless workers with semantic, embedding, and provider prompt caching for AI operations</td>
      <td>Updated from original #6</td>
    </tr>
    <tr>
      <td>13</td>
      <td><a href="{{ '/factors/13-durable-agent-runtime/' | relative_url }}">Durable Agent Runtime</a></td>
      <td>Persist long-running agent execution state with journaling, idempotent tool calls, and durable HITL interrupts</td>
      <td><strong>New</strong></td>
    </tr>
    <tr>
      <td>14</td>
      <td><a href="{{ '/factors/14-adaptive-concurrency/' | relative_url }}">Adaptive Concurrency</a></td>
      <td>Scale independently across CPU, GPU, rate limits, and cost budgets</td>
      <td>Updated from original #8</td>
    </tr>
    <tr>
      <td>15</td>
      <td><a href="{{ '/factors/15-full-spectrum-observability/' | relative_url }}">Full-Spectrum Observability</a></td>
      <td>Logs, traces, and metrics — plus token economics, quality scores, and safety monitoring</td>
      <td>Merged from original #11 + 15-Factor #14</td>
    </tr>
  </tbody>
</table>

---

{: .note }
> **Factor 13 (Durable Agent Runtime) is the newest addition** in this tier — added to address the architectural gap where teams tried to implement long-running agent workflows using stateless request handlers, leading to lost progress on any failure.

## What's New in the AI Era

| Factor | AI-era additions |
|--------|-----------------|
| [9. Disposability]({{ '/factors/09-disposability-graceful-lifecycle/' | relative_url }}) | GPU memory release, model loading startup phases, request draining, K8s PDB, spot GPU, CRIU warm pools |
| [10. Backing Services]({{ '/factors/10-intelligent-backing-services/' | relative_url }}) | LLM providers, vector DBs, MCP servers, AI Gateway, GraphRAG, hybrid search, feature stores |
| [11. Environment Parity]({{ '/factors/11-environment-parity/' | relative_url }}) | Model version parity, representative staging data, dev containers, data-residency parity, traffic mirroring |
| [12. Stateless + Caching]({{ '/factors/12-stateless-processes-intelligent-caching/' | relative_url }}) | Semantic caching, provider prompt caching, PagedAttention KV cache, speculative decoding |
| [13. Durable Agent Runtime]({{ '/factors/13-durable-agent-runtime/' | relative_url }}) | Temporal/Restate/Inngest, journal/replay, idempotency keys, durable HITL interrupts, spot recovery |
| [14. Adaptive Concurrency]({{ '/factors/14-adaptive-concurrency/' | relative_url }}) | GPU scaling, rate-limit management, thinking-token budgets, edge/NPU routing, inference engine selection |
| [15. Full-Spectrum Observability]({{ '/factors/15-full-spectrum-observability/' | relative_url }}) | Token economics, quality scores, safety monitoring, OTel GenAI conventions, carbon/energy metrics |
