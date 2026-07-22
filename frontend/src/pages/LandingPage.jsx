import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowRight, Loader2, Zap, Sparkles, Map } from 'lucide-react'
import Brand from '../components/ui/Brand'
import { API_URL } from '../lib/api'

const GithubIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
)

const LOADING_MESSAGES = [
  'Cloning repository from GitHub...',
  'Parsing files and extracting functions...',
  'Generating embeddings with MiniLM...',
  'Indexing into vector database...',
  'Finalizing analysis...'
]

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length)
      }, 3000)
    } else {
      setLoadingMsgIdx(0)
    }
    return () => clearInterval(interval)
  }, [loading])

  async function handleAnalyze() {
    if (!repoUrl.trim()) return
    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/api/repo/analyze`, {
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
    <div className="min-h-screen bg-base text-content-primary flex flex-col font-sans relative overflow-hidden">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute inset-0 bg-brand-radial" />

      {/* Top nav — brand wordmark */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
        <Brand size="md" />
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="text-content-muted hover:text-content-primary transition-colors"
          title="GitHub"
        >
          <GithubIcon className="w-5 h-5" />
        </a>
      </header>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 pt-20 pb-20">

        {/* Badge */}
        <div className="mb-8 px-4 py-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand-400 text-xs font-semibold tracking-widest uppercase shadow-brand-glow">
          Understand any codebase
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-center leading-tight mb-8 max-w-4xl tracking-tight">
          Understand any codebase,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-violet">instantly.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-content-secondary text-lg md:text-xl text-center max-w-2xl mb-12 leading-relaxed">
          Paste a GitHub URL. Ask questions in plain English. Get answers
          with a visual map of exactly which files and functions are involved.
        </p>

        {/* URL Input */}
        <div className="w-full max-w-2xl mb-4 relative z-10">
          <div className={`flex items-center gap-3 bg-surface border rounded-2xl p-2 transition-all duration-300 shadow-2xl ${loading ? 'border-edge opacity-70' : 'border-edge hover:border-edge-strong focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 focus-within:shadow-brand-glow'}`}>
            <div className="pl-3 shrink-0 flex items-center justify-center">
              <GithubIcon className="w-5 h-5 text-content-muted" />
            </div>

            <input
              type="text"
              placeholder="Paste GitHub repository URL..."
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 bg-transparent text-content-primary placeholder-content-faint outline-none text-base md:text-lg h-12 w-full disabled:cursor-not-allowed"
            />

            <button
              onClick={handleAnalyze}
              disabled={loading || !repoUrl.trim()}
              className="btn-primary group shrink-0 px-5 h-12 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Analyzing</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Analyze</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Dynamic Loading State */}
          <div className="h-10 mt-3 flex items-center justify-center overflow-hidden">
            <div className={`transition-all duration-500 flex items-center gap-2 ${loading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
               <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
               <span className="text-sm font-medium text-brand-400">{LOADING_MESSAGES[loadingMsgIdx]}</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 text-center">
              <span className="alert-error inline-block text-sm px-4 py-1.5">
                {error}
              </span>
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-16">
          {[
            { title: 'Zero Setup', desc: 'No cloning, no IDE. Just paste a URL and start exploring instantly.', icon: Zap },
            { title: 'AI-Powered Q&A', desc: 'Ask complex structural questions in plain English.', icon: Sparkles },
            { title: 'Focus Map', desc: 'A node-based visual map showing exactly how functions interact.', icon: Map }
          ].map((card, i) => (
            <div
              key={i}
              className="group relative bg-gradient-to-b from-surface to-base border border-edge rounded-2xl p-6 hover:border-brand/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-glow-lg"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-raised border border-edge flex items-center justify-center mb-5 group-hover:bg-brand/10 group-hover:border-brand/30 transition-colors">
                <card.icon className="w-5 h-5 text-content-muted group-hover:text-brand-400 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-content-primary mb-2 tracking-tight">{card.title}</h3>
              <p className="text-content-secondary text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="relative z-10 px-4 py-24 border-t border-edge-subtle overflow-hidden bg-surface-sunken">
        <div className="absolute inset-0 bg-brand-radial"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">How it works</h2>

          <div className="relative flex flex-col md:flex-row items-start justify-between gap-12 md:gap-8">
            {/* Connecting Dashed Line (Desktop only) */}
            <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-[1px] border-t border-dashed border-edge"></div>

            {[
              { step: '1', title: 'Paste a public repo URL', desc: 'We securely clone and parse the AST of every relevant file in seconds.' },
              { step: '2', title: 'Ask natural questions', desc: 'Our embedded LLM understands the deep context and structure of the code.' },
              { step: '3', title: 'Get focused visuals', desc: 'Instead of just text, you get a beautiful node map of the exact call stack.' }
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center flex-1 bg-surface-sunken px-4">
                <div className="w-12 h-12 rounded-full bg-base border-2 border-edge text-content-secondary flex items-center justify-center font-bold text-lg mb-6 shadow-xl relative z-10">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-3 tracking-tight text-content-primary">{item.title}</h3>
                <p className="text-content-muted text-sm leading-relaxed max-w-[250px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
