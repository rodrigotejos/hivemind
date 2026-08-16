# AI-DLC Workflow

When the user invokes AI-DLC, read and follow
`.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md` to start the workflow.

# Codebase Memory MCP

All agents should prioritize using the `codebase-memory` MCP server (via `call_mcp_tool`) for codebase exploration, symbol search, architecture insights, and dependency tracing. See `.agent/rules/codebase-memory.md` and `.agent/skills/codebase-memory/SKILL.md` for guidelines.
