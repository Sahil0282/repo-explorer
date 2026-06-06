const axios = require('axios')
const simpleGit = require('simple-git')
const fs = require('fs')
const path = require('path')

const { buildFileTree, countFiles } = require('../utils/fileTree')
const { extractFunctionsFromTree } = require('../utils/extractFunctions')
const { getCodeEvolution } = require('../utils/gitEvolution')

const CLONE_BASE = './temp_repos'

async function analyzeRepo(req, res) {
  const { repoUrl } = req.body

  if (!repoUrl || !repoUrl.startsWith('https://github.com')) {
    return res.status(400).json({ error: 'Invalid GitHub URL' })
  }

  const repoName = repoUrl
    .replace('https://github.com/', '')
    .replace('/', '_')

  const clonePath = path.join(CLONE_BASE, repoName)

  try {
    if (!fs.existsSync(clonePath)) {
      fs.mkdirSync(CLONE_BASE, { recursive: true })
      console.log(`Cloning ${repoUrl}...`)
      await simpleGit().clone(repoUrl, clonePath)
      console.log('Clone complete')
    } else {
      console.log('Repo already cloned, using cache')
    }

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

    try {
      const indexResponse = await axios.post(
        'http://localhost:8001/index',
        {
          repo_name: repoName,
          extracted_functions: extractedFunctions
        },
        {
          timeout: 300000
        }
      )

      console.log('AI service response:', indexResponse.data.status)
    } catch (aiErr) {
      console.error('AI service error:', aiErr.message)
    }

    return res.status(200).json({
      repoName,
      fileCount,
      totalFunctions,
      tree,
      evolutionData
    })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to analyze repo' })
  }
}

async function queryRepo(req, res) {
  const { repoName, question } = req.body

  if (!repoName || !question) {
    return res.status(400).json({ error: 'repoName and question are required' })
  }

  try {
    const response = await axios.post(
      'http://localhost:8001/query',
      {
        repo_name: repoName,
        question
      },
      { timeout: 60000 }
    )

    return res.status(200).json(response.data)
  } catch (err) {
    console.error('Query error:', err.message)
    return res.status(500).json({ error: 'Failed to query repo' })
  }
}

async function getFileContent(req, res) {
  const { repoName, filePath } = req.query

  if (!repoName || !filePath) {
    return res.status(400).json({ error: 'repoName and filePath are required' })
  }

  try {
    const fullPath = path.join(CLONE_BASE, repoName, filePath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
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
    const clonePath = path.join(CLONE_BASE, repoName)

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
      const aiResponse = await axios.post('http://localhost:8001/evolution-summary', {
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
  getFunctionEvolution 
}