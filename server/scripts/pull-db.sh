#!/usr/bin/env bash
# Replace the local D1 (used by `wrangler dev`) with a copy of the remote one.
# Read-only on the remote side. Needs `wrangler login`. Stop `wrangler dev` first.
set -euo pipefail
cd "$(dirname "$0")/.."
dump="$(mktemp -d)/remote.sql"
npx wrangler d1 export amalgramme --remote --output="$dump"
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute amalgramme --local --file="$dump"
rm -f "$dump"
echo "Local D1 now mirrors remote."
