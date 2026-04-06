// HeuristicasContextuales - Análisis contextual avanzado
// Mejora la detección mediante análisis del contexto circundante

/**
 * Heurísticas contextuales para mejorar precisión
 */
export const HeuristicasContextuales = {

    // === Patrones de contexto ===

    /**
     * Patrones que indican alta probabilidad de nombre de persona
     */
    CONTEXTOS_NOMBRE_POSITIVOS: [
        // Antes del nombre
        { pattern: /\bpaciente\s+(?:es\s+|se\s+llama\s+)?$/i, weight: 0.9 },
        { pattern: /\bDr\.\s*$/i, weight: 0.95 },
        { pattern: /\bDra\.\s*$/i, weight: 0.95 },
        { pattern: /\bDoctor\s+$/i, weight: 0.9 },
        { pattern: /\bDoctora\s+$/i, weight: 0.9 },
        { pattern: /\benfermero\s+$/i, weight: 0.85 },
        { pattern: /\benfermera\s+$/i, weight: 0.85 },
        { pattern: /\bNombre\s*:\s*$/i, weight: 0.95 },
        { pattern: /\bPaciente\s*:\s*$/i, weight: 0.95 },
        { pattern: /\bFamiliar\s*:\s*$/i, weight: 0.9 },
        { pattern: /\bContacto\s*:\s*$/i, weight: 0.9 },
        { pattern: /\bfirmado\s+por\s+$/i, weight: 0.85 },
        { pattern: /\batendido\s+por\s+$/i, weight: 0.85 },
        { pattern: /\bvalorado\s+por\s+$/i, weight: 0.85 },
        { pattern: /\bderivado\s+(?:a|por)\s+$/i, weight: 0.8 },
        { pattern: /\brealizado\s+por\s+$/i, weight: 0.85 },
        { pattern: /\bsupervisado\s+por\s+$/i, weight: 0.85 }
    ],

    /**
     * Patrones que indican baja probabilidad de nombre
     */
    CONTEXTOS_NOMBRE_NEGATIVOS: [
        { pattern: /\bdiagnóstico\s+de\s*$/i, weight: -0.4 },
        { pattern: /\btratamiento\s+(?:de|con)\s*$/i, weight: -0.4 },
        { pattern: /\bmedicación\s*$/i, weight: -0.3 },
        { pattern: /\bprotocolo\s+$/i, weight: -0.3 },
        { pattern: /\bsíndrome\s+(?:de|del)\s*$/i, weight: -0.5 },
        { pattern: /\benfermedad\s+(?:de|del)\s*$/i, weight: -0.5 },
        { pattern: /\btécnica\s+(?:de|del)\s*$/i, weight: -0.4 },
        { pattern: /\bprueba\s+(?:de|del)\s*$/i, weight: -0.3 },
        { pattern: /\bescala\s+(?:de|del)\s*$/i, weight: -0.4 },
        { pattern: /\btest\s+(?:de|del)\s*$/i, weight: -0.4 },
        { pattern: /\bíndice\s+(?:de|del)\s*$/i, weight: -0.4 },
        { pattern: /\bhospital\s+$/i, weight: -0.3 }, // El nombre del hospital, no persona
        { pattern: /\bclínica\s+$/i, weight: -0.3 }
    ],

    /**
     * Palabras que después del candidato indican que NO es un nombre
     */
    PALABRAS_DESPUES_NEGATIVAS: [
        'mg', 'ml', 'gr', 'kg', 'mcg', 'UI', // Unidades de medicación
        'comprimidos', 'cápsulas', 'tabletas', 'gotas', 'ampollas',
        'cada', 'horas', 'días', 'veces', // Posología
        'positivo', 'negativo', // Resultados
        'elevado', 'elevada', 'bajo', 'baja', 'normal', // Valores
        'test', 'escala', 'índice', 'puntuación', // Pruebas
        'grado', 'estadio', 'tipo', 'clase', // Clasificaciones
        'síndrome', 'enfermedad', 'patología', 'trastorno' // Enfermedades
    ],

    /**
     * Nombres de síndromes/enfermedades epónimos comunes (NO anonimizar)
     */
    EPONIMOS_MEDICOS: [
        'alzheimer', 'parkinson', 'crohn', 'hodgkin', 'kawasaki',
        'hashimoto', 'graves', 'addison', 'cushing', 'wilson',
        'huntington', 'meniere', 'raynaud', 'sjogren', 'behcet',
        'marfan', 'ehlers', 'danlos', 'guillain', 'barre',
        'down', 'turner', 'klinefelter', 'edwards', 'patau',
        'asperger', 'rett', 'angelman', 'prader', 'willi',
        'bell', 'basedow', 'paget', 'dupuytren', 'barret',
        'zollinger', 'ellison', 'conn', 'wernicke', 'korsakoff'
    ],

    /**
     * Analiza el contexto y devuelve ajuste de peso
     * @param {string} contextoAntes - Texto antes del candidato
     * @param {string} contextoDespues - Texto después del candidato
     * @returns {Object} - {ajuste, razon}
     */
    analizarContexto(contextoAntes, contextoDespues) {
        let ajuste = 0;
        const razones = [];

        // Verificar patrones positivos
        for (const { pattern, weight } of this.CONTEXTOS_NOMBRE_POSITIVOS) {
            if (pattern.test(contextoAntes)) {
                ajuste += weight;
                razones.push({ tipo: 'positivo', patron: pattern.source, peso: weight });
                break; // Solo contar el mejor match positivo
            }
        }

        // Verificar patrones negativos
        for (const { pattern, weight } of this.CONTEXTOS_NOMBRE_NEGATIVOS) {
            if (pattern.test(contextoAntes)) {
                ajuste += weight; // weight ya es negativo
                razones.push({ tipo: 'negativo', patron: pattern.source, peso: weight });
                break;
            }
        }

        // Verificar palabras después
        const primeraPalabraDespues = contextoDespues.trim().split(/\s+/)[0]?.toLowerCase();
        if (primeraPalabraDespues && this.PALABRAS_DESPUES_NEGATIVAS.includes(primeraPalabraDespues)) {
            ajuste -= 0.3;
            razones.push({ tipo: 'palabra_despues', palabra: primeraPalabraDespues, peso: -0.3 });
        }

        return { ajuste, razones };
    },

    /**
     * Verifica si un candidato es un epónimo médico
     * @param {string} texto - Texto a verificar
     * @returns {boolean}
     */
    esEponimoMedico(texto) {
        if (!texto) return false;
        const textoLower = texto.toLowerCase();
        return this.EPONIMOS_MEDICOS.some(eponimo => textoLower.includes(eponimo));
    },

    /**
     * Detecta si el texto está en contexto de medicación
     * @param {string} contextoCompleto - Texto circundante
     * @returns {boolean}
     */
    esContextoMedicacion(contextoCompleto) {
        const patronesMedicacion = [
            /\d+\s*mg/i,
            /\d+\s*ml/i,
            /cada\s+\d+\s+horas/i,
            /\d+\s+veces\s+al\s+día/i,
            /pauta\s*:/i,
            /posología\s*:/i,
            /tratamiento\s*:/i
        ];

        return patronesMedicacion.some(p => p.test(contextoCompleto));
    },

    /**
     * Detecta si el candidato parece ser un nombre compuesto
     * @param {string} texto - Texto candidato
     * @returns {Object} - {esCompuesto, tipo}
     */
    detectarNombreCompuesto(texto) {
        const compuestosMujer = [
            /^María\s+(del\s+)?(Carmen|Pilar|Teresa|Ángeles|Angeles|Luisa|José|Rosa|Luz|Dolores|Mercedes)/i,
            /^Ana\s+(María|Isabel|Belén|Belen|Rosa|Lucía|Lucia)/i,
            /^María\s+de\s+los\s+(Ángeles|Angeles|Dolores|Remedios)/i
        ];

        const compuestosHombre = [
            /^José\s+(María|Luis|Manuel|Antonio|Miguel|Ángel|Angel|Francisco|Ramón|Ramon)/i,
            /^Juan\s+(Carlos|José|Antonio|Manuel|Miguel|Pablo|Francisco)/i,
            /^Francisco\s+(Javier|José|Manuel)/i,
            /^Miguel\s+(Ángel|Angel)/i
        ];

        for (const patron of compuestosMujer) {
            if (patron.test(texto)) {
                return { esCompuesto: true, tipo: 'femenino' };
            }
        }

        for (const patron of compuestosHombre) {
            if (patron.test(texto)) {
                return { esCompuesto: true, tipo: 'masculino' };
            }
        }

        return { esCompuesto: false, tipo: null };
    },

    /**
     * Detecta abreviaturas de nombres
     * @param {string} texto
     * @returns {Object} - {tieneAbreviatura, expansion}
     */
    detectarAbreviatura(texto) {
        const abreviaturas = {
            'Mª': 'María',
            'M.ª': 'María',
            'Fco.': 'Francisco',
            'Fco': 'Francisco',
            'Jse.': 'José',
            'Jse': 'José',
            'Ant.': 'Antonio',
            'Ant': 'Antonio',
            'Mig.': 'Miguel',
            'Fdo.': 'Fernando',
            'Rdo.': 'Ricardo',
            'Crmen': 'Carmen',
            'Cmen': 'Carmen'
        };

        for (const [abrev, expansion] of Object.entries(abreviaturas)) {
            if (texto.includes(abrev)) {
                return { tieneAbreviatura: true, expansion };
            }
        }

        return { tieneAbreviatura: false, expansion: null };
    },

    /**
     * Calcula bonus por longitud y estructura del nombre
     * @param {string[]} palabras - Palabras del nombre
     * @returns {number} - Bonus/penalización
     */
    calcularBonusEstructura(palabras) {
        if (!palabras || palabras.length === 0) return 0;

        let bonus = 0;

        // Nombre + 2 apellidos = estructura típica española
        if (palabras.length === 3) {
            bonus += 0.15;
        }
        // Nombre + 1 apellido = común
        else if (palabras.length === 2) {
            bonus += 0.1;
        }
        // Solo 1 palabra = menos probable (sin contexto)
        else if (palabras.length === 1) {
            bonus -= 0.1;
        }
        // 4+ palabras = posible nombre compuesto + apellidos
        else if (palabras.length >= 4) {
            // Verificar si es nombre compuesto válido
            const dosFirstWords = palabras.slice(0, 2).join(' ');
            if (this.detectarNombreCompuesto(dosFirstWords).esCompuesto) {
                bonus += 0.2;
            }
        }

        return bonus;
    },

    /**
     * Aplica todas las heurísticas a una entidad
     * @param {Object} entity - Entidad a analizar
     * @param {string} text - Texto completo
     * @returns {Object} - Entidad con heurísticas aplicadas
     */
    aplicarHeuristicas(entity, text) {
        const { position, type } = entity;

        // Solo aplicar a nombres
        if (type !== 'NOMBRE') {
            return entity;
        }

        // Extraer contexto
        const contextoAntes = text.substring(Math.max(0, position.start - 60), position.start);
        const contextoDespues = text.substring(position.end, Math.min(text.length, position.end + 40));

        // Verificar epónimo médico
        if (this.esEponimoMedico(entity.text)) {
            return {
                ...entity,
                confidence: 0,
                heuristicas: { esEponimo: true, razon: 'Epónimo médico detectado' }
            };
        }

        // Analizar contexto
        const analisisContexto = this.analizarContexto(contextoAntes, contextoDespues);

        // Detectar nombre compuesto
        const nombreCompuesto = this.detectarNombreCompuesto(entity.text);

        // Detectar abreviatura
        const abreviatura = this.detectarAbreviatura(entity.text);

        // Calcular bonus estructura
        const palabras = entity.text.split(/\s+/);
        const bonusEstructura = this.calcularBonusEstructura(palabras);

        // Ajustar confianza
        let ajusteTotal = analisisContexto.ajuste + bonusEstructura;

        if (nombreCompuesto.esCompuesto) {
            ajusteTotal += 0.15;
        }

        if (abreviatura.tieneAbreviatura) {
            ajusteTotal += 0.1;
        }

        // Verificar contexto de medicación (penalizar fuertemente)
        const contextoCompleto = contextoAntes + entity.text + contextoDespues;
        if (this.esContextoMedicacion(contextoCompleto)) {
            ajusteTotal -= 0.3;
        }

        const nuevaConfianza = Math.max(0, Math.min(1, entity.confidence + ajusteTotal));

        return {
            ...entity,
            confidence: nuevaConfianza,
            heuristicas: {
                contexto: analisisContexto,
                nombreCompuesto,
                abreviatura,
                bonusEstructura,
                ajusteTotal
            }
        };
    }
};

export default HeuristicasContextuales;
