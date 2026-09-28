# Backend architecture

The backend is organized by business capability under `src/modules`:

- `identity`: authentication, Customer accounts, and Admin user management
- `catalog`: movies and reviews
- `cinema`: rooms, seat maps, room types, seat types, and day types
- `showtime`: showtime scheduling and per-showtime seat state
- `booking`: seat holds, Customer bookings, cancellation, and booking history
- `billing`: gateways, transactions, payments, and refunds
- `reporting`: Admin statistics and read models
- `operational-settings`: supporting capability for runtime booking policies

The interview scope deliberately has two actors: `ADMIN` and `CUSTOMER`.
Workforce scheduling, counter sales, admission/check-in, and the `STAFF` role
are preserved only on the `legacy/backend-full-scope` branch, not in the active
API or ERD.

## Dependency rules

Every capability exposes its supported routers, application operations, queries, and shared DTOs from its root `index.ts`. Code in another capability must import that root and must not import its controllers, validators, services, or repositories directly.

The application composition root (`src/routes/index.ts`), jobs, and server bootstrap also import capability roots only. Technical code in `src/shared` must not depend on a business capability.

Inside a capability, subfeatures may collaborate directly. Keep the HTTP flow `route -> controller -> service -> repository`; omit a layer when it adds no behavior.

Every surviving booking is owned by exactly one Customer. Payment and refund
flows reference that booking; they do not introduce a second Staff-owned booking
path. The only runtime operational policy currently exposed is seat-hold time.

## Adding a feature

1. Place it under the capability that owns its business lifecycle. Create a new top-level capability only when it owns distinct rules and data.
2. Keep implementation files private and expose the minimum contract from the capability `index.ts`.
3. Put runtime-adjustable business policies in `operational-settings`; put stable rules beside their owning domain; put only technical primitives in `shared`.
4. Preserve API envelopes and role guards, then add integration and architecture tests.
