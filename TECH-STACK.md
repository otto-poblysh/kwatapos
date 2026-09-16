# Kwata POS - Technology Stack

This document outlines the technical foundation for the Kwata POS application, detailing the languages, frameworks, libraries, and infrastructural components chosen to fulfill the product requirements.

## 1. System Architecture Overview

Following the guidelines for a small-to-medium team building a cohesive product with clear domain boundaries, we have opted for a **Modular Monolith** architecture for the backend API, coupled with a **Single Page Application (SPA) / Mobile Native App** strategy for the frontend.

- **Frontend Clients:** React Native handling Web, iOS, and Android seamlessly.
- **Backend Service:** A single Rust Axum server, logically divided into modules (Auth, Sales, Inventory, Requisitions, Users).
- **Database:** PostgreSQL for robust, ACID-compliant relational data management.

---

## 2. Backend Stack (Rust)

Rust provides exceptional memory safety, performance, and concurrency, making it ideal for a POS system where transaction integrity and speed are critical.

| Component | Choice | Version (Target) | Rationale |
| :--- | :--- | :--- | :--- |
| **Language** | Rust | `1.81+` | Memory-safe, highly concurrent, and performant. |
| **Web Framework** | `axum` | `0.8.9` | Ergonomic, modular, and built on top of Tokio. It provides excellent macro-free routing and middleware support. |
| **Async Runtime** | `tokio` | `1.53.1` | The industry-standard asynchronous runtime for Rust. |
| **Database ORM/Query**| `sqlx` | `0.9.0` | Async, pure Rust SQL crate featuring compile-time checked queries without the overhead of a heavy ORM. |
| **Serialization** | `serde` & `serde_json` | `1.0.x` | The defacto standard for fast and safe data serialization/deserialization. |
| **Authentication** | `jsonwebtoken` | `9.x` | JWT implementation for stateless API authentication (Access + Refresh tokens). |
| **Error Handling** | `thiserror` & `anyhow` | `1.0.x` | Standardized and ergonomic error handling across the application layers. |

---

## 3. Frontend Stack (React Native)

React Native allows a single codebase to target iOS, Android, and the Web. Given that mobile devices are the primary touchpoints for staff and customers, this is the optimal choice.

| Component | Choice | Version (Target) | Rationale |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React Native | `0.87.1` | Allows building native mobile apps and web apps from a unified codebase. |
| **App Toolchain** | Expo | `SDK 57` (expo: 57.0.23) | The standard toolchain for React Native development. Simplifies native modules, OTA updates, and building via EAS. |
| **Routing/Navigation** | React Navigation | `7.x` | (or Expo Router) Provides smooth, native-feeling transitions and deep linking capabilities out of the box. |
| **State Management** | Zustand or Redux Toolkit | Latest | Lightweight, unopinionated state management for handling cart states and user sessions. |
| **Data Fetching** | TanStack Query (React Query) | `5.x` | Handles caching, background updates, and stale data management for API requests perfectly. |
| **Styling** | NativeWind / StyleSheet | Latest | Given our custom `DESIGN.md` rules, strict StyleSheet objects or NativeWind (Tailwind for React Native) will be used to enforce our specific design tokens. |

---

## 4. Database & Storage

Based on our decision matrices for a POS system involving transactions, credits, and inventory:

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Primary Database** | PostgreSQL `16+` | The system requires strict ACID compliance for financial transactions and relational mapping between Orders, Users, Credits, and Stock levels. |
| **Caching (Optional Phase 2)**| Redis | If query load increases, Redis can be introduced to cache menu items, session tokens, or real-time inventory counts. |

---

## 5. Security & Authentication Strategy

- **Authentication Pattern:** JWT (JSON Web Tokens).
- **Flow:** 
  - User authenticates via email/phone and password.
  - Server returns a short-lived `access_token` (e.g., 15 mins) and a long-lived `refresh_token` (e.g., 7 days) stored securely (HttpOnly cookie for Web, Secure Storage for Native).
- **Authorization:** Role-Based Access Control (RBAC) enforced at the Axum middleware layer. Roles defined: `SuperAdmin`, `StoreManager`, `SalesStaff`, `Customer`.

---

## 6. Development & Operations

- **Formatting/Linting (Rust):** `rustfmt` and `clippy`.
- **Formatting/Linting (JS/TS):** `eslint` and `prettier`.
- **Containerization:** Docker for standardizing the Rust backend deployment and database environments.
- **CI/CD:** GitHub Actions to run tests, clippy checks, and build Expo variants.
