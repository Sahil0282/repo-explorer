// src/pages/LandingPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleAnalyze() {
    if (!repoUrl.trim()) return
    setLoading(true)
    setError('')

    try {
      const response = await axios.post('http://localhost:8000/api/repo/analyze', {
        repoUrl
      }, { timeout: 300000 })

      navigate('/chat', {
        state: {
          repoName: response.data.repoName,
          fileCount: response.data.fileCount,
          totalFunctions: response.data.totalFunctions,
          tree: response.data.tree
        }
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to analyze repo. Check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAnalyze()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center flex-1 px-4 pt-24 pb-16">

        {/* Badge */}
        <div className="mb-6 px-3 py-1 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 text-[#818cf8] text-sm">
          Understand any codebase
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-center leading-tight mb-6 max-w-3xl">
          Understand any codebase,{' '}
          <span className="text-[#818cf8]">instantly.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-[#888] text-lg text-center max-w-xl mb-10 leading-relaxed">
          Paste a GitHub URL. Ask questions in plain English. Get answers
          with a visual map of exactly which files and functions are involved.
        </p>

        {/* URL Input */}
        <div className="w-full max-w-xl mb-3">
          <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/50 transition-all">
            <svg className="w-4 h-4 text-[#555] shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <input
              type="text"
              placeholder="Paste GitHub repository URL..."
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 bg-transparent text-white placeholder-[#555] outline-none text-sm"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !repoUrl.trim()}
              className="shrink-0 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>Analyze →</>
              )}
            </button>
          </div>

          {/* Loading state — show steps while analyzing */}
          {loading && (
            <div className="mt-4 bg-[#0d0d1a] border border-[#6366f1]/20 rounded-xl p-4">
              <p className="text-[#818cf8] text-xs font-medium mb-3">Analyzing repository...</p>
              <div className="space-y-2">
                {[
                  'Cloning repository from GitHub',
                  'Parsing files and extracting functions',
                  'Generating embeddings with MiniLM',
                  'Indexing into vector database',
                  'Ready to answer questions'
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#555]">
                    <svg className="animate-spin w-3 h-3 text-[#6366f1] shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {step}
                  </div>
                ))}
              </div>
              <p className="text-[#444] text-xs mt-3">
                First time repos take 60–90 seconds. Cached repos are instant.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mt-12">
          {[
            { title: 'Zero Setup', desc: 'No cloning, no IDE. Just a URL.', icon: '⚡' },
            { title: 'AI-Powered Q&A', desc: 'Ask anything about the codebase in plain English.', icon: '🤖' },
            { title: 'Focus Map', desc: 'Visual map of exactly which functions answer your question.', icon: '🗺️' }
          ].map(card => (
            <div
              key={card.title}
              className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 hover:border-[#6366f1]/30 transition-all"
            >
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-white mb-1">{card.title}</h3>
              <p className="text-[#666] text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 py-16 border-t border-[#111]">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="flex flex-col md:flex-row items-start justify-center gap-8 max-w-3xl mx-auto">
          {[
            { step: '1', title: 'Paste any public GitHub repo URL', desc: 'Share the link to any public GitHub repository you want to analyze.' },
            { step: '2', title: 'Ask a natural language question', desc: 'Use plain English to ask anything about the codebase structure and functionality.' },
            { step: '3', title: 'Get an answer + focused visual', desc: 'Receive a detailed answer with a visual map of relevant files and functions.' }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center flex-1">
              <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center font-bold mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-[#666] text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}