const express = require('express')
const rateLimit = require('express-rate-limit')
const { startAnalysis, analysisStatus, queryRepo, getFileContent, getFunctionEvolution, getIndexStatus } = require('../controllers/repoController')

const router = express.Router()

// Limit for /analyze. Starting a job is cheap now (validation + GitHub API
// pre-checks return in <1s; the heavy work runs in one background job per
// repo), so the budget mainly bounds how many concurrent jobs one IP can
// spawn — generous enough for someone demo-testing several repos in a row.
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis rate limit exceeded. Try again in a few minutes." }
})

// Moderate limit for /query — normal chat usage
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Query rate limit exceeded. Please slow down." }
})

router.post('/analyze', analyzeLimiter, startAnalysis)
// Status stream must NOT sit behind analyzeLimiter (5/15min) — a couple of
// reconnects would lock users out of status checks entirely.
router.get('/analyze/status/:jobId', analysisStatus)
router.post('/query', queryLimiter, queryRepo)
router.get('/file', getFileContent)
router.get('/evolution', getFunctionEvolution)
router.get('/index-status', getIndexStatus)

module.exports = router