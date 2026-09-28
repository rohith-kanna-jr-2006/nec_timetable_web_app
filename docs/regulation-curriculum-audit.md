# Data-Source & Period Consistency Audit Report: Regulation Curriculum & Subject Allocation

**Date**: September 21, 2026  
**Auditor**: Antigravity IDE  
**Context**: Autonomous Regulation R2022 / CSE / Year III / Semester V  
**Status**: Authoritative Counting Rule Defined & Fully Verified  

---

## 1. Executive Summary & Period Consistency Reconciliation

### The Consistency Error Identified
The prior audit summary contained an internal data consistency discrepancy:
> *"32 weekly periods across 12 courses (+ 3 institutional contact periods = 35)"*

However, the 12 verified curriculum courses themselves individually sum to:
$$4 + 3 + 3 + 4 + 4 + 3 + 3 + 3 + 2 + 2 + 2 + 2 = \mathbf{35\text{ weekly periods}}$$

This data consistency error has been thoroughly audited and reconciled directly from source records. No numbers were altered to force a match; rather, the underlying domains were strictly traced and classified according to authoritative collegiate standards.

---

## 2. Deep-Dive Source Period Tracing

### Question 1: Which period values are curriculum teaching periods?
All 12 courses registered for Semester V under Autonomous Regulation R2022 represent **curriculum teaching periods** scheduled on the weekly student cohort timetable matrix:
- **Core Theory**: `22CSC14` (4p), `22CSC15` (3p), `22CSC16` (3p) $\implies \mathbf{10\text{ periods}}$
- **Core Practical/Lab**: `22CSP09` (4p continuous block), `22CSP10` (4p continuous block) $\implies \mathbf{8\text{ periods}}$
- **Professional Electives**: `22CSX01` (3p), `22CSX21` (3p), `22CSX42` (3p) $\implies \mathbf{9\text{ periods}}$
- **Mandatory Value-Added**: `22MAN08R` Soft/Analytical Skills – IV $\implies \mathbf{2\text{ periods}}$
- **Applied/Special/Other**: `SD` Skill Development (2p), `NPTEL` Mentoring (2p), `PBL` Project Based Learning (2p) $\implies \mathbf{6\text{ periods}}$

$$\text{Curriculum Teaching Periods} = 10 + 8 + 9 + 2 + 6 = \mathbf{35\text{ weekly periods}}$$

These 35 periods completely fill the standard 5-day collegiate timetable grid (Monday–Friday, Periods P1–P7: $5 \times 7 = \mathbf{35\text{ slots}}$), resulting in **100% timetable grid completeness and 0 unassigned slots**.

---

### Question 2: Which values are workload hours / responsibility hours?
In `constants/workloadMasterData.js`:
- **Teaching Hours**: Represent individual faculty contact hours for specific assigned cohorts (e.g., 4 hrs for `22CSC14` in section A, 4 hrs for `22CSP09` in section A).
- **Responsibility Hours**: Represent administrative allowances against the AICTE departmental cap (e.g., `Class Advisor`: 2h, `Overall Academic Coordinator`: 2h, `Timetable I/C`: 2h, `Proctor`: 2h, `NBA Coordinator`: 2h).
- **Rule**: Faculty workload hours are internal instructor load accounting metrics; they are **never converted into timetable periods** unless the course syllabus explicitly defines them as weekly cohort curriculum periods.

---

### Question 3: Which values are represented as institutional contact periods?
In `services/institutionalAllocationService.js`:
1. `HOD_PERIOD` (Head of Department Period): 1 statutory contact period
2. `AC_PERIOD` (Academic Coordinator Period): 1 statutory contact period
3. `PROCTOR_PERIOD` (Student Proctoring & Mentorship Period): 1 statutory contact period

Total: **3 statutory institutional contact periods**.
These 3 institutional allocations represent supervisory cohort governance duties assigned by HOD directly to faculty members. They are **not** curriculum courses and do not add extra classroom slots to the 35-period timetable grid.

---

### Question 4: Whether SD / NPTEL / PBL should count inside the 12-course curriculum total?
**YES.**  
As explicitly defined in `docs/timetable-workflow.md` (Line 40):
> *"3. Course Requirements: Weekly period volumes (10 Core Theory, 8 Lab, 2 SAS, 9 Elective, 6 Other = 35 total weekly periods)."*

The "6 Other" periods are comprised of:
- `SD` (Skill Development): 2 periods
- `NPTEL` (NPTEL Certification Mentoring): 2 periods
- `PBL` (Project Based Learning): 2 periods

Without these 3 courses (6 periods), the student cohort timetable would only have 29 periods, leaving 6 empty/unassigned slots in the 35-period weekly timetable matrix. Thus, SD, NPTEL, and PBL **must count inside the 12-course curriculum total**.

---

### Question 5: Whether HOD_PERIOD / AC_PERIOD / PROCTOR_PERIOD are separate from these 12 records?
**YES.**  
`HOD_PERIOD`, `AC_PERIOD`, and `PROCTOR_PERIOD` belong to a separate **Institutional Allocation Domain**:
- They are statutory administrative duties, **not** curriculum courses.
- They are never returned by `getRegulationSubjects()`.
- They are never placed into the AC subject handler advisory pool.
- They do not add additive 36th, 37th, or 38th periods to the 35-period student timetable matrix.
- They are tracked independently via `institutionalAllocationService.js` and audited in `allocation-review.js`.

---

## 3. The Authoritative Counting Rule

To ensure absolute consistency across `regulationCurriculumService.js`, `faculty-allocation.js`, `allocation-review.js`, timetable validation, solver generation, and documentation, the application adheres to **ONE Authoritative Counting Rule**:

```
================================================================================
                    THE AUTHORITATIVE COUNTING RULE
================================================================================

1. CURRICULUM TIMETABLE REQUIREMENT:
   - Verified Course Count: Exactly 12 Courses
   - Authoritative Curriculum Weekly Load: Exactly 35 Periods / Week
   - Weekly Grid Capacity: 5 Days x 7 Periods (P1-P7) = Exactly 35 Slots
   - Grid Completeness: 35 / 35 Scheduled Periods (100% Scheduled Load, 0 Free)

2. STATUTORY INSTITUTIONAL ROLES DOMAIN:
   - Statutory Institutional Roles: Exactly 3 Roles (HOD, AC, Proctor Periods)
   - Statutory Contact Load: Exactly 3 Contact Periods (1 Period Each)
   - Domain Boundary: Evaluated and assigned by HOD directly. Never mixed into
     curriculum course arrays. Never double-counted into the 35 curriculum periods.

3. FACULTY WORKLOAD ACCOUNTING:
   - Workload hours from workloadMasterData.js track instructor capacity.
   - Workload hours are NOT timetable periods.
================================================================================
```

---

## 4. Exact Semester V Subject List & Period Accounting

| # | Course Code | Course Name | Category | Classification | Periods/Wk | Credits | Allocation Rule | AC Advisory | Source Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `22CSC14` | Principles of Compiler Design | THEORY | `REGULAR_THEORY` | **4** | 4 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 2 | `22CSC15` | Full Stack Development | THEORY | `REGULAR_THEORY` | **3** | 3 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 3 | `22CSC16` | Object Oriented Software Engineering | THEORY | `REGULAR_THEORY` | **3** | 3 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 4 | `22CSP09` | Full Stack Development Laboratory | LAB | `LABORATORY` | **4** | 2 | PRIMARY_PLUS_ADDITIONAL | Yes (Dual) | Verified Authoritative |
| 5 | `22CSP10` | Object Oriented Software Engineering Laboratory | LAB | `LABORATORY` | **4** | 2 | PRIMARY_PLUS_ADDITIONAL | Yes (Dual) | Verified Authoritative |
| 6 | `22CSX01` | Deep Learning | ELECTIVE | `REGULAR_THEORY` | **3** | 3 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 7 | `22CSX21` | Cryptography and Network Security | ELECTIVE | `REGULAR_THEORY` | **3** | 3 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 8 | `22CSX42` | UI and UX Design | ELECTIVE | `REGULAR_THEORY` | **3** | 3 | SINGLE_FACULTY | Yes | Verified Authoritative |
| 9 | `22MAN08R` | Soft/Analytical Skills – IV | NON_CREDIT | `NON_CREDIT` | **2** | 1 | MINIMUM_TWO | No (HOD Direct) | Verified Authoritative |
| 10 | `SD` | Skill Development | SPECIAL | `SPECIAL` | **2** | 1 | STAFFS_HANDLED | No (HOD Direct) | Verified Authoritative |
| 11 | `NPTEL` | NPTEL Certification Mentoring | SPECIAL | `SPECIAL` | **2** | 1 | STAFFS_HANDLED | No (HOD Direct) | Verified Authoritative |
| 12 | `PBL` | Project Based Learning | OTHER | `OTHER` | **2** | 1 | STAFFS_HANDLED | No (HOD Direct) | Verified Authoritative |

### Mathematical Proof:
$$\begin{aligned}
\text{Core Theory (3 Courses)} &= 4 + 3 + 3 = 10\text{ Periods} \\
\text{Laboratories (2 Labs)} &= 4 + 4 = 8\text{ Periods} \\
\text{Professional Electives (3 Electives)} &= 3 + 3 + 3 = 9\text{ Periods} \\
\text{Soft/Analytical Skills (1 Course)} &= 2 = 2\text{ Periods} \\
\text{Applied/Special/Other (3 Courses)} &= 2 + 2 + 2 = 6\text{ Periods} \\
\hline
\mathbf{\text{Curriculum Timetable Total}} &= \mathbf{10 + 8 + 9 + 2 + 6 = 35\text{ Periods / Week}}
\end{aligned}$$

---

## 5. Statutory Institutional Allocations Domain

| # | Role ID | Statutory Role Name | Short Code | Contact Periods | Governance Authority |
|---|---|---|---|---|---|
| 1 | `HOD_PERIOD` | Head of Department Period | `HOD-PER` | 1 Period/Wk | HOD Direct Assignment |
| 2 | `AC_PERIOD` | Academic Coordinator Period | `AC-PER` | 1 Period/Wk | HOD Direct Assignment |
| 3 | `PROCTOR_PERIOD` | Proctor / Mentorship Period | `PROC-PER` | 1 Period/Wk | HOD Direct Assignment |

- **Institutional Roles Total**: 3 Roles
- **Institutional Statutory Period Total**: 3 Periods
- **Double Counting Status**: **0%** (Strictly zero overlap with curriculum courses)

---

## 6. Data Correction vs. Reclassification Status

- **Raw Workload Master (`constants/workloadMasterData.js`)**:
  - **100% UNTOUCHED**. All 28 faculty records, original designations, and row-level allocations remain preserved exactly as provided.
- **Course Catalog (`services/regulationCurriculumService.js`)**:
  - All 8 fabricated/unsupported courses (`22CSC05`, `22CSC06`, `22CSP05`, `22CSO01-03`, `22MCO01-02`) remain completely eradicated.
  - The 12 verified courses have both `periods` and `periodsPerWeek` set to their authoritative values summing to 35.
- **Audit Explanation**:
  - The prior arithmetic note of "32 + 3 = 35" was an arithmetic conflation in the documentation, not a source data error.
  - The correct authoritative model is **35 Curriculum Periods** filling the complete timetable grid, with **3 Institutional Roles** managed and audited as statutory administrative duties.

---

## 7. Verification of Mandatory Architecture Checks (A – F)

| Check | Requirement | Verification Result | Implementation Evidence |
|---|---|---|---|
| **A** | Selected Sem V returns exactly the verified Sem V subject catalog | **VERIFIED** | Returns exactly the 12 verified courses; zero missing, zero extra. |
| **B** | No unrelated semester subject appears | **VERIFIED** | Strict context enclosure ensures Sem III, IV, VI, VII, VIII return 0 Sem V courses. |
| **C** | Institutional HOD/AC/Proctor periods are not duplicated as curriculum courses | **VERIFIED** | Isolated in `institutionalAllocationService.js`; 0 institutional records in `getRegulationSubjects()`. |
| **D** | Allocation-review uses the same context and same period accounting | **VERIFIED** | `app/hod/allocation-review.js` uses normalized context, displaying 35 Curriculum Periods + 3 Institutional Roles. |
| **E** | Timetable validation uses the same authoritative period accounting | **VERIFIED** | `validateFacultyAllocations` validates 35 required periods, 35 scheduled periods, 0 free periods. |
| **F** | No stale allocation survives a semester/context switch | **VERIFIED** | Composite keys (`${courseCode}_${section}_${sem}_${reg}`) ensure clean context switches with zero stale data leakage. |

---

## 8. Test Execution Results

All automated suites pass with 100% success rate:

```bash
node scripts/test-hod-faculty-allocation.js
# Summary: 92 PASSED, 0 FAILED

node scripts/test-faculty-workload.js
# Summary: 853 PASSED, 0 FAILED

node scripts/test-timetable-consistency.js
# Summary: 30 PASSED, 0 FAILED

npx expo-doctor
# Summary: 21/21 checks passed. No issues detected!
```
