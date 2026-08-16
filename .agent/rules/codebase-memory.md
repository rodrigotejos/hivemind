# Codebase Memory MCP Integration

When analyzing, exploring, navigating, or modifying code in this workspace, prioritize using the **`codebase-memory`** MCP server tools before relying solely on raw text search (`grep_search` / `file_search`).

## Available MCP Server: `codebase-memory`

Use `call_mcp_tool` with `ServerName: "codebase-memory"`:

### Core Tools & Use Cases
- **`search_graph`**: Search the code knowledge graph for functions, classes, routes, and variables. Use instead of grep/glob for finding code definitions, implementations, or relationships.
  - *Modes*: BM25 query (`query`), regex name pattern (`name_pattern`), or vector search (`semantic_query`).
  - *Required*: `project: "E-code-hivemind"` (or current project identifier from `list_projects`).
- **`search_code`**: Semantic, keyword, and hybrid code search with ranking and code snippets.
- **`get_architecture`**: Retrieve high-level architecture overview, component graphs, and dependency clusters.
- **`trace_path`**: Trace call paths and dependency chains between two symbols or files.
- **`query_graph`**: Execute structural/relational graph queries across nodes and edges.
- **`get_code_snippet`**: Fetch definitions and implementations directly from graph nodes without opening large files.
- **`detect_changes`**: Check modified/stale files compared to the current index.
- **`index_repository` / `index_status`**: Refresh or inspect the status of the repository knowledge graph.
- **`list_projects`**: Discover all available indexed project identifiers and roots.

## Guidelines for Agents
1. **Always check `list_projects`** if you need to confirm the project key (default: `E-code-hivemind`).
2. **Use graph search for discovery**: When asked "where is X implemented?", "what calls Y?", or "explain the architecture of Z", query `get_architecture`, `search_graph`, or `trace_path`.
3. **Keep index updated**: If significant code changes are made, run `detect_changes` or `index_repository` if necessary.
