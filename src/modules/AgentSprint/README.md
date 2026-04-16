# Agent Sprint Module

## Overview

Agent Sprint is a parallel module to the standard Sprint module. Where regular sprints track human developer work (effort, story points, velocity), Agent Sprint tracks **outcomes delegated to AI coding agents** — Claude Code, Cursor, GitHub Copilot, Gemini, etc.

Humans own **review, decisions, and constraints**. Agents own **execution**. The sprint becomes a **release gate**: a point in time where humans review a batch of agent-generated outcomes and decide what ships.

---

## Architecture

### Database Tables

```
agent_sprints
  id, tenant_id, name, goal, start_date, end_date
  status: planning | active | review | shipped | cancelled
  created_at, created_by

agent_sprint_items
  id, tenant_id, agent_sprint_id (→ agent_sprints), linked_work_item_id (→ work_items)
  title, outcome_description, acceptance_criteria
  item_subtype:     outcome | constraint | decision | experiment
  agent_id:         claude-code | cursor | copilot | gemini | human | other
  agent_confidence: 0–100 (self-reported certainty)
  pr_url:           linked pull request / branch
  test_coverage:    0–100 %
  human_reviewer:   accountable reviewer (email / name)
  review_status:    pending → generated → tests_passing → in_review → approved → shipped
  reviewer_notes:   feedback text
  priority:         Critical | High | Medium | Low
  backlog_order:    integer (for ordering in backlog view)
  created_at, created_by
```

All tables use RLS via the `my_tenant_id()` function — same pattern as `work_items` and `sprints`.

---

### Module Views

| View | Purpose |
|---|---|
| **Sprints** | List all agent sprints with acceptance rate, outcome count, avg confidence |
| **Backlog** | Unassigned outcomes — drag or select to assign to a sprint |
| **Pipeline** | 6-column validation kanban per sprint — drag cards to advance them |
| **Traceability** | Outcomes grouped by linked work item — shows the Goal → Task → Agent Outcome chain |
| **Analytics** | Acceptance rate per sprint, items by agent, pipeline distribution, confidence by tool |

---

### Validation Pipeline Columns

```
Pending → Generated → Tests Passing → In Review → Approved → Shipped
```

- **Pending** — Outcome declared, agent not yet started
- **Generated** — Agent has produced code / PR
- **Tests Passing** — CI green, automated checks pass
- **In Review** — Human reviewer assigned, awaiting decision
- **Approved** — Human has signed off, ready to merge
- **Shipped** — Merged and deployed

Cards are draggable between columns. Review status can also be changed via the dropdown on each card.

---

### Integration with Work Items

Each `agent_sprint_item` optionally links to a `work_item` via `linked_work_item_id`. This creates full traceability:

```
Vision → Mission → Goal → OKR → Initiative → Project → Task
                                                              ↓
                                                   agent_sprint_item
                                                   (outcome / PR / decision)
```

When a linked Task exists, the Traceability view groups outcomes under their parent work item and shows approval status inline.

The **Detail Panel** in the main work item view shows an "🤖 Agent" tab for any Task/Subtask/Project that has linked agent outcomes, giving a read-only summary without leaving the work item context.

---

### Feature Flag

`feat_agent_sprints` boolean on the `tenants` table — defaults to `false`. Toggle in Global Admin under "Agent Sprints". When enabled, a new `🤖 Agent Sprints` nav item appears in the top navigation.

---

### Item Types

| Type | Icon | Use Case |
|---|---|---|
| Outcome | 🎯 | A deliverable end state the agent must achieve |
| Constraint | 🚧 | A boundary the agent must not violate |
| Decision | ⚡ | A choice that must be made by a human before the agent proceeds |
| Experiment | 🧪 | A hypothesis to validate — result informs next outcome |

---

### Sprint Lifecycle

```
planning → active → review → shipped
                           ↘ cancelled
```

- **Planning** — Defining outcomes and acceptance criteria
- **Active** — Agents are generating code; humans can advance pipeline columns
- **Review** — Outcomes complete; final human sign-off gate
- **Shipped** — All approved outcomes merged and deployed

---

### Key Design Principles

1. **No AI API calls** — This module tracks work; it does not run agents. Agents operate externally (CLI, IDE, CI) and humans log outcomes here.

2. **Outcome-first, not task-first** — Items describe *what must be true*, not *what to do*. The acceptance criteria field is the primary specification.

3. **Human judgment is the bottleneck** — Unlike regular sprints where velocity measures output, agent sprint analytics measure *reviewer throughput* (accepted outcomes per human per week).

4. **Confidence ≠ correctness** — `agent_confidence` is the tool's self-reported certainty. The `review_status` reflects human validation. Analytics can surface mismatches (high confidence, rejected).

5. **Traceability to strategy** — Every outcome should link back to a work item which links to a Goal/OKR. This justifies agent activity in terms of business value.
