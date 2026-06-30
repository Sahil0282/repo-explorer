# vector_store.py
import chromadb
from embedder import embed_text, embed_batch
from rank_bm25 import BM25Okapi
import numpy as np

client = chromadb.PersistentClient(path="./chroma_store")

def get_or_create_collection(repo_name: str):
    safe_name = repo_name.replace("/", "_").replace("-", "_")
    return client.get_or_create_collection(name=safe_name)

def is_already_indexed(repo_name: str) -> bool:
    try:
        safe_name = repo_name.replace("/", "_").replace("-", "_")
        collection = client.get_collection(name=safe_name)
        return collection.count() > 0
    except:
        return False

def delete_collection(repo_name: str):
    try:
        safe_name = repo_name.replace("/", "_").replace("-", "_")
        client.delete_collection(name=safe_name)
        print(f"Deleted collection for {repo_name}")
    except:
        pass

def get_function_index(repo_name: str) -> dict:
    """
    Map "<file_path>::<function_name>" -> {file, startLine, endLine} for every
    indexed function in the repo. Used to ground execution-flow node line ranges
    against real metadata (a single source of truth — no hallucinated lines).
    """
    try:
        collection = get_or_create_collection(repo_name)
        result = collection.get(include=["metadatas"])
        index = {}
        for md in result.get("metadatas", []):
            fn = md.get("function_name")
            fp = md.get("file_path")
            if not fn or fn == "__file_summary__" or not fp:
                continue
            index[f"{fp}::{fn}"] = {
                "file": fp,
                "startLine": md.get("start_line", 0),
                "endLine": md.get("end_line", 0),
            }
        return index
    except Exception as e:
        print(f"get_function_index error: {e}")
        return {}

def _extract_file_metadata(file_data: dict) -> dict:
    all_function_names = [f["name"] for f in file_data["functions"]]
    imports = []
    if file_data["functions"]:
        first_code = file_data["functions"][0].get("code", "")
        for line in first_code.split("\n"):
            line = line.strip()
            if "require(" in line:
                try:
                    start = line.index("require('") + 9 if "require('" in line else line.index('require("') + 9
                    end = line.index("'", start) if "require('" in line else line.index('"', start)
                    imports.append(line[start:end])
                except:
                    pass
            elif line.startswith("import ") and " from " in line:
                try:
                    parts = line.split(" from ")
                    imp = parts[-1].strip().strip("'\"").strip(";")
                    imports.append(imp)
                except:
                    pass
    return {
        "all_function_names": all_function_names,
        "imports": imports
    }

def _build_chunk_text(file_path: str, func: dict, file_metadata: dict) -> str:
    folder_context = "/".join(file_path.split("/")[:-1]) if "/" in file_path else "root"

    imports_text = ""
    if file_metadata.get("imports"):
        imports_text = f"File imports: {', '.join(file_metadata['imports'][:10])}\n"

    neighbors_text = ""
    if file_metadata.get("all_function_names"):
        others = [n for n in file_metadata["all_function_names"] if n != func["name"] and n != "anonymous"]
        if others:
            neighbors_text = f"Other functions in this file: {', '.join(others[:8])}\n"

    func_name = func["name"]
    if func_name == "anonymous":
        func_name = f"anonymous_fn_line{func.get('startLine', '?')}"

    chunk = f"""File: {file_path}
Folder: {folder_context}
{imports_text}{neighbors_text}Function: {func_name}
Type: {func.get('type', 'unknown')}
Lines: {func.get('startLine', 0)}-{func.get('endLine', 0)}

Code:
{func['code']}""".strip()

    return chunk

def _build_file_summary_chunk(file_path: str, file_metadata: dict, file_data: dict) -> str:
    folder_context = "/".join(file_path.split("/")[:-1]) if "/" in file_path else "root"
    file_name = file_path.split("/")[-1]

    named_functions = [
        n for n in file_metadata["all_function_names"]
        if n != "anonymous" and n != ""
    ]

    all_names_text = ", ".join(named_functions[:15]) if named_functions else "various anonymous functions"

    imports_text = ""
    if file_metadata.get("imports"):
        imports_text = f"Imports: {', '.join(file_metadata['imports'][:10])}\n"

    summary = f"""FILE SUMMARY
File: {file_path}
File name: {file_name}
Folder: {folder_context}
{imports_text}Total functions: {len(file_data['functions'])}
Named functions: {all_names_text}
This file is part of the {folder_context} module.""".strip()

    return summary

def index_functions(repo_name: str, extracted_functions: list[dict]):
    delete_collection(repo_name)
    collection = get_or_create_collection(repo_name)

    documents = []
    embeddings = []
    metadatas = []
    ids = []
    chunk_index = 0

    for file_data in extracted_functions:
        file_path = file_data["filePath"]
        file_metadata = _extract_file_metadata(file_data)

        summary_text = _build_file_summary_chunk(file_path, file_metadata, file_data)
        documents.append(summary_text)
        metadatas.append({
            "file_path": file_path,
            "function_name": "__file_summary__",
            "start_line": 0,
            "end_line": 0,
            "type": "file_summary",
            "folder": "/".join(file_path.split("/")[:-1]) if "/" in file_path else "root"
        })
        ids.append(f"chunk_{chunk_index}")
        chunk_index += 1

        for func in file_data["functions"]:
            text_to_embed = _build_chunk_text(file_path, func, file_metadata)
            documents.append(text_to_embed)
            metadatas.append({
                "file_path": file_path,
                "function_name": func["name"],
                "start_line": func.get("startLine", 0),
                "end_line": func.get("endLine", 0),
                "type": func.get("type", "unknown"),
                "folder": "/".join(file_path.split("/")[:-1]) if "/" in file_path else "root"
            })
            ids.append(f"chunk_{chunk_index}")
            chunk_index += 1

    print(f"Embedding {len(documents)} chunks ({len(extracted_functions)} file summaries + {len(documents) - len(extracted_functions)} function chunks)...")
    embeddings = embed_batch(documents)

    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )

    print(f"Indexed {len(documents)} total chunks for {repo_name}")
    return len(documents)

# --- UPGRADE 3: Hybrid Search (BM25 + Vector + RRF) ---

def _tokenize(text: str) -> list[str]:
    """
    Simple tokenizer for BM25.
    Splits on whitespace and punctuation, lowercases everything.
    For code this works well — function names, keywords, file paths all become tokens.
    """
    import re
    # split on anything that's not a letter, digit, or underscore
    tokens = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', text.lower())
    return tokens

def _reciprocal_rank_fusion(vector_ranking: list, bm25_ranking: list, k: int = 60) -> list:
    """
    RRF merges two ranked lists into one without needing score normalization.
    
    Formula: RRF_score = 1/(k + rank_in_list1) + 1/(k + rank_in_list2)
    
    k=60 is the standard value from the original RRF paper.
    Higher rank (position 1) gives score 1/61 ≈ 0.016
    Lower rank (position 10) gives score 1/70 ≈ 0.014
    
    A chunk appearing at rank 1 in BOTH lists gets the highest combined score.
    A chunk only in one list still gets partial credit.
    """
    scores = {}

    # score from vector search ranking
    for rank, item in enumerate(vector_ranking):
        doc_id = item["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)

    # score from BM25 ranking
    for rank, item in enumerate(bm25_ranking):
        doc_id = item["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)

    # sort by combined RRF score descending
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return sorted_ids

def query_collection(repo_name: str, question: str, top_k: int = 5) -> list[dict]:
    """
    UPGRADE 3 — Hybrid search replacing the old vector-only search.
    
    Step 1: Vector search — finds semantically similar chunks
    Step 2: BM25 search — finds chunks with matching keywords
    Step 3: RRF merge — combines both rankings into final ranking
    Step 4: Return top_k chunks from merged ranking
    
    This solves the semantic gap problem:
    - "middleware flow" → vector finds semantic matches
    - "middleware" keyword → BM25 finds files literally named/containing "middleware"
    - Both results merged → better coverage
    """
    collection = get_or_create_collection(repo_name)

    # --- Step 1: Vector Search ---
    question_vector = embed_text(question)

    # fetch more candidates for both searches so RRF has enough to work with
    candidate_count = min(top_k * 4, 20)

    vector_results = collection.query(
        query_embeddings=[question_vector],
        n_results=candidate_count,
        include=["documents", "metadatas", "distances"]
    )

    # build a lookup map of id → full chunk data
    chunk_lookup = {}
    vector_ranking = []

    for i in range(len(vector_results["documents"][0])):
        doc_id = vector_results["ids"][0][i]
        chunk_data = {
            "id": doc_id,
            "text": vector_results["documents"][0][i],
            "metadata": vector_results["metadatas"][0][i],
            "similarity_score": 1 - vector_results["distances"][0][i]
        }
        chunk_lookup[doc_id] = chunk_data
        vector_ranking.append({"id": doc_id})

    # --- Step 2: BM25 Search ---
    # get ALL documents from collection to build BM25 index
    # BM25 needs the full corpus to calculate term frequencies
    all_results = collection.get(include=["documents", "metadatas"])

    all_docs = all_results["documents"]
    all_ids = all_results["ids"]
    all_metadatas = all_results["metadatas"]

    # tokenize all documents for BM25
    tokenized_docs = [_tokenize(doc) for doc in all_docs]
    bm25 = BM25Okapi(tokenized_docs)

    # tokenize the question and get BM25 scores
    tokenized_question = _tokenize(question)
    bm25_scores = bm25.get_scores(tokenized_question)

    # get top candidates from BM25
    top_bm25_indices = np.argsort(bm25_scores)[::-1][:candidate_count]

    bm25_ranking = []
    for idx in top_bm25_indices:
        doc_id = all_ids[idx]
        bm25_ranking.append({"id": doc_id})

        # add to lookup if not already there from vector search
        if doc_id not in chunk_lookup:
            chunk_lookup[doc_id] = {
                "id": doc_id,
                "text": all_docs[idx],
                "metadata": all_metadatas[idx],
                "similarity_score": float(bm25_scores[idx])
            }

    # --- Step 3: RRF Merge ---
    merged_ids = _reciprocal_rank_fusion(vector_ranking, bm25_ranking)

    # --- Step 4: Return top_k chunks ---
    final_chunks = []
    for doc_id in merged_ids[:top_k]:
        if doc_id in chunk_lookup:
            final_chunks.append(chunk_lookup[doc_id])

    return final_chunks
