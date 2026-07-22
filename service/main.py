import base64
import gzip
import json

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from vector_store import is_already_indexed, index_functions, query_collection, delete_collection, get_function_index
from llm import ask_llm, model

app = FastAPI()

# Tracks background indexing jobs: repo_name -> "indexing" | "indexed" | "failed".
# In-memory is fine — a restart wipes the (ephemeral) vector store too, and
# /index-status falls back to checking the store directly.
_index_status = {}


def _run_indexing(repo_name: str, extracted_functions: list):
    try:
        index_functions(repo_name, extracted_functions)
        _index_status[repo_name] = "indexed"
    except Exception as e:
        print(f"Background indexing failed for {repo_name}: {e}")
        _index_status[repo_name] = "failed"

class IndexRequest(BaseModel):
    repo_name: str
    # Plain list (local dev) or gzip+base64 (production — raw source code in
    # the body trips hosting-provider WAFs, so the backend sends it opaque).
    extracted_functions: list = []
    extracted_functions_b64: str | None = None

class QueryRequest(BaseModel):
    repo_name: str
    question: str

# 🔥 NEW MODEL
class EvolutionRequest(BaseModel):
    history: list


@app.delete("/index/{repo_name}")
def force_reindex(repo_name: str):
    delete_collection(repo_name)
    _index_status.pop(repo_name, None)
    return {"status": "deleted", "message": f"Collection for {repo_name} deleted. Re-analyze to re-index."}


@app.get("/health")
def health():
    return {"status": "ok", "message": "AI service running"}


@app.post("/index")
def index_repo(request: IndexRequest, background_tasks: BackgroundTasks):
    if is_already_indexed(request.repo_name):
        print(f"{request.repo_name} already indexed, skipping")
        _index_status[request.repo_name] = "indexed"
        return {
            "status": "already_indexed",
            "message": f"{request.repo_name} was already indexed. Using cached index."
        }

    extracted = request.extracted_functions
    if request.extracted_functions_b64:
        try:
            extracted = json.loads(gzip.decompress(base64.b64decode(request.extracted_functions_b64)))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid extracted_functions_b64 payload.")

    if not extracted:
        raise HTTPException(status_code=400, detail="No functions to index.")

    # Don't start a second job for a repo that's already being indexed.
    if _index_status.get(request.repo_name) == "indexing":
        return {
            "status": "indexing",
            "message": f"{request.repo_name} is already being indexed."
        }

    # Embed in the background and return immediately. Embedding can take
    # minutes on small instances, and hosting proxies kill long requests —
    # callers poll GET /index-status/{repo_name} until it flips to "indexed".
    _index_status[request.repo_name] = "indexing"
    background_tasks.add_task(_run_indexing, request.repo_name, extracted)

    return {
        "status": "indexing",
        "message": f"Indexing {request.repo_name} in the background."
    }


@app.get("/index-status/{repo_name}")
def index_status(repo_name: str):
    status = _index_status.get(repo_name)
    if status is None:
        # No in-memory record (e.g. the service restarted) — check the store.
        status = "indexed" if is_already_indexed(repo_name) else "not_indexed"
    return {"repo_name": repo_name, "status": status}


@app.post("/query")
def query_repo(request: QueryRequest):
    if not is_already_indexed(request.repo_name):
        raise HTTPException(
            status_code=400,
            detail="This repository's index isn't ready (it may still be indexing, or the server restarted). Please re-analyze the repo from the home page."
        )

    chunks = query_collection(request.repo_name, request.question, top_k=10)

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No relevant code found for this question."
        )

    SKIP_FOLDERS = ['test/', 'tests/', 'examples/', '__tests__', '.test.', '.spec.', 'fixtures/']

    source_chunks = [
        c for c in chunks
        if not any(skip in c['metadata']['file_path'] for skip in SKIP_FOLDERS)
    ]

    final_chunks = source_chunks[:5] if source_chunks else chunks[:5]

    from google.api_core.exceptions import ResourceExhausted

    try:
        result = ask_llm(request.question, final_chunks)
    except ResourceExhausted:
        raise HTTPException(
            status_code=429,
            detail="API Rate Limit Exceeded. Please wait a minute and try again."
        )
    except Exception as e:
        print(f"LLM Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate AI response. Please try again."
        )

    # Ground execution-flow node line ranges against real indexed metadata so
    # clicking a node always scrolls to the correct lines in the File Viewer.
    flow = result.get("execution_flow") or {"nodes": [], "edges": []}
    fn_index = get_function_index(request.repo_name)
    for node in flow.get("nodes", []):
        fp = node.get("file")
        fnm = node.get("functionName")
        if fp and fnm:
            grounded = fn_index.get(f"{fp}::{fnm}")
            if grounded:
                node["startLine"] = grounded["startLine"]
                node["endLine"] = grounded["endLine"]

    return {
        "answer": result["answer"],
        "source_files": result["source_files"],
        "source_functions": result["source_functions"],
        "execution_flow": flow
    }


# 🔥 NEW ENDPOINT: Evolution Summary
@app.post("/evolution-summary")
def evolution_summary(request: EvolutionRequest):
    if not request.history:
        return {"summary": "No evolution data available."}

    # remove empty previews
    cleaned = [h for h in request.history if h.get("preview")]

    # limit to avoid token overflow
    cleaned = cleaned[:15]

    history_text = ""
    for h in cleaned:
        history_text += f"- {h['changeType']}: {h['preview']}\n"

    prompt = f"""
You are analyzing how a function evolved over time.

Here are code changes:
{history_text}

Summarize how this function evolved in 2-3 concise sentences.
Focus on improvements, refactoring, or behavior changes.
"""

    try:
        response = model.generate_content(prompt)

        return {
            "summary": response.text
        }

    except Exception as e:
        print("Evolution summary error:", str(e))
        return {
            "summary": "Failed to generate summary."
        }