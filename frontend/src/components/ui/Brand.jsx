// Brand mark + wordmark. Single source of truth for the RepoExplorer logo,
// used in the landing header and the chat top bar.
const SIZES = {
  sm: { box: "w-7 h-7", icon: "w-3.5 h-3.5", text: "text-sm" },
  md: { box: "w-8 h-8", icon: "w-4 h-4", text: "text-[15px]" },
};

export default function Brand({ size = "md", showText = true, onClick, className = "" }) {
  const s = SIZES[size] || SIZES.md;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      title={onClick ? "Back to home" : undefined}
      className={`flex items-center gap-2.5 shrink-0 ${onClick ? "group" : ""} ${className}`}
    >
      <span
        className={`${s.box} rounded-lg bg-brand-gradient shadow-brand-glow flex items-center justify-center transition-transform ${
          onClick ? "group-hover:scale-105" : ""
        }`}
      >
        <svg className={`${s.icon} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
        </svg>
      </span>
      {showText && (
        <span className={`${s.text} font-bold tracking-tight leading-none bg-brand-gradient bg-clip-text text-transparent`}>
          RepoExplorer
        </span>
      )}
    </Tag>
  );
}
