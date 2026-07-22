# embedder.py
# This file has ONE job — convert text to vectors, via the Gemini embedding API.
#
# Why an API instead of a local sentence-transformers model: local embedding
# needs torch + a ~90MB model in memory, which OOM-kills small (512MB) free
# hosts mid-indexing. The hosted API needs ~zero RAM, indexes a repo in
# seconds instead of minutes, and is free at this scale.

import os
import time

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(override=True)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

EMBED_MODEL = "models/gemini-embedding-001"

# The embedding model caps input length; long function bodies get truncated.
# 8000 chars ~= 2000 tokens, matching the model's input limit.
MAX_CHARS = 8000

# Free tier allows 100 embed requests/min and each text in a batch counts as
# one request — stay under it per batch and wait out the window on 429.
BATCH_LIMIT = 90
QUOTA_WAIT_SECONDS = 65
MAX_RETRIES = 5


def embed_text(text: str) -> list[float]:
    """
    Takes a single string (a user's question), returns its vector.
    task_type retrieval_query optimizes the vector for searching documents.
    """
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text[:MAX_CHARS],
        task_type="retrieval_query",
    )
    return result["embedding"]


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Takes a list of strings (code chunks), returns a list of vectors.
    Batched into API-limit-sized calls; task_type retrieval_document
    optimizes the vectors for being searched against.
    """
    vectors = []
    for i in range(0, len(texts), BATCH_LIMIT):
        batch = [t[:MAX_CHARS] for t in texts[i:i + BATCH_LIMIT]]
        for attempt in range(MAX_RETRIES):
            try:
                result = genai.embed_content(
                    model=EMBED_MODEL,
                    content=batch,
                    task_type="retrieval_document",
                )
                vectors.extend(result["embedding"])
                break
            except Exception as e:
                # Per-minute quota exhausted — wait for the window to reset.
                if "429" in str(e) and attempt < MAX_RETRIES - 1:
                    print(f"Embed quota hit, waiting {QUOTA_WAIT_SECONDS}s "
                          f"(batch {i // BATCH_LIMIT + 1}, attempt {attempt + 1})")
                    time.sleep(QUOTA_WAIT_SECONDS)
                else:
                    raise
    return vectors
