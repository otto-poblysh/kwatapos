# Phase 4: Customer Credit System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Pay Later" flow. This allows sales staff to assign an unpaid order to a specific customer profile via their phone number, ensuring debts are accurately tracked and easily recoverable.

**Architecture:** We are continuing our Feature-First DDD approach. We will introduce a new `customers` feature directory in the backend and frontend. The `credits` functionality will bridge `sales` and `customers`.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router, Zustand, React Native Modal), PostgreSQL.

## Global Constraints
- **STRICT PORT COMPLIANCE:** Backend on `3014`. Expo Web on `3011`, iOS on `3012`, Android on `3013`.
- **UI Design:** The customer selection modal must follow the "Flat-By-Default" rule. Use full-screen or heavily rounded modals without drop shadows.

---

## Visible Tangible Outcomes
At the conclusion of this phase, the following deliverables will be completed and functional:
1. **Database:** `customers` table and `credits` table.
2. **Backend API:** `/api/customers` (search and create) and `/api/orders/credit` (create an order linked to a customer debt).
3. **Frontend UI (Cart):** A new secondary button "Checkout (Credit)" in the Cart Sidebar.
4. **Frontend UI (Modal):** A Customer Search & Add Modal that appears during the credit checkout flow.

---

## User Acceptance Testing (UAT) Contract

To consider this phase complete, the following tests must pass, **backed by screenshots (using `argent-screenshot-diff` or `argent-screen-recording`)** to prove the contract is fulfilled.

### 1. Credit Checkout Trigger UAT
- **Action:** Sales Staff adds an item to the cart and taps the new "Checkout (Credit)" button.
- **Expected Outcome:** A modal or slide-over appears prompting the user to search for a customer by phone number.
- **Evidence Required:** Screenshot showing the Customer Search modal.

### 2. Customer Creation UAT
- **Action:** Sales Staff enters a new phone number and name, then taps "Add Customer".
- **Expected Outcome:** The customer is created and automatically selected for the current checkout flow.
- **Evidence Required:** Screenshot of the filled-out "Add Customer" form before submission.

### 3. Credit Finalization UAT
- **Action:** Sales Staff confirms the credit order for the selected customer.
- **Expected Outcome:** The API processes the order, the cart clears, and a success toast specifically mentions the customer's name (e.g., "Order placed on credit for John Doe").
- **Evidence Required:** Screenshot of the visual success state.

---

### Task 0: Phase 3 Review & Cleanup

**Goal:** Ensure the previous phase's code is ready for extension. 
*Note: Phase 3 implementation was exceptional. Ports were strictly followed, Zustand was perfectly implemented, and `DESIGN.md` parity was 100%. No major cleanup is required!*

- [ ] **Step 1: Verify Phase 3 Baseline**
Ensure `cargo test` and `npm run test` still pass before beginning Phase 4.

---

### Task 1: Customers & Credits Database

**Files:**
- Create: `backend/migrations/0007_create_customers_and_credits.sql`
- Create: `backend/src/features/customers/repository.rs`

- [ ] **Step 1: Write Migration Files**
Create `customers` (id, name, phone_number, created_at) and `credits` (id, customer_id, order_id, amount, status [e.g., 'unpaid', 'paid'], created_at).
- [ ] **Step 2: Run Migrations**
Run `sqlx migrate run`.
- [ ] **Step 3: Create Customer Repository**
Implement `find_by_phone` and `create_customer` in the repository.
- [ ] **Step 4: Commit**
`git commit -m "feat: setup customers and credits database schema"`

---

### Task 2: Backend Customers & Credit API (TDD)

**Files:**
- Create: `backend/src/features/customers/mod.rs` (Service, Controller)
- Modify: `backend/src/features/sales/service.rs` (Add credit order logic)
- Create: `backend/tests/customers_test.rs`
- Create: `backend/tests/credit_order_test.rs`

- [ ] **Step 1: RED - Write the failing tests**
Write tests asserting that GET `/api/customers?phone=XYZ` works, POST `/api/customers` creates a user, and POST `/api/orders/credit` creates an order AND a credit record.
- [ ] **Step 2: GREEN - Implement Customers API**
Build the controller and service for customer search and creation.
- [ ] **Step 3: GREEN - Implement Credit Order API**
Extend the sales service to accept a `customer_id`. Wrap the order creation and credit creation in a SQLx database transaction (`tx`) to ensure atomicity.
- [ ] **Step 4: REFACTOR & Verify**
Run `cargo test`.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement customers api and credit order processing"`

---

### Task 3: Frontend Customer Selection & Checkout (TDD)

**Files:**
- Create: `frontend/src/features/customers/components/CustomerSelectionModal.tsx`
- Modify: `frontend/src/features/sales/components/CartSidebar.tsx`

- [ ] **Step 1: RED/GREEN - Implement Customer Modal**
Build a modal that allows typing a phone number to search. If no customer is found, show an inline form to add their Name and create them.
- [ ] **Step 2: Update Cart Sidebar**
Add a "Checkout (Credit)" button beneath the Cash button. Wire it to open the `CustomerSelectionModal`.
- [ ] **Step 3: Wire Credit Checkout API**
When a customer is selected in the modal, fire the POST request to `/api/orders/credit` with the cart items and the `customer_id`.
- [ ] **Step 4: Capture UAT Screenshots**
Run the iOS simulator. Capture the search modal, the add customer flow, and the final success toast.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement frontend customer search and credit checkout flow"`
