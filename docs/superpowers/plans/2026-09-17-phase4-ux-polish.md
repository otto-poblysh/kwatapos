# UX Polish Implementation Plan: Phase 4 Open Orders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the fixes outlined in the UX Critique (`docs/superpowers/ux-critiques/2026-09-17-phase4-critique.md`) to elevate the Open Orders POS screen. This involves ruthless simplification, typography accessibility fixes, mobile touch adaptations, and motion continuity.

**Architecture/Tech Stack:** React Native (Expo Router), React Native `Animated` or `react-native-reanimated`, centralized theme tokens.

## Visible Tangible Outcomes
1. **Simplified Header:** "Log Out" and "Expenses" are moved into a profile dropdown.
2. **Mobile FAB:** On mobile screens, the `+ New Tab` action drops from the header into a Floating Action Button (FAB) at the bottom right.
3. **Accessible Typography:** All metadata badges (`11px` and `12px`) are bumped to a minimum of `13px` with proper tracking.
4. **Animated Interactions:** When a tab is settled, its card scales down and fades out rather than vanishing instantly. The manual green success banner is replaced by an auto-dismissing toast.

---

## User Acceptance Testing (UAT) Contract

### 1. Distill & Adapt UAT
- **Action:** Open the POS on a mobile simulator (iPhone) and a tablet simulator (iPad).
- **Expected Outcome:** On iPhone, there is a `+` FAB in the bottom right corner, and the header only contains the profile avatar. On iPad, the `+ New Tab` button remains in the header.
- **Evidence Required:** Split screenshot showing both the mobile FAB and the desktop/tablet header layout.

### 2. Quieter & Typeset UAT
- **Action:** Create a new tab. Look at the typography of the order card badges and test a tab creation error.
- **Expected Outcome:** The badge font sizes are readable (`13px` minimum). If an error occurs, the red error banner uses a muted, tinted red background rather than a screaming solid `#FF3B30`. The disabled "Create Tab" text is dark gray, not invisible white.
- **Evidence Required:** Screenshot of the new order card badges and the Error Modal.

### 3. Animate UAT
- **Action:** Settle an open tab.
- **Expected Outcome:** The tab card scales down to 90% and fades out over `150ms` before disappearing. A small, elegant success toast drops down from the top and auto-dismisses after 3 seconds.
- **Evidence Required:** Screen recording (`.mov` or `.gif`) of a tab being settled and animating out.

---

### Task 1: Polish & Typeset (Design Tokens & Typography)

**Files:**
- Create: `frontend/src/core/theme/tokens.ts` (if it doesn't exist)
- Modify: `frontend/src/app/(sales)/index.tsx`

- [ ] **Step 1: Extract Tokens**
Create a `tokens.ts` file containing a semantic color palette (e.g., `colors.background.primary = '#F2F2F7'`, `colors.status.errorBg = '#FDE8E8'`) and typography scale (`typography.labelSm = { fontSize: 13, letterSpacing: 0.5 }`).
- [ ] **Step 2: Apply Typography Floor**
In `index.tsx`, bump the `statusText`, `roleText`, and `itemCountText` from `11px` / `12px` to `13px`.
- [ ] **Step 3: Fix Disabled Contrast**
In the New Tab modal, update `disabledButton` so that the text color inside it turns to `#8E8E93` (dark gray) when disabled, rather than staying `#FFFFFF`.
- [ ] **Step 4: Commit**
`git commit -m "refactor: apply typography accessibility floor and extract design tokens"`

---

### Task 2: Distill & Layout (Simplifying the Header)

**Files:**
- Modify: `frontend/src/app/(sales)/index.tsx`
- Create: `frontend/src/core/components/ProfileDropdown.tsx`

- [ ] **Step 1: Remove Redundant Buttons**
Remove the `Expenses` and `Log Out` buttons from the `headerRight` layout.
- [ ] **Step 2: Profile Dropdown**
Build a simple `ProfileDropdown` (or a modal overlay acting as a menu) attached to the User Email/Role area in `headerLeft`. Move the `Expenses` routing and `logout()` function into this menu.
- [ ] **Step 3: Clean the Empty State**
Update the empty state subtitle to orient the user: *"Start a tab to keep track of drinks for a table or customer. You can add items now and settle the bill later."*
- [ ] **Step 4: Commit**
`git commit -m "feat: distill header actions into profile dropdown and update empty state"`

---

### Task 3: Adapt (Mobile FAB & Fluid Grid)

**Files:**
- Modify: `frontend/src/app/(sales)/index.tsx`

- [ ] **Step 1: Implement the FAB**
Use `useWindowDimensions()` to detect mobile vs tablet (`width < 768`). If mobile, remove `+ New Tab` from the header. Instead, render a Floating Action Button (`position: 'absolute', bottom: 24, right: 24`) for `+ New Tab`.
- [ ] **Step 2: Fluid Grid Layout**
Remove the fragile `width: '31.5%'` calculations. Use `flexWrap: 'wrap'` on the container, and set the cards to `flexGrow: 1, minWidth: 260`. This ensures they automatically fill available space on any screen size without relying on magic percentages.
- [ ] **Step 3: Commit**
`git commit -m "feat: adapt pos to use mobile FAB and fluid grid layout"`

---

### Task 4: Quieter & Animate (Alerts and Transitions)

**Files:**
- Create: `frontend/src/core/components/Toast.tsx`
- Modify: `frontend/src/app/(sales)/index.tsx`

- [ ] **Step 1: Remove the Static Banner**
Delete the `settledNotice` block that pushes the UI down. 
- [ ] **Step 2: The Quieter Error**
Update `modalErrorBanner` to use `#FDE8E8` for the background and `#991B1B` for the text.
- [ ] **Step 3: Build the Toast**
Create a transient toast component that accepts a message and auto-dismisses after 3 seconds. Use it to display the settlement success message over the UI rather than inline.
- [ ] **Step 4: Animate Card Exit**
Wrap the order cards in `Animated.View`. When a tab is settled (detect order removal from state), trigger a `150ms` animation that scales the card to `0.9` and sets `opacity` to `0` before unmounting it. 
- [ ] **Step 5: Capture UAT**
Run simulators for iPhone and iPad. Record the tab settlement animation.
- [ ] **Step 6: Commit**
`git commit -m "feat: add animated toast and card exit transitions"`
