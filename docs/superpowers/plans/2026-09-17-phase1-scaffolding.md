# Phase 1: Foundation & Scaffolding Implementation Plan

> **Local DB (supersedes Task 1 below):** Homebrew `postgresql@17` on `5432`, user `akamaotto`, database `kwatapos`. Do not bind Docker Postgres to `5432`. See `ARCHITECTURE.md` §3.2.
>
> **Local HTTP (supersedes ports below):** Expo web `3011`, iOS `3012`, Android `3013`, API `3014`. Kwata range is 3011–3020; Poblysh uses 3000–3010.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the technical environments, folder structures, database container, and communication between a basic Rust backend and Expo frontend using Test-Driven Development (TDD).

**Architecture:** We are laying down the foundational Feature-First DDD structure for both the Rust Axum backend and React Native Expo frontend. This includes Docker setup for PostgreSQL and configuring specific ports to avoid conflicts (Backend: 8095, Frontend: 3010, 3011, 3012).

**Tech Stack:** Rust (Axum, Tokio), React Native (Expo SDK 57), PostgreSQL, Docker.

## Global Constraints

- Backend API must run on port `3014`.
- Expo must run web on `3011`.
- All features must follow the directories established in `ARCHITECTURE.md`.
- No code should use `3000`.

---

### Task 1: Docker & Database Setup

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: A running Postgres instance on port `5432` with credentials `kwata_admin` / `kwata_password`.

- [ ] **Step 1: Write `docker-compose.yml`**

Create `docker-compose.yml` at the root of the project with the following:

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
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

- [ ] **Step 2: Start the database**

Run the following commands in your terminal:
```bash
colima start
docker-compose up -d
```

- [ ] **Step 3: Verify the database is running**

Run:
```bash
docker ps | grep kwatapos_db
```
*Expected: You should see `kwatapos_db` running and listening on `0.0.0.0:5432`.*

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: setup postgres database via docker"
```

---

### Task 2: Scaffold Backend (Rust Axum) with TDD

We will build the health check endpoint using a strictly RED-GREEN-REFACTOR TDD loop.

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/tests/health_check_test.rs`

- [ ] **Step 1: Initialize Rust project and dependencies**

```bash
cargo new backend
cd backend
cargo add axum@0.8.9 tokio@1.53.1 --features tokio/full
cargo add serde@1.0 serde_json@1.0
cargo add --dev reqwest --features json
cargo add --dev tower --features util
cargo add --dev http-body-util
```

- [ ] **Step 2: RED - Write the failing test**

Create the `backend/tests/health_check_test.rs` file. This test will simulate an HTTP request to our router before the router even exists.

```rust
use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;
use serde_json::Value;

// We will test the router directly without spinning up a TCP listener
#[tokio::test]
async fn test_health_check_returns_200_and_json() {
    let app = backend::app(); // 'app' function doesn't exist yet!

    let response = app
        .oneshot(Request::builder().uri("/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = http_body_util::BodyExt::collect(response.into_body()).await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["status"], "ok");
    assert_eq!(json["message"], "System Online");
}
```

- [ ] **Step 3: Run the test (Verify it fails)**

```bash
cargo test
```
*Expected: Compilation failure because `backend::app()` is not defined.*

- [ ] **Step 4: GREEN - Write the minimal implementation**

Modify `backend/src/main.rs` to make the test pass. We will export the `app()` function so the test can use it. Update `backend/src/lib.rs` to expose the app if needed, or define it directly in `main.rs`. Let's create `backend/src/lib.rs` for testability:

Create `backend/src/lib.rs`:
```rust
use axum::{routing::get, Router, response::Json};
use serde_json::{Value, json};

pub fn app() -> Router {
    Router::new().route("/api/health", get(health_check))
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok", "message": "System Online" }))
}
```

Update `backend/src/main.rs`:
```rust
use backend::app;

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8095").await.unwrap();
    println!("Backend server listening on 8095");
    axum::serve(listener, app()).await.unwrap();
}
```

- [ ] **Step 5: Run the test (Verify it passes)**

```bash
cargo test
```
*Expected: PASS.*

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/
git commit -m "feat: setup rust axum backend with TDD health check on port 8095"
```

---

### Task 3: Scaffold Frontend (React Native Expo) with TDD

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/app.json`
- Create: `frontend/src/app/index.tsx`
- Create: `frontend/src/app/index.test.tsx`

- [ ] **Step 1: Initialize Expo project**

```bash
npx create-expo-app@latest frontend --template blank
cd frontend
```

- [ ] **Step 2: Configure Ports & Install Router/Jest**

Update `frontend/package.json` scripts:
```json
  "scripts": {
    "start": "expo start --port 3010",
    "android": "expo start --android --port 3012",
    "ios": "expo start --ios --port 3011",
    "web": "expo start --web --port 3010",
    "test": "jest"
  }
```

Install Dependencies:
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest
```

Setup `frontend/jest.config.js`:
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
};
```

Update `frontend/app.json`:
```json
{
  "expo": {
    "scheme": "kwatapos",
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": true }
  }
}
```

- [ ] **Step 3: RED - Write the failing test**

Create `frontend/src/app/index.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Home from './index';

describe('Home Screen', () => {
  it('displays the loading state initially', () => {
    render(<Home />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test (Verify it fails)**

```bash
npm run test
```
*Expected: Fail because `index.tsx` does not exist.*

- [ ] **Step 5: GREEN - Write the minimal implementation**

Create `frontend/src/app/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  const [status, setStatus] = useState('Loading...');

  // Minimal implementation to pass the test and fetch data
  useEffect(() => {
    fetch('http://127.0.0.1:8095/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(err => setStatus('Backend Offline'));
  }, []);

  return (
    <View style={styles.container}>
      <Text>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 6: Run the test (Verify it passes)**

```bash
npm run test
```
*Expected: PASS.*

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: setup expo frontend with jest TDD checking backend health"
```
