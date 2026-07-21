import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { History, FileCode2 } from 'lucide-react'
import CodeBlock from './CodeBlock'
import EmptyState from './ui/EmptyState'

export default function FileViewer({ repoName, filePath, highlight, selectedFunction, onViewEvolution }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!filePath || !repoName) return
    setLoading(true)
    setError('')

    axios.get('http://localhost:8000/api/repo/file', {
      params: { repoName, filePath }
    })
      .then(res => setContent(res.data.content))
      .catch(() => setError('Failed to load file'))
      .finally(() => setLoading(false))
  }, [filePath, repoName])

  // Scroll to + briefly highlight the referenced lines once the file (and
  // Shiki's async highlighting) have rendered. Retries because CodeBlock
  // highlights asynchronously, so the `.line` spans may not exist yet.
  useEffect(() => {
    if (!highlight || !content || loading) return
    const { startLine, endLine } = highlight
    let attempts = 0
    let removeTimer = null
    let rafId = null

    const apply = () => {
      const root = containerRef.current
      const lines = root ? root.querySelectorAll('.shiki .line') : []
      if (!lines.length) {
        if (attempts++ < 25) {
          rafId = requestAnimationFrame(apply)
        }
        return
      }

      const start = Math.max(0, startLine - 1)
      const end = Math.min(lines.length - 1, endLine - 1)
      const touched = []
      for (let i = start; i <= end; i++) {
        if (lines[i]) {
          lines[i].classList.add('line-highlight')
          touched.push(lines[i])
        }
      }

      if (touched.length) {
        touched[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
        removeTimer = setTimeout(() => {
          touched.forEach(el => el.classList.remove('line-highlight'))
        }, 2200)
      }
    }

    apply()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (removeTimer) clearTimeout(removeTimer)
    }
  }, [highlight, content, loading])

  if (!filePath) {
    return (
      <EmptyState icon={FileCode2} iconClassName="text-content-muted">
        <p>Click a file in the File Tree to view its contents</p>
      </EmptyState>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-content-muted text-sm">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-accent-red text-sm">
        {error}
      </div>
    )
  }

  // Show a contextual action when the open file matches the selected function
  // (set by clicking a function in the Execution Flow or a function citation).
  const showFnBar =
    selectedFunction && selectedFunction.name && selectedFunction.file === filePath

  return (
    <div ref={containerRef} className="h-full flex flex-col p-4 bg-base">
      {showFnBar && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-brand/10 border border-brand/30 rounded-lg shrink-0">
          <span className="text-brand-400 text-xs font-mono truncate">
            {selectedFunction.name}()
          </span>
          <button
            onClick={() => onViewEvolution?.(selectedFunction)}
            className="text-brand-400 hover:text-content-primary text-xs flex items-center gap-1.5 shrink-0 ml-2 transition-colors"
            title="View Git Evolution for this function"
          >
            <History size={13} /> View Git Evolution
          </button>
        </div>
      )}
      <CodeBlock
        code={content}
        language={filePath.split('.').pop()}
        title={filePath}
        showLineNumbers={true}
        className="h-full border-0 bg-transparent"
      />
    </div>
  )
}
