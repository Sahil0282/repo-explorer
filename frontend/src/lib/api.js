import axios from 'axios'

// Single source of truth for the backend API base URL.
// Reads VITE_API_URL at build time (set in Vercel / .env);
// falls back to the local dev backend.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Kicks off an analysis job; resolves fast with { jobId }.
export function startAnalysis(repoUrl) {
  return axios.post(`${API_URL}/api/repo/analyze`, { repoUrl }, { timeout: 30000 })
}

// SSE subscription to job progress. Returns the EventSource so the caller
// can close it on unmount. onLost fires when the stream drops (e.g. server
// restart wiped the job map) — surfaced instead of retrying forever.
export function subscribeAnalysis(jobId, { onUpdate, onDone, onFail, onLost }) {
  const es = new EventSource(`${API_URL}/api/repo/analyze/status/${jobId}`)
  es.onmessage = (e) => {
    const job = JSON.parse(e.data)
    if (job.status === 'done') { es.close(); onDone(job.result) }
    else if (job.status === 'failed') { es.close(); onFail(job.error) }
    else onUpdate(job)
  }
  es.onerror = () => { es.close(); onLost() }
  return es
}
