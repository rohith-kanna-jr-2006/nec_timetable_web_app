# CLAUDE.md

## Project

**NEC Faculty Timetable & Workload Management System**  
Institution: Nandha Engineering College (Autonomous), Erode

The current product-development target is the **web application** under `web/`.

Repository areas include:
- `web/` — current React web application
- `backend/` — Node.js/Express/MongoDB backend
- legacy mobile/Expo material — reference/archive only unless explicitly requested
- `docs/` — product, design, architecture and workflow documentation

## Product target

The final product target for current development is the **web application only**.

Do not expand the legacy mobile/Expo application unless the user explicitly requests it.

## Canonical context

Before substantial work, use these files as the primary agent context:

```text
AGENTS.md
CLAUDE.md

docs/
├── PRD.md
├── DESIGN_SYSTEM.md
└── ARCHITECTURE.md
```

Supporting `docs/*.md` files may contain detailed institutional workflows, implementation specifications, curriculum data, screen maps and audits. Read only the supporting documents relevant to the current task.

`ai/` is not a project context directory and should not be recreated.

## Technology rules

### Web

- React
- JavaScript only
- React Router
- Existing CSS/styling system
- Webpack/Babel already used by `web/`

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT authentication
- RBAC

### Never introduce without explicit approval

- TypeScript
- `.ts`
- `.tsx`
- Vite
- Next.js
- Angular
- a replacement frontend stack
- a second frontend application
- duplicate pages/routes for functionality already supported by existing pages

Do not move backend-owned business logic into the React frontend.

## Role terminology

Known backend role identifiers remain:

```text
FACULTY
AC
HOD
ADMIN
```

`AC` may remain the internal backend identifier. The user-facing frontend terminology is:

```text
Time Table Coordinator
TC
```

Do not rename the backend role identifier merely to change user-facing wording.

## Role ownership

### HOD

HOD-facing frontend responsibilities include:
- academic context selection
- authoritative Course → Faculty allocation
- class advisor workflow
- timetable review
- approval
- rejection with remarks
- publication where backend-authorized

### Time Table Coordinator

TC-facing frontend responsibilities include:
- academic context/cohort selection
- HOD-approved faculty allocation visibility
- timetable design/generation through existing backend APIs
- generated timetable review
- submission/handover to HOD

TC UI must not override HOD faculty-allocation authority.

### Backend

Backend remains authoritative for:
- authentication/authorization
- course applicability
- faculty eligibility
- HOD allocation
- workload calculations
- timetable generation/optimization
- conflict detection
- version lifecycle
- approval
- publication

## Timetable lifecycle

The frontend must represent backend-authoritative lifecycle states accurately.

```text
NO_TIMETABLE / TIMETABLE_NOT_GENERATED
        ↓
GENERATED
        ↓
PENDING_HOD_APPROVAL
        ├────────→ REJECTED + rejectionReason
        ↓
APPROVED
        ↓
PUBLISHED
```

The frontend does not independently decide whether a timetable is approved or published.

## Current web architecture

The web frontend uses:

```text
web/
├── src/
│   ├── components/
│   ├── context/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   ├── constants/
│   └── styles/
└── tests/
```

Follow the existing structure. Reuse existing components, services, routes and design tokens before creating new ones.

The frontend communicates with the backend through its existing API/service layer. The frontend never accesses MongoDB directly.

## API rules

Before modifying or adding API integration:

1. inspect the actual backend route;
2. inspect the controller/service implementation;
3. verify params/query/body;
4. verify response fields;
5. verify authorization;
6. reuse the existing frontend service layer.

Known API groups include:

```text
/api/health
/api/auth
/api/faculty
/api/workload
/api/courses
/api/course-faculty-handlers
/api/academic-contexts
/api/class-advisors
/api/hod-allocations
/api/timetable
/api/notifications
/api/availability
/api/absences
/api/substitutes
```

Do not invent endpoints or fabricate response data.

## Authentication

The existing web authentication flow is JWT-based and should remain compatible with the backend contract:

```text
Login UI
  ↓
POST /api/auth/login
  ↓
Persist required session/token data
  ↓
Restore through /api/auth/me when appropriate
  ↓
AuthContext
  ↓
Protected role-aware routes
```

Inspect the actual backend response before changing authentication.

An authenticated user who is unauthorized for a route is not the same as an unauthenticated user. Preserve explicit role handling.

## UI/UX rules

Follow `docs/DESIGN_SYSTEM.md` and the existing application UI.

The current HOD Faculty Allocation interface is the baseline for incremental allocation UI changes.

Preserve:
- sidebar/navigation
- breadcrumbs
- page headers
- authority indicators
- context selectors
- context summary
- existing tables/cards/controls

Change only the UI required for the approved feature or bug fix.

Do not:
- introduce raw feature-specific colors when existing tokens work;
- create duplicate components for existing patterns;
- create generic Faculty 1/2/3 controls when semantic roles exist;
- hide critical controls on mobile;
- create page-wide horizontal scrolling;
- use sample/hardcoded timetable data when an API exists.

## Faculty allocation rules

### THEORY

```text
Course → exactly 1 faculty
```

### LAB

```text
Primary / Theory-linked Faculty    REQUIRED
Additional Faculty                REQUIRED
Optional 3rd Faculty              OPTIONAL

Minimum = 2
Maximum = 3
```

Primary is backend-authoritative/theory-linked where configured.

### MC

Allocation is policy-driven.

Supported examples include:

```text
MC_OPTIONAL_MAPPING
→ Induction Programme
→ Faculty optional
→ timetable mapping optional

MC_DEPARTMENT
→ Indian Constitution
→ respective department faculty

MC_SAS
→ Maths/BME faculty required
→ English faculty required
```

Do not replace policy-driven behavior with course-name matching when backend policy data is available.

## Multi-faculty timetable rule

One LAB class session may contain multiple assigned faculty.

The class timetable must remain one class session. Do not duplicate a class session in React merely because multiple faculty are assigned.

Faculty timetable views may legitimately display the session for each assigned faculty when the backend representation requires it.

## Workflow pages

Prefer existing shared pages where role-specific actions can be supported.

In particular, Coordinator and HOD timetable review should reuse the existing timetable review implementation instead of creating duplicate review pages.

Review scope must preserve:

```text
academicContextId
+
Timetable Version identity
```

## Branch policy for Claude Code Desktop

Claude Code Desktop works ONLY on:

```text
rohith-frontend
```

Before editing:

```bash
git branch --show-current
git status
git log --oneline -5
git remote -v
```

If the current branch is not `rohith-frontend`, stop. Do not switch automatically.

Jules works separately on:

```text
rohith-frontend-102292981560789839
```

Treat the Jules branch as read-only reference unless the user explicitly asks to transfer work.

Do not:
- merge Jules branch;
- cherry-pick Jules commits;
- rebase onto Jules branch;
- merge/rebase `ragul-backend` into `rohith-frontend`;
- modify `main`;
- modify `ragul-backend`;
- force-push.

Never use:

```bash
git reset --hard
git clean -fd
git push --force
git add .
```

Stage exact task files only.

## Development workflow

For a requested implementation task:

### 1. Inspect

Read the canonical docs and only the relevant source files.

### 2. Scope

Identify the smallest coherent set of files required.

A prompt may contain two related phases/tasks. Complete them in the order requested rather than combining unrelated work.

### 3. Implement

Make the smallest safe change that satisfies the task.

Do not perform speculative cleanup or unrelated refactoring.

### 4. Validate

Run the actual commands available in the repository.

For the current `web/package.json`, known scripts include:

```bash
npm run build
npm test
```

Do not claim `npm run lint` or `npm run test:e2e` unless those scripts actually exist in the current package configuration.

Use Playwright MCP for relevant browser/UI/integration validation.

### 5. Review

Check:
- API compatibility
- role behavior
- loading/empty/error states
- responsive behavior
- accessibility
- visual consistency
- changed-file scope

Run:

```bash
git diff --stat
git diff --check
git status
```

### 6. Commit/push

Do not commit or push automatically unless the current task explicitly authorizes it.

When authorized:

```text
Claude → origin/rohith-frontend only
```

Never push `main`, `ragul-backend`, or the Jules branch from Claude Code Desktop.

## Playwright rules

Use Playwright MCP when browser validation is relevant.

Do not call a page load a functional PASS.

A functional PASS means the interaction was executed and the expected resulting state was observed.

Classify unavailable test cases as:

```text
PASS
FAIL
NOT TESTED
ENVIRONMENT ISSUE
```

Do not fabricate test data merely to make a workflow appear complete.

Required responsive widths for relevant screens:

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

## Documentation maintenance

Keep these responsibilities clear:

```text
AGENTS.md               → agent operating rules
CLAUDE.md               → Claude Code Desktop context

docs/PRD.md             → what is being built and done criteria
docs/DESIGN_SYSTEM.md   → visual language and UI rules
docs/ARCHITECTURE.md    → structure, data flow, boundaries
```

Update the appropriate document only when the product, architecture, supported workflow, component pattern, or agent process materially changes.

Do not create duplicate context files under `ai/`.

## Stop conditions

Stop and ask one specific question when:

- the actual backend contract contradicts the documented product behavior;
- two valid business interpretations would produce different behavior;
- a new dependency is required;
- a new route/page is necessary but cannot safely extend an existing route;
- TypeScript/Vite/architecture migration is required;
- an undocumented allocation policy is requested;
- multi-faculty workload semantics are unclear.

Do not stop merely because unrelated files exist or because the repository contains legacy mobile/reference code.

## Definition of done

A substantial frontend task is complete when:

- requested behavior is implemented;
- existing unrelated functionality is preserved;
- API data and business states are authoritative;
- UI follows the design system;
- loading/empty/error states are handled;
- responsive behavior is validated where relevant;
- accessibility is preserved;
- actual build/tests are run;
- Playwright validation is run where relevant;
- final diff is reviewed;
- relevant documentation is updated when required;
- the report states exactly what changed and what remains unverified.
