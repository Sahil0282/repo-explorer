const crypto = require('crypto')

const jobs = new Map() // jobId -> job
const JOB_TTL_MS = 10 * 60 * 1000

function createJob(repoName) {
  const job = {
    id: crypto.randomUUID(),
    repoName,
    status: 'running',            // running | done | failed
    step: 'queued',               // machine-readable current step id
    stepIndex: 0,
    totalSteps: 5,
    message: 'Starting analysis...',
    progress: null,               // 0-100 within current step (clone only), else null
    result: null,                 // final payload for the frontend on done
    error: null,
    finishedAt: null,
    listeners: new Set(),         // active SSE `res` objects
  }
  jobs.set(job.id, job)
  return job
}

function emit(job, patch) {
  Object.assign(job, patch)
  const snapshot = publicView(job)
  for (const res of job.listeners) {
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
  }
}

function publicView(job) {
  // Never serialize `listeners`; include `result` only when done.
  const { id, repoName, status, step, stepIndex, totalSteps, message, progress, error } = job
  return { id, repoName, status, step, stepIndex, totalSteps, message, progress, error,
           result: job.status === 'done' ? job.result : null }
}

function finish(job, patch) {
  emit(job, { ...patch, finishedAt: Date.now() })
  for (const res of job.listeners) res.end()
  job.listeners.clear()
}

function findRunningJobForRepo(repoName) {
  for (const job of jobs.values()) {
    if (job.repoName === repoName && job.status === 'running') return job
  }
  return null
}

// Evict finished jobs after TTL so the Map cannot grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id)
  }
}, 60 * 1000).unref()

module.exports = { jobs, createJob, emit, finish, publicView, findRunningJobForRepo }
