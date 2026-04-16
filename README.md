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

## Authentication (Cookie-Based, HttpOnly)

VoxFlow uses **HttpOnly, Secure cookies** for authentication. This architecture eliminates XSS vulnerabilities associated with localStorage/sessionStorage token storage and enforces a single, secure auth path.

### How It Works

1. **Login/Register** – Backend sets two HttpOnly cookies:
   - `accessToken` – JWT valid for 15 minutes (configurable via `JWT_ACCESS_EXPIRES_IN`)
   - `refreshToken` – JWT valid for 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`)

2. **API Requests** – All frontend requests must include `credentials: "include"` to send cookies:

   ```typescript
   fetch("/api/users/me", {
     credentials: "include", // Browser sends HttpOnly cookies automatically
   });
   ```

3. **Token Refresh** – When `accessToken` expires, frontend calls `/api/auth/refresh`:
   ```typescript
   // Cookie (refreshToken) is sent automatically; no bearer token needed
   const newTokens = await fetch("/api/auth/refresh", {
     method: "POST",
     credentials: "include",
   });
   ```

4. **WebSocket Auth** – Browser includes cookies in WebSocket upgrade requests; backend validates `accessToken` cookie at connection time.

5. **Logout** – POST to `/api/auth/logout` clears both cookies.

### Cookie Configuration

Cookies are configured with security flags in `backend/src/modules/auth/auth.routes.ts`:

```typescript
const cookieOptions = {
  httpOnly: true,              // JS cannot read/write (prevents XSS)
  secure: NODE_ENV === "production", // HTTPS only in production
  sameSite: NODE_ENV === "production" ? "none" : "lax", // CSRF protection
  path: "/",
};
```

- **Development** (`NODE_ENV=development`): `secure=false`, `sameSite=lax` (localhost allows http)
- **Production** (`NODE_ENV=production`): `secure=true`, `sameSite=none` (HTTPS only, cross-site cookies)

### Bearer Token Support

⚠️ **Deprecated:** Bearer token authentication via `Authorization` header is **no longer supported**. All auth must use cookies. This prevents:
- Token leakage in logs/analytics
- Accidental exposure in URL query strings
- Backward-compatibility fallbacks that weaken security

### API Examples

#### Register

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!","fullName":"User"}'
  # Response includes accessToken, refreshToken (also set as cookies)
```

#### Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!"}'
  # Cookies: accessToken, refreshToken
```

#### Authenticated Request

```bash
curl -X GET http://localhost:4000/api/users/me \
  -b "accessToken=<jwt_token>; refreshToken=<refresh_jwt>"
  # OR (in browser): fetch with credentials: "include"
```

#### Logout

```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -b "accessToken=<jwt_token>; refreshToken=<refresh_jwt>"
  # Clears cookies; returns 204
```

### Backend Middleware

Protected endpoints use the `authenticate` middleware:

```typescript
import { authenticate } from "@/common/middleware/auth-middleware";

fastify.get("/api/protected", { preHandler: [authenticate] }, async (request) => {
  // request.user is set; contains decoded JWT payload
  const userId = request.user.sub;
  return { userId };
});
```

### Testing

E2E auth flow tests are in `src/test/e2e-auth-flow.test.ts`. Run:

```bash
npm run test -- src/test/e2e-auth-flow.test.ts
```

Tests verify:
- Registration, login, logout flows
- Cookie-only auth (no bearer tokens)
- WebSocket cookie authentication
- Rejection of Authorization headers

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
