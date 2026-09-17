# Kwata POS - Product Requirements Document

## 1. Product Overview

Kwata POS is a modern Point of Sale (POS) application designed specifically for a dual-business setup: a beer bar (retailing beer and soft drinks) and a roasted fish stand. The platform helps manage stock, track sales, handle restocking requisitions, and maintain a robust credit system for customers who pay at a later date.

### Tech Stack
- **Backend**: Rust (Axum framework)
- **Frontend**: React Native (Targeting Web, Android, iOS - with Mobile as the priority)

### Core Features
- **Open Order Management**: Bartenders can open tabs for tables/customers, continuously add products to the tab over the course of the visit, and settle the final bill when the customer is ready to leave.
- **Flexible Checkout & Credit Management**: When a tab is settled, payment can be accepted via Card, Bank Transfer, Cash, or marked as Credit. Marking as Credit requires the customer's name and phone number.
- **Stock Tracking & Requisition**: Track current inventory. Store managers can submit restock requisitions for super admin approval.
- **Role-based Access**: Super Admin, Store Manager, Sales Staff, and Customers.

---

## 2. User Personas

### 2.1. The Sales Staff / Bartender (Primary Persona)
**"I need to quickly open tabs, add rounds of drinks to them throughout the night, and settle them when the group leaves."**
- **Demographics**: 20-35 years old. Comfortable with smartphones but not necessarily tech-savvy. Works in a fast-paced, noisy environment.
- **Goals**: 
  - *Functional*: Quickly find open tables/orders, add new items without starting from scratch, and process complex checkouts.
  - *Emotional*: Feel confident and unstressed during peak hours.
- **Behaviors**: Relies heavily on mobile devices. Often multitasks between serving drinks and entering data.
- **Scenario**: A group sits at Table 4. The bartender opens an order for "Table 4". Over two hours, they add three rounds of beers to the order. When the group leaves, the bartender pulls up the open order and settles it via Bank Transfer.
- **Design Implications**: The primary dashboard for staff should be a grid of **Open Orders**, not just products. Opening an order and adding to an existing order must be 1-tap actions.

### 2.2. The Store Manager
**"I need to make sure we never run out of popular drinks, especially on weekends."**
- **Focus**: Inventory management, requisitions, daily reconciliation.

### 2.3. The Super Admin (Business Owner)
**"I need a bird's-eye view of my businesses to ensure sales match the cash and inventory."**
- **Focus**: Financial oversight, requisition approvals, credit debt tracking.

### 2.4. The Customer
**"I want to know exactly what I owe so there are no surprises when I settle my tab."**
- **Focus**: Transparency on credit balances.

---

## 3. Jobs-to-Be-Done (JTBD)

### 3.1. Job: Managing Open Tabs (New)
- **Situation**: When a group of customers arrives and orders multiple rounds over time...
- **Motivation**: I want to keep their order open and easily append items to it...
- **Expected Outcome**: So I don't have to checkout and take payment for every single drink, speeding up service.
- **Dimensions**:
  - *Functional*: Link an open cart state to a table number or temporary name.
  - *Emotional*: Avoid the stress of memorizing who ordered what.

### 3.2. Job: Flexible Settlement & Customer Credit
- **Situation**: When a tab is finalized and the customer wants to pay...
- **Motivation**: I want to record the exact payment method (Card, Transfer, Cash, or Credit)...
- **Expected Outcome**: So the end-of-day reconciliation matches the actual bank and cash drawer.
- **Dimensions**:
  - *Functional*: Support multi-modal checkouts and strict phone-number capture for credit.

### 3.3. Job: Managing Vendor Requisitions
- **Situation**: When stock levels drop and a large order is needed from a supplier...
- **Motivation**: I want to quickly generate a list of needed items, share it with the vendor via WhatsApp, and let them confirm or update the prices...
- **Expected Outcome**: So we have a documented agreement before delivery, and the delivery can be easily reconciled against the order.
- **Dimensions**:
  - *Functional*: Create requisition -> Share via Native UI (PDF/HTML Link) -> Vendor updates prices -> Accept Order -> Receive Items (partial or full) -> Mark as Paid.
  - *Social*: Professional, seamless communication with external vendors.

### 3.4. Job: Handling Direct Shop Expenses
- **Situation**: When the shop needs immediate supplies (cigarettes, fish, soap, serviettes) that don't come through formal vendors...
- **Motivation**: I want to request the cash from the owner, receive it, and log the receipt...
- **Expected Outcome**: So the cash drawer remains balanced and accountability is maintained.
- **Dimensions**:
  - *Functional*: Request Expense -> Owner Approves/Sends Money -> Mark Cash Received -> Upload Receipt.

---

## 4. User Journey Maps

### 4.1. The "Open Tab & Settle" Journey (Sales Staff)
**Scenario**: Managing a table's orders for the duration of their stay.

| Stage | 1. Open Tab | 2. Add Rounds (Ongoing) | 3. Present Bill | 4. Settle / Payment |
|---|---|---|---|---|
| **User Goals** | Start a new order for a seated group. | Add new drinks as requested quickly. | Calculate final total. | Process the final payment method. |
| **Actions** | Taps "New Order", enters "Table 4". | Opens "Table 4" from dashboard, adds items, hits "Save". | Opens "Table 4", reviews items. | Selects "Checkout", chooses "Bank Transfer" or "Credit". |
| **Touchpoints** | POS Dashboard (Open Orders View) | POS Order Detail / Menu | POS Checkout View | POS Payment Modal |
### 4.2. The "Vendor Requisition" Journey (Store Manager & Vendor)
**Scenario**: Manager needs to restock drinks from the main supplier.

| Stage | 1. Draft Request | 2. Share via WhatsApp | 3. Vendor Confirmation | 4. Delivery & Payment |
|---|---|---|---|---|
| **User Goals** | List needed items. | Send list to the vendor. | Vendor confirms/adjusts pricing. | Verify goods received and pay. |
| **Actions** | Selects items, hits "Share". | Uses native iOS/Android sharing to WhatsApp. | Vendor opens HTML link, edits prices, submits. | Manager marks partial/full delivery. Later marks Paid. |
| **Touchpoints** | POS App (Requisitions) | Native OS Share Sheet | Web Browser (External Link) | POS App (Requisitions) |
| **Pain Points** | Remembering last purchase price. | Transcribing orders to chat. | - | Vendor delivering less than ordered. |
| **Opportunities** | Show last purchase price automatically. | 1-tap PDF/Link generation. | Frictionless mobile-friendly vendor form. | Easy UI to adjust received quantities. |

### 4.3. The "Direct Shop Expense" Journey (Shop Keeper & Manager)
**Scenario**: Running out of soap and serviettes during a shift.

| Stage | 1. Request Cash | 2. Owner Approval | 3. Purchase | 4. Receipt Upload |
|---|---|---|---|---|
| **User Goals** | Ask for permission/funds. | Send money to staff. | Buy the items. | Prove accountability. |
| **Actions** | Enters amount and reason in app. | Reviews and sends mobile money. | Marks "Cash Received" in app. | Takes photo of vendor receipt, uploads to app. |
| **Opportunities** | Preset categories (Supplies, Fish, Cigarettes). | Push notification for instant approval. | - | Mandatory receipt upload for the transaction to close. |
