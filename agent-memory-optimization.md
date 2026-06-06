# Agent Memory Optimization

A reference on how to store and serve context to AI agents efficiently — covering local vs. committed memory, format choices, and token minimization strategies.

---

## The Two Kinds of Memory

| Type | Location | Shared? | Use for |
|---|---|---|---|
| Local memory | `~/.claude/projects/…` | No — machine only | Cross-session working notes, preferences, in-flight decisions |
| Committed memory | `AGENTS.md`, `CLAUDE.md` | Yes — any agent cloning the repo | Architecture, design decisions, constraints, where to make changes |

Local memory is a scratchpad. Committed files are the source of truth for any agent working on the repo.

---

## Committed Context Files

### AGENTS.md
The agent-neutral standard. Read by Claude Code, OpenAI Codex, and others. Keep it focused on:
- What the project does (algorithm, not prose)
- File map: where each concern lives
- Key constraints and what to avoid
- Design decisions with their *why*

### CLAUDE.md
Claude Code's specific file — auto-loaded at session start. Use it for Claude-specific workflow rules, tool preferences, and hook configs that don't belong in the more neutral AGENTS.md.

---

## Making Committed Context Efficient

### 1. Hierarchical CLAUDE.md
Claude Code loads `CLAUDE.md` at every directory level, only pulling in files relevant to the current working directory.

```
CLAUDE.md              ← always loaded, keep it short
godelify/CLAUDE.md     ← loaded when editing source
tests/CLAUDE.md        ← loaded when editing tests
```

An agent editing `cli.py` pays no tokens for test context.

### 2. Inline Function Signatures
Include exact signatures in AGENTS.md so agents skip reading source files:

```python
# godelify/core.py
def encode(filename: str) -> dict:
    # returns: {"prime": int, "metadata": int, "program_size_bytes": int}
def decode(prime: int, original_size: int) -> bytes:
```

### 3. @filename Imports
Claude Code supports lazy file references in CLAUDE.md — content pulled in only when relevant:

```markdown
For core logic: @godelify/core.py
For CLI details: @godelify/cli.py
```

### 4. Keep It Token-Lean
Every line costs tokens on every agent invocation. Only include what is not derivable from reading the code:
- The *why* behind decisions
- Non-obvious constraints
- What to avoid and why

---

## Minimizing Token Usage Further

### Dense Formats (low effort)
YAML is more token-efficient than Markdown prose for structured facts:

```yaml
encode: "bytes → (N << 32) | metadata → first prime found"
decode: "prime >> 32 → .to_bytes(original_size, 'big')"
constraints:
  - no logging inside encode()
  - prime must be stored as int, never string
  - byteorder big in both encode and decode
metadata_bits: 32
```

Agents still load the whole file, but the payload is smaller.

### MCP Server (medium effort)
Expose project knowledge as queryable tools. The agent calls `get_constraint("encode")` and receives only what it needs — no full-doc load. Claude Code supports local MCP servers, so a small server reading a structured config file can serve targeted answers cheaply.

### RAG / Vector Store (high effort)
Chunk docs, embed them, retrieve only semantically relevant chunks per task. The right architecture for large monorepos where agents repeatedly load large context they mostly don't use. Overkill for small projects.

---

## Choosing the Right Level

| Project size | Recommended approach |
|---|---|
| Small (< 10 files) | Lean AGENTS.md + hierarchical CLAUDE.md |
| Medium (10–100 files) | Above + YAML structured config + @imports |
| Large monorepo | MCP query layer or RAG pipeline |

The overhead of building an MCP server or RAG pipeline only pays off when agents are repeatedly loading kilobytes of context they mostly ignore. Match the solution to the actual token cost, not the hypothetical one.
