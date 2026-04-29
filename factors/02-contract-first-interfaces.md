# Factor 2: Contract-First Interfaces

> Define the interface before the implementation — for APIs, events, agent tools, and every boundary where systems or models interact.

## Motivation

The original "API First" factor recognized that modern applications are composed of services that communicate over well-defined interfaces. In 2025, the surface area of interfaces has expanded far beyond REST APIs. Services communicate via gRPC, GraphQL, event streams, and message queues. AI agents interact with the world through tool schemas. Models consume and produce structured data that must conform to contracts.

Contract-first design — specifying the interface before writing the implementation — prevents integration failures, enables parallel development, and makes systems composable. When AI agents are part of the system, contracts become even more critical: a poorly defined tool schema means an agent that misuses tools, hallucinates parameters, or fails silently.

## What This Replaces

**Beyond 15-Factor #2: API First** — "The best time to design an API is before you write any code."

This update broadens the principle from HTTP APIs to all interface boundaries:

- REST, gRPC, and GraphQL API contracts
- Asynchronous event schemas (CloudEvents, AsyncAPI)
- AI agent tool definitions (function calling schemas, MCP tool schemas)
- Agent-to-agent communication (A2A protocol agent cards)
- Model input/output contracts
- Inter-service message formats

## How AI Changes This

### AI-Assisted Development
- AI coding tools can generate server stubs, client SDKs, and test harnesses from contract definitions (OpenAPI, protobuf, AsyncAPI).
- Contract-first design gives AI assistants clear constraints, producing more accurate generated code.
- Schema definitions serve as unambiguous specifications that AI tools can reason about.

### AI-Native Applications
- **Tool schemas as contracts**: When an LLM uses function calling, the JSON Schema defining each tool *is* the contract. Poorly defined schemas lead to hallucinated parameters, type mismatches, and security vulnerabilities. The **Model Context Protocol (MCP)** standardizes this contract, providing a universal protocol for tool discovery and invocation across any model or agent framework.
- **Structured output contracts**: When an LLM is expected to produce JSON, the output schema is a contract. Use constrained decoding or schema validation to enforce it.
- **Agent-to-agent communication**: Multi-agent systems need well-defined message formats. The **Agent-to-Agent (A2A) protocol** standardizes task delegation, status updates, and result exchange between agents. Agent Cards — machine-readable capability declarations — serve as the contract for what each agent can do.
- **RAG pipeline contracts**: The interface between retrieval and generation — what context is passed, in what format, with what metadata — must be explicitly defined. Factor 17 covers the full RAG pipeline design (ingestion and query-time); Factor 12 covers semantic caching within RAG.

## In Practice

### API Contracts
Define APIs using standard specification formats before writing implementation code:

```yaml
# openapi.yaml — the contract comes first
openapi: 3.1.0
paths:
  /documents/{id}/summary:
    post:
      summary: Generate an AI summary of a document
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SummaryRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SummaryResponse'
```

### Event Contracts
Use AsyncAPI or CloudEvents to define event schemas:

```yaml
# asyncapi.yaml
channels:
  document.summarized:
    publish:
      message:
        payload:
          type: object
          properties:
            documentId:
              type: string
              format: uuid
            summary:
              type: string
            model:
              type: string
            tokenUsage:
              $ref: '#/components/schemas/TokenUsage'
```

### Agent Tool Schemas
Define tool contracts with precision — every parameter typed, described, and constrained:

```json
{
  "name": "search_knowledge_base",
  "description": "Search the knowledge base for relevant documents. Use when the user asks a question that requires factual information.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query, rephrased for semantic search",
        "minLength": 3,
        "maxLength": 500
      },
      "filters": {
        "type": "object",
        "properties": {
          "date_range": {
            "type": "string",
            "enum": ["last_week", "last_month", "last_year", "all_time"]
          },
          "document_type": {
            "type": "string",
            "enum": ["policy", "procedure", "faq", "knowledge_article"]
          }
        }
      },
      "max_results": {
        "type": "integer",
        "minimum": 1,
        "maximum": 20,
        "default": 5
      }
    },
    "required": ["query"]
  }
}
```

### MCP: The Standard Protocol for Tool Interfaces

The **Model Context Protocol (MCP)** has emerged as the open standard for connecting AI models to external tools and data sources. Rather than defining tool schemas ad hoc per agent or per provider, MCP provides a unified protocol that any model or agent framework can use to discover and invoke tools.

MCP standardizes the contract between AI agents and their tools:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

```json
{
  "tools": [
    {
      "name": "search_knowledge_base",
      "description": "Search the knowledge base for relevant documents",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "The search query, rephrased for semantic search"
          },
          "max_results": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20,
            "default": 5
          }
        },
        "required": ["query"]
      }
    }
  ]
}
```

Key design principles for MCP tool contracts:
- **MCP servers as contract artifacts**: An MCP server *is* the contract implementation. The tool schema it exposes is the interface definition, and the server enforces it.
- **Discovery over hardcoding**: Agents discover available tools at runtime via `tools/list`, enabling dynamic composition. New capabilities can be added by deploying a new MCP server without changing agent code.
- **Resources and prompts**: Beyond tools, MCP defines contracts for resources (data the model can read) and prompts (reusable prompt templates). All three — tools, resources, and prompts — follow the same contract-first principle.
- **Transport-agnostic**: MCP works over stdio (local) and HTTP+SSE (remote), so the same contract applies whether the tool runs locally or as a remote service.

When designing MCP servers, apply the same contract-first principles from this factor: define the tool schemas with precise types, descriptions, and constraints *before* implementing the server logic. The schema descriptions are consumed by LLMs, so clarity matters.

### A2A: The Standard Protocol for Agent-to-Agent Communication

While MCP standardizes how agents interact with tools, the **Agent-to-Agent (A2A) protocol** standardizes how agents interact with each other. In multi-agent systems (Factor 18), agents need a common contract for task delegation, status updates, and result exchange.

A2A defines:
- **Agent Cards**: Machine-readable descriptions of an agent's capabilities, published at a well-known URL. These are the contract for what an agent can do.
- **Task lifecycle**: A standard state machine (submitted → working → completed/failed) with streaming updates, so orchestrators can manage tasks uniformly regardless of the agent implementation.
- **Message exchange**: A common message format for agent-to-agent communication, including support for multimodal content (text, files, structured data).

```json
{
  "name": "research-assistant",
  "description": "Researches topics using web search and knowledge base",
  "url": "https://agents.example.com/research",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true
  },
  "skills": [
    {
      "id": "web-research",
      "name": "Web Research",
      "description": "Search the web and synthesize findings"
    }
  ]
}
```

A2A and MCP are complementary:
- **MCP** = agent-to-tool contracts (how an agent uses tools)
- **A2A** = agent-to-agent contracts (how agents delegate tasks to each other)
- Together, they provide a complete contract framework for AI-native applications

### MCP Gateway as Production Topology

In production, putting an **MCP Gateway** in front of MCP servers is now the default topology. Direct agent → MCP server connections suffice for local development; production needs a control plane:

- **OAuth 2.1 enforcement**: MCP standardized on OAuth 2.1 (with audited spec by 2026). The gateway centralizes auth, scope, token rotation, and audit logging — application code doesn't reimplement it.
- **Tool catalog**: a single `tools/list` aggregating servers across the org, with versioning, deprecation flags, and per-tenant exposure rules.
- **Rate limiting and budget enforcement**: per-tool, per-tenant, per-agent — enforced at the gateway, not in each server.
- **Observability**: every tool call is logged in one place with the same correlation IDs as model calls (cross-ref Factor 15).
- **Fail-closed defaults**: a tool that returns 5xx repeatedly is automatically circuit-broken at the gateway level.

```yaml
# mcp-gateway.yaml — minimal example
gateway:
  upstreams:
    - name: knowledge-base
      url: http://kb-mcp:8080
      oauth: { scopes: ["kb.read"] }
      rate_limit: { rpm_per_tenant: 60 }
    - name: code-execution
      url: http://exec-mcp:8080
      oauth: { scopes: ["exec.run"] }
      tenant_allowlist: ["tier-pro", "tier-enterprise"]
      rate_limit: { rpm_per_tenant: 10 }
  defaults:
    audit_log: true
    circuit_breaker: { failure_threshold: 0.5, window_seconds: 60 }
```

Vendors in this space include Portkey, Kong AI Gateway, and dedicated MCP-aware gateways. Whether built or bought, the principle is: **the contract layer needs an enforcement layer in production**.

### Skills as a Capability Primitive

**Skills** consolidated in 2025–2026 as a packaging primitive for agent capabilities — Anthropic introduced the format, OpenAI adopted it shortly after. A skill bundles:

- A name and description (the discovery contract)
- Required tools (which can be MCP server tools)
- Required resources (files, knowledge bases)
- Optional system prompt fragment

Skills are contracts at the *capability* level, sitting above individual tool schemas. Where MCP says "here is a tool," a skill says "here is a way of doing something that requires these tools and behaves like this." Treat the skill manifest as a versioned artifact — same review and CI rules as OpenAPI or protobuf.

```yaml
# skill.yaml
name: invoice-reconciliation
description: Reconcile invoices against payment records and flag discrepancies
version: 1.2.0
tools:
  - mcp://accounts-mcp/list_invoices
  - mcp://payments-mcp/list_payments
  - mcp://accounts-mcp/flag_discrepancy
resources:
  - reconciliation-policy.md
prompt_fragment: prompts/invoice-reconciliation.md
guardrails:
  max_invoices_per_run: 500
  human_approval_required_above_amount_usd: 10000
```

### AGNTCY: Discovery for Agent Networks

For multi-agent systems that span teams, organizations, or vendors, A2A's Agent Cards work but discovery becomes the bottleneck — how does an orchestrator find a "research agent" without hardcoding URLs? The **AGNTCY Agent Directory Service** (DNS-like discovery for agents) emerged to fill this gap. Agents publish capability declarations to a directory; orchestrators query the directory by capability rather than by name.

The directory service entry is itself a contract. Treat it as part of the same contract-first discipline: review, version, and test the capabilities you publish.

### OTel GenAI Semantic Conventions

Telemetry is also a contract. The **OpenTelemetry GenAI semantic conventions** (stabilizing through 2026) define standard span and metric names for LLM calls, tool invocations, and agent steps:

- `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.thinking_tokens`
- Tool span: `gen_ai.tool.name`, `gen_ai.tool.call.id`
- Agent span: `gen_ai.agent.id`, `gen_ai.agent.step`

Adopting these conventions makes traces portable across tools (Langfuse, LangSmith, Arize, Helicone, Datadog) and across teams. Treat the OTel GenAI spec as an inbound contract — your telemetry conforms to it the same way your API conforms to OpenAPI.

### Contract Testing
- Use contract testing frameworks (Pact, Specmatic) to verify implementations match contracts.
- Validate LLM structured outputs against JSON Schema at runtime.
- Test agent tool calls against tool schemas in evaluation suites — including MCP tool schemas.
- Test A2A agent cards for accuracy (declared capabilities match actual behavior).
- Version contracts and maintain backwards compatibility or explicit migration paths.

### Design Principles
- **Be explicit**: Every field has a type, description, and constraints. AI models perform better with clear, specific schemas.
- **Be restrictive**: Use enums, min/max, and required fields to constrain the space of valid inputs. Smaller valid input space = fewer hallucination opportunities.
- **Be evolvable**: Use additive changes (new optional fields) rather than breaking changes. Version your contracts.
- **Be documented**: Descriptions in schemas are not just for humans — LLMs read them too. Good descriptions improve tool-use accuracy.

## Compliance Checklist

- [ ] All service APIs have machine-readable contract definitions (OpenAPI, protobuf, GraphQL SDL)
- [ ] Contracts are written before implementations and stored in version control
- [ ] Asynchronous event interfaces have schema definitions (AsyncAPI, CloudEvents)
- [ ] AI agent tool definitions include typed parameters with descriptions and constraints (MCP tool schemas preferred)
- [ ] Agent-to-agent interfaces use standardized protocols (A2A) with machine-readable capability declarations
- [ ] LLM structured output schemas are explicitly defined and validated at runtime
- [ ] Contract tests verify that implementations match their specifications
- [ ] Contracts are versioned with clear compatibility and deprecation policies
- [ ] Schema descriptions are written to be useful for both humans and AI models
- [ ] Breaking changes go through a review process with migration plans
- [ ] Cross-team interfaces have shared contract ownership and review processes
- [ ] An MCP Gateway fronts production MCP servers (OAuth 2.1, rate limits, audit log, circuit breakers)
- [ ] Skill manifests (Anthropic Skills format or equivalent) are versioned artifacts under contract review
- [ ] Cross-org agents are discoverable via an Agent Directory Service (e.g., AGNTCY) rather than hardcoded URLs
- [ ] Telemetry conforms to OpenTelemetry GenAI semantic conventions for portable traces and metrics
- [ ] MCP authorization uses OAuth 2.1 with scoped tokens and short-lived credentials
