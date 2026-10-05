# NEC Timetable Web Application
## Frontend + Backend Gap / Change Report
### Repository, Branch, Current Implementation, Required Changes

**Report basis:** GitHub repository inspection + current branch comparison + the detailed NEC workflow/UX report supplied for this review.

**Repository:** `rohith-kanna-jr-2006/nec_timetable_web_app`

**Current GitHub main at inspection:** `9b54178c1be32db129fb2bb3d1dc0587255b9aab`

**Main commit:** `feat: add offline fallback and timetable constraints`

> This report is a change plan. It does not itself modify the repository, merge branches, or claim that untested behavior is complete.

---

# 1. Executive conclusion

The repository already contains a substantial portion of the requested functionality, including:

- CSE multi-cohort Academic Context support
- HOD faculty allocation model
- LAB multi-faculty allocation primitives
- MC allocation policies
- multi-faculty `TimetableSession`
- timetable versioning
- context workflow-status service
- TC-oriented timetable design work on the backend feature branch
- Coordinator timetable design UI
- Faculty Class Timetable and Faculty Timetable views
- HOD review / approval / publication workflow
- frontend context documentation work on the `rohith-frontend` branch
- backend context documentation work on the `ragul-backend` branch

However, several items in the detailed audit report are still not fully aligned with the intended NEC workflow.

The largest remaining issues are not simply visual:

```text
Data correctness
+
Role/authority boundaries
+
Academic-context generalization
+
Curriculum/regulation generalization
+
Absence -> slot-aware substitute mapping
+
Faculty master/edit semantics
+
HOD/TC workflow separation
+
Seed/data integrity
+
Final browser/integration validation
```

The most important architectural rule is:

```text
HOD DECIDES
    ↓
TC DESIGNS
    ↓
HOD REVIEWS / APPROVES
    ↓
FACULTY VIEWS
```

Moving a frontend page from HOD navigation to the TC portal must NOT accidentally move HOD decision authority to the TC.

---

# 2. GitHub repository and branch state

## 2.1 Repository

```text
Repository
└── rohith-kanna-jr-2006/nec_timetable_web_app

Default branch
└── main
```

Current main:

```text
9b54178c1be32db129fb2bb3d1dc0587255b9aab
```

Main is currently the shared integration baseline for this report.

---

## 2.2 `ragul-backend` branch

Current branch tip:

```text
c1f950355c5a73e9c40c6466a19b3513479eade6
```

Relationship to main:

```text
ahead: 8 commits
behind: 0 commits
```

Therefore the branch descends from current main and contains eight backend-oriented commits that are not yet integrated into main.

Important commits include:

1. `dad07c6e`
   - TC role + timetable governance
   - TC design authority separation
   - HOD approval authority
   - AC backward compatibility
   - TC RBAC test suite

2. `40ff99a0`
   - TimetableVersion <-> AcademicContext integrity anchor
   - generated timetable visibility / context anchoring

3. `7d36c013`
   - TC timetable design-context API
   - batch loading
   - HOD faculty authority
   - allocation/readiness metadata

4. `c30a6f6d`
   - TC timetable generation engine work

5. `9bd9d5e6`
   - TC timetable generation wiring

6. `5dcc6a52`
   - TC timetable review + submission workflow

7. `a2c4cfa3`
   - HOD timetable approval + publication workflow

8. `c1f95035`
   - branch instruction/documentation update

### Important branch assessment

This branch contains major work required by the audit report and should be treated as the primary backend integration branch.

However, it does NOT by itself prove that every reported problem is solved.

Examples requiring further validation:

- the branch still contains a specifically seeded III-A baseline timetable fixture;
- substitution route authorization must still be checked for TC;
- whole-CSE data quality still requires execution evidence;
- architecture/workflow machinery does not automatically make every seed/course/timetable record semantically correct.

---

## 2.3 `rohith-frontend` branch

Current branch tip:

```text
21b492d4e03ee9f996e04c5963c013ed11e87f2c
```

Relationship to main:

```text
ahead: 5 commits
behind: 0 commits
```

Important commits:

1. `82697cc3`
   - LAB multi-faculty allocation UI
   - TC nomenclature
   - HOD-approved data flow
   - timetable generation catalog validation

2. `c03f1e3f`
   - Coordinator Timetable View improvements

3. `12bb16b7`
   - project context / architecture documentation alignment

4. `c365e2d1`
   - timetable review / HOD rejection refinement

5. `21b492d4`
   - backend server adjustment + frontend documentation

### Important branch assessment

The branch contains useful frontend work that directly relates to this audit.

But it is NOT a perfectly frontend-only branch.

The branch also changes:

```text
backend/src/controllers/facultyController.js
backend/src/server.js
```

Therefore:

```text
Do not merge `rohith-frontend` blindly as a frontend-only branch.
```

Those backend changes must be reviewed and assigned to the correct owner before integration.

---

## 2.4 `rohith-frontend-102292981560789839`

Current branch tip:

```text
abcfaa161c00adc8ad96c92f16ceebe9814d4ac0
```

Relationship to main:

```text
ahead: 5 commits
behind: 0 commits
```

This branch contains the Jules/refinement line of work, especially:

- moving `Send to HOD` from HOD approval page toward Coordinator review flow
- review state handling
- rejection remarks
- timetable review UI improvements

It overlaps conceptually with `rohith-frontend`.

Do not merge both frontend branches independently without comparing their overlapping changes.

---

# 3. Current main repository structure relevant to this report

Current main contains:

```text
web/
backend/
docs/
scripts/
.agents/
.github/
AGENTS.md
CLAUDE.md
```

Current main `docs/` includes the project's general documentation plus the R22 curriculum source.

The current main branch does not contain the role-separated:

```text
docs/frontend/ai/
docs/backend/
```

documentation trees that appear on the feature branches.

---

# 4. FRONTEND — required changes

# 4.1 HOD Faculty Allocation page

## Current state in main

`web/src/pages/hod/HODFacultyAllocationPage.js`

The current main already contains special allocation UI logic for:

```text
LAB_2_TO_3
MC_SAS
MC_DEPARTMENT
MC_OPTIONAL_MAPPING
THEORY_SINGLE
```

It already has frontend state/controls for:

```text
LAB:
Primary
Additional
Optional

SAS:
Maths/BME
English

MC Department:
Department Faculty

Induction:
Optional Faculty
Timetable Mapping
```

Therefore this is NOT a feature that needs to be recreated from zero.

## Required change

The current LAB/MC UI must be treated as an existing implementation to refine and verify.

### LAB

Must remain:

```text
Primary / Theory-linked Faculty
Additional Faculty *
Optional 3rd Faculty
```

Rules:

```text
Minimum = 2
Maximum = 3
Primary = linked/authoritative
Additional = mandatory
Optional = optional
```

### MC

```text
SAS
    Maths/BME Faculty *
    English Faculty *

Indian Constitution
    Respective Department Faculty *

Induction Programme
    Optional Faculty
    Optional Timetable Mapping
```

### Frontend status

```text
Core UI logic: PRESENT
Verification / workflow placement: NEEDS REFINEMENT
Backend contract integration: MUST BE VERIFIED
```

---

# 4.2 Course -> Faculty Allocation should not imply TC authority

Current main Coordinator page:

```text
web/src/pages/coordinator/FacultyAssignmentPage.js
```

already presents:

```text
Course — Faculty Allocation Matrix
HOD AUTHORITATIVE MATRIX
```

This is conceptually close to the intended workflow.

However, the UI currently still contains language such as:

```text
HOD-Assigned Faculty
Coordinator Course Preference Notes
```

and contains candidate/preference-style controls.

## Required final frontend design

The Coordinator should see:

```text
Course Code
Course Title
Faculty
Type
Required Periods
Status
```

The display should NOT suggest:

```text
Coordinator chooses final faculty
Coordinator ratifies faculty
Coordinator replaces HOD allocation
```

The correct meaning is:

```text
HOD decision
    ↓
TC reads the decision
    ↓
TC designs timetable using it
```

Therefore:

- rename purely presentational wording from `HOD Approved Faculty` to `Faculty` where appropriate;
- retain a clear `HOD ALLOCATED` indicator;
- remove/disable any frontend action that could be interpreted as TC reassigning faculty;
- retain backend HOD authority.

---

# 4.3 Move Course -> Faculty Allocation UI to the TC portal

Current main navigation contains:

```text
HOD
└── Faculty Allocation

Coordinator
└── Faculty & Course Allocation
```

Requested product behavior:

```text
HOD decision authority
       ↓
TC sees / uses Course -> Faculty Allocation
```

### Required frontend change

The duplicated or misleading HOD-facing allocation navigation should be reviewed.

The Coordinator page should be the operational place where the TC consumes the allocation.

The HOD remains the decision authority at backend level.

Do NOT solve this by simply giving TC write permission to the existing HOD allocation endpoint.

---

# 4.4 Rename “Solver Studio” to “Timetable Design”

Current route structure already has:

```text
/coordinator/design
```

and currently uses the existing timetable-design implementation.

### Required UI change

User-facing language:

```text
Solver Studio
    ↓
Timetable Design
```

Do not remove the backend solver.

The correct architecture remains:

```text
TC
 ↓
Timetable Design
 ↓
Backend Solver
```

Only the user-facing terminology and information architecture must change, unless source inspection reveals a deeper page-level mismatch.

---

# 4.5 Coordinator Free Timetable / Substitute Mapping

Current main:

```text
web/src/pages/coordinator/FreeTimetableMappingPage.js
```

already loads:

```text
Original Absent Faculty
Target Date
Target Period Slot
Available Substitute Faculty
```

and the frontend service already calls:

```text
POST /api/substitutes
```

## Required improvement

The modal needs to become fully timetable-aware.

Expected flow:

```text
Faculty Portal
    ↓
Faculty submits absence
    ↓
Backend stores absence
    ↓
TC opens Free Timetable / Substitute Mapping
    ↓
TC selects recorded absence
    ↓
System identifies affected date/period
    ↓
System shows the original faculty's actual course/class/duty
    ↓
System shows faculty who are free in that exact period
    ↓
TC chooses substitute
    ↓
Confirm Mapping
```

### UI must show

```text
Original Absent Faculty *
Target Date
Target Period Slot
Original Course
Course Code
Class / Section
Session Type
Room
Available Substitute Faculty
```

### Important

Do NOT make the TC manually re-enter data already known from the absence + timetable.

The selected absence and timetable session should drive the form.

---

# 4.6 Faculty Absence page

Current main:

```text
web/src/pages/faculty/FacultyAbsencePage.js
```

contains a hardcoded fallback:

```text
FWL-03
```

when resolving the faculty ID.

## Required frontend change

Remove production hardcoded faculty identity.

Use authenticated user context only:

```text
AuthContext
    ↓
authenticated faculty
    ↓
facultyId
    ↓
absence APIs
```

A valid authenticated faculty must never silently become `FWL-03`.

---

# 4.7 Faculty Timetable data correctness

Current main Faculty Timetable UI is structurally good and already uses authenticated faculty identity.

But the detailed audit found semantic problems:

```text
wrong / unsupported course identity
wrong weekly period totals
course-period mismatch
```

The frontend should NOT patch those by changing displayed numbers.

Correct responsibility:

```text
Course Master / Regulation
        ↓
Backend required periods
        ↓
Solver / Timetable Session
        ↓
Faculty Timetable
```

Therefore frontend verification must compare actual returned sessions against backend course requirements.

Example acceptance:

```text
Course required periods = 4
Faculty Timetable count = 4
```

not:

```text
UI happens to show 4
```

---

# 4.8 Faculty Class Timetable

Current main:

```text
web/src/pages/faculty/ClassTimetablePage.js
```

supports context selection.

Required refinement:

The page must represent the class/cohort relationship correctly and must not substitute arbitrary class data.

Class timetable should be based on:

```text
Academic Context
+
published timetable
```

The faculty's Class Advisor relationship may determine the default class context where that is the established product behavior.

---

# 4.9 HOD Faculty Management — simplify the basic Faculty Information UI

Current main:

```text
web/src/pages/hod/AddFacultyPage.js
```

contains:

```text
Faculty Information
UG Theory 1
UG Theory 2
Lab 1
Lab 2
PG / Honours / Minor
Other Academic
Institutional Responsibilities
Workload Summary
```

The audit requirement is to make the basic faculty-information operation focused on:

```text
Faculty Name
Email ID
Date of Birth
Designation
Phone Number
```

### Required frontend change

Separate:

```text
Faculty Information
```

from:

```text
Workload Allocation / Responsibilities
```

Do not force a new faculty-information form to carry all workload entry sections unless the product explicitly requires the combined workflow.

The HOD should be able to:

```text
Add Faculty
```

using the basic information first.

---

# 4.10 Date of Birth field

Frontend:

```text
Date of Birth
```

must be added.

Expected display/input:

```text
DD-MM-YYYY
```

or the project's standard date input representation with clear display formatting.

The requirement says the initial password should use:

```text
DDMMYYYY
```

This should NOT mean exposing the password value in the frontend.

The backend must own credential creation and hashing.

---

# 4.11 Faculty edit restriction

Edit page must allow only:

```text
Faculty Name
Email ID
Date of Birth
Designation
Phone Number
```

Do NOT expose editing of:

```text
Faculty ID
role
department
password hash
calculated workload
historical allocations
institutional assignments
system audit fields
```

unless explicitly authorized by the backend contract.

---

# 4.12 HOD Class Advisor

Current main:

```text
web/src/pages/hod/ClassAdvisorPage.js
```

contains a hardcoded:

```text
Academic Year 2026-27
```

and a hardcoded 12-cohort list.

The 12 cohorts are currently useful for the current academic setup, but the academic-year scope must not become permanent business logic.

## Required behavior

```text
Academic Year
    ↓
Academic Context
    ↓
Class / Section
    ↓
One active Class Advisor
```

Example:

```text
2026-27
III-A → Faculty X

2027-28
III-A → Faculty Y
```

The same cohort in a different academic year must be able to have a different advisor.

### Frontend

- remove hardcoded year text;
- load active academic contexts;
- filter by selected academic year;
- show current assignment;
- allow reassignment;
- clearly show conflict states.

---

# 4.13 Academic Context UI

Current HOD Academic Context page exists.

Requested change:

Current:

```text
Academic Year
```

Desired:

```text
From Academic
To Academic
```

Example:

```text
From Academic
[2026]

To Academic
[2027]
```

Frontend should display a normalized label:

```text
2026–27
```

when appropriate.

Do not blindly delete the existing backend field before checking API compatibility.

---

# 4.14 Regulation / Course Selection UI

Current main:

```text
web/src/pages/coordinator/CourseSelectionPage.js
```

has:

```text
Curriculum Course Selection (R2022)
```

and hardcoded Semester 1–8 options.

### Required frontend design

First choose:

```text
Regulation Type
[R22 ▼]
```

Then:

```text
Semester
[Semester I]
[Semester II]
...
```

Then show:

```text
all applicable courses
```

for the selected regulation + semester.

The frontend must not hardcode:

```text
R2022
```

as the only supported regulation label.

However, current repository evidence primarily covers R22. There is not enough evidence in the inspected repository to claim that complete R26/R17 course masters already exist.

Therefore:

```text
Support any regulation that the backend actually provides.
Do not fake R26/R17 data in frontend.
```

---

# 4.15 Eliminate misleading “No courses found”

For a valid:

```text
Regulation
+
Semester
```

selection, the page must distinguish:

```text
API error
No backend curriculum
No active courses
Loading
Valid course catalog
```

Do not use:

```text
No courses found
```

as a generic response to a valid context when data has not actually been loaded correctly.

---

# 4.16 HOD Timetable Review / Approval

Current main already has:

```text
HOD Timetable Review
HOD Timetable Approval
```

The requested workflow is:

```text
TC designs
      ↓
TC submits to HOD
      ↓
HOD reviews
      ↓
HOD gives correction / rejection remarks
      ↓
TC redesigns
      ↓
TC resubmits
      ↓
HOD approves
      ↓
Publish
```

Frontend must clearly show:

```text
Generated
Pending HOD Approval
Rejected + Remarks
Ready for Redesign
Approved
Published
```

A rejection should create a usable correction loop, not a dead-end.

---

# 5. BACKEND — required changes

# 5.1 TC role and authorization

Current main `User` model supports:

```text
FACULTY
AC
HOD
ADMIN
```

`ragul-backend` adds:

```text
TC
```

This is a required architectural change because your workflow explicitly separates Time Table Coordinator from HOD approval authority.

### Required final rule

```text
TC:
- design
- generate
- revise working timetable
- submit to HOD

HOD:
- allocate faculty
- review
- approve/reject
- publish

ADMIN:
- full override according to existing security rules
```

AC may remain as a backward-compatible legacy role while migration is performed, as already designed in the backend feature branch.

---

# 5.2 HOD allocation write authority

Current main HOD allocation routes allow:

```text
HOD
ADMIN
```

to write.

That is correct for HOD authority.

Do NOT change the HOD allocation write endpoint to make TC the final authority merely because the UI is displayed in the TC portal.

Instead:

```text
HOD
   ↓
writes authoritative allocation

TC
   ↓
reads authoritative allocation
```

The TC page can be the operational visualization without transferring ownership of the decision.

---

# 5.3 LAB/MC allocation backend

Current main already contains:

```text
allocationPolicyService.js
```

with:

```text
THEORY_SINGLE
LAB_2_TO_3
MC_SAS
MC_DEPARTMENT
MC_OPTIONAL_MAPPING
```

and `HODFacultyAllocation` supports:

```text
facultyAssignments[]
```

Therefore the basic model is already present.

## Required validation

### LAB

```text
PRIMARY       required
ADDITIONAL    required
OPTIONAL      optional
minimum       2
maximum       3
no duplicates
primary linked to theory faculty
```

### SAS

```text
MATHS_BME
ENGLISH
```

Both mandatory.

### Indian Constitution

```text
Eligible faculty from Academic Context department
```

### Induction

```text
Optional faculty
Optional timetable mapping
```

### Final backend requirement

The allocation service is the source of truth.

The frontend must not have to reconstruct the policy.

---

# 5.4 Multi-faculty TimetableSession

Current main `TimetableSession` already has:

```text
facultyAssignments[]
```

This is correct direction.

Required semantic rule:

```text
One LAB slot
=
One TimetableSession
+
Multiple faculty assignments
```

Do NOT store three duplicate class sessions simply because three faculty teach the lab.

---

# 5.5 Solver / conflict handling

For a LAB:

```text
Faculty A
Faculty B
Faculty C (optional)
```

the same day/period must be valid for all assigned faculty.

Required validation:

```text
for every facultyAssignments[] member
    check availability
    check timetable conflict
    check absence
    check existing session conflict
```

One conflicting faculty must invalidate the slot.

---

# 5.6 Faculty timetable projection

A multi-faculty session must be projected into every participating faculty's own timetable.

Example:

```text
One LAB session:
22CSP09
MON P4

Faculty A → sees LAB
Faculty B → sees LAB
Faculty C → sees LAB if assigned
```

Class timetable:

```text
one class event
```

not three.

---

# 5.7 Course-period correctness

The detailed audit identified mismatches such as:

```text
22CSC16
22ESP10
```

where rendered timetable periods did not match the regulation expectations.

This must be fixed in backend source data / scheduling logic.

Required validation chain:

```text
Authoritative Course Master
        ↓
required contact periods
        ↓
assignment plan
        ↓
solver
        ↓
TimetableSession count
        ↓
Faculty Timetable
        ↓
Class Timetable
```

Never fix the display by hardcoding a different number on the frontend.

---

# 5.8 Academic Context and academic-year range

Current `AcademicContext` stores one:

```text
academicYear
```

string.

Required domain change:

```text
academicYearFrom
academicYearTo
```

with normalized display/compatibility as required.

Validation:

```text
from < to
```

and context identity must remain unique across:

```text
Academic Year
+
Semester
+
Department
+
Year
+
Section
```

A migration strategy must preserve existing contexts.

---

# 5.9 Class Advisor academic-year scope

Backend must guarantee that Class Advisor assignments are scoped to the Academic Context / academic year.

Required invariant:

```text
One Faculty
=
One active Class Advisor assignment
for the same Academic Context
```

A new academic year must permit a new advisor.

Do not overwrite old-year assignments.

---

# 5.10 Faculty Date of Birth

Add a proper backend field, conceptually:

```text
dateOfBirth
```

The exact field name should follow the project's existing naming convention.

Required:

```text
stored
validated
returned only where appropriate
```

Do not store the initial password as plaintext.

---

# 5.11 Initial password behavior

User requirement:

```text
initial password = DDMMYYYY
```

derived from Date of Birth.

Backend implementation must be:

```text
DOB
 ↓
DDMMYYYY
 ↓
bcrypt hash
 ↓
User.passwordHash
```

Never:

```text
database.password = "DDMMYYYY"
```

and never return that password through the faculty API.

A forced-first-login password change may be considered separately if desired, but it is not assumed by this report unless already supported by the existing auth contract.

---

# 5.12 Restrict faculty update fields

Current main controller accepts the submitted body for faculty update.

This is too permissive for the requested edit rule.

Required backend whitelist:

```text
facultyName
email
dateOfBirth
designation
phone
```

Only these fields should be mutable through the HOD faculty-edit endpoint.

Reject attempts to update:

```text
facultyId
role
department
workload totals
allocation data
passwordHash
audit fields
```

unless another explicit endpoint is authorized for those fields.

---

# 5.13 Faculty creation vs workload allocation

Current main `createFaculty` also processes:

```text
ugTheory1
ugTheory2
lab1
lab2
pg
others
responsibilities
```

This makes Faculty creation heavily coupled to workload allocation.

Required architecture review:

```text
Faculty Master
    ≠
Teaching Allocation Master
    ≠
HOD Institutional Responsibility Assignment
```

Recommended final direction:

```text
Create Faculty
    ↓
Basic faculty identity

Then separately:
    ↓
Workload / Course allocation
    ↓
Institutional responsibility allocation
```

Do not delete the workload model.

Separate its UI/API responsibilities.

---

# 5.14 Elective Object Course decision

HOD must decide which EO course is active for a relevant semester/context.

Required flow:

```text
Elective Object Catalog
        ↓
HOD selects applicable EO course
        ↓
Active selection for Academic Context
        ↓
TC sees the HOD-selected course
        ↓
Timetable Design
```

Do not let TC freely activate any EO catalog course if the HOD decision has not been made.

This should be modeled explicitly rather than inferred from course existence.

---

# 5.15 Regulation generalization

Current code/documentation is strongly R22-centric.

Required target:

```text
Regulation
  ↓
Applicable curriculum
  ↓
Semester
  ↓
Course catalog
```

The backend should return regulation-aware course data.

Do not add fake R26/R17 support without actual source curriculum masters.

When new regulations are actually introduced:

```text
Course Master
+
Elective Rules
+
Semester Rules
+
Allocation Policies
```

must be associated with the correct regulation.

---

# 5.16 Seed data is still a major backend gap

Current backend still contains:

```text
backend/src/seeds/seedTimetable.js
```

with a demo/baseline III-A timetable.

Even where the branch makes the timetable context-aware, it remains a single-context demo fixture.

Required final architecture:

```text
Canonical seed:
  regulation
  course master
  faculty
  academic contexts
  valid allocation data

Demo/test timetable:
  clearly isolated fixture
```

Do not present one III-A timetable as proof of whole-CSE data correctness.

Avoid destructive timetable-history wipes in normal seed execution.

---

# 5.17 Substitute mapping backend

Current main:

```text
POST /api/substitutes
```

is authorized for:

```text
HOD
AC
ADMIN
```

but the desired product workflow assigns operational mapping to the TC.

Therefore backend must explicitly implement:

```text
TC
```

authorization for substitute mapping.

The API must validate:

```text
absence
+
date
+
period
+
original faculty
+
timetable session
+
substitute availability
```

---

# 5.18 Absence -> timetable linkage

Current `FacultyAbsence` stores:

```text
facultyId
date
reason
status
```

The operational requirement needs a deterministic link to the affected timetable period/session.

Backend should resolve:

```text
Faculty
+
Date
+
Period
        ↓
TimetableSession
```

and return:

```text
courseCode
courseName
class
section
room
sessionType
```

rather than forcing the TC to manually reconstruct the affected class.

---

# 5.19 Available substitute faculty

The backend must return eligible available faculty for the exact requested slot.

Conceptual rule:

```text
Eligible Faculty
AND
not absent
AND
no timetable session at target period
AND
available
AND
not already assigned as conflicting substitute
```

Do not send the entire faculty master to the frontend and expect React to decide who is free.

---

# 5.20 Workload calculations

The detailed report flagged workload assumptions and mismatches.

Backend must remain authoritative.

Required:

```text
Course contact hours
+
LAB periods
+
PG/Honours/Minor rules
+
Other Academic Activities
+
Institutional Responsibilities
```

must be calculated from canonical backend rules.

Do not allow the frontend "Live UI Estimation" to become the authoritative workload total.

Existing workload data may remain reference/master data, but final calculated state should be backend-owned.

---

# 6. FRONTEND vs BACKEND ownership matrix

| Requirement | Frontend Owner | Backend Owner |
| --- | --- | --- |
| Display LAB 3 faculty fields | Rohith | Ragul validation |
| LAB min 2 / max 3 | UX validation | Mandatory server validation |
| SAS Maths/BME + English UI | Rohith | Eligibility + exact-role validation |
| Indian Constitution faculty UI | Rohith | Department eligibility |
| Induction optional mapping | Rohith | Business state + persistence |
| HOD allocation authority | UI representation | Server authorization |
| TC allocation view | UI | Read API / context |
| Timetable Design naming | UI | Existing solver remains backend |
| Multi-faculty session display | UI projection | TimetableSession + solver |
| Period correctness | Display | Course master + solver |
| Faculty absence form | UI | Absence persistence |
| Substitute period awareness | UI | Session/availability resolution |
| Substitute authorization | UI | TC authorization/business validation |
| DOB field | Form | Faculty/User model + auth |
| DOB initial password | Do not expose credential | Hash + account creation |
| Faculty edit whitelist | Form restriction | Server-side whitelist |
| Academic year From/To | Form | Schema + migration |
| Regulation selector | UI | Regulation-aware curriculum API |
| Elective Object selection | UI workflow | HOD-authoritative persistence |
| Class Advisor academic year | UI filters | Context-scoped assignment |
| Seed integrity | No | Ragul |
| Solver | No | Ragul |
| Database | No | Ragul |
| MongoDB indexes/migrations | No | Ragul |
| Approval/publish | Display/action | State machine |
| Playwright MCP | UI evidence support | Integration/E2E ownership |

---

# 7. Must-change items — highest priority

## P0 — Must fix before final acceptance

```text
1. Whole-CSE data correctness
2. No III-A-only production assumptions
3. Correct course-period/contact-hour mapping
4. TC role + correct RBAC
5. TC substitute mapping authorization
6. HOD allocation authority preserved
7. Academic Context From/To modeling
8. Faculty DOB + secure initial credential flow
9. Faculty edit whitelist
10. Elective Object HOD decision
11. Regulation-aware curriculum loading
12. Timetable session multi-faculty integration
13. Solver checks all assigned faculties
14. Public timetable only uses published data
15. Seed integrity / no destructive timetable reset
```

## P1 — Required product correctness

```text
16. Faculty Timetable course identity cleanup
17. Class Advisor academic-year scoping
18. Free timetable exact-period affected-session display
19. Available substitute filtering
20. HOD rejection → TC redesign → resubmission workflow
21. Coordinator allocation page wording cleanup
22. “Solver Studio” → “Timetable Design”
23. Remove misleading generic empty states
24. Separate Faculty Information from Workload entry UI
```

## P2 — Final quality

```text
25. Responsive browser regression
26. Accessibility pass
27. Console/runtime-error pass
28. Full live E2E
29. Playwright MCP
30. Production build
31. Documentation synchronization
```

---

# 8. Recommended branch integration order

Do not merge the branches in arbitrary order.

## Step 1 — Backend first

Use:

```text
ragul-backend
```

as the backend integration source.

Required review before integration:

```text
TC RBAC
context/version integrity
solver
review/approval
seed behavior
substitute authorization
whole-CSE tests
```

Do not declare backend complete solely because the branch has eight commits.

---

## Step 2 — Update frontend branch against new backend baseline

After backend integration:

```text
main
  ↓
updated backend baseline
  ↓
refresh frontend work
  ↓
run frontend integration validation
```

Do not directly merge an old frontend branch against an older backend contract.

---

## Step 3 — Review `rohith-frontend` backend changes

Because that branch modifies:

```text
backend/src/controllers/facultyController.js
backend/src/server.js
```

those changes must be separated/reviewed.

Frontend ownership must not silently become backend ownership.

---

## Step 4 — Compare the alternate Jules branch

Before using:

```text
rohith-frontend-102292981560789839
```

compare it against:

```text
rohith-frontend
```

because both contain overlapping review/approval changes.

Keep one canonical frontend implementation for each behavior.

---

# 9. Final end-to-end acceptance journey

The project should not be declared complete until the following can be executed using actual backend data.

```text
LOGIN
  ↓
HOD
  ↓
Select Academic Year / Context
  ↓
Select Course / Faculty allocation
  ↓
Select LAB / MC rules where applicable
  ↓
Assign Class Advisor
  ↓
HOD saves decisions
  ↓
TC
  ↓
Select Year / Semester / Section
  ↓
See HOD Faculty Allocation
  ↓
Timetable Design
  ↓
Generate timetable
  ↓
Review version
  ↓
Submit to HOD
  ↓
HOD Review
  ├── Reject + Remarks
  │      ↓
  │   TC redesign
  │      ↓
  │   Resubmit
  │
  └── Approve
         ↓
       Publish
         ↓
Faculty
  ├── Class Timetable
  └── Faculty Timetable
```

---

# 10. Required absence/substitute journey

```text
Faculty
   ↓
Submit Absence
   ↓
Backend
   ↓
Resolve affected timetable session
   ↓
TC
   ↓
Free Timetable / Substitute Mapping
   ↓
Select recorded absence
   ↓
Date / Period auto-resolved
   ↓
Show:
    Course
    Class
    Section
    Room
    Session Type
   ↓
Show eligible free faculty
   ↓
Assign Substitute
   ↓
Confirm
   ↓
Persist mapping
```

---

# 11. Required LAB journey

```text
HOD
   ↓
22CSP09
   ↓
Primary = linked theory faculty
Additional = REQUIRED
Optional = optional
   ↓
2 faculty → valid
3 faculty → valid
1 faculty → invalid
4 faculty → invalid
```

Then:

```text
TC
 ↓
Timetable Design
 ↓
one LAB slot
 ↓
one TimetableSession
 ↓
multiple facultyAssignments[]
```

Faculty views:

```text
Faculty A → sees LAB
Faculty B → sees LAB
Faculty C → sees LAB if assigned
```

Class view:

```text
one LAB class event
```

---

# 12. Required MC journey

## SAS

```text
HOD
 ↓
Soft/Analytical Skills
 ↓
Maths/BME Faculty
+
English Faculty
 ↓
both required
```

## Indian Constitution

```text
HOD
 ↓
Indian Constitution
 ↓
eligible respective department faculty
```

## Induction

```text
HOD
 ↓
Induction Programme
 ↓
Faculty optional
 ↓
Timetable mapping optional
```

---

# 13. Required academic-context journey

For any supported context:

```text
Year
+
Semester / Academic Term
+
Section / Cohort
+
Academic Year
```

the system must distinguish:

```text
Context not found
Curriculum unavailable
Allocation incomplete
Elective selection required
Ready for generation
Timetable not generated
Generated
Pending HOD approval
Approved
Published
```

The following must NEVER be conflated:

```text
No TimetableVersion
≠
No Academic Context
```

---

# 14. Final Definition of Done

## Frontend

```text
[ ] Current NEC UI shell preserved
[ ] Existing LAB/MC UI refined, not duplicated
[ ] Theory allocation remains unchanged
[ ] TC sees HOD allocation as authoritative
[ ] TC cannot arbitrarily change HOD faculty
[ ] Solver Studio renamed to Timetable Design
[ ] Substitute mapping is absence/session driven
[ ] No FWL-03 production fallback
[ ] Faculty timetable shows canonical course data
[ ] Faculty class timetable shows correct cohort/context
[ ] Faculty Information has DOB
[ ] Faculty edit is limited to requested fields
[ ] Academic Context uses From/To academic fields
[ ] Regulation selector is backend-driven
[ ] Valid curriculum selections do not produce misleading empty states
[ ] HOD review/reject/resubmit UI is coherent
[ ] 360–1920 responsive validation passes
[ ] Playwright MCP passes
[ ] Production build passes
```

## Backend

```text
[ ] TC role and RBAC are correct
[ ] HOD allocation authority is preserved
[ ] LAB 2–3 validation is server-side
[ ] SAS roles validated
[ ] Indian Constitution eligibility validated
[ ] Induction optional state validated
[ ] Multi-faculty TimetableSession works
[ ] Solver checks all assigned faculties
[ ] Course period totals match canonical curriculum
[ ] Academic Context From/To migration is safe
[ ] Class Advisor is academic-year scoped
[ ] DOB stored correctly
[ ] Initial DOB-derived password is hashed
[ ] Faculty edit whitelist enforced
[ ] EO selection is HOD-authoritative
[ ] Regulation-aware curriculum API works
[ ] Substitute mapping supports TC where required
[ ] Substitute faculty is filtered by exact time-slot availability
[ ] No draft timetable leaks to public view
[ ] Seed does not destroy production timetable history
[ ] III-A is not a production-only assumption
[ ] Whole-CSE context isolation passes
[ ] Full backend regression passes
[ ] Live E2E passes
```

---

# 15. Overall implementation priority map

```text
                    NEC TIMETABLE
                         │
             ┌───────────┴───────────┐
             │                       │
         FRONTEND                 BACKEND
             │                       │
             ▼                       ▼
     Workflow correctness       Domain correctness
             │                       │
             ├─ TC UI                ├─ TC RBAC
             ├─ HOD/TC boundary      ├─ allocation validation
             ├─ faculty views        ├─ solver
             ├─ substitute UX        ├─ context/version
             ├─ regulation UX        ├─ absence/substitute
             └─ responsive QA        └─ seed/data integrity
             │                       │
             └───────────┬───────────┘
                         ▼
                 INTEGRATION TESTING
                         │
                         ▼
                 PLAYWRIGHT MCP
                         │
                         ▼
                  FINAL SIGN-OFF
```

---

# 16. Final recommendation

The project should now be treated as a **workflow/data correctness hardening phase**, not as a simple page-building phase.

The next implementation sequence should be:

```text
1. Integrate / verify Ragul backend branch
2. Correct remaining backend domain/data issues
3. Refresh Rohith frontend against the backend baseline
4. Apply the frontend workflow corrections
5. Execute full end-to-end workflows
6. Validate multiple Academic Contexts
7. Validate LAB + SAS + Indian Constitution + Induction
8. Validate absence → substitute flow
9. Validate HOD review → TC redesign loop
10. Run Playwright MCP at required responsive widths
11. Run final regression/build
12. Only then declare completion
```

### Most important boundary

```text
HOD
└── DECIDES

TC
└── DESIGNS

HOD
└── REVIEWS / APPROVES

FACULTY
└── VIEWS
```

The frontend may move **where a decision is viewed**, but the backend must remain the authority over **who is allowed to make the decision**.
