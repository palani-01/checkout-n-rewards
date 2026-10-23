Architectural Decisions: Checkout & Rewards System

System Invariants
1.  Inventory Integrity: Product inventory quantities can never drop below zero; decrement operations are strictly guarded by check constraints.
2. Single-Use Coupons: A coupon with `usesRemaining: 1` can be successfully redeemed at most once. Once redeemed, its status transitions permanently to `REDEEMED` and `usesRemaining` becomes `0`.
3. Deterministic Financial Bounds: Order discounts are bounded such that the final total order amount is never negative (`finalTotalCents = Math.max(0, subtotalCents - discountCents)`).
4. Milestone Uniqueness: Exactly one milestone coupon is generated per threshold crossing (e.g., every $n$ orders), protected by prefix-based uniqueness checks.
5. Idempotent Safety: Retried checkouts with identical `Idempotency-Key` headers return the exact original response without duplicating orders, charging payments, or consuming inventory/coupons twice.


Identified Ambiguities & Selected Semantics
* Ambiguity 1: Concurrent Coupon Redemption. *Question:* What happens if two users submit checkouts concurrently using the same single-use coupon? 
  * *Selected Semantics:* First-come, first-served atomic win. The database transaction uses conditional atomic locking (`updateMany` with `usesRemaining: { gt: 0 }`). The second transaction fails cleanly with a concurrency conflict error.
* Ambiguity 2: Coupon Consumption on Failed Checkout. *Question:* If a checkout fails due to a simulated payment gateway timeout, is the coupon lost?
  * *Selected Semantics:* No. All checkout operations reside inside an ACID transaction (`prisma.$transaction`). A failure anywhere rolls back all changes, preserving the coupon's availability.

---

## Material Design Decisions

### Decision: 1. Concurrency Control via Atomic Updates
* Context: Preventing race conditions where two simultaneous checkouts deplete the same inventory or consume a single-use coupon.
* Options considered: (a) Application-level locks (Mutex), (b) Optimistic concurrency control with retry loops, (c) Atomic database conditional updates (`updateMany`).
* Choice: Atomic database conditional updates within Prisma transactions.
* Why: Avoids complex distributed locking overhead in single-node/lightweight environments while relying on database ACID guarantees to reject conflicting updates instantly.
* Consequences: Easier to guarantee correctness under concurrent request loads; harder if scaling across multiple independent database read-replicas without write-locking.

### Decision: 2. Integer-Based Currency Representation (Cents)
* Context: Avoiding floating-point rounding errors (e.g., `0.1 + 0.2 != 0.3`) when calculating item subtotals, percentage discounts, and final totals.
* Options considered: (a) JavaScript floats with `toFixed(2)`, (b) Decimal library (`decimal.js`), (c) Integer representation of cents.
* Choice: Integer cents (`unitPriceCents`, `subtotalCents`, `totalCents`).
* Why: Standard integer math is exact, highly performant, and natively supported across SQLite, Prisma, and JavaScript arithmetic.
* Consequences: Eliminates decimal drift entirely; requires formatting utilities (`formatCents`) on the frontend for currency display.

### Decision: 3. Idempotency Key Architecture
* Context: Preventing duplicate orders when clients retry network requests after timeouts or drops.
* Options considered: (a) Client-generated UUIDs stored in memory, (b) Database-backed `IdempotencyRecord` table storing cached responses.
* Choice: Database-backed `IdempotencyRecord` table mapping unique header keys to HTTP status codes and response bodies.
* Why: Survives server restarts and guarantees exact replay semantics even across serverless or containerized restarts.
* Consequences: Requires cleaning up old idempotency records over time in production; provides robust enterprise-grade reliability out of the box.

### Decision: 4. Automated vs. Manual Milestone Generation
* Context: How milestone rewards ($n$th order triggering $x$% off) should be minted.
* Options considered: (a) Strictly automated background cron jobs, (b) Admin-triggered evaluation endpoint, (c) Inline atomic checks during successful checkout combined with admin request support.
* Choice: Hybrid inline deterministic check during checkout + admin-triggered evaluation endpoint.
* Why: Satisfies both automated reward delivery upon milestone crossing and administrator manual control/verification.
* Consequences: Ensures rewards are immediately available to users without waiting for asynchronous background workers.

### Decision: 5. SQLite with Prisma ORM for Rapid Portability
* Context: Choosing a persistence layer that requires zero external server setup while offering strong relational typing.
* Options considered: (a) PostgreSQL with Docker, (b) MongoDB, (c) SQLite with Prisma.
* Choice: SQLite + Prisma.
* Why: Allows instant repeatable setup (`npx prisma migrate dev`) with zero external service dependencies or cloud configurations.
* Consequences: Perfect for standalone evaluation and local testing; requires migration to PostgreSQL/MySQL for multi-region active-active production scaling.

---

## Transaction, Concurrency, and Idempotency Strategy
* Transactions: Managed via Prisma's interactive transaction API (`prisma.$transaction`). Enforces atomicity across cart validation, inventory decrementing, coupon consumption, payment simulation, and order creation.
* Concurrency: Handled via database row-level locking and atomic `updateMany` predicates (`usesRemaining: { gt: 0 }`).
* Idempotency: Enforced via the `Idempotency-Key` HTTP header. The system checks for existing records before entering transaction blocks; if found, it immediately replays the cached response.

---

## Money and Rounding Rules
* All monetary values are stored and calculated as integer cents.
* Discount percentage calculations use standard rounding: `Math.round((subtotalCents * discountPercent) / 100)`.
* Bounded safety check: `if (discountCents > subtotalCents) discountCents = subtotalCents;` ensuring net totals are never negative.

---

## Error-Model Choices
* Client Errors (HTTP 400): Insufficient inventory, invalid or expired coupons, missing idempotency keys, unreached milestones, or duplicate coupon creation.
* Conflict Errors (HTTP 409 / 400): Concurrent coupon redemption conflicts or idempotency mismatches.
* Server Errors (HTTP 500): Unexpected database connection drops or unhandled runtime exceptions. All errors return structured JSON payloads: `{ success: false, error: "Detailed message" }`.

---

## Implemented Versus Intentionally Deferred
* Implemented: Full ACID checkout flow, inventory checks, single-use atomic coupons, automatic/manual milestone reward generation, idempotency caching, comprehensive admin reporting (`/api/admin/report`), and React UI with interactive coupon tagging.
* Deferred: User authentication/JWT authorization (assumed single admin/single user context for evaluation simplicity), asynchronous payment webhooks, and multi-currency exchange rate conversions.

---

## Evolution for Multiple Service Instances and Production Scale
1. Database Migration: Replace SQLite with a managed PostgreSQL cluster with connection pooling (e.g., Prisma Accelerate or PgBouncer).
2. Distributed Locking / Redis: Introduce Redis-backed distributed locks (`Redlock`) for high-throughput concurrent flash-sale checkouts to reduce database contention.
3. Event-Driven Architecture: Decouple milestone coupon generation and notification emails into asynchronous worker queues (e.g., RabbitMQ or AWS SQS).

---

## AI Tool Usage & Correction Example
* Usage: AI was utilized to draft boilerplate Express routing structure and Ant Design table components.
* Correction/Rejection Example: 
  * *AI's Initial Proposal:* Suggested validating and updating coupons using a two-step JavaScript check (`const c = find(); if (c.uses > 0) update({uses: 0})`) outside a transaction.
  * *Correction:* Rejected immediately because it introduces a classic read-modify-write race condition under concurrent checkouts. I forced the implementation to use an atomic conditional update query (`updateMany` with `usesRemaining: { gt: 0 }`) executed entirely inside a Prisma ACID transaction block.

---

## What to Examine First in Another Two Hours
1. Concurrency Test Suite: Review the integration tests simulating simultaneous requests for the final remaining inventory item or single-use coupon.
2. Idempotency Replay Logs: Inspect how duplicate `Idempotency-Key` headers return identical cached payloads without duplicate database mutations.
3. Prisma Transaction Boundaries: Verify that payment gateway timeout simulations correctly roll back inventory and coupon redemptions.