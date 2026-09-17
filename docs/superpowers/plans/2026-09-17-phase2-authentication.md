# Phase 2: Authentication & User Management Implementation Plan

> **Local DB (supersedes `.env` URL below):** `DATABASE_URL=postgres://akamaotto@127.0.0.1:5432/kwatapos`. Do not recreate Docker Postgres on `5432`.
>
> **Local HTTP (supersedes ports below):** Expo web `3011`, API `3014`. Kwata range is 3011–3020.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the application by implementing role-based JWT authentication, a React Native login screen, and protected routing logic.

**Architecture:** We are continuing with the Feature-First DDD structure. The `auth` feature directory in both the backend and frontend will encapsulate all user management, token generation, and login UI. 

**Tech Stack:** Rust (Axum, sqlx, jsonwebtoken, argon2), React Native (Expo Router, SecureStore), PostgreSQL.

## Global Constraints

- Backend API must run on port `3014`.
- Expo must run web on `3011`.
- Passwords must be hashed using `argon2`.
- Tokens must be JWTs (short-lived access token, long-lived refresh token).

---

## Visible Tangible Outcomes
At the conclusion of this phase, the following deliverables will be completed and functional:
1. **Database:** `users` and `roles` tables exist and are seeded with a default Super Admin.
2. **Backend:** Three operational API endpoints: `/api/auth/login`, `/api/auth/refresh`, and `/api/auth/me`.
3. **Frontend:** A fully styled "Login" screen matching `DESIGN.md`.
4. **Frontend:** A secure routing wrapper that redirects unauthenticated users to the Login screen, and authenticated users to their specific role-based dashboard.

---

## User Acceptance Testing (UAT) Contract

To consider this phase complete, the following tests must pass, **backed by screenshots (using the `argent-screenshot-diff` or `argent-screen-recording` skills)** to prove the contract is fulfilled.

### 1. Sales Staff UAT
- **Action:** Sales Staff enters valid credentials and taps "Login".
- **Expected Outcome:** User is routed to the `(sales)` route group (the POS Dashboard).
- **Evidence Required:** Screenshot showing successful routing to the Sales interface.

### 2. Store Manager UAT
- **Action:** Store Manager enters valid credentials and taps "Login".
- **Expected Outcome:** User is routed to the `(manager)` route group (the Requisitions Dashboard).
- **Evidence Required:** Screenshot showing successful routing to the Manager interface.

### 3. Super Admin UAT
- **Action:** Super Admin enters valid credentials and taps "Login".
- **Expected Outcome:** User is routed to the `(admin)` route group (the Admin Dashboard).
- **Evidence Required:** Screenshot showing successful routing to the Admin interface.

### 4. Security / Edge Case UAT
- **Action:** User enters an incorrect password or unknown email.
- **Expected Outcome:** Login fails. User remains on the Login screen. A clear, highly visible error message is displayed (using the `danger` color from `DESIGN.md`).
- **Evidence Required:** Screenshot of the visual error state on the Login screen.

---

### Task 0: Phase 1 Cleanup & Parity

**Goal:** Ensure the previous phase adheres strictly to TDD and `DESIGN.md` guidelines before moving forward.

**Files:**
- Modify: `frontend/src/app/index.tsx`
- Create: `frontend/src/app/index.test.tsx`
- Create: `backend/.env`
- Modify: `backend/src/main.rs`

- [ ] **Step 1: Fix Frontend Design Parity**
Open `frontend/src/app/index.tsx`. Remove the drop shadow styles (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) from the `card` style block to adhere to the "Flat-By-Default Rule" in `DESIGN.md`. Add a subtle border (`borderWidth: 1, borderColor: '#E5E5EA'`) to maintain definition.
- [ ] **Step 2: Add Missing Frontend TDD Tests**
Create `frontend/src/app/index.test.tsx`. Write a test using Jest and `@testing-library/react-native` to mount `<Home />` and assert that the `ActivityIndicator` or "Loading..." text is rendered initially.
- [ ] **Step 3: Setup Backend Environment Variables**
Create `backend/.env` containing `DATABASE_URL=postgres://kwata_admin:kwata_password@127.0.0.1:5432/kwatapos`. Modify `backend/src/main.rs` to load `.env` (using the `dotenvy` crate) instead of hardcoding the URL. Update `Cargo.toml` to include `dotenvy = "0.15"`.
- [ ] **Step 4: Commit**
`git commit -am "fix: resolve phase 1 TDD and design parity gaps"`

---

### Task 1: Database Migrations (Users & Roles)

**Files:**
- Create: `backend/migrations/0001_create_users_table.sql`
- Create: `backend/src/features/auth/repository.rs`

- [ ] **Step 1: Write the migration file**
Create a `sqlx` migration that defines `users` (id, email, password_hash, role, created_at).
- [ ] **Step 2: Run the migration**
Use `sqlx db create` and `sqlx migrate run`.
- [ ] **Step 3: Create the Repository**
Write `repository.rs` with a function to fetch a user by email (`find_user_by_email`).
- [ ] **Step 4: Commit**
`git commit -m "feat: setup user database tables"`

---

### Task 2: Backend Auth API (TDD)

**Files:**
- Create: `backend/tests/auth_test.rs`
- Create: `backend/src/features/auth/service.rs`
- Create: `backend/src/features/auth/controller.rs`

- [ ] **Step 1: RED - Write the failing tests**
Write tests in `auth_test.rs` checking that `/api/auth/login` returns a token on success, and a 401 on failure.
- [ ] **Step 2: GREEN - Implement the Auth Service**
Implement password hashing verification (`argon2`) and JWT generation in `service.rs`.
- [ ] **Step 3: GREEN - Implement the Auth Controller**
Implement the Axum routes in `controller.rs` and connect them to the main router.
- [ ] **Step 4: REFACTOR & Verify**
Run `cargo test` to ensure all tests pass.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement JWT auth endpoints"`

---

### Task 3: Frontend Login UI & Routing Protection (TDD)

**Files:**
- Create: `frontend/src/features/auth/components/LoginScreen.tsx`
- Create: `frontend/src/features/auth/components/LoginScreen.test.tsx`
- Create: `frontend/src/core/hooks/useAuth.ts`
- Modify: `frontend/src/app/_layout.tsx`

- [ ] **Step 1: RED - Write the failing UI test**
Write a Jest test in `LoginScreen.test.tsx` asserting that the email input, password input, and login button exist, and that clicking login triggers the API call.
- [ ] **Step 2: GREEN - Implement LoginScreen UI**
Build the UI using the exact design tokens from `DESIGN.md` (e.g., highly rounded inputs, pitch-black primary button).
- [ ] **Step 3: Implement `useAuth` hook & Secure Routing**
Create a Context provider that stores the JWT in Expo SecureStore. Update `_layout.tsx` to conditionally render the `(auth)` group or the protected app groups `(sales, manager, admin)` based on the JWT role.
- [ ] **Step 4: Capture UAT Screenshots**
Run the app in the simulator. Boot up a test user for each role, log in, and capture the screenshots for the UAT contract.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement frontend login and protected routing"`
