# Phase 5: Requisitions, Vendor Collaboration & Direct Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform inventory restocking from an internal admin task to a collaborative, real-world vendor workflow (via WhatsApp/Native Sharing). Simultaneously introduce a tracked "Direct Expense" flow for immediate cash purchases requiring physical receipt uploads.

**Architecture:** 
- The `requisitions` feature spans both the internal app and a **public-facing web route** (for vendors without auth).
- The `expenses` feature manages direct cash requests and receipt uploads.

**Tech Stack:** Rust (Axum, sqlx), React Native (Expo Router, expo-sharing, expo-image-picker), PostgreSQL.

## Visible Tangible Outcomes
1. **Database:** New `requisitions`, `requisition_items`, and `direct_expenses` tables.
2. **Backend API:** Internal CRUD routes + Public-facing `/api/vendor/requisition/:token` for vendor price confirmations.
3. **Frontend UI (Requisitions):** A manager dashboard to draft orders. Uses `expo-sharing` to share a link via WhatsApp. 
4. **Frontend UI (Vendor Public Form):** A simplified web-only form (via Expo Web) where vendors see items, update prices, and hit "Confirm".
5. **Frontend UI (Expenses):** A flow for shop keepers to request cash and upload photo receipts.

---

## User Acceptance Testing (UAT) Contract

### 1. Vendor Collaboration UAT
- **Action:** Manager drafts an order, taps "Share to Vendor". 
- **Expected Outcome:** The native OS share sheet opens. The vendor receives a URL, opens it on their phone, edits a price, and submits. The Manager sees the updated price in the app.
- **Evidence Required:** Screenshot of the public Vendor Web Form, and a screenshot of the Manager's view showing the accepted price.

### 2. Delivery & Partial Fulfillment UAT
- **Action:** Manager marks an accepted requisition as "Delivered" but adjusts the quantity (e.g., ordered 10, received 8). 
- **Expected Outcome:** Inventory increases by 8. Status changes to "Pending Payment".
- **Evidence Required:** Screenshot of the Requisition Receiving modal showing the quantity adjustment.

### 3. Direct Expense & Receipt UAT
- **Action:** Shop Keeper requests 5,000 FCFA for "Soap". Once approved, they tap "Upload Receipt".
- **Expected Outcome:** The device camera/gallery opens (`expo-image-picker`), a photo is attached, and the expense is marked as reconciled.
- **Evidence Required:** Screenshot of the Expense detail view showing the attached receipt thumbnail.

---

### Task 0: Impeccable Onboarding & Empty States

*Applying UX principles from `impeccable/reference/onboard.md`.*

- [x] **Step 1: Requisitions Empty State**
In `frontend/src/app/(manager)/requisitions.tsx`, do not just show "No Requisitions".
Design an empty state with:
- **What will be here**: "Your vendor orders will appear here."
- **Why it matters**: "Generate orders and share them directly to your vendors on WhatsApp."
- **Action**: A prominent "Draft First Requisition" button.

---

### Task 1: Database Schema & Migrations

**Files:**
- Create: `backend/migrations/0008_create_requisitions_and_expenses.sql`

- [x] **Step 1: Write Migration Files**
`requisitions`: id, token (uuid for public link), status (draft, sent, accepted, partial_delivery, delivered, paid).
`requisition_items`: id, requisition_id, product_id, quantity, expected_price, confirmed_price, received_quantity.
`direct_expenses`: id, requested_by, category, amount, status (requested, approved, receipt_uploaded), receipt_image_url.
- [x] **Step 2: Run Migrations**
Run `sqlx migrate run`.
- [x] **Step 3: Commit**
`git commit -m "feat: setup requisitions and direct expenses database schema"`

---

### Task 2: Backend Requisition & Vendor APIs (TDD)

**Files:**
- Create: `backend/src/features/requisitions/mod.rs` (Service, Controller)
- Create: `backend/src/features/expenses/mod.rs`

- [x] **Step 1: RED - Write the failing tests**
Write tests for creating a requisition, a public vendor endpoint that accepts price changes via `token`, and marking an expense as receipt uploaded.
- [x] **Step 2: GREEN - Implement Internal APIs**
Implement endpoints for Managers to create drafts, finalize to "sent", mark as "delivered" (with actual received quantities impacting `inventory`), and mark "paid".
- [x] **Step 3: GREEN - Implement Public Vendor API**
Implement `GET /api/public/requisition/:token` (returns items) and `POST /api/public/requisition/:token` (updates prices, sets status to 'accepted').
- [x] **Step 4: Commit**
`git commit -m "feat: implement requisitions, expenses, and public vendor APIs"`

---

### Task 3: Frontend Manager Requisitions & Sharing

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/features/requisitions/components/RequisitionDraft.tsx`
- Create: `frontend/src/app/public/vendor/[token].tsx`

- [x] **Step 1: Install Native Sharing**
Run `npx expo install expo-sharing expo-file-system`.
- [x] **Step 2: Build the Draft View**
Allow Managers to select products and quantities. Auto-fill the `expected_price` using the last known price from the database.
- [x] **Step 3: Implement Native Sharing**
When "Share Order" is pressed, generate the public link (`https://[your-domain]/public/vendor/[token]`). Use `Sharing.shareAsync()` so the manager can send it via WhatsApp/iMessage.
- [x] **Step 4: Build the Vendor Public Form**
Create `public/vendor/[token].tsx`. This route must work on Expo Web without authentication. Display a clean, mobile-friendly HTML form for the vendor to review quantities and edit prices.
- [x] **Step 5: Commit**
`git commit -m "feat: implement native sharing and public vendor web form"`

---

### Task 4: Direct Expenses & Receipt Uploads

**Files:**
- Create: `frontend/src/features/expenses/components/ExpenseRequest.tsx`

- [x] **Step 1: Install Image Picker**
Run `npx expo install expo-image-picker`.
- [x] **Step 2: Build Expense Request Form**
Create a form with preset categories (Cigarettes, Fish, Supplies).
- [x] **Step 3: Implement Receipt Upload**
Add an "Upload Receipt" button on approved expenses that triggers `ImagePicker.launchCameraAsync()`. Convert the image to base64 or multipart form data to submit to the backend.
- [x] **Step 4: Capture UAT Screenshots**
Run the simulator. Capture the Requisition Empty State, the Vendor Web Form, and the Receipt Upload screen.
- [x] **Step 5: Commit**
`git commit -m "feat: implement direct expenses and camera receipt uploads"`
