---
layout: page
importance: 8
category: "Tier 2: Construction"
title: "08. Identity, Access, and Trust"
nav_order: 4
description: "Every actor — human, service, and AI agent — has verifiable identity and scoped permissions."
---

# Factor 8: Identity, Access, and Trust

> Every actor — human user, service, and AI agent — has a verifiable identity, scoped permissions, and auditable actions, with trust boundaries enforced at every layer.

## Motivation

The original security factor focused on HTTPS, identity management, and role-based access control. These remain essential, but AI introduces a new class of actors that need identity and access management: AI agents. An agent that can browse the web, write code, execute commands, or make API calls on behalf of a user is a powerful new actor in the system. Without proper identity, scoped permissions, and audit trails, agents become unaccountable vectors for privilege escalation.

The principle of least privilege applies with even more urgency to AI agents. A model that can "do anything" is a model that can do harm. Bounded autonomy — giving agents exactly the permissions they need, with clear escalation paths for actions beyond their scope — is an architectural requirement, not a nice-to-have.

> **Relationship with Factor 18 (Agent Orchestration)**: This factor defines *who* the agent is and *what* it's allowed to do — identity, permissions, and trust boundaries. Factor 18 defines *how* the agent operates within those boundaries — orchestration patterns, execution budgets, and runtime guardrails. Factor 8 is the authorization model; Factor 18 is the execution model.

## What This Replaces

**Beyond 15-Factor #15: Security** — "Security is not a feature, it's a requirement."

This update retains all traditional security requirements and extends them to cover:

- AI agent identity and authentication
- Scoped, fine-grained permissions for agent actions
- Bounded autonomy with clear escalation paths
- Agent action audit trails
- Trust boundaries between agents and between agents and external systems

## How AI Changes This

### AI-Assisted Development
- AI coding assistants operate with the developer's permissions. Organizations must understand and control what data AI assistants can access during development (source code, documentation, internal APIs).
- Code review by AI should not bypass human approval gates for security-sensitive changes.

### AI-Native Applications
- **Agent identity**: Every AI agent needs a verifiable identity separate from the user it serves. Actions taken by an agent should be attributable to both the agent and the user who authorized it.
- **Scoped permissions**: Agents should have explicit, minimal permission sets. An agent that summarizes documents doesn't need write access. An agent that drafts emails doesn't need database access.
- **Bounded autonomy**: Define clear boundaries for what an agent can do autonomously vs. what requires human approval. These boundaries should be enforced architecturally, not just by prompt instructions.
- **Trust delegation**: When a user authorizes an agent to act on their behalf, the agent's permissions should be a strict subset of the user's permissions, with additional constraints.

## In Practice

### Agent Identity Model

Each agent has an identity record, versioned and reviewed like code (Factor 1). It declares:

| Element | What it states |
|---------|----------------|
| **Identity** | A unique, versioned agent ID (for example `agent:customer-support:v3`) and the credential that proves it — a workload identity or certificate, never a shared user account |
| **Permissions** | Each resource the agent may touch, the actions allowed on it, and the scope that narrows it: this tenant, this team, only the customer on the current ticket |
| **Explicit denials** | Actions the agent must never take, even where a broader rule would allow them; anything not granted is denied by default |
| **Autonomy** | Which actions run on their own, which require human approval and how long an approval request may wait, and per-request caps on actions and cost (Factor 18) |
| **Data handling** | Rules for sensitive fields — for example, customer PII redacted before it enters the model's context |

Two agents in the same system end up with very different shapes:

| Rule | Document summarizer | Customer-support agent |
|------|---------------------|------------------------|
| **May** | Read documents; read and write summaries — within its tenant | Read, write, and update tickets for the support team; read the knowledge base; read customer data only for the customer on the current ticket, with PII redacted in context |
| **Needs approval for** | Writing to external APIs | Issuing refunds, escalating to a manager, accessing billing |
| **Never** | Deleting or sharing documents; reading or changing user records | Anything not granted above |
| **Limits** | 10 actions and $0.50 per request | Approval requests expire after 5 minutes (consistent with Factor 7 triggers and Factor 18 execution) |

### Trust Boundaries

```
┌──────────────────────────────────────────────┐
│ USER TRUST BOUNDARY                          │
│ Authenticates, holds permissions             │
│  ┌────────────────────────────────────────┐  │
│  │ AGENT TRUST BOUNDARY                   │  │
│  │ Subset of the user's permissions       │  │
│  │ + agent-specific constraints           │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ TOOL TRUST BOUNDARY              │  │  │
│  │  │ Own permission check per call    │  │  │
│  │  │ Rate limits apply                │  │  │
│  │  │ Every action logged              │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Permission Enforcement
Enforce permissions architecturally, not just through prompts. Every tool call passes the same checks, in order, in code the model cannot influence:

1. **Agent permission**: the agent's declared permissions allow this action on this specific object — not just on the resource type. An agent that may read tickets is still denied a ticket outside its scope.
2. **Delegating user**: the user on whose behalf the agent acts holds the same permission *now*. Check at execution time, not only when the session started: a permission revoked mid-run revokes the agent's too.
3. **Autonomy budget**: the action fits within the agent's remaining action and cost budget (Factor 18).
4. **Approval**: if the action requires human approval, the call pauses. The approval is bound to the exact action — operation ID, target object, a hash of the arguments, an approver authorized for it, an expiry — and is used once. When it arrives, checks 1–3 run again before execution, because time has passed.
5. **Audit**: every decision — allowed, denied, pending, approved — is written to the audit log.

### Audit Logging
Every agent action must be auditable. Each record captures:

- **When**: timestamp, session ID, and trace ID (Factor 15).
- **Who**: the agent ID and version, and the delegating user.
- **What**: the action, the target resource (for example `ticket:TKT-4521`), its parameters — sanitized, so secrets and unnecessary personal data are not copied into the log — and the result.
- **Under what authority**: the authorization outcome — auto-approved by policy, approved by a named human, or denied.
- **With what**: the model and version that chose the action, its token usage, and its cost (Factor 20).

### OAuth and API Key Management for Agents
When agents interact with external services:

- Use OAuth 2.1 with scoped tokens — never give agents long-lived credentials with broad access.
- Rotate agent credentials automatically and frequently.
- Use service accounts for agent identity, not shared user accounts.
- Implement token downscoping — agent tokens should have the minimum scope needed for the current task.
- For delegation chains (user → orchestrator agent → sub-agent → tool), use **OAuth 2.0 Token Exchange (RFC 8693)** to mint a new, narrower token at each hop that names both the user (`sub`) and the acting agent (`act`). Never forward the user's original token down the chain.
- For MCP specifically (2026-07-28 authorization): register clients with Client ID Metadata Documents rather than Dynamic Client Registration, validate the `iss` parameter on every authorization response (RFC 9207), and bind stored credentials to the issuer that minted them (cross-ref Factor 2).

### Zero Trust for AI Agents
Apply zero trust principles to agent-to-agent and agent-to-service communication:

- Verify agent identity on every request, not just at session start.
- Encrypt agent-to-service communication (TLS 1.3, with hybrid post-quantum key exchange where your stack supports it — see Factor 4).
- Validate that agent requests are consistent with their declared purpose and permissions.
- Rate-limit agent actions independently from user actions.
- Where possible, ground agent identity in **SPIFFE/SPIRE workload identity** (or a workload-identity equivalent in your platform), so agent identity is verifiable and rotatable without long-lived secrets.
- Verify **signed A2A Agent Cards** against a list of trusted issuers before delegating to a cross-organization agent; an unsigned card is a claim, not an identity.

### Agent Identity Standards (2026)

Agent identity is converging on existing standards rather than a new one — but the composition is still being worked out, so build on the stable pieces and keep the rest swappable:

- **NIST NCCoE** published a concept paper in February 2026, *Accelerating the Adoption of Software and AI Agent Identity and Authorization*, organized around four concerns — identification, authorization, access delegation, and logging — and naming MCP, OAuth 2.0/2.1, OIDC, SPIFFE/SPIRE, and SCIM as the candidate building blocks, ahead of a demonstration project.
- **IETF**: individual drafts in and around the WIMSE (Workload Identity in Multi-System Environments) working group apply workload identity to agents (for example the AIMS draft). None is a standard yet; track them, but don't hard-wire to a draft.
- **Gap to design around**: OAuth handles one hop of delegation well; multi-hop chains, asynchronous cross-domain flows, and mapping OAuth scopes to agent capabilities are still application-level problems. Token exchange per hop (above), short lifetimes, and audit records that capture the full chain are the practical answer today.

Gartner's Top Strategic Technology Trends for 2027 list *AI agent identity* as a trend of its own — a signal that procurement and audit questions about "which agent did this, on whose behalf, with what authority" are arriving now.

### Sandboxed Execution for Agents

Any agent that runs code, shell commands, or a browser executes instructions that may have come from untrusted content (Factor 7). Isolation is the control that bounds the blast radius when that goes wrong, and plain containers share the host kernel — a weak boundary for untrusted code.

| Isolation level | Boundary | Use for |
|-----------------|----------|---------|
| Process / plain container | Shared host kernel | Trusted, first-party code only |
| **gVisor** (user-space kernel) | Syscalls intercepted by a sandbox kernel | Agent code execution at scale with low overhead |
| **MicroVM** (Firecracker, Kata Containers) | Hardware virtualization, minimal VM | Untrusted or multi-tenant code execution; computer use |
| Full VM | Hypervisor, full guest OS | Long-lived desktop/browser agents needing a complete OS |

On Kubernetes, SIG Apps' **Agent Sandbox** project (`kubernetes-sigs/agent-sandbox`) adds a `Sandbox` resource for stateful, single-tenant agent runtimes, with gVisor or Kata Containers as the runtime class and pre-warmed pools to hide startup latency. Managed sandbox services and model providers' hosted code-execution tools are the alternative when you don't want to run this layer yourself.

Whatever the substrate:
- **One sandbox per session or task**, destroyed afterwards — no shared filesystem, cookies, or credentials between sessions.
- **Egress allowlist by default**; untrusted code gets no general internet access.
- **No secrets inside the sandbox**: credentials are injected at an egress proxy or by the tool layer, so code running in the sandbox — or a prompt-injected agent — cannot read them.
- **Resource and time limits** (CPU, memory, disk, wall clock) enforced by the runtime, aligned with the agent's execution budget (Factor 18).

### Delegated Authority for Agent Payments

When an agent can *pay*, delegated identity becomes delegated spending authority. A family of protocols emerged in 2025–2026 for agentic commerce, each at a different layer:

| Protocol | Layer | Core idea |
|----------|-------|-----------|
| **AP2** (Agent Payments Protocol, Google and partners) | Authorization evidence | Purchases are backed by signed *mandates* — the user's intent, the cart the agent assembled, and the payment — as verifiable credentials |
| **ACP** (Agentic Commerce Protocol, OpenAI and Stripe) | Checkout | A merchant-facing checkout flow for agents, with payment credentials scoped to the transaction |
| **UCP** (Universal Commerce Protocol, Google and Shopify, Jan 2026) | Discovery and checkout | A common way for agents to find products and complete purchases across merchants |
| **x402** (x402 Foundation) | Settlement | Pay-per-request over HTTP 402, typically in stablecoins — machine-to-machine micropayments |

These are young and still shifting, so design the identity model, not the vendor integration:
- **The agent holds a mandate, never the card.** A mandate is user-approved, signed, and scoped: merchant or category, maximum amount, currency, and expiry.
- **The payment layer enforces the mandate.** Amount caps, velocity limits, and scope checks happen where the money moves, not in the agent's prompt (Factor 18).
- **Every purchase is attributable**: user, agent identity, mandate, and trace ID together in the audit log (Factor 15), and reconciled against spend (Factor 20).

### Computer Use and Browser-Agent Delegated Identity

By 2026, **computer-use agents** crossed the production threshold (Claude computer use, OpenAI's ChatGPT agent, Gemini Computer Use, Manus, and others). When an agent operates a browser or desktop on behalf of a user — clicking, typing, navigating across sites the user is logged into — it inherits a fraction of the user's identity. This is a categorically different trust model from API tool use.

Treat each computer-use session as a **scoped impersonation**:

- **Per-session sandbox**: every computer-use session runs in an isolated VM/container with a fresh browser profile. Sessions never share storage, cookies, or credentials with each other or with the user's primary workstation, and network egress is limited to an allowlist.
- **Scoped credential delegation**: the user grants the agent a *time-boxed, site-scoped* credential — not their full session cookie — with a short lifetime (for example, 30 minutes). Pattern: ephemeral OAuth scopes per target site, or a credential-broker service that mediates each authentication.
- **Action policy**: an explicit allowlist of permitted actions per site (e.g., "read-only on bank.example.com, full on internal-tickets.example.com, blocked on payment.example.com"). Enforced at the runtime, not in the prompt.
- **Confirmation gates**: any irreversible action (purchase, send, delete, post), and any payment above a set amount, requires a human confirmation. Confirmation is delivered out-of-band — not via the same browser the agent controls.
- **Screenshot redaction**: screenshots used for the agent's vision are redacted server-side before logging or training, and kept only for a short, fixed retention period. Treat them as PII at rest.
- **Blocked patterns**: regex/URL patterns that trigger immediate session termination (auth pages of unintended sites, password managers, MFA prompts the user didn't initiate).

The architectural rule: **the agent's effective permissions are the intersection of the user's permissions and the action policy** — never broader than either. This is the same principle as Factor 8's general delegation model, applied to the high-risk surface of computer use.

### Confidential Compute and TEE Attestation

For workloads handling regulated or highly sensitive data (healthcare, finance, defense), running inference on a generic GPU host is no longer sufficient evidence of confidentiality. **GPU Trusted Execution Environments** matured into a deployment-ready primitive in 2025–2026:

- **NVIDIA Confidential Computing** on H100/H200 (and extended on Blackwell): GPU isolation, AES-256-GCM HBM encryption, cryptographic attestation. ~3% overhead on transformer inference per NVIDIA benchmarks.
- **Apple Private Cloud Compute**: consumer-grade reference for verifiable, attestable enclave-based inference.
- **Confidential containers** (OpenShift / Kata Containers + GPU TEE): production deployment shape.

The architectural pattern is **attestation as a deployment gate**: before sensitive data is forwarded to an inference endpoint, the endpoint produces a cryptographic attestation of (a) the GPU's TEE state, (b) the model weights' hash, (c) the runtime image's hash. The caller verifies the attestation against an expected policy and only then submits the data.

- **Verify before sending, by sensitivity**: for data above a set sensitivity level, fetch the endpoint's attestation and check all three measurements against the expected values for that model and runtime.
- **Fail closed**: if the attestation is missing, stale, or does not match, the data is not sent.
- **Keep expected values under change control**: the known-good model and runtime hashes ship with the release (Factor 5), so a model update changes them deliberately, not silently.

Attestation is also identity: a TEE-attested endpoint is a *verifiable identity* in the zero-trust sense. Pair this with the workload identity story above — TEE attestation can be a SPIFFE selector.

## Compliance Checklist

- [ ] Every AI agent has a unique, verifiable identity distinct from users and other services
- [ ] Agent permissions are explicitly declared and enforced architecturally (not just via prompts)
- [ ] Agent permissions are a strict subset of the delegating user's permissions
- [ ] Bounded autonomy defines what agents can do without human approval
- [ ] Human approval workflows exist for high-risk agent actions
- [ ] All agent actions are audit-logged with agent ID, user ID, action, and result
- [ ] Agent credentials use short-lived, scoped tokens with automatic rotation
- [ ] Trust boundaries are enforced between users, agents, and tools
- [ ] Rate limits and cost budgets are enforced per agent
- [ ] Agent permission policies are reviewed regularly and follow least-privilege principles
- [ ] Computer-use / browser-agent sessions run in per-session sandboxes with no inherited cookies, scoped action policy, and out-of-band confirmation for irreversible actions
- [ ] Screenshots from computer-use sessions are redacted server-side and treated as PII at rest
- [ ] GPU TEE attestation (H100/H200/Blackwell Confidential Computing or equivalent) is required for inference on regulated/sensitive data, with attestation verified before submitting data
- [ ] MCP authorization uses OAuth 2.1 with scoped, short-lived tokens, Client ID Metadata Documents for registration, and issuer (`iss`) validation (cross-ref Factor 2)
- [ ] Multi-hop delegation uses token exchange (RFC 8693) so each hop carries a downscoped token naming both the user and the acting agent
- [ ] Agents that execute code, shell commands, or browsers run in per-session sandboxes with kernel-level isolation (gVisor, microVM, or VM), egress allowlists, and no secrets inside the sandbox
- [ ] Cross-organization agents are trusted only after verifying signed A2A Agent Cards against trusted issuers
- [ ] Agent purchases run under user-signed, scoped, expiring mandates that the payment layer enforces
- [ ] Agent workload identity is grounded in SPIFFE/SPIRE or platform workload-identity, not long-lived secrets
