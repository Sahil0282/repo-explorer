const axios = require('axios')
const simpleGit = require('simple-git')
const fs = require('fs')
const path = require('path')

const { buildFileTree, countFiles } = require('../utils/fileTree')
const { extractFunctionsFromTree } = require('../utils/extractFunctions')
const { getCodeEvolution } = require('../utils/gitEvolution')

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
    repoName: `${owner}_${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`
  }
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

async function analyzeRepo(req, res) {
  const { repoUrl } = req.body

  const validation = validateGitHubUrl(repoUrl)
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error })
  }

  const repoName = validation.repoName

  const clonePath = path.resolve(CLONE_BASE, repoName)

  // Guard this repo against cleanup while its analysis is in flight.
  activeAnalyses.add(repoName)

  try {
    if (!fs.existsSync(clonePath)) {
      fs.mkdirSync(CLONE_BASE, { recursive: true })
      console.log(`Cloning ${validation.cloneUrl}...`)
      await simpleGit().clone(validation.cloneUrl, clonePath)
      console.log('Clone complete')
    } else {
      console.log('Repo already cloned, using cache')
    }

    // Now that the target clone is present, prune stale repos (keeps this one).
    cleanupOldRepos(repoName)

    const tree = buildFileTree(clonePath)
    const fileCount = countFiles(tree)

    if (fileCount > 300) {
      return res.status(400).json({
        error: `Repo too large (${fileCount} files). MVP supports up to 300 files.`
      })
    }

    console.log('Extracting functions...')
    const extractedFunctions = extractFunctionsFromTree(tree, clonePath)

    const totalFunctions = extractedFunctions.reduce(
      (sum, f) => sum + f.functionCount,
      0
    )

    console.log(`Extracted ${totalFunctions} functions`)

    console.log('Analyzing code evolution...')
    let evolutionData = {}

    try {
      evolutionData = await getCodeEvolution(clonePath, extractedFunctions)
      console.log('Evolution analysis complete')
    } catch (evoErr) {
      console.error('Evolution error:', evoErr.message)
    }

    console.log('Sending to AI service for indexing...')

    // /index returns immediately ("indexing" | "already_indexed") while
    // embedding runs in the background on the AI service — the frontend
    // polls GET /index-status until it's ready. A failure here is surfaced
    // as indexStatus: "failed" instead of silently dropping the user into
    // a chat whose repo was never indexed.
    let indexStatus = 'failed'
    try {
      const indexResponse = await axios.post(
        `${AI_SERVICE_URL}/index`,
        {
          repo_name: repoName,
          extracted_functions: extractedFunctions
        },
        { timeout: 60000 }
      )
      indexStatus = indexResponse.data.status
      console.log('AI service response:', indexStatus)
    } catch (aiErr) {
      console.error('AI service error:', aiErr.message)
    }

    return res.status(200).json({
      repoName,
      fileCount,
      totalFunctions,
      tree,
      evolutionData,
      indexStatus
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to analyze repo' })
  } finally {
    activeAnalyses.delete(repoName)
  }
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
    const extractedFunctions = extractFunctionsFromTree(tree, clonePath)

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
  analyzeRepo,
  queryRepo,
  getFileContent,
  getFunctionEvolution,
  getIndexStatus
}