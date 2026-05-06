#!/bin/bash
set -e

echo "[DB INIT] Starting database initialization..."

# Check if we have DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "[DB INIT] ERROR: DATABASE_URL not set"
  exit 1
fi

# Try to ensure vector extension exists
echo "[DB INIT] Installing required PostgreSQL extensions..."
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS \"vector\";" 2>/dev/null || true

# Run prisma db push
echo "[DB INIT] Running prisma db push..."
npx prisma db push --skip-generate --accept-data-loss

echo "[DB INIT] Database initialization complete"
