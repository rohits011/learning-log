# LlamaIndex & RAG (Deep Dive)

Large Language Models (LLMs) like Qwen or GPT-4 have a massive amount of baked-in knowledge. However, they suffer from a severe limitation: **They do not know your private data.**

If you ask an LLM, "What is the password to my database?", it can't answer. 
You *could* paste your entire codebase into the prompt every time, but LLMs have a **Context Window Limit** (e.g., 8,000 to 128,000 tokens). If you paste too much, the model crashes or forgets the beginning of the prompt.

**RAG (Retrieval-Augmented Generation)** is the architectural pattern that solves this.
**LlamaIndex** is the framework that implements RAG.

---

## 1. The RAG Pipeline (How it works)

**Java Analogy:** Think of LlamaIndex like `Spring Data` or `Hibernate`. Instead of manually managing JDBC connections and SQL queries, Spring Data handles the boilerplate. LlamaIndex handles the boilerplate of reading files, chunking them, talking to Qdrant, and talking to the LLM.

RAG operates in two distinct phases:

### Phase A: Ingestion (Build Time)
1. **Load:** LlamaIndex reads your raw PDFs, markdown, or SQL databases.
2. **Chunk:** It splits a 50-page PDF into 100 small chunks (e.g., 500 words each). Why? Because we can't fit 50 pages into the LLM context. We need bite-sized pieces.
3. **Embed:** It sends each chunk to an embedding model (like `nomic-embed-text`) to get a vector (coordinate).
4. **Store:** It saves the chunk's text and its vector into a Vector DB (Qdrant).

### Phase B: Querying (Run Time)
1. **Embed Query:** You ask, "What is the database password?". LlamaIndex converts that question into a vector.
2. **Retrieve:** LlamaIndex searches Qdrant for the top 3 chunks closest to your question's vector.
3. **Synthesize:** LlamaIndex takes those 3 chunks, pastes them into a hidden prompt, and asks the LLM: 
   *"Based on these documents: [Chunk 1, Chunk 2, Chunk 3], answer the user's question: 'What is the database password?'"*

---

## 2. Minimal Runnable Example (Python)

Here is a bare-bones implementation of LlamaIndex doing RAG entirely in memory.

```python
from llama_index.core import Document, VectorStoreIndex
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.core import Settings

# 1. Configure LlamaIndex to use our local models instead of OpenAI
Settings.embed_model = OllamaEmbedding(model_name="nomic-embed-text")
Settings.llm = Ollama(model="qwen2.5:7b-instruct-q4_K_M", request_timeout=60.0)

# 2. Create a Document (In reality, you'd use SimpleDirectoryReader to read files)
doc = Document(text="The production database password is 'SuperSecret123!'. It is hosted on AWS RDS.")

# 3. Ingestion: This automatically chunks the document, embeds it, and stores it in memory.
index = VectorStoreIndex.from_documents([doc])

# 4. Querying: Create a query engine
query_engine = index.as_query_engine()

# 5. Ask a question!
response = query_engine.query("Where is the database hosted and what is the password?")
print(response)

# Output: "Based on the context provided, the database is hosted on AWS RDS and the password is 'SuperSecret123!'."
```

---

## 3. Engineering Tradeoffs

**Why LlamaIndex instead of LangChain?**
LangChain is a generic framework for building AI agents (similar to smolagents). LlamaIndex is highly specialized for **data ingestion and retrieval**. It excels at parsing messy data (like PDFs with tables) and building advanced retrieval pipelines (e.g., routing questions to different databases).

**The Chunking Problem:**
The hardest part of RAG isn't the AI—it's the chunking. If you blindly split a document every 500 words, you might split a Java method right down the middle. When the AI retrieves the second half of the method, it lacks the context of the class name or method signature. LlamaIndex offers advanced chunkers (like AST-based code splitters) to solve this.
