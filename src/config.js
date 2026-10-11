/*
 * Base URL of the backend Worker (dailies, community levels, accounts, stats), set
 * per Vite mode via VITE_COMMUNITY_API in the .env files so `npm run dev` never
 * talks to prod. Empty → no backend: lists come from the local caches and writes
 * are disabled.
 */
export const API_URL = (import.meta.env.VITE_COMMUNITY_API ?? '').replace(/\/$/, '');

/* Serve cached lists for this long before hitting the network again: every request
 * counts toward the Worker free-tier 100k/day. */
export const CACHE_MS = 5 * 60 * 1000;
