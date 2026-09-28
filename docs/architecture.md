# Application Architecture

## 1. System Overview
The **NEC Faculty Timetable Mobile Application** is a production-structured React Native application built with **Expo Router** and pure **JavaScript (JSX & StyleSheet)**. It converts the authoritative Google Stitch design system (`Academic Timetable Scheduler Prototype`, Project ID: `2431280884270750586`) into a tactile, high-fidelity mobile application for faculty members at Nandha Engineering College.

## 2. Directory Structure

```
nec-faculty-app/
├── app/                        # Expo Router file-based navigation routes
│   ├── _layout.js              # Root Stack Layout with StatusBar & Safe Area Providers
│   ├── index.js                # App Entry / Splash Gateway
│   ├── (auth)/                 # Authentication Route Group
│   │   ├── _layout.js          # Auth Stack Layout
│   │   └── login.js            # Faculty Sign In Screen (Direct Stitch)
│   └── (faculty)/              # Faculty Portal Route Group
│       ├── _layout.js          # Bottom Tabs Layout with Stitch Navigation
│       ├── dashboard.js        # Faculty Dashboard (Direct Stitch)
│       ├── timetable.js        # My Timetable Personal View (Direct Stitch)
│       ├── weekly-timetable.js # Weekly Class CSE-C Matrix (Direct Stitch)
│       ├── workload.js         # Timetable Validation & Workload (Direct Stitch)
│       ├── notifications.js    # Faculty Alerts & Notifications (Direct Stitch)
│       └── profile.js          # Faculty Profile & Settings (Derived Stitch)
├── components/                 # Reusable UI Primitives
│   ├── AppHeader.js            # Institutional Top App Bar with Logo & Avatar
│   ├── Card.js                 # Multi-surface Level Card Container
│   ├── PrimaryButton.js        # Tactile Institutional Button with States
│   ├── TimetableCard.js        # Unified Timetable Slot & Lab Span Component
│   ├── WorkloadCard.js         # Teaching Workload Statistics & Norms Gauge
│   ├── NotificationItem.js     # Interactive Notification Feed Item
│   ├── ProfileSection.js       # Structured Profile & Metadata Rows
│   └── StitchLogo.js           # Exact Vector SVG NANDHA CSE Crest
├── constants/                  # Single Sources of Truth
│   ├── theme.js                # Extracted Stitch Design System Tokens
│   └── demoData.js             # Unified TimetableSession Dataset & Mock Models
├── docs/                       # Project Documentation
│   ├── stitch-screen-map.md    # Direct vs Derived Screen Classifications
│   ├── stitch-implementation-audit.md # Visual Fidelity Audit Report
│   ├── architecture.md         # Application Architectural Overview
│   └── development.md          # Setup, Runtime, and Development Guide
├── app.json                    # Expo Configuration
└── package.json                # Pure JavaScript Dependencies
```

## 3. Navigation Architecture

The navigation is driven by **Expo Router 4**:
- **Root Layout (`app/_layout.js`)**: Configures top-level navigation, theme background, and status bar.
- **Entry (`app/index.js`)**: Splash screen routing cleanly to login or direct dashboard preview.
- **Auth Flow (`app/(auth)/login.js`)**: Handles faculty sign-in, password reveal, validation, and demo routing.
- **Faculty Portal (`app/(faculty)/_layout.js`)**: 6-tab bottom navigation with live notification badges:
  1. `Dashboard` (`/dashboard`)
  2. `My Schedule` (`/timetable`)
  3. `Weekly Grid` (`/weekly-timetable`)
  4. `Validation` (`/workload`)
  5. `Alerts` (`/notifications`)
  6. `Profile` (`/profile`)

## 4. Single Source of Truth (TimetableSession Model)

All timetable views in the application derive deterministically from a single dataset defined in `constants/demoData.js`:

```javascript
export const MASTER_TIMETABLE_SESSIONS = [
  {
    id: 'WED-P4-CSEC-NAVAMANI',
    day: 'WED',
    dayFull: 'Wednesday',
    period: 'P4',
    startTime: '12:00',
    endTime: '12:50',
    courseCode: '22CSX42',
    courseName: 'UI/UX Design',
    classSection: 'CSE-C',
    yearSemester: 'III / V',
    room: 'CSE-204',
    roomType: 'Smart Classroom',
    sessionType: 'ELECTIVE',
    faculty: 'Ms. C. Navamani',
    facultyId: 'CSE-FAC-042',
    status: 'Upcoming',
    startsIn: '45m',
    isHeroNext: true,
  },
  // ... all 35 periods across Monday-Friday
];
```

Functions querying this dataset:
- `getFacultySessions(facultyId)`: Returns personal slots for Ms. C. Navamani across all sections (`Sec B` & `Sec C`).
- `getFacultySessionsByDay(day, facultyId)`: Returns day-filtered personal timetable.
- `getClassSessionsByDay(day, classSection)`: Returns class-wide timetable for `CSE-C`.
- `getFacultyWorkload(facultyId)`: Derives exact counts (`6 Periods = 6 Theory + 0 Lab`) vs the 16-period departmental threshold.
- `getTodaySchedule(facultyId)`: Computes the dynamic Wednesday day timeline and hero next class.

## 5. Styling & Theme System

The design system strictly implements the Stitch tokens in `constants/theme.js`:
- **Palette**:
  - Primary: `#001428` / `#0f2942`
  - Secondary Accent: `#0051d5` / `#316bf3`
  - Tertiary / Lab: `#002e1d` / `#21a173` / `#68dba9`
  - Background & Surfaces: `#f8f9ff` (Canvas), `#ffffff` (Surface Level 1), `#eff4ff` (Low), `#e5eeff` (Medium), `#dce9ff` (High)
  - Typography: Public Sans and JetBrains Mono hierarchy for monospace badges and timecodes.
