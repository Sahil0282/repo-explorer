// Pill badge. `variant` maps to the centralized .badge-* classes in index.css.
export default function Badge({ variant = "neutral", children, className = "" }) {
  const variantClass = variant === "brand" ? "badge-brand" : "badge-neutral";
  return <span className={`badge ${variantClass} ${className}`}>{children}</span>;
}
