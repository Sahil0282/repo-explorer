// Single source of truth for the backend API base URL.
// Reads VITE_API_URL at build time (set in Vercel / .env);
// falls back to the local dev backend.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
