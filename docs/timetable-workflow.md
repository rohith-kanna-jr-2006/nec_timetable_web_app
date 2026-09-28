# Academic Timetable Generation & Governance Workflow

## Architectural Overview
This document specifies the end-to-end architecture and workflow for generating and publishing the **Faculty Timetable** and **Class Timetable** in the NEC Faculty Mobile Application.

Crucially:
- **`MASTER_TIMETABLE_SESSIONS`** serves as the **SINGLE SOURCE OF TRUTH**.
- Faculty Timetable and Class Timetable are **two selective views** projected from this identical underlying dataset.
- There are **no separate timetable datasets** maintained for faculty vs students/classes.
- Every session in both views references the exact same session `id`, `day`, `period`, `courseCode`, `facultyId`, `room`, and `sessionType`.

---

```
                        Academic Context (AY 2024-25, CSE, Sem V, CSE-C)
                                        ↓
                        Official Curriculum (R2022 Regulation, 12 Courses)
                                        ↓
                        Course-Level Faculty Handlers Pool
                                        ↓
                        Faculty Allocation (Rules A, B, C, D)
                                        ↓
                        Timetable Generation & Solver
                                        ↓
                        MASTER_TIMETABLE_SESSIONS (Single Source of Truth)
                         ├── Faculty Timetable View (Filter: facultyId)
                         └── Class Timetable View (Filter: department, year, sem, section)
                                        ↓
                               HOD Approval Gate
                                        ↓
                        Published Class Timetable
```

---

## 1. Input Source Pipeline
Timetable generation does not synthesize arbitrary courses or random slots. It strictly consumes:
1. **Academic Context**: Department (`CSE`), Academic Year (`2024-25`), Year (`III Year`), Semester (`Semester V`), Cohort Section (`CSE-C`).
2. **Official Curriculum**: 12 prescribed courses locked from R2022 Autonomous Regulations (3 Theory, 2 Lab, 1 SAS, 3 Professional Electives, 3 Mandatory/Other).
3. **Course Requirements**: Weekly period volumes (10 Core Theory, 8 Lab, 2 SAS, 9 Elective, 6 Other = 35 total weekly periods).
4. **Course-Level Faculty Handlers**: Approved pool of qualified instructors per course.
5. **Faculty Allocations**: Explicit assignments satisfying institution-defined allocation rules.
6. **Period Configuration**: Standard collegiate timetable grid (P1–P7, Morning Break, Lunch, Evening Break across Monday–Friday).

---

## 2. Faculty Allocation Rules
The allocation engine enforces four strict allocation rules prior to running the timetable generator:

### Rule A: THEORY (Single Faculty)
- Exactly one primary faculty member assigned per theory subject.
- Example: `22CSC14` (Compiler Design) &rarr; `Ms. K. Shanmugapriya`.

### Rule B: LABORATORY (Primary Theory-Linked + Additional Staff)
- Primary lab instructor must link to the corresponding theory course instructor.
- Plus at least one additional staff member for multi-faculty lab supervision.
- Example: `22CSP09` (FSD Lab) &rarr; Primary: `Mr. R. Manikandan` (linked from `22CSC15`), Additional: `Ms. K. Shanmugapriya`.

### Rule C: SAS / Soft Skills (Minimum Two Faculty)
- Requires at least two instructors for interactive cohort facilitation.
- Example: `22MAN08R` (Soft Skills-IV) &rarr; `Dr. P. Dhivyapriya` & `Ms. M. Priyadharsini`.

### Rule D: OTHER / Skill Development / PBL (Staff's Handled Mode)
- Dynamic allocation allowing selection of 1, 2, or 3 staff members.
- Example: `PBL` (Project Based Learning) &rarr; 2 Staff: `Ms. S. Geetha` & `Ms. V. Mythily`.

---

## 3. Timetable Generation & Constraints

### Hard Constraints (100% Rigid Enforcement)
1. **Zero Faculty Double-Booking**: No faculty member can be scheduled in two classrooms at the same day + period.
2. **Zero Class Double-Booking**: No class/section can have two concurrent sessions at the same day + period.
3. **Period Volume Completeness**: All 35 required weekly periods must be scheduled (0 unassigned blocks).
4. **Lab 4-Period Continuity**: Labs (`22CSP09`, `22CSP10`) must occupy a single unbroken 4-period continuous block before lunch (09:15–12:50).
5. **Break Compliance**: Morning Tea Break (10:55–11:10), Lunch (12:50–01:45), and Evening Tea Break (03:25–03:40) strictly protected.
6. **Multi-Faculty Lab Occupancy**: Primary and additional staff locked concurrently during lab blocks.

### Soft Pedagogical Constraints
1. **Theory Spreading**: Core subjects distributed across weekdays to minimize mental fatigue.
2. **Zero Same-Day Theory Repetition**: No two theory periods of the same course on the same day.
3. **AM/PM Cognitive Balance**: Heavy analytical lectures positioned in morning attention periods (P1–P3).
4. **Lab Distribution**: Practical sessions spaced rhythmically (Tuesday & Thursday).

---

## 4. Single Master Timetable Session Model

All sessions conform to the standard `TimetableSession` model in `MASTER_TIMETABLE_SESSIONS`:

```typescript
interface TimetableSession {
  id: string;              // Unique session ID (e.g., 'WED-P4-CSEC-NAVAMANI')
  academicYear: string;    // '2024-25'
  department: string;      // 'CSE'
  year: string;            // 'III Year'
  semester: string;        // 'Semester V'
  section: string;         // 'CSE-C' (aliased classSection)
  day: string;             // 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI'
  dayFull: string;         // 'Monday' .. 'Friday'
  period: string;          // 'P1'..'P7' or 'P1-P4'
  startTime: string;       // '12:00'
  endTime: string;         // '12:50'
  courseCode: string;      // '22CSX42'
  courseName: string;      // 'UI/UX Design'
  sessionType: string;     // 'THEORY' | 'LAB' | 'ELECTIVE' | 'OTHER'
  facultyId: string;       // 'CSE-FAC-042'
  facultyName: string;     // 'Ms. C. Navamani' (aliased faculty)
  room: string;            // 'CSE-204'
  roomType: string;        // 'Smart Classroom' | 'Dedicated Laboratory'
  spanCount: number;       // 1 for standard periods, 4 for lab blocks
  isSpan: boolean;         // true for continuous lab sessions
}
```

---

## 5. Faculty Timetable View
- **File**: `app/(faculty)/timetable.js`
- **Selector**: `getFacultyTimetable(facultyId, { day, academicYear, semester })`
- **Perspective**: Individual faculty instructor (e.g., `Ms. C. Navamani`, `CSE-FAC-042`).
- **Features**:
  - Filterable by active day: `All Days (6P)`, `Mon (1P)`, `Tue (1P)`, `Wed (1P)`, `Thu (1P)`, `Fri (2P)`.
  - Today Schedule focus highlighting upcoming lecture (`WED-P4-CSEC-NAVAMANI`).
  - Total workload gauge: 6 Periods assigned vs 16 Max Threshold (COMPLIANT).
  - Version Governance: Displays `DRAFT / PENDING HOD APPROVAL` if unapproved; displays `OFFICIAL • PUBLISHED` once released.

---

## 6. Class Timetable View
- **File**: `app/(faculty)/weekly-timetable.js`
- **Selector**: `getClassTimetable({ department, year, semester, section }, { day })`
- **Perspective**: Class cohort (`CSE-C`, III Year, Semester V).
- **Features**:
  - Context indicators for Department, Year, Semester, and Section.
  - Day breakdown with slots indicators (`7 SLOTS ACTIVE` or `LAB DAY`).
  - Continuous 4-period lab blocks with dual-faculty tags (`22CSP09` FSD Lab, `22CSP10` OOSE Lab).
  - Interstitial AICTE break ribbons (Morning 10:55, Lunch 12:50, Evening 03:25).
  - Version Governance: Displays prominent banner showing approval state (`Pending HOD Approval` vs `Approved by HOD` vs `Published`).

---

## 7. HOD Approval State Machine

Class timetables require statutory institutional sign-off by the Head of Department.

```
       [ Timetable Generated ]
                  ↓
       [ PENDING_HOD_APPROVAL ] ◄──────┐
            │               │           │
   (Approve)│       (Reject)│           │ (Revise & Resubmit)
            ↓               ↓           │
       [ APPROVED ]    [ REJECTED ] ────┘
            ↓
       [ PUBLISHED ]
```

### State Definitions
1. **`DRAFT`**: Candidate timetable being assembled by Academic Coordinator.
2. **`GENERATED`**: Optimization solver has placed all 35 periods with 0 hard conflicts.
3. **`PENDING_HOD_APPROVAL`**: Submitted by AC; locked from public view awaiting HOD review.
4. **`APPROVED`**: HOD Dr. S. K. Nandha has signed off on classroom & faculty assignments.
5. **`REJECTED`**: HOD requested revisions; AC must adjust allocations and re-generate.
6. **`PUBLISHED`**: Officially released to Student App, Faculty Portal, and Campus Notice Boards.

---

## 8. Publish Flow & Governance Gates

1. **Pre-Submission Audit**: AC Validation screen verifies 6/6 Hard Constraints & 4/4 Pedagogical Optimizations.
2. **Submission**: AC clicks "Submit for HOD Approval" &rarr; Status becomes `PENDING_HOD_APPROVAL`.
3. **HOD Review [Demo Simulation]**:
   - `Approve Timetable` &rarr; Status becomes `APPROVED`.
   - `Reject / Revise` &rarr; Status becomes `REJECTED`.
4. **Publication**: AC clicks "Publish Class Timetable" &rarr; Status becomes `PUBLISHED`.
5. **Access Rule**:
   - `getPublishedClassTimetable` returns 0 sessions until state is `APPROVED` or `PUBLISHED`.
   - Faculty members viewing draft schedules are alerted with a provisional notice banner.

---

## 9. Verification & Data Consistency Check

A dedicated test suite `scripts/test-timetable-consistency.js` validates:
1. All 32 master sessions contain 100% of required `TimetableSession` fields.
2. `getFacultyTimetable` and `getClassTimetable` reference the exact same session IDs (e.g. `WED-P4-CSEC-NAVAMANI`).
3. Zero faculty double-booking conflicts across campus master DB.
4. Zero class period collisions for `CSE-C`.
5. Lab 4-period continuity (`22CSP09` and `22CSP10` are 4 continuous unbroken periods).
6. Total periods for `CSE-C` equals exactly 35.
7. Allocation validation engine enforces theory solo, lab dual-linked, SAS min-2, and Other staffs-handled.
8. TimetableVersion state transitions from `PENDING_HOD_APPROVAL` &rarr; `APPROVED` &rarr; `PUBLISHED` &rarr; `REJECTED`.
