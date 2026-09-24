import assert from "node:assert/strict";
import { officeText } from "../lib/intake/office";
async function main() {
  const doc = await officeText(
    Buffer.from(
      "UEsDBBQAAAAAAON8Nl2NldC9kwAAAJMAAAARAAAAd29yZC9kb2N1bWVudC54bWw8dzpkb2N1bWVudD48dzpwPjx3OnI+PHc6dD5DaGFpbiBvZiBjdXN0b2R5ICZhbXA7IGludGVncml0eTwvdzp0PjwvdzpyPjwvdzpwPjx3OnA+PHc6cj48dzp0PkRvY3VtZW50IGV2ZXJ5IHRyYW5zZmVyLjwvdzp0PjwvdzpyPjwvdzpwPjwvdzpkb2N1bWVudD5QSwECFAAUAAAAAADjfDZdjZXQvZMAAACTAAAAEQAAAAAAAAAAAAAAgAEAAAAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAEAAQA/AAAAwgAAAAAA",
      "base64",
    ),
    "docx",
  );
  assert(doc.includes("Chain of custody & integrity"));
  assert(doc.includes("Document every transfer."));
  const slides = await officeText(
    Buffer.from(
      "UEsDBBQAAAAAAON8Nl2FDN1lPQAAAD0AAAAWAAAAcHB0L3NsaWRlcy9zbGlkZTEwLnhtbDxhOnA+PGE6cj48YTp0PlNsaWRlIDEwIGV2aWRlbmNlIGNvbGxlY3Rpb248L2E6dD48L2E6cj48L2E6cD5QSwMEFAAAAAAA43w2XdmroyQ8AAAAPAAAABUAAABwcHQvc2xpZGVzL3NsaWRlMi54bWw8YTpwPjxhOnI+PGE6dD5TbGlkZSAyIGV2aWRlbmNlIGNvbGxlY3Rpb248L2E6dD48L2E6cj48L2E6cD5QSwMEFAAAAAAA43w2XSK3OPc8AAAAPAAAABUAAABwcHQvc2xpZGVzL3NsaWRlMS54bWw8YTpwPjxhOnI+PGE6dD5TbGlkZSAxIGV2aWRlbmNlIGNvbGxlY3Rpb248L2E6dD48L2E6cj48L2E6cD5QSwECFAAUAAAAAADjfDZdhQzdZT0AAAA9AAAAFgAAAAAAAAAAAAAAgAEAAAAAcHB0L3NsaWRlcy9zbGlkZTEwLnhtbFBLAQIUABQAAAAAAON8Nl3Zq6MkPAAAADwAAAAVAAAAAAAAAAAAAACAAXEAAABwcHQvc2xpZGVzL3NsaWRlMi54bWxQSwECFAAUAAAAAADjfDZdIrc49zwAAAA8AAAAFQAAAAAAAAAAAAAAgAHgAAAAcHB0L3NsaWRlcy9zbGlkZTEueG1sUEsFBgAAAAADAAMAygAAAE8BAAAAAA==",
      "base64",
    ),
    "pptx",
  );
  assert(slides.indexOf("Slide 1 ") < slides.indexOf("Slide 2 "));
  assert(slides.indexOf("Slide 2 ") < slides.indexOf("Slide 10 "));
  await assert.rejects(() => officeText(Buffer.from("not a zip"), "docx"));
  console.log(
    "PASS: DOCX paragraph/entity extraction, numeric slide ordering, malformed archive rejection.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
