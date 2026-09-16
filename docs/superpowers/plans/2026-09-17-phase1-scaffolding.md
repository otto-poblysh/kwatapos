# Phase 1: Foundation & Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the technical environments, folder structures, database container, and communication between a basic Rust backend and Expo frontend.

**Architecture:** We are laying down the foundational Feature-First DDD structure for both the Rust Axum backend and React Native Expo frontend. This includes Docker setup for PostgreSQL and configuring specific ports to avoid conflicts (Backend: 8095, Frontend: 3010, 3011, 3012).

**Tech Stack:** Rust (Axum, Tokio), React Native (Expo SDK 57), PostgreSQL, Docker.

## Global Constraints

- Backend API must run on port `8095`.
- Expo must run web on `3010`.
- All features must follow the directories established in `ARCHITECTURE.md`.
- No code should use `3000`.

---

## Required Simulator & Debugging Skills

To easily access, control, and debug simulators to ensure everything is wired up properly during development, the following agent skills should be utilized:
- `argent-ios-simulator-setup`: To boot and manage the iOS Simulator.
- `argent-android-emulator-setup` (and `android-cli`): To boot and manage the Android Emulator via Colima/AVD.
- `argent-device-interact`: To click, swipe, and navigate through the Expo app on simulators.
- `argent-metro-debugger`: To interact with the Metro bundler logs.
- `argent-screenshot-diff`: To compare the rendered UI against our expectations in `DESIGN.md`.

---

### Task 1: Docker & Database Setup

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: A running Postgres instance on port `5432` with credentials `kwata_admin` / `kwata_password`.

- [ ] **Step 1: Write `docker-compose.yml`**

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

```bash
# Ensure colima is running first
colima start
docker-compose up -d
```

- [ ] **Step 3: Verify the database is running**

```bash
docker ps | grep kwatapos_db
```
Expected: Output showing `kwatapos_db` running and listening on `0.0.0.0:5432`.

- [ ] **Step 4: Commit**

```bash
git init
git add docker-compose.yml
git commit -m "chore: setup postgres database via docker"
```

---

### Task 2: Scaffold Backend (Rust Axum)

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`

**Interfaces:**
- Consumes: Database (though not wired yet, ports reserved).
- Produces: API running on `http://127.0.0.1:8095/api/health`.

- [ ] **Step 1: Initialize Rust project**

```bash
cargo new backend
```

- [ ] **Step 2: Add dependencies**

```bash
cd backend
cargo add axum@0.8.9 tokio@1.53.1 --features tokio/full
cargo add serde@1.0 serde_json@1.0
```

- [ ] **Step 3: Write minimal implementation in `backend/src/main.rs`**

```rust
use axum::{routing::get, Router, response::Json};
use serde_json::{Value, json};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/health", get(health_check));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8095").await.unwrap();
    println!("Backend server listening on 8095");
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok", "message": "System Online" }))
}
```

- [ ] **Step 4: Run server & test endpoint**

Run server in background (or separate terminal):
```bash
cargo run &
```
Test:
```bash
curl http://127.0.0.1:8095/api/health
```
Expected: `{"message":"System Online","status":"ok"}`.
*(Kill background process after test).*

- [ ] **Step 5: Commit**

```bash
cd ..
git add backend/
git commit -m "feat: setup rust axum backend on port 8095"
```

---

### Task 3: Scaffold Frontend (React Native Expo)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/app.json`
- Create: `frontend/src/app/index.tsx`
- Create: `frontend/src/app/_layout.tsx`

**Interfaces:**
- Consumes: API at `http://127.0.0.1:8095/api/health`.
- Produces: Expo app running locally.

- [ ] **Step 1: Initialize Expo project**

```bash
npx create-expo-app@latest frontend --template blank
```

- [ ] **Step 2: Configure Ports & Dependencies**

Modify `frontend/package.json` scripts to enforce ports:
```json
  "scripts": {
    "start": "expo start --port 3010",
    "android": "expo start --android --port 3012",
    "ios": "expo start --ios --port 3011",
    "web": "expo start --web --port 3010"
  }
```
Install Expo Router:
```bash
cd frontend
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- [ ] **Step 3: Setup routing entrypoints**

Update `frontend/package.json` main entry:
```json
  "main": "expo-router/entry"
```

Update `frontend/app.json` to configure router:
```json
{
  "expo": {
    "scheme": "kwatapos",
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

Create `frontend/src/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function Layout() {
  return <Stack />;
}
```

Create `frontend/src/app/index.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Home() {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    fetch('http://127.0.0.1:8095/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.message))
      .catch(err => setStatus('Backend Offline'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  }
});
```

- [ ] **Step 4: Verify Web App**

```bash
npm run web
```
*(Ensure it boots on port 3010 and displays "Backend Offline" or "System Online" if backend is running).*

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: setup expo router frontend checking backend health"
```
