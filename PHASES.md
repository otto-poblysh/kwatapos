# Kwata POS - Project Phases & Deliverables

To ensure steady progress and allow for regular team reviews, the development of Kwata POS is broken down into the following distinct phases. Each phase culminates in a tangible, demonstrable deliverable.

---

## Phase 1: Foundation & Scaffolding
**Goal:** Establish the technical environments, folder structures, and communication between frontend, backend, and database.
**Tasks:**
- Initialize the Rust Axum backend and Expo React Native frontend.
- Use Homebrew `postgresql@17` on `5432` as user `akamaotto` (database `kwatapos`, sharing the cluster with Poblysh’s `poblysh`). Do not bind Docker Postgres to `5432`.
- Implement the Feature-First DDD folder structures outlined in `ARCHITECTURE.md`.
- Configure the specific ports (Backend: 3014, Web: 3011, iOS: 3012, Android: 3013; Kwata range 3011–3020).
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

## Phase 4: Open Orders & Flexible Checkout (Tabs & Credit)
**Goal:** Align the POS with real-world bar operations by allowing staff to keep orders open over time and settle them with various payment methods.
**Tasks:**
- Modify the `orders` database schema to include `status` (Open, Closed), `order_name` (e.g., Table 4), and `payment_method` (Cash, Card, Transfer, Credit).
- Build backend APIs to Create an Open Order, Append items to it, and Settle it.
- Create the `customers` and `credits` database tables to support the Credit payment method.
- Redesign the Sales Frontend: The primary view becomes a grid of "Open Orders".
- Build the Flexible Settlement Modal: When settling, staff can choose Card, Transfer, Cash, or Credit (which triggers the customer phone number capture).
**Deliverable (Demo):** 
> A Sales Staff member creates an order for "Table 4". Over an hour, they append three rounds of drinks to it. Finally, they open the order, hit "Settle", and select "Bank Transfer". The order is closed and inventory is properly decremented.

---

## Phase 5: Inventory Requisitions, Vendor Collaboration & Direct Expenses
**Goal:** Empower Managers to restock efficiently via native sharing, collaborate with external vendors, and process direct cash expenses transparently.
**Tasks:**
- Create `requisitions` and `direct_expenses` tables.
- Build the Manager UI to draft requisitions showing the *last purchase price*.
- Implement `expo-sharing` and `expo-print` to generate a PDF/Link and share it natively (e.g., to WhatsApp).
- Build a lightweight external Web UI for the Vendor to confirm or adjust prices.
- Implement the "Delivery & Payment" flow: Manager marks items as Received (adjusting quantities if necessary), and later marks the invoice as Paid.
- Build the Direct Expense flow: Shop keeper requests cash, manager approves, shop keeper uploads the physical receipt via `expo-camera`/`expo-image-picker`.
**Deliverable (Demo):** 
> A Manager drafts a requisition for Beer and taps "Share". WhatsApp opens. The vendor clicks the shared link, updates a price, and submits. The Manager sees the update, accepts it, and later logs that only 8 of 10 crates were actually delivered, finally marking the adjusted invoice as Paid. Meanwhile, a Shop Keeper requests 5,000 FCFA for soap, marks it received, and uploads a photo of the receipt.

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

## Phase 7: Advanced Admin & Granular RBAC
**Goal:** Empower the business owner with full control over the system, staff permissions, and core data.
**Tasks:**
- Implement granular permissions schema (`permissions`, `role_permissions`, `user_permissions`).
- Build Admin CRUD for Users and Roles, including permission toggling.
- Build Admin CRUD for Core Features (Products, Customers, Inventory adjustments).
- Implement backend middleware to enforce granular permissions on API routes.
**Deliverable (Demo):** 
> The Super Admin navigates to the "Team" dashboard, creates a new custom role "Weekend Staff" with restricted permissions, assigns it to a new user, and then updates the price of a product in the "Catalog" dashboard.

---

## Phase 8: Final Polish, Optimization & Launch Prep
**Goal:** Ensure the app is production-ready, beautiful, and performant.
**Tasks:**
- Conduct a rigorous audit against `DESIGN.md` (checking padding, typography, shadow removals).
- Optimize backend queries (N+1 issues) and add necessary database indexes.
- Set up EAS Build for Expo to generate native binaries.
- Conduct final QA testing on physical devices.
**Deliverable (Demo):** 
> The final, polished application is installed as a native app on a physical iPhone and Android device, ready for deployment to the bar staff.
