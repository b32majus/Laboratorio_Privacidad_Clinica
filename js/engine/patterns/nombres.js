import { NOMBRES_MUJER } from '../dictionaries/nombres-mujer.js';
import { NOMBRES_HOMBRE } from '../dictionaries/nombres-hombre.js';
import { APELLIDOS } from '../dictionaries/apellidos.js';
import { PREFIJOS, INDICADORES_PACIENTE } from '../dictionaries/prefijos.js';

// Convertir listas a Set para búsqueda O(1)
const NOMBRES_SET = new Set([...NOMBRES_MUJER, ...NOMBRES_HOMBRE].map(n => n.toUpperCase()));
const APELLIDOS_SET = new Set(APELLIDOS.map(a => a.toUpperCase()));

export const nombresPattern = {
    name: 'nombres',

    // Expresiones para buscar candidatos
    patterns: {
        // Después de prefijos (Dr. ***, D. ***) - Case sensitive para el nombre
        conPrefijo: new RegExp(`(?:${PREFIJOS.join('|').replace(/\./g, '\\.')})\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})`, 'g'),

        // Después de indicadores (paciente ***) - Case sensitive para el nombre, insensitive para indicador
        conIndicador: new RegExp(`(?:${INDICADORES_PACIENTE.map(i => `[${i[0].toUpperCase()}${i[0].toLowerCase()}]${i.slice(1)}`).join('|')})\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})`, 'g'),

        // Secuencias de palabras Capitalizadas (heurístico)
        capitalizados: /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})\b/g
    },

    exclusions: [
        /Hospital/i, /Clínica/i, /Centro/i, /Servicio/i, /Unidad/i, /Departamento/i,
        /Síndrome/i, /Enfermedad/i, /Prueba/i, /Test/i, /Calle/i, /Avenida/i, /Plaza/i
    ],

    detect(text) {
        const results = [];
        const usedRanges = new Set();

        // 1. Detección por contexto (Prefijos e Indicadores) - Alta confianza
        this.detectContextual(text, this.patterns.conPrefijo, results, usedRanges, 0.95);
        this.detectContextual(text, this.patterns.conIndicador, results, usedRanges, 0.90);

        // 2. Detección por diccionario en palabras capitalizadas - Media confianza
        this.detectDictionary(text, results, usedRanges);

        return results;
    },

    detectContextual(text, regex, results, usedRanges, confidence) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const nameGroup = match[1];
            const fullMatch = match[0];
            const start = match.index + fullMatch.indexOf(nameGroup);
            const end = start + nameGroup.length;

            if (this.isRangeFree(usedRanges, start, end) && !this.isExcluded(nameGroup)) {
                this.addResult(results, nameGroup, start, end, confidence);
                this.markRange(usedRanges, start, end);
            }
        }
    },

    detectDictionary(text, results, usedRanges) {
        const regex = this.patterns.capitalizados;
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const candidate = match[0];
            const start = match.index;
            const end = start + candidate.length;

            if (!this.isRangeFree(usedRanges, start, end)) continue;
            if (this.isExcluded(candidate)) continue;

            const words = candidate.split(/\s+/);
            const score = this.calculateScore(words);

            // Si tiene buena puntuación de diccionario, lo añadimos
            if (score > 0.5) {
                this.addResult(results, candidate, start, end, 0.7 + (score * 0.2));
                this.markRange(usedRanges, start, end);
            }
        }
    },

    calculateScore(words) {
        let matchesName = 0;
        let matchesSurname = 0;

        if (words.length === 0) return 0;

        // Analizar primera palabra (posible nombre)
        if (NOMBRES_SET.has(words[0].toUpperCase())) matchesName++;

        // Analizar resto (posibles apellidos o segundo nombre)
        for (let i = 1; i < words.length; i++) {
            const wordUpper = words[i].toUpperCase();
            if (APELLIDOS_SET.has(wordUpper)) matchesSurname++;
            else if (NOMBRES_SET.has(wordUpper)) matchesName++; // Nombre compuesto
        }

        const totalWords = words.length;
        // Heurístico simple: al menos un nombre o apellido conocido
        if (matchesName === 0 && matchesSurname === 0) return 0;

        return (matchesName + matchesSurname) / totalWords;
    },

    isExcluded(text) {
        return this.exclusions.some(regex => regex.test(text));
    },

    isRangeFree(usedRanges, start, end) {
        for (const range of usedRanges) {
            // Formato string "start-end"
            const [rStart, rEnd] = range.split('-').map(Number);
            if (start < rEnd && end > rStart) return false; // Overlap
        }
        return true;
    },

    markRange(usedRanges, start, end) {
        usedRanges.add(`${start}-${end}`);
    },

    addResult(results, text, start, end, confidence) {
        results.push({
            type: 'NOMBRE',
            text: text,
            original: text,
            position: { start, end },
            confidence
        });
    }
};
