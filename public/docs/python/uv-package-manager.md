# uv: The Python Package Manager

## What is uv?
`uv` is an extremely fast Python package and project manager, written in Rust by Astral. It is designed to be a drop-in replacement for `pip`, `pip-tools`, `pyenv`, `poetry`, and `virtualenv`. 

For Java/Spring developers, `uv` provides the unified build and dependency management experience that **Maven** or **Gradle** offers, something that standard Python (`pip`) historically lacked out of the box.

## Why use uv over pip?
While `pip` works, using it alone is akin to compiling with raw `javac` and downloading JARs manually. `uv` consolidates the entire Python toolchain:

| Need | Old Way | `uv` Way |
|------|---------|----------|
| **Python versioning** | `pyenv install 3.12` | `uv` automatically reads `.python-version` and downloads it if missing |
| **Isolated environments** | `python -m venv .venv` | Managed automatically |
| **Installing dependencies** | `pip install -r requirements.txt` | `uv sync` |
| **Lock files (Reproducibility)** | `pip-tools` or `Poetry` | `uv.lock` is built-in |
| **Performance** | Standard `pip` resolution (slow) | 10–100× faster via Rust |

## Key Commands & Workflows
- **`uv init`**: Scaffolds a new project with a standard `pyproject.toml`.
- **`uv add <pkg>`**: Adds a dependency to your `pyproject.toml` and locks it.
- **`uv sync`**: Ensures your local `.venv/` exactly matches the `uv.lock` file.
- **`uv run <command>`**: Executes a command or script within the project's isolated virtual environment, eliminating the need to manually `source .venv/bin/activate`.

## Installation & PATH
`uv` is a standalone binary (typically installed at `~/.local/bin/uv`) and does *not* live inside your project's `.venv/`. Because of this, it must be available in your system `PATH` (e.g., via `~/.zshrc`) so it can be invoked globally across different projects.
