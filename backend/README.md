# NestJS + TypeORM + Supabase Starter Template

A clean NestJS starter preconfigured for Supabase (PostgreSQL) with TypeORM and migrations.

## What's included

- NestJS 11 with TypeScript
- `@nestjs/config` for environment variables
- `@nestjs/typeorm` + `typeorm` connected to Supabase Postgres (SSL, `rejectUnauthorized: false`)
- Migration workflow (`migration:generate`, `migration:run`, `migration:revert`, `migration:show`)
- A sample `items` module with full CRUD to demonstrate the entity / DTO / service / controller pattern

## Getting started

1. Copy the template to a new project:

```bash
cp -R template my-new-project
cd my-new-project
```

2. Install dependencies:

```bash
npm install
```

3. Create your environment file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

4. Run the app:

```bash
npm run start:dev
```

The API is available at `http://localhost:3000` and responds with `Hello World!` at `/`.

## Supabase database credentials

In your Supabase dashboard, go to **Project Settings → Database → Connection string**.

Use the session pooler or direct connection values:

```
SUPABASE_HOST=db.<your-project-ref>.supabase.co
SUPABASE_PORT=5432
SUPABASE_DB=postgres
SUPABASE_USER=postgres
SUPABASE_PASSWORD=<your-database-password>
```

## Migrations

1. Create an entity in `src/**/*.entity.ts`.
2. Generate a migration:

```bash
npm run migration:generate -- src/migrations/<MigrationName>
```

3. Apply it:

```bash
npm run migration:run
```

Revert the last migration with `npm run migration:revert` and list applied migrations with `npm run migration:show`.

Note: `synchronize: false` is intentional — schema changes are tracked through migrations only.

## Adding a new module

Run the Nest CLI to scaffold a module, then register its entity:

```bash
npx nest g module users
npx nest g controller users
npx nest g service users
```

Create a `user.entity.ts` next to it, add `TypeOrmModule.forFeature([User])` in the module, and register the module in `src/app.module.ts`.

## Scripts

```bash
npm run build        # compile
npm run start        # run
npm run start:dev    # run with watch mode
npm run lint         # eslint + prettier
npm run test         # unit tests
npm run test:e2e     # e2e tests
```
