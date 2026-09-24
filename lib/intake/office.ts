import { fromBuffer } from "yauzl";
const decode = (s: string) =>
  s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (x) => {
    const map: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    if (map[x]) return map[x];
    const n = x.startsWith("&#x")
      ? parseInt(x.slice(3, -1), 16)
      : Number(x.slice(2, -1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
export async function officeText(
  buffer: Buffer,
  kind: "docx" | "pptx",
): Promise<string> {
  return new Promise((resolve, reject) => {
    fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) return reject(new Error("Invalid Office document."));
        let entries = 0,
          total = 0;
        const parts: Array<{ name: string; text: string }> = [];
        const timer = setTimeout(() => {
          zip.close();
          reject(new Error("Document extraction timed out."));
        }, 12000);
        const fail = (e: Error) => {
          clearTimeout(timer);
          zip.close();
          reject(e);
        };
        zip.on("error", fail);
        zip.on("entry", (entry) => {
          if (++entries > 2500 || entry.uncompressedSize > 25 * 1024 * 1024) {
            fail(new Error("Document expands beyond the supported limits."));
            return;
          }
          const wanted =
            kind === "docx"
              ? entry.fileName === "word/document.xml"
              : /^ppt\/slides\/slide\d+\.xml$/.test(entry.fileName);
          if (!wanted) {
            zip.readEntry();
            return;
          }
          if ((total += entry.uncompressedSize) > 25 * 1024 * 1024) {
            fail(new Error("Document text is too large."));
            return;
          }
          zip.openReadStream(entry, (err, stream) => {
            if (err || !stream) {
              fail(new Error("Could not read document text."));
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            stream.on("data", (chunk) => {
              bytes += chunk.length;
              if (bytes > 25 * 1024 * 1024) {
                stream.destroy();
                fail(new Error("Document expansion limit."));
              } else chunks.push(chunk);
            });
            stream.on("error", fail);
            stream.on("end", () => {
              const xml = Buffer.concat(chunks).toString("utf8");
              const text = xml
                .replace(/<\/(?:w:p|a:p)>/g, "\n")
                .replace(/<(?:w:tab|a:br)[^>]*\/>/g, " ")
                .replace(/<[^>]*>/g, "");
              parts.push({ name: entry.fileName, text: decode(text) });
              zip.readEntry();
            });
          });
        });
        zip.on("end", () => {
          clearTimeout(timer);
          parts.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true }),
          );
          resolve(
            parts
              .map((p) => p.text)
              .join("\n\n")
              .slice(0, 100000),
          );
        });
        zip.readEntry();
      },
    );
  });
}
