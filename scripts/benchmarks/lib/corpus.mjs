/**
 * Deterministic synthetic clinical corpus generator for the repeatable
 * performance benchmark (Work Order T22 #26, SPEC_V4_QUALITY_SECURITY_DEPLOY
 * §8 "Maintain repeatable synthetic performance scenarios").
 *
 * Every byte is synthetic and seeded: no real PHI ever enters a benchmark.
 * The generator is a pure function of (seed, size), so the same seed always
 * produces the same text (deterministic oracle) and the engine sees a stable
 * mix of recognisable privacy-relevant patterns plus filler clinical prose.
 *
 * The seeded PRNG is mulberry32 — small, fast, and fully deterministic across
 * runs and Node versions.
 */

/** Deterministic 32-bit PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = [
  'María', 'Carmen', 'Josefa', 'Ana', 'Lucía', 'Pedro', 'Manuel', 'Javier',
  'Laura', 'Marta', 'David', 'Alejandro', 'Pablo', 'Sergio', 'Irene', 'Claudia',
];
const APELLIDOS = [
  'García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández',
  'Ruiz', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez',
];
const CIUDADES = [
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Bilbao', 'Málaga', 'Murcia',
];
const HOSPITALES = [
  'Hospital Clínico San Carlos', 'Hospital Universitario La Paz',
  'Hospital Virgen del Rocío', 'Hospital Vall d\'Hebron',
];
const PROFESIONALES = [
  'Dr.', 'Dra.', 'Drª.', 'Enfermero', 'Enfermera',
];

/**
 * Build one synthetic clinical note paragraph. Pure function of the PRNG.
 */
function clinicalSentence(rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const nombre = pick(NOMBRES);
  const apellido = pick(APELLIDOS);
  const apellido2 = pick(APELLIDOS);
  const ciudad = pick(CIUDADES);
  const hospital = pick(HOSPITALES);
  const profesional = pick(PROFESIONALES);
  const dia = 1 + Math.floor(rand() * 28);
  const mes = 1 + Math.floor(rand() * 12);
  const anio = 2015 + Math.floor(rand() * 10);
  const shapes = [
    `El ${profesional} ${nombre} ${apellido} atendió al paciente en el ${hospital} de ${ciudad}.`,
    `La paciente ${nombre} ${apellido} ${apellido2} ingresó el ${dia}/${mes}/${anio} por control rutinario.`,
    `Informe emitido en ${ciudad} a ${dia}/${mes}/${anio} por el servicio de urgencias.`,
    `El ${profesional} ${apellido} ${apellido2} recomendó analítica de control en el ${hospital}.`,
    `Contacto: ${nombre} ${apellido}, ${ciudad}, teléfono registrado en la historia clínica.`,
    `Seguimiento ambulatorio solicitado el ${dia}/${mes}/${anio} por ${profesional} ${nombre} ${apellido}.`,
  ];
  return pick(shapes);
}

/** Filler prose without recognisable privacy patterns, to reach the target size. */
function fillerSentence(rand) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const topics = [
    'La analítica muestra valores dentro de rangos habituales para su grupo de edad.',
    'Se recomienda mantener la hidratación y reposo relativo durante los próximos días.',
    'El tratamiento actual continúa según pauta establecida en informes previos.',
    'Control de constantes vitales dentro de parámetros estables durante el ingreso.',
    'Se solicita resonancia magnética de control para valoración evolutiva.',
    'La evolución postoperatoria es favorable sin complicaciones agudas.',
  ];
  return pick(topics);
}

/**
 * Generate ONE deterministic synthetic document of approximately `targetSize`
 * UTF-16 code units. Pure function of (seed, targetSize): same inputs →
 * byte-identical output.
 */
export function generateSyntheticDocument(seed, targetSize) {
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  if (!Number.isInteger(targetSize) || targetSize <= 0) {
    throw new Error('targetSize must be a positive integer');
  }
  const rand = mulberry32(seed);
  const parts = [];
  let length = 0;
  let i = 0;
  while (length < targetSize) {
    // ~1 clinical sentence per 3 filler sentences keeps the recogniser load
    // realistic (sparse entities, mostly plain prose) at every size tier.
    const sentence = i % 3 === 0 ? clinicalSentence(rand) : fillerSentence(rand);
    parts.push(sentence);
    length += sentence.length + 1;
    i += 1;
  }
  // The exact requested size is produced by slicing; a partial final sentence
  // is benchmark filler, not user content, so no "silent truncation" privacy
  // concern applies to a synthetic benchmark corpus.
  return parts.join(' ').slice(0, targetSize);
}

/**
 * Size tiers of SPEC_V4_QUALITY_SECURITY_DEPLOY §8. 1 MB is the supported
 * maximum authority (`app-v4/src/engine/input-limits.ts`).
 */
export const SIZE_TIERS = [
  { name: '10KB', targetSize: 10 * 1024 },
  { name: '100KB', targetSize: 100 * 1024 },
  { name: '500KB', targetSize: 500 * 1024 },
  { name: '1MB', targetSize: 1024 * 1024 },
];

/** Document-count tiers of SPEC §8 ("1 / 10 / 50 document jobs where supported"). */
export const DOC_JOB_TIERS = [
  { name: '1-doc', documents: 1, docSize: 20 * 1024 },
  { name: '10-docs', documents: 10, docSize: 20 * 1024 },
  { name: '50-docs', documents: 50, docSize: 20 * 1024 },
];

export const REPORT_SCHEMA = 'laboratorio.engine-bench.report/v1';
export const ENGINE_REVISION_HINT = 'js/modular-processor.js PrivacyProcessor';
