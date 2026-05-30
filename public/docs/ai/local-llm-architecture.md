# Local, Privacy-First AI Architecture

## The Decentralization Principle
When building a secure, private AI assistant (like D.O.S.T.), a critical architectural rule is to maintain a strict separation between **build-time** copilots and **runtime** capabilities.

1. **Build-Time Copilot (e.g., Gemini, GitHub Copilot)**: Cloud-based LLMs are used by developers to write code, scaffold infrastructure, and generate assets.
2. **Runtime Brain (e.g., Qwen, Llama via Ollama)**: The shipped application itself must **never** call external cloud LLM APIs at runtime if absolute privacy is required.

## Why Local Inference?
For a personal assistant handling sensitive local data (e.g., filesystem access, personal notes, terminal commands), using cloud APIs introduces several risks:
- **Data Leakage**: Sending sensitive data out over the network to external APIs.
- **Dependency**: Reliance on external endpoints that can rate-limit, change pricing, or experience outages.
- **Security Boundaries**: Local models can be sandboxed alongside the local executor, allowing the entire AI loop to run offline in a controlled environment without external API keys.

## Implementation Guidelines
- **Zero Cloud SDKs**: Ensure that no cloud LLM SDKs (like `openai`, `anthropic`, or `google-genai`) are imported or initialized within the runtime application.
- **Ollama**: Use a local inference engine like `Ollama` running highly capable, quantized open-weights models (like `qwen2.5:7b-instruct-q4_K_M`).
- **Framework Integration**: AI frameworks (like `smolagents`) should be configured to target the local Ollama API (usually `http://localhost:11434/v1`) using a compatible adapter (e.g., `LiteLLMModel`).
