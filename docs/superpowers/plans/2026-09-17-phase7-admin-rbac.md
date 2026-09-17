# Phase 7: Advanced Admin & Granular RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Transform the Admin area into a fully-fledged back-office suite with comprehensive CRUD for core entities (Products, Customers) and granular Role-Based Access Control (RBAC) for the team.

**Architecture:** 
- Move beyond static roles (`admin`, `manager`, `sales`) to a dynamic permissions model (`permissions`, `role_permissions`, `user_permissions`).
- Build comprehensive RESTful endpoints for managing these entities.
- Expand the frontend `(admin)` group with distinct, flat-designed dashboards for Team, Catalog, and Customers.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router), PostgreSQL.

## Visible Tangible Outcomes
1. **Database:** New `permissions`, `role_permissions`, and `user_permissions` tables allowing fine-grained access override per user.
2. **Backend API:** A full suite of `/api/admin/*` CRUD routes protected by a new `RequirePermission` middleware.
3. **Frontend UI (Team):** A dashboard to invite staff, assign roles, and toggle specific permissions.
4. **Frontend UI (Catalog):** A dashboard to add, edit, or remove products and adjust prices.
5. **Frontend UI (Customers):** A dashboard to manage the customer roster and update credit PINs.

---

## User Acceptance Testing (UAT) Contract

### 1. Granular Permissions UAT
- **Action:** Super Admin creates a role "Weekend Staff" with only `pos.sale` and `catalog.read` permissions. They assign it to User A. They add a specific `user_permission` giving User A `catalog.update`. User A attempts to edit a product price.
- **Expected Outcome:** User A successfully edits the price (due to their direct permission override).
- **Evidence Required:** Screenshot of the Team Management UI showing the toggled permissions for User A, and the successful Axum response logs.

### 2. Core CRUD UAT
- **Action:** Super Admin navigates to the Catalog dashboard and creates a new product "Guinness Stout", sets a price, and uploads an image (if supported, or just selects an icon).
- **Expected Outcome:** The product immediately appears in the Sales POS grid.
- **Evidence Required:** Screenshot of the new Catalog Management Dashboard showing the created product.

---

### Task 0: Phase 6 Review & Preparation

*Note: Phase 6 successfully added the Customer Portal and Daily Reconciliation dashboard. This phase builds on that by exposing management capabilities to the Super Admin.*

- [x] **Step 1: Verify Phase 6 Baseline**
Ensure `cargo test` and `npm run test` pass before beginning Phase 7.

---

### Task 1: Database RBAC Schema & Migrations

**Files:**
- Create: `backend/migrations/0010_create_rbac_tables.sql`

- [x] **Step 1: Write Migration Files**
Create `permissions` (id, name, description).
Create `role_permissions` (role_name, permission_id).
Create `user_permissions` (user_id, permission_id, is_granted). `is_granted` boolean allows explicitly granting or denying a permission regardless of the base role.
- [x] **Step 2: Seed Default Permissions**
Seed essential permissions: `users.manage`, `roles.manage`, `catalog.manage`, `customers.manage`, `pos.sale`, `reports.view`. Map appropriate permissions to the existing `admin`, `manager`, and `sales` roles.
- [x] **Step 3: Run Migrations**
Run `sqlx migrate run`.
- [x] **Step 4: Commit**
`git commit -m "feat: implement advanced RBAC database schema"`

---

### Task 2: Backend Permissions Middleware & Admin APIs (TDD)

**Files:**
- Modify: `backend/src/core/middleware.rs`
- Modify: `backend/src/features/auth/service.rs`
- Create: `backend/src/features/admin/mod.rs` (Controllers for users, roles, products, customers)

- [x] **Step 1: Implement Permission Middleware**
Create an Axum extractor/middleware `RequirePermission(pub &'static str)` that checks the JWT user against the database to ensure they have the required permission (evaluating role permissions + user-specific overrides).
- [x] **Step 2: Build Team APIs**
Implement `GET/POST/PUT/DELETE` for `/api/admin/users`, `/api/admin/roles`, and `/api/admin/permissions`.
- [x] **Step 3: Build Catalog & Customer APIs**
Implement `GET/POST/PUT/DELETE` for `/api/admin/products` and `/api/admin/customers`.
- [x] **Step 4: REFACTOR & Verify**
Write and pass `cargo test` assertions for permission denials (403 Forbidden).
- [x] **Step 5: Commit**
`git commit -m "feat: implement admin CRUD APIs and RBAC middleware"`

---

### Task 3: Frontend Team & Role Management

**Files:**
- Create: `frontend/src/app/(admin)/team.tsx`

- [x] **Step 1: Build Team Dashboard**
Create a master-detail or modal-driven view to list all users.
- [x] **Step 2: Implement Permissions Toggler**
When editing a user or role, display a list of all system permissions with toggle switches. Ensure the UI clearly distinguishes between "Inherited from Role" and "Directly Assigned".
- [x] **Step 3: Adhere to Flat Design**
Ensure the dashboard complies strictly with `DESIGN.md` (no drop shadows, 24px/9999px border radii, high contrast black/white layout).
- [x] **Step 4: Commit**
`git commit -m "feat: implement frontend team and RBAC management dashboard"`

---

### Task 4: Frontend Catalog & Customer Management

**Files:**
- Create: `frontend/src/app/(admin)/catalog.tsx`
- Create: `frontend/src/app/(admin)/customers.tsx`

- [x] **Step 1: Build Catalog Dashboard**
Create the UI to list, add, edit, and delete products. Ensure it includes an interface to easily adjust `price` and `stock_quantity`.
- [x] **Step 2: Build Customers Dashboard**
Create the UI to manage the customer list, edit their credit profiles, and reset their PINs if they forget them.
- [x] **Step 3: Capture UAT Screenshots**
Run the simulator. Capture screenshots of the Team Management, Catalog Management, and Customers Management screens.
- [x] **Step 4: Commit**
`git commit -m "feat: implement frontend catalog and customer management dashboards"`
