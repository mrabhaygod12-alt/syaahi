import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { renderPdf } from "../lib/pdf/server";
async function main() {
  mkdirSync("output/pdf", { recursive: true });
  const notes = JSON.parse(
    readFileSync("tmp/pdfs/original-notes.json", "utf8"),
  );
  const result = await renderPdf(notes);
  writeFileSync("output/pdf/syaahi-bash-notes-reflowed.pdf", result.bytes);
  console.log(
    JSON.stringify({
      file: "syaahi-bash-notes-reflowed.pdf",
      sections: notes.length,
      pages: result.pages,
      bytes: result.bytes.length,
    }),
  );
  const test = await renderPdf([
    {
      topic: "Layout verification",
      markdown:
        '## Layout verification\n\nA formula: $E=mc^2$ and inline `code`.\n\n```python\ndef example():\n    return "Indentation stays intact"\n```\n\n### Long content\n' +
        "Readable content continues naturally without being stretched. ".repeat(
          180,
        ) +
        "\n\n| Column A | Column B |\n|---|---|\n" +
        Array.from(
          { length: 50 },
          (_, i) => `| Row ${i + 1} | Preserved text ${i + 1} |`,
        ).join("\n") +
        '\n\n<script>alert("unsafe")</script>\n\nEND OF LAYOUT TEST',
    },
    {
      topic: "Hindi sample",
      markdown:
        "## हिंदी में अध्ययन\n\nप्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे प्रकाश ऊर्जा का उपयोग करते हैं।\n\n**सारांश:** समझें, अभ्यास करें और दोहराएँ।",
      style: { font: "kalam", ink: "blue", paper: "ruled", jitter: 0.5 },
    } as any,
  ]);
  writeFileSync("output/pdf/layout-verification.pdf", test.bytes);
  console.log(
    JSON.stringify({ file: "layout-verification.pdf", pages: test.pages }),
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
