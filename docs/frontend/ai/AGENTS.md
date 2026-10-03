# AGENTS.md

Instructions for any AI coding agent working on the **NEC Timetable Web Application frontend**.

Read this whole file before doing anything.

> Revision: 2026-10-03

## 01 Purpose

This project is a React + JavaScript web application for the NEC CSE department timetable workflow.

You are working on the frontend owned by **Rohith**.

The permanent context files are:

```text
AGENTS.md
docs/PRD.md
docs/DESIGN_SYSTEM.md
docs/ARCHITECTURE.md
```

They form a living context layer:

- `PRD.md` → what is being built, for whom, and what done means.
- `DESIGN_SYSTEM.md` → visual language and UI rules.
- `ARCHITECTURE.md` → structure, data flow, ownership boundaries, and intentional decisions.
- `AGENTS.md` → how an AI coding agent must read and apply the other three.

These files are context documents, not a substitute for reading the current source code and backend API.

## 02 Mandatory read order

Before every task:

1. Read `AGENTS.md`.
2. Read `docs/PRD.md` for product scope and out-of-scope items.
3. Read `docs/DESIGN_SYSTEM.md` for visual rules.
4. Read `docs/ARCHITECTURE.md` for structure, data flow and boundaries.
5. Inspect the existing code and components related to the task.
6. Inspect the relevant backend route/service/controller contract when the task depends on API behavior.
7. Check current Git status and current branch before editing.

Do not copy assumptions from documentation when the current implementation proves otherwise. Verify the code and API contract.

## 03 Absolute technology constraints

```text
JavaScript ONLY
React
Existing Webpack setup

NO:
TypeScript
.ts
.tsx
Vite
Angular
```

Do not migrate or introduce a replacement frontend stack.

Do not create a second frontend architecture.

## 04 Ownership boundary

### Rohith / frontend owns

- React pages
- React components
- React Router / frontend routes
- UI/UX
- forms
- frontend state
- frontend contexts
- API integration
- loading/error/empty/business-state presentation
- responsive behavior
- accessibility
- frontend tests
- browser UI validation
- visual consistency
- production build
- frontend documentation

### Backend owns

- Node.js / Express
- MongoDB / Mongoose
- schemas
- database migrations
- seeds
- authoritative API business rules
- workload calculations
- faculty eligibility authority
- timetable generation
- timetable optimization
- conflict detection
- timetable version lifecycle enforcement
- approval/publish enforcement
- backend-heavy tests
- heavy processing

Do not move backend responsibilities into the frontend to avoid an API limitation.

When a frontend change appears to require backend rule changes, inspect the backend contract first and keep the backend authority boundary intact.

## 05 Product scope rules

The system is for the **entire CSE department**.

Never treat:

```text
III-A
```

as the product boundary.

III-A is only a test/example context.

The frontend must support any valid Year + Semester/Academic Term + Section/Cohort returned by the backend.

User-facing terminology is:

```text
Time Table Coordinator
TC
```

The backend may retain its internal `AC` role identifier. Do not rename backend role identifiers only to change UI terminology.

## 06 Screenshot / visual baseline

The current HOD Faculty Allocation screen is the visual baseline for incremental UI work.

Preserve:

```text
sidebar
breadcrumb
page header
authority badge
refresh action
Academic Year selectors
Semester selectors
Section selectors
context summary
allocation table
existing visual language
```

Change only the controls/states required by the approved feature.

Do not redesign the entire page unless explicitly requested.

## 07 HOD Faculty Allocation rules

### Theory

```text
Course → 1 faculty
```

Keep existing behavior.

### LAB

```text
Primary / Theory-linked Faculty    REQUIRED
Additional Faculty                REQUIRED
Optional 3rd Faculty              OPTIONAL

Minimum = 2
Maximum = 3
```

Primary must remain backend-authoritative/theory-linked where configured.

Do not replace it with arbitrary client-selected faculty.

### MC

MC allocation is policy-driven.

Current documented requirements:

```text
MC_OPTIONAL_MAPPING
    Induction Programme
    → Faculty optional
    → Timetable mapping optional

MC_DEPARTMENT
    Indian Constitution
    → Respective department faculty

MC_SAS
    Soft/Analytical Skills
    → Maths/BME faculty required
    → English faculty required
```

Do not hardcode these business rules by course-name string matching when an `allocationRule` is available from the backend.

## 08 Backend business-rule authority

The frontend may validate for immediate UX, but backend remains authoritative.

Never silently use:

```text
first faculty
random faculty
historical faculty
workload-master faculty
```

when HOD allocation is unresolved.

Never invent:
- elective activation
- timetable version state
- faculty eligibility
- approval/publish authority
- timetable sessions

## 09 API behavior

Use the existing frontend service/API layer.

For HOD Faculty Allocation, verify actual backend contracts before implementation. Documented examples include:

```text
GET
/api/hod/faculty-allocation/context/:academicContextId
```

and:

```text
PUT
/api/hod/faculty-allocation/context/:academicContextId/course/:courseCode
```

Before implementing against any API:

- inspect actual route definitions;
- inspect controller/service response shapes;
- verify field names;
- verify error structure;
- verify role/auth requirements.

Do not assume a documentation example is identical to the current backend.

## 10 State handling

Every data-driven page must handle:

```text
loading
success
empty
error
```

Also distinguish workflow/business states where applicable:

```text
CONTEXT_NOT_FOUND
CURRICULUM_UNAVAILABLE
ALLOCATION_INCOMPLETE
READY_FOR_GENERATION
TIMETABLE_NOT_GENERATED
GENERATED
PENDING_HOD_APPROVAL
APPROVED
REJECTED
PUBLISHED
```

### Critical rule

If:

```text
Academic Context exists
+
Curriculum exists
+
HOD allocation is complete
+
Timetable does not exist
```

do not show only:

```text
No data found
```

Show the meaningful workflow state and next action supplied/allowed by the backend.

## 11 UI implementation rules

### Reuse before creating

Before creating a component:

1. Search the existing `web/src/components`.
2. Search for equivalent inputs, buttons, badges, cards, tables and modals.
3. Reuse existing patterns.
4. Create a new component only when the current component set cannot express the requirement cleanly.

### Do not duplicate pages

Do not create:

```text
/hod/faculty-allocation-v2
```

or another parallel allocation page.

Extend the existing page.

### Shared review architecture

Where the existing shared timetable review page can support role-specific actions, extend it instead of creating a duplicate Coordinator/HOD timetable review page.

## 12 LAB UI behavior

Expected UX:

```text
Primary / Theory Faculty
[linked faculty]

Additional Faculty *
[select]

Optional 3rd Faculty
[select]
```

Rules:

- Additional is mandatory.
- Optional 3rd is optional.
- More than 3 is impossible.
- Duplicate faculty should be prevented in the UI where practical.
- Primary should appear locked/linked where backend marks it authoritative.
- Error messages must identify the exact unmet rule.

Known validation example:

```text
Additional faculty is required for laboratory allocation.
```

Do not use vague copy for known validation failures.

## 13 MC UI behavior

### SAS

```text
Maths / BME Faculty *
[select]

English Faculty *
[select]
```

Both required.

### Indian Constitution

```text
Respective Department Faculty *
[select]
```

Faculty eligibility comes from backend.

### Induction

```text
Optional Faculty
[select]

Map to Timetable
[off/on]
```

Do not force assignment when mapping is optional.

## 14 Multi-faculty timetable rendering

A LAB can produce:

```text
one class session
+
two/three assigned faculty
```

The class timetable must not duplicate that class because of faculty count.

Faculty timetable may legitimately show the session for every assigned faculty.

Do not create synthetic duplicate timetable sessions in React.

Render the backend representation as intended.

## 15 Review / approval / publication workflow

Role ownership:

```text
TC
GENERATED
  ↓
PENDING_HOD_APPROVAL

HOD
PENDING_HOD_APPROVAL
  ↓
APPROVED
  OR
REJECTED + remarks

HOD
APPROVED
  ↓
PUBLISHED
```

The frontend only exposes actions allowed by backend state and current role.

TC owns handover/submission of a generated timetable to HOD.

HOD owns review, approve, reject, and publish according to backend authority.

Do not invent alternate transitions.

## 16 Responsive requirements

Every affected screen must be checked at:

```text
360
390
430
768
1024
1280
1366
1600
1920
```

At mobile widths:

```text
360–430
```

stack LAB/MC controls vertically where needed.

Do not hide required controls.

Do not create page-wide horizontal overflow.

Do not reduce text to an unreadable size to force desktop content into mobile width.

## 17 Accessibility

Required:

- keyboard navigation
- visible focus states
- accessible labels
- accessible validation
- semantic buttons
- meaningful form errors
- no color-only status communication
- descriptive action labels
- understandable locked/disabled states

Touch targets must remain usable on mobile.

## 18 Testing rules

Before claiming a task is complete:

### Frontend tests

Run the actual project test command(s) from the current `web/package.json`.

Do not report tests as passing without execution.

### Production build

Run the actual production build command from the current `web/package.json`.

Do not invent commands.

### Browser

Use **Playwright MCP** for UI/integration validation when the task affects browser behavior.

For affected workflows, validate actual interactions and resulting state, not only page loading.

Required responsive validation widths:

```text
360
390
430
768
1024
1280
1366
1600
1920
```

At minimum, validate a valid context where a timetable does not yet exist and confirm that the UI exposes an actionable state.

## 19 Agent tooling

Use only the project's existing agent/browser tooling when it is already available.

Do not install unrelated agent frameworks or dependencies merely to complete a normal frontend task.

Do not introduce a second agent-skill framework.

## 20 Git safety

Before changes:

```text
git status
git branch --show-current
git log -3 --oneline
```

The task must explicitly establish the intended development branch.

Do not assume `main` is the development branch.

Do not:

```text
git reset --hard
git clean -fd
git rebase
git push --force
```

Do not overwrite unrelated work from another contributor or agent.

When another branch is used as reference:
- inspect it read-only;
- do not merge;
- do not cherry-pick;
- do not rebase onto it;
- do not copy unrelated commits.

Keep the diff focused on the requested task.

Use exact-file staging. Avoid:

```text
git add .
```

Do not push unless the task explicitly requests a push.

When push is explicitly requested, push only the branch named by the task.

## 21 Multi-agent branch workflow

This project may be worked on by multiple AI coding tools.

Rules:

1. Each agent must work only on the branch assigned to that agent/task.
2. Never switch branches automatically.
3. Never merge one agent's development branch merely to reuse its work.
4. When another agent's branch is needed for reference, inspect it read-only.
5. Do not let two agents implement the same task simultaneously on different branches.
6. Before editing and before finishing, report the current branch.
7. A clean handoff requires a clear commit SHA and branch name.

If an external task prompt gives a branch-specific rule, that rule controls the current task.

## 22 Documentation rules

These files are living documents:

```text
docs/PRD.md
docs/DESIGN_SYSTEM.md
docs/ARCHITECTURE.md
AGENTS.md
```

Update them when there is a real:

- structural change
- new intentional frontend decision
- new component pattern
- new supported workflow state
- changed product scope
- changed architecture boundary

Do not rewrite them for trivial UI copy changes.

Keep documentation consistent with the current implementation.

Do not embed chat-only citation markers, tool references, temporary file links, or session-specific IDs into repository documentation.

Verify that `docs/` is not accidentally excluded by `.gitignore` if these files are intended to be versioned.

## 23 Before editing a task

For a normal task:

1. Read the four context files.
2. Check branch and Git status.
3. Inspect the relevant existing implementation.
4. Inspect actual backend contract when API behavior matters.
5. Identify the smallest set of files required.
6. State the planned change and affected files.
7. Implement the smallest safe change.
8. Run relevant tests/build.
9. Validate in browser when UI behavior changed.
10. Inspect the final diff.
11. Update context docs only when the product/architecture/design decision actually changed.
12. Verify final branch and working tree.

Do not perform unrelated cleanup/refactoring in the same task.

## 24 When the agent must stop and ask

Stop and ask one specific question instead of guessing when:

- the backend contract is missing or contradictory;
- two business interpretations are possible;
- the task requires changing a backend-owned rule;
- a new dependency is required;
- the task requires TypeScript or Vite;
- a new page is proposed without product justification;
- workload semantics for multi-faculty sessions are unclear;
- an intentional architecture decision in `docs/ARCHITECTURE.md` would need to change.

State the smallest practical options.

## 25 Definition of done

A frontend task is done only when:

- requested behavior is implemented;
- existing unrelated functionality is preserved;
- UI follows `docs/DESIGN_SYSTEM.md`;
- data comes from the correct API;
- loading/empty/error/business states are handled;
- no business rule is invented in React;
- responsive behavior is validated;
- accessibility is preserved;
- actual tests/build are run;
- Playwright MCP is used when browser validation is required;
- final diff is reviewed;
- relevant documentation is updated when a real product/design/architecture decision changed;
- final report states exactly what changed and what was not verified.

Never claim "production ready" merely because the page renders.
