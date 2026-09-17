# Phase 3: Core POS & Cash Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the primary tool for the Sales Staff—the Point of Sale interface, including product fetching, cart state management, and basic cash checkout.

**Architecture:** Continuing our Feature-First DDD approach, all new code will live within the `sales` and `inventory` feature directories. We will implement `Zustand` for local cart state management in the frontend.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router, Zustand, TanStack Query), PostgreSQL.

## Global Constraints
- **STRICT PORT COMPLIANCE:** According to the user rules, Kwata owns 3011-3020. Expo Web must use `3011`, iOS `3012`, Android `3013`.
- The UI must perfectly obey `DESIGN.md` (no drop shadows on cards, pill-shaped primary buttons, strong typographic hierarchy for prices).

---

## Visible Tangible Outcomes
At the conclusion of this phase, the following deliverables will be completed and functional:
1. **Database:** `products` (menu items) and `inventory` (current stock) tables exist and are seeded with sample beer and roasted fish.
2. **Backend API:** `/api/products` (GET) and `/api/orders/cash` (POST).
3. **Frontend Cart State:** A `Zustand` store tracking selected items and quantities.
4. **Frontend UI:** The `(sales)/index.tsx` screen featuring a product grid and a shopping cart sidebar/drawer.

---

## User Acceptance Testing (UAT) Contract

To consider this phase complete, the following tests must pass, **backed by screenshots (using `argent-screenshot-diff` or `argent-screen-recording`)** to prove the contract is fulfilled.

### 1. POS Dashboard UAT
- **Action:** Sales Staff logs in.
- **Expected Outcome:** User sees a clean grid of available products (Beer, Fish) and an empty cart summary.
- **Evidence Required:** Screenshot showing the loaded product grid.

### 2. Cart Management UAT
- **Action:** Sales Staff taps multiple items to add them to the cart.
- **Expected Outcome:** The cart sidebar/drawer updates to reflect the items, quantities, and a large, prominent Total Price (following the Number Prominence Rule from `DESIGN.md`).
- **Evidence Required:** Screenshot showing the populated cart and correctly calculated total.

### 3. Cash Checkout UAT
- **Action:** Sales Staff taps "Checkout (Cash)" in the cart.
- **Expected Outcome:** The API receives the order, the cart is cleared locally, and a success message appears.
- **Evidence Required:** Screenshot of the visual success state (e.g., green success toast).

---

### Task 0: Phase 2 Cleanup & Parity

**Goal:** Fix the Expo port configuration to perfectly align with strict system constraints.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/core/api/client.ts` (or wherever `apiUrl` is defined).

- [ ] **Step 1: Fix Expo Ports**
Update `package.json` scripts so `web` uses 3011, `ios` uses 3012, and `android` uses 3013.
- [ ] **Step 2: Fix API Client URL**
Ensure the frontend HTTP client points to port `3014` (the Rust Backend API) instead of `8095` or `3010`.
- [ ] **Step 3: Commit**
`git commit -am "fix: align expo and api ports to kwata system rules (3011-3014)"`

---

### Task 1: Products & Inventory Database

**Files:**
- Create: `backend/migrations/0003_create_products_and_inventory.sql`
- Create: `backend/migrations/0004_seed_products.sql`
- Create: `backend/src/features/inventory/repository.rs`

- [ ] **Step 1: Write Migration Files**
Create tables for `products` (id, name, price, category) and `inventory` (product_id, quantity).
- [ ] **Step 2: Write Seed Data**
Seed 3 types of beer and 2 sizes of roasted fish with initial inventory quantities.
- [ ] **Step 3: Run Migrations**
Run `sqlx migrate run`.
- [ ] **Step 4: Commit**
`git commit -m "feat: setup products and inventory database schema"`

---

### Task 2: Backend Sales & Products API (TDD)

**Files:**
- Create: `backend/src/features/sales/mod.rs` (Service, Controller, Repository)
- Create: `backend/tests/sales_test.rs`

- [ ] **Step 1: RED - Write the failing tests**
Write a test asserting that GET `/api/products` returns a 200 array of products, and POST `/api/orders/cash` returns 201 Created.
- [ ] **Step 2: GREEN - Implement the Products API**
Implement the repository query to fetch active products and the controller to serve them.
- [ ] **Step 3: GREEN - Implement Cash Order API**
Implement the service logic to accept an order payload, insert an order record, and decrement the `inventory` table.
- [ ] **Step 4: REFACTOR & Verify**
Run `cargo test`.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement products and cash order endpoints"`

---

### Task 3: Frontend POS UI & Zustand Cart (TDD)

**Files:**
- Create: `frontend/src/features/sales/store/cartStore.ts`
- Create: `frontend/src/features/sales/store/cartStore.test.ts`
- Modify: `frontend/src/app/(sales)/index.tsx`
- Create: `frontend/src/features/sales/components/ProductGrid.tsx`
- Create: `frontend/src/features/sales/components/CartSidebar.tsx`

- [ ] **Step 1: RED/GREEN - Implement Zustand Store**
Write tests for the Zustand `useCartStore` (addItem, removeItem, clearCart, totalAmount). Then implement the store.
- [ ] **Step 2: Implement Product Grid**
Fetch products using `TanStack Query` (or standard `fetch`) and display them in flat, highly-rounded cards.
- [ ] **Step 3: Implement Cart & Checkout**
Display the cart. When "Checkout" is pressed, send the POST request to `/api/orders/cash`, await success, call `clearCart()`, and alert the user.
- [ ] **Step 4: Capture UAT Screenshots**
Run the iOS simulator. Capture the product grid, the populated cart, and the post-checkout success state.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement POS product grid, cart state, and checkout"`
