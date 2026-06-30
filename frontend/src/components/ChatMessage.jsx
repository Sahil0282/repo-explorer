import ReactMarkdown from 'react-markdown'
import CodeBlock from './CodeBlock'

// Flatten ReactMarkdown's `children` (string | array | node) into plain text.
function childrenToText(children) {
  if (children == null) return ''
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  return String(children)
}

// Resolve an inline-code token to a known file or function from this message's
// sources. Returns a click handler descriptor, or null if it's just plain code.
function resolveCitation(token, sourceFiles = [], sourceFunctions = []) {
  const text = token.trim()
  if (!text) return null

  // File reference — exact path, suffix, or basename match against sources.
  const fileMatch = sourceFiles.find(
    (f) =>
      f === text ||
      f.endsWith('/' + text) ||
      f.split('/').pop() === text
  )
  if (fileMatch) return { type: 'file', filePath: fileMatch }

  // Function reference — strip a trailing "()" then match by name.
  const fnName = text.replace(/\(\s*\)$/, '')
  const fnMatch = sourceFunctions.find((fn) => fn.name === fnName)
  if (fnMatch) return { type: 'function', fn: fnMatch }

  return null
}

export default function ChatMessage({ message, onViewFocusMap, onFileRef, onFunctionRef }) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
        message.role === 'user'
          ? 'bg-[#6366f1] text-white'
          : 'bg-[#111] border border-[#1e1e1e] text-[#ccc]'
      }`}>
        {message.role === 'user' ? (
          <p>{message.text}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              pre: ({ children, ...props }) => {
                if (children && children.props) {
                  const match = /language-(\w+)/.exec(children.props.className || '')
                  return (
                    <CodeBlock 
                      language={match ? match[1] : 'text'} 
                      code={String(children.props.children).replace(/\n$/, '')} 
                      className="my-3 shadow-xl transition-all duration-300 hover:shadow-2xl"
                    />
                  )
                }
                return <pre className="bg-[#111] p-3 rounded-xl overflow-auto my-3" {...props}>{children}</pre>
              },
              code: ({ children, ...props }) => {
                const token = childrenToText(children)
                const citation = resolveCitation(
                  token,
                  message.sourceFiles,
                  message.sourceFunctions
                )

                if (citation) {
                  const handleClick = () => {
                    if (citation.type === 'file') onFileRef?.(citation.filePath)
                    else onFunctionRef?.(citation.fn)
                  }
                  return (
                    <code
                      onClick={handleClick}
                      title={citation.type === 'file' ? 'Open in File Viewer' : 'Jump to function'}
                      className="bg-[#1a1a2e] text-[#818cf8] px-1.5 py-0.5 rounded text-sm font-mono break-words cursor-pointer hover:bg-[#6366f1]/30 hover:underline transition-colors"
                      {...props}
                    >
                      {children}
                    </code>
                  )
                }

                return (
                  <code className="bg-[#1a1a2e] text-[#818cf8] px-1.5 py-0.5 rounded text-sm font-mono break-words" {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        )}

        {message.role === 'ai' && message.executionFlow?.nodes?.length > 0 && (
          <button
            onClick={() => onViewFocusMap(message.executionFlow)}
            className="mt-3 text-[#818cf8] text-xs hover:underline flex items-center gap-1"
          >
            View Execution Flow →
          </button>
        )}
      </div>
    </div>
  )
}