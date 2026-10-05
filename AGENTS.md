# AGENTS.md

Repository-wide instructions for any AI coding agent (Claude Code, Cursor,
Codex, Copilot) working on the **NEC Timetable Web App**.

This is a **full-stack** product with two owners:

| Domain | Owner | Code | Documentation |
| --- | --- | --- | --- |
| Frontend | **Rohith** | `web/` | `docs/frontend/` |
| Backend | **Ragul** | `backend/` | `docs/backend/` |

Read this file, identify the task's owner, then read that owner's `AGENTS.md`.

---

## 01 Identify the task before acting

```text
About web/src, pages, components, routes, UI, styling
    -> FRONTEND    -> read docs/frontend/AGENTS.md and the docs/frontend/ set

About backend/src, routes, controllers, services, models, database,
API contracts, solver, or tests in backend/tests
    -> BACKEND     -> read docs/backend/AGENTS.md and the docs/backend/ set

Changes both sides (an API contract AND its consumers)
    -> CROSS-STACK -> read BOTH sets, plus backend/API.md
```

If you cannot classify the task, ask before editing.

---

## 02 Document hierarchy

```text
                     ROOT AGENTS.md
                           |
                 identify task ownership
                           |
       +-------------------+-------------------+
       |                                       |
   FRONTEND                                 BACKEND
       |                                       |
 docs/frontend/                          docs/backend/
   AGENTS.md          <-- read order -->     AGENTS.md
   PRD.md                                  PRD.md
   DESIGN_SYSTEM.md                       DESIGN_SYSTEM.md
   ARCHITECTURE.md                        ARCHITECTURE.md
```

For cross-stack work:

```text
root AGENTS.md
    -> read the docs/frontend/ set AND the docs/backend/ set
    -> inspect the API contract (backend/API.md)
    -> inspect the frontend consumers (web/src/services)
    -> implement a coordinated change
```

---

## 03 Never mix the document types

`docs/frontend/DESIGN_SYSTEM.md` is a **visual** system: colors, typography,
spacing, components, layout, breakpoints, responsive behavior, accessibility.

`docs/backend/DESIGN_SYSTEM.md` is an **API** contract: vocabulary, canonical
identifiers, response shapes, validation codes, business-state semantics,
timetable session semantics, public schedule semantics, API conventions.

These are different documents. Do not merge them, and do not replace one with
the other.

The same separation applies to `PRD.md` (frontend = UX, screens, workflows;
backend = domain rules, API behavior, governance) and `ARCHITECTURE.md`
(frontend = React app structure; backend = Express, controllers, services,
models, solver, database).

---

## 04 Ownership boundaries

- Do not change the other owner's domain unnecessarily.
- A backend change that alters an API contract must state the required frontend
  follow-up. It must not be silently applied to `web/`.
- A frontend change must not become a second authoritative business-rule engine.
  The backend is authoritative for course applicability, faculty eligibility,
  allocation policy, Academic Context ownership, timetable/version consistency,
  approval state, publication state, and solver constraints.
- Do not move, merge, or rewrite the other owner's documents.

---

## 05 Inspect before you modify

For every task:

1. Read the owner-specific `AGENTS.md` for the task's domain.
2. Read the real source files you are about to change.
3. Read the real tests that cover them.
4. Check `git status` and any existing modifications.

Never claim a file or test was inspected unless it actually was.

## 06 Repository-wide stack constraint

**JavaScript only.** Use the existing stacks: React + Webpack (`web/`), and
Node.js + Express.js + CommonJS + MongoDB + Mongoose (`backend/`).

Do not introduce TypeScript, `.ts`, `.tsx`, Vite, Angular, a second backend
framework, or a replacement ODM.

> Note: an earlier template version of this file stated "TypeScript strict".
> That was unfilled placeholder text and contradicts the JavaScript-only rule
> defined in `docs/backend/AGENTS.md`. The JavaScript-only rule is correct.

---

## 07 General rules

- Follow the owner's design system. If a value is not in that owner's
  `DESIGN_SYSTEM.md`, ask. Do not invent it.
- Keep responsibilities where that owner's `ARCHITECTURE.md` puts them.
- Reuse before creating. Search for an existing helper or component first.
- Small, focused changes. One task, one branch, one clear diff.
- Do not add dependencies, tables, environment variables, or third-party
  services without asking.
- Do not delete or rewrite working code the task does not require.
- Never "improve" anything listed under intentional decisions in the owning
  domain's `ARCHITECTURE.md`.
- Leave the project runnable after every change.
- Validate every external input before it reaches a service.
- Comments explain why, not what. Delete commented-out code.
- Formatting is the formatter's job. Run it. Do not argue with it.

---

## 08 Security

- Secrets live in environment variables and are read on the server only.
  Never log them, never send them to the client.
- Authorization is checked on every server entry point, not just in the UI.
- Escape and validate everything that comes from a user, a webhook, or a
  third party.
- Rate limit public endpoints. Never trust a client-supplied user id or price.
- No new auth flow, payment path, or data deletion behavior without explicit
  approval.
- If `SECURITY.md` exists in this project, it overrides this section.

---

## 09 Useful commands

```bash
npm install                 install dependencies
npm run dev                 start the dev server
npm run build               production build (must pass before a PR)
npm run lint                lint and syntax check

npm test                    full test chain
npm run test:timetable      authoritative timetable logic
npm run test:rbac           TC RBAC enforcement
npm run test:context        version/context anchor integrity
npm run test:generation     TC timetable generation
npm run test:review         TC review and submission
npm run test:approval       HOD approval, rejection, publication
```

If a command fails, report the exact output. Do not work around it silently.

---

## 10 Definition of done

- The change does what the task asked, and nothing else.
- Build, lint, and relevant tests pass locally.
- New UI matches `docs/frontend/DESIGN_SYSTEM.md` and works at 375px wide.
- Docs are updated if a structure, decision, or component changed.
- The summary says what changed, what was not done, and what the owner should
  check.

---

## 11 When to stop and ask

Stop and ask instead of guessing when:

- The task conflicts with the owning domain's PRD, design system, or an
  architectural boundary.
- Two reasonable readings of the task lead to different work.
- The change needs a new dependency, table, secret, or service.
- Something is broken that the task did not mention.

Ask with the specific question, the options you see, and your recommendation.
