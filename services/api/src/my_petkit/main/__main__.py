"""`python3 -m my_petkit.main`, which is what the add-on's Dockerfile runs.

The console script declared in `pyproject.toml` calls `main()` directly; this is
the same entry point for the module form, so both paths start identically.
"""
from my_petkit.main import main

if __name__ == "__main__":
    main()
