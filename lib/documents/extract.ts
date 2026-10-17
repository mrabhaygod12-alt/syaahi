import { spawn } from "node:child_process";
import { InputValidationError } from "@/lib/security/validation";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
let active = 0;
const source = `
process.once('message', async (workerData) => {
  let parser;
  try {
    const { PDFParse } = require(workerData.module);
    parser = new PDFParse({ data: workerData.bytes, isEvalSupported: false });
    const info = await parser.getInfo();
    if (!Number.isInteger(info.total) || info.total < 1 || info.total > 500)
      throw Error('Split PDFs larger than 500 pages into volumes.');
    const pages = []; let chars = 0;
    for (let first = 1; first <= info.total; first += 10) {
      const partial = Array.from({ length: Math.min(10, info.total-first+1) }, (_,i) => first+i);
      const result = await parser.getText({ partial });
      for (const page of result.pages) {
        chars += page.text.length;
        if (chars > workerData.maxCharacters) throw Error('Extracted text is too large. Split the PDF into chapters.');
        pages.push({num:page.num, text:page.text});
      }
    }
    process.send({ok:true, pageCount: info.total, pages});
  } catch { process.send({ok:false}); }
  finally { if (parser) await parser.destroy().catch(() => {}); }
});`;

/** CPU work runs outside the HTTP event loop, with memory, concurrency and wall-time limits. */
export async function extractPdf(
  bytes: Uint8Array,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    maxCharacters?: number;
  } = {},
): Promise<{ pageCount: number; pages: Array<{ num: number; text: string }> }> {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length < 5 ||
    bytes.length > 10 * 1024 * 1024 ||
    Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw new InputValidationError("Choose a valid PDF up to 10 MB.");
  if (options.signal?.aborted)
    throw new ExtractionError("PDF extraction was cancelled.", 408);
  const configured = Number(process.env.PDF_MAX_CONCURRENT || "1");
  const capacity =
    Number.isInteger(configured) && configured >= 1 && configured <= 2
      ? configured
      : 1;
  if (active >= capacity)
    throw new ExtractionError(
      "Document processing is busy. Retry shortly.",
      503,
    );
  active++;
  try {
    const moduleApi = await import(/* webpackIgnore: true */ "node:module");
    const module = moduleApi
      .createRequire(process.cwd() + "/package.json")
      .resolve("pdf-parse");
    // A process boundary also contains native PDF/canvas crashes; threads cannot.
    const worker = spawn(
      process.execPath,
      ["--max-old-space-size=128", "--input-type=commonjs", "-e", source],
      {
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        serialization: "advanced",
        env: {
          NODE_ENV: "production",
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          LANG: process.env.LANG,
        },
      },
    );
    try {
      return await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error: Error | null, value?: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", abort);
          error ? reject(error) : resolve(value);
        };
        const abort = () =>
          finish(new ExtractionError("PDF extraction was cancelled.", 408));
        const timer = setTimeout(
          () =>
            finish(
              new ExtractionError(
                "Extraction took too long. Split the PDF into chapters.",
                422,
              ),
            ),
          Math.min(90000, Math.max(1, options.timeoutMs || 45000)),
        );
        options.signal?.addEventListener("abort", abort, { once: true });
        worker.once("message", (result: any) =>
          finish(
            result?.ok === true &&
              Number.isInteger(result.pageCount) &&
              Array.isArray(result.pages)
              ? null
              : new ExtractionError(
                  "This PDF could not be read safely. Try a smaller, text-based PDF.",
                ),
            result,
          ),
        );
        worker.once("error", () =>
          finish(
            new ExtractionError(
              "This PDF exceeded the processing limit. Try a smaller file.",
            ),
          ),
        );
        worker.once("exit", () =>
          finish(
            new ExtractionError("PDF processing stopped. Try a smaller file."),
          ),
        );
        worker.send(
          {
            module,
            bytes,
            maxCharacters: Math.min(
              3000000,
              Math.max(1000, options.maxCharacters || 3000000),
            ),
          },
          (error) => {
            if (error)
              finish(new ExtractionError("PDF processing could not start."));
          },
        );
      });
    } finally {
      worker.kill("SIGKILL");
    }
  } finally {
    active--;
  }
}
