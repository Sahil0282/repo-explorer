// Three bouncing brand dots — the app's standard "thinking" indicator.
// Used by the chat stream and the Git Evolution drawer.
export default function LoadingDots({ label, className = "" }) {
  return (
    <div className={`flex items-center gap-2 text-content-muted text-sm ${className}`}>
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 bg-brand-violet rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      {label}
    </div>
  );
}
