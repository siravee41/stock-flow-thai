import { defineTool } from "@lovable.dev/mcp-js";
import { listCollection } from "../firestore-rest";

export default defineTool({
  name: "list_branches",
  title: "List branches",
  description: "List all restaurant branches in the inventory system.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    try {
      const rows = await listCollection("branches");
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        structuredContent: { branches: rows },
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: (e as Error).message }],
        isError: true,
      };
    }
  },
});
