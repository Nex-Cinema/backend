# Backend architecture

The backend is organized by business capability under `src/modules`:

- `identity`, `catalog`, `cinema`, `showtime`, `booking`, `billing`
- `workforce`, `box-office`, `admission`, `reporting`
- `operational-settings` is a supporting capability for runtime business policies

## Dependency rules

Every capability exposes its supported routers, application operations, queries, and shared DTOs from its root `index.ts`. Code in another capability must import that root and must not import its controllers, validators, services, or repositories directly.

The application composition root (`src/routes/index.ts`), jobs, and server bootstrap also import capability roots only. Technical code in `src/shared` must not depend on a business capability.

Inside a capability, subfeatures may collaborate directly. Keep the HTTP flow `route -> controller -> service -> repository`; omit a layer when it adds no behavior.

## Adding a feature

1. Place it under the capability that owns its business lifecycle. Create a new top-level capability only when it owns distinct rules and data.
2. Keep implementation files private and expose the minimum contract from the capability `index.ts`.
3. Put runtime-adjustable business policies in `operational-settings`; put stable rules beside their owning domain; put only technical primitives in `shared`.
4. Preserve API envelopes and role guards, then add integration and architecture tests.
