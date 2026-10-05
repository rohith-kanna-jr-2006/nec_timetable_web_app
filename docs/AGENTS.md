# AGENTS.md — Frontend (NEC Timetable Web App)

Owner: **Rohith**.
Applies to: the React web frontend in `web/`.

This file routes an agent to the correct frontend documentation. It does not
restate the content of those documents.

---

## 01. Read order for frontend work

```text
1. docs/frontend/AGENTS.md      (this file — routing only)
2. docs/frontend/PRD.md
3. docs/frontend/DESIGN_SYSTEM.md
4. docs/frontend/ARCHITECTURE.md
5. The actual source in web/ (pages, components, services, routes)
6. The actual tests in web/tests/
```

Never claim a file was inspected unless it actually was.

---

## 02. Frontend scope

```text
web/src/pages        Screens and routes
web/src/components   Reusable UI
web/src/routes       Route table
web/src/services     HTTP calls to the backend API
web/src/context      Frontend state
web/src/styles       Styling and design tokens
web/src/constants    Shared frontend constants
```

The frontend talks to the backend over HTTP/JSON only. It must not open a
database connection, read backend models directly, or reimplement a backend
business rule as an authoritative second engine.

---

## 03. Backend-owned rules

The backend is authoritative for course applicability, faculty eligibility,
allocation policy, Academic Context ownership, timetable/version consistency,
approval state, publication state, and solver constraints.

When the frontend needs one of those answers, read:

- `docs/backend/DESIGN_SYSTEM.md` — API vocabulary, canonical identifiers,
  response shapes, validation codes, business-state semantics.
- `docs/backend/PRD.md` — domain rules and governance.
- `docs/backend/ARCHITECTURE.md` — what the API guarantees.

Frontend validation may be convenient, but it is never authoritative.

---

## 04. Stack constraints

Use what already exists in `web/`: **React + JavaScript + the existing Webpack
setup**.

Do not introduce:

- TypeScript, `.ts`, or `.tsx`
- Vite or a replacement bundler
- Angular or a second UI framework
- a new state/data framework without explicit approval

This JavaScript-only rule is repository-wide. See the root `AGENTS.md`.

---

## 05. Existing frontend documents

These were authored for the frontend and are preserved as-is:

| File | Purpose |
| --- | --- |
| `docs/frontend/PRD.md` | Product requirements |
| `docs/frontend/DESIGN_SYSTEM.md` | Visual design system |
| `docs/frontend/ARCHITECTURE.md` | Application architecture |
| `docs/frontend/development.md` | Development and execution guide |
| `docs/frontend/hod-implementation.md` | HOD interface specification |
| `docs/frontend/hod-stitch-screen-map.md` | HOD screen map |
| `docs/frontend/stitch-screen-map.md` | Stitch screen mapping |
| `docs/frontend/stitch-implementation-audit.md` | Visual fidelity audit |

Do not merge these with the backend documents. `docs/frontend/DESIGN_SYSTEM.md`
is a visual system; `docs/backend/DESIGN_SYSTEM.md` is an API contract. They are
different documents and stay separate.

---

## 06. Known gaps in the frontend docs

Do not silently "fix" these. Raise them with the frontend owner.

- `docs/frontend/PRD.md` and `docs/frontend/DESIGN_SYSTEM.md` are still
  **unfilled templates** — they contain placeholder text such as
  `[Product name]` and no real values.
- `docs/frontend/ARCHITECTURE.md`, `development.md`, and the HOD/Stitch
  documents describe a **React Native / Expo Router mobile app** (`app/`,
  `expo`, `StyleSheet`). The code that actually ships in this repository is a
  **React + Webpack web app** (`web/src/pages`, `web/src/routes`,
  `web/webpack.config.js`). Confirm the intended target before relying on them
  for structure.

---

## 07. Before finishing

- Inspect the real source, not only the docs.
- Keep the change inside the frontend unless the task is cross-stack.
- Do not modify backend source or backend docs for a frontend-only task.
- Report what changed, what did not, and what the frontend owner should check.