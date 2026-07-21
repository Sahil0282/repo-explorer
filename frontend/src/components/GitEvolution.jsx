import { useState, useEffect } from "react";
import axios from "axios";
import { History, X, Sparkles, ScrollText } from "lucide-react";
import LoadingDots from "./ui/LoadingDots";
import EmptyState from "./ui/EmptyState";

function shortHash(hash) {
  return hash ? hash.slice(0, 7) : "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Group flat history entries by commit so the timeline reads commit-by-commit.
function groupByCommit(history) {
  const groups = [];
  const index = {};
  for (const entry of history) {
    if (!index[entry.commit]) {
      index[entry.commit] = {
        commit: entry.commit,
        date: entry.date,
        changes: [],
      };
      groups.push(index[entry.commit]);
    }
    index[entry.commit].changes.push(entry);
  }
  return groups;
}

export default function GitEvolution({ repoName, target, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const open = Boolean(target);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;

    setLoading(true);
    setError("");
    setData(null);

    axios
      .get("http://localhost:8000/api/repo/evolution", {
        params: {
          repoName,
          filePath: target.file,
          functionName: target.name,
        },
      })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          // 404 = no evolution data for this function; treat as graceful empty
          if (err.response?.status === 404) {
            setData({ history: [], summary: "" });
          } else {
            setError(
              err.response?.data?.error || "Failed to load evolution history."
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoName, target]);

  if (!open) return null;

  const groups = data?.history ? groupByCommit(data.history) : [];
  const isEmpty = !loading && !error && groups.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-base/70 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-base border-l border-edge-subtle z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-edge-subtle shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-content-primary">Git Evolution</h2>
            </div>
            <p className="text-brand-400 text-xs font-mono mt-1 truncate">
              {target.name}
            </p>
            <p className="text-content-muted text-xs font-mono truncate">
              {target.file}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-content-muted hover:text-content-primary ml-3 shrink-0 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <LoadingDots label="Analyzing history..." />}

          {error && (
            <div className="alert-error text-sm px-4 py-3">
              {error}
            </div>
          )}

          {isEmpty && (
            <EmptyState icon={ScrollText} iconClassName="text-content-faint" className="pt-16">
              <p>No recorded changes for this function</p>
              <p className="text-content-faint">
                It may be new, unchanged, or outside the last 20 commits.
              </p>
            </EmptyState>
          )}

          {!loading && !error && !isEmpty && (
            <>
              {/* AI Summary */}
              {data.summary && (
                <div className="mb-6 bg-brand/5 border border-brand/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={13} className="text-brand-400" />
                    <span className="text-brand-400 text-xs font-semibold uppercase tracking-wide">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-content-secondary text-sm leading-relaxed whitespace-pre-line">
                    {data.summary}
                  </p>
                </div>
              )}

              {/* Commit Timeline */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-content-muted text-xs font-semibold uppercase tracking-wide">
                  Timeline
                </span>
                <span className="text-content-faint text-xs">
                  {groups.length} commit{groups.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="relative pl-4">
                {/* vertical line */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-edge" />

                {groups.map((group, gi) => (
                  <div key={gi} className="relative mb-5 last:mb-0">
                    {/* dot */}
                    <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-brand-gradient border-2 border-base" />

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-brand-400 text-xs font-mono">
                        {shortHash(group.commit)}
                      </span>
                      <span className="text-content-muted text-xs">
                        {formatDate(group.date)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {group.changes.map((c, ci) => (
                        <div
                          key={ci}
                          className="flex items-start gap-2 text-xs font-mono"
                        >
                          <span
                            className={`shrink-0 ${
                              c.changeType === "add"
                                ? "text-accent-green"
                                : "text-accent-red"
                            }`}
                          >
                            {c.changeType === "add" ? "+" : "−"}
                          </span>
                          <span className="text-content-secondary break-all whitespace-pre-wrap">
                            {c.preview || "(empty line)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
