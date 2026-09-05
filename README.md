# G Management — Voter Management System

A full-stack MERN application for managing voter registration, payment collection, and leader tracking with real-time dashboard updates.

---

## Table of Contents

- [Recent Changes](#recent-changes)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [User Roles](#user-roles)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Frontend Routes](#frontend-routes)
- [Data Models](#data-models)
- [Real-Time Dashboard](#real-time-dashboard)

---

## Recent Changes

> Last updated: **2026-06-01** — use this section to track where you left off.

### Session — 2026-06-01

#### Completed

- **`AddUser.jsx`** — Fixed frontend: corrected page title (was "Login"), added exported `action` for form submission (was missing — caused silent failure), added `redirect` import, cleaned up role filtering with `.filter()` instead of confusing array destructuring, added "← Back" link to `/moderator`.
- **`Leaders.jsx`** — Added an "Add User" link button next to "Add Leader" that navigates to `/moderator/add-user`.
- **`socket.js`** _(new)_ — Created a singleton Socket.IO module (`initSocket` / `getIO`) at the project root to avoid circular imports.
- **`server.js`** — Wrapped Express in `http.createServer`, attached Socket.IO, switched `app.listen` → `httpServer.listen` so Socket.IO shares port 5100 with Express.
- **`controllers/voterController.js`** — Extracted `computeStats()` helper; `updateVoterPayment` now emits `stats:update` via Socket.IO after every payment; `getStats` reuses the same helper.
- **`routers/voterRouter.js`** — Added `GET /stats` route (placed before `/:voterId` to prevent param collision); restricted to ADMIN and MODERATOR roles.
- **`client/vite.config.js`** — Added `/socket.io` proxy with `ws: true` so the HTTPS Vite dev server can forward WebSocket connections to the backend without mixed-content errors.
- **`client/src/pages/Dashboard.jsx`** _(new)_ — Real-time dashboard at `/main/dashboard`. Shows: Total Collection (PHP), Paid/Unpaid counts, Active Payors, payment progress bar, per-payor collection breakdown with bar charts, and last 10 recent payments. Connects via Socket.IO (`stats:update` event); displays "● Live" / "○ Connecting…" status.
- **`client/src/components/common/Nav.jsx`** — Added Dashboard and Voters nav links for admin/moderator users.
- **`client/src/App.jsx`** — Registered the dashboard route (`/main/dashboard`) with its loader.
- **`client/src/pages/index.js`** — Exported `Dashboard`.
- **`README.md`** — Rewrote from scratch with full documentation.

#### Next / To-Do

- [ ] _(add your next task here)_

---

## Overview

G Management is a voter registry and payment collection system built for barangay-level operations. It supports multiple user roles — from admins who manage the system, to payors who collect payments in the field using a QR scanner, to encoders who register voters. A live dashboard tracks total collections and per-payor performance in real time via Socket.IO.

---

## Tech Stack

| Layer             | Technology                        |
| ----------------- | --------------------------------- |
| Runtime           | Node.js                           |
| Backend Framework | Express.js                        |
| Database          | MongoDB (Mongoose ODM)            |
| Authentication    | JWT (httpOnly cookies) + bcryptjs |
| Real-time         | Socket.IO                         |
| Frontend          | React 19 + React Router v7        |
| Styling           | Tailwind CSS v4                   |
| Build Tool        | Vite                              |
| QR Codes          | html5-qrcode + qrcode.react       |

---

## Features

- **Role-based access control** — six distinct roles, each with their own protected routes and permitted actions
- **Voter registry** — add, edit, search, filter, and paginate voter records
- **Payment tracking** — payors mark voters as paid via QR scan; each payment is worth PHP 5,000
- **Real-time dashboard** — total collections, paid/unpaid progress, per-payor breakdown, and recent payments update instantly via WebSocket
- **QR code system** — every voter gets a QR code generated from their ID; payors scan it in the field (camera or image upload)
- **Leader management** — promote voters to leader status; track who promoted them
- **User management** — admins create accounts for encoders, payors, observers, and moderators

---

## User Roles

| Role        | Description                   | Key Access            |
| ----------- | ----------------------------- | --------------------- |
| `admin`     | Full system access            | All routes            |
| `moderator` | Manage leaders and users      | `/moderator`, `/main` |
| `encoder`   | Register and update voters    | `/main/voters`        |
| `payor`     | Collect payments in the field | `/payor` (QR scanner) |
| `observer`  | Read-only observer            | Limited access        |
| `user`      | Base role (reserved)          | —                     |

> The first admin account must be seeded directly into the database. All other accounts are created through the Add User form by an admin or moderator.

---

## Prerequisites

- Node.js v18+
- npm v9+
- MongoDB Atlas account (or a local MongoDB instance)

---

## Installation

**1. Clone the repository**

```bash
git clone <repo-url>
cd VOTERS
```

**2. Install backend dependencies**

```bash
npm install
```

**3. Install frontend dependencies**

```bash
cd client
npm install
cd ..
```

Or use the setup script:

```bash
npm run setup-project
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5100
NODE_ENV=development
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=1d
```

| Variable         | Description                                         |
| ---------------- | --------------------------------------------------- |
| `PORT`           | Port the Express server listens on (default `5100`) |
| `NODE_ENV`       | `development` enables morgan request logging        |
| `MONGO_URL`      | MongoDB connection string                           |
| `JWT_SECRET`     | Secret key used to sign and verify JWTs             |
| `JWT_EXPIRES_IN` | JWT token lifetime (e.g. `1d`, `7d`)                |

---

## Running the App

**Development (both server and client simultaneously):**

```bash
npm run dev
```

**Server only:**

```bash
npm run server
```

**Client only:**

```bash
npm run client
```

The backend runs on `http://localhost:5100`.
The Vite dev server runs on `https://localhost:5173` (HTTPS via `@vitejs/plugin-basic-ssl`).

---

## Project Structure

```
VOTERS/
├── server.js                    # Express app entry point
├── socket.js                    # Socket.IO initialisation and getIO() export
├── package.json
├── .env
│
├── controllers/
│   ├── authController.js        # login, logout
│   ├── userController.js        # getCurrentUser, getAllUsers, createUser, getPayor
│   ├── voterController.js       # CRUD voters, updateVoterPayment, getStats
│   └── leaderController.js      # CRUD leaders
│
├── models/
│   ├── userModel.js             # User schema (roles, hashed password)
│   ├── voterModel.js            # Voter schema (payment, barangay, tag, QR)
│   └── leaderModel.js           # Leader schema (voter ref + promotedBy)
│
├── routers/
│   ├── authRouter.js            # POST /login, GET /logout
│   ├── userRouter.js            # GET|POST /users, GET /current-user
│   ├── voterRouter.js           # CRUD /voters, PATCH /voters/:id/payment
│   └── leaderRouter.js          # CRUD /leaders
│
├── middlewares/
│   ├── authMiddleware.js        # authenticateUser, authorizePermission
│   ├── validationMiddleware.js  # express-validator rules for all inputs
│   ├── errorHandlerMiddlewares.js # Global error handler
│   └── multerMiddleware.js      # Image upload (in-memory)
│
├── utils/
│   ├── constants.js             # roles, barangays, tags, paymentStatus enums
│   ├── tokenUtils.js            # createJWT, verifyJWT
│   └── passwordUtils.js         # hashedPassword, comparePassword
│
├── errors/
│   └── customErrors.js          # NotFoundError, BadRequestError, UnauthorizedError, etc.
│
└── client/
    ├── vite.config.js           # Vite + proxy config (/api, /socket.io)
    └── src/
        ├── App.jsx              # React Router configuration
        ├── main.jsx             # React entry point
        │
        ├── pages/
        │   ├── HomeLayout.jsx       # Root layout wrapper
        │   ├── Login.jsx            # Login page + action
        │   ├── MainLayout.jsx       # Authenticated layout (admin/encoder)
        │   ├── Voters.jsx           # Voter registry page + loader + action
        │   ├── Dashboard.jsx        # Real-time stats dashboard + loader
        │   ├── PaymentLayout.jsx    # Payor layout + QR scanner
        │   ├── PayorVoterDetail.jsx # Voter detail + mark as paid + QR download
        │   ├── ModeratorLayout.jsx  # Moderator layout wrapper
        │   ├── Leaders.jsx          # Leaders management page
        │   └── AddUser.jsx          # Create user form + action
        │
        ├── components/
        │   ├── common/
        │   │   ├── Nav.jsx          # Top navigation bar
        │   │   ├── InputField.jsx   # Text/password input with show/hide
        │   │   ├── SelectField.jsx  # Dropdown select
        │   │   └── InfoField.jsx    # Read-only label + value display
        │   ├── wrappers/
        │   │   ├── Card.jsx         # White card container
        │   │   └── Overlay.jsx      # Modal overlay backdrop
        │   ├── voters/
        │   │   ├── AddVoters.jsx    # Add voter modal form
        │   │   └── VoterInfo.jsx    # View/edit voter modal + QR code
        │   └── leaders/
        │       └── AddLeader.jsx    # Promote voter to leader modal
        │
        └── utils/
            ├── customFetch.js       # Axios instance (baseURL: /api/v1)
            └── constant.js          # Frontend action type constants
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Protected routes require a valid JWT stored in the `token` httpOnly cookie.

### Auth — `/api/v1/auth`

| Method | Path      | Auth   | Description                                                |
| ------ | --------- | ------ | ---------------------------------------------------------- |
| `POST` | `/login`  | Public | Login with `userName` + `password`. Returns JWT in cookie. |
| `GET`  | `/logout` | Public | Clears the auth cookie.                                    |

### Users — `/api/v1/users`

| Method | Path            | Roles            | Description                                                                                          |
| ------ | --------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`  | `/current-user` | All              | Get the logged-in user's profile.                                                                    |
| `GET`  | `/payor`        | PAYOR, ADMIN     | Get payor user profile.                                                                              |
| `GET`  | `/moderator`    | MODERATOR, ADMIN | Get moderator user profile.                                                                          |
| `GET`  | `/`             | ADMIN            | List all users.                                                                                      |
| `POST` | `/`             | ADMIN            | Create a new user. Body: `userName`, `firstName`, `lastName`, `password`, `confirmPassword`, `role`. |

### Voters — `/api/v1/voters`

| Method   | Path                | Roles                 | Description                                                                                 |
| -------- | ------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `GET`    | `/stats`            | ADMIN, MODERATOR      | Dashboard stats: paid/unpaid counts, total collection, payor breakdown, recent 10 payments. |
| `GET`    | `/`                 | ENCODER, ADMIN, PAYOR | Paginated voter list. Query params: `search`, `barangay`, `tag`, `page`, `limit`.           |
| `POST`   | `/`                 | ENCODER, ADMIN        | Register a new voter.                                                                       |
| `GET`    | `/:voterId`         | ENCODER, ADMIN, PAYOR | Get a single voter.                                                                         |
| `PATCH`  | `/:voterId`         | ENCODER, ADMIN        | Update voter fields.                                                                        |
| `DELETE` | `/:voterId`         | ENCODER, ADMIN        | Delete a voter.                                                                             |
| `PATCH`  | `/:voterId/payment` | PAYOR                 | Mark voter as paid. Sets `payor`, `paymentDate`, emits `stats:update` via Socket.IO.        |

### Leaders — `/api/v1/leaders`

| Method   | Path         | Roles             | Description                                           |
| -------- | ------------ | ----------------- | ----------------------------------------------------- |
| `GET`    | `/`          | All authenticated | List all leaders with voter and promoter details.     |
| `POST`   | `/`          | ADMIN, MODERATOR  | Promote a voter to leader. Body: `leader` (voter ID). |
| `GET`    | `/:leaderId` | All authenticated | Get a single leader.                                  |
| `DELETE` | `/:leaderId` | ADMIN, MODERATOR  | Remove leader designation.                            |

---

## Frontend Routes

| Path                     | Layout          | Roles             | Description                                |
| ------------------------ | --------------- | ----------------- | ------------------------------------------ |
| `/login`                 | HomeLayout      | Public            | Login form                                 |
| `/main/voters`           | MainLayout      | All authenticated | Voter registry — search, filter, add, edit |
| `/main/dashboard`        | MainLayout      | ADMIN, MODERATOR  | Real-time stats dashboard                  |
| `/payor`                 | PaymentLayout   | PAYOR             | QR code scanner (camera + image upload)    |
| `/payor/voters/:voterId` | PaymentLayout   | PAYOR             | Voter detail + mark as paid + download QR  |
| `/moderator`             | ModeratorLayout | MODERATOR, ADMIN  | Leaders list                               |
| `/moderator/add-user`    | ModeratorLayout | MODERATOR, ADMIN  | Create new user form                       |

---

## Data Models

### User

```js
{
  userName:  String,             // unique login name
  firstName: String,
  lastName:  String,
  password:  String,             // bcrypt hashed, excluded from toJSON()
  role:      String,             // admin | moderator | user | encoder | observer | payor
  createdAt: Date,
  updatedAt: Date
}
```

### Voter

```js
{
  cluster:       Number,
  precint:       String,
  fullName:      String,
  address:       String,
  barangay:      String,         // borol 1st | borol 2nd | dalig | pulong gubat | wawa | san juan | longos | panginay | santol
  tag:           String,         // unknown | green | blue  (default: unknown)
  birthDate:     Date,
  contactNumber: String,         // must be 11 digits
  referredBy:    ObjectId,       // → Voter (optional, referral chain)
  encodedBy:     ObjectId,       // → User (who registered this voter)
  payor:         ObjectId,       // → User (who collected payment)
  paymentStatus: String,         // paid | unpaid  (default: unpaid)
  paymentDate:   Date,
  createdAt:     Date,
  updatedAt:     Date
}
```

### Leader

```js
{
  leader:     ObjectId,          // → Voter
  promotedBy: ObjectId,          // → User
  createdAt:  Date,
  updatedAt:  Date
}
```

---

## Real-Time Dashboard

The dashboard at `/main/dashboard` uses Socket.IO for push updates rather than polling.

**How it works:**

1. When a payor marks a voter as paid (`PATCH /api/v1/voters/:id/payment`), the server immediately recomputes the full stats object and broadcasts it to all connected clients via the `stats:update` event.
2. The Dashboard component connects to the Socket.IO server on mount and listens for `stats:update`. When the event fires, React state is updated and the UI re-renders instantly — no page refresh or manual polling needed.
3. The Vite dev server proxies `/socket.io` to the backend with WebSocket support enabled, so the HTTPS dev environment works without mixed-content errors.

**Dashboard stats include:**

| Stat                | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| Total Collection    | `paidCount × PHP 5,000`                                      |
| Paid Voters         | Count of voters with `paymentStatus: paid`                   |
| Unpaid Voters       | Count of voters with `paymentStatus: unpaid`                 |
| Active Payors       | Number of distinct payors with at least one collection       |
| Payment Progress    | Visual progress bar (paid ÷ total)                           |
| Collection by Payor | Per-payor collection breakdown with amounts and bar chart    |
| Recent Payments     | Last 10 paid voters with payor name, barangay, and timestamp |

The connection status indicator in the top-right of the dashboard shows **● Live** when connected and **○ Connecting…** during reconnection.

Attorney Promdi

#DOLE formula sa computation ng #premiumpayment para sa TRABAHO na ginawa ng empleyado
Ordinary day 1 or 100%
Sunday or rest day 1.3 or 130%
Special (non-working) day 1.3 or 130%
Special (non-working) day falling on rest
day 1.5 or 150%
Double special (non-working) day 1.5 or 150%
Double special (non-working) day falling
on rest day 1.95 or 195%
Regular holiday 2 or 200%
Regular holiday falling on rest day 2.6 or 260%
Double regular holiday 3 or 300%
Double regular holiday falling on rest day 3.9 or 390%
Ordinary day, night shift 1 x 1.1 = 1.1 or 110%
Rest day, night shift 1.3 x 1.1 = 1.43 or 143%
Special (non-working) day, night shift 1.3 x 1.1 = 1.43 or 143%
Special (non-working) day, rest day, night
shift 1.5 x 1.1 = 1.65 or 165%
Double special (non-working) day, night
shift 1.5 x 1.1 = 1.65 or 165%
Double special (non-working) day, rest
day, night shift 1.95 x 1.1 = 2.145 or 214.5%
Regular holiday, night shift 2 x 1.1 = 2.2 or 220%
Regular holiday, rest day, night shift 2.6 x 1.1 = 2.86 or 286%
Double holiday, night shift 3 x 1.1 = 3.3 or 330%
Double holiday, rest day, night shift 3.9 x 1.1 = 4.29 or 429%
Ordinary day, overtime (OT) 1 x 1.25 = 1.25 or 125%
Rest day, OT 1.3 x 1.3 = 1.69 or 169%
Special (non-working), OT 1.3 x 1.3 = 1.69 or 169%
Special (non-working) day, rest day, OT 1.5 x 1.3 = 1.95 or 195%
Double special (non-working) day, OT 1.5 x 1.3 = 1.95 or 195%
Double special (non-working) day, rest
day, OT 1.95 x 1.3 = 2.535 or 253.5%
Regular holiday, OT 2 x 1.3 = 2.6 or 260%
Regular holiday, rest day, OT 2.6 x 1.3 = 3.38 or 338%
Double holiday, OT 3 x 1.3 = 3.9 or 390%
Double holiday, rest day, OT 3.9 x 1.3 = 5.07 or 507%
Ordinary day, night shift, OT 1 x 1.1 x 1.25 = 1.375 or 137.5%
Rest day, night shift, OT 1.3 x 1.1 x 1.3 = 1.859 or 185.9%
Special (non-working) day, night shift, OT 1.3 x 1.1 x 1.3 = 1.859 or 185.9%
Special (non-working) day, rest day, night
shift, OT 1.5 x 1.1 x 1.3 = 2.145 or 214.5%
Double special (non-working) day, night
shift, OT 1.5 x 1.1 x 1.3 = 2.145 or 214.5%
Double special (non-working) day, rest
day, night shift, OT 1.95 x 1.1 x 1.3 = 2.7885 or 278.85%
Regular holiday, night shift, OT 2 x 1.1 x 1.3 = 2.86 or 286%
Reg. holiday, rest day, night shift, OT 2.6 x 1.1 x 1.3 = 3.718 or 371.8%
Double holiday, night shift, OT 3 x 1.1 x 1.3 = 4.29 or 429%
Double holiday, rest day, night shift, OT 3.9 x 1.1 x 1.3 = 5.577 or 557.7%
# payroll
