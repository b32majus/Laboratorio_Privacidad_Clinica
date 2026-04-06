// ScoringEngine - Motor de puntuación para detección de entidades
// Calcula confianza basada en múltiples factores contextuales

/**
 * Motor de scoring para mejorar la precisión de detección
 */
export const ScoringEngine = {
    // Umbrales de confianza
    THRESHOLD_HIGH: 0.8,    // Anonimizar siempre
    THRESHOLD_MEDIUM: 0.6,  // Anonimizar con precaución
    THRESHOLD_LOW: 0.4,     // Revisar manualmente

    /**
     * Calcula score para un nombre de persona
     * @param {Object} candidato - {text, palabras, contextoAntes, contextoDespues}
     * @param {Object} dictionaries - Diccionarios de nombres/apellidos
     * @param {Function} normalizeText - Función de normalización
     * @returns {Object} - {score, factores, recomendacion}
     */
    calcularScoreNombre(candidato, dictionaries, normalizeText) {
        let score = 0;
        const factores = [];

        const { text, palabras, contextoAntes = '', contextoDespues = '' } = candidato;
        const palabrasArray = palabras || text.split(/\s+/);

        // Factor 1: Primera palabra es nombre conocido (+0.3)
        if (this.esNombreConocido(palabrasArray[0], dictionaries, normalizeText)) {
            score += 0.3;
            factores.push({ factor: 'nombre_conocido', valor: 0.3 });
        }

        // Factor 2: Tiene apellido conocido (+0.25)
        if (this.tieneApellidoConocido(palabrasArray, dictionaries, normalizeText)) {
            score += 0.25;
            factores.push({ factor: 'apellido_conocido', valor: 0.25 });
        }

        // Factor 3: Patrón Nombre + Apellido(s) (+0.2)
        if (this.esPatronNombreApellido(palabrasArray)) {
            score += 0.2;
            factores.push({ factor: 'patron_nombre_apellido', valor: 0.2 });
        }

        // Factor 4: Contexto profesional antes (Dr., Dra., etc.) (+0.3)
        if (this.tieneContextoProfesional(contextoAntes)) {
            score += 0.3;
            factores.push({ factor: 'contexto_profesional', valor: 0.3 });
        }

        // Factor 5: Contexto de paciente antes (+0.25)
        if (this.tieneContextoPaciente(contextoAntes)) {
            score += 0.25;
            factores.push({ factor: 'contexto_paciente', valor: 0.25 });
        }

        // Factor 6: Etiqueta antes (Nombre:, Paciente:, etc.) (+0.35)
        if (this.tieneEtiqueta(contextoAntes)) {
            score += 0.35;
            factores.push({ factor: 'etiqueta', valor: 0.35 });
        }

        // Penalizaciones
        // Penalización: Palabra común/excluida (-0.3)
        if (this.esPalabraExcluida(palabrasArray[0])) {
            score -= 0.3;
            factores.push({ factor: 'palabra_excluida', valor: -0.3 });
        }

        // Penalización: Muy corto (1 palabra sin contexto) (-0.2)
        if (palabrasArray.length === 1 && !this.tieneContextoProfesional(contextoAntes) && !this.tieneEtiqueta(contextoAntes)) {
            score -= 0.2;
            factores.push({ factor: 'sin_contexto_corto', valor: -0.2 });
        }

        // Normalizar score entre 0 y 1
        score = Math.max(0, Math.min(1, score));

        return {
            score,
            factores,
            recomendacion: this.getRecomendacion(score)
        };
    },

    /**
     * Calcula score para un profesional sanitario
     * @param {Object} candidato
     * @param {Object} dictionaries
     * @param {Function} normalizeText
     * @returns {Object}
     */
    calcularScoreProfesional(candidato, dictionaries, normalizeText) {
        let score = 0.3; // Base: tiene prefijo Dr./Dra./etc.
        const factores = [{ factor: 'prefijo_profesional', valor: 0.3 }];

        const { palabras } = candidato;

        // +0.3 si nombre está en diccionario
        if (palabras.length > 0 && this.esNombreConocido(palabras[0], dictionaries, normalizeText)) {
            score += 0.3;
            factores.push({ factor: 'nombre_conocido', valor: 0.3 });
        }

        // +0.25 si tiene apellido conocido
        if (this.tieneApellidoConocido(palabras, dictionaries, normalizeText)) {
            score += 0.25;
            factores.push({ factor: 'apellido_conocido', valor: 0.25 });
        }

        // +0.15 si tiene 2+ palabras (nombre + apellido)
        if (palabras.length >= 2) {
            score += 0.15;
            factores.push({ factor: 'nombre_completo', valor: 0.15 });
        }

        // Penalización si primera palabra es especialidad médica (-0.4)
        if (this.esEspecialidadMedica(palabras[0])) {
            score -= 0.4;
            factores.push({ factor: 'es_especialidad', valor: -0.4 });
        }

        score = Math.max(0, Math.min(1, score));

        return {
            score,
            factores,
            recomendacion: this.getRecomendacion(score)
        };
    },

    /**
     * Calcula score para ubicación
     * @param {Object} candidato
     * @param {string[]} ciudadesList
     * @param {Function} normalizeText
     * @returns {Object}
     */
    calcularScoreUbicacion(candidato, ciudadesList, normalizeText) {
        let score = 0;
        const factores = [];

        const { text, contextoAntes = '', subtype } = candidato;

        // Factor base por subtipo
        if (subtype === 'hospital') {
            score += 0.5;
            factores.push({ factor: 'tipo_hospital', valor: 0.5 });
        } else if (subtype === 'direccion') {
            score += 0.5;
            factores.push({ factor: 'tipo_direccion', valor: 0.5 });
        } else if (subtype === 'ciudad') {
            score += 0.4;
            factores.push({ factor: 'tipo_ciudad', valor: 0.4 });
        } else if (subtype === 'contexto') {
            score += 0.35;
            factores.push({ factor: 'tipo_contexto', valor: 0.35 });
        }

        // +0.3 si está en lista de ciudades
        if (ciudadesList && this.esCiudadConocida(text, ciudadesList, normalizeText)) {
            score += 0.3;
            factores.push({ factor: 'ciudad_conocida', valor: 0.3 });
        }

        // +0.2 si tiene contexto geográfico
        if (this.tieneContextoGeografico(contextoAntes)) {
            score += 0.2;
            factores.push({ factor: 'contexto_geografico', valor: 0.2 });
        }

        // +0.3 si tiene código postal o número
        if (/\d{5}/.test(text) || /n[º°]?\s*\d+/.test(text)) {
            score += 0.3;
            factores.push({ factor: 'tiene_numero', valor: 0.3 });
        }

        score = Math.max(0, Math.min(1, score));

        return {
            score,
            factores,
            recomendacion: this.getRecomendacion(score)
        };
    },

    // === Métodos de verificación ===

    /**
     * Verifica si una palabra es un nombre conocido
     */
    esNombreConocido(palabra, dictionaries, normalizeText) {
        if (!palabra || !dictionaries) return false;

        const normalized = normalizeText ? normalizeText(palabra) : palabra.toLowerCase();
        const { nombresMujer = [], nombresHombre = [] } = dictionaries;

        const todosNombres = [...nombresMujer, ...nombresHombre];
        return todosNombres.some(n => {
            const normalizedDict = normalizeText ? normalizeText(n) : n.toLowerCase();
            return normalizedDict === normalized;
        });
    },

    /**
     * Verifica si tiene apellido conocido
     */
    tieneApellidoConocido(palabras, dictionaries, normalizeText) {
        if (!palabras || palabras.length < 2 || !dictionaries) return false;

        const { apellidos = [] } = dictionaries;
        const apellidosNorm = new Set(apellidos.map(a =>
            normalizeText ? normalizeText(a) : a.toLowerCase()
        ));

        // Buscar en todas las palabras excepto la primera (que sería el nombre)
        for (let i = 1; i < palabras.length; i++) {
            const normalized = normalizeText ? normalizeText(palabras[i]) : palabras[i].toLowerCase();
            if (apellidosNorm.has(normalized)) {
                return true;
            }
        }

        return false;
    },

    /**
     * Verifica patrón Nombre + Apellido(s)
     */
    esPatronNombreApellido(palabras) {
        if (!palabras || palabras.length < 2) return false;

        // Verificar capitalización: Primera letra mayúscula
        const todasCapitalizadas = palabras.every(p =>
            /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(p)
        );

        return todasCapitalizadas && palabras.length >= 2 && palabras.length <= 4;
    },

    /**
     * Verifica contexto profesional (Dr., Dra., etc.)
     */
    tieneContextoProfesional(contexto) {
        if (!contexto) return false;
        const prefijos = /(?:Dr\.|Dra\.|Doctor|Doctora|Enfermero|Enfermera|Facultativo|Psic[oó]log[oa]|Fisioterapeuta)\s*$/i;
        return prefijos.test(contexto);
    },

    /**
     * Verifica contexto de paciente
     */
    tieneContextoPaciente(contexto) {
        if (!contexto) return false;
        const patrones = /(?:paciente|enferm[oa]|atendid[oa]|ingresad[oa]|derivad[oa])\s+(?:es\s+|se\s+llama\s+)?$/i;
        return patrones.test(contexto);
    },

    /**
     * Verifica si hay una etiqueta antes
     */
    tieneEtiqueta(contexto) {
        if (!contexto) return false;
        const etiquetas = /(?:Nombre|Paciente|Contacto|Familiar|Acompañante|Tutor)\s*:\s*$/i;
        return etiquetas.test(contexto);
    },

    /**
     * Verifica contexto geográfico
     */
    tieneContextoGeografico(contexto) {
        if (!contexto) return false;
        const patrones = /(?:vive|reside|natural|procedente|domiciliad[oa]|vecin[oa])\s+(?:en|de)\s*$/i;
        return patrones.test(contexto);
    },

    /**
     * Verifica si una ciudad está en la lista
     */
    esCiudadConocida(text, ciudadesList, normalizeText) {
        if (!text || !ciudadesList) return false;
        const normalized = normalizeText ? normalizeText(text) : text.toLowerCase();
        return ciudadesList.some(c => {
            const normCiudad = normalizeText ? normalizeText(c) : c.toLowerCase();
            return normCiudad === normalized || text.toLowerCase().includes(c.toLowerCase());
        });
    },

    /**
     * Verifica si es palabra excluida
     */
    esPalabraExcluida(palabra) {
        if (!palabra) return false;
        const excluidas = [
            'que', 'con', 'sin', 'por', 'para', 'del', 'las', 'los', 'una', 'uno',
            'estable', 'consciente', 'orientado', 'orientada', 'presenta', 'muestra',
            'tratamiento', 'medicación', 'diagnóstico', 'pronóstico', 'evolución',
            'valoración', 'evaluación', 'protocolo', 'procedimiento', 'intervención'
        ];
        return excluidas.includes(palabra.toLowerCase());
    },

    /**
     * Verifica si es especialidad médica
     */
    esEspecialidadMedica(palabra) {
        if (!palabra) return false;
        const especialidades = [
            'cardiología', 'dermatología', 'pediatría', 'cirugía', 'medicina',
            'oncología', 'neurología', 'psiquiatría', 'traumatología', 'ginecología',
            'urología', 'oftalmología', 'neumología', 'digestivo', 'endocrinología',
            'reumatología', 'nefrología', 'hematología', 'geriatría', 'radiología',
            'anestesiología', 'cardiologia', 'dermatologia', 'pediatria', 'cirugia',
            'oncologia', 'neurologia', 'psiquiatria', 'traumatologia', 'ginecologia'
        ];
        return especialidades.includes(palabra.toLowerCase());
    },

    /**
     * Obtiene recomendación basada en score
     */
    getRecomendacion(score) {
        if (score >= this.THRESHOLD_HIGH) {
            return 'ANONIMIZAR';
        } else if (score >= this.THRESHOLD_MEDIUM) {
            return 'ANONIMIZAR_CON_REVISION';
        } else if (score >= this.THRESHOLD_LOW) {
            return 'REVISION_MANUAL';
        } else {
            return 'NO_ANONIMIZAR';
        }
    },

    /**
     * Aplica scoring a una lista de entidades
     * @param {Array} entities - Entidades detectadas
     * @param {Object} dictionaries - Diccionarios
     * @param {string} text - Texto original
     * @param {Function} normalizeText - Función de normalización
     * @returns {Array} - Entidades con scores actualizados
     */
    aplicarScoring(entities, dictionaries, text, normalizeText) {
        return entities.map(entity => {
            const contextoAntes = this.extraerContextoAntes(text, entity.position.start, 50);
            const contextoDespues = this.extraerContextoDespues(text, entity.position.end, 30);

            let scoring;

            // UBICACIONES y FAMILIARES: mantener confianza original (ya tienen contexto claro)
            if (entity.type === 'UBICACION') {
                scoring = {
                    score: entity.confidence,
                    factores: [{ factor: 'ubicacion_detectada', valor: entity.confidence }],
                    recomendacion: 'ANONIMIZAR'
                };
            } else if (entity.type === 'NOMBRE' && entity.subtype === 'familiar') {
                scoring = {
                    score: entity.confidence,
                    factores: [{ factor: 'familiar_detectado', valor: entity.confidence }],
                    recomendacion: 'ANONIMIZAR'
                };
            } else if (entity.type === 'NOMBRE') {
                const candidato = {
                    text: entity.text,
                    palabras: entity.text.split(/\s+/),
                    contextoAntes,
                    contextoDespues
                };

                if (entity.subtype === 'profesional') {
                    scoring = this.calcularScoreProfesional(candidato, dictionaries, normalizeText);
                } else {
                    scoring = this.calcularScoreNombre(candidato, dictionaries, normalizeText);
                }
            } else {
                // Identificadores y fechas mantienen su confianza original
                scoring = { score: entity.confidence, factores: [], recomendacion: 'ANONIMIZAR' };
            }

            return {
                ...entity,
                confidence: scoring.score,
                scoring: {
                    factores: scoring.factores,
                    recomendacion: scoring.recomendacion
                }
            };
        });
    },

    /**
     * Extrae contexto antes de una posición
     */
    extraerContextoAntes(text, position, length) {
        const start = Math.max(0, position - length);
        return text.substring(start, position);
    },

    /**
     * Extrae contexto después de una posición
     */
    extraerContextoDespues(text, position, length) {
        const end = Math.min(text.length, position + length);
        return text.substring(position, end);
    },

    /**
     * Filtra entidades por umbral de confianza
     * @param {Array} entities - Entidades con scoring
     * @param {number} threshold - Umbral mínimo (default: THRESHOLD_MEDIUM)
     * @returns {Array} - Entidades filtradas
     */
    filtrarPorUmbral(entities, threshold = null) {
        const umbral = threshold || this.THRESHOLD_MEDIUM;
        return entities.filter(e => e.confidence >= umbral);
    }
};

export default ScoringEngine;
