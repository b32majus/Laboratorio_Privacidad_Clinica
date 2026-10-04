// Detector de Cuasi-identificadores - señales de alto riesgo de reidentificación.

export function detectCuasiIdentificadores(text) {
    const entities = [];
    let match;
    const seen = new Set();

    const addEntity = (subtype, value, start, confidence = 0.85) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        const end = start + normalized.length;
        const key = `${subtype}:${start}:${end}:${normalized.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        entities.push({
            type: 'SOSPECHOSO',
            subtype,
            text: normalized,
            original: normalized,
            position: { start, end },
            confidence
        });
    };

    // REC-01 correction: the singular-cue alternatives that begin with an
    // accented letter ("único paciente", "único caso") were silently missed
    // because an ASCII `\b` never matches before `ú`/`Ú`. Use an explicit
    // letter boundary so a sentence-initial capitalized accented cue is
    // detected, while ordinary words that merely start with an accented
    // capital ("Ácido úrico") stay untouched.
    const singularidadRegex = /(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(?:únic[oa]s?\s+pacientes?|caso\s+[úu]nico|único\s+caso)(?![A-Za-zÁÉÍÓÚÑáéíóúñ])/gi;
    while ((match = singularidadRegex.exec(text)) !== null) {
        addEntity('singularidad', match[0], match.index, 0.90);
    }

    // REC-01 WU-B: the cue word is case-insensitive (sentence-initial
    // "Síndrome de X" / "Enfermedad de X" are ordinary Spanish), while the
    // proper-noun slot after "de" stays uppercase-anchored so ordinary terms
    // ("síndrome de abstinencia", "enfermedad de transmisión sexual") are not
    // misread as eponym rare diseases.
    const enfermedadRaraRegex = /\b(?:[sS][ií]ndrome|[eE]nfermedad)\s+de\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2}\b/g;
    while ((match = enfermedadRaraRegex.exec(text)) !== null) {
        addEntity('enfermedad_rara', match[0], match.index, 0.88);
    }

    const cargoPublicoRegex = /\b(?:alcalde|alcaldesa|concejal|concejala|diputad[oa]|senador(?:a)?|juez|magistrad[oa]|delegad[oa])(?:\s+del?\s+(?:municipio|ayuntamiento|consistorio|distrito|barrio|partido))?\b/gi;
    while ((match = cargoPublicoRegex.exec(text)) !== null) {
        addEntity('cargo_publico', match[0], match.index, 0.86);
    }

    const parentescoEspecialRegex = /\b(?:herman[oa]\s+gemel[oa]|gemel[oa]\s+de|hij[oa]\s+[úu]nic[oa])\b/gi;
    while ((match = parentescoEspecialRegex.exec(text)) !== null) {
        addEntity('parentesco_especial', match[0], match.index, 0.86);
    }

    const profesionRegex = /\b(?:Profesi[oó]n|Ocupaci[oó]n)\s*:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ][^\n\r,.]{4,80})/gi;
    while ((match = profesionRegex.exec(text)) !== null) {
        const profesion = match[1].trim();
        const startPos = match.index + match[0].lastIndexOf(profesion);
        addEntity('profesion_especifica', profesion, startPos, 0.75);
    }

    return entities;
}

export default { detectCuasiIdentificadores };
