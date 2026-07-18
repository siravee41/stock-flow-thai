import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { listCollection } from "../firestore-rest";

export default defineTool({
  name: "recent_stock_movements",
  title: "Recent stock movements",
  description: "Return the most recent stock movements (IN/OUT/TRANSFER), newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    try {
      const rows = await listCollection("stock_movements", 200);
      rows.sort((a, b) => {
        const ta = String((a as Record<string, unknown>).created_at ?? (a as Record<string, unknown>).createdAt ?? "");
        const tb = String((b as Record<string, unknown>).created_at ?? (b as Record<string, unknown>).createdAt ?? "");
        return tb.localeCompare(ta);
      });
      const trimmed = rows.slice(0, limit ?? 20);
      return {
        content: [{ type: "text", text: JSON.stringify(trimmed, null, 2) }],
        structuredContent: { movements: trimmed },
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: (e as Error).message }],
        isError: true,
      };
    }
  },
});
