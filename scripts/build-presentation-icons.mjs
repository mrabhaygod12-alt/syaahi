import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
const names = {
  sparkles: "Sparkles",
  "shield-check": "ShieldCheck",
  "book-open": "BookOpen",
  "chart-no-axes-combined": "ChartNoAxesCombined",
  lightbulb: "Lightbulb",
  users: "Users",
  target: "Target",
  workflow: "Workflow",
  leaf: "Leaf",
  globe: "Globe",
  zap: "Zap",
  search: "Search",
};
const data = Object.fromEntries(
  Object.entries(names).map(([key, name]) => [
    key,
    renderToStaticMarkup(
      createElement(icons[name], { size: 64, strokeWidth: 1.8 }),
    ),
  ]),
);
writeFileSync(
  "lib/presentations/icon-paths.json",
  JSON.stringify(data, null, 2) + "\n",
);
mkdirSync("licenses", { recursive: true });
writeFileSync(
  "licenses/lucide-LICENSE.txt",
  readFileSync("node_modules/lucide-react/LICENSE"),
);
