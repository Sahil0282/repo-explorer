# llm.py
from google import genai
import os
from dotenv import load_dotenv

load_dotenv(override=True)
print("GEMINI KEY LOADED:", os.getenv("GEMINI_API_KEY"))

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def ask_llm(question: str, context_chunks: list[dict]) -> dict:

    context_text = ""
    for i, chunk in enumerate(context_chunks):
        context_text += f"""
--- Chunk {i+1} ---
File: {chunk['metadata']['file_path']}
Function: {chunk['metadata']['function_name']}
Lines: {chunk['metadata']['start_line']} - {chunk['metadata']['end_line']}

{chunk['text']}

"""

    prompt = f"""You are an expert code navigator helping a developer understand an unfamiliar repository.

CONTEXT:
- You have been given {len(context_chunks)} code chunks retrieved from the repository
- Each chunk contains a file path, function name, line numbers, and actual code
- The chunks were selected because they are most relevant to the developer's question

YOUR JOB:
Answer the developer's question using ONLY the provided code chunks.
Do not invent, assume, or infer anything that is not visible in the chunks.
If the chunks don't fully answer the question, clearly say what you found and what is missing.

HOW TO ANSWER:
1. Start with a one-sentence direct answer to the question
2. Then explain the details — what each relevant function does, which files are involved, how they connect
3. Trace execution flow when relevant — "Function A in file X calls Function B in file Y which then..."
4. Always cite file names and line numbers when referencing specific code
5. If middleware is involved, explain when it runs in the request lifecycle
6. If a model is involved, explain what data it represents
7. End with a summary of which files a developer should look at to understand this fully

FORMATTING:
- Use **bold** for file names and function names
- Use bullet points for listing multiple things
- Use numbered steps when explaining a flow or sequence
- Keep technical terms but explain what they do in context

STRICT RULES:
- Never say "the code suggests" or "it appears" — only state what is clearly visible in the chunks
- Never explain code that isn't in the provided chunks
- If only partial information is available, answer what you can and state the gap clearly
- Do not repeat the same point multiple times

RELEVANT CODE CHUNKS:
{context_text}

DEVELOPER'S QUESTION:
{question}

YOUR ANSWER:"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    answer_text = response.text

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
        "source_functions": source_functions
    }