# NexCinema Backend

REST API for an online cinema booking system. It supports movie browsing, showtime management, seat booking, online payment, refunds, and admin reports.

## Main features

- Login and account management for `ADMIN` and `CUSTOMER`
- Movie, cinema room, seat, and showtime management
- Seat hold, ticket booking, cancellation, and booking history
- PayOS and VNPay payment flows
- Booking QR check-in for cinema admission
- Transaction, refund, report, and operation setting management

## Tech stack

- Node.js and Express
- TypeScript
- Prisma ORM and MySQL
- Zod validation
- JWT authentication
- Jest and Supertest

## Run locally

Requirements: Node.js 18+ and MySQL 8+.

```bash
npm install
```

Copy `.env.example` to `.env`, then update the database, JWT, email, and payment settings.

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The server runs at `http://localhost:5000` by default.

- API base URL: `http://localhost:5000/api/v1`
- Health check: `GET /api/v1/health`

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the TypeScript project |
| `npm start` | Start the production build |
| `npm test` | Run all tests |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Add sample data |

## Architecture

The project uses a feature-based architecture. Each business feature is placed in `src/modules` and exposes its public API through `index.ts`.

Main modules include identity, catalog, cinema, showtime, booking, billing, admission, reporting, and operational settings.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the dependency rules and folder structure.
