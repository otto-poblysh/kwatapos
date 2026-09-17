# Phase 4: Open Orders & Flexible Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the POS to align with real-world bar operations. Staff must be able to open tabs, append items to them over time, and settle them using flexible payment methods (Card, Transfer, Cash, or Credit). 

**Architecture:** This requires a paradigm shift in the frontend. The `(sales)` route will now default to a dashboard of "Open Orders". Tapping an order opens the Product Grid / Cart Sidebar. In the backend, the `orders` domain expands to handle `status` and `payment_method`.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router, Zustand, React Native Modal), PostgreSQL.

## Visible Tangible Outcomes
1. **Database:** Updates to `orders` (adding status, name, payment_method) and new `customers`/`credits` tables.
2. **Backend API:** `/api/orders` supports creating empty open orders, appending items, and settling.
3. **Frontend UI (Sales Home):** A grid of Open Orders representing tables or running tabs.
4. **Frontend UI (Settlement):** A multi-modal settlement screen allowing selection of Card, Transfer, Cash, or Credit (which prompts for Customer info).

---

## User Acceptance Testing (UAT) Contract

### 1. Open Orders Dashboard UAT
- **Action:** Sales Staff logs in.
- **Expected Outcome:** User sees a grid of open orders. User taps "New Tab" and names it "Table 4".
- **Evidence Required:** Screenshot of the Open Orders dashboard showing the newly created "Table 4".

### 2. Tab Appending UAT
- **Action:** User taps "Table 4", adds 2 beers, and taps "Save Tab". Later, they reopen "Table 4" and see the 2 beers still there.
- **Expected Outcome:** State is preserved server-side for the open order.
- **Evidence Required:** Screenshot of the reopened cart with the preserved items.

### 3. Flexible Settlement UAT
- **Action:** User taps "Settle Tab" on "Table 4", selects "Bank Transfer", and confirms.
- **Expected Outcome:** The order is closed, disappears from the Open Orders grid, and a success toast appears.
- **Evidence Required:** Screenshot of the Settlement Modal before confirming, and the success toast afterwards.

---

### Task 1: Database Refactoring & Migrations

**Files:**
- Create: `backend/migrations/0007_refactor_orders_and_add_credits.sql`
- Modify: `backend/src/features/sales/repository.rs`

- [ ] **Step 1: Write Migration Files**
Update `orders` table: Add `status` (VARCHAR, default 'open'), `order_name` (VARCHAR), `payment_method` (VARCHAR).
Create `customers` and `credits` tables to support the Credit payment method.
- [ ] **Step 2: Run Migrations**
Run `sqlx migrate run`.
- [ ] **Step 3: Update Repositories**
Update the sales repository to fetch `status = 'open'` orders, update existing orders, and process settlement transactions.
- [ ] **Step 4: Commit**
`git commit -m "feat: refactor orders schema for open tabs and flexible payments"`

---

### Task 2: Backend API Updates (TDD)

**Files:**
- Modify: `backend/src/features/sales/controller.rs`
- Modify: `backend/src/features/sales/service.rs`
- Create: `backend/tests/open_orders_test.rs`

- [ ] **Step 1: RED - Write the failing tests**
Write tests asserting that a new order can be created empty, items can be PUT to it, and it can be settled with `payment_method='transfer'`.
- [ ] **Step 2: GREEN - Implement Tab Management APIs**
Implement `/api/orders` (GET open orders, POST new tab) and `/api/orders/:id/items` (PUT to sync items).
- [ ] **Step 3: GREEN - Implement Settlement API**
Implement `/api/orders/:id/settle` accepting `payment_method`. If `credit`, require a `customer_id`. Wrap this in a SQLx transaction to update the status and create credit records atomically.
- [ ] **Step 4: REFACTOR & Verify**
Run `cargo test`.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement open orders and settlement APIs"`

---

### Task 3: Frontend Tab Management UI (TDD)

**Files:**
- Modify: `frontend/src/app/(sales)/index.tsx`
- Create: `frontend/src/app/(sales)/tab/[id].tsx`
- Modify: `frontend/src/features/sales/store/cartStore.ts`

- [ ] **Step 1: Build Open Orders Dashboard**
Refactor `(sales)/index.tsx` to display a grid of active tabs (e.g., "Table 4"). Add a button to create a new tab via a prompt for the tab name.
- [ ] **Step 2: Build Tab Detail Route**
Create `tab/[id].tsx` which loads the `ProductGrid` and `CartSidebar`. When items are added, replace the "Checkout" button with "Save Tab" and "Settle Tab".
- [ ] **Step 3: Sync Cart State**
Update the Zustand store to fetch and sync items for a specific `order_id` rather than a global stateless cart.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement frontend open orders dashboard and tab routing"`

---

### Task 4: Frontend Flexible Settlement Modal

**Files:**
- Create: `frontend/src/features/sales/components/SettlementModal.tsx`
- Modify: `frontend/src/app/(sales)/tab/[id].tsx`

- [ ] **Step 1: Build the Modal UI**
Create a highly-rounded, flat modal with four large buttons: "Cash", "Card", "Transfer", "Credit".
- [ ] **Step 2: Wire the Credit Flow**
If "Credit" is selected, transition the modal to a Customer Search / Add form.
- [ ] **Step 3: Process the API Call**
On confirmation, hit the `/api/orders/:id/settle` endpoint, then route the user back to the `(sales)/index.tsx` dashboard.
- [ ] **Step 4: Capture UAT Screenshots**
Run the iOS simulator. Capture the Open Orders grid, the Appended Cart, and the Settlement Modal.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement flexible checkout modal with multi-modal payment"`
