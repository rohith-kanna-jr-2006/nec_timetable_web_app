# Nandha Engineering College (NEC) — Faculty Timetable & Workload System (Web + Backend)

[![CI Status](https://github.com/rohith-kanna-jr-2006/nec-faculty-timetable/actions/workflows/ci.yml/badge.svg)](https://github.com/rohith-kanna-jr-2006/nec-faculty-timetable/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg?logo=react)](https://react.dev)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg?logo=nodedotjs)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%207.0-brightgreen.svg?logo=mongodb)](https://mongodb.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-fidelity academic timetable and faculty workload management system developed for the **Department of Computer Science & Engineering** at **Nandha Engineering College (Autonomous), Erode**.

This repository contains the standalone desktop-first Web application and the production Node/Express/MongoDB Backend API.

---

## Commands to Run

### Database (MongoDB)
Ensure MongoDB is running locally on port `27017`:
```bash
# Windows
net start MongoDB
```

### Backend API
Runs on **http://localhost:5000** (Health check: `http://localhost:5000/api/health`):
```bash
cd backend
npm run dev
```
*(Alternative for production)*:
```bash
cd backend
npm start
```

### Frontend Web App
Runs on **http://localhost:3002** (proxies `/api` to `http://localhost:5000`):
```bash
cd web
npm run dev
```
*(Alternative)*:
```bash
cd web
npm start
```

### Unified Full-Stack Server (Root)
Builds and serves both the API and frontend SPA:
```bash
npm run dev
```

---

## Architecture & Project Structure

```text
NEC Timetable Web App/
├── web/                           # Desktop-first MERN React Web Application (Rohith)
│   ├── public/                    # Static assets & HTML template
│   ├── src/                       # React components, pages, routes, services
│   │   ├── components/            # Reusable UI components & layouts (AppShell, Sidebar)
│   │   ├── constants/             # Web constants (roles, routes, schedule)
│   │   ├── context/               # AuthContext & state providers
│   │   ├── pages/                 # Role-based pages (auth, faculty, hod, coordinator)
│   │   ├── routes/                # AppRoutes & ProtectedRoute
│   │   ├── services/              # API clients & services
│   │   └── styles/                # Modular CSS styles
│   ├── tests/                     # Frontend integration & workflow test suites
│   ├── package.json               # Web package manifest
│   ├── package-lock.json          # Web locked dependencies
│   └── webpack.config.js          # Webpack 5 build & dev server config
│
├── backend/                       # RESTful Node/Express/MongoDB API (Ragul)
│   ├── src/
│   │   ├── config/                # Database and server config
│   │   ├── constants/             # Backend constants (responsibilityMaster)
│   │   ├── controllers/           # Auth, faculty, workload, timetable, course controllers
│   │   ├── data/                  # Authoritative master datasets (r22Curriculum, workloadMaster)
│   │   ├── middleware/            # Auth JWT & RBAC middlewares
│   │   ├── models/                # Mongoose models (User, Faculty, Workload, Timetable, Course)
│   │   ├── routes/                # Express API routes
│   │   ├── seeds/                 # Comprehensive database seeds
│   │   ├── services/              # Workload, timetable, notification services
│   │   ├── utils/                 # Response handlers and pagination
│   │   ├── validators/            # Faculty, workload, and curriculum validators
│   │   └── server.js              # Server entry point
│   ├── tests/                     # Backend test suites (backend, facultyCreation, r22Curriculum)
│   ├── package.json               # Backend package manifest
│   ├── package-lock.json          # Backend locked dependencies
│   ├── Dockerfile                 # Backend container definition
│   ├── .dockerignore              # Backend docker ignore rules
│   └── .env.example               # Backend environment template
│
├── .agents/                       # Project agent rules & Playwright MCP config
├── .github/                       # GitHub Actions CI workflows & templates
├── .playwright-mcp/               # Playwright testing workspace & artifacts
├── docs/                          # Architecture, curriculum, and workflow documentation
├── scripts/                       # Maintenance scripts
├── docker-compose.yml             # Local multi-container Docker composition
├── .gitignore                     # Git ignore rules for Web + Backend
├── .gitattributes                 # Line-ending and repository attributes
├── LICENSE                        # MIT License
├── CONTRIBUTING.md                # Contribution guidelines
├── CODE_OF_CONDUCT.md             # Code of conduct
└── SECURITY.md                    # Security policy
```

---

## Roles & Ownership

- **Rohith**: Web Frontend (`web/`) — React, UI/UX, pages, layouts, styles, components, frontend API integration.
- **Ragul**: Backend (`backend/`) — Node.js, Express, MongoDB, Mongoose, APIs, RBAC, workload logic, seeds/migrations, Docker, Playwright/E2E testing.

---

## Testing & Build Commands

### Backend Testing & Seeding
```bash
cd backend
npm run seed     # Populate database with master curriculum and faculty data
npm test         # Run all backend test suites
```

### Frontend Build & Testing
```bash
cd web
npm run build    # Production webpack build to web/dist
npm test         # Run frontend test suites
```

### Docker Compose
```bash
docker compose up -d
```
