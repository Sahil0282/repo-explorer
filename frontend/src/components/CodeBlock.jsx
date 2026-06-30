import { useState, useEffect } from 'react';
import { codeToHtml } from 'shiki';
import { Copy, Check } from 'lucide-react';

export default function CodeBlock({ code, language = 'text', title, showLineNumbers = false, className = '' }) {
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const highlight = async () => {
      try {
        const result = await codeToHtml(code, {
          lang: language || 'text',
          theme: 'github-dark'
        });
        if (isMounted) setHtml(result);
      } catch (err) {
        // Fallback if language is unsupported
        try {
          const result = await codeToHtml(code, {
            lang: 'text',
            theme: 'github-dark'
          });
          if (isMounted) setHtml(result);
        } catch (e) {
          // absolute fallback
        }
      }
    };
    
    highlight();
    
    return () => { isMounted = false; };
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerClass = `rounded-xl overflow-hidden border border-[#1e1e1e] bg-[#0d1117] flex flex-col ${className}`;

  return (
    <div className={containerClass}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#1e1e1e] shrink-0">
        <span className="text-xs font-mono text-[#8b949e]">{title || language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors flex items-center gap-1 text-xs"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code Area */}
      <div className={`p-4 overflow-auto text-sm flex-1 ${showLineNumbers ? 'show-line-numbers' : ''}`}>
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="font-mono text-[#c9d1d9]"><code>{code}</code></pre>
        )}
      </div>
    </div>
  );
}
