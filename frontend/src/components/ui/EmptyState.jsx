// Centered empty/placeholder state with an icon tile. Standardizes the
// "nothing here yet" panels in the Execution Flow, File Viewer, and Git Evolution.
export default function EmptyState({ icon: Icon, iconClassName = "text-brand-400", children, className = "" }) {
  return (
    <div className={`h-full flex flex-col items-center justify-center text-center text-content-muted text-sm gap-3 px-6 ${className}`}>
      {Icon && (
        <span className="w-14 h-14 rounded-2xl bg-surface border border-edge-subtle flex items-center justify-center">
          <Icon size={26} className={iconClassName} />
        </span>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
