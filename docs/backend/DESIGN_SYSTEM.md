# Design System: NEC Timetable Web Application

## 01. Purpose

This document is the shared frontend visual and interaction system for the NEC Timetable Web Application.

It defines:

- visual tokens
- typography
- spacing
- components
- layout rules
- responsive breakpoints
- status presentation
- timetable-specific interaction patterns
- accessibility expectations
- UI terminology

It is **not** the backend API contract. API/domain contracts belong in backend documentation. Agents may use canonical domain names from the existing API, but visual design rules belong here.

---

## 02. Design principles

### Clarity before decoration

The timetable is information-dense. Prefer clear hierarchy, whitespace, predictable grouping, and readable labels over decorative effects.

### State must be visible

Users should be able to tell whether a context is:

```text
Ready for generation
Generation in progress
Generated
Pending HOD approval
Approved
Rejected
Published
```

without reading raw API responses.

### Actions follow ownership

Do not show approval actions to TC users or design mutation actions to HOD review users merely because the component can technically render them.

### Responsive by layout change, not compression

At smaller widths, tables and timetable grids may switch to horizontal scrolling, stacked cards, drawers, or condensed information. Do not simply shrink text until it becomes unreadable.

### Accessible by default

All interactive controls need visible focus, labels, usable hit areas, and accessible status/error communication.

---

## 03. Visual tokens

Use CSS custom properties or the project's existing token mechanism. If the repository already has equivalent tokens, reuse them instead of creating a second palette.

### Color palette

```css
:root {
  --color-primary: #1D4ED8;
  --color-primary-hover: #1E40AF;
  --color-primary-soft: #DBEAFE;

  --color-success: #15803D;
  --color-success-soft: #DCFCE7;

  --color-warning: #B45309;
  --color-warning-soft: #FEF3C7;

  --color-danger: #B91C1C;
  --color-danger-soft: #FEE2E2;

  --color-info: #0369A1;
  --color-info-soft: #E0F2FE;

  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F5F9;

  --color-text: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #64748B;
  --color-text-on-primary: #FFFFFF;

  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;
  --color-focus: #2563EB;
}
```

Status meanings:

| Meaning | UI treatment |
|---|---|
| Success / approved / published | success token |
| Warning / pending / needs review | warning token |
| Error / rejected / blocked | danger token |
| Informational / generated / review context | info or neutral token |
| Disabled | reduced contrast without removing readability |

Never use color as the only indicator. Pair it with text, icon, or label.

---

## 04 Typography

Preferred font stack:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Type scale:

| Token | Size | Line height | Weight | Use |
|---|---:|---:|---:|---|
| display | 30px | 36px | 700 | Main page title only when needed |
| h1 | 24px | 32px | 700 | Page title |
| h2 | 20px | 28px | 700 | Section/card heading |
| h3 | 16px | 24px | 600 | Subsection |
| body | 14px | 20px | 400 | Default application text |
| body-strong | 14px | 20px | 600 | Labels / important values |
| small | 12px | 16px | 400 | Supporting metadata |
| table | 13px | 18px | 400 | Dense timetable/table cells |
| button | 14px | 20px | 600 | Button labels |

Avoid excessive use of uppercase text. Use normal sentence case for most user-facing labels.

---

## 05 Spacing

Use a 4px base spacing scale:

```text
4   8   12   16   20   24   32   40   48   64
```

Guidelines:

| Context | Recommended spacing |
|---|---:|
| Icon ↔ text | 8px |
| Field label ↔ input | 6–8px |
| Form field ↔ form field | 16px |
| Card internal padding | 16–24px |
| Card ↔ card | 16px |
| Section ↔ section | 24–32px |
| Page horizontal padding | 16px mobile, 24px tablet/desktop |

Do not introduce arbitrary values when an existing token fits.

---

## 06 Layout and containers

Maximum content width:

```text
1280px
```

Default page layout:

```text
Page
├── Page header
├── Context / navigation controls
├── Main content cards or workspace
└── Secondary actions / status where required
```

Use CSS grid/flex layouts according to the content. Do not use fixed pixel positions for primary page layout.

---

## 07 Breakpoints

The application is validated around these practical widths:

```text
360px  → small mobile
390px  → mobile
430px  → large mobile
768px  → tablet
1024px → small desktop / large tablet
1280px → desktop baseline
```

Suggested responsive tiers:

```css
@media (min-width: 640px)  { /* tablet-small */ }
@media (min-width: 768px)  { /* tablet */ }
@media (min-width: 1024px) { /* desktop-small */ }
@media (min-width: 1280px) { /* desktop */ }
```

At mobile widths:

- stack primary controls
- allow timetable tables/grids to scroll horizontally when necessary
- move secondary actions into menus/drawers when useful
- keep important status and primary action visible
- do not hide required information merely to fit the viewport

At desktop widths:

- use multi-column summaries when they improve scanning
- keep timetable grids readable
- avoid unnecessary full-screen empty space

---

## 08 Core components

### Button

Variants:

```text
Primary
Secondary
Tertiary / ghost
Danger
Icon-only
```

States:

```text
Default
Hover
Focus
Pressed
Disabled
Loading
```

Loading buttons must prevent duplicate submission.

### Input

Use for simple text entry. Always pair with a visible label or an accessible equivalent.

### Select / Combobox

Required for:

- Academic Context selection
- faculty selection
- elective selection
- filtered course choices

Server-provided eligible faculty must drive selectable options. Do not hardcode production faculty lists into UI components.

### Card

Use cards to group a coherent piece of information, not every individual field.

### Status badge

Examples:

```text
GENERATED
PENDING HOD APPROVAL
APPROVED
REJECTED
PUBLISHED
READY FOR GENERATION
ALLOCATION INCOMPLETE
```

Prefer human-readable labels while retaining the canonical backend state internally.

### Alert

Use for actionable validation or workflow messages. Errors should state what happened and what the user can do next when the backend provides enough information.

### Modal / Dialog

Use for focused allocation/edit/review actions. Destructive actions require explicit confirmation.

### Toast

Use for short-lived confirmation of completed actions. Do not use to display the only copy of an important validation error.

### Data table

Use for allocation rosters and dense records.

Rules:

- sticky header when table height justifies it
- clear column headers
- row hover only as supplementary affordance
- horizontal scroll on small screens when data cannot be safely stacked
- avoid truncating critical course/faculty information without a way to inspect it

### Timetable grid

Default structure:

```text
             P1   P2   P3   P4   P5   P6   P7   P8
MON
TUE
WED
THU
FRI
SAT
```

The grid must remain tied to the selected Academic Context and TimetableVersion.

A multi-faculty session is one cell/event. Faculty names may be displayed as a compact list or role chips inside the same event.

---

## 09 Domain-specific UI patterns

### HOD Faculty Allocation

For LAB:

```text
Primary Faculty     locked/derived where applicable
Additional Faculty  required
Optional Faculty    optional
```

For MC SAS:

```text
MATHS_BME   faculty selector
ENGLISH     faculty selector
```

The UI should present backend-provided eligibility and policy. It must not infer the policy from course name text.

### TC timetable workspace

Recommended information hierarchy:

```text
Page header
  → Academic Context
  → readiness / version status
  → action bar

Summary
  → courses
  → periods
  → allocation readiness
  → validation state

Timetable workspace
  → timetable grid
  → conflicts / diagnostics

Review / submit
  → exact version identifier
  → summary
  → submit action
```

### HOD review workspace

Show clearly:

- Academic Context
- TimetableVersion status
- generated timestamp when available
- course/session summary
- conflict/validation summary
- faculty assignments
- approve / reject / publish actions allowed for the current state

---

## 10 Interaction rules

### Loading

Every async workflow needs a visible loading state. Do not leave a blank page while waiting for API data.

### Empty state

Differentiate:

```text
No Academic Context
No applicable curriculum
Valid context, no timetable yet
No published timetable
No search results
```

Do not display a generic `No data` message when the backend provides an actionable workflow state.

### Error state

Map structured backend error codes to user-facing messages. Keep the backend code available for diagnostics/logging, but do not expose raw stack traces or database errors.

### Optimistic updates

Do not optimistically change critical timetable governance status unless the backend response confirms the transition.

### Navigation safety

Before leaving a form with unsaved changes, warn the user where loss of work is possible.

---

## 11 Accessibility

- All form controls have accessible names.
- Keyboard navigation must reach all actions.
- Focus indicators must remain visible.
- Dialogs trap focus appropriately and return focus when closed.
- Error messages are associated with the relevant field or action.
- Status changes should be announced when appropriate.
- Touch targets should be comfortably usable on mobile.
- Do not rely on color alone for role, status, or validity.
- Respect reduced-motion preferences.

---

## 12 Iconography and imagery

Use a consistent icon set already present in the repository where possible.

Do not introduce decorative imagery into dense data screens unless it improves comprehension.

Icons with actions need accessible labels/tooltips where the meaning is not obvious.

---

## 13 UI terminology

Use these user-facing terms consistently:

| Use | Do not introduce as a new UI term |
|---|---|
| TimeTable Coordinator / TC | Academic Coordinator for new flows |
| Faculty | Teacher |
| Academic Context | Class ID when the domain entity is Academic Context |
| Course | Subject when the backend/domain uses Course |
| Timetable Version | Schedule Version unless a product requirement explicitly changes it |
| Publish | Make public / Release now unless necessary for explanation |
| HOD Approval | Admin approval |

Keep API field names separate from display labels where appropriate.

---

## 14 Do / Do not

### Do

- reuse shared components and tokens
- keep status and ownership visible
- preserve exact Academic Context and TimetableVersion selection
- design dense timetable screens for scanning
- verify layouts at all documented breakpoints

### Do not

- hardcode course/faculty business rules in components
- duplicate backend state machines in the frontend
- create one class row per faculty for a multi-faculty session
- hide important errors inside a toast only
- introduce a second visual token system
- use placeholder content as real timetable data
