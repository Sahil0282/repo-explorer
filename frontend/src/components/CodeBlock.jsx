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

  const containerClass = `rounded-xl overflow-hidden border border-edge-subtle bg-surface-sunken flex flex-col ${className}`;

  return (
    <div className={containerClass}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-edge-subtle shrink-0">
        <span className="text-xs font-mono text-content-muted truncate">{title || language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="text-content-muted hover:text-content-primary transition-colors flex items-center gap-1 text-xs shrink-0 ml-2"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code Area */}
      <div className={`p-4 overflow-auto text-sm flex-1 ${showLineNumbers ? 'show-line-numbers' : ''}`}>
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="font-mono text-content-secondary"><code>{code}</code></pre>
        )}
      </div>
    </div>
  );
}
