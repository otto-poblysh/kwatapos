# Phase 6: Customer Portal & Daily Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide end-of-day financial visibility to the business owner and credit transparency to the customers.

**Architecture:** 
- **Customer Portal**: We will introduce a lightweight authentication system for customers using their phone number and a 4-digit PIN. This will issue a limited JWT allowing them to view their own balance and history.
- **Reconciliation Dashboard**: We will add a new analytics endpoint that aggregates daily sales, payment methods, and expenses for the Super Admin.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router), PostgreSQL.

## Visible Tangible Outcomes
1. **Database:** Update `customers` table to include a `pin_hash`.
2. **Backend API:** `/api/auth/customer` (Login), `/api/customer/me` (Balance/History), and `/api/reports/daily` (Admin Aggregation).
3. **Frontend UI (Customer):** A new mobile-friendly web login and portal showing their current debt and past transactions.
4. **Frontend UI (Super Admin):** An "End of Shift" dashboard aggregating today's cash, transfers, and expenses.

---

## User Acceptance Testing (UAT) Contract

### 1. Customer Login & Portal UAT
- **Action:** A customer visits the customer login route on their phone, enters their phone number and PIN.
- **Expected Outcome:** They are successfully authenticated and see a dashboard showing their "Total Outstanding Balance" and a list of their past credit orders.
- **Evidence Required:** Screenshot of the Customer Portal dashboard.

### 2. Daily Reconciliation UAT
- **Action:** The Super Admin logs in and navigates to the "Daily Report" tab.
- **Expected Outcome:** The dashboard displays the total sales for the day, broken down by payment method (Cash, Transfer, Card, Credit), and deducts today's direct expenses to show the "Expected Cash in Drawer".
- **Evidence Required:** Screenshot of the Super Admin Daily Reconciliation dashboard.

---

### Task 0: Phase 5 Review & Cleanup

*Note: Phase 5 implementation was excellent. Empty states were implemented exactly as designed, native sharing works, and expenses use the image picker. No cleanup is required.*

- [ ] **Step 1: Verify Phase 5 Baseline**
Ensure `cargo test` and `npm run test` still pass before beginning Phase 6.

---

### Task 1: Database Updates & Migrations

**Files:**
- Create: `backend/migrations/0009_add_pin_to_customers.sql`

- [ ] **Step 1: Write Migration Files**
Update `customers` table: Add `pin_hash` (VARCHAR). For existing records, set a default hashed PIN (e.g., '0000').
- [ ] **Step 2: Run Migrations**
Run `sqlx migrate run`.
- [ ] **Step 3: Update Customer Repository**
Modify customer creation logic to accept and hash a 4-digit PIN. Update the `/api/customers` POST endpoint to require a PIN when creating a customer.
- [ ] **Step 4: Commit**
`git commit -m "feat: add PIN authentication support for customers"`

---

### Task 2: Backend APIs (TDD)

**Files:**
- Modify: `backend/src/features/auth/controller.rs`
- Create: `backend/src/features/reports/mod.rs` (Service, Controller)
- Create: `backend/tests/reports_test.rs`

- [ ] **Step 1: RED - Write the failing tests**
Write tests asserting that a customer can login with phone/PIN and get a JWT. Write tests asserting that `GET /api/reports/daily` returns expected aggregated totals.
- [ ] **Step 2: GREEN - Implement Customer Auth**
Create `POST /api/auth/customer` that verifies the PIN and issues a JWT with `role: "customer"`. Create `GET /api/customer/me` that returns the authenticated customer's details and their `credits` history.
- [ ] **Step 3: GREEN - Implement Daily Reports API**
Create `GET /api/reports/daily`. Use SQL `SUM()` and `GROUP BY` to aggregate today's `orders` by `payment_method`, and today's approved `direct_expenses`. Calculate `expected_cash_drawer = (total_cash_sales - total_cash_expenses)`.
- [ ] **Step 4: REFACTOR & Verify**
Run `cargo test`.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement customer auth and daily reconciliation APIs"`

---

### Task 3: Frontend Customer Portal

**Files:**
- Create: `frontend/src/app/customer/login.tsx`
- Create: `frontend/src/app/customer/dashboard.tsx`
- Modify: `frontend/src/core/context/AuthContext.tsx`

- [ ] **Step 1: Update Auth Context**
Ensure the context supports the `customer` role and redirects appropriately upon login.
- [ ] **Step 2: Build Customer Login**
Create a clean, flat-design login screen asking for Phone Number and PIN.
- [ ] **Step 3: Build Customer Dashboard**
Create a read-only view displaying the massive "Total Owed" prominently, followed by a list of past credit orders with dates.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement frontend customer portal"`

---

### Task 4: Frontend Super Admin Reconciliation

**Files:**
- Create: `frontend/src/app/(admin)/reports.tsx`

- [ ] **Step 1: Build the Reports Dashboard**
Create a dashboard specifically for the Super Admin. Fetch data from `/api/reports/daily`.
- [ ] **Step 2: Implement Financial Summary Cards**
Display large, high-contrast cards for "Total Sales", "Expected Cash in Drawer", "Credit Issued Today", and "Direct Expenses".
- [ ] **Step 3: Capture UAT Screenshots**
Run the simulator. Capture the Customer Portal login, the Customer Dashboard, and the Super Admin Reports Dashboard.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement super admin daily reconciliation dashboard"`
