# Kwata POS - Agent & Developer Culture

This file (`AGENTS.md`) serves as the core instruction manual for any AI agents (or human developers) working on the Kwata POS codebase. Before taking action, ensure your plans align with these cultural and structural directives.

---

## 1. Development Culture

- **Safety & Integrity First:** Kwata POS handles sales, inventory, and credit. We prioritize predictable, strongly-typed code (Rust, TypeScript) over rapid, untested iteration.
- **Feature-First DDD:** We do not group code by technical layer. Both the Rust Backend and the Expo Frontend encapsulate logic by business domain (e.g., `sales`, `inventory`, `auth`).
- **Clean Scaffolding:** No placeholders ("TODO", "TBD"). When generating code, generate complete, working implementations with necessary error handling.
- **Atomic Commits:** Commits should be bite-sized and focused on a single responsibility. Use Conventional Commits (`feat:`, `fix:`, `chore:`).

---

## 2. Git Workflow

We utilize a structured promotion pipeline to protect production data and ensure high-quality releases.

### Branch Topology
- `main` - **Production.** The stable source of truth. Always deployable.
- `staging` - **UAT / Pre-Production.** Used for final QA testing against production-like data.
- `develop` - **Integration.** Where all new features land and are integrated together.
- `feature/*` - **Active Development.** Branched off `develop`. Where the actual work happens.
- `hotfix/*` - **Emergency Fixes.** Branched off `main`, merged back to both `main` and `develop`.

### The Golden Rules of Promotion
1. **Feature Integration:** `feature/*` branches are merged EXCLUSIVELY into `develop`. 
2. **No Direct Feature Merges:** Never merge a `feature/*` branch directly into `staging` or `main`.
3. **Sequential Promotion:** Code must flow sequentially: `develop` -> `staging` -> `main`.
4. **No Skipping:** Never promote directly from `develop` to `main`. `staging` must always be the intermediary validation step.

---

## 3. Project Constraints

### Local Environment Ports
To prevent conflicts with common default apps (like Next.js on 3000), always adhere to the following assignments:
- **Expo Web:** `3010`
- **Expo iOS Simulator:** `3011`
- **Expo Android Emulator:** `3012`
- **Rust Backend API:** `8095`
- **PostgreSQL Database:** `5432`

### Command & Debugging Tools
- Use the `argent-*` suite of skills (e.g., `argent-ios-simulator-setup`, `argent-device-interact`, `argent-metro-debugger`) to seamlessly interact with React Native emulators.
- The PostgreSQL instance is managed via Docker (running on Colima). Ensure containers are running (`docker-compose up -d`) before executing integration tests.
