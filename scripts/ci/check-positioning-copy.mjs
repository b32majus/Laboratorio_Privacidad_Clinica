import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// User-visible HTML surfaces (T25 #29: the legacy application pages —
// app/input/batch/review/batch-* and their iframe/legacy variants — were
// retired; the canonical clinical surface is the V4 SPA (app-v4/, built to
// dist/). The remaining pages are the informational/marketing content, whose
// links now point to the V4 entry (app-v4/index.html).
const htmlFiles = [
  'index.html',
  'funcionamiento.html',
  'terminos.html',
  'guia.html',
];

// Modules that generate user-facing outputs (PDF/XLSX/ZIP): they must use
// preparación/seudonimización vocabulary and never claim anonymization.
// T25 #29: the legacy export modules were retired with their pages; the V4
// export surfaces are the pure safe-output/confidential-audit services, which
// are scanned below via appV4Files (PDF/XLSX/ZIP generation no longer exists
// in the clinical origin).
const exportModules = [];

const docFiles = ['README.md', 'GUIA_OPERACION.md'];

function listAppV4Sources() {
  const srcDir = path.join(root, 'app-v4', 'src');
  if (!fs.existsSync(srcDir)) return [];
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        sources.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(srcDir);
  return sources.sort();
}

const appV4Files = listAppV4Sources();
const scanFiles = [...htmlFiles, ...docFiles, ...exportModules, ...appV4Files];

const failures = [];

const textByFile = new Map();
for (const file of scanFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`Missing expected file in positioning scan: ${file}`);
    continue;
  }
  textByFile.set(file, fs.readFileSync(full, 'utf8'));
}

const required = [
  { file: 'index.html', text: 'Prepara información sanitaria antes de usar IA' },
  { file: 'index.html', text: 'Texto o documento clínico' },
  { file: 'index.html', text: 'Datos estructurados' },
  { file: 'index.html', text: 'CSV/Excel' },
  { file: 'README.md', text: 'textos, documentos y datos estructurados' },
  { file: 'guia.html', text: 'CSV/Excel' },
  // V4 terminology: preparation, not anonymization.
  { file: 'terminos.html', text: 'seudonimización' },
  { file: 'index.html', text: 'app-v4/index.html' },
];

const forbidden = [
  'Cumple GDPR',
  'Sin riesgos',
  'Garantizamos',
  'con total tranquilidad',
  'IA Generativa. Una herramienta de',
];

// Forbidden privacy-claim patterns. HTML keeps legitimate disclaimers that
// mention "anonimización" in negations, so no blanket /anonim/i rule over HTML.
const claimPatterns = [
  { name: 'k-anonymity claim', pattern: /k-?\s?anonimato|k-?\s?anonymity|kanonimidad/i },
  { name: 'differential privacy claim', pattern: /privacidad\s+diferencial|differential\s+privacy/i },
  { name: 'certification claim', pattern: /certifica\s+(que|el)|documento\s+certifica|informe\s+certifica/i },
  {
    name: 'compliance guarantee claim',
    pattern:
      /conforme\s+a\s+los\s+principios\s+del\s+(rgpd|gdpr)|cumple\s+con\s+(el\s+)?(rgpd|gdpr|lopdgdd|hipaa)|compliant\s+with\s+(gdpr|hipaa)/i,
  },
  // Positive anonymization-as-function claims. These patterns are narrow on
  // purpose: legitimate disclaimer lines ("la anonimización final recae...",
  // "NO constituye anonimización", "no como certificación ... de anonimización")
  // must not match, so each pattern locks one audited positive claim shape.
  {
    name: 'anonymization-as-function claim',
    pattern:
      /anonimizaci[óo]n\s+(m[áa]s\s+agresiva|consistente|automatizad[oa])/i,
  },
  { name: 'anonymized-output claim', pattern: /salida\s+anonimizad[oa]/i },
  { name: 'must-be-anonymized claim', pattern: /(debe|deben)\s+ser\s+anonimizad[oa]s?/i },
  { name: 'automated-anonymization claim', pattern: /automatizar\s+parte\s+de\s+la\s+anonimizaci[óo]n/i },
];

// Generated outputs (PDF/XLSX/ZIP) must use preparación/seudonimización
// vocabulary only: any "anonim*" mention in the exporter modules fails.
const exportModulePattern = { name: 'anonymization vocabulary in generated-output exporter', pattern: /anonim/i };

for (const [file, text] of textByFile) {
  const lines = text.split('\n');
  const isActiveExportModule = exportModules.includes(file);
  for (let i = 0; i < lines.length; i++) {
    const patterns = isActiveExportModule ? [...claimPatterns, exportModulePattern] : claimPatterns;
    for (const { name, pattern } of patterns) {
      if (pattern.test(lines[i])) {
        failures.push(
          `Forbidden ${name} in ${file}:${i + 1}: "${lines[i].trim().slice(0, 120)}"`,
        );
      }
    }
  }
}

for (const { file, text } of required) {
  if (!textByFile.get(file)?.includes(text)) {
    failures.push(`Missing "${text}" in ${file}`);
  }
}

const combined = [...textByFile.values()].join('\n');
for (const text of forbidden) {
  if (combined.includes(text)) {
    failures.push(`Forbidden positioning claim still present: "${text}"`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Positioning copy checks passed');
