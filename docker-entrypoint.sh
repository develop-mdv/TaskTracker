#!/bin/sh
set -e

echo "Running Prisma db push..."
prisma db push --skip-generate --schema=./prisma/schema.prisma

echo "Running seed..."
prisma db seed || echo "Seed skipped or already done"

echo "Starting application..."
exec node server.js
