# embedder.py
# This file has ONE job — load the MiniLM model and convert text to vectors.
# The model loads ONCE when the service starts, not on every request.
# This is important — loading an ML model takes 2-3 seconds, you never want that per request.

from sentence_transformers import SentenceTransformer

# MiniLM-L6-v2 is a small but powerful model
# "small" means it runs fine on your laptop CPU — no GPU needed
# it produces 384-dimensional vectors for any text you give it
# first run will download ~90MB model file, cached after that
model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_text(text: str) -> list[float]:
    """
    Takes a single string, returns a list of 384 floats.
    This is the vector representation of that text.
    Similar texts will have vectors that are "close" to each other.
    """
    return model.encode(text).tolist()

def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Takes a list of strings, returns a list of vectors.
    Much faster than calling embed_text in a loop —
    the model processes them in parallel internally.
    Use this when indexing all 3093 functions at once.
    """
    # batch_size 16 keeps peak memory low enough for small (512MB) hosts;
    # progress bar off — it just floods server logs.
    return model.encode(texts, batch_size=16, show_progress_bar=False).tolist()