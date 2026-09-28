# Academic Coordinator (AC) Workflow & Institutional Authority Model

## 1. Overview & Institutional Authority Architecture

### Current Prototype Role vs Future Institutional Authority
In institutional academic governance (Autonomous Colleges under Anna University regulations):
- **Actual Final Authority (Future Institutional Role)**: The **Head of the Department (HOD)** holds the institutional authority deciding:
  $$\text{Class / Section} \longrightarrow \text{Course} \longrightarrow \text{Assigned Faculty}$$
- **Current Prototype Role (Temporary Architecture)**: The **Academic Coordinator (AC)** temporarily performs the Course → Faculty assignment for prototype demonstrations.

### Code Abstraction & Clean Migration
To avoid rewriting the application when transitioning authority to HOD:
- The system defines:
  ```javascript
  // Current Prototype:
  export const assignmentAuthorityRole = 'ACADEMIC_COORDINATOR';

  // Future Institutional Authority:
  // export const assignmentAuthorityRole = 'HOD';
  ```
- All workflow screens, badges, validation headers, and assignment review pipelines reference `assignmentAuthorityRole` dynamically.

---

## 2. Course Data Model Separation

The data model cleanly separates four distinct operational concepts:

1. **`CurriculumCourse`**:
   - Official R2022 regulation courses for III Year CSE (Semester V).
   - 12 Courses total (3 Theory = 10 Periods, 2 Laboratory = 8 Continuous Periods, 3 Electives = 9 Periods, 4 Applied/Other = 8 Periods = 35 Periods/Week total).
   - Read-only, system-locked. The AC **cannot** add, delete, edit period requirements, or remove courses.

2. **`FacultyEligibility`**:
   - Registered pool of qualified faculty members eligible to instruct each course.
   - Eligibility $\neq$ Assignment. Being eligible does not automatically assign a faculty member.

3. **`FacultyAssignment`**:
   - Explicit mapping of `(Course, Section) → Faculty` performed by the authority (`assignmentAuthorityRole`).
   - Supports single faculty assignment and multi-faculty teams for laboratory / research courses.

4. **`TimetableSession`**:
   - The concrete scheduling matrix item mapped to day, period, room, and section.
   - Powered by `MASTER_TIMETABLE_SESSIONS` (Single Source of Truth).

---

## 3. End-to-End AC Workflow Pipeline

```
AC Login / Switch
       │
       ▼
AC Dashboard (/coordinator)
       │
       ▼
Course Selection (/coordinator/course-selection)
  [Select Department: CSE]
  [Select Academic Year: AY 2024-25, III Year]
  [Select Semester: Sem V]
  [Select Section: CSE-C]
  ── Official Curriculum Automatically Loads (12 Courses, 35 Periods, Read-Only) ──
       │
       ▼
Faculty Allocation & Review (/coordinator/faculty-assignment)
  [Review 12 Official Courses]
  [Select Eligible Faculty from Modal / Picker]
  [Dual-Faculty Laboratory Teams preserved]
  ── Pre-Flight Assignment Validation Check (All 12 mapped, zero unassigned) ──
       │
       ▼
Optimization Progress / Live Solver (/coordinator/optimization)
  [Loading regulations & assignments]
  [Constraint checking: 4-period lab blocks, break intervals, workload caps]
  [Solving soft heuristics: theory spread, AM/PM cognitive balance]
       │
       ▼
Conflict Inspection & Regeneration (/coordinator/conflict)
  [Detect slot collisions across candidate schedules (e.g. Wed P3 collision)]
  [Apply resolution heuristics: optimal faculty swap to Friday P1]
  [Regenerate matrix with 0 cascading conflicts]
       │
       ▼
Timetable Validation (/coordinator/validation)
  [Hard Constraints Audit: 6/6 PASS]
  [Pedagogical Optimizations: 4/4 EXCELLENT]
  [CSE Timetable Committee / HOD sign-off]
       │
       ▼
Publish & Synchronize Timetable
  [Synchronized to Faculty Portal, Student App, and Master DB]
```

---

## 4. Multi-Faculty Support
For practical laboratory and capstone mentoring courses, dual-faculty assignments are explicitly preserved:
- `22CSP09` (Full Stack Development Laboratory) $\rightarrow$ Mr. R. Manikandan & Ms. K. Shanmugapriya
- `22CSP10` (OOSE Laboratory) $\rightarrow$ Ms. N. Indumathi & Ms. N. Bhuvaneswari
- `22MAN08R` (Soft/Analytical Skills – IV) $\rightarrow$ Dr. P. Dhivyapriya & Ms. M. Priyadharsini
- `PBL` (Project Based Learning) $\rightarrow$ Ms. S. Geetha & Ms. V. Mythily

---

## 5. Screen Map & Route Reference

| Screen Name | Stitch Screen ID | Route | Primary Responsibility |
|---|---|---|---|
| **AC Dashboard** | `4623838586e143f193666324240e940f` | `/coordinator` | Coordinator desk overview, engine status, matrix load (35/35 P), operational controls |
| **Course Selection** | `8accbc8ddd5146a28e67afa09bda7d42` | `/coordinator/course-selection` | Academic target node selection, locked R2022 curriculum display, category quotas |
| **Faculty Allocation** | `e4d256a305924ff7a877be4fca4e3ab4` | `/coordinator/faculty-assignment` | Course-to-faculty allocation, eligible pool picker modal, pre-flight validation |
| **Optimization Progress** | `118edde1dd874a4e9626a5ff12a3ae69` | `/coordinator/optimization` | Live constraint solver telemetry, 6-stage verification checklist |
| **Conflict & Regenerate** | `d2a4aa6dd059480aa5884038cac1eb44` | `/coordinator/conflict` | Visual period collision diagram, slot swap heuristics, matrix regeneration |
| **Timetable Validation** | `7c78a6890932491ba38153f1994ae03e` | `/coordinator/validation` | 6/6 hard constraints, 4/4 pedagogical optimization audit, official publish trigger |
