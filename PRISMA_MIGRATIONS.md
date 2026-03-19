## Prisma: `migrate` vs `generate`

This repo uses Prisma (with Fastify + MySQL) and Prisma Client on the backend.

### What `prisma migrate` does
- Creates a **migration** from your current Prisma schema (`prisma/schema.prisma`).
- Applies that migration to your database so the **DB schema matches the Prisma schema**.
- Writes migration files to `backend/prisma/migrations/` and updates Prisma’s migration history table.

Common commands:
- `npx prisma migrate dev --name <migration-name>` (local/dev workflow)
  - Creates a new migration (or detects changes)
  - Applies it to the dev database
  - Often prompts for confirmation depending on environment/changes
- `npx prisma migrate deploy` (production workflow)
  - Applies already-created migrations to the production database (no new migration creation)

### What `prisma generate` does
- Regenerates the Prisma Client code under `backend/node_modules/@prisma/client`.
- Updates TypeScript types and the runtime query engine used by your backend.
- **It does not change your database**.

Common command:
- `npx prisma generate`

---

## How to run migrations + generate (this project)

### Prerequisites
1. Ensure `backend/.env` is configured with `DATABASE_URL`.
2. (If the backend dev server is running) stop it before generating, to avoid Prisma engine file locks.

### Step 1: Run migration (create + apply)
```bash
cd backend
npx prisma migrate dev --name add_time_logs
```

### Step 2: Regenerate Prisma Client
```bash
cd backend
npx prisma generate
```

### Step 3: Restart backend dev server
```bash
cd backend
npm run dev
```

