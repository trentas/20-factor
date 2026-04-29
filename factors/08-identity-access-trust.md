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
