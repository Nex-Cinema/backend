# Admin interview readiness

Each numbered task is one commit. Verification does not use a browser.
Existing package-lock.json edits are user-owned and excluded from task commits.

- [x] BE-1: Establish a safe isolated test database guard and refund regression tests; install dependencies and record baseline checks.
- [ ] BE-2: Make refund approval/rejection and direct admin refunds atomic, prevent duplicate processing, and preserve seats owned by newer bookings. Verify regression tests and TypeScript build.
- [ ] BE-3: Document Admin flows, refund semantics, test commands and interview talking points. Verify documentation against implementation.

Delivery: push the task branch and create a backend PR targeting main; user merges.
Frontend work is tracked in the frontend repository's INTERVIEW_TODO.md.

BE-1 verification: TypeScript noEmit passed; isolated MySQL database
`nex_cinema_admin_test`: adminRefund + giaodich suites, 10/10 tests passed.
Run: `node scripts/test-isolated.cjs tests/integration/adminRefund.test.ts tests/integration/giaodich.test.ts`.
