import { useState, useEffect } from 'react'
import axios from 'axios'

export default function FileViewer({ repoName, filePath }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-[#444] text-sm">
        Click a file in the File Tree to view its contents
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-[#555] text-sm">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* File path header */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <span className="text-[#818cf8] text-xs font-mono">{filePath}</span>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {content.split('\n').map((line, i) => (
              <tr key={i} className="hover:bg-[#111]">
                <td className="text-[#333] text-right px-3 py-0.5 select-none w-10 shrink-0">
                  {i + 1}
                </td>
                <td className="text-[#ccc] px-3 py-0.5 whitespace-pre">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}