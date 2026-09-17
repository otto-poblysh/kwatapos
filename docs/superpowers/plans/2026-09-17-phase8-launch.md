# Phase 8: Final Polish, Optimization & Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate the Kwata POS application from a functioning prototype to a production-grade, highly performant, and perfectly styled system ready for real-world deployment.

**Architecture:** This phase touches all layers—database indexing for speed, backend query optimization for scale, frontend styling consistency, and CI/CD configuration for native binaries (EAS Build).

**Tech Stack:** Rust (sqlx), React Native (Expo, EAS).

## Visible Tangible Outcomes
1. **Database:** New indexes accelerating read-heavy queries.
2. **Backend:** Eradication of any N+1 query patterns.
3. **Frontend UI:** 100% parity with `DESIGN.md` across all 5 user surfaces (Admin, Manager, Sales, Customer, Vendor).
4. **DevOps:** A configured `eas.json` file ready to build iOS and Android artifacts.

---

## User Acceptance Testing (UAT) Contract

### 1. Design Parity UAT
- **Action:** Review all primary screens across the app.
- **Expected Outcome:** Zero use of drop shadows. Consistent use of `#000000` for primary buttons. Border radius consistently `24px` for large cards and `9999px` (pill) for buttons.
- **Evidence Required:** A final comprehensive screenshot gallery of the Sales POS, the Requisitions Dashboard, the Customer Portal, and the Admin Daily Report.

### 2. EAS Build Readiness UAT
- **Action:** Run the Expo EAS configuration check.
- **Expected Outcome:** `eas.json` exists and is properly configured for `production` and `preview` profiles.
- **Evidence Required:** The output of `eas build:configure` or the contents of the generated `eas.json`.

---

### Task 0: Phase 6 Review & Cleanup

*Note: Phase 6 implementation was excellent. The "Expected Cash in Drawer" calculation and the dark/accent card styling perfectly respected the `DESIGN.md` guidelines. No cleanup is required.*

- [x] **Step 1: Verify Phase 6 Baseline**
Ensure `cargo test` and `npm run test` still pass before beginning Phase 7.

---

### Task 1: Database Optimization & Indexing

**Files:**
- Create: `backend/migrations/0010_add_performance_indexes.sql`

- [x] **Step 1: Write Migration Files**
Identify lookup bottlenecks. Add indexes for:
  - `orders(status)` and `orders(created_at)` for the daily reconciliation query.
  - `customers(phone_number)` for faster customer login.
  - `requisitions(token)` for the public vendor route.
- [x] **Step 2: Run Migrations**
Run `sqlx migrate run`.
- [x] **Step 3: Commit**
`git commit -m "chore: add database performance indexes"`

---

### Task 2: Backend Query Optimization

**Files:**
- Modify: `backend/src/features/reports/service.rs` (or relevant controllers)
- Modify: `backend/src/features/requisitions/service.rs`

- [x] **Step 1: Audit for N+1 Queries**
Review endpoints that fetch relationships (e.g., fetching a requisition and its items). Ensure `JOIN`s or batch fetches are used instead of looping over records and making a query for each.
- [x] **Step 2: Test Assertions**
Run the test suite to ensure no business logic was broken during the query refactoring.
- [x] **Step 3: Commit**
`git commit -m "perf: optimize backend queries and resolve N+1 issues"`

---

### Task 3: Frontend Design & UX Audit

**Files:**
- Modify: `frontend/src/app/**` (as needed)
- Modify: `frontend/src/features/**/components/**` (as needed)

- [x] **Step 1: Global Shadow Purge**
Search the frontend codebase for `shadowColor`, `shadowOffset`, `elevation`. Remove them entirely. Kwata POS is strictly flat.
- [x] **Step 2: Typography & Rounding Check**
Ensure all interactive cards use `borderRadius: 24` or `16`. Ensure all primary action buttons use `borderRadius: 9999` (pill shape).
- [x] **Step 3: Capture UAT Screenshots**
Take screenshots of the refined UI using the simulator.
- [x] **Step 4: Commit**
`git commit -m "style: finalize design parity with DESIGN.md"`

---

### Task 4: EAS Build Configuration

**Files:**
- Create/Modify: `frontend/eas.json`
- Modify: `frontend/app.json`

- [x] **Step 1: Initialize EAS**
Run `npx eas-cli build:configure` in the `frontend` directory (if not already installed, use `npm install -g eas-cli`).
- [x] **Step 2: Configure Profiles**
Set up a `preview` profile (for simulator builds) and a `production` profile in `eas.json`. Ensure the `app.json` bundle identifiers (e.g., `com.kwata.pos`) are correctly defined.
- [x] **Step 3: Commit**
`git commit -m "chore: configure EAS build for native iOS and Android artifacts"`
