"""
convert_to_notebooks.py
────────────────────────
Converts every .py file in ml/ to a well-structured .ipynb in ml/notebooks/.

Cell splitting strategy (mimics handwritten exploration):
  1. Module docstring           → Markdown description cell
  2. Import block(s)           → 1 code cell
  3. Constant/config block     → 1 code cell
  4. # ── Section ── comments  → Markdown header cell
  5. Each top-level function   → its own code cell
  6. Each top-level class      → its own code cell (with all methods)
  7. if __name__ == "__main__" → its own code cell
"""

import json
import re
from pathlib import Path

ML_DIR = Path(__file__).parent.parent  # …/ml/
OUT_DIR = Path(__file__).parent        # …/ml/notebooks/

SECTION_RE = re.compile(r"^# [─═]+\s*(.*?)\s*[─═]+\s*$")

# ── Notebook / cell builders ──────────────────────────────────────────────────

def _uid(text: str) -> str:
    return f"{abs(hash(text)) % 10**12:012d}"


def md_cell(lines: list[str] | str) -> dict:
    if isinstance(lines, str):
        lines = [lines]
    return {
        "cell_type": "markdown",
        "id": f"m{_uid(''.join(lines))}",
        "metadata": {},
        "source": lines,
    }


def code_cell(lines: list[str]) -> dict:
    # Strip leading/trailing blank lines
    while lines and lines[0].strip() == "":
        lines = lines[1:]
    while lines and lines[-1].strip() == "":
        lines = lines[:-1]
    if not lines:
        return None
    # Ensure trailing newline on last line so Jupyter renders cleanly
    if lines and not lines[-1].endswith("\n"):
        lines = lines[:-1] + [lines[-1] + "\n"]
    return {
        "cell_type": "code",
        "id": f"c{_uid(''.join(lines))}",
        "metadata": {},
        "outputs": [],
        "execution_count": None,
        "source": lines,
    }


def make_nb(cells: list[dict]) -> dict:
    return {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3.11.0"},
        },
        "cells": [c for c in cells if c is not None],
    }


# ── Parsing helpers ───────────────────────────────────────────────────────────

def extract_docstring(lines: list[str], pos: int) -> tuple[str, int]:
    """
    If lines[pos] starts a triple-quoted docstring, consume it and return
    (docstring_text, next_pos). Otherwise return ("", pos).
    """
    if pos >= len(lines):
        return "", pos
    stripped = lines[pos].strip()
    if not stripped.startswith('"""') and not stripped.startswith("'''"):
        return "", pos

    quote = '"""' if stripped.startswith('"""') else "'''"
    collected = [lines[pos]]
    content = stripped[3:]
    if content.endswith(quote) and len(content) >= 3:
        return "".join(collected), pos + 1

    pos += 1
    while pos < len(lines):
        collected.append(lines[pos])
        if quote in lines[pos]:
            pos += 1
            break
        pos += 1
    return "".join(collected), pos


def docstring_to_md(raw: str) -> list[str]:
    """Strip triple quotes and return lines suitable for a markdown cell."""
    raw = raw.strip()
    for q in ('"""', "'''"):
        if raw.startswith(q):
            raw = raw[3:]
            break
    for q in ('"""', "'''"):
        if raw.endswith(q):
            raw = raw[:-3]
            break
    return [l + "\n" for l in raw.strip().splitlines()]


# ── Main converter ────────────────────────────────────────────────────────────

def is_top_level_def(line: str) -> bool:
    return bool(re.match(r"^(def |class |async def )", line))


def is_import(line: str) -> bool:
    return bool(re.match(r"^(import |from )", line))


def is_constant(line: str) -> bool:
    return bool(re.match(r"^[A-Z_][A-Z0-9_]*\s*[=\[]", line))


def is_section_comment(line: str) -> bool:
    return bool(SECTION_RE.match(line.rstrip()))


def is_plain_comment(line: str) -> bool:
    return line.strip().startswith("#")


def get_top_level_block(lines: list[str], start: int) -> int:
    """
    Given that lines[start] is a top-level def/class, return the index of
    the first line AFTER this block ends (first line that is not indented
    and not blank, or EOF).
    """
    end = start + 1
    while end < len(lines):
        l = lines[end]
        if l.strip() == "":
            end += 1
            continue
        if l[0] not in (" ", "\t"):
            # Back up to skip trailing blanks
            break
        end += 1
    return end


def py_to_notebook(py_path: Path) -> dict:
    src = py_path.read_text(encoding="utf-8")
    raw_lines = src.splitlines(keepends=True)

    cells: list[dict] = []

    # ── 1. Title ──────────────────────────────────────────────────
    cells.append(md_cell(f"# `{py_path.name}`\n"))

    i = 0
    n = len(raw_lines)

    # ── 2. Module docstring ───────────────────────────────────────
    while i < n and raw_lines[i].strip() == "":
        i += 1
    doc_raw, i = extract_docstring(raw_lines, i)
    if doc_raw:
        md_lines = docstring_to_md(doc_raw)
        cells.append(md_cell(md_lines))

    # ── 3. Remainder — split into chunks ─────────────────────────
    import_lines: list[str] = []
    const_lines: list[str] = []
    pending_comment: list[str] = []   # section header lines accumulating

    def flush_imports():
        if import_lines:
            cells.append(code_cell(import_lines[:]))
            import_lines.clear()

    def flush_consts():
        if const_lines:
            cells.append(code_cell(const_lines[:]))
            const_lines.clear()

    def flush_pending_comment():
        nonlocal pending_comment
        if pending_comment:
            # Turn into markdown header
            m = SECTION_RE.match(pending_comment[0].rstrip())
            header = m.group(1) if m else pending_comment[0].strip("# \n")
            cells.append(md_cell(f"## {header}\n"))
            pending_comment = []

    while i < n:
        line = raw_lines[i]
        stripped = line.strip()

        # ── blank line: carry on (belongs to next block) ──
        if stripped == "":
            # If we're in middle of import/const gathering, separator is fine
            if import_lines:
                import_lines.append(line)
            elif const_lines:
                const_lines.append(line)
            i += 1
            continue

        # ── section comment ──
        if is_section_comment(line):
            flush_imports()
            flush_consts()
            flush_pending_comment()
            pending_comment.append(line)
            i += 1
            continue

        # ── __future__ / regular import ──
        if is_import(line) or stripped == "from __future__ import annotations":
            flush_consts()
            flush_pending_comment()
            import_lines.append(line)
            i += 1
            continue

        # ── ALL_CAPS constant assignment ──
        if is_constant(line) and not is_top_level_def(line):
            flush_imports()
            flush_pending_comment()
            # Collect the constant (may span multiple lines if dict/list)
            const_lines.append(line)
            i += 1
            # Continue collecting if line ends with { [ ( or backslash
            while i < n:
                peek = raw_lines[i]
                if peek.strip() == "":
                    break
                if peek[0] in (" ", "\t"):
                    const_lines.append(peek)
                    i += 1
                else:
                    break
            continue

        # ── top-level def / class ──
        if is_top_level_def(line):
            flush_imports()
            flush_consts()
            flush_pending_comment()

            end = get_top_level_block(raw_lines, i)
            block = raw_lines[i:end]

            # Hoist leading docstring comments into the same cell as the def
            cells.append(code_cell(block))
            i = end
            continue

        # ── if __name__ == "__main__" ──
        if stripped.startswith("if __name__"):
            flush_imports()
            flush_consts()
            flush_pending_comment()
            cells.append(md_cell("## 🚀 Entry Point / Smoke Test\n"))
            end = get_top_level_block(raw_lines, i)
            cells.append(code_cell(raw_lines[i:end]))
            i = end
            continue

        # ── plain decorator (@something) — collect with next def ──
        if stripped.startswith("@"):
            flush_imports()
            flush_consts()
            flush_pending_comment()
            decorator_lines = [line]
            i += 1
            while i < n:
                peek = raw_lines[i]
                if peek.strip().startswith("@"):
                    decorator_lines.append(peek)
                    i += 1
                elif is_top_level_def(peek):
                    end = get_top_level_block(raw_lines, i)
                    decorator_lines.extend(raw_lines[i:end])
                    i = end
                    break
                else:
                    decorator_lines.append(peek)
                    i += 1
                    break
            cells.append(code_cell(decorator_lines))
            continue

        # ── everything else (module-level code, comments, etc.) ──
        flush_imports()
        flush_consts()
        flush_pending_comment()

        # Collect until next top-level boundary
        misc: list[str] = [line]
        i += 1
        while i < n:
            peek = raw_lines[i]
            ps = peek.strip()
            if (
                ps == ""
                or is_import(peek)
                or is_top_level_def(peek)
                or is_section_comment(peek)
                or peek.strip().startswith("if __name__")
                or peek.strip().startswith("@")
            ):
                break
            misc.append(peek)
            i += 1
        if any(l.strip() for l in misc):
            cells.append(code_cell(misc))

    # Flush anything remaining
    flush_imports()
    flush_consts()
    flush_pending_comment()

    return make_nb(cells)


# ── Runner ────────────────────────────────────────────────────────────────────

def main():
    py_files = sorted(ML_DIR.glob("*.py"))
    print(f"Found {len(py_files)} Python files in {ML_DIR}\n")

    for py_path in py_files:
        nb = py_to_notebook(py_path)
        out_path = OUT_DIR / (py_path.stem + ".ipynb")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(nb, f, indent=1, ensure_ascii=False)
        n_cells = len(nb["cells"])
        print(f"  ✓  {py_path.name:30s} → {out_path.name}  ({n_cells} cells)")

    print(f"\nDone! {len(py_files)} notebooks in {OUT_DIR}")


if __name__ == "__main__":
    main()
