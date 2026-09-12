# Hybrid Pro

Hybrid Pro is a modern, mobile-first Progressive Web App for lightning-fast workout logging, meals, recovery, and AI coaching.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Scaffolding/UI**: shadcn/ui & Framer Motion
- **Database**: PostgreSQL (Supabase) via Drizzle ORM
- **Authentication**: Supabase Auth
- **State Management**: Zustand
- **Forms & Validation**: React Hook Form + Zod
- **Icons**: Lucide Icons
- **Charts**: Recharts

---

## Project Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase connection strings:
- `DATABASE_URL`: Postgres pool string from Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase project public anon key

### 3. Generate and Apply Database Schema
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on a mobile device emulator (target size: 390px - 430px wide).
