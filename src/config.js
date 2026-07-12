/*
 * Base URL of the community-levels backend (Cloudflare Worker). Set per Vite mode
 * via VITE_COMMUNITY_API in the .env files (see .env.development / .env.production),
 * so `npm run dev` never talks to prod. Empty → no backend: the community section
 * is read-only from the local cache and creation is disabled. Trailing slash stripped.
 */
export const COMMUNITY_API = (import.meta.env.VITE_COMMUNITY_API ?? '').replace(/\/$/, '');

/* Reuse the cached community list for this long before hitting the network again.
 * Every request (GET included) counts toward the Worker free-tier 100k/day, so we
 * fetch once at startup and otherwise serve from cache within this window. */
export const COMMUNITY_CACHE_MS = 5 * 60 * 1000;
