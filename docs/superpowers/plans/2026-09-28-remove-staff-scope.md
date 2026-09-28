# Remove Staff Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the complete Staff vertical slice from the NexCinema backend so the running API and ERD contain only Admin and Customer actors.

**Architecture:** Remove Staff-facing capability modules at the composition root and filesystem, then simplify identity, operational settings, booking, billing, Prisma schema, fixtures, and documentation around the remaining Customer/Admin workflows. A destructive Prisma migration removes legacy Staff/POS data before enforcing customer-owned bookings.

**Tech Stack:** Express, TypeScript, Prisma 5, MySQL, Jest, Supertest

**Spec:** `docs/superpowers/specs/2026-09-28-remove-staff-scope-design.md`

## Global Constraints

- Work only in `Cinema-Booking-System-Backend`; do not modify the frontend repository.
- Preserve the existing Customer and Admin URL contracts except for the narrowed operational-settings response.
- Keep `legacy/backend-full-scope` fixed at commit `09705c4`.
- Do not remove payment methods in this change.
- `PhieuDatVe.MaKhachHang` becomes required; legacy bookings without a customer are intentionally removed by the migration.
- Use the existing Express, TypeScript, Prisma, MySQL, Jest, and Supertest stack without adding dependencies.

## Review Focus

- A raw `VaiTro: "STAFF"` payload must fail validation instead of being coerced or accepted; Task 2 adds the API assertion.
- Removed Staff and Admin workforce URLs must resolve to `404`, including authenticated requests; Task 1 covers representative routes from every removed group.
- A legacy POS booking may own ticket details, transactions, and refund rows; Task 3 verifies migration SQL orders cleanup before dropping columns and constraints.
- A remaining booking without `MaKhachHang` must be impossible at compile time and in the database; Task 3 updates fixtures and runs the booking integration suite.
- Obsolete operational-setting keys must be absent from reads and rejected on writes; Task 2 covers both response shape and strict validation.

---

### Task 1: Remove the Staff HTTP surface and feature modules

**Files:**
- Create: `tests/integration/removedStaffRoutes.test.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/modules/identity/index.ts`
- Modify: `src/modules/reporting/index.ts`
- Delete: `src/modules/workforce/**`
- Delete: `src/modules/box-office/**`
- Delete: `src/modules/admission/**`
- Delete: `src/modules/identity/staff-profile/**`
- Delete: `src/modules/reporting/staff/**`
- Delete: `src/modules/reporting/reporting.constants.ts`
- Delete: `tests/integration/calamviec.test.ts`
- Delete: `tests/integration/staffBanVe.test.ts`
- Delete: `tests/integration/staffHoSo.test.ts`
- Delete: `tests/integration/staffLichLamViec.test.ts`
- Delete: `tests/integration/staffSoatVe.test.ts`
- Modify: `tests/architecture/module-boundaries.test.ts`

**Interfaces:**
- Consumes: the current Express composition root and capability `index.ts` boundaries.
- Produces: an API with no mounted `/staff/*` or `/admin/ca-lam-viec*` routes and a module tree without Staff-only capabilities.

- [ ] **Step 1: Write the failing removed-route integration test**

Create a table-driven test covering one URL from each removed group:

```ts
const removedRoutes = [
  ['get', '/api/v1/staff/ho-so'],
  ['get', '/api/v1/staff/lich-lam-viec/cua-toi'],
  ['get', '/api/v1/staff/ban-ve/suat-chieu'],
  ['post', '/api/v1/staff/soat-ve/kiem-tra'],
  ['get', '/api/v1/staff/dashboard'],
  ['get', '/api/v1/admin/ca-lam-viec'],
] as const;
```

Authenticate as Admin where necessary and assert every response is `404`.

- [ ] **Step 2: Run the route test and verify it fails**

Run: `npx jest tests/integration/removedStaffRoutes.test.ts --runInBand`

Expected: FAIL because the current backend still mounts these routes.

- [ ] **Step 3: Remove route mounts, public exports, capability directories, and obsolete suites**

Remove all Staff router imports and `router.use` calls from `src/routes/index.ts`. Keep `reportingAdminRouter`; remove only its Staff counterpart. Add an architecture assertion that the removed capability/subfeature directories do not exist and the composition root contains no `/staff/` mount.

- [ ] **Step 4: Verify the reduced HTTP surface and TypeScript build**

Run: `npx jest tests/integration/removedStaffRoutes.test.ts tests/architecture/module-boundaries.test.ts --runInBand`

Expected: PASS.

Run: `npm run build`

Expected: PASS while the old Prisma schema is still available to remaining source files.

- [ ] **Step 5: Commit the route and module removal**

```bash
git add src/routes src/modules tests
git commit -m "refactor(backend): remove staff feature modules"
```

### Task 2: Restrict identity and operational settings to Admin/Customer

**Files:**
- Modify: `src/modules/identity/user-admin/user.validator.ts`
- Modify: `src/modules/identity/user-admin/user.service.ts`
- Modify: `src/modules/identity/user-admin/user.routes.ts`
- Modify: `src/modules/identity/account/taikhoan.repository.ts`
- Modify: `src/modules/operational-settings/operationalSettings.constants.ts`
- Modify: `src/modules/operational-settings/operationalSettings.validator.ts`
- Modify: `tests/integration/user.test.ts`
- Modify: `tests/integration/operationalSettings.test.ts`
- Modify: `tests/integration/taiKhoan.test.ts`

**Interfaces:**
- Consumes: `Role` from the pre-migration Prisma client during the red/green cycle.
- Produces: user-management DTOs that accept only `ADMIN | CUSTOMER`, plus operational-settings DTOs containing only `ThoiGianGiuGhePhut`.

- [ ] **Step 1: Replace Staff user tests with Admin/Customer contract tests**

Assert that Admin can create and update a Customer without `NhanVien` or `ChucVu`, list users by `CUSTOMER`, and receives `400` for a raw payload containing `VaiTro: 'STAFF'` or a strict-schema `ChucVu` field.

- [ ] **Step 2: Narrow operational-settings tests**

Assert GET returns `ThoiGianGiuGhePhut` and does not contain `CuaSoCheckInPhut` or `HanHuyCaTruocGio`. Assert PATCH with either obsolete key returns `400`.

- [ ] **Step 3: Run focused tests and verify they fail**

Run: `npx jest tests/integration/user.test.ts tests/integration/taiKhoan.test.ts tests/integration/operationalSettings.test.ts --runInBand`

Expected: FAIL on accepted Staff/user-profile behavior and obsolete settings fields.

- [ ] **Step 4: Simplify identity and operational-settings implementations**

Use `z.enum(['ADMIN', 'CUSTOMER'])` for Admin user creation/query validation and make create/update schemas strict. Remove `ChucVu`, every `NhanVien` include/create/update/delete, and Staff dependency-count branches from `user.service.ts`. Remove automatic Staff-profile creation from `taikhoan.repository.ts` and update route documentation. Retain customer soft-delete behavior for bookings/reviews and hard deletion for accounts without dependencies.

Reduce `DEFAULT_OPERATIONAL_SETTINGS` and `OPERATIONAL_SETTING_LIMITS` to `ThoiGianGiuGhePhut`; strict validation must reject removed keys.

- [ ] **Step 5: Run focused tests and build**

Run: `npx jest tests/integration/user.test.ts tests/integration/taiKhoan.test.ts tests/integration/operationalSettings.test.ts --runInBand`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the application-contract cleanup**

```bash
git add src/modules/identity src/modules/operational-settings tests/integration/user.test.ts tests/integration/taiKhoan.test.ts tests/integration/operationalSettings.test.ts
git commit -m "refactor(identity): restrict accounts to admin and customer"
```

### Task 3: Remove Staff entities and enforce customer-owned bookings

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260928120000_remove_staff_scope/migration.sql`
- Create: `tests/architecture/remove-staff-migration.test.ts`
- Modify: `src/modules/booking/reservation/datve.repository.ts`
- Modify: `src/modules/billing/transaction/giaodich.service.ts`
- Modify: `src/modules/booking/reservation/demoData.service.ts`
- Modify: any additional `src/**/*.ts` file reported by the Staff-reference scan after Prisma generation
- Modify: `tests/helpers.ts`
- Modify: `tests/integration/datve.test.ts`
- Modify: `tests/integration/giaodich.test.ts`
- Modify: `tests/integration/adminRefund.test.ts`
- Modify: `tests/integration/lichsu-review-refund.test.ts`

**Interfaces:**
- Consumes: Customer identity (`MaKhachHang`) and existing booking/payment workflows.
- Produces: Prisma models with `Role.ADMIN | Role.CUSTOMER`, required `PhieuDatVe.MaKhachHang`, no Staff/check-in delegates or fields, and source code compiling against that client.

- [ ] **Step 1: Add static schema assertions to the architecture suite**

Read `prisma/schema.prisma` in `tests/architecture/module-boundaries.test.ts` and assert it contains neither `STAFF`, `model NhanVien`, `model CaLamViec`, `model ChiTietCaLamViec`, `MaNhanVien`, `DaCheckIn`, `ThoiGianCheckIn`, `CuaSoCheckInPhut`, nor `HanHuyCaTruocGio`. Assert `MaKhachHang String` is non-null in `PhieuDatVe`.

- [ ] **Step 2: Run the schema assertion and verify it fails**

Run: `npx jest tests/architecture/module-boundaries.test.ts --runInBand`

Expected: FAIL against the current Prisma schema.

- [ ] **Step 3: Update the Prisma schema**

Remove `STAFF`, the three Staff/workforce models, all Staff/check-in relations and fields, and the two obsolete operational settings. Make `PhieuDatVe.MaKhachHang` and `PhieuDatVe.KhachHang` required.

- [ ] **Step 4: Write a failing migration-order architecture test**

Read `prisma/migrations/20260928120000_remove_staff_scope/migration.sql` and assert the cleanup statements exist in dependency order: refunds before transactions, transactions before ticket details, ticket details before customer-less bookings, Staff tokens/holds before Staff accounts, and Staff accounts before narrowing the role enum. Assert the migration drops all three Staff/workforce tables and the check-in/operational columns.

Run: `npx jest tests/architecture/remove-staff-migration.test.ts --runInBand`

Expected: FAIL because the migration does not exist yet.

- [ ] **Step 5: Write the destructive migration in foreign-key-safe order**

The SQL must capture seat IDs belonging to customer-less bookings, delete dependent refund rows, transactions, and ticket details, delete those bookings, and normalize captured seats. Clear holds owned by Staff accounts, delete their refresh/password-reset tokens, drop Staff/check-in foreign keys and indexes, remove the columns/tables, and delete accounts whose role is `STAFF`. Then alter `MaKhachHang` to `VARCHAR(36) NOT NULL`, narrow the `VaiTro` enum to `ADMIN | CUSTOMER`, and drop obsolete operational-setting columns.

- [ ] **Step 6: Validate and regenerate Prisma**

Run: `npx prisma format`

Expected: schema formatted without errors.

Run: `npx prisma validate && npx prisma generate`

Expected: both commands PASS and generated client contains no Staff types.

- [ ] **Step 7: Fix remaining source compilation against the reduced client**

Remove `MaNhanVien: null` from customer booking creates, remove `NhanVien` includes from Admin transaction queries, and make all demo bookings resolve a real `MaKhachHang`. Run a repository-wide source scan and remove every reference to deleted Prisma members.

- [ ] **Step 8: Update test helpers and booking/payment fixtures**

Remove `createTestStaff` and Staff cleanup calls. Make `createTestAdmin` create only `TaiKhoan`. Update `createTicketDetailForMovie` and every direct `phieuDatVe.create` to create/use a Customer and supply `MaKhachHang`. Remove obsolete operational-setting fields from booking test setup.

- [ ] **Step 9: Run schema, migration-contract, build, and core booking/billing tests**

Run: `npx prisma validate && npm run build`

Expected: PASS.

Run: `npx jest tests/architecture/module-boundaries.test.ts tests/architecture/remove-staff-migration.test.ts tests/integration/datve.test.ts tests/integration/giaodich.test.ts tests/integration/adminRefund.test.ts tests/integration/lichsu-review-refund.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 10: Commit the schema and core workflow migration**

```bash
git add prisma src tests
git commit -m "refactor(database): remove staff entities from booking model"
```

### Task 4: Simplify seeds and remaining integration fixtures

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed_extra_data.ts`
- Modify: remaining non-Staff tests reported by `rg` after Task 3, including `metadata.test.ts`, `phim.test.ts`, `phongchieu.test.ts`, `suatchieu.test.ts`, `taiKhoan.test.ts`, and `thongke.test.ts`

**Interfaces:**
- Consumes: the reduced Prisma client and Customer/Admin-only test helpers from Task 3.
- Produces: deterministic seed/demo data and all remaining integration suites without references to deleted delegates or role values.

- [ ] **Step 1: Remove Staff fixtures from the primary and extra seeds**

Keep one Admin and customer demo accounts. Remove employee creation, shifts, schedules, counter-sale ownership, and Staff credential output. Ensure every demo booking references a real Customer.

- [ ] **Step 2: Remove obsolete cleanup and authorization cases from surviving tests**

Delete direct `chiTietCaLamViec` cleanup calls and replace Staff-specific authorization assertions with Admin/guest cases where the endpoint remains meaningful.

- [ ] **Step 3: Scan for forbidden Staff references**

Run: `rg -n "STAFF|NhanVien|nhanVien|CaLamViec|chiTietCaLamViec|DaCheckIn|ThoiGianCheckIn|MaNhanVien|CuaSoCheckInPhut|HanHuyCaTruocGio" src prisma/seed.ts prisma/seed_extra_data.ts tests`

Expected: no matches except the deliberate raw `'STAFF'` rejection test and removed-route descriptions.

- [ ] **Step 4: Verify seed type-check and all surviving tests**

Run: `npx tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck prisma/seed.ts prisma/seed_extra_data.ts`

Expected: PASS.

Run: `npm test -- --runInBand`

Expected: all remaining suites PASS.

- [ ] **Step 5: Commit seed and fixture cleanup**

```bash
git add prisma/seed.ts prisma/seed_extra_data.ts tests
git commit -m "test(backend): align fixtures with customer-only bookings"
```

### Task 5: Update architecture and interview documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `ADMIN_INTERVIEW.md`
- Modify: `INTERVIEW_TODO.md` only if it contains claims about active Staff scope

**Interfaces:**
- Consumes: the final capability tree, route map, and schema from Tasks 1–4.
- Produces: documentation that describes eight capabilities, two actors, and the Customer booking/payment lifecycle without presenting removed features as active.

- [ ] **Step 1: Rewrite capability, role, route, seed-account, and ERD sections**

Document the remaining eight capability directories and explain that the interview scope deliberately excludes workforce, counter sales, and admission. Remove Staff credentials and authorization matrices from active documentation.

- [ ] **Step 2: Verify documentation and source contain no stale active-scope claims**

Run: `rg -n "workforce|box-office|admission|STAFF|nhanvien01|CaLamViec|NhanVien" ARCHITECTURE.md README.md ADMIN_INTERVIEW.md INTERVIEW_TODO.md src prisma/seed.ts tests`

Expected: only historical/design rationale or the explicit rejection/absence tests remain.

- [ ] **Step 3: Commit documentation**

```bash
git add ARCHITECTURE.md README.md ADMIN_INTERVIEW.md INTERVIEW_TODO.md
git commit -m "docs(backend): document reduced interview scope"
```

### Task 6: Final migration and regression verification

**Files:**
- Modify: only files required by failures found during final verification

**Interfaces:**
- Consumes: all outputs from Tasks 1–5.
- Produces: a reviewable backend branch with a clean worktree and evidence that the reduced system builds and its remaining flows pass.

- [ ] **Step 1: Verify the migration against the configured test database**

Run: `npx prisma migrate status`

Expected: migration history is consistent.

Run the repository's test-database migration command for `20260928120000_remove_staff_scope` and confirm the resulting schema contains no Staff tables/columns and makes `phieu_dat_ve.MaKhachHang` non-null.

- [ ] **Step 2: Run complete static verification**

Run: `npx prisma validate && npx prisma generate && npm run build`

Expected: all commands PASS.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test -- --runInBand`

Expected: all surviving suites PASS with zero failures.

- [ ] **Step 4: Verify branch preservation and final diff**

Run: `git rev-parse legacy/backend-full-scope`

Expected: `09705c4e745323a5ba24386067c6a5b607e31a81`.

Run: `git diff --check legacy/backend-full-scope...HEAD && git status --short`

Expected: no whitespace errors and a clean working tree after the final commit.

- [ ] **Step 5: Commit any final verification fixes**

```bash
git add -u
git commit -m "fix(backend): complete staff scope removal"
```

Skip this commit when final verification requires no fixes.
