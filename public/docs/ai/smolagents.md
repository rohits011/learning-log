# smolagents

## What is smolagents?
`smolagents` is a lightweight Python framework by Hugging Face designed for building and managing autonomous AI agents. Unlike massive, complex frameworks, `smolagents` provides a thin, hackable layer that focuses on giving Large Language Models (LLMs) the ability to execute code locally and use tools through simple Python functions.

### Core Architecture
The primary component is the `CodeAgent`. When given a task, the `CodeAgent` generates Python code that calls available tools, executes that code in a sandboxed `LocalPythonExecutor`, reads the output, and iterates. This approach (often called ReAct — Reason and Act) allows the agent to self-correct and chain multiple tools together naturally.

## Key Learnings & Gotchas

### 1. API Changes in v1.26.0+
In recent versions, the `smolagents` API consolidated its prompts. The `system_prompt` keyword argument was removed from the `CodeAgent` constructor. 
Instead, it now uses a `prompt_templates` dictionary:
```python
import importlib.resources
import yaml
from smolagents import CodeAgent

# Load default templates
default_templates = yaml.safe_load(
    importlib.resources.files("smolagents.prompts").joinpath("code_agent.yaml").read_text()
)
# Override the system prompt
default_templates["system_prompt"] = "Your custom prompt here..."

agent = CodeAgent(
    tools=[...],
    model=model,
    prompt_templates=default_templates
)
```

### 2. Local Models (Qwen/Llama) and Code Block Parsing
By default, `smolagents` expects the LLM to output its code inside XML-style `<code>` tags. However, most local, open-weights models (like `qwen2.5` or `llama3`) are strongly aligned via instruction tuning to use standard Markdown backticks (e.g., ````python`).

If the model outputs Markdown backticks instead of `<code>`, the parser fails with:
> `Your code snippet is invalid, because the regex pattern <code>(.*?)</code> was not found in it.`

**The Fix:** You can instruct the `CodeAgent` parser to look for standard Markdown instead by passing `code_block_tags="markdown"`:
```python
agent = CodeAgent(
    tools=[...],
    model=model,
    prompt_templates=default_templates,
    code_block_tags="markdown", # Fixes parsing for local models
    max_steps=10
)
```
This aligns the framework's parser with the natural output tendency of the local model, preventing infinite parsing loops.

### 3. Graceful Degradation on Final Answers
Local 7B parameter models occasionally struggle to format their final termination step correctly (e.g. they forget to wrap their final response in a `final_answer("...")` function call, preferring conversational text instead). When this happens, `smolagents` will loop until `max_steps` is reached, then gracefully extract the last conversational response as the final result. Using `max_steps=10` is a good safeguard against these formatting hallucinations.
