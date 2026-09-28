# Contributing to NEC Faculty Timetable

Thank you for your interest in contributing to the **NEC Faculty Timetable Mobile Application & Backend API**! This document provides guidelines and instructions for contributing to this project.

---

## Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nec-faculty-timetable.git
   cd nec-faculty-timetable
   ```
3. **Install Dependencies**:
   - Mobile app: `npm install`
   - Backend API: `cd backend && npm install && cd ..`
4. **Create a new branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

---

## Development Standards

### 1. Mobile Application (React Native / Expo)
- **Framework**: Expo SDK 57 with Expo Router v57.
- **Language**: Pure JavaScript (ES6+ / JSX) — do not introduce TypeScript files unless migrating the whole repository.
- **Styling**: Use React Native `StyleSheet.create` adhering to design tokens in [`constants/theme.js`](constants/theme.js). No external Tailwind/Web CSS.
- **Architecture**: Do not mutate master data structures directly; maintain single source of truth conventions.

### 2. Backend API (Node.js / Express / MongoDB)
- **Architecture**: Domain-driven MVC pattern (`models/`, `controllers/`, `routes/`, `middlewares/`).
- **Database**: Mongoose schemas with strict field definitions and validation.
- **Security**: Strict JWT authentication with Role-Based Access Control (`HOD`, `AC`, `FACULTY`).
- **Testing**: All API additions or changes must include automated integration tests in `backend/tests/`.

---

## Commit Guidelines

We recommend following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation changes
- `style:` Formatting or design token changes
- `refactor:` Code restructuring without functional alterations
- `test:` Adding or updating tests
- `chore:` Maintenance or build tasks

*Example:* `feat(mobile): add hero next class indicator on faculty dashboard`

---

## Submitting a Pull Request

1. Run the test suite:
   ```bash
   cd backend && npm test
   ```
2. Verify Expo doctor diagnostics:
   ```bash
   npx expo-doctor
   ```
3. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request targeting `main`. Fill in all sections of the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
5. Address any review comments or CI check requirements.
