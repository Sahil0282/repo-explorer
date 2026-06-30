# llm.py
import os
import json

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# Valid execution-flow node types. Kept in sync with the frontend FlowNode styles.
VALID_NODE_TYPES = {
    "user_action",
    "api_endpoint",
    "controller",
    "function",
    "background_process",
    "ai_service",
    "database",
    "output",
}


def _build_context(context_chunks: list) -> str:
    return "\n\n".join([
        f"File: {c['metadata']['file_path']}\n"
        f"Function: {c['metadata'].get('function_name', 'anonymous')}\n"
        f"Lines: {c['metadata'].get('start_line', '?')} - {c['metadata'].get('end_line', '?')}\n"
        f"Code:\n{c['text']}"
        for c in context_chunks
    ])


def _parse_json_response(text: str) -> dict:
    """Parse the model's JSON, tolerating accidental ``` fences."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw[:4].lower() == "json":
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


def _synthesize_fallback_flow(question: str, context_chunks: list) -> dict:
    """
    Deterministic execution flow built from the retrieved code when the model
    does not return a usable graph. Renders as: Question -> functions -> Response.
    """
    nodes = [{"id": "start", "label": "User Question", "type": "user_action"}]
    edges = []
    prev = "start"
    seen = set()
    i = 0
    for c in context_chunks:
        md = c["metadata"]
        fn = md.get("function_name")
        if not fn or fn == "__file_summary__":
            continue
        key = f"{md['file_path']}::{fn}"
        if key in seen:
            continue
        seen.add(key)
        nid = f"fn{i}"
        i += 1
        nodes.append({
            "id": nid,
            "label": f"{fn}()",
            "type": "function",
            "file": md["file_path"],
            "functionName": fn,
            "startLine": md.get("start_line", 0),
            "endLine": md.get("end_line", 0),
        })
        edges.append({"source": prev, "target": nid})
        prev = nid

    nodes.append({"id": "out", "label": "Response", "type": "output"})
    edges.append({"source": prev, "target": "out"})
    return {"nodes": nodes, "edges": edges}


def _sanitize_flow(flow: dict) -> dict:
    """Keep only valid nodes/edges so the frontend never renders phantom links."""
    if not isinstance(flow, dict):
        return {"nodes": [], "edges": []}

    raw_nodes = flow.get("nodes") or []
    raw_edges = flow.get("edges") or []

    nodes = []
    ids = set()
    for n in raw_nodes:
        if not isinstance(n, dict):
            continue
        nid = n.get("id")
        label = n.get("label")
        ntype = n.get("type")
        if not nid or not label or nid in ids:
            continue
        if ntype not in VALID_NODE_TYPES:
            ntype = "function" if n.get("file") else "background_process"
        clean = {"id": str(nid), "label": str(label), "type": ntype}
        if n.get("file"):
            clean["file"] = str(n["file"]).replace("\\", "/")
        if n.get("functionName"):
            clean["functionName"] = str(n["functionName"])
        if isinstance(n.get("startLine"), int):
            clean["startLine"] = n["startLine"]
        if isinstance(n.get("endLine"), int):
            clean["endLine"] = n["endLine"]
        nodes.append(clean)
        ids.add(clean["id"])

    edges = []
    seen_edges = set()
    for e in raw_edges:
        if not isinstance(e, dict):
            continue
        s, t = e.get("source"), e.get("target")
        if s not in ids or t not in ids or s == t:
            continue
        sig = (s, t)
        if sig in seen_edges:
            continue
        seen_edges.add(sig)
        edge = {"source": str(s), "target": str(t)}
        if e.get("label"):
            edge["label"] = str(e["label"])
        edges.append(edge)

    return {"nodes": nodes, "edges": edges}


PROMPT_TEMPLATE = """You are a Senior Software Architect and Guide for this repository.

Return a SINGLE valid JSON object with EXACTLY these top-level keys:
- "answer": a Markdown string — the conceptual explanation.
- "execution_flow": an object with "nodes" and "edges" describing the runtime execution path.

================ "answer" (Markdown) ================
Explain the WHY (architecture, purpose, flow, responsibilities). The user sees the
WHAT in the File Viewer and the WHERE in the Execution Flow graph.
- Architecture-first: begin with a concise conceptual explanation, not implementation.
- Adapt scope to the question (1-2 sentences for small questions; structured for large).
- Use inline backticks for ALL files, functions, classes, and APIs (e.g. `analyzeRepo()`).
- Use fenced code blocks ONLY for short executable snippets (max ~20 lines). Never paste whole files.
- If the context does not fully cover the question, say so. Never fabricate.
- NEVER mention "chunks", "embeddings", "vector search", "retrieval", or "context windows".

================ "execution_flow" ================
Draw the EXECUTION PATH that answers the user's question — the way a senior engineer
sketches a system on a whiteboard. Model what happens step by step and what happens
AFTER each step. Do NOT list every retrieved file; model the actual flow of control/data.

Each node in "nodes":
- "id": short unique string (e.g. "n1").
- "label": short human label (e.g. "handleAnalyze()", "Clone Repository", "POST /api/repo/analyze").
- "type": one of EXACTLY: user_action, api_endpoint, controller, function,
  background_process, ai_service, database, output.
- "file": EXACT repo-relative path from the Context when the step is backed by code; otherwise omit.
- "functionName": EXACT function name from the Context when applicable; otherwise omit.
- "startLine"/"endLine": integers from the Context when known; otherwise omit.

Each edge in "edges": {{"source": <id>, "target": <id>, "label": <optional>}}.
Edges express order; branches may split and merge.

Rules:
- 5 to 14 nodes. Prefer a clear linear or branching path that reads top-to-bottom.
- Use REAL file paths and function names from the Context for function / controller /
  api_endpoint nodes so they are clickable. Do not invent paths or functions.
- Conceptual steps (user actions, background processes, outputs) need no file.
- Pick the node "type" that best reflects each step's role.

Context Code:
{context_text}

User Question:
{question}

Return ONLY the JSON object, nothing else."""


def ask_llm(question: str, context_chunks: list) -> dict:
    context_text = _build_context(context_chunks)
    prompt = PROMPT_TEMPLATE.format(context_text=context_text, question=question)

    response = model.generate_content(
        prompt,
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.2,
        },
    )

    try:
        parsed = _parse_json_response(response.text)
        answer_text = parsed.get("answer") or ""
        flow = _sanitize_flow(parsed.get("execution_flow"))
    except (ValueError, AttributeError) as e:
        print(f"Flow JSON parse failed, using fallback: {e}")
        answer_text = response.text or ""
        flow = {"nodes": [], "edges": []}

    # Guarantee a non-empty, useful graph for every answer.
    if len(flow["nodes"]) < 2:
        flow = _synthesize_fallback_flow(question, context_chunks)

    source_files = list(set([
        chunk['metadata']['file_path']
        for chunk in context_chunks
    ]))

    source_functions = [
        {
            "name": chunk['metadata']['function_name'],
            "file": chunk['metadata']['file_path'],
            "startLine": chunk['metadata']['start_line'],
            "endLine": chunk['metadata']['end_line']
        }
        for chunk in context_chunks
    ]

    return {
        "answer": answer_text,
        "source_files": source_files,
        "source_functions": source_functions,
        "execution_flow": flow,
    }
