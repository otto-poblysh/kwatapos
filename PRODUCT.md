# Kwata POS - Product Requirements Document

## 1. Product Overview

Kwata POS is a modern Point of Sale (POS) application designed specifically for a dual-business setup: a beer bar (retailing beer and soft drinks) and a roasted fish stand. The platform helps manage stock, track sales (differentiating orders from payments), handle restocking requisitions, and maintain a robust credit system for customers who pay at a later date.

### Tech Stack
- **Backend**: Rust (Axum framework)
- **Frontend**: React Native (Targeting Web, Android, iOS - with Mobile as the priority)

### Core Features
- **Sales & Credit Management**: Separate order entry from payment. Ability to actively mark transactions as "credit", requiring the customer's name and phone number.
- **Stock Tracking & Requisition**: Track current inventory. Store managers can submit restock requisitions for super admin approval.
- **Role-based Access**: Super Admin, Store Manager, Sales Staff, and Customers.
- **Authentication**: Staff login via email or phone number and password. Customer accounts to track their own purchases and credit balances.

---

## 2. User Personas

### 2.1. The Sales Staff (Primary Persona)
**"I need to quickly enter orders and keep track of who owes what during a busy Friday night."**
- **Demographics**: 20-35 years old. Comfortable with smartphones but not necessarily tech-savvy. Works in a fast-paced, noisy environment.
- **Goals**: 
  - *Functional*: Enter orders rapidly without making mistakes.
  - *Emotional*: Feel confident and unstressed during peak hours.
- **Frustrations**: Complex POS interfaces that slow down order taking; forgetting who took what on credit; arguments with customers over unrecorded payments.
- **Behaviors**: Relies heavily on mobile devices. Often multitasks between serving drinks, talking to customers, and entering data.
- **Scenario**: A group orders drinks and fish. They ask to put it on their tab. The staff member needs to quickly find or add the customer, log the items, and mark it as credit without keeping other customers waiting.
- **Design Implications**: The mobile UI must be highly intuitive, with large touch targets. The "Mark as Credit" flow must be seamless but explicit, ensuring phone numbers are captured without breaking the flow.

### 2.2. The Store Manager
**"I need to make sure we never run out of popular drinks, especially on weekends."**
- **Demographics**: 30-45 years old. Responsible for daily operations and stock balancing.
- **Goals**: 
  - *Functional*: Easily request new stock and track current inventory levels.
  - *Emotional*: Feel in control of the business's day-to-day operations.
- **Frustrations**: Running out of stock unexpectedly; delays in getting restock approvals from the owner.
- **Behaviors**: Checks inventory at the end of the shift. Uses the POS on a tablet or web dashboard to submit requisitions.
- **Scenario**: At closing time, they notice beer stock is low. They open the app, select the required quantities, and submit a requisition.
- **Design Implications**: Needs clear, at-a-glance dashboard views of low-stock items. Requisition forms should auto-suggest amounts based on recent sales.

### 2.3. The Super Admin (Business Owner)
**"I need a bird's-eye view of my businesses to ensure sales match the cash and inventory."**
- **Demographics**: 40-55 years old. Manages finances and multiple business units (Bar vs. Fish stand).
- **Goals**: 
  - *Functional*: Approve requisitions, manage staff access, and reconcile sales vs. cash/credit.
  - *Emotional*: Peace of mind that the business is secure and profitable.
- **Frustrations**: Unaccounted stock shrinkage; uncollected debts; complicated accounting.
- **Behaviors**: Reviews reports periodically. Prefers a web interface for detailed reviews but wants mobile access for quick approvals.
- **Scenario**: Receives a notification for a stock requisition. Reviews the current stock numbers vs. requested numbers and clicks "Approve".
- **Design Implications**: Needs high-level analytics, clear approval workflows, and strict permission management.

### 2.4. The Customer
**"I want to know exactly what I owe so there are no surprises when I settle my tab."**
- **Demographics**: Regular patrons, varied ages.
- **Goals**: 
  - *Functional*: Check current credit balance and past purchase history.
  - *Emotional*: Feel trusted by the business and in control of their spending.
- **Frustrations**: Disputes over what was ordered; not knowing how much they currently owe.
- **Behaviors**: Logs in occasionally from their own phone to check balances or when preparing to pay off a tab.
- **Scenario**: After a week of visiting the bar, they log into the web/mobile app to see their total credit balance before coming in to pay.
- **Design Implications**: Simple, read-only interface displaying clear itemized bills and total outstanding balances.

---

## 3. Jobs-to-Be-Done (JTBD)

### 3.1. Job: Managing Customer Credit
- **Situation**: When a regular customer wants to consume now and pay later...
- **Motivation**: I want to accurately record the debt against their specific profile...
- **Expected Outcome**: So I can collect the exact payment later without disputes.
- **Dimensions**:
  - *Functional*: Link an unpaid order to a customer profile (phone number).
  - *Emotional*: Feel secure that the money won't be lost.
  - *Social*: Maintain a friendly, trusting relationship with the patron.

### 3.2. Job: Restocking Inventory
- **Situation**: When stock levels for popular items drop below a safe threshold...
- **Motivation**: I want to quickly request a restock from the owner...
- **Expected Outcome**: So the business can continue operating without turning customers away.
- **Dimensions**:
  - *Functional*: Submit a requisition list for approval.
  - *Emotional*: Avoid the anxiety of running out of core products.
  - *Social*: Look competent and prepared as a manager.

### 3.3. Job: Reconciling Daily Sales
- **Situation**: When the shift is over...
- **Motivation**: I want to separate actual cash received from orders placed on credit...
- **Expected Outcome**: So I can ensure the cash drawer matches the system perfectly.
- **Dimensions**:
  - *Functional*: View separate totals for payments received and new credit issued.
  - *Emotional*: Feel relieved that the day's numbers balance out.

---

## 4. User Journey Maps

### 4.1. The "Credit Order" Journey (Sales Staff)
**Scenario**: Taking a large order during a busy shift and putting it on credit.

| Stage | 1. Order Entry | 2. Checkout Decision | 3. Credit Assignment | 4. Confirmation |
|---|---|---|---|---|
| **User Goals** | Quickly add drinks and fish to the cart. | Determine payment method. | Assign debt to the correct person. | Move to the next customer. |
| **Actions** | Taps item icons, adjusts quantities. | Taps "Pay later / Credit". | Enters customer phone number or searches name. | Sees success screen, hands drinks over. |
| **Touchpoints** | Mobile POS App (Menu Screen) | Mobile POS App (Checkout) | Mobile POS App (Customer Search/Add) | Mobile POS App |
| **Thoughts** | "Where is that specific roasted fish option?" | "Customer says they will pay tomorrow." | "I hope they are already in the system." | "Great, done. Next!" |
| **Emotions** | Neutral (focused) | Neutral | Slightly anxious (if adding new user takes long) | Positive (relieved) |
| **Pain Points** | Hard to find items if menu is cluttered. | - | Typing phone numbers on a small screen in a hurry. | - |
| **Opportunities** | Large, color-coded touch targets. | Clear visual distinction between "Pay Now" and "Credit". | Auto-suggest customers by recent visits; fast "Add New" flow. | Instant visual feedback. |

### 4.2. The "Requisition Approval" Journey (Store Manager & Admin)
**Scenario**: Manager notices low stock and requests a restock from the Admin.

| Stage | 1. Identify Need | 2. Submit Request (Manager) | 3. Review (Admin) | 4. Approval (Admin) | 5. Restock (Manager) |
|---|---|---|---|---|---|
| **User Goals** | Spot what is running low. | Send a list of needed items to the owner. | Verify the request is justified. | Authorize the purchase. | Update system once stock arrives. |
| **Actions** | Checks fridge/system. | Creates requisition draft, submits. | Opens notification, reviews current stock vs. request. | Taps "Approve". | Marks requisition as "Received". |
| **Touchpoints** | Physical Store / POS Dashboard | POS App (Requisition Screen) | Mobile/Web App (Admin Dashboard) | Admin Dashboard | POS App |
| **Thoughts** | "We are almost out of drinks." | "Hope the boss approves this fast." | "Do we really need this much?" | "Approved." | "Stock is here and logged." |
| **Emotions** | Anxious | Hopeful | Analytical | Confident | Relieved |
| **Pain Points** | Manually counting stock takes time. | Typing out long lists. | Lack of context (current stock level) when reviewing. | - | Forgetting to mark as received. |
| **Opportunities** | System alerts for low stock. | Auto-populate requisition based on low stock alerts. | Show current stock and recent sales velocity next to the request. | Push notification for instant approval. | 1-tap "Mark all received" button. |
