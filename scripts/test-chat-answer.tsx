import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ChatAnswer from "../components/workspace/ChatAnswer";

const html = renderToStaticMarkup(
  <ChatAnswer
    text={
      "## Normalization\n1. Remove repeating groups\n2. Remove partial dependencies\n3. Remove transitive dependencies\n\n- **Student** table\n- `Enrollment` table\n\n```sql\nSELECT StudentId\n  FROM Enrollment;\n```\n\n| Key | Meaning |\n| --- | --- |\n| ID | **Student** |\n\n<script>alert(1)</script>\n[Reference](https://example.org/db)\n[bad](javascript:alert(1))"
    }
  />,
);
assert.equal(
  (html.match(/<ol\b/g) || []).length,
  1,
  "Sequential steps remain one numbered list",
);
assert.equal((html.match(/<ul\b/g) || []).length, 1);
assert(html.includes('<ol start="1"'));
assert(
  html.includes("SELECT StudentId\n  FROM Enrollment;"),
  "SQL indentation and newlines are preserved",
);
assert(html.includes("<th>Key</th>"));
assert(html.includes("<strong>Student</strong>"));
assert(html.includes("&lt;script&gt;"));
assert(!html.includes("<script>") && !html.includes('href="javascript:'));
assert(html.includes('rel="noopener noreferrer"'));
const partial = renderToStaticMarkup(
  <ChatAnswer
    text={
      '4. Continued step\n5. Next step\n\n```python\nprint("unfinished streaming code")'
    }
  />,
);
assert(partial.includes('start="4"'));
assert(
  partial.includes("<pre") && partial.includes("unfinished streaming code"),
);
console.log(
  "PASS chat answer: sequential lists, code blocks, partial streamed fences, readable tables and escaped untrusted HTML/links.",
);
