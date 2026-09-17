# Kwata POS - Architecture & Project Structure

This document outlines the architectural patterns, folder structures, and local environment setup for the Kwata POS application. We are adopting a **Feature-First Domain-Driven Design (DDD)** approach for both the backend and frontend to ensure high cohesion, low coupling, and scalability as the business grows.

## 1. Backend Architecture (Rust + Axum)

The backend follows a **Feature-First DDD** structure implementing the **Controller-Service-Repository** pattern. Instead of grouping files by technical concern (e.g., all controllers together), we group them by business feature.

### 1.1 Directory Structure

```text
backend/
├── Cargo.toml
├── docker-compose.yml      # Defines PostgreSQL service
├── src/
│   ├── main.rs             # Application entrypoint & server bootstrap
│   ├── config/             # Environment vars, DB connection pooling
│   ├── shared/             # Shared utilities, global error handling, middleware
│   │   ├── error.rs
│   │   └── middleware.rs
│   └── features/           # Domain modules
│       ├── auth/
│       ├── inventory/
│       └── sales/
│           ├── mod.rs          # Module export and Axum router setup for the feature
│           ├── controller.rs   # Axum HTTP handlers (Request -> Service -> Response)
│           ├── service.rs      # Business logic and domain rules
│           ├── repository.rs   # Database access layer (sqlx queries)
│           └── dto.rs          # Data Transfer Objects (Requests/Responses)
```

### 1.2 The Pattern
- **Controller Layer:** Strictly handles HTTP requests, extracts parameters/JSON, calls the Service layer, and formats the HTTP response.
- **Service Layer:** Contains the core business logic. It orchestrates validations and calls the Repository layer. It does not know about HTTP or Databases.
- **Repository Layer:** Handles all data persistence. This is the only layer that interacts with `sqlx` and the database.

---

## 2. Frontend Architecture (React Native + Expo)

The frontend adopts a similar Feature-First approach, heavily inspired by "Screaming Architecture" and Feature-Sliced Design. Expo Router will handle the routing, but the core business logic will live outside the `app/` directory.

### 2.1 Directory Structure

```text
frontend/
├── package.json
├── app.json
├── src/
│   ├── app/                # Expo Router files ONLY (UI entrypoints)
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── _layout.tsx
│   ├── core/               # App-wide shared resources
│   │   ├── api/            # Base Axios/fetch client setup
│   │   ├── components/     # Generic UI (Buttons, Cards - from DESIGN.md)
│   │   ├── hooks/          # Global hooks (useTheme, useAuth)
│   │   └── theme/          # Design tokens and styles
│   └── features/           # Domain-specific modules
│       ├── auth/
│       ├── inventory/
│       └── sales/
│           ├── components/ # UI components specific to Sales (e.g., CartItem)
│           ├── hooks/      # Sales-specific React hooks
│           ├── api/        # TanStack Query hooks and API calls for Sales
│           ├── store/      # Local state (Zustand/Context) for Sales
│           └── types/      # TypeScript interfaces for Sales
```

### 2.2 The Pattern
- **`src/app/`**: Keeps routing logic flat and minimal. Files here simply import and render feature components.
- **`src/features/`**: Encapsulates everything a feature needs to work. If you delete the `sales/` folder, all sales-related API calls, state, and components are cleanly removed without breaking other features (barring explicit cross-feature imports).

---

## 3. Local Environment & Ports

To prevent conflicts with other local projects (like Next.js on port 3000), we have assigned dedicated ports for the Kwata POS ecosystem.

### 3.1 Port Assignments
- **Backend API:** `8095`
- **Frontend - Expo Web:** `3010`
- **Frontend - Expo iOS:** `3011`
- **Frontend - Expo Android:** `3012`
- **PostgreSQL Database:** `5432` (Standard)

*Note: Expo can be configured to run on specific ports using the `--port` flag (e.g., `npx expo start --web --port 3010`).*

### 3.2 Database & Docker Setup
We are using Docker from Day 1 to ensure environmental consistency. Since **Colima** is installed on this Mac, it will serve as the lightweight Docker runtime.

A `docker-compose.yml` in the `backend/` directory will spin up the PostgreSQL instance:

```yaml
version: '3.8'
services:
  db:
    image: postgres:17-alpine
    container_name: kwatapos_db
    environment:
      POSTGRES_USER: kwata_admin
      POSTGRES_PASSWORD: kwata_password
      POSTGRES_DB: kwatapos
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**To start the database:**
```bash
colima start
cd backend && docker-compose up -d
```
