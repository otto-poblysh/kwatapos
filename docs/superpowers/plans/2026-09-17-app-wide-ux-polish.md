# App-Wide UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the entire Kwata POS application to consumer-grade quality by applying the six Impeccable UX principles (Distill, Adapt, Animate, Layout, Typeset, and Polish) **globally**. This specifically addresses bad mobile UX patterns, moving the app toward mature, industry-standard mobile interfaces.

**Architecture/Tech Stack:** React Native (Expo Router), React Native Reanimated, centralized theme tokens.

## Visible Tangible Outcomes
1. **Stats-Driven Admin Dashboard:** The admin home screen transforms from a primitive stack of huge buttons into a mature, stats-driven dashboard (Sales, Stock, Orders) with a refined navigation grid.
2. **WhatsApp-Style Minimal Lists:** Bulky cards with inline buttons are completely removed. Lists (Team, Catalog, Orders) become minimal, scannable rows (like WhatsApp contacts) featuring an avatar/icon on the left and a chevron on the right.
3. **Item Detail Pages (Distill):** Tapping a list row navigates to a dedicated Item Detail page. Destructive and secondary actions (`Edit`, `Delete`) are moved here, keeping the primary lists clean and distraction-free.
4. **Icon-Driven Top Actions:** The bulky `+ Add [Item]` text buttons are replaced by simple, icon-driven actions (e.g., a `+` icon) anchored in the top header.
5. **Contextual Add Forms:** Adding items uses contextual UI based on complexity: Bottom Sheets for simple, small forms, and dedicated pages with a `< Back` button for larger, complex forms.
6. **Global Quieter Toasts:** A global `ToastProvider` replaces all inline static success/error banners with elegant, animated, auto-dismissing notifications.
7. **Accessible Typography:** A strict typography floor is enforced app-wide (minimum `13px` for badges).

---

## User Acceptance Testing (UAT) Contract

### 1. Admin Dashboard UAT
- **Action:** Log in as an Admin.
- **Expected Outcome:** The home screen displays top-level stats (e.g., "Today's Sales", "Low Stock"). Below the stats is a mature, elegantly laid-out navigation grid or menu (Team, Catalog, Reports), not a single centered card of stacked black buttons.

### 2. WhatsApp-Style Lists & Detail Pages UAT
- **Action:** Navigate to the Catalog or Team list. Tap an item.
- **Expected Outcome:** The list uses minimal, dense rows without inline `Edit`/`Delete` buttons. Tapping a row opens a new screen (Detail Page) where full details, `Edit`, and `Delete` actions live.

### 3. Add Component Context UAT
- **Action:** Tap the `+` icon in the header to add a complex item (like a Product).
- **Expected Outcome:** It navigates to a full screen with a back button. 

### 4. Global Toasts UAT
- **Action:** Delete an item from its detail page.
- **Expected Outcome:** The app navigates back to the list. A soft, tinted success toast slides down from the top and auto-dismisses after 3 seconds.

---

### Task 1: Admin Dashboard (Stats-Driven & Mature)

**Files:**
- Modify: `frontend/src/app/(admin)/index.tsx`

- [ ] **Step 1: Destroy the Stacked Buttons Card**
Remove the centered `card` layout containing the giant `Team`, `Catalog`, `Customers`, `Daily Report`, and `Log Out` buttons.
- [ ] **Step 2: Build the Stats Header**
Implement a horizontal scroll or grid of 2-3 stat cards at the top (e.g., "Today's Sales", "Active Orders", "Low Stock Alerts"). Use placeholder data if the backend isn't ready.
- [ ] **Step 3: Mature Navigation Grid**
Below the stats, implement a mature, icon-driven grid menu (or a sleek list) for the main navigation items (`Team`, `Catalog`, `Customers`, `Reports`).
- [ ] **Step 4: Commit**
`git commit -m "feat: redesign admin dashboard to be stats-driven with mature navigation layout"`

---

### Task 2: Distill Lists (WhatsApp-Style Rows) & Header Actions

**Files:**
- Modify: `frontend/src/app/(admin)/catalog.tsx`, `frontend/src/app/(admin)/team.tsx`, `frontend/src/app/(sales)/index.tsx`

- [ ] **Step 1: Icon-Driven Header Actions**
In the header of these list screens, replace bulky text buttons (e.g., `+ Add Product`) with a simple, icon-only button (e.g., a `+` SVG icon) aligned to the top right.
- [ ] **Step 2: Strip Inline Actions from Lists**
Remove the `Edit` and `Delete` buttons entirely from the list items in Catalog, Team, etc.
- [ ] **Step 3: Implement WhatsApp-Style Rows**
Redesign the list items to be minimal rows. Left side: Avatar or Icon. Middle: Title (bold, 16px) and Subtitle (gray, 13px/14px). Right side: Contextual metadata (e.g., Price or Stock) and a small `>` chevron indicating it is tappable.
- [ ] **Step 4: Commit**
`git commit -m "feat: refactor lists to minimal rows and use icon-driven header actions"`

---

### Task 3: Item Detail Pages & Contextual Add Forms

**Files:**
- Create/Modify: `frontend/src/app/(admin)/product/[id].tsx`, `user/[id].tsx`, etc.
- Create/Modify: Add forms.

- [ ] **Step 1: Create Item Detail Pages**
When a user taps a minimal list row, use Expo Router to push them to a detail screen (e.g., `router.push('/(admin)/product/123')`). 
- [ ] **Step 2: Move Actions to Detail Pages**
On the Item Detail page, display all expanded data. Place the `Edit` and `Delete` actions here (e.g., `Edit` in the header or as a prominent secondary button, `Delete` as a destructive button at the bottom).
- [ ] **Step 3: Standardize Add Forms**
For complex forms (e.g., Add Product), ensure tapping the header `+` icon navigates to a dedicated page (e.g., `/(admin)/product/new`) with a back button. For trivial additions (if any), use a Bottom Sheet (`@gorhom/bottom-sheet` or a custom modal anchored to the bottom).
- [ ] **Step 4: Commit**
`git commit -m "feat: implement item detail pages and standardize complex form routing"`

---

### Task 4: Polish & Typeset (Global Tokens & Typography)

**Files:**
- Create: `frontend/src/core/theme/tokens.ts`
- Modify: Search and replace across `frontend/src/app/**/*.tsx`

- [ ] **Step 1: Extract Tokens**
Create `tokens.ts` with semantic colors (`colors.background.primary`, `colors.status.errorBg`) and a typography scale.
- [ ] **Step 2: Refactor Hardcoded Values**
Replace all hardcoded `#F2F2F7`, `#FFFFFF`, `#111111` across the app with the new tokens.
- [ ] **Step 3: Enforce Typography Floor**
Audit all text elements. Bump any `fontSize` of 10, 11, or 12px to a minimum of `13px`.
- [ ] **Step 4: Commit**
`git commit -m "refactor: apply global design tokens and typography accessibility floor"`

---

### Task 5: Quieter & Animate (Global Toast Provider)

**Files:**
- Create: `frontend/src/core/providers/ToastProvider.tsx`
- Modify: `frontend/src/app/_layout.tsx`

- [ ] **Step 1: Build the Animated Toast Provider**
Create a global context provider that renders a transient, animated toast at the top of the screen that auto-dismisses after 3 seconds. 
- [ ] **Step 2: Apply Quieter Colors**
Ensure the Toast uses tinted neutrals: `#FDE8E8` for errors, `#E8F8EE` for success. Remove all inline, manually dismissed banners across the app.
- [ ] **Step 3: Commit**
`git commit -m "feat: add global animated toast provider for quieter success/error alerts"`
