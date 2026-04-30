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

```yaml
# agent-identity.yaml
agents:
  document-summarizer:
    type: ai-agent
    model: claude-sonnet-4-5-20250929
    identity:
      id: "agent:document-summarizer:v2"
      certificates: ["x509:agents/doc-summarizer.pem"]
    permissions:
      - resource: documents
        actions: [read]
        scope: "tenant:{tenant_id}"
      - resource: summaries
        actions: [read, write]
        scope: "tenant:{tenant_id}"
    denied:
      - resource: documents
        actions: [delete, share]
      - resource: users
        actions: [read, write, delete]
    autonomy:
      max_actions_per_request: 10
      max_cost_per_request_usd: 0.50
      requires_approval: [write_to_external_api]

  customer-support-agent:
    type: ai-agent
    model: claude-sonnet-4-5-20250929
    identity:
      id: "agent:customer-support:v3"
    permissions:
      - resource: tickets
        actions: [read, write, update]
        scope: "team:support"
      - resource: knowledge_base
        actions: [read]
      - resource: customer_data
        actions: [read]
        scope: "ticket:{ticket_id}.customer"
        pii_handling: redact_in_context
    autonomy:
      autonomous_actions: [respond_to_ticket, update_status, search_kb]
      approval_required: [issue_refund, escalate_to_manager, access_billing]
      approval_timeout_seconds: 300    # consistent with Factor 7 triggers and Factor 18 execution
```

### Trust Boundaries

```
┌───────────────────────────────────────────┐
│  USER TRUST BOUNDARY                       │
│                                           │
│  User authenticates → gets permissions     │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  AGENT TRUST BOUNDARY               │  │
│  │                                     │  │
│  │  Agent inherits subset of user      │  │
│  │  permissions + agent-specific       │  │
│  │  constraints                        │  │
│  │                                     │  │
│  │  ┌─────────────────────────────┐    │  │
│  │  │  TOOL TRUST BOUNDARY        │    │  │
│  │  │                             │    │  │
│  │  │  Each tool has its own      │    │  │
│  │  │  permission check           │    │  │
│  │  │  Rate limits apply          │    │  │
│  │  │  Actions are logged         │    │  │
│  │  └─────────────────────────────┘    │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### Permission Enforcement
Enforce permissions architecturally, not just through prompts:

```python
class AgentPermissionEnforcer:
    def authorize_action(self, agent_id: str, action: Action) -> AuthResult:
        agent = self.registry.get_agent(agent_id)
        user = self.get_delegating_user(agent_id)

        # Check 1: Is this action within the agent's declared permissions?
        if not agent.permissions.allows(action):
            return AuthResult.denied("Agent lacks permission")

        # Check 2: Does the delegating user have this permission?
        if not user.permissions.allows(action):
            return AuthResult.denied("Delegating user lacks permission")

        # Check 3: Is the agent within its autonomy budget?
        if agent.autonomy.exceeds_budget(action):
            return AuthResult.denied("Autonomy budget exceeded")

        # Check 4: Does this action require human approval?
        if action.type in agent.autonomy.approval_required:
            return AuthResult.pending_approval(user, action)

        # Log the authorized action
        self.audit_log.record(agent_id, user.id, action, "authorized")
        return AuthResult.allowed()
```

### Audit Logging
Every agent action must be auditable:

```json
{
  "timestamp": "2025-06-15T14:30:00Z",
  "agent_id": "agent:customer-support:v3",
  "delegating_user": "user:jane@example.com",
  "action": "update_ticket",
  "resource": "ticket:TKT-4521",
  "parameters": {
    "status": "resolved",
    "response": "Your refund has been processed..."
  },
  "authorization": "auto_approved",
  "model": "claude-sonnet-4-5-20250929",
  "token_usage": {"input": 1250, "output": 340},
  "cost_usd": 0.012,
  "session_id": "sess_abc123"
}
```

### OAuth and API Key Management for Agents
When agents interact with external services:

- Use OAuth 2.0 with scoped tokens — never give agents long-lived credentials with broad access.
- Rotate agent credentials automatically and frequently.
- Use service accounts for agent identity, not shared user accounts.
- Implement token downscoping — agent tokens should have the minimum scope needed for the current task.

### Zero Trust for AI Agents
Apply zero trust principles to agent-to-agent and agent-to-service communication:

- Verify agent identity on every request, not just at session start.
- Encrypt agent-to-service communication.
- Validate that agent requests are consistent with their declared purpose and permissions.
- Rate-limit agent actions independently from user actions.
- Where possible, ground agent identity in **SPIFFE/SPIRE workload identity** (or a workload-identity equivalent in your platform), so agent identity is verifiable and rotatable without long-lived secrets.

### Computer Use and Browser-Agent Delegated Identity

By 2026, **computer-use agents** crossed the production threshold (Claude Sonnet OSWorld at 72.5%, Operator in enterprise tiers, Gemini Computer Use, Manus Desktop, Codex Background Computer Use). When an agent operates a browser or desktop on behalf of a user — clicking, typing, navigating across sites the user is logged into — it inherits a fraction of the user's identity. This is a categorically different trust model from API tool use.

Treat each computer-use session as a **scoped impersonation**:

- **Per-session sandbox**: every computer-use session runs in an isolated VM/container with a fresh browser profile. Sessions never share storage, cookies, or credentials with each other or with the user's primary workstation.
- **Scoped credential delegation**: the user grants the agent a *time-boxed, site-scoped* credential — not their full session cookie. Pattern: ephemeral OAuth scopes per target site, or a credential-broker service that mediates each authentication.
- **Action policy**: an explicit allowlist of permitted actions per site (e.g., "read-only on bank.example.com, full on internal-tickets.example.com, blocked on payment.example.com"). Enforced at the runtime, not in the prompt.
- **Confirmation gates**: any irreversible action (purchase, send, delete, post) requires a human confirmation popup. Confirmation is delivered out-of-band — not via the same browser the agent controls.
- **Screenshot redaction**: screenshots used for the agent's vision are redacted server-side before logging or training. Treat them as PII at rest.
- **Blocked patterns**: regex/URL patterns that trigger immediate session termination (auth pages of unintended sites, password managers, MFA prompts the user didn't initiate).

```yaml
# computer-use-session-policy.yaml
session:
  isolation: vm                       # per-session VM, never shared
  fresh_browser_profile: true
  inherit_user_cookies: false
  network_egress: allowlist_only

  credential_broker:
    type: ephemeral_oauth             # broker mediates each site auth
    max_credential_lifetime_minutes: 30

  action_policy:
    allowed_sites:
      - host: internal-tickets.example.com
        actions: [read, write, comment]
      - host: bank.example.com
        actions: [read]
      - host: payment.example.com
        actions: []                   # explicitly blocked

  confirmation_gates:
    require_human_confirm:
      - any_action: [purchase, send_payment, delete_account, post_publicly]
      - any_amount_over: { currency: USD, value: 50 }
    out_of_band: true                  # confirm via Slack/SMS, not the agent's browser

  screenshot_redaction:
    enabled: true
    redact_classes: [pii, credentials, auth_tokens]
    log_retention_days: 7
```

The architectural rule: **the agent's effective permissions are the intersection of the user's permissions and the action policy** — never broader than either. This is the same principle as Factor 8's general delegation model, applied to the high-risk surface of computer use.

### Confidential Compute and TEE Attestation

For workloads handling regulated or highly sensitive data (healthcare, finance, defense), running inference on a generic GPU host is no longer sufficient evidence of confidentiality. **GPU Trusted Execution Environments** matured into a deployment-ready primitive in 2025–2026:

- **NVIDIA Confidential Computing** on H100/H200 (and extended on Blackwell): GPU isolation, AES-256-GCM HBM encryption, cryptographic attestation. ~3% overhead on transformer inference per NVIDIA benchmarks.
- **Apple Private Cloud Compute**: consumer-grade reference for verifiable, attestable enclave-based inference.
- **Confidential containers** (OpenShift / Kata Containers + GPU TEE): production deployment shape.

The architectural pattern is **attestation as a deployment gate**: before sensitive data is forwarded to an inference endpoint, the endpoint produces a cryptographic attestation of (a) the GPU's TEE state, (b) the model weights' hash, (c) the runtime image's hash. The caller verifies the attestation against an expected policy and only then submits the data.

```python
# Pseudocode — verify GPU TEE attestation before sending sensitive data
async def call_confidential_inference(prompt: str, sensitivity: SensitivityLevel) -> str:
    if sensitivity >= SensitivityLevel.RESTRICTED:
        attestation = await inference_endpoint.get_attestation()
        verify_attestation(
            attestation,
            expected_gpu_tee_state="enabled",
            expected_model_hash=KNOWN_MODEL_HASHES["medical-summary-v3"],
            expected_runtime_hash=KNOWN_RUNTIME_HASHES["confidential-inference-v2"],
        )
    return await inference_endpoint.complete(prompt)
```

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
- [ ] MCP authorization uses OAuth 2.1 with scoped, short-lived tokens (cross-ref Factor 2)
- [ ] Agent workload identity is grounded in SPIFFE/SPIRE or platform workload-identity, not long-lived secrets
