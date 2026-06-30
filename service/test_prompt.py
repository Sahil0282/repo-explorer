import asyncio
from llm import ask_llm

dummy_chunks = [
    {
        "metadata": {
            "file_path": "examples/index.js",
            "function_name": "main",
            "start_line": 10,
            "end_line": 20
        },
        "text": "function main() {\n  // This file serves as the main entry point for the example app\n  console.log('Running example');\n}"
    },
    {
        "metadata": {
            "file_path": "src/auth.js",
            "function_name": "generateJWT",
            "start_line": 5,
            "end_line": 15
        },
        "text": "export function generateJWT(user) {\n  return jwt.sign({ id: user.id }, process.env.SECRET, { expiresIn: '1h' });\n}"
    },
    {
        "metadata": {
            "file_path": "src/middleware.js",
            "function_name": "authMiddleware",
            "start_line": 20,
            "end_line": 35
        },
        "text": "export const authMiddleware = (req, res, next) => {\n  const token = req.headers.authorization;\n  if (!token) return res.status(401).json({ error: 'Unauthorized' });\n  try {\n    req.user = jwt.verify(token, process.env.SECRET);\n    next();\n  } catch (err) {\n    return res.status(403).json({ error: 'Forbidden' });\n  }\n};"
    }
]

questions = [
    "What is the purpose of index.js inside the examples folder?",
    "Explain the authentication flow.",
    "Where is JWT generated?",
    "How does response redirection work?",
    "Explain middleware execution."
]

def main():
    for q in questions:
        print(f"\\n{'='*50}\\nQUESTION: {q}\\n{'='*50}")
        res = ask_llm(q, dummy_chunks)
        print(res['answer'])

if __name__ == "__main__":
    main()
