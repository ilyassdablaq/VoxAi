# VoxFlow AI Site

VoxFlow AI Site is a full-stack application with a React frontend and a Fastify backend. It provides authentication, conversation workflows, subscription management, integrations, analytics, and voice-related features.

## Project Structure

- `src/`: Frontend application (React + Vite + TypeScript)
- `backend/src/`: Backend API (Fastify + Prisma + TypeScript)
- `public/`: Static frontend assets
- `backend/prisma/`: Database schema, migrations, and seed data

## Tech Stack

### Frontend
- React 18
- Vite
- TypeScript
- React Router
- React Query
- Tailwind CSS
- Vitest + Testing Library

### Backend
- Fastify
- Prisma
- PostgreSQL
- TypeScript
- Stripe
- OpenAI SDK
- Vitest

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL (for backend)

## Setup

1. Install frontend dependencies from repository root:

```bash
npm install
```

2. Install backend dependencies:

```bash
cd backend
npm install
cd ..
```

3. Configure environment variables.

Frontend: create `.env` in the repository root.

```env
VITE_API_URL=http://localhost:4000
VITE_SENTRY_DSN=
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Backend: create `.env` in `backend/`.

```env
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voxflow
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace_with_secure_access_secret
JWT_REFRESH_SECRET=replace_with_secure_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
EMAIL_FROM=onboarding@your-domain.com
CONTACT_RECEIVER_EMAIL=support@your-domain.com
RESET_PASSWORD_PATH=/reset-password
STRIPE_SECRET_KEY=replace_if_using_stripe
STRIPE_WEBHOOK_SECRET=replace_if_using_stripe
OPENAI_API_KEY=replace_if_using_openai
```

4. Run Prisma migrations and generate client:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
cd ..
```

Optional seed:

```bash
cd backend
npm run prisma:seed
cd ..
```

## Run the Application

### Frontend (from root)

```bash
npm run dev
```

### Backend (from `backend/`)

```bash
npm run dev
```

## Build

### Frontend

```bash
npm run build
```

### Backend

```bash
cd backend
npm run build
```

## Test

### Frontend

```bash
npm run test
```

### Backend

```bash
cd backend
npm run test
```

## Lint

### Frontend

```bash
npm run lint
```

### Backend

```bash
cd backend
npm run lint
```

## Main Features

- Authentication with access and refresh tokens
- Password reset flow
- Subscription and plan management
- Stripe checkout and webhook handling
- Conversation and workflow modules
- Analytics and dashboard endpoints
- Integration and developer portal modules

## Observability And Product Analytics

- `Sentry` is integrated in backend and frontend.
- Backend captures unhandled exceptions and API server errors.
- Frontend captures runtime crashes and API request failures.
- Sensitive headers like `Authorization` and `Cookie` are stripped before sending events.

### Sentry Setup

1. Create a Sentry project for frontend and backend.
2. Add `SENTRY_DSN` in `backend/.env`.
3. Add `VITE_SENTRY_DSN` in root `.env`.
4. (Optional) Tune `SENTRY_TRACES_SAMPLE_RATE` and `VITE_SENTRY_TRACES_SAMPLE_RATE`.

## Email Delivery (Resend)

- SMTP/Nodemailer was replaced by `Resend` API-based delivery.
- Contact form notifications are sent through Resend.
- Forgot-password flow now issues a token and sends a reset link email.

### Resend Setup

1. Create and verify a sending domain in Resend.
2. Set these variables in `backend/.env`:

```env
RESEND_API_KEY=re_xxx
EMAIL_FROM=onboarding@your-domain.com
CONTACT_RECEIVER_EMAIL=support@your-domain.com
EMAIL_TEST_TO=your-fixed-test-recipient@example.com
RESEND_WEBHOOK_SECRET=whsec_xxx
```

3. `RESEND_API_KEY` and `EMAIL_FROM` are validated at startup (except in test).
4. Set `APP_ORIGIN` to your frontend URL so reset links are correct.
5. Optionally set `RESET_PASSWORD_PATH` if your reset route changes.

### Render Production Configuration

1. Open your backend service in Render.
2. Go to Environment and add:
	- `RESEND_API_KEY`
	- `EMAIL_FROM`
	- `CONTACT_RECEIVER_EMAIL`
	- `EMAIL_TEST_TO`
3. Save changes and trigger a redeploy/restart.
4. Check logs for `Resend email client configured` and confirm the API key is only shown as a masked preview.

### Test Email Endpoint

- Endpoint: `POST /api/contact/test-email`
- Access: authenticated `ADMIN` user only
- Behavior: sends a test email to `EMAIL_TEST_TO`
- Response includes provider message id for tracking

### Resend Webhook (Delivery Status)

- Endpoint: `POST /api/webhooks/resend`
- Signature headers required: `svix-id`, `svix-timestamp`, `svix-signature`
- Delivery status updates are persisted in `EmailDeliveryStatus` table.

Recommended webhook event subscriptions in Resend:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.opened`
- `email.clicked`

## Product Analytics (PostHog)

- Event-based analytics is integrated with `posthog-js` in frontend.
- Existing database analytics stays unchanged.

### Tracked Events

- `user_registered`
- `user_logged_in`
- `conversation_created`
- `message_sent`
- `plan_upgrade_started`
- `plan_upgraded`

### PostHog Setup

1. Create a PostHog project and copy your project key.
2. Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to root `.env`.
3. Run frontend and verify events in PostHog live events.

## Production Notes

- Use strong secrets for JWT and external providers
- Restrict CORS origins in backend configuration
- Ensure database migrations are applied before deployment
- Configure Stripe and OpenAI keys only in secure environments
- Run both frontend and backend test suites in CI before release
