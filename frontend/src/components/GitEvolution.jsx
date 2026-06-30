import { useState, useEffect } from "react";
import axios from "axios";

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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-[#0a0a0a] border-l border-[#1a1a1a] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🕒</span>
              <h2 className="text-sm font-semibold text-white">Git Evolution</h2>
            </div>
            <p className="text-[#818cf8] text-xs font-mono mt-1 truncate">
              {target.name}
            </p>
            <p className="text-[#555] text-xs font-mono truncate">
              {target.file}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white text-sm ml-3 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-[#555] text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              Analyzing history...
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {isEmpty && (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#444] text-sm gap-2 pt-16">
              <div className="text-3xl mb-1">📜</div>
              <p>No recorded changes for this function</p>
              <p className="text-[#333]">
                It may be new, unchanged, or outside the last 20 commits.
              </p>
            </div>
          )}

          {!loading && !error && !isEmpty && (
            <>
              {/* AI Summary */}
              {data.summary && (
                <div className="mb-6 bg-[#0d0d1a] border border-[#6366f1]/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs">✨</span>
                    <span className="text-[#818cf8] text-xs font-semibold uppercase tracking-wide">
                      AI Summary
                    </span>
                  </div>
                  <p className="text-[#ccc] text-sm leading-relaxed whitespace-pre-line">
                    {data.summary}
                  </p>
                </div>
              )}

              {/* Commit Timeline */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#666] text-xs font-semibold uppercase tracking-wide">
                  Timeline
                </span>
                <span className="text-[#333] text-xs">
                  {groups.length} commit{groups.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="relative pl-4">
                {/* vertical line */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#1e1e1e]" />

                {groups.map((group, gi) => (
                  <div key={gi} className="relative mb-5 last:mb-0">
                    {/* dot */}
                    <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-[#6366f1] border-2 border-[#0a0a0a]" />

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[#818cf8] text-xs font-mono">
                        {shortHash(group.commit)}
                      </span>
                      <span className="text-[#555] text-xs">
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
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {c.changeType === "add" ? "+" : "−"}
                          </span>
                          <span className="text-[#999] break-all whitespace-pre-wrap">
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
