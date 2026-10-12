# Vidya Vahini

> "From Faculty to Students, Knowledge for Everyone."

A class resource portal built with Next.js 15, Neon Postgres, Cloudflare R2, and Auth.js.

## Getting Started

### 1. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Populate the required environment variables:
- `DATABASE_URL` (Neon Postgres pooled connection string)
- `DIRECT_URL` (Neon Postgres direct connection string)
- `AUTH_SECRET` - Required by Auth.js to sign and encrypt JWT session tokens.
  You can generate one using:
  ```bash
  npx auth secret
  ```
  or:
  ```bash
  openssl rand -base64 32
  ```
- `AUTH_URL` (e.g. `http://localhost:3000`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`

### 2. Database Setup & Seeding

Run the Prisma migration and seed the initial Super Admin:

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the portal.
