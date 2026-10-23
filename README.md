# Checkout and Rewards Service Backend

A robust, production-grade backend service built for secure e-commerce transactions, featuring strict inventory validation, ACID compliance, idempotency, and integrated rewards/coupon handling.

## Tech Stack
- **Runtime:** Node.js (v22+) with native ES Modules (`import`/`export`)
- **Framework:** Express.js
- **Database ORM:** Prisma v5.11.0 with SQLite
- **Type Safety:** Pure JavaScript with JSDoc (`// @ts-check`) for zero-build overhead type checking

---

## Key Features
1. **Idempotency Enforcement:** Prevents duplicate orders and double inventory deductions via custom `idempotency-key` headers.
2. **ACID Financial Integrity:** Monetary values are handled strictly as integer-based cents to avoid floating-point math errors. Prisma transactions guarantee atomicity during checkouts.
3. **Concurrency Control:** Real-time stock checks prevent overselling when inventory levels drop.
4. **Admin & Reporting:** Endpoints to monitor sales revenue, track low-stock inventory, and issue promotional or milestone coupons.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install