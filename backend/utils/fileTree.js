const fs = require('fs')
const path = require('path')

const IGNORE = new Set([
  'node_modules', '.git', '.next', 'dist',
  'build', '.cache', 'coverage'
])

function buildFileTree(dirPath, relativePath = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const result = []

  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)
    const relPath = path.join(relativePath, entry.name)

    if (entry.isDirectory()) {
      result.push({
        type: 'folder',
        name: entry.name,
        path: relPath,
        children: buildFileTree(fullPath, relPath)
      })
    } else {
      result.push({
        type: 'file',
        name: entry.name,
        path: relPath
      })
    }
  }

  return result
}

function countFiles(tree) {
  let count = 0
  for (const node of tree) {
    if (node.type === 'file') count++
    else if (node.type === 'folder') count += countFiles(node.children)
  }
  return count
}

module.exports = { buildFileTree, countFiles }