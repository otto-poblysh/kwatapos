# In-App Help & Contextual Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a non-invasive, progressive disclosure training system that helps new bar staff and managers learn Kwata POS without disrupting their workflow or relying on annoying, unskippable full-screen tours.

**Design Philosophy (Progressive Disclosure & Onboarding):**
1. **On-Demand Context:** Help should be pulled by the user when needed, not pushed aggressively. 
2. **Contextual Tooltips:** Small, distinct info icons `(i)` placed near complex metrics or actions.
3. **Empty States:** Every empty screen must explain its purpose and offer a clear "first action".

**Tech Stack:** React Native (Expo Router), Bottom Sheets/Drawers, React Native Tooltips.

## Visible Tangible Outcomes
1. **Global Help Drawer:** A subtle `(?)` or "Help" button available in the navigation header of all major screens. Tapping it opens a bottom sheet with context specifically tailored to the active screen.
2. **Contextual Tooltips:** Inline `(i)` icons next to potentially confusing terms (e.g., "Expected Cash in Drawer", "Direct Expenses").
3. **Comprehensive Empty States:** Empty states on the POS, Catalog, and Team screens that tell users exactly what to do next.

---

## User Acceptance Testing (UAT) Contract

### 1. Global Help Drawer UAT
- **Action:** A Sales Staff member on the "Open Orders" POS screen taps the `(?)` icon in the top right corner.
- **Expected Outcome:** A bottom sheet slides up displaying "POS Guide: How to open a tab, add items, and settle an order." It does not block the entire screen and can be swiped down to dismiss.
- **Evidence Required:** Screenshot of the POS screen with the Help Bottom Sheet open.

### 2. Contextual Tooltips UAT
- **Action:** The Super Admin navigates to the Daily Reconciliation Report and taps the `(i)` icon next to "Expected Cash in Drawer".
- **Expected Outcome:** A small popover appears stating: "Calculated as: Total Cash Sales minus Approved Direct Expenses."
- **Evidence Required:** Screenshot of the Daily Report screen with the tooltip visible.

---

### Task 1: Comprehensive Empty States

**Files:**
- Modify: `frontend/src/app/(sales)/index.tsx` (Open Orders)
- Modify: `frontend/src/app/(admin)/team.tsx`
- Modify: `frontend/src/app/(admin)/catalog.tsx`

- [ ] **Step 1: POS Empty State**
If there are no open orders, show an empty state: "No open tabs. Tap 'New Order' to start a tab for a table or customer."
- [ ] **Step 2: Catalog Empty State**
If the catalog is empty, show: "Your menu is empty. Add drinks and products to start selling." Include an "Add Product" button.
- [ ] **Step 3: Team Empty State**
If no additional staff exist, show: "You are the only user. Invite your managers and sales staff here." Include an "Invite Staff" button.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement educational empty states for core screens"`

---

### Task 2: The Contextual Help Drawer (Bottom Sheet)

**Files:**
- Create: `frontend/src/core/components/HelpDrawer.tsx`
- Modify: `frontend/src/app/_layout.tsx` or screen headers

- [ ] **Step 1: Create the Help Drawer Component**
Use a bottom sheet component (e.g., `@gorhom/bottom-sheet` or a custom animated view). It should accept a `screenKey` prop to determine what text to render.
- [ ] **Step 2: Write Contextual Copy**
Create a dictionary of help text. 
  - `pos`: "To start a sale, tap 'New Order'. You can add items now and settle the bill later when the customer is ready to pay."
  - `requisitions`: "Draft orders here and share them directly to your vendor's WhatsApp. They can confirm prices before you accept the delivery."
  - `reports`: "This shows your end-of-shift totals. Expected Cash is your cash sales minus any cash expenses you paid out today."
- [ ] **Step 3: Add Header Buttons**
Add a subtle `(?)` button to the right side of the navigation headers on primary screens. When tapped, it opens the Help Drawer.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement contextual help drawer bottom sheet"`

---

### Task 3: Non-Invasive Inline Tooltips

**Files:**
- Create: `frontend/src/core/components/Tooltip.tsx`
- Modify: `frontend/src/app/(admin)/reports.tsx`
- Modify: `frontend/src/features/expenses/components/ExpenseRequest.tsx`

- [ ] **Step 1: Build the Tooltip Component**
Create a simple, accessible wrapper component that renders a small `(i)` icon. When tapped, it reveals a small text bubble (popover) above or below the icon. Tapping anywhere else dismisses it.
- [ ] **Step 2: Add Tooltips to Reports**
Add the `(i)` tooltip next to "Expected Cash in Drawer" (explaining the math: Cash Sales - Cash Expenses) and "Credit Issued Today" (explaining that this is unpaid debt).
- [ ] **Step 3: Add Tooltips to Expenses**
Add a tooltip next to "Direct Expense" explaining: "Use this when you take cash out of the drawer to buy shop supplies (e.g., soap, cigarettes)."
- [ ] **Step 4: Capture UAT Screenshots**
Run the simulator. Capture the POS Empty State, the Open Help Drawer, and a visible Tooltip.
- [ ] **Step 5: Commit**
`git commit -m "feat: implement non-invasive inline tooltips for complex metrics"`
