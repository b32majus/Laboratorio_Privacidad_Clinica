/**
 * Deterministic generator for the synthetic input fixtures used by the V4
 * input-adapter oracles (T06 #10). The generated files are COMMITTED to the
 * repository; tests read the committed bytes, never run this script.
 *
 * Re-running this script must reproduce the committed bytes byte-for-byte:
 *   node app-v4/src/input/fixtures/generate-fixtures.mjs
 * (verify afterwards with `git status` — no fixture may show as modified.)
 *
 * ALL content is synthetic. No real patient data, PHI/PII, or content taken
 * from any real clinical document is used anywhere in these fixtures.
 *
 * Fixture inventory:
 *   sample-clinical-note.txt   — small TXT document, exact expected text.
 *   sample-clinical-note.docx  — minimal valid DOCX (zip built with jszip and
 *                                a fixed DOS timestamp for determinism).
 *   sample-clinical-note.pdf   — minimal valid text-bearing PDF (hand-crafted
 *                                xref/trailer bytes, single Tj text operator).
 *   sample-scanned.pdf         — valid PDF with NO text operators (the
 *                                pdf-no-text-layer oracle).
 *   sample-legacy.doc          — tiny fake legacy .doc binary (OLE compound
 *                                file magic only; the V4 surface must reject
 *                                .doc by extension before any parsing).
 *   corrupt.docx               — plain bytes that are not a zip archive.
 *   corrupt.pdf                — bytes without a valid PDF structure.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));

// Fixed timestamp so jszip's zip local headers are byte-deterministic.
const FIXED_DATE = new Date(Date.UTC(2026, 8, 24, 12, 0, 0));

// ---------------------------------------------------------------------------
// Hand-crafted minimal PDF builder (single page, single font, one content
// stream). Latin-1 bytes only; the content stream must be ASCII.
// ---------------------------------------------------------------------------
function buildPdf(contentStream) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// ---------------------------------------------------------------------------
// Minimal valid DOCX (Office Open XML) with two synthetic paragraphs.
// ---------------------------------------------------------------------------
async function buildDocx(paragraphs) {
  const escaped = paragraphs.map((text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  );
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>` +
    escaped
      .map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`)
      .join("") +
    `</w:body></w:document>`;
  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;
  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const zip = new JSZip();
  const options = { date: FIXED_DATE, createFolders: false };
  zip.file("[Content_Types].xml", contentTypesXml, options);
  zip.file("_rels/.rels", relsXml, options);
  zip.file("word/document.xml", documentXml, options);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
}

// ---------------------------------------------------------------------------
// Fixture content (synthetic; ASCII to keep PDF text extraction exact).
// ---------------------------------------------------------------------------
const TXT_TEXT = [
  "Nota clinica sintetica de prueba para el laboratorio.",
  "Paciente: sintetico, sin datos reales.",
  "Motivo de consulta: validacion del adaptador de entrada TXT.",
].join("\n");

const DOCX_PARAGRAPHS = [
  "Nota clinica sintetica de prueba para el laboratorio.",
  "Paciente: sintetico, sin datos reales.",
];

const PDF_TEXT_LINE = "Nota clinica sintetica de prueba para el laboratorio.";

const fixtures = [
  { name: "sample-clinical-note.txt", bytes: Buffer.from(TXT_TEXT + "\n", "utf8") },
  { name: "sample-clinical-note.docx", bytes: buildDocx(DOCX_PARAGRAPHS) },
  {
    name: "sample-clinical-note.pdf",
    bytes: buildPdf(`BT /F1 12 Tf 72 720 Td (${PDF_TEXT_LINE}) Tj ET`),
  },
  {
    name: "sample-scanned.pdf",
    // Valid PDF, but the content stream contains NO text operators at all
    // (only a stroked rectangle), i.e. the "scan without text layer" case.
    bytes: buildPdf("0 0 612 792 re S"),
  },
  {
    name: "sample-legacy.doc",
    // OLE compound-file magic followed by zero padding: never parsed by V4,
    // the extension must be rejected before any byte is read.
    bytes: Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(56, 0x00),
    ]),
  },
  {
    name: "corrupt.docx",
    bytes: Buffer.from("esto no es un archivo docx valido ni un zip", "utf8"),
  },
  {
    name: "corrupt.pdf",
    bytes: Buffer.from("esto no es un documento pdf valido", "utf8"),
  },
];

for (const fixture of fixtures) {
  const bytes = await fixture.bytes;
  fs.writeFileSync(path.join(fixturesDir, fixture.name), bytes);
  process.stdout.write(`wrote ${fixture.name} (${bytes.length} bytes)\n`);
}
