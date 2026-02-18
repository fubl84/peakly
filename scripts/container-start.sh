#!/bin/sh
set -eu

npm run db:generate
npx prisma migrate deploy
node scripts/bootstrap-initial-admin.mjs
npm run start -- --hostname 0.0.0.0 --port 3000
