import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// User-visible legacy HTML surfaces.
const htmlFiles = [
  'index.html',
  'app.html',
  'funcionamiento.html',
  'terminos.html',
  'review.html',
  'input.html',
  'batch.html',
  'batch-review.html',
  'batch-structured.html',
  'batch-structured-legacy.html',
  'batch-review-legacy.html',
  'guia.html',
];

// Modules that generate user-facing outputs (PDF/XLSX/ZIP): they must use
// preparación/seudonimización vocabulary and never claim anonymization.
const exportModules = [
  'js/export/pdf-report.js',
  'js/batch-exporter.js',
  'js/batch-structured/xlsx-exporter.js',
];

const docFiles = ['README.md'];

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
  { file: 'app.html', text: '¿Qué tipo de información quieres preparar?' },
  { file: 'README.md', text: 'textos, documentos y datos estructurados' },
  { file: 'guia.html', text: 'CSV/Excel' },
  // V4 terminology: preparation, not anonymization.
  { file: 'review.html', text: 'Metodología de Preparación' },
  { file: 'terminos.html', text: 'seudonimización' },
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
