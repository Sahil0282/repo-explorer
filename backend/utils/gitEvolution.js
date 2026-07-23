const simpleGit = require('simple-git')

function normalizePath(p) {
  if (!p) return ''
  return p.replace(/\\/g, '/')
}

/**
 * MAIN FUNCTION
 */
async function getCodeEvolution(repoPath, extractedFunctions) {
  const git = simpleGit(repoPath)

  let log
  try {
    log = await git.log({ maxCount: 20 })
  } catch (err) {
    console.error('Git log error:', err.message)
    return {}
  }

  const evolutionMap = {}

  for (const commit of log.all) {
    const commitHash = commit.hash

    let diff
    try {
      // Restrict diffs to the file types we actually map functions for.
      // Without the pathspec, one commit touching notebooks/datasets can
      // produce a multi-hundred-MB diff string and OOM small hosts.
      diff = await git.show([
        commitHash, '--unified=0', '--',
        '*.js', '*.jsx', '*.ts', '*.tsx'
      ])
    } catch (err) {
      console.error(`Git show error for ${commitHash}:`, err.message)
      continue
    }

    // Defensive cap: skip pathological commits (vendored bundles, minified
    // blobs) rather than parse a giant string on a small instance.
    if (diff.length > 5 * 1024 * 1024) {
      console.log(`Skipping oversized diff for ${commitHash} (${diff.length} bytes)`)
      continue
    }

    const changes = parseDiffWithLineNumbers(diff)

    mapChangesToFunctions(
      changes,
      extractedFunctions,
      evolutionMap,
      commitHash,
      commit.date
    )
  }

  return evolutionMap
}

/**
 * 🔥 NEW: Parse diff WITH line numbers
 */
function parseDiffWithLineNumbers(diffText) {
  const lines = diffText.split('\n')

  let currentFile = null
  let currentLine = null

  const changes = []

  for (const line of lines) {
    // file detection
    if (line.startsWith('diff --git')) {
      const parts = line.split(' ')
      if (parts.length >= 3) {
        currentFile = normalizePath(parts[2].replace('a/', ''))
      }
    }

    // hunk header (line numbers)
    else if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/)
      if (match) {
        currentLine = parseInt(match[1])
      }
    }

    // added line
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      if (currentLine !== null) {
        changes.push({
          filePath: currentFile,
          lineNumber: currentLine,
          type: 'add',
          content: line.slice(1)
        })
        currentLine++
      }
    }

    // deleted line
    else if (line.startsWith('-') && !line.startsWith('---')) {
      changes.push({
        filePath: currentFile,
        lineNumber: currentLine,
        type: 'delete',
        content: line.slice(1)
      })
    }

    // context line
    else {
      if (currentLine !== null) currentLine++
    }
  }

  return changes
}

/**
 * 🔥 PRECISE MAPPING (REAL USP)
 */
function mapChangesToFunctions(
  changes,
  extractedFunctions,
  evolutionMap,
  commitHash,
  commitDate
) {
  for (const change of changes) {
    if (!change.filePath || !change.lineNumber) continue

    const normalizedPath = normalizePath(change.filePath)

    const fileData = extractedFunctions.find(
      f => normalizePath(f.filePath) === normalizedPath
    )

    if (!fileData) continue

    for (const func of fileData.functions) {
      // 🎯 LINE-LEVEL MATCH
      if (
        change.lineNumber >= func.startLine &&
        change.lineNumber <= func.endLine
      ) {
        const key = `${normalizedPath}::${func.name}`

        if (!evolutionMap[key]) {
          evolutionMap[key] = {
            filePath: normalizedPath,
            functionName: func.name,
            history: []
          }
        }

        // 🔥 prevent duplicates
        const alreadyExists = evolutionMap[key].history.some(
          h => h.commit === commitHash && h.preview === change.content
        )

        if (!alreadyExists) {
          evolutionMap[key].history.push({
            commit: commitHash,
            date: commitDate,
            changeType: change.type,
            preview: change.content.slice(0, 100)
          })
        }
      }
    }
  }
}

module.exports = { getCodeEvolution }