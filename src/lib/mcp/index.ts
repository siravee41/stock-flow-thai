import { defineMcp } from "@lovable.dev/mcp-js";
import listBranches from "./tools/list-branches";
import listProducts from "./tools/list-products";
import recentMovements from "./tools/recent-movements";

export default defineMcp({
  name: "stock-flow-thai-mcp",
  title: "Stock Flow (Thai) MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for a Thai restaurant-group inventory system. Use `list_branches` to see branches, `list_products` to browse the catalog (optionally filter by category), and `recent_stock_movements` to see recent IN/OUT/TRANSFER activity.",
  tools: [listBranches, listProducts, recentMovements],
});
