# Kwata POS - Project Phases & Deliverables

To ensure steady progress and allow for regular team reviews, the development of Kwata POS is broken down into the following distinct phases. Each phase culminates in a tangible, demonstrable deliverable.

---

## Phase 1: Foundation & Scaffolding
**Goal:** Establish the technical environments, folder structures, and communication between frontend, backend, and database.
**Tasks:**
- Initialize the Rust Axum backend and Expo React Native frontend.
- Set up Docker/Colima for PostgreSQL.
- Implement the Feature-First DDD folder structures outlined in `ARCHITECTURE.md`.
- Configure the specific ports (Backend: 8095, Web: 3010, iOS: 3011, Android: 3012).
- Apply initial design tokens (colors, typography) from `DESIGN.md` to the Expo app.
**Deliverable (Demo):** 
> The team can see an empty but styled React Native app running on Web, iOS, and Android simulators, successfully fetching a "System Online" message from the Rust backend connected to the local database.

---

## Phase 2: Authentication & User Management
**Goal:** Secure the application and implement role-based access.
**Tasks:**
- Create the `users` and `roles` database tables.
- Implement JWT-based authentication in Rust (Access + Refresh tokens).
- Build the Frontend Login screen.
- Set up React Navigation with protected routes (e.g., redirecting unauthenticated users to Login).
- Create basic dashboards based on roles (SuperAdmin, StoreManager, SalesStaff).
**Deliverable (Demo):** 
> A staff member can open the app, log in using their credentials, and be routed to their specific role-based dashboard. An invalid login is appropriately rejected.

---

## Phase 3: Core POS & Cash Sales
**Goal:** Build the primary tool for the Sales Staff—the Point of Sale interface.
**Tasks:**
- Create the `products` (menu items) and `inventory` database tables.
- Build backend APIs to fetch products and process basic orders.
- Develop the POS UI: a grid of drinks and fish, and a shopping cart sidebar/drawer.
- Implement the "Pay Now" checkout flow, reducing the inventory count upon completion.
**Deliverable (Demo):** 
> A Sales Staff member can tap items to add them to a cart, adjust quantities, and hit "Checkout -> Paid in Cash". The system records the sale and the inventory is updated.

---

## Phase 4: The Credit System
**Goal:** Implement the critical business requirement of tracking unpaid tabs.
**Tasks:**
- Create `customers` and `credits` database tables.
- Build the "Mark as Credit" checkout flow in the POS.
- Implement the flow to search for existing customers by phone number or quickly add a new customer during checkout.
- Build a view for Sales Staff to see outstanding tabs.
**Deliverable (Demo):** 
> A Sales Staff member processes a large order and selects "Credit". They quickly add a new customer's name and phone number. The order is finalized without cash, and the customer's outstanding balance is displayed.

---

## Phase 5: Inventory Requisitions
**Goal:** Empower Store Managers to restock without physical travel, and Super Admins to maintain control.
**Tasks:**
- Create `requisitions` database tables with status tracking (Pending, Approved, Received).
- Build the Store Manager UI to view low stock and submit a restock request.
- Build the Super Admin UI to review pending requisitions, compare against current stock, and approve them.
- Build the Store Manager flow to mark an approved requisition as "Received" to officially update inventory.
**Deliverable (Demo):** 
> A Store Manager submits a request for 5 crates of beer. The Super Admin logs in, sees the notification, and clicks "Approve". The Store Manager later clicks "Received", and the beer inventory instantly increases by the requested amount.

---

## Phase 6: Customer Portal & Daily Reconciliation
**Goal:** Provide transparency for customers and financial oversight for the business owner.
**Tasks:**
- Build a simplified read-only customer login flow.
- Develop the Customer UI showing their past orders and current credit balance.
- Build the Super Admin "End of Shift" dashboard, aggregating total sales, separating cash vs. credit, and showing top-selling items.
**Deliverable (Demo):** 
> A customer logs in on their own phone and sees exactly what they owe. The Super Admin reviews the daily dashboard, seeing precisely how much cash should be in the drawer versus how much new credit was issued that day.

---

## Phase 7: Final Polish, Optimization & Launch Prep
**Goal:** Ensure the app is production-ready, beautiful, and performant.
**Tasks:**
- Conduct a rigorous audit against `DESIGN.md` (checking padding, typography, shadow removals).
- Optimize backend queries (N+1 issues) and add necessary database indexes.
- Set up EAS Build for Expo to generate native binaries.
- Conduct final QA testing on physical devices.
**Deliverable (Demo):** 
> The final, polished application is installed as a native app on a physical iPhone and Android device, ready for deployment to the bar staff.
