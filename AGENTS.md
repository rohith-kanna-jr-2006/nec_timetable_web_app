# AGENTS.md

Instructions for any AI coding agent working on the NEC Timetable Web Application.

Read this file and the relevant project documentation before editing.

## 01 Purpose

This repository contains the NEC Faculty Timetable & Workload Management System. The current product-development target is the React web application under `web/`, integrated with the existing Node.js/Express/MongoDB backend.

The frontend must extend the existing application without breaking established behavior, architecture, UI patterns, backend contracts, or role boundaries.

## 02 Canonical project context

The canonical product context is:

```text
AGENTS.md
CLAUDE.md

docs/
├── PRD.md
├── DESIGN_SYSTEM.md
└── ARCHITECTURE.md
```

Supporting repository documentation may exist under `docs/`, including workflow, implementation, curriculum, audit, and screen-map documents. Read the relevant supporting document when the task depends on that subject.

Do not create or maintain a second copy of the core four-file context in another directory.

## 03 Mandatory read order

Before a substantial task:

1. Read `AGENTS.md`.
2. Read `docs/PRD.md`.
3. Read `docs/DESIGN_SYSTEM.md`.
4. Read `docs/ARCHITECTURE.md`.
5. Read only the relevant supporting `docs/*.md` files.
6. Inspect the existing implementation related to the requested task.
7. Check Git status and branch before editing.

Do not use repository history as a substitute for the current task. Do not infer an unrelated task from old commits.

## 04 Technology constraints

### Frontend

- React
- JavaScript only
- React Router
- Existing CSS/styling system
- Existing Webpack/Babel setup

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- Existing RBAC

### Prohibited unless explicitly approved

- TypeScript
- `.ts`
- `.tsx`
- Vite
- Next.js
- Angular
- replacement frontend architecture
- duplicate frontend application
- duplicate page architecture
- new frontend solver/optimization engine

The mobile/Expo application is reference material only unless explicitly requested.

## 05 Agent ownership boundaries

### Frontend owns

- React pages and components
- React Router behavior
- forms and frontend state
- API integration
- loading/error/empty/business-state presentation
- responsive behavior
- accessibility
- frontend tests
- browser validation
- visual consistency

### Backend owns

- Node.js/Express APIs
- MongoDB/Mongoose
- schemas, migrations and seeds
- authoritative business rules
- faculty eligibility authority
- workload calculations
- timetable generation and optimization
- conflict detection
- timetable version lifecycle
- approval/publication enforcement
- backend tests

Do not move backend-owned business rules into React merely to compensate for an API limitation.

## 06 Product and workflow rules

The product is department-wide and multi-cohort. Never treat a single section such as `III-A` as the product boundary.

The frontend must support valid Year + Semester/Academic Term + Section/Cohort values returned by the backend.

Backend-provided business state is authoritative. The frontend may perform validation for immediate UX, but must not invent business rules, faculty eligibility, timetable versions, approvals, publications, elective activation, or timetable sessions.

Important timetable lifecycle:

```text
NO_TIMETABLE / TIMETABLE_NOT_GENERATED
        ↓
GENERATED
        ↓
PENDING_HOD_APPROVAL
        ├────────→ REJECTED + remarks
        ↓
APPROVED
        ↓
PUBLISHED
```

Coordinator responsibility:
- select academic context/class
- use HOD-approved faculty allocation
- design/generate timetable through existing backend APIs
- review generated timetable
- submit/send generated timetable to HOD

HOD responsibility:
- authoritative faculty allocation
- review generated timetable
- approve or reject with remarks
- publish when backend-authorized

The backend may use internal role identifier `AC`. User-facing frontend terminology is `Time Table Coordinator` / `TC`.

## 07 UI rules

Follow `docs/DESIGN_SYSTEM.md` and the existing application implementation.

Reuse existing components before creating new ones.

Do not redesign an established page when an incremental change is sufficient.

The existing HOD Faculty Allocation screen is the visual baseline for allocation-related changes.

Do not:
- invent feature-specific raw colors when an existing token works
- invent new component variants without a product reason
- create generic `Faculty 1/2/3` labels where semantic faculty roles exist
- hide required controls on mobile
- introduce page-wide horizontal overflow
- use hardcoded course/faculty/timetable data when the backend already provides it

## 08 Data/API rules

Before creating or changing an API call:

1. Inspect the actual backend route.
2. Inspect the controller/service response shape.
3. Verify request params/body/query.
4. Verify authorization requirements.
5. Reuse the existing frontend service/API layer where possible.

Do not invent endpoints or silently change backend contracts.

The frontend must render authoritative API responses rather than guessed local business state.

## 09 State handling

Data-driven pages must explicitly handle:

```text
loading
success
empty
error
```

A valid academic context with no timetable is a workflow state, not generic missing data.

Use meaningful states such as:

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

Do not invent additional business states unless the backend/product documentation establishes them.

## 10 Responsive and accessibility requirements

Required browser validation widths:

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

Critical controls must remain usable on mobile.

Preserve:
- keyboard navigation
- visible focus states
- accessible labels
- semantic buttons
- meaningful validation errors
- understandable disabled/locked states
- no color-only status communication

## 11 Browser validation

Use Playwright MCP when the requested change affects UI or integration behavior.

A functional PASS requires the interaction to be executed and the expected result to be observed. Page-load success alone is not sufficient.

When test data is unavailable, classify the result as `NOT TESTED` rather than fabricating data or claiming success.

Do not claim that a command, build, test, endpoint, or workflow passed unless it was actually executed and verified.

## 12 Git safety

Before editing:

```bash
git branch --show-current
git status
git log --oneline -5
git remote -v
```

Current development branch for this agent setup:

```text
Claude Code Desktop → rohith-frontend
```

Jules uses a separate branch:

```text
Jules → rohith-frontend-102292981560789839
```

The Jules branch is reference-only unless the user explicitly requests a transfer. Do not merge, cherry-pick, rebase, or otherwise combine those branches automatically.

Protected branches for this frontend workflow:

```text
main
ragul-backend
```

Do not modify, merge, rebase, or push them during frontend work.

Never use destructive commands such as:

```bash
git reset --hard
git clean -fd
git push --force
```

Never use `git add .` for a task commit. Stage exact files only.

Before completing work, inspect:

```bash
git diff --stat
git diff --check
git status
```

Do not commit or push unless the user/task explicitly authorizes it.

If a commit/push is authorized, push only to the explicitly assigned branch.

## 13 Task execution rules

A task may contain multiple related phases. Complete them in the order requested, with validation between phases where practical.

Do not:
- keep exploring unrelated directories after the relevant code is known
- repeatedly reread the same file without a concrete reason
- redesign unrelated code
- perform speculative cleanup
- create parallel implementations
- start future feature work that was not requested

Inspect the smallest relevant set of files first.

When a concrete bug is found:

1. reproduce it;
2. identify the root cause;
3. make the smallest safe fix;
4. rerun the affected validation;
5. check for regressions.

## 14 Documentation rules

Keep the canonical context consistent:

- `docs/PRD.md` = product scope and definition of done
- `docs/DESIGN_SYSTEM.md` = visual language and UI rules
- `docs/ARCHITECTURE.md` = structure, data flow, ownership and boundaries
- `AGENTS.md` = coding-agent operating rules
- `CLAUDE.md` = Claude Code Desktop operating context

Update documentation only when there is a real product, architecture, workflow, component-pattern, or agent-process change.

Do not rewrite documentation for trivial copy changes.

## 15 Definition of done

A frontend task is complete when:

- requested behavior is implemented;
- unrelated functionality is preserved;
- UI follows the design system;
- data comes from the correct API;
- loading/empty/error/business states are handled;
- no backend business rules are invented in React;
- responsive behavior is validated where relevant;
- accessibility is preserved;
- actual tests/builds are run;
- Playwright is used when browser validation is relevant;
- the final diff is reviewed;
- relevant documentation is updated when required;
- the final report clearly states what changed and what was not verified.

## 16 Stop instead of guessing

Stop and ask one specific question when:

- the backend contract contradicts the product documentation;
- two business interpretations are genuinely possible;
- a new dependency is required;
- a new route/page is required but an existing route cannot safely support it;
- a change requires TypeScript/Vite/architecture migration;
- a new allocation policy is not documented by the backend;
- workload semantics for multi-faculty sessions are unclear;
- the requested change would alter an intentional architecture decision.
