import ReactMarkdown from 'react-markdown'

export default function ChatMessage({ message, onViewFocusMap }) {
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
              code: ({ children }) => (
                <code className="bg-[#1a1a2e] text-[#818cf8] px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        )}

        {message.role === 'ai' && message.sourceFunctions?.length > 0 && (
          <button
            onClick={() => onViewFocusMap(message.sourceFunctions, message.sourceFiles)}
            className="mt-3 text-[#818cf8] text-xs hover:underline flex items-center gap-1"
          >
            View in Focus Map →
          </button>
        )}
      </div>
    </div>
  )
}