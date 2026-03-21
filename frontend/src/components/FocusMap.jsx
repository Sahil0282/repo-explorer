import { useState, useRef } from "react";
import axios from "axios";

function FunctionNode({ fn, repoName }) {
  const [hovered, setHovered] = useState(false);
  const [code, setCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const nodeRef = useRef(null);

  async function handleHover() {
    setHovered(true);
    const rect = nodeRef.current.getBoundingClientRect();
    const tooltipWidth = 500;
    const spaceOnRight = window.innerWidth - rect.right;

    const left =
      spaceOnRight > tooltipWidth + 20
        ? rect.right + 12
        : rect.left - tooltipWidth - 12;

    setPos({
      top: Math.min(rect.top, window.innerHeight - 500),
      left,
    });

    if (code) return;
    setLoadingCode(true);
    try {
      const res = await axios.get("http://localhost:8000/api/repo/file", {
        params: { repoName, filePath: fn.file },
      });
      const lines = res.data.lines;
      const snippet = lines.slice(fn.startLine - 1, fn.endLine).join("\n");
      setCode(snippet);
    } catch {
      setCode("// Could not load code");
    } finally {
      setLoadingCode(false);
    }
  }

  return (
    <>
      <div
        ref={nodeRef}
        onMouseEnter={handleHover}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-2 bg-[#111] border border-[#1e1e1e] hover:border-[#6366f1]/60 rounded-lg px-3 py-1.5 cursor-pointer transition-all">
        <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
        <span className="text-[#ccc] text-xs font-mono">
          {fn.name === "anonymous" || fn.name === "__file_summary__"
            ? `${fn.file.split("/").pop()}:${fn.startLine}`
            : fn.name}
        </span>
        <span className="ml-auto text-[#444] text-xs">L{fn.startLine}</span>
      </div>

      {hovered && (
        <div
          style={{ top: pos.top, left: pos.left, position: "fixed" }}
          className="z-[9999] w-[500px] bg-[#0d0d1a] border border-[#6366f1]/30 rounded-xl shadow-2xl overflow-hidden"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}>
          <div className="px-3 py-2 border-b border-[#1a1a1a]">
            <span className="text-[#818cf8] text-xs font-mono truncate block">
              {fn.file} · L{fn.startLine}–{fn.endLine}
            </span>
          </div>
          <div className="overflow-auto max-h-[70vh]">
            {loadingCode ? (
              <div className="p-3 text-[#555] text-xs">Loading...</div>
            ) : (
              <table className="w-full text-xs font-mono">
                <tbody>
                  {code.split("\n").map((line, i) => (
                    <tr key={i} className="hover:bg-[#111]">
                      <td className="text-[#333] text-right px-2 py-0.5 select-none w-8">
                        {fn.startLine + i}
                      </td>
                      <td className="text-[#ccc] px-2 py-0.5 whitespace-pre">
                        {line || " "}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function FocusMap({ data, repoName }) {
  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#444] text-sm p-4 text-center gap-2">
        <div className="text-4xl mb-2">🗺️</div>
        <p>Ask a question and click</p>
        <p className="text-[#6366f1]">"View in Focus Map →"</p>
        <p>to see the visual</p>
      </div>
    );
  }

  const { sourceFunctions } = data;

  const fileGroups = {};
  sourceFunctions?.forEach((fn) => {
    if (fn.name === "__file_summary__") return;
    if (!fileGroups[fn.file]) fileGroups[fn.file] = [];
    fileGroups[fn.file].push(fn);
  });

  const files = Object.keys(fileGroups);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <p className="text-[#444] text-xs mb-2">
        Hover a function to see its code
      </p>
      {files.map((file, fi) => (
        <div
          key={fi}
          className="border border-[#6366f1]/20 bg-[#0d0d1a] rounded-xl p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0" />
            <span className="text-[#818cf8] text-xs font-mono font-semibold truncate">
              {file}
            </span>
          </div>
          <div className="ml-4 space-y-2">
            {fileGroups[file].map((fn, fni) => (
              <FunctionNode key={fni} fn={fn} repoName={repoName} />
            ))}
          </div>
        </div>
      ))}
      {files.length > 1 && (
        <p className="text-center text-[#333] text-xs">
          {files.length} files · {sourceFunctions?.length} functions involved
        </p>
      )}
    </div>
  );
}
