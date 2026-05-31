# Static Analysis & Security in Python

When building production-grade software (especially AI systems like D.O.S.T.), writing code that simply "works" is not enough. The code must be secure, maintainable, and type-safe.

In the Java ecosystem, you rely on the compiler (for static typing), Checkstyle/SonarQube (for linting), and tools like Fortify (for SAST/Security). 

In Python, we achieve this exact same strictness using a combination of three essential tools: **Ruff**, **Mypy**, and **Bandit**, tied together by **Pre-commit**.

---

## 1. Ruff (The Lightning-Fast Linter & Formatter)
[Ruff](https://docs.astral.sh/ruff/) is a Python linter and code formatter written in Rust. 

**Why we use it:**
Historically, Python projects used a messy combination of tools: `Flake8` (linting), `Black` (formatting), and `isort` (import sorting). Ruff replaces all of them, and it is 10–100x faster. It catches code smells, unused imports, and enforces a uniform coding style.

**Example Catch:**
```python
# Bad Code
import os # Ruff Error: F401 `os` imported but unused
def calculate():
  x = 10
  # Ruff Formatter will automatically fix spacing/indentation
```

---

## 2. Mypy (The Strict Type Checker)
[Mypy](https://mypy-lang.org/) acts like the Java compiler for Python. Python is dynamically typed by default, meaning variables can change types at runtime (leading to silent, catastrophic crashes).

**Why we use it:**
Mypy enforces **Static Typing**. By running `mypy --strict`, we force Python to act like Java. If a function expects a `String` and you pass an `Integer`, Mypy will fail the build before the code ever runs.

**Example Catch:**
```python
# Bad Code
def greet(name: str) -> str:
    return "Hello " + name

greet(123) # Mypy Error: Argument 1 to "greet" has incompatible type "int"; expected "str"
```

---

## 3. Bandit (Static Application Security Testing - SAST)
[Bandit](https://bandit.readthedocs.io/) is designed to find common security issues in Python code. It is an essential OWASP security gate.

**Why we use it:**
While Ruff checks style and Mypy checks types, Bandit explicitly checks for **Vulnerabilities**. This is critical in AI Engineering, where an agent might be executing code or handling unsanitized inputs.

**What it catches:**
- `B101`: Use of `assert` in production (which can be compiled away, bypassing checks).
- `B105`: Hardcoded passwords or API keys.
- `B301`: Unsafe deserialization (e.g., using `pickle` instead of `json`).
- `B602`: Unsafe shell execution (e.g., `subprocess.Popen` with `shell=True`).

**Example Catch:**
```python
import subprocess

# Bad Code (Vulnerable to Command Injection)
user_input = "ls -la"
subprocess.call(f"echo {user_input}", shell=True) 
# Bandit Error: B602 subprocess call with shell=True identified, security issue.

# Secure Fix
subprocess.call(["echo", user_input]) # shell=False by default
```

---

## 4. Pre-commit (The Enforcement Gate)
Having great tools is useless if developers forget to run them. 

**What is it?**
`pre-commit` is a framework that runs all of the above checks automatically every time you type `git commit`. 

If Ruff, Mypy, or Bandit detect an error, the commit is **blocked** and aborted. This ensures that no messy, untyped, or insecure code can ever be pushed to the repository. 

**Our `D.O.S.T` Configuration (`.pre-commit-config.yaml`):**
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    hooks:
      - id: mypy
  - repo: https://github.com/PyCQA/bandit
    hooks:
      - id: bandit
```
