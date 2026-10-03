# AGENTS.md — NEC Timetable Web Application (Backend)

Owner: **Ragul**.
Applies to: the Node.js / Express.js / MongoDB backend in `backend/`.

> **Scope note.** This file was originally written as a repository-wide
> instruction file. It is now the **backend** instruction file. Repository-wide
> routing and ownership rules live in the root `AGENTS.md`. For frontend work,
> read `docs/frontend/AGENTS.md` instead.

Read this file before modifying backend code. Then follow the required source-of-truth order below.

---

## 01. Mission

Maintain the NEC Timetable Web Application as one full-stack product.

The product boundary is the entire CSE department across valid Academic Contexts.

The agent must preserve the distinction between:

```text
Product requirement
Visual/interaction system
Architecture / boundaries
Implementation details
```

Do not let one layer silently redefine another layer's authority.

---

## 02. Required read order

Before every substantial task:

```text
1. docs/backend/AGENTS.md
2. docs/backend/PRD.md
3. docs/backend/DESIGN_SYSTEM.md
4. docs/backend/ARCHITECTURE.md
5. backend/API.md
6. Relevant source files
7. Relevant tests
8. git status / existing modifications
```

For UI work, inspect the actual page/components/services and run the relevant browser workflow when practical.

For backend work, inspect the actual routes/controllers/services/models and affected tests.

Never claim a file or test was inspected unless it actually was.

---

## 03. Hard technology constraints

Use the existing stack:

### Frontend

- React
- JavaScript
- existing Webpack setup

### Backend

- Node.js
- Express.js
- JavaScript
- CommonJS
- MongoDB
- Mongoose

Do not introduce:

- TypeScript
- `.ts`
- `.tsx`
- Vite
- Angular
- a second backend framework
- a replacement ODM
- a new state/data framework without explicit approval

---

## 04. Product terminology

Use **TimeTable Coordinator (TC)** as the user-facing role name.

Do not introduce **Academic Coordinator (AC)** as the new UI role name.

Legacy AC compatibility may remain in backend code when required for migration or older data, but new user-facing workflow labels should use TC.

Use canonical domain terms where the product/API expects them:

```text
Academic Context
Course
Faculty
Timetable Version
Timetable Session
facultyAssignments
sessionType
allocationRule
```

---

## 05. Authority rules

The backend is authoritative for:

- course applicability
- faculty eligibility
- allocation policy
- required faculty count
- semantic faculty roles
- Academic Context ownership
- timetable/version consistency
- approval state
- publication state
- solver constraints

The frontend may provide convenient validation for the user, but it must not become a second authoritative business-rule engine.

---

## 06. Academic Context rules

Every context-specific feature must work from actual `academicContextId` data.

Do not write production logic such as:

```javascript
if (year === "III")
if (section === "A")
```

merely to make one fixture work.

III-A may be hardcoded inside an isolated test fixture only.

A valid Academic Context with no TimetableVersion is an actionable workflow state, not automatically an error.

---

## 07. HOD allocation rules

### Theory

One faculty unless the existing domain explicitly defines otherwise.

### LAB

```text
PRIMARY      required / theory-linked
ADDITIONAL   required
OPTIONAL     optional
```

Allowed faculty count:

```text
minimum 2
maximum 3
```

Reject duplicate faculty and invalid primary/theory linkage according to the backend contract.

### MC SAS

Exactly:

```text
MATHS_BME
ENGLISH
```

Both roles are required, and the same faculty cannot occupy both roles.

### MC Indian Constitution

Use faculty eligible for the Academic Context's department.

### MC Induction

Faculty assignment and timetable mapping may be optional according to the domain contract.

Never derive these rules from course-name text in React or a controller.

---

## 08. No hidden fallback

When a required HOD allocation is missing, never silently select:

- first available faculty
- random faculty
- workload-master faculty
- historical faculty
- another-context faculty
- an implicit default

Use the existing backend workflow/error state such as:

```text
REQUIRES_HOD_DECISION
ALLOCATION_INCOMPLETE
ELECTIVE_SELECTION_REQUIRED
```

---

## 09. Elective discipline

Keep separate:

```text
Elective slot
Elective catalog
Elective selection
Active course
```

Do not schedule every elective catalog entry simply because it exists in Course Master.

Only active, valid selected courses should enter generation.

---

## 10. Timetable session semantics

One class slot is one TimetableSession.

For a multi-faculty LAB/MC:

```text
ONE TimetableSession
    └── facultyAssignments[]
```

Do not create one class timetable session per faculty.

Faculty calendar projections may show the same session for each assigned faculty.

---

## 11. Version and governance rules

Treat timetable state as a backend-owned state machine.

The normal governance path is:

```text
GENERATED
  ↓
PENDING_HOD_APPROVAL
  ↓
APPROVED
  ↓
PUBLISHED
```

Rejection is a historical state. The current backend contract determines its allowed revision path.

TC:

```text
can design
can generate
can review
can submit
cannot approve
cannot reject
cannot publish
```

HOD:

```text
can review
can approve
can reject
can publish
```

Server-side RBAC remains authoritative.

Do not duplicate or invent a conflicting status machine in the frontend.

---

## 12. Public timetable rule

Default/public class timetable endpoints expose PUBLISHED data only.

Do not silently fall back to:

```text
DRAFT
GENERATED
PENDING_HOD_APPROVAL
APPROVED
```

when a published version does not exist.

Internal review endpoints may expose workflow versions only according to their documented access rules.

---

## 13. Frontend implementation rules

Before changing a frontend page:

1. Inspect the existing page architecture.
2. Identify its current data-fetching/service layer.
3. Reuse existing components and tokens.
4. Check the route and role guard.
5. Check all loading, empty, error, and success states.
6. Check responsive behavior.
7. Run the actual browser flow for affected behavior when available.

Do not rebuild a page merely because its implementation is not identical to a preferred architecture.

Do not hardcode production faculty/course lists into UI components.

Do not copy sample timetable rows from a screenshot into production data.

---

## 14. Backend implementation rules

Before changing backend behavior:

1. Inspect relevant models and indexes.
2. Inspect routes/controllers/services.
3. Inspect affected tests.
4. Preserve valid existing API behavior where practical.
5. Keep business rules in services/domain code.
6. Validate all protected and context-sensitive input server-side.
7. Do not create hidden fallback behavior.
8. Avoid N+1 queries and unbounded context-insensitive scans.
9. Update API docs when the contract changes.
10. Update architecture docs when a structural decision changes.

---

## 15. API contract rules

Use explicit identifiers:

```text
academicContextId
courseCode
courseId
facultyId
timetableVersionId
```

Use structured success/state/error responses according to the existing API contract.

Do not replace useful existing response fields merely to simplify a new frontend implementation.

Do not trust client-supplied values for server-derived fields such as approval, publication, eligibility, allocation policy, or context ownership.

---

## 16. UI/API error handling

Frontend should map backend error codes to clear user-facing messages.

Do not expose:

- stack traces
- database internals
- secrets
- tokens
- passwords
- raw provider error text

When the backend provides a specific code such as:

```text
TIMETABLE_VERSION_CONTEXT_MISMATCH
TIMETABLE_NOT_READY_FOR_SUBMISSION
TIMETABLE_VERSION_NOT_EDITABLE
HOD_ALLOCATION_CHANGED_AFTER_GENERATION
TIMETABLE_VALIDATION_FAILED
INVALID_TIMETABLE_STATUS_TRANSITION
VERSION_NOT_FOUND
```

preserve the code internally and show a suitable human-readable explanation in the UI.

---

## 17. Responsive and accessibility rules

Use the breakpoints and visual tokens in `docs/DESIGN_SYSTEM.md`.

At minimum validate important workflows around:

```text
360
390
430
768
1024
1280
```

Do not solve responsive issues by making text or controls too small.

Core interactions must support keyboard navigation, visible focus, accessible names, readable status/error messages, and suitable touch targets.

---

## 18. Testing rules

For every substantial change:

```text
1. Add/update focused tests.
2. Run the affected suite.
3. Run relevant regression suites.
4. Run live/browser validation when the workflow crosses the UI/API boundary.
5. Record exact results.
```

For LAB/MC changes, verify multi-faculty session semantics.

For governance changes, verify role + status + exact context/version.

Never claim a test passed unless the command actually completed successfully.

### Test isolation

Do not introduce new tests that mutate shared production-like seed data destructively.

Prefer owned fixtures:

```text
create fixture
→ test
→ verify persistence
→ cleanup fixture
```

If an existing test contaminates another suite, report it as test-infrastructure debt instead of hiding it with production changes.

---

## 19. Git safety

Before editing:

```text
git status --short
git branch --show-current
git log --oneline -n 5
```

Do not:

- force-push without explicit approval
- reset unrelated work
- rewrite earlier commits
- delete another developer's changes
- modify unrelated files to make a test green
- commit generated secrets

Before commit:

```text
git status --short
git diff --stat
git diff
relevant tests
```

Push only when explicitly requested.

---

## 20. Scope discipline

When a task reveals an unrelated defect:

1. Verify whether it is caused by the current change.
2. Do not silently expand the task.
3. Record it as a separate issue when it is pre-existing.
4. Fix it in the current task only when it blocks the requested acceptance criteria and the smallest safe fix is clear.

Known examples include shared-MongoDB test contamination and old workload assertion drift. Do not disguise these as feature regressions or erase them with broad data resets.

---

## 21. Documentation update rules

Update the documentation that actually changed:

```text
docs/PRD.md
        = product requirement / scope / done criteria

docs/DESIGN_SYSTEM.md
        = visual system / components / responsive / accessibility

docs/ARCHITECTURE.md
        = structure / data flow / boundaries / intentional decisions

AGENTS.md
        = agent operating rules
```

Do not put backend-only API semantics into the visual design system merely because the agent needs to know them.

Do not put product requirements into `AGENTS.md` unless they are explicit operating constraints for agents.

---

## 22. Stop and ask before coding

Stop before coding when a task requires:

- breaking an API contract
- a new external service
- a new framework
- a new database collection without documented domain need
- changing authorization semantics
- replacing the timetable engine
- changing workload formulas without an authoritative rule
- deleting/rebuilding timetable history
- changing an intentional architecture decision

When possible, provide the exact conflict and the smallest compatible alternative.

---

## 23. Definition of done

A substantial task is complete only when:

```text
[ ] Requested behavior implemented
[ ] Existing valid behavior preserved
[ ] Correct layer owns the logic
[ ] Server-side business validation preserved
[ ] UI follows DESIGN_SYSTEM.md
[ ] Academic Context/version isolation verified
[ ] Relevant tests actually executed
[ ] Browser/integration validation executed when applicable
[ ] No known critical regression introduced
[ ] Documentation updated when needed
[ ] Git diff is focused
[ ] Exact results reported
```

---

## 24. Final reporting format

Every substantial task report must contain:

### 1. Files changed

Exact paths.

### 2. Behavior changed

What changed and why.

### 3. API impact

Endpoints/fields added or changed, or `None`.

### 4. UI impact

Pages/components/routes/responsive behavior affected, or `None`.

### 5. Database impact

Schema/index/migration/seed changes, or `None`.

### 6. Tests

Exact suites and actual PASS / FAIL / SKIP results.

### 7. Browser / E2E evidence

Exact workflow, viewport(s), and result when applicable.

### 8. Remaining issues

Only real unresolved issues.

### 9. Final status

Use exactly one:

```text
PASS
```

or

```text
BLOCKED
```

Use `PASS` only when the critical acceptance criteria were actually executed and verified.
