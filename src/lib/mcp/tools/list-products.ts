import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { listCollection } from "../firestore-rest";

export default defineTool({
  name: "list_products",
  title: "List products",
  description: "List products in the inventory catalog. Optionally filter by category (case-insensitive substring).",
  inputSchema: {
    category: z.string().optional().describe("Optional category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category }) => {
    try {
      let rows = await listCollection("products_v2", 200);
      if (category) {
        const q = category.toLowerCase();
        rows = rows.filter((r) => String((r as Record<string, unknown>).category ?? "").toLowerCase().includes(q));
      }
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        structuredContent: { products: rows },
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: (e as Error).message }],
        isError: true,
      };
    }
  },
});
