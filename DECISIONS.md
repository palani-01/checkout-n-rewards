1. System Invariants
Inventory & Coupon Safety: Inventory never drops below zero; single-use coupons can be successfully redeemed at most once via atomic conditional database updates.

Bounded Totals: Order totals and discounts are calculated using integer cents, ensuring net totals never go below zero.

2. Ambiguities & Semantics
Concurrent Redemptions: First-come, first-sharp atomic victory where conflicting concurrent checkout requests fail cleanly with a conflict error.

Failed Transactions: All steps run inside an ACID transaction; failures roll back completely, preserving inventory and coupons.

3. Material Design Decisions
Decision 1: Atomic Database Updates over App Locks

Choice: Conditional updateMany queries inside transactions.

Trade-off: Avoids complex distributed locking overhead, but couples concurrency control tightly to the database engine.

Decision 2: Integer Cents vs. Floats

Choice: Storing money as integer cents.

Trade-off: Eliminates floating-point rounding errors entirely, but requires simple formatting helpers for frontend display.

Decision 3: Database-Backed Idempotency

Choice: Persistent table tracking Idempotency-Key headers.

Trade-off: Survives server restarts and guarantees replay safety, but requires periodic cleanup of historical records.

Decision 4: Inline Milestone Rewards

Choice: Synchronous evaluation during the order transaction.

Trade-off: Instantly mints rewards without external worker queues, but slightly increases checkout transaction duration.

Decision 5: SQLite vs. PostgreSQL

Choice: SQLite with Prisma ORM for instant zero-config setup.

Trade-off: Perfect for local development and standalone review, but lacks high-throughput multi-region write scalability compared to PostgreSQL.

Decision 6: JavaScript / Node.js vs. Compiled Backends (Go/Rust)

Choice: Node.js / Express.

Trade-off: Enables rapid prototyping and unified full-stack language consistency, but single-threaded event loops can face CPU-bound throughput bottlenecks under extreme concurrent load compared to compiled multi-threaded runtimes.

4. Production Evolution & Scaling
Transition SQLite to a managed PostgreSQL cluster with connection pooling.

Introduce Redis for distributed locking and microsecond-level idempotency checks under heavy traffic spikes.

Better file structuring and adherance to coding standards

5. AI Tool Ownership & Correction Example
Correction: Rejected AI's suggestion to use a two-step check-then-update pattern for coupons (which causes race conditions) and forced an atomic conditional update query inside a strict transaction block.

6. What to Do Given Another Two Hours
Dynamic Pricing Feature: Implement time-sensitive surge pricing and tiered loyalty discounts based on user order history.

Advanced Concurrency & Failure Testing: Add automated stress scenarios simulating race conditions on final inventory items alongside payment gateway timeout simulations and cart state recovery failures.