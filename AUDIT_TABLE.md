# F8-TC RECTIFICATION AUDIT TABLE

## FEATURE | CURRENT IMPLEMENTATION | MISSING | API AVAILABLE | FILES TO CHANGE

### PHASE 1 — AUDIT BEFORE CODING
Academic Context Selection | Implemented (OptimizationSolverPage.js uses useState for cohort selection) | None | GET /api/academic-contexts | None
Course Loading for Selected Context | Implemented (fetchAllCoursesForContext with academicContextId) | None | GET /api/courses?semester=&academicContextId= | None
HOD Authoritative Faculty Allocation Display | Implemented (shows HOD-allocated faculty or [REQUIRES HOD DECISION]) | ❌ TC cannot assign/modify faculty - only displays | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js, OptimizationSolverPage.js

### PHASE 2 — TC ASSIGNMENT WORKSPACE
Theory Course Faculty Assignment (Single Faculty) | Missing | ❌ Operational TC faculty selection dropdown for theory courses | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
LAB Course Primary Faculty Assignment | Missing | ❌ TC cannot select PRIMARY faculty for LAB courses | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
LAB Course Additional Faculty Assignment | Missing | ❌ TC cannot select ADDITIONAL faculty for LAB courses | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
LAB Course Optional Third Faculty Assignment | Missing | ❌ TC cannot select OPTIONAL faculty for LAB courses | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
PG Course Faculty Assignment (max 1) | Missing | ❌ TC cannot select faculty for PG courses | PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js

### PHASE 3 — FACULTY ELIGIBILITY
UG Theory Faculty Limit Enforcement (max 2) | Partial (warning banner only) | ❌ Faculty remains in dropdown after limit reached - should disappear | Validation enforced on backend: PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
UG Lab Faculty Limit Enforcement (max 2) | Partial (warning banner only) | ❌ Faculty remains in dropdown after limit reached - should disappear | Validation enforced on backend: PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js
PG Faculty Limit Enforcement (max 1) | Partial (warning banner only) | ❌ Faculty remains in dropdown after limit reached - should disappear | Validation enforced on backend: PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | FacultyAssignmentPage.js

### PHASE 4 — CONTEXT ISOLATION
Academic Context Isolation (A vs B Sections) | Implemented (filtering by academicContextId) | ❌ Not tested for state leakage when switching contexts | GET /api/timetable/design-context/:academicContextId (context-scoped) | OptimizationSolverPage.js (needs testing)

### PHASE 5 — OTHER COURSES / ELECTIVES
Elective Course Handling (PEC/OEC) | Partial (shows elective slots as unresolved) | ❌ TC cannot perform operational faculty mapping for HOD-defined electives | GET /api/hod-allocations/elective-candidates, PUT /api/hod-allocations/context/:academicContextId/course/:courseCode | OptimizationSolverPage.js

### PHASE 6 — TIMETABLE GENERATION
Timetable Generation Readiness State | Implemented (shows allocated/total courses, pending count) | None | GET /api/timetable/design-context/:academicContextId | OptimizationSolverPage.js
Timetable Generation Execution | Implemented (POST /api/timetable/generate-from-context) | None | POST /api/timetable/generate-from-context (TC/ADMIN only) | OptimizationSolverPage.js

### PHASE 7 — SCHEDULING RESULT VALIDATION
Generation Result Validation (Theory) | Missing | ❌ Does not display required periods/week, repetition validation, distribution | GET /api/timetable/class/:academicContextId, GET /api/timetable/faculty/:facultyId | OptimizationSolverPage.js
Generation Result Validation (LAB) | Missing | ❌ Does not display 4 continuous periods, faculty double-booking, cross-class conflict, afternoon rule | GET /api/timetable/class/:academicContextId, GET /api/timetable/faculty/:facultyId | OptimizationSolverPage.js

### PHASE 8 — DUAL OUTPUT
Dual Output: Class Advisor Timetable | Missing | ❌ No link/display to class timetable after generation | GET /api/timetable/class/:academicContextId | OptimizationSolverPage.js
Dual Output: Faculty Timetable | Missing | ❌ No link/display to faculty/proctor timetable after generation | GET /api/timetable/faculty/:facultyId | OptimizationSolverPage.js

### PHASE 9 — HOD REJECTION / TC REDESIGN
HOD Rejection Remarks Visibility | Missing | ❌ TC cannot see HOD rejection remarks on timetable versions | GET /api/timetable/versions (includes rejectionReason field) | OptimizationSolverPage.js
HOD Rejection → TC Redesign Entry Point | Missing | ❌ No "Redesign / Revise" button/action available after rejection | N/A | OptimizationSolverPage.js
TC Resubmit Path After Redesign | Missing | ❌ No clear path to generate/revise and resubmit after HOD rejection | POST /api/timetable/generate-from-context, PATCH /api/timetable/version/:id/status | OptimizationSolverPage.js

### PHASE 10 — PLAYWRIGHT MCP
Browser Validation for All Viewports | Missing | ❌ Playwright tests required for: 1280x720, 768x1024, 430x932, 390x844, 360x800 | N/A | web/e2e-test.spec.js (new file)
Required Test Flows: | Missing | ❌ 18 test flows including: TC login, dashboard, context selection, course loading, theory faculty assignment, lab selections, faculty-limit hiding, context switching, readiness state, generation, submit for HOD, rejected state, HOD remarks visible, redesign action, resubmit path | N/A | web/e2e-test.spec.js