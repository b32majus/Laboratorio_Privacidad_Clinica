import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['index.html', 'app.html', 'README.md', 'guia.html'];
const textByFile = new Map(
  files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]),
);
const combined = [...textByFile.values()].join('\n');

const required = [
  { file: 'index.html', text: 'Prepara información sanitaria antes de usar IA' },
  { file: 'index.html', text: 'Texto o documento clínico' },
  { file: 'index.html', text: 'Datos estructurados' },
  { file: 'index.html', text: 'CSV/Excel' },
  { file: 'app.html', text: '¿Qué tipo de información quieres preparar?' },
  { file: 'README.md', text: 'textos, documentos y datos estructurados' },
  { file: 'guia.html', text: 'CSV/Excel' },
];

const forbidden = [
  'Cumple GDPR',
  'Sin riesgos',
  'Garantizamos',
  'con total tranquilidad',
  'IA Generativa. Una herramienta de',
];

const failures = [];

for (const { file, text } of required) {
  if (!textByFile.get(file)?.includes(text)) {
    failures.push(`Missing "${text}" in ${file}`);
  }
}

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
