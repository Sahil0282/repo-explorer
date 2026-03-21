# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from vector_store import is_already_indexed, index_functions, query_collection, delete_collection
from llm import ask_llm

app = FastAPI()

class IndexRequest(BaseModel):
    repo_name: str
    extracted_functions: list

class QueryRequest(BaseModel):
    repo_name: str
    question: str

@app.delete("/index/{repo_name}")
def force_reindex(repo_name: str):
    delete_collection(repo_name)
    return {"status": "deleted", "message": f"Collection for {repo_name} deleted. Re-analyze to re-index."}

@app.get("/health")
def health():
    return {"status": "ok", "message": "AI service running"}

@app.post("/index")
def index_repo(request: IndexRequest):
    if is_already_indexed(request.repo_name):
        print(f"{request.repo_name} already indexed, skipping")
        return {
            "status": "already_indexed",
            "message": f"{request.repo_name} was already indexed. Using cached index."
        }

    total = index_functions(request.repo_name, request.extracted_functions)

    return {
        "status": "indexed",
        "chunks_stored": total,
        "message": f"Successfully indexed {total} functions from {request.repo_name}"
    }

@app.post("/query")
def query_repo(request: QueryRequest):
    if not is_already_indexed(request.repo_name):
        raise HTTPException(
            status_code=400,
            detail="Repo not indexed yet. Call /index first."
        )

    # fetch more candidates than needed so filtering has room to work
    chunks = query_collection(request.repo_name, request.question, top_k=10)

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail="No relevant code found for this question."
        )

    # deprioritize test and example files
    # these files use the code but don't explain how it works
    SKIP_FOLDERS = ['test/', 'tests/', 'examples/', '__tests__', '.test.', '.spec.', 'fixtures/']

    source_chunks = [
        c for c in chunks
        if not any(skip in c['metadata']['file_path'] for skip in SKIP_FOLDERS)
    ]

    # if filtering removed everything (repo has only tests), fall back to original
    final_chunks = source_chunks[:5] if source_chunks else chunks[:5]

    result = ask_llm(request.question, final_chunks)

    return {
        "answer": result["answer"],
        "source_files": result["source_files"],
        "source_functions": result["source_functions"]
    }