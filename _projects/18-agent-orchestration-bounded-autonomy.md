---
layout: page
importance: 18
category: "Tier 4: Intelligence"
title: "18. Agent Orchestration & Bounded Autonomy"
nav_order: 3
description: "Agent architecture, tool permissions, execution budgets, human-in-the-loop gates."
---

# Factor 18: Agent Orchestration and Bounded Autonomy

> Design AI agents with explicit capabilities, clear boundaries, execution budgets, and human-in-the-loop gates — orchestrated through well-defined patterns.

## Motivation

AI agents — systems that can plan, use tools, and take actions autonomously — represent the most powerful and most dangerous capability in AI applications. An agent that can browse the web, write code, send emails, and modify databases can accomplish in seconds what would take a human hours. It can also cause damage in seconds that takes days to undo.

The temptation is to give agents broad capabilities and rely on the model's judgment to use them wisely. This is the architectural equivalent of running everything as root. Bounded autonomy means agents have explicit, enforced limits on what they can do, how much they can spend, how long they can run, and when they must ask for human approval. These boundaries are architectural, not prompt-based — they're enforced by code, not by instructions the model might ignore.

> **Relationship with Factor 8 (Identity, Access, and Trust)**: Factor 8 defines *who* the agent is and *what* it's allowed to do — identity, permissions, and trust boundaries. This factor defines *how* the agent operates within those boundaries — orchestration patterns, execution budgets, checkpointing, and runtime guardrails. Factor 8 is the authorization model; Factor 18 is the execution model.

## What This Replaces

**New — no direct predecessor.** The original 12/15-factor methodology had no concept of autonomous AI agents, as these are a recent architectural pattern in AI applications.

## How AI Changes This

This factor *is* the AI change. It addresses:

- **Agent architecture patterns**: How to structure agents for reliability, observability, and control.
- **Tool permission management**: What tools an agent can use, with what parameters, and under what conditions — including MCP-based tool discovery.
- **Execution budgets**: Hard limits on time, tokens, cost, and actions per agent invocation.
- **Human-in-the-loop design**: When and how to involve humans in agent decision-making.
- **Multi-agent orchestration**: Patterns for coordinating multiple agents, including standardized protocols (A2A) and agent frameworks.
- **Agent SDKs and frameworks**: Leveraging standardized toolkits that implement these patterns natively.

## In Practice

### Agent Architecture Patterns

**Pattern 1: Simple Tool-Use Agent**
Single agent with a fixed set of tools:

```
User → Agent → [Tool A, Tool B, Tool C] → Response
```

**Pattern 2: Router Agent**
A routing agent delegates to specialized sub-agents:

```
User → Router Agent → Specialist Agent A → Response
                   → Specialist Agent B → Response
```

**Pattern 3: Pipeline Agent**
Agents connected in a processing pipeline:

```
User → Research Agent → Analysis Agent → Writing Agent → Response
```

**Pattern 4: Hierarchical Agent**
A supervisor agent coordinates worker agents:

```
User → Supervisor Agent → Worker Agent 1 ─┐
                        → Worker Agent 2 ──┤→ Supervisor → Response
                        → Worker Agent 3 ─┘
```

### Bounded Autonomy Definition

```yaml
# agent-definition.yaml
agents:
  research-assistant:
    purpose: "Research topics using web search and knowledge base"
    model: claude-sonnet-4-5-20250929

    tools:
      - name: web_search
        permission: autonomous     # Can use freely
        rate_limit: 10/minute

      - name: knowledge_base_search
        permission: autonomous
        rate_limit: 20/minute

      - name: send_email
        permission: human_approval  # Must ask first
        approval_timeout_seconds: 300   # consistent with Factor 7 triggers and Factor 8 policy

      - name: write_to_database
        permission: denied          # Cannot use this tool

    execution_budget:
      max_steps: 25                 # Maximum tool calls per invocation
      max_tokens: 50000             # Maximum total tokens (input + output)
      max_cost_usd: 1.00            # Maximum cost per invocation (Factor 20 defines org-wide budget hierarchy)
      max_duration_seconds: 120     # Maximum wall-clock time
      max_retries: 3                # Maximum retries on failure

    safety:
      require_reasoning: true       # Agent must explain its plan before acting
      checkpoint_interval: 5        # Checkpoint state every 5 steps
      rollback_on_failure: true     # Revert partial actions if agent fails
```

### Execution Budget Enforcement

```python
class AgentExecutor:
    """Execute an agent with enforced boundaries."""

    def __init__(self, agent: AgentConfig, tools: ToolRegistry):
        self.agent = agent
        self.tools = tools
        self.budget = ExecutionBudget(agent.execution_budget)

    async def run(self, task: str) -> AgentResult:
        messages = [{"role": "user", "content": task}]
        steps = []

        while not self.budget.exhausted:
            # Get next action from model
            response = await self.llm.complete(
                messages=messages,
                tools=self.get_allowed_tools(),
            )

            if response.is_final_answer:
                return AgentResult(answer=response.content, steps=steps)

            if response.has_tool_call:
                tool_call = response.tool_call

                # Enforce tool permissions
                permission = self.check_tool_permission(tool_call)
                if permission == "denied":
                    messages.append(self.deny_message(tool_call))
                    continue
                if permission == "human_approval":
                    approved = await self.request_human_approval(tool_call)
                    if not approved:
                        messages.append(self.deny_message(tool_call))
                        continue

                # Execute tool with budget tracking
                self.budget.record_step()
                result = await self.tools.execute(tool_call)
                self.budget.record_tokens(response.token_usage)
                self.budget.record_cost(response.cost)

                steps.append(AgentStep(tool_call=tool_call, result=result))
                messages.append({"role": "tool", "content": result})

                # Checkpoint if interval reached
                if len(steps) % self.agent.safety.checkpoint_interval == 0:
                    await self.checkpoint(steps)

        # Budget exhausted
        return AgentResult(
            answer=None,
            steps=steps,
            status="budget_exhausted",
            budget_report=self.budget.report(),
        )
```

### Human-in-the-Loop Patterns

This factor defines the *execution mechanisms* for human approval. Factor 7 defines *when* approval is triggered (safety scores, confidence thresholds), and Factor 8 defines *who* is authorized to approve.

**Approval Gate**: Agent pauses and waits for human approval:

```python
class ApprovalGate:
    async def request_approval(self, agent_id: str, action: ToolCall) -> bool:
        # Send approval request to human
        request = ApprovalRequest(
            agent_id=agent_id,
            action=action.tool_name,
            parameters=action.parameters,
            reasoning=action.reasoning,
            timestamp=now(),
        )
        await self.notification_service.send(request)

        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(
                self.approval_queue.get(request.id),
                timeout=self.agent.tools[action.tool_name].approval_timeout_seconds,
            )
            return response.approved
        except asyncio.TimeoutError:
            # Default deny on timeout
            return False
```

**Supervised Mode**: Human reviews every action before execution:

```python
class SupervisedExecutor:
    """Every agent action requires human confirmation."""

    async def execute_step(self, agent_id: str, tool_call: ToolCall) -> ToolResult:
        # Show the human what the agent wants to do
        await self.ui.show_pending_action(
            agent=agent_id,
            action=tool_call.tool_name,
            params=tool_call.parameters,
            reasoning=tool_call.reasoning,
        )

        # Wait for human decision
        decision = await self.ui.get_decision()  # approve / modify / reject / stop

        match decision:
            case "approve":
                return await self.tools.execute(tool_call)
            case "modify":
                modified = await self.ui.get_modified_params()
                return await self.tools.execute(tool_call.with_params(modified))
            case "reject":
                return ToolResult.rejected("Human rejected this action")
            case "stop":
                raise AgentStoppedByHuman()
```

### Multi-Agent Orchestration

```python
class SupervisorOrchestrator:
    """Supervisor pattern: one agent coordinates multiple specialists."""

    def __init__(self, supervisor: AgentConfig, workers: dict[str, AgentConfig]):
        self.supervisor = supervisor
        self.workers = workers

    async def run(self, task: str) -> OrchestratorResult:
        # Supervisor plans the work
        plan = await self.supervisor.plan(task)

        results = {}
        for step in plan.steps:
            worker = self.workers[step.agent]

            # Each worker has its own bounded execution
            result = await AgentExecutor(worker).run(step.task)

            if result.status != "success":
                # Supervisor handles worker failures
                recovery = await self.supervisor.handle_failure(step, result)
                if recovery.action == "retry":
                    result = await AgentExecutor(worker).run(recovery.revised_task)
                elif recovery.action == "skip":
                    continue
                elif recovery.action == "escalate":
                    result = await self.escalate_to_human(step, result)

            results[step.id] = result

        # Supervisor synthesizes final result
        return await self.supervisor.synthesize(results)
```

### Agent Observability

```json
{
  "trace_id": "agent-trace-123",
  "agent_id": "research-assistant",
  "task": "Research Q3 market trends",
  "status": "completed",
  "steps": 12,
  "budget": {
    "steps_used": 12,
    "steps_limit": 25,
    "tokens_used": 28500,
    "tokens_limit": 50000,
    "cost_usd": 0.42,
    "cost_limit_usd": 1.00,
    "duration_seconds": 45,
    "duration_limit_seconds": 120
  },
  "tools_used": {
    "web_search": 5,
    "knowledge_base_search": 7
  },
  "approvals_requested": 0,
  "errors": 0,
  "quality_score": 0.88
}
```

### Agent SDKs and Frameworks

The orchestration patterns described above (router, pipeline, supervisor) are now implemented natively by standardized Agent SDKs. Rather than building agent infrastructure from scratch, use these frameworks and focus engineering effort on the business logic, tool definitions, and boundary enforcement that are unique to your application.

**Standardized Agent SDKs:**

| Framework | Provider | Strengths |
|-----------|----------|-----------|
| **Anthropic Agent SDK** | Anthropic | Native Claude integration, tool use, guardrails, agent loops with built-in budget enforcement |
| **OpenAI Agents SDK** | OpenAI | Handoffs between agents, guardrails, tracing, built-in orchestration primitives |
| **Google ADK** | Google | Multi-agent orchestration, A2A protocol support, Vertex AI integration |

These SDKs share common architectural patterns:
- **Agent loop with tool use**: The core loop (plan → tool call → observe → repeat) is built-in, with configurable termination conditions.
- **Handoffs / delegation**: Agents can delegate to sub-agents, implementing the router and supervisor patterns natively.
- **Guardrails integration**: Input/output validation, content filtering, and safety checks are first-class features (Factor 7).
- **Tracing and observability**: Agent steps, tool calls, and token usage are automatically traced (Factor 15).

**When to use an SDK vs. custom orchestration:**
- **Use an SDK** when your orchestration follows standard patterns (tool use loops, delegation, pipelines). SDKs handle the infrastructure correctly — retries, error handling, token counting, tracing — so you don't have to.
- **Build custom** when you need orchestration logic that SDKs don't support (custom scheduling, domain-specific checkpoint/resume, proprietary tool protocols).
- **Combine both**: Use an SDK for the agent loop and tool execution, but layer your own budget enforcement, approval gates, and observability on top.

The bounded autonomy principles from this factor (execution budgets, tool permissions, human-in-the-loop gates) apply regardless of whether you use an SDK or build custom. SDKs provide the *mechanism*; you define the *policy*.

### MCP for Agent Tool Integration

The **Model Context Protocol (MCP)** standardizes how agents discover and invoke tools. Instead of hardcoding tool definitions per agent, agents connect to MCP servers that expose tools dynamically.

```yaml
# agent-definition.yaml — tools via MCP servers
agents:
  research-assistant:
    purpose: "Research topics using web search and knowledge base"
    model: claude-sonnet-4-6-20260115

    # Tools provided via MCP servers (Factor 10 backing services)
    mcp_servers:
      - name: web-search
        transport: sse
        endpoint: https://mcp.example.com/web-search
        tool_permissions:
          web_search: autonomous
          web_browse: autonomous

      - name: knowledge-base
        transport: stdio
        command: "npx @company/mcp-kb"
        tool_permissions:
          search_documents: autonomous
          update_document: human_approval

    # Direct tool definitions (non-MCP) still supported
    tools:
      - name: send_email
        permission: human_approval
        approval_timeout_seconds: 300
```

MCP enables key capabilities for agent orchestration:
- **Dynamic tool discovery**: Agents discover available tools at runtime via `tools/list`, adapting to the tools available in their environment.
- **Swappable tool providers**: Replace an MCP server without changing agent code — the agent discovers the new server's tools automatically (Factor 10).
- **Permission layering**: MCP defines what tools *exist*; the agent's permission model (above) defines what tools it's *allowed to use*. These are separate concerns.
- **Resource access**: Beyond tools, MCP servers can expose resources (files, data) and prompt templates that agents can use contextually.

### A2A for Multi-Agent Interoperability

For multi-agent systems where agents may be built by different teams, use different frameworks, or run on different infrastructure, the **Agent-to-Agent (A2A) protocol** provides a standard communication layer.

```python
class A2AOrchestrator:
    """Orchestrate agents via A2A protocol — framework-agnostic."""

    def __init__(self, agent_registry: dict[str, str]):
        # Registry maps agent names to their A2A endpoint URLs
        self.agents = agent_registry

    async def delegate_task(self, agent_name: str, task: str) -> A2ATaskResult:
        endpoint = self.agents[agent_name]

        # Discover agent capabilities via Agent Card
        card = await self.fetch_agent_card(endpoint)

        # Submit task via A2A protocol
        task_id = await self.submit_task(endpoint, task)

        # Stream progress updates
        async for update in self.stream_updates(endpoint, task_id):
            if update.status == "working":
                log.info(f"Agent {agent_name}: {update.message}")
            elif update.status == "completed":
                return update.result
            elif update.status == "input_required":
                # Agent needs human input — escalate
                response = await self.request_human_input(update)
                await self.send_input(endpoint, task_id, response)

        raise AgentTimeoutError(agent_name, task_id)
```

A2A and MCP are complementary in multi-agent systems:
- **MCP** = how agents use tools (agent → tool)
- **A2A** = how agents delegate to each other (agent → agent)
- An orchestrator uses A2A to delegate tasks to specialist agents, and each agent uses MCP to interact with its tools.

### Computer Use and GUI Agents

A new class of agent capability has emerged: **computer use** — agents that interact with graphical user interfaces by seeing screenshots and performing mouse/keyboard actions. Unlike structured tool calls (where the agent invokes a well-defined API), computer use involves visual interpretation of dynamic, unstructured interfaces.

This fundamentally challenges bounded autonomy because:
- **Actions are less predictable**: A tool call to `send_email(to, subject, body)` has a clear contract. Clicking on a UI element has emergent outcomes that depend on the application state.
- **Observation is continuous**: The agent must repeatedly screenshot, interpret, and act — consuming significantly more tokens per step than structured tool calls.
- **Rollback is harder**: GUI actions (clicking "Submit", "Delete", "Send") may be irreversible and don't have programmatic undo.

```yaml
agents:
  browser-agent:
    purpose: "Navigate web applications to complete tasks"
    capabilities:
      - computer_use

    computer_use_policy:
      allowed_applications:
        - "internal-crm.example.com"
        - "jira.example.com"
      blocked_patterns:
        - "*payment*"                  # never interact with payment flows
        - "*delete*account*"           # never near account deletion
      screenshot_budget: 50            # max screenshots per task
      require_confirmation_for:
        - form_submission              # pause before submitting any form
        - navigation_away              # pause before leaving target application
      sandbox: true                    # run in isolated browser environment
```

**Key design principles for computer use agents:**
- **Prefer structured tools over computer use**: If an API or MCP server exists for the task, use it. Computer use should be the last resort for systems that don't expose programmatic interfaces.
- **Sandbox the environment**: Run computer use agents in isolated browser sessions or VMs. Never give them access to the host system.
- **Tighter budgets**: Computer use consumes far more tokens (screenshots) and has higher risk per action. Apply stricter execution budgets than for structured tool agents.
- **Visual confirmation gates**: Show the human what the agent sees (screenshot) and what it plans to do before executing high-risk GUI actions.

### The Skills Primitive

A **Skill** is a named, versioned, composable unit of agent capability — a bundle of a prompt template, one or more tool definitions, and an execution policy. Skills are a higher-level abstraction than raw tools: a tool is a single function; a skill encodes the *context* for using it correctly.

Skills are versioned artifacts committed to version control (Factor 1) and registered via MCP tool schemas (Factor 2). An agent's capability manifest declares a list of skill names + versions, not a loose bag of tool definitions. This enables:
- Skill reuse across agents without copy-pasting tool definitions
- Independent versioning and A/B testing of skill implementations
- Skill discovery via agent directory services (cross-ref Factor 2)

### Voice and Realtime Agents

Real-time speech agents (OpenAI Realtime API, Pipecat, LiveKit Agents, AWS Bedrock AgentCore, Hume AI) operate under engineering constraints that differ from standard request/response agents:

- **Sub-300ms time-to-first-audio-byte**: user-perceptible as natural conversation; requires streaming execution where each agent step begins before the prior step's response completes
- **End-of-turn detection**: Voice Activity Detection (VAD) determines when the user stops speaking; barge-in (user interrupting the agent mid-speech) must be handled gracefully without dropping context
- **Session durability**: voice conversations are long-lived sessions; use Factor 13 (Durable Agent Runtime) for session state persistence across network interruptions
- **Observability**: Factor 15 voice SLOs apply — track TTFT, TTFA (time-to-first-audio), end-of-turn latency, and barge-in latency separately from text agent metrics

The bounded autonomy principles from this factor apply equally: voice agents have tool permissions, execution budgets, and human escalation paths. The difference is latency sensitivity — approval gates for voice agents must complete in hundreds of milliseconds, not seconds.

### Reflexion and Self-Critique Loops

Reflexion (Shinn et al., 2023) patterns an agent to critique its own output and generate a revised response before returning to the user. In production:

```python
async def reflexion(task: str, budget: ReflexionBudget) -> str:
    draft = await agent.generate(task)

    if budget.critique_tokens > 0:
        critique = await agent.critique(draft, task)  # "What's wrong with this?"
        if critique.has_issues:
            draft = await agent.revise(draft, critique)  # "Fix the issues identified"

    return draft
```

Apply reflexion selectively: it doubles token consumption and latency. Gate reflexion on task complexity (Factor 20) and measure quality improvement in your eval suite (Factor 6) before enabling broadly. Budget the critique step's thinking tokens separately from the generation step.

### Agent Swarms (CrewAI, AutoGen, MetaGPT)

Multi-agent frameworks — CrewAI, Microsoft AutoGen, MetaGPT, and others — implement coordinated agent swarms where multiple LLM-backed agents collaborate by taking on roles (researcher, coder, reviewer, critic). Each agent in a swarm is a bounded agent as defined by this factor; the swarm adds an orchestration layer on top.

Apply bounded autonomy at both levels:
- **Per-agent budgets**: each agent in the swarm has its own step limit, token budget, cost limit, and tool permissions
- **Aggregate swarm budget**: the swarm-level orchestrator tracks total cost and steps across all agents; the swarm has its own circuit breaker
- **Human gates at the swarm level**: some decisions require human approval that isn't visible to any individual agent — wire this into the orchestrator, not into each agent

Swarm frameworks accelerate prototyping but require explicit budget enforcement and observability wiring before production. Don't inherit the framework's default unlimited concurrency — apply the same constraints you'd apply to any other agent.

### Anti-Patterns
- **Unbounded agents**: Agents with no step limit, cost limit, or time limit. They can run indefinitely and spend without constraint.
- **Prompt-only boundaries**: "Don't use this tool unless necessary" in the prompt is not a boundary — it's a suggestion. Enforce boundaries in code.
- **God agents**: A single agent with every tool and permission. Prefer specialized agents with minimal tool sets.
- **No checkpoint/resume**: If an agent fails after 20 steps, it has to start over. Checkpoint state to enable resume.
- **Silent agents**: Agents that act without logging. Every tool call, every decision, every error should be traced.
- **NIH orchestration**: Building custom agent loops, retry logic, and tracing when a standard Agent SDK handles it correctly. Use frameworks for infrastructure; focus custom code on business logic and boundaries.
- **Hardcoded tool sets**: Defining tools inline instead of using MCP for dynamic discovery. Hardcoded tools create tight coupling and prevent tool reuse across agents.
- **Computer use for API-available tasks**: Using screenshot-based computer use when a structured API or MCP server exists. Computer use is slower, more expensive, and less reliable than structured tool calls.

## Compliance Checklist

- [ ] Every agent has a defined purpose, tool set, and execution budget
- [ ] Tool permissions are enforced architecturally (code), not just through prompts
- [ ] Execution budgets (steps, tokens, cost, time) are enforced with hard limits
- [ ] Human-in-the-loop gates exist for high-risk actions
- [ ] Agent actions are fully observable with distributed tracing (Factor 15)
- [ ] Multi-agent orchestration uses defined patterns (router, pipeline, supervisor) — via Agent SDKs or custom implementation
- [ ] Agents checkpoint state periodically to enable resume after failures
- [ ] Failed agent actions can be rolled back where possible
- [ ] Agent identities and permissions follow Factor 8 (Identity, Access, Trust)
- [ ] Agent tools are provided via MCP servers where possible, enabling dynamic discovery and swappability (Factor 10)
- [ ] Multi-agent communication uses standardized protocols (A2A) for cross-team and cross-framework interoperability
- [ ] Computer use agents run in sandboxed environments with tighter budgets and confirmation gates for GUI actions
- [ ] Agent execution patterns and budget usage are monitored for optimization
- [ ] Skills are versioned, registered artifacts — agents declare capabilities as skill-name + version, not inline tool definitions
- [ ] Voice/realtime agents have TTFA SLOs configured, VAD barge-in handling implemented, and session state persisted via Factor 13
- [ ] Reflexion / self-critique loops are gated on task complexity with token budget tracked separately; quality improvement is validated against the eval suite before broad enablement
- [ ] Agent swarms (CrewAI, AutoGen, MetaGPT, etc.) have aggregate swarm-level budgets and circuit breakers in addition to per-agent limits
