# Remove Staff Scope from NexCinema Backend

## Context

NexCinema is being narrowed into an interview project that demonstrates business analysis, ERD design, booking consistency, and payment workflows. Workforce scheduling, counter sales, staff profiles, staff reporting, and ticket admission broaden the system without strengthening the core online-booking story.

The complete backend before this removal is preserved on branch `legacy/backend-full-scope` at commit `09705c4`.

## Goal

Reduce the backend to two actors, `ADMIN` and `CUSTOMER`, and remove every API, service, database entity, policy, seed record, and test whose only purpose is the Staff vertical slice.

The resulting system must still support:

- authentication and account management;
- movie, cinema, room, seat-map, and showtime administration;
- customer seat holds and online bookings;
- payment, cancellation, refund, and booking history;
- Admin reporting and payment-gateway configuration;
- runtime configuration for the seat-hold duration.

## Removed Scope

The following capabilities are removed completely:

- `workforce`: shift templates, shift assignment, staff registration, and staff schedules;
- `box-office`: counter ticket sales and staff sales history;
- `admission`: ticket lookup, check-in, and check-in history;
- staff profile endpoints;
- Staff Dashboard endpoints;
- Admin shift-management endpoints;
- the `STAFF` account role and staff-specific user management fields.

The frontend is intentionally outside this change. Staff and Admin workforce screens will temporarily receive `404` responses until a separate frontend cleanup is performed.

## Application Architecture

Delete the `workforce`, `box-office`, and `admission` capability directories. Remove the staff-profile subfeature from `identity` and the staff reporting subfeature from `reporting`.

The composition root must no longer import or mount any `/staff/*` route or `/admin/ca-lam-viec` route. Public boundaries in `identity/index.ts` and `reporting/index.ts` must export only the surviving routers and contracts.

The remaining capability set is:

1. `identity`
2. `catalog`
3. `cinema`
4. `showtime`
5. `booking`
6. `billing`
7. `reporting`
8. `operational-settings`

Admin reporting remains because it summarizes the core booking business. Staff reporting is removed.

## Identity Rules

`Role` contains only `ADMIN` and `CUSTOMER`.

Admin user-management validation and services must reject or make impossible all `STAFF` inputs. `ChucVu` is removed from user-management DTOs. Creating an Admin account creates only `TaiKhoan`; creating a Customer account creates `TaiKhoan` and `KhachHang`.

Account deletion logic must no longer inspect shift assignments, counter-sale bookings, or `NhanVien` records.

## Data Model

Remove these models:

- `NhanVien`
- `CaLamViec`
- `ChiTietCaLamViec`

Remove these relations and columns:

- `TaiKhoan.NhanVien`;
- `PhieuDatVe.MaNhanVien` and `PhieuDatVe.NhanVien`;
- `ChiTietDatVe.DaCheckIn`;
- `ChiTietDatVe.ThoiGianCheckIn`;
- `ChiTietDatVe.MaNhanVienCheckIn` and its relation/index.

`PhieuDatVe.MaKhachHang` becomes required because the remaining booking flow is authenticated online customer booking. `PhieuDatVe.KhachHang` becomes a required relation.

`CauHinhVanHanh` retains `ThoiGianGiuGhePhut` and `NgayCapNhat`. Remove `CuaSoCheckInPhut` and `HanHuyCaTruocGio` from the model, defaults, validation, API DTOs, and tests.

No other payment-method enum is removed in this change. Payment-method cleanup is independent of the Staff data model and can be evaluated separately.

## Database Migration

Add one Prisma migration that performs cleanup in foreign-key-safe order.

Before making `MaKhachHang` required, the migration removes legacy bookings whose `MaKhachHang` is null, including their refund history, transactions, and ticket details. Affected `GheSuatChieu` rows are normalized so deleted ticket details do not leave an unexplained booking ownership state.

Before removing `STAFF` from the role enum, the migration clears any seat holds owned by Staff accounts, deletes their refresh/password-reset tokens, drops the `nhan_vien` relation, and deletes the Staff accounts themselves. Admin accounts are retained even when the old schema created a `NhanVien` profile for them.

The migration then:

1. drops Staff/check-in foreign keys and indexes;
2. drops Staff/check-in columns;
3. drops `chi_tiet_ca_lam_viec`, `ca_lam_viec`, and `nhan_vien`;
4. makes `phieu_dat_ve.MaKhachHang` non-null;
5. removes `STAFF` from the database role enum;
6. drops the two obsolete operational-policy columns.

This migration intentionally removes Staff/POS demo data. Restoring that behavior requires checking out `legacy/backend-full-scope` and restoring a compatible database backup or schema.

## Seed and Demo Data

The primary seed creates only Admin and Customer accounts. It must not create staff accounts, shift templates, shift registrations, counter-sale bookings, or check-in data.

Additional demo data must create bookings only for customers. Bootstrap/demo-data code must not query removed Prisma delegates.

## API Compatibility

The following API groups are intentionally removed:

- `/api/v1/staff/ho-so*`
- `/api/v1/staff/lich-lam-viec*`
- `/api/v1/staff/ban-ve*`
- `/api/v1/staff/soat-ve*`
- `/api/v1/staff/dashboard*`
- `/api/v1/admin/ca-lam-viec*`

Existing Customer and Admin endpoints keep their URLs and response envelopes. The operational-settings API returns only the surviving runtime setting.

## Tests and Documentation

Delete integration suites dedicated to staff profiles, shifts, counter sales, and admission. Update shared test helpers and unrelated integration cleanup code so they no longer access removed Prisma models.

Add or update coverage proving:

- TypeScript and Prisma generation succeed without Staff types;
- `STAFF` cannot be supplied to Admin user creation;
- all removed Staff/Admin-workforce routes return `404`;
- Customer booking still requires and records a customer;
- seat hold, payment, cancellation, refund, reporting, and operational settings continue to work;
- architecture tests describe the reduced capability set and composition-root imports.

Update backend architecture documentation and route inventories to match the reduced system.

## Acceptance Criteria

- No source import, route, Prisma model, seed operation, or active test references the removed Staff vertical slice.
- Prisma schema validation and client generation pass.
- TypeScript production build passes.
- All remaining integration and architecture tests pass.
- The route map exposes no `/staff/*` or `/admin/ca-lam-viec*` endpoint.
- `legacy/backend-full-scope` still points to `09705c4`.
- The working implementation remains confined to the backend repository.
