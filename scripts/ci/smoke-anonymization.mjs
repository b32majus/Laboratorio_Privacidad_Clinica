import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const { PrivacyProcessor } = await import(path.join(repoRoot, 'js/modular-processor.js'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasType(result, type, min = 1) {
  const count = result.entities.filter((e) => e.type === type).length;
  return count >= min;
}

function hasSubtype(result, type, subtype, min = 1) {
  const count = result.entities.filter((e) => e.type === type && e.subtype === subtype).length;
  return count >= min;
}

function includesInsensitive(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

const examplePaths = [
  'ejemplos/01-consulta-urgencias.json',
  'ejemplos/02-informe-quirurgico.json',
  'ejemplos/03-historia-clinica.json',
  'ejemplos/04-caso-complejo-cuasiidentificadores.json'
];

const reports = [];

for (const relativePath of examplePaths) {
  const absolutePath = path.join(repoRoot, relativePath);
  const raw = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  const result = PrivacyProcessor.process(raw.texto);

  assert(typeof result.processed === 'string', `${relativePath}: processed no es string`);
  assert(Array.isArray(result.entities), `${relativePath}: entities no es array`);
  assert(result.stats && result.sessionId, `${relativePath}: falta contrato minimo stats/sessionId`);
  result.entities.forEach((e, idx) => {
    assert(typeof e.transformed === 'string', `${relativePath}: entidad ${idx} sin transformed`);
    assert(e.position && Number.isInteger(e.position.start) && Number.isInteger(e.position.end), `${relativePath}: entidad ${idx} sin posicion valida`);
  });

  reports.push({
    file: relativePath,
    entities: result.entities.length,
    byType: result.stats.byType,
    processedSample: result.processed.slice(0, 130).replace(/\n/g, ' ')
  });

  if (relativePath.includes('01-consulta-urgencias')) {
    assert(hasType(result, 'NOMBRE', 1), 'Caso 01: debe detectar nombres');
    assert(hasType(result, 'IDENTIFICADOR', 2), 'Caso 01: debe detectar DNI + telefono');
    assert(hasType(result, 'UBICACION', 2), 'Caso 01: debe detectar ubicaciones');
    assert(hasType(result, 'FECHA', 1), 'Caso 01: debe detectar al menos una fecha');
    assert(!includesInsensitive(result.processed, '30970148B'), 'Caso 01: el DNI debe desaparecer');
    assert(!includesInsensitive(result.processed, '654-321-987'), 'Caso 01: el telefono debe desaparecer');
    assert(!includesInsensitive(result.processed, '2019'), 'Caso 01: el ano contextual debe relativizarse');
  }

  if (relativePath.includes('02-informe-quirurgico')) {
    assert(hasType(result, 'NOMBRE', 3), 'Caso 02: debe detectar paciente + profesionales');
    assert(hasType(result, 'FECHA', 2), 'Caso 02: debe detectar dos fechas');
    assert(hasType(result, 'UBICACION', 1), 'Caso 02: debe detectar hospital/ubicacion');
    assert(!includesInsensitive(result.processed, 'María del Carmen López'), 'Caso 02: nombre compuesto no anonimizado');
    assert(!includesInsensitive(result.processed, '2024/089756'), 'Caso 02: NHC con separador debe anonimizarse');
  }

  if (relativePath.includes('03-historia-clinica')) {
    assert(hasType(result, 'SOSPECHOSO', 1), 'Caso 03: debe detectar cuasi-identificador de profesion');
    assert(!includesInsensitive(result.processed, 'carmen.rodriguez@email.com'), 'Caso 03: email debe anonimizarse');
  }

  if (relativePath.includes('04-caso-complejo-cuasiidentificadores')) {
    assert(hasType(result, 'SOSPECHOSO', 3), 'Caso 04: debe marcar cuasi-identificadores criticos');
    assert(!includesInsensitive(result.processed, 'síndrome de Wolfram'), 'Caso 04: enfermedad rara debe generalizarse');
    assert(!includesInsensitive(result.processed, '25147896K'), 'Caso 04: DNI debe anonimizarse');
    assert(!includesInsensitive(result.processed, '2023-456789'), 'Caso 04: NHC debe anonimizarse');
    assert(!includesInsensitive(result.processed, '978-123-456'), 'Caso 04: telefono debe anonimizarse');
  }
}

// Validación de modo estricto sobre caso complejo
{
  const strictPath = path.join(repoRoot, 'ejemplos/04-caso-complejo-cuasiidentificadores.json');
  const strictRaw = JSON.parse(await fs.readFile(strictPath, 'utf8'));
  const strictResult = PrivacyProcessor.process(strictRaw.texto, { modoEstricto: true });
  assert(includesInsensitive(strictResult.processed, '[dato_sensible]'), 'Modo estricto: debe suprimir cuasi-identificadores con marcador');
  assert(includesInsensitive(strictResult.processed, 'Zona Geografica'), 'Modo estricto: debe generalizar ubicaciones');
  assert(includesInsensitive(strictResult.processed, 'Centro Sanitario'), 'Modo estricto: debe generalizar hospitales');
}

// Cobertura adicional de diccionarios y detectores
{
  const text = [
    'Paciente derivado al Hospital La Paz para valoración.',
    'Reside en barrio de Triana, Sevilla.',
    'CIP: ABC1234567890',
    'SIP: 123456789012'
  ].join(' ');

  const result = PrivacyProcessor.process(text);
  assert(hasSubtype(result, 'UBICACION', 'hospital', 1), 'Cobertura hospitales: debe detectar Hospital La Paz');
  assert(hasSubtype(result, 'UBICACION', 'barrio', 1), 'Cobertura barrios: debe detectar barrio contextual');
  assert(hasSubtype(result, 'IDENTIFICADOR', 'tarjeta_sanitaria', 2), 'Cobertura identificadores: debe detectar CIP/SIP');
  assert(!includesInsensitive(result.processed, 'ABC1234567890'), 'CIP debe anonimizarse');
  assert(!includesInsensitive(result.processed, '123456789012'), 'SIP debe anonimizarse');
}

console.log('OK: smoke anonimization');
for (const item of reports) {
  console.log(`- ${item.file} -> entidades: ${item.entities}, tipos: ${JSON.stringify(item.byType)}`);
}
