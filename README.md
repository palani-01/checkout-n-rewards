# Checkout & Rewards System

A production-grade full-stack e-commerce application prototype featuring atomic financial transactions, robust idempotency controls, concurrent race-condition handling, administrative reporting, and an automated rewards milestone system.

---

## Project Deliverables & Submission Checklist

- Source Code: Full-stack Vite/React frontend and Express/Prisma backend.
- Setup & Execution Steps: Clear commands provided below.
- API Documentation: Comprehensive OpenAPI 3.0.3 specification (openapi.yaml) clearly distinguishing Public vs. Administrative endpoints.
- Automated Tests: Comprehensive Jest & Supertest integration suite testing stock decrements, idempotency caching, and concurrent race conditions.
- Architectural Reasoning: Detailed DECISIONS.md explaining invariants, trade-offs, concurrency strategies, and AI redirection examples.

---

## Key Features

* Atomic Transactions & Inventory Safety: Database transactions ensure inventory decrementing, subtotal calculations, coupon claims, and order creation occur atomically.
* Idempotency Protection: Enforces strict idempotency keys (Idempotency-Key header) to safely retry failed network requests without duplicate order processing or double-charging.
* Concurrent Coupon Safety: Uses conditional atomic database updates to ensure single-use coupons can never be redeemed twice, even under concurrent request spikes.
* Automated Milestone Rewards: Generates reward discount coupons automatically when global completed order count milestones are crossed.
* Administrative Analytics: Comprehensive administrative endpoint providing real-time gross revenue, net revenue, total discounts granted, product sales breakdowns, and coupon redemption stats.
* Demonstration UI: Lightweight Vite, React, and Ant Design interface featuring an active storefront, cart drawer, order history tracker, and admin report portal.

---

## Tech Stack

* Frontend: Vite, React, Ant Design, Axios
* Backend: Node.js, Express.js, Prisma ORM
* Database: SQLite (configured with WAL mode and busy timeouts for concurrent safety)
* Testing: Jest, Supertest

---

## Project Structure

checkout-n-rewards/
├── prisma/
│   ├── schema.prisma         # Database schema (Product, Cart, Order, Coupon, IdempotencyRecord)
│   └── migrations/           # Database schema migrations
├── tests/
│   └── checkout.test.js      # Integration & concurrency test suite
├── index.js                  # Express backend entry point & route controllers
├── api.js                    # Centralized frontend API client
├── App.jsx                   # React storefront & admin UI
├── openapi.yaml              # OpenAPI 3.0.3 spec (With Administrative vs Public tags)
├── DECISIONS.md              # Architectural design reasoning & invariants
├── package.json
└── README.md

---

## Installation & Setup

Follow these exact steps to set up, run, and test the project locally:

### Step 1: Install Dependencies
Install all required backend and frontend packages from the root directory:
npm install

### Step 2: Database Migration
Initialize your SQLite database and apply the Prisma migration schema:
npx prisma migrate dev --name init

### Step 3: Seed Initial Data (Optional)
If a seed script is configured in your package.json, execute:
npx prisma db seed

### Step 4: Start the Server Concurrently
Start both the Express backend server (port 3000) and the Vite frontend dev server simultaneously:
npm run dev

---

## Running Automated Tests

The test suite validates failure modes, inventory decrements, idempotency replays, coupon calculations, and race-condition competing operations.

To execute the test suite:
npm test

---

## API Operations Summary

The API explicitly separates Public Storefront Operations from Administrative Operations (detailed in openapi.yaml):

### Storefront Operations (Public)
* GET /api/admin/inventory - List available products and stock levels
* POST /api/cart/items - Add items to cart (initializes cart if missing)
* GET /api/cart/:cartId - Fetch cart contents and subtotal calculation
* POST /api/cart/apply-coupon - Preview coupon discount against active cart items
* POST /api/checkout - Finalize checkout (Requires Idempotency-Key header)
* GET /api/orders - Fetch completed order history

### Administrative Operations (Admin Only)
* GET /api/admin/report - Fetch business revenue analytics, product sales breakdown, and coupon usage statistics
* POST /api/admin/coupons - Manually generate custom administrative promo codes
* POST /api/admin/evaluate-milestones - Manually trigger milestone reward evaluations

find more details in the "openapi_specification.md" file.