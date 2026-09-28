# NEC Faculty Timetable Backend & Database Layer

Production-grade Node.js, Express, and MongoDB backend application supporting the NEC Faculty Timetable & Mobile Application.

## Architecture & Domain Separation

The backend strictly separates operational domains to prevent cross-contamination:

```
                  ┌───────────────────────────────┐
                  │ Faculty Workload Master (28)  │ (Quota / Authoritative Register)
                  └───────────────┬───────────────┘
                                  │ (Reference)
                                  ▼
                  ┌───────────────────────────────┐
                  │ Course Faculty Handlers (AC)  │ (Candidate Handler Pool)
                  └───────────────┬───────────────┘
                                  │ (Input)
                                  ▼
                  ┌───────────────────────────────┐
                  │  HOD Faculty Allocation       │ (Ratified Subject Assignment)
                  └───────────────┬───────────────┘
                                  │
                                  ▼
┌───────────────────────────────┐ │ ┌───────────────────────────────┐
│     Timetable Versions        │─┴─│      Timetable Sessions       │
│  (State Machine & Approval)   │   │   (Day / Period / Room Slots) │
└───────────────────────────────┘   └───────────────────────────────┘
```

- **Faculty Workload Master**: 28-faculty institutional baseline recording weekly contact and responsibility hours. **Never converted into schedule sessions**.
- **Course Faculty Handlers**: AC-nominated candidate teachers per course.
- **HOD Faculty Allocation**: Final ratified binding course-faculty-section allocations. Only HOD has approval authority.
- **Timetable Version & Sessions**: Scheduled slots (`day`, `period`, `room`) strictly separated from workload quotas.

---

## Technology Stack

- **Runtime**: Node.js (v22.x)
- **Framework**: Express.js
- **Database**: MongoDB (v8.x)
- **ODM**: Mongoose (v8.x)
- **Authentication**: JSON Web Tokens (JWT) + bcryptjs
- **Security**: Helmet, CORS, Express Rate Limit
- **Dialect**: Pure JavaScript (CommonJS)

---

## Setup & Running

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default variables:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/nec_faculty_db
JWT_SECRET=nec_faculty_secret_jwt_key_2026_production_grade
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=*
DEV_SEED_PASSWORD=Password123!
```

### 3. Database Seeding

Populate the database with the authoritative 28-faculty workload register, courses, academic contexts, and development user accounts:

```bash
npm run seed
```

Expected Seed Invariants:
- 28 Faculty Records
- 401 Teaching Contact Hours
- 129 Responsibility Hours
- 530 Total Allocated Hours
- 2 Incomplete Source Records (`Mrs. A. Satheesh Kumar`, `Mr. P. Jaishankar`)

### 4. Running the Server

Development mode with hot reload:
```bash
npm run dev
```

Standard start:
```bash
npm start
```

### 5. Automated Testing

Run the test suite covering all 20 verification scenarios:
```bash
npm test
```

---

## Development Accounts

Created via seed script with bcrypt password hashes (Password: `Password123!` or `DEV_SEED_PASSWORD`):

| Role | Email | Faculty ID | Purpose |
|------|-------|------------|---------|
| **HOD** | `hod@nec.edu.in` | `FWL-01` | Full authority, approvals, publications |
| **AC** | `ac@nec.edu.in` | `FWL-22` | Candidate handlers, draft allocation |
| **FACULTY** | `faculty@nec.edu.in` | `FWL-03` | Timetable viewing, absence submission |
| **ADMIN** | `admin@nec.edu.in` | - | System configuration & overrides |

---

## Frontend Connection

The mobile/web Expo frontend connects via `services/api.js`. Configure:

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```
