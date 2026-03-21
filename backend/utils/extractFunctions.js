const fs = require('fs')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

// only process these file types
const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

function extractFunctionsFromFile(filePath) {
  // check if this file extension is supported
  const ext = filePath.slice(filePath.lastIndexOf('.'))
  if (!SUPPORTED_EXTENSIONS.includes(ext)) return null

  let code
  try {
    code = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    // file might be binary or unreadable, skip it
    return null
  }

  // skip very large files - over 500kb is likely generated/minified code
  if (code.length > 500000) return null

  let ast
  try {
    ast = parser.parse(code, {
      // sourceType module handles both import/export and require
      sourceType: 'unambiguous',
      plugins: [
        'jsx',          // support JSX syntax
        'typescript',   // support TypeScript syntax
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator'
      ],
      // don't crash on syntax errors, just skip what it can't parse
      errorRecovery: true
    })
  } catch (err) {
    // unparseable file - skip silently
    return null
  }

  const functions = []

  traverse(ast, {
    // catches: function foo() {}
    FunctionDeclaration(path) {
      const name = path.node.id ? path.node.id.name : 'anonymous'
      functions.push({
        name,
        type: 'FunctionDeclaration',
        code: code.slice(path.node.start, path.node.end),
        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line
      })
    },

    // catches: const foo = function() {}
    FunctionExpression(path) {
      // get the variable name if it exists e.g. "const foo = function() {}"
      let name = 'anonymous'
      if (path.parent.type === 'VariableDeclarator' && path.parent.id) {
        name = path.parent.id.name
      } else if (path.parent.type === 'AssignmentExpression') {
        // catches: module.exports = function() {} or app.use = function() {}
        name = code.slice(path.parent.left.start, path.parent.left.end)
      }
      functions.push({
        name,
        type: 'FunctionExpression',
        code: code.slice(path.node.start, path.node.end),
        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line
      })
    },

    // catches: const foo = () => {}
    ArrowFunctionExpression(path) {
      let name = 'anonymous'
      if (path.parent.type === 'VariableDeclarator' && path.parent.id) {
        name = path.parent.id.name
      }
      functions.push({
        name,
        type: 'ArrowFunction',
        code: code.slice(path.node.start, path.node.end),
        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line
      })
    },

    // catches: class methods like async fetchUser() {}
    ClassMethod(path) {
      const name = path.node.key.name || 'anonymous'
      functions.push({
        name,
        type: 'ClassMethod',
        code: code.slice(path.node.start, path.node.end),
        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line
      })
    }
  })

  return functions
}

// this is the main function called from outside
// it takes the full file tree and extracts functions from every file
function extractFunctionsFromTree(tree, basePath) {
  const results = []

  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'file') {
        const fullPath = require('path').join(basePath, node.path)
        const functions = extractFunctionsFromFile(fullPath)

        // only include files that had parseable functions
        if (functions && functions.length > 0) {
          results.push({
            filePath: node.path,
            functionCount: functions.length,
            functions
          })
        }
      } else if (node.type === 'folder' && node.children) {
        walk(node.children)
      }
    }
  }

  walk(tree)
  return results
}

module.exports = { extractFunctionsFromTree }