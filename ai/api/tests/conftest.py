"""Pytest fixtures and shared setup for the api tests.

Importing `main` instantiates the OpenAI SDK client at module load, which
requires `OPENAI_API_KEY`. Tests don't actually call the LLM (they exercise
the quota and request-parsing code only), so a placeholder is fine — but
the env var has to exist before any test module's `import main` runs, hence
this conftest setting it during collection.
"""
import os

os.environ.setdefault("OPENAI_API_KEY", "test-dummy")
