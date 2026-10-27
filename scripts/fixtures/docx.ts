import { crc32, deflateRawSync } from "node:zlib";

/** A real, minimal OOXML ZIP fixture; no Office application or network needed. */
export function fixtureDocx(text: string, name = "word/document.xml"): Buffer {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const xml = Buffer.from(
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${escaped
      .split("\n")
      .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  );
  return fixtureOfficePart(xml, name);
}

export function fixtureOfficePart(
  xml: Buffer,
  name = "word/document.xml",
): Buffer {
  const filename = Buffer.from(name),
    compressed = deflateRawSync(xml),
    checksum = crc32(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const body = Buffer.concat([local, filename, compressed]),
    directory = Buffer.concat([central, filename]),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, directory, end]);
}
