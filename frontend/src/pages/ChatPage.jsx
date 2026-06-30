// src/pages/ChatPage.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import FileTree from "../components/FileTree";
import FocusMap from "../components/FocusMap";
import ChatMessage from "../components/ChatMessage";
import FileViewer from "../components/FileViewer";
import GitEvolution from "../components/GitEvolution";
import { loadSession, saveSession } from "../lib/chatStorage";

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // A fresh analysis arrives via router state; a page refresh has none, so we
  // fall back to the persisted session in LocalStorage.
  const fromNav = location.state?.repoName ? location.state : null;
  const persisted = useMemo(() => (fromNav ? null : loadSession()), [fromNav]);

  // Repository + metadata is fixed for the lifetime of a session.
  const repository = useMemo(() => {
    if (fromNav) {
      return {
        repoName: fromNav.repoName,
        fileCount: fromNav.fileCount,
        totalFunctions: fromNav.totalFunctions,
        tree: fromNav.tree,
      };
    }
    return persisted?.repository || null;
  }, [fromNav, persisted]);

  const repoName = repository?.repoName;
  const fileCount = repository?.fileCount;
  const totalFunctions = repository?.totalFunctions;
  const tree = repository?.tree;

  const [messages, setMessages] = useState(() => {
    if (fromNav) {
      return [
        {
          role: "ai",
          text: `Hi! I've analyzed **${fromNav.repoName}** — ${fromNav.fileCount} files, ${fromNav.totalFunctions} functions indexed. What would you like to know about this codebase?`,
          sourceFunctions: [],
          sourceFiles: [],
        },
      ];
    }
    return persisted?.messages?.length ? persisted.messages : [];
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  // Viewer/UI state — restored from the persisted session on a refresh.
  const vs = fromNav ? null : persisted?.viewerState;
  const [activeTab, setActiveTab] = useState(vs?.activeTab || "filetree");
  const [focusData, setFocusData] = useState(vs?.focusData || null);
  const [selectedFile, setSelectedFile] = useState(vs?.selectedFile || null);
  const [highlight, setHighlight] = useState(vs?.highlight || null);
  const [selectedFunction, setSelectedFunction] = useState(vs?.selectedFunction || null);
  const [evolutionTarget, setEvolutionTarget] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!repoName) navigate("/");
  }, [repoName]);

  // Persist the session whenever meaningful state changes. Debounced so rapid
  // updates coalesce; `question` is intentionally excluded so typing never
  // triggers serialization.
  useEffect(() => {
    if (!repoName) return;
    const id = setTimeout(() => {
      saveSession({
        repository,
        messages,
        viewerState: { activeTab, focusData, selectedFile, highlight, selectedFunction },
      });
    }, 300);
    return () => clearTimeout(id);
  }, [
    repoName,
    repository,
    messages,
    activeTab,
    focusData,
    selectedFile,
    highlight,
    selectedFunction,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!question.trim() || loading) return;

    const userMessage = { role: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:8000/api/repo/query",
        { repoName, question },
        { timeout: 60000 }
      );

      const aiMessage = {
        role: "ai",
        text: response.data.answer,
        sourceFiles: response.data.source_files,
        sourceFunctions: response.data.source_functions,
        executionFlow: response.data.execution_flow,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: errorMessage,
          sourceFiles: [],
          sourceFunctions: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Show the Execution Flow graph for an AI answer.
  function handleViewFocusMap(executionFlow) {
    setFocusData(executionFlow);
    setActiveTab("focusmap");
  }

  // Opens a file in the File Viewer (used by the File Tree and by clickable
  // file citations). Clears any active line highlight / selected function.
  function handleFileClick(filePath) {
    setSelectedFile(filePath);
    setHighlight(null);
    setSelectedFunction(null);
    setActiveTab("fileviewer");
  }

  // Open a function in the File Viewer: scroll to + highlight its lines, and
  // mark it as the selected function (drives the "View Git Evolution" action).
  // `fn` carries { file, name, startLine, endLine }.
  function handleFunctionRef(fn) {
    if (!fn?.file) return;
    setSelectedFile(fn.file);
    setHighlight({ startLine: fn.startLine, endLine: fn.endLine });
    setSelectedFunction(fn.name ? fn : null);
    setActiveTab("fileviewer");
  }

  // Click on an Execution Flow node. Code-backed nodes open in the File Viewer;
  // function-backed nodes additionally become the selected function.
  function handleOpenFlowNode(nodeData) {
    if (!nodeData?.file) return;
    if (nodeData.functionName) {
      handleFunctionRef({
        file: nodeData.file,
        name: nodeData.functionName,
        startLine: nodeData.startLine,
        endLine: nodeData.endLine,
      });
    } else {
      handleFileClick(nodeData.file);
    }
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-[#555] hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← New Repo
          </button>
          <div className="w-px h-4 bg-[#222]" />
          <div>
            <span className="text-xs text-[#555]">Repository</span>
            <p className="text-sm font-semibold">{repoName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-[#6366f1]/20 text-[#818cf8] border border-[#6366f1]/30">
            {fileCount} files
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-[#111] text-[#555] border border-[#1e1e1e]">
            {totalFunctions} functions
          </span>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — chat */}
        <div className="flex flex-col w-[60%] border-r border-[#1a1a1a]">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                onViewFocusMap={handleViewFocusMap}
                onFileRef={handleFileClick}
                onFunctionRef={handleFunctionRef}
              />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[#555] text-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-[#1a1a1a] shrink-0">
            <div className="flex items-center gap-3 bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/40 transition-all">
              <textarea
                rows={1}
                placeholder="Ask a question about the codebase..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1 bg-transparent text-white placeholder-[#444] outline-none text-sm resize-none"
              />
              <button
                onClick={handleSend}
                disabled={loading || !question.trim()}
                className="shrink-0 w-8 h-8 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[#333] text-xs mt-2 text-center">Press Enter to send</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col w-[40%]">

          {/* Tabs */}
          <div className="flex border-b border-[#1a1a1a] shrink-0">
            {["filetree", "focusmap", "fileviewer"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "text-[#818cf8] border-b-2 border-[#6366f1]"
                    : "text-[#555] hover:text-white"
                }`}
              >
                {tab === "filetree" ? "File Tree" : tab === "focusmap" ? "Execution Flow" : "File Viewer"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "filetree" ? (
              <div className="h-full overflow-y-auto px-4 py-3">
                <FileTree tree={tree || []} onFileClick={handleFileClick} />
              </div>
            ) : activeTab === "focusmap" ? (
              <FocusMap data={focusData} onOpenNode={handleOpenFlowNode} />
            ) : (
              <FileViewer
                repoName={repoName}
                filePath={selectedFile}
                highlight={highlight}
                selectedFunction={selectedFunction}
                onViewEvolution={(fn) => setEvolutionTarget(fn)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Git Evolution drawer */}
      <GitEvolution
        repoName={repoName}
        target={evolutionTarget}
        onClose={() => setEvolutionTarget(null)}
      />
    </div>
  );
}