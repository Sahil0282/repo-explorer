const axios = require('axios')
const simpleGit = require('simple-git')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const { buildFileTree, countFiles } = require('../utils/fileTree')
const { extractFunctionsFromTree } = require('../utils/extractFunctions')
const { getCodeEvolution } = require('../utils/gitEvolution')
const { jobs, createJob, emit, finish, publicView, findRunningJobForRepo } = require('../jobs')

const CLONE_BASE = path.resolve('./temp_repos')

// AI service base URL — set AI_SERVICE_URL in production (e.g. the Render
// URL of the FastAPI service); defaults to the local dev address.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'

// Cap how many cloned repos linger on disk. The app is single-session (one
// active repo at a time), so old clones are stale once a new repo is analyzed.
const MAX_REPOS = 5

// Repos with an in-flight /analyze. Never cleaned up mid-clone (race guard).
const activeAnalyses = new Set()

/**
 * Bounds temp_repos growth. Keeps the active repo plus the most recently
 * modified others up to MAX_REPOS, deleting the rest. Never removes the repo
 * being kept or any repo with an in-flight analysis. Best-effort: failures are
 * logged and never abort the request.
 *
 * @param {string} keepRepoName - the repo to always preserve (just analyzed)
 */
function cleanupOldRepos(keepRepoName) {
  try {
    if (!fs.existsSync(CLONE_BASE)) return

    const dirs = fs.readdirSync(CLONE_BASE, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const full = path.join(CLONE_BASE, entry.name)
        let mtimeMs = 0
        try { mtimeMs = fs.statSync(full).mtimeMs } catch { /* ignore */ }
        return { name: entry.name, full, mtimeMs }
      })

    const removable = dirs
      .filter(d => d.name !== keepRepoName && !activeAnalyses.has(d.name))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)

    // Keep the active repo (always) + the newest (MAX_REPOS - 1) others.
    const toDelete = removable.slice(MAX_REPOS - 1)

    for (const dir of toDelete) {
      try {
        fs.rmSync(dir.full, { recursive: true, force: true })
        console.log(`Cleaned up old repo: ${dir.name}`)
      } catch (err) {
        console.error(`Cleanup failed for ${dir.name}:`, err.message)
      }
    }
  } catch (err) {
    console.error('Repo cleanup error:', err.message)
  }
}

/**
 * Validates a GitHub URL and extracts the owner/repo identifier.
 * Uses proper URL parsing instead of string prefix matching to prevent
 * bypass attacks like https://github.com@evil.com/malicious-repo
 *
 * @param {string} url - The URL to validate
 * @returns {{ valid: boolean, repoName?: string, error?: string }}
 */
function validateGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Repository URL is required' }
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Must be HTTPS and exactly github.com (not github.com.evil.com)
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' }
  }
  if (parsed.hostname !== 'github.com') {
    return { valid: false, error: 'Only github.com repositories are supported' }
  }

  // Path must be /owner/repo (optionally with .git suffix and trailing slash)
  const cleanPath = parsed.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '')
  const segments = cleanPath.split('/').filter(Boolean)

  if (segments.length !== 2) {
    return { valid: false, error: 'URL must point to a repository (github.com/owner/repo)' }
  }

  const [owner, repo] = segments

  // Prevent path traversal in repo names
  if (owner.includes('..') || repo.includes('..')) {
    return { valid: false, error: 'Invalid repository path' }
  }

  return {
    valid: true,
    owner,
    repo,
    repoName: `${owner}_${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`
  }
}

// Hard limits for what the free-tier deployment can realistically process.
const MAX_FILES = 300
const MAX_REPO_SIZE_KB = 150 * 1024 // 150MB of git data — clone would be too slow

/**
 * Fast pre-checks via the GitHub API so users learn a repo can't be processed
 * in under a second, instead of waiting minutes for a clone to fail.
 * Best-effort: any GitHub API failure (rate limit, network) skips the check
 * and lets the authoritative post-clone checks decide.
 *
 * @returns {{ ok: boolean, error?: string }}
 */
async function preflightRepoCheck(owner, repo) {
  let info
  try {
    const resp = await axios.get(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { timeout: 8000, headers: { Accept: 'application/vnd.github+json' } }
    )
    info = resp.data
  } catch (err) {
    if (err.response?.status === 404) {
      return { ok: false, error: 'Repository not found. Check the URL — private repos are not supported.' }
    }
    return { ok: true } // rate-limited or unreachable — skip pre-checks
  }

  if (info.size > MAX_REPO_SIZE_KB) {
    const mb = Math.round(info.size / 1024)
    return { ok: false, error: `This repository is too large to analyze here (~${mb}MB of git data). Try a smaller repo.` }
  }

  // Is this even a JavaScript/TypeScript project?
  try {
    const langResp = await axios.get(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
      { timeout: 8000, headers: { Accept: 'application/vnd.github+json' } }
    )
    const langs = langResp.data
    const total = Object.values(langs).reduce((a, b) => a + b, 0)
    const jsBytes = (langs.JavaScript || 0) + (langs.TypeScript || 0)
    if (total > 0 && jsBytes === 0) {
      const top = Object.keys(langs)[0] || 'non-JavaScript code'
      return { ok: false, error: `This repo is written in ${top}. RepoExplorer currently supports JavaScript/TypeScript projects (Node, React, Next.js, MERN...).` }
    }
  } catch { /* best-effort */ }

  // Instant file-count screen using the git tree (no clone needed).
  // Only reject CLEAR violations; borderline cases get the authoritative
  // post-clone count.
  try {
    const branch = info.default_branch || 'main'
    const treeResp = await axios.get(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { timeout: 10000, headers: { Accept: 'application/vnd.github+json' } }
    )
    if (treeResp.data.truncated) {
      return { ok: false, error: `This repository has too many files for the current ${MAX_FILES}-file limit.` }
    }
    const blobs = (treeResp.data.tree || []).filter(
      n => n.type === 'blob' && !n.path.includes('node_modules/')
    )
    if (blobs.length > MAX_FILES * 2) {
      return { ok: false, error: `Repo too large (${blobs.length} files). The current limit is ${MAX_FILES} files.` }
    }
  } catch { /* best-effort */ }

  return { ok: true }
}

/**
 * Resolves a user-supplied file path and verifies it stays within
 * the allowed base directory. Prevents path traversal attacks
 * where filePath = "../../etc/passwd" would escape the clone dir.
 *
 * @param {string} basePath - The resolved base directory
 * @param {string} userPath - The user-supplied relative path
 * @returns {{ safe: boolean, resolvedPath?: string }}
 */
function safePath(basePath, userPath) {
  const resolved = path.resolve(basePath, userPath)
  // Ensure the resolved path starts with the base path + separator
  // This catches ../ traversals because path.resolve normalizes them
  if (!resolved.startsWith(basePath + path.sep) && resolved !== basePath) {
    return { safe: false }
  }
  return { safe: true, resolvedPath: resolved }
}

/**
 * POST /analyze — synchronous part only. Validates, runs fast GitHub API
 * pre-checks (so bad repos fail in <1s), then spawns the analysis as a
 * background job and returns a jobId immediately. Long work can no longer
 * be killed by proxy timeouts because no request outlives a second.
 */
async function startAnalysis(req, res) {
  const { repoUrl } = req.body

  const validation = validateGitHubUrl(repoUrl)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error })
  }

  // Join an in-flight job for the same repo instead of double-cloning.
  const existing = findRunningJobForRepo(validation.repoName)
  if (existing) {
    return res.status(202).json({ jobId: existing.id })
  }

  const preflight = await preflightRepoCheck(validation.owner, validation.repo)
  if (!preflight.ok) {
    return res.status(400).json({ error: preflight.error })
  }

  const job = createJob(validation.repoName)
  runAnalysis(job, validation).catch(err => {
    console.error('Analysis job crashed:', err)
    finish(job, { status: 'failed', error: 'Failed to analyze repo' })
  })

  return res.status(202).json({ jobId: job.id })
}

/**
 * The background analysis pipeline. Emits real step progress to SSE
 * listeners; ends with status done (result payload) or failed (error).
 */
async function runAnalysis(job, validation) {
  const repoName = validation.repoName
  const clonePath = path.resolve(CLONE_BASE, repoName)

  // Guard this repo against cleanup while its analysis is in flight.
  activeAnalyses.add(repoName)

  try {
    emit(job, { step: 'clone', stepIndex: 1, message: 'Cloning repository...' })

    if (!fs.existsSync(clonePath)) {
      fs.mkdirSync(CLONE_BASE, { recursive: true })
      console.log(`Cloning ${validation.cloneUrl}...`)
      const git = simpleGit({
        progress: ({ progress }) => emit(job, { progress })
      })
      // Shallow clone: evolution mining only reads the last 20 commits, so
      // --depth 25 keeps big repos fast without losing any needed history.
      await git.clone(validation.cloneUrl, clonePath, ['--depth', '25'])
      console.log('Clone complete')
      emit(job, { progress: null })
    } else {
      console.log('Repo already cloned, using cache')
      emit(job, { message: 'Using cached clone...' })
    }

    // Now that the target clone is present, prune stale repos (keeps this one).
    cleanupOldRepos(repoName)

    emit(job, { step: 'parse', stepIndex: 2, message: 'Parsing files and extracting functions...' })

    const tree = buildFileTree(clonePath)
    const fileCount = countFiles(tree)

    if (fileCount > MAX_FILES) {
      finish(job, {
        status: 'failed',
        error: `Repo too large (${fileCount} files). The current limit is ${MAX_FILES} files.`
      })
      return
    }

    const extractedFunctions = await extractFunctionsFromTree(tree, clonePath)

    const totalFunctions = extractedFunctions.reduce(
      (sum, f) => sum + f.functionCount,
      0
    )

    console.log(`Extracted ${totalFunctions} functions`)

    emit(job, { step: 'evolution', stepIndex: 3, message: 'Analyzing code evolution...' })
    let evolutionData = {}

    try {
      evolutionData = await getCodeEvolution(clonePath, extractedFunctions)
      console.log('Evolution analysis complete')
    } catch (evoErr) {
      console.error('Evolution error:', evoErr.message)
    }

    emit(job, { step: 'index', stepIndex: 4, message: 'Generating embeddings and indexing (longest step)...' })

    // The payload is raw source code, which web application firewalls in
    // front of hosting providers block as injection attacks (e.g. a literal
    // "etc/passwd" in a security comment reads as a path-traversal attempt).
    // Gzip+base64 makes the body opaque to pattern matching — and ~4x smaller.
    const encodedFunctions = zlib
      .gzipSync(JSON.stringify(extractedFunctions))
      .toString('base64')

    const indexResponse = await axios.post(
      `${AI_SERVICE_URL}/index`,
      {
        repo_name: repoName,
        extracted_functions_b64: encodedFunctions
      },
      { timeout: 60000 }
    )
    const indexStatus = indexResponse.data.status
    console.log('AI service response:', indexStatus)

    // /index returns immediately; wait for the background embedding to
    // actually finish so "done" means the chat is genuinely ready.
    if (indexStatus !== 'already_indexed') {
      const deadline = Date.now() + 12 * 60 * 1000
      let indexed = false
      while (!indexed && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 4000))
        try {
          const s = await axios.get(
            `${AI_SERVICE_URL}/index-status/${encodeURIComponent(repoName)}`,
            { timeout: 15000 }
          )
          if (s.data.status === 'indexed') indexed = true
          if (s.data.status === 'failed') {
            finish(job, { status: 'failed', error: 'Embedding failed on the AI service. Please try again.' })
            return
          }
        } catch { /* transient poll failure — keep trying */ }
      }
      if (!indexed) {
        finish(job, { status: 'failed', error: 'Indexing timed out. Please try again.' })
        return
      }
    }

    finish(job, {
      status: 'done',
      stepIndex: 5,
      message: 'Analysis complete',
      result: { repoName, fileCount, totalFunctions, tree, evolutionData }
    })

  } catch (err) {
    console.error('Analysis error:', err.message)
    const friendly = err.message?.includes('ECONNREFUSED') || err.response
      ? 'The AI service is unavailable. Please try again in a minute.'
      : 'Failed to analyze repo'
    finish(job, { status: 'failed', error: friendly })
  } finally {
    activeAnalyses.delete(repoName)
  }
}

/**
 * GET /analyze/status/:jobId — SSE stream of job snapshots.
 * `?poll=1` returns a single JSON snapshot instead (fallback for proxies
 * that mishandle SSE).
 */
function analysisStatus(req, res) {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  if (req.query.poll === '1') {
    return res.status(200).json(publicView(job))
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  res.write(`data: ${JSON.stringify(publicView(job))}\n\n`)   // immediate snapshot
  if (job.status !== 'running') return res.end()               // late subscriber
  job.listeners.add(res)
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)
  req.on('close', () => { clearInterval(heartbeat); job.listeners.delete(res) })
}

/**
 * Proxies the AI service's background-indexing status so the frontend can
 * poll with short requests (free-tier proxies kill long-running ones).
 */
async function getIndexStatus(req, res) {
  const { repoName } = req.query

  if (!repoName) {
    return res.status(400).json({ error: 'repoName is required' })
  }

  try {
    const response = await axios.get(
      `${AI_SERVICE_URL}/index-status/${encodeURIComponent(repoName)}`,
      { timeout: 15000 }
    )
    return res.status(200).json(response.data)
  } catch (err) {
    console.error('Index status error:', err.message)
    return res.status(502).json({ error: 'AI service unreachable' })
  }
}

async function queryRepo(req, res) {
  const { repoName, question } = req.body

  if (!repoName || !question) {
    return res.status(400).json({ error: 'repoName and question are required' })
  }

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/query`,
      {
        repo_name: repoName,
        question
      },
      { timeout: 60000 }
    )

    return res.status(200).json(response.data)
  } catch (err) {
    console.error('Query error:', err.message)
    const status = err.response?.status || 500
    const detail = err.response?.data?.detail || 'Failed to query repo'
    return res.status(status).json({ error: detail })
  }
}

async function getFileContent(req, res) {
  const { repoName, filePath } = req.query

  if (!repoName || !filePath) {
    return res.status(400).json({ error: 'repoName and filePath are required' })
  }

  try {
    const repoDir = path.resolve(CLONE_BASE, repoName)

    // --- Security: Path traversal protection ---
    // Resolve the full path and verify it stays within the clone directory.
    // Without this, filePath = "../../etc/passwd" would read arbitrary files.
    const { safe, resolvedPath } = safePath(repoDir, filePath)
    if (!safe) {
      return res.status(403).json({ error: 'Access denied: path outside repository' })
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8')
    const lines = content.split('\n')

    return res.status(200).json({
      filePath,
      content,
      lines,
      totalLines: lines.length
    })
  } catch (err) {
    console.error('File read error:', err.message)
    return res.status(500).json({ error: 'Failed to read file' })
  }
}

/**
 * 🔥 NEW: Function Evolution API
 */
async function getFunctionEvolution(req, res) {
  const { repoName, filePath, functionName } = req.query

  if (!repoName || !filePath || !functionName) {
    return res.status(400).json({
      error: 'repoName, filePath and functionName are required'
    })
  }

  try {
    const clonePath = path.resolve(CLONE_BASE, repoName)

    // --- Security: Path traversal protection ---
    const { safe } = safePath(CLONE_BASE, repoName)
    if (!safe) {
      return res.status(403).json({ error: 'Access denied: invalid repository name' })
    }

    const tree = buildFileTree(clonePath)
    const extractedFunctions = await extractFunctionsFromTree(tree, clonePath)

    const evolutionData = await getCodeEvolution(clonePath, extractedFunctions)

    const key = `${filePath.replace(/\\/g, '/')}::${functionName}`

    const functionData = evolutionData[key]

    if (!functionData) {
      return res.status(404).json({
        error: 'No evolution data found for this function'
      })
    }

    let summary = ''

    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/evolution-summary`, {
        history: functionData.history
      })

      summary = aiResponse.data.summary
    } catch (err) {
      console.error('Summary error:', err.message)
      summary = 'Summary not available'
    }

    return res.status(200).json({
      filePath,
      functionName,
      history: functionData.history,
      summary
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch evolution data' })
  }
}

module.exports = {
  startAnalysis,
  analysisStatus,
  queryRepo,
  getFileContent,
  getFunctionEvolution,
  getIndexStatus
}