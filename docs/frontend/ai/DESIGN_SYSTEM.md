# Design System: NEC Timetable Web Application — Frontend

> Revision: 2026-10-03
>
> This document describes the visual language to preserve and the UI rules to follow. Live token values and component implementations must be verified in the current application before introducing new values or variants.

## 01 Brand identity

- Personality: professional, precise, institutional
- Tone in UI copy: concise, factual, action-oriented; no decorative or exaggerated wording
- Feel: structured, information-dense but readable, trustworthy, responsive
- Visual reference: the existing NEC Timetable Web App UI, with the current HOD Faculty Allocation screen as the baseline

### Screenshot baseline rule

The current HOD Faculty Allocation UI is the visual baseline for incremental frontend changes.

```text
CURRENT UI / SCREENSHOT
       ↓
PRESERVE EXISTING SHELL / NAVIGATION / TABLE / FILTERS
       ↓
CHANGE ONLY THE CONTROLS AND STATES REQUIRED BY THE APPROVED FEATURE
```

Do not replace the current page with a new design system or a second page.

## 02 Color and semantic tokens

Use the project's existing CSS tokens/theme variables first. Do not invent raw feature-specific colors when an existing semantic token can express the same meaning.

The current timetable UI already uses semantic token patterns such as:

```text
--color-primary
--color-warning
--color-outline
--color-outline-variant
--color-on-surface
--color-on-surface-variant
--color-surface
--color-surface-container
--color-surface-container-low
--color-surface-container-lowest
--color-border-subtle
```

The authoritative token definitions live in the application's stylesheet/theme. The list above is a usage guide, not a promise to create missing tokens.

### Semantic usage

| Semantic role | Use |
| --- | --- |
| Background | Main application/content background |
| Surface | Cards, panels, table surfaces |
| Border | Dividers, table lines, control borders |
| Primary | Primary actions, links, active controls |
| Success | Approved / completed / published states |
| Warning | Incomplete / requires-action states |
| Danger / Error | Destructive actions and validation errors |
| Muted / Outline | Secondary metadata, placeholders, disabled/context information |
| Sidebar | Institutional navigation surface |

### Rules

- Prefer existing project tokens over adding new tokens.
- State colors communicate meaning, not decoration.
- Do not hardcode a new hex value inside a feature component when an existing token can express the same semantic purpose.
- Maintain accessible contrast.
- Preserve the established dark-sidebar/light-content hierarchy.
- When a needed semantic token is not present, inspect the current theme before adding anything.

## 03 Typography

Use the font family already configured in the web application.

### Hierarchy

| Role | Use |
| --- | --- |
| Page title | Main portal/page headings |
| Section title | Context cards and major sections |
| Body | Main explanatory copy and data |
| Small / metadata | Course category, faculty ID, supporting context |
| Label / eyebrow | Selector labels, status badges, compact metadata |
| Code | Course codes or technical identifiers when the existing UI treats them as code-like |

### Rules

- Preserve the current page's hierarchy and rhythm.
- Use weight and spacing differences before introducing additional font sizes.
- Course code must remain visually distinct from course title.
- Faculty name is primary information; faculty ID is secondary information.
- Do not make business/status text decorative.

## 04 Spacing

Use the existing project spacing variables/utilities where present.

Preferred working scale:

```text
4px
8px
12px
16px
24px
32px
48px
```

### Rules

- Keep card, table, selector, and action spacing consistent with nearby existing components.
- Avoid cramped LAB/MC faculty controls.
- Avoid arbitrary one-off spacing values when an existing project value fits.
- On mobile, vertical spacing may compress while preserving touch targets and readability.

## 05 Layout

The established product structure is:

```text
Application Shell
├── Sidebar
├── Main Content
│   ├── Breadcrumb / Page Header
│   ├── Academic Context Controls
│   ├── Context Summary
│   └── Primary Page Content
└── Responsive behavior
```

### HOD Faculty Allocation page

Preserve:

- Sidebar/navigation
- Breadcrumb
- Page title
- Authority badge
- Description
- Refresh action
- Academic Year controls
- Curriculum Semester controls
- Section controls
- Context summary card
- Allocation table

LAB/MC allocation must fit into this existing structure.

## 06 Components and variants

Reuse existing project components before creating new ones.

### Known allocation components

```text
FacultyAllocationPage
AcademicContextSelector
AllocationSummary
FacultyAllocationTable
TheoryAllocationRow
LabAllocationRow
McAllocationRow
```

Possible semantic field specializations:

```text
LabAllocationFields
SasAllocationFields
IndianConstitutionAllocationFields
InductionAllocationFields
```

Create a new component only when an existing component cannot cleanly express the requirement.

### Current button hierarchy

The existing `Button` component supports these variants:

```text
primary
secondary
outline
subtle
danger
```

Use the existing variant that matches the action. Do not create a new visual variant without a product-level reason.

Button semantics:

- Primary: main action for the current step.
- Secondary/Outline: supporting or alternative actions.
- Subtle: low-emphasis actions.
- Danger: destructive action.

Do not impose an arbitrary limit on how many primary-looking actions may appear on a complex workflow screen; use the existing hierarchy and the actual workflow.

### Inputs and selects

- Labels remain visible.
- Required fields are clearly marked.
- Known validation errors identify the exact unmet rule.
- Disabled/locked values explain why they cannot be edited.
- Dropdown options come from backend data.

For faculty assignment:

```text
Primary / Theory-linked Faculty
Additional Faculty *
Optional 3rd Faculty
```

For SAS:

```text
Maths / BME Faculty *
English Faculty *
```

Do not collapse semantic roles into generic `Faculty 1 / Faculty 2 / Faculty 3`.

### Status badges

The existing `Badge` component supports:

```text
primary
secondary
success
warning
error
neutral
theory
lab
elective
```

Use the existing business semantics. Do not invent a visually different badge family.

Relevant business states may include:

```text
APPROVED
UNALLOCATED
INCOMPLETE
REQUIRES HOD DECISION
READY FOR GENERATION
GENERATED
PENDING_HOD_APPROVAL
APPROVED
REJECTED
PUBLISHED
```

Use backend-provided state where available.

### Empty states

An empty timetable is not automatically an empty academic context.

Example:

```text
Academic Context exists
Curriculum loaded
HOD allocation complete
No timetable generated yet

→ show an actionable workflow state
```

Never render a generic `No data found` as the only explanation for a valid context.

## 07 HOD Faculty Allocation visual rules

### Theory

Keep the current one-faculty presentation.

```text
HOD-Assigned Faculty
Faculty name
Faculty ID / type
Status
Action
```

### LAB

Show:

```text
Primary / Theory Faculty
[locked / theory-linked]

Additional Faculty *
[select]

Optional 3rd Faculty
[select]

Minimum: 2
Maximum: 3
```

The primary faculty must communicate that it is linked/authoritative.

### MC — SAS

Show:

```text
Maths / BME Faculty *
[select]

English Faculty *
[select]
```

### MC — Indian Constitution

Show:

```text
Respective Department Faculty *
[select]
```

The backend determines the eligible faculty pool.

### MC — Induction Programme

Show:

```text
Optional Faculty
[select]

Map to Timetable
[on/off]
```

Do not force assignment or timetable mapping when the activity is optional.

## 08 Responsive validation widths

Required validation widths:

```text
360px
390px
430px
768px
1024px
1280px
1366px
1600px
1920px
```

These are **validation targets**, not automatically CSS breakpoints. Use the application's existing responsive implementation and add CSS breakpoints only when the current layout needs them.

### Expected behavior

| Width | Expected behavior |
| --- | --- |
| 360–430 | Stacked mobile controls; no clipped actions; required fields remain visible |
| 768 | Tablet layout; allocation controls remain usable |
| 1024 | Preserve the application's existing sidebar/layout transition |
| 1280+ | Full desktop table/layout where supported |
| 1366+ | Comfortable table and context-control spacing |
| 1600+ | Avoid excessive stretching of dense content |
| 1920 | Preserve readable alignment/max-width behavior |

### Mobile LAB example

```text
Course

Primary / Theory Faculty
[ Faculty ]

Additional Faculty *
[ Faculty ]

Optional 3rd Faculty
[ Faculty ]

[ Save Assignment ]
```

Rules:

- Touch targets must remain usable.
- No accidental page-wide horizontal overflow.
- Existing table-specific scrolling behavior may be retained where already established.
- Do not hide critical allocation controls on mobile.
- Do not reduce text to an unreadable size to force desktop content into mobile width.

## 09 Accessibility

- Keyboard navigation must work for all selectors and actions.
- Focus states must be visible.
- Form errors must be associated with the relevant control where the component architecture supports this.
- Required controls must be programmatically identifiable.
- Do not use color alone to communicate allocation or workflow state.
- Buttons must have descriptive text.
- Icon-only actions require an accessible label.
- Lock/disabled states must remain understandable to assistive technology.
- Preserve accessible semantics when reusing or extending shared components.

## 10 Motion

Keep motion minimal and consistent with the existing application.

- Use existing transition utilities/tokens where present.
- Respect reduced-motion preferences.
- Do not animate dense data tables excessively.
- Do not add animation solely for decoration.
- New motion should not be introduced when the existing component already provides the expected behavior.
