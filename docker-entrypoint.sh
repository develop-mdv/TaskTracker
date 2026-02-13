#!/bin/sh
set -e

echo "Running Prisma db push..."
npx prisma db push --skip-generate

echo "Running seed (if needed)..."
npx prisma db seed || echo "Seed skipped or already done"

echo "Starting application..."
exec node server.js
