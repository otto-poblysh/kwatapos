# App-Wide UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the entire Kwata POS application to consumer-grade quality by applying the six Impeccable UX principles (Distill, Adapt, Animate, Layout, Typeset, and Polish) **globally**. This goes beyond the Open Orders screen to unify the Admin, Manager, and Sales routes under a single, highly refined design system.

**Architecture/Tech Stack:** React Native (Expo Router), React Native Reanimated (for Toasts/Transitions), centralized theme tokens.

## Visible Tangible Outcomes
1. **Global Design Tokens:** All hardcoded hex colors and font sizes are replaced by a unified `theme.ts` token system.
2. **Global Layout & Distill (Header):** A universal `ProfileDropdown` component cleans up the headers across all routes. Destructive actions like "Log Out" and secondary navigation are hidden behind the avatar, leaving only one primary action per screen.
3. **Global Adapt (Mobile FABs):** Primary creation actions (`+ New Tab`, `+ Add Product`, `+ Invite Staff`, `+ Draft Requisition`) automatically adapt to Floating Action Buttons (FABs) anchored to the bottom right on mobile devices, ensuring thumb reachability.
4. **Global Quieter & Animate (Toasts):** A global `ToastProvider` replaces all inline static success/error banners with elegant, animated, auto-dismissing notifications using tinted neutrals instead of fully saturated red/green.
5. **Accessible Typography:** A strict typography floor is enforced app-wide. No metadata or badge text falls below `13px` with proper tracking.

---

## User Acceptance Testing (UAT) Contract

### 1. Global Distill & Adapt UAT
- **Action:** Open the `Team`, `Catalog`, and `Open Orders` screens on an iPhone simulator.
- **Expected Outcome:** The top header is clean (just Title and Profile Avatar). At the bottom right of the screen, a clear `+` FAB exists for adding a User, Product, or Tab respectively.
- **Evidence Required:** Three screenshots showing the FAB on Team, Catalog, and Sales routes.

### 2. Global Quieter & Typeset UAT
- **Action:** Inspect the badges on the Catalog (Stock levels) and Team (Roles) screens. Trigger a failed login or failed form submission.
- **Expected Outcome:** Badges are readable (minimum `13px`). The error toast that appears uses a soft `#FDE8E8` background with dark red text, not a glaring solid `#FF3B30`. Disabled buttons have dark gray text, not invisible white text.
- **Evidence Required:** Screenshot of the Catalog badges and the triggered Error Toast.

### 3. Global Animate UAT
- **Action:** Settle an open tab OR delete a product from the Catalog.
- **Expected Outcome:** The card/list item scales down and fades out smoothly (`150ms`) before the layout reflows. The success Toast slides down from the top and dismisses automatically.
- **Evidence Required:** Screen recording (`.mov` or `.gif`) of an item being deleted/settled with the exit animation and Toast.

---

### Task 1: Polish & Typeset (Global Design Tokens & Typography)

**Files:**
- Create: `frontend/src/core/theme/tokens.ts`
- Modify: Search and replace across `frontend/src/app/**/*.tsx` and `frontend/src/features/**/*.tsx`

- [ ] **Step 1: Extract Tokens**
Create a `tokens.ts` file containing a semantic color palette (e.g., `colors.background.primary`, `colors.surface.card`, `colors.status.errorBg`) and a typography scale (`typography.sizes.sm = 13`, `typography.sizes.body = 16`).
- [ ] **Step 2: Refactor Hardcoded Values**
Replace all hardcoded `#F2F2F7`, `#FFFFFF`, `#111111`, etc., across the entire app with the new token system.
- [ ] **Step 3: Enforce Typography Floor**
Audit all text elements. Bump any `fontSize` of 10, 11, or 12px to a minimum of `13px`. Ensure buttons use `16px`.
- [ ] **Step 4: Fix Disabled Button Contrast**
Ensure all buttons across the app use dark gray text (`#8E8E93`) when disabled on a light gray background, rather than leaving the text white.
- [ ] **Step 5: Commit**
`git commit -m "refactor: implement global design tokens and enforce accessibility typography floor"`

---

### Task 2: Distill & Layout (Global Header Simplification)

**Files:**
- Create: `frontend/src/core/components/ProfileDropdown.tsx`
- Modify: `frontend/src/app/_layout.tsx` or individual screen headers (`(sales)/index.tsx`, `(admin)/*.tsx`)

- [ ] **Step 1: Build the ProfileDropdown**
Create a reusable component (using a Modal or Popover) that displays the user's avatar/email. When tapped, it reveals secondary actions (e.g., "Expenses", "Settings") and the "Log Out" button.
- [ ] **Step 2: Clean the Headers**
Remove inline "Log Out" and "Expenses" buttons from all screen headers across the `(sales)`, `(manager)`, and `(admin)` routes. Replace them with the `ProfileDropdown`.
- [ ] **Step 3: Commit**
`git commit -m "feat: distill global headers using a unified Profile Dropdown"`

---

### Task 3: Adapt (App-Wide Mobile FAB & Fluid Grids)

**Files:**
- Create: `frontend/src/core/components/ResponsiveFAB.tsx`
- Modify: `frontend/src/app/(sales)/index.tsx`
- Modify: `frontend/src/app/(admin)/catalog.tsx`
- Modify: `frontend/src/app/(admin)/team.tsx`

- [ ] **Step 1: Build the Responsive FAB**
Create a wrapper component that uses `useWindowDimensions()`. If `width >= 768`, it renders as a standard inline button (for the header). If `width < 768`, it renders as an absolute positioned Floating Action Button in the bottom right corner.
- [ ] **Step 2: Apply to Primary Actions**
Replace the hardcoded `+ New Tab`, `+ Add Product`, and `+ Invite Staff` buttons across the app with the `ResponsiveFAB`.
- [ ] **Step 3: Fluid Grid Layouts**
Audit the app for fragile percentage widths (e.g., `width: '31.5%'`). Refactor them to use `flexWrap: 'wrap'` with `flexGrow: 1` and `minWidth` so grids flow naturally on any screen size.
- [ ] **Step 4: Commit**
`git commit -m "feat: implement responsive mobile FABs and fluid grid layouts globally"`

---

### Task 4: Quieter & Animate (Global Toast Provider & Exit Animations)

**Files:**
- Create: `frontend/src/core/providers/ToastProvider.tsx`
- Modify: `frontend/src/app/_layout.tsx`
- Modify: Grid items in `(sales)/index.tsx`, `(admin)/catalog.tsx`

- [ ] **Step 1: Build the Animated Toast Provider**
Create a global context provider that can be called via `useToast()`. It should render a transient, animated toast at the top of the screen that auto-dismisses after 3 seconds. 
- [ ] **Step 2: Apply Quieter Colors**
Ensure the Toast uses tinted neutrals: `#FDE8E8` for errors, `#E8F8EE` for success. Remove all inline, manually dismissed banners across the app.
- [ ] **Step 3: Item Exit Animations**
Wrap order cards and catalog list items in `Animated.View` (from `react-native-reanimated` or core). When an item is deleted or settled, trigger a `150ms` animation (scale to `0.9`, opacity to `0`) before removing it from the state array.
- [ ] **Step 4: Capture UAT**
Run simulators for iPhone and iPad. Record a deletion/settlement animation and capture the Toast.
- [ ] **Step 5: Commit**
`git commit -m "feat: add global animated toast provider and item exit transitions"`
