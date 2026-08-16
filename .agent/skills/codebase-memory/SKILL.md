---
name: codebase-memory
description: Codebase knowledge graph and semantic memory toolset. Use when navigating, searching symbols/functions/classes, tracing dependencies, analyzing architecture, or understanding codebase relationships.
---

# Codebase Memory Skill

This skill guides agents on how to leverage the `codebase-memory` MCP server to interact with the repository's semantic knowledge graph.

## Server Information
- **Server Name**: `codebase-memory`
- **Invocation Method**: `call_mcp_tool`

## Primary Workflows

### 1. Identifying the Project
Before running project-scoped tools (`search_graph`, `search_code`, `trace_path`), call `list_projects` to determine the active project name:
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "list_projects",
  "Arguments": {}
}
```
*Note: For the current workspace, the project name is typically `E-code-hivemind`.*

---

### 2. Searching Code & Definitions
Use `search_graph` for fast structural lookups (Functions, Classes, Routes):
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "search_graph",
  "Arguments": {
    "project": "E-code-hivemind",
    "query": "process_event",
    "limit": 20
  }
}
```
Or for regex matching:
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "search_graph",
  "Arguments": {
    "project": "E-code-hivemind",
    "name_pattern": ".*Handler.*"
  }
}
```

---

### 3. Architecture & Dependency Tracing
To inspect the architectural overview:
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "get_architecture",
  "Arguments": {
    "project": "E-code-hivemind"
  }
}
```

To trace paths between two components/symbols:
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "trace_path",
  "Arguments": {
    "project": "E-code-hivemind",
    "from": "SourceSymbol",
    "to": "TargetSymbol"
  }
}
```

---

### 4. Reading Code Snippets
Fetch definitions directly from the knowledge graph:
```json
{
  "ServerName": "codebase-memory",
  "ToolName": "get_code_snippet",
  "Arguments": {
    "project": "E-code-hivemind",
    "node_id": "<NODE_ID>"
  }
}
```
