// AsignadorSustitutos - Gestiona la asignación coherente de pseudónimos
// Mantiene consistencia: misma entrada → mismo pseudónimo

import { TextNormalizer } from '../utils/TextNormalizer.js';

export const AsignadorSustitutos = {
    mapaAsignaciones: new Map(),
    profesionalesMap: new Map(),
    familiaresMap: new Map(),
    contadorProfesionales: 0,
    contadorFamiliares: 0,

    /**
     * Resetea todos los mapas para una nueva sesión
     */
    reset() {
        this.mapaAsignaciones.clear();
        this.profesionalesMap.clear();
        this.familiaresMap.clear();
        this.contadorProfesionales = 0;
        this.contadorFamiliares = 0;
    },

    /**
     * Obtiene sustituto para PACIENTES: "Paciente Hombre" o "Paciente Mujer"
     * @param {string} nombreOriginal - Nombre del paciente
     * @param {string|null} genero - 'M' o 'F', o null para autodetectar
     * @returns {string} - Pseudónimo asignado
     */
    obtenerSustituto(nombreOriginal, genero = null) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        const key = nombreOriginal.toLowerCase().trim();
        if (this.mapaAsignaciones.has(key)) {
            return this.mapaAsignaciones.get(key);
        }

        const generoDetectado = genero || this.detectarGenero(nombreOriginal);
        const sustituto = generoDetectado === 'F' ? 'Paciente Mujer' : 'Paciente Hombre';

        this.mapaAsignaciones.set(key, sustituto);
        return sustituto;
    },

    /**
     * Normaliza el nombre de un profesional eliminando títulos
     * @param {string} nombre - Nombre con posible título
     * @returns {string} - Nombre normalizado sin título
     */
    normalizarProfesional(nombre) {
        if (!nombre) return '';
        let normalized = nombre.toLowerCase().trim();

        // Eliminar prefijos Dr./Dra./Doctor/Doctora/Enfermero/etc.
        normalized = normalized.replace(/^(dr\.|dra\.|doctor|doctora|facultativo|enfermero|enfermera|enf\.)\s*/i, '');

        // Normalizar espacios
        normalized = normalized.replace(/\s+/g, ' ').trim();

        return normalized;
    },

    /**
     * Extrae los apellidos de un nombre (todas las palabras excepto la primera si hay 2+)
     * @param {string} nombre - Nombre completo
     * @returns {string} - Apellidos
     */
    extraerApellidos(nombre) {
        const normalized = this.normalizarProfesional(nombre);
        const palabras = normalized.split(' ');
        if (palabras.length <= 1) return normalized;
        return palabras.slice(1).join(' ');
    },

    /**
     * Verifica si dos nombres de profesionales representan la misma persona
     * @param {string} key1 - Primer nombre normalizado
     * @param {string} key2 - Segundo nombre normalizado
     * @returns {boolean}
     */
    sonMismoProfesional(key1, key2) {
        if (key1 === key2) return true;

        const palabras1 = key1.split(' ');
        const palabras2 = key2.split(' ');

        const keyCorta = palabras1.length <= palabras2.length ? key1 : key2;
        const keyLarga = palabras1.length > palabras2.length ? key1 : key2;
        const palabrasCorta = keyCorta.split(' ');
        const palabrasLarga = keyLarga.split(' ');

        // Caso 1: La key corta es sufijo de la larga
        if (keyLarga.endsWith(keyCorta)) return true;

        // Caso 2: La key corta comparte apellidos con la larga
        const apellidosCorta = palabrasCorta.length > 1 ? palabrasCorta.slice(1) : palabrasCorta;
        const apellidosLarga = palabrasLarga.length > 1 ? palabrasLarga.slice(1) : palabrasLarga;

        if (palabrasCorta.length === 1 && palabrasLarga.includes(palabrasCorta[0])) {
            return true;
        }

        const apellidosCortaSet = new Set(apellidosCorta);
        const apellidosComunes = apellidosLarga.filter(a => apellidosCortaSet.has(a));

        if (apellidosComunes.length === apellidosCorta.length && apellidosComunes.length > 0) {
            return true;
        }

        return false;
    },

    /**
     * Obtiene sustituto para PROFESIONALES: "Profesional Sanitario 1, 2..."
     * @param {string} nombreOriginal - Nombre del profesional
     * @returns {string} - Pseudónimo asignado
     */
    obtenerSustitutoProfesional(nombreOriginal) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        const keyCompleta = this.normalizarProfesional(nombreOriginal);

        if (keyCompleta.length < 3) return '';

        if (this.profesionalesMap.has(keyCompleta)) {
            return this.profesionalesMap.get(keyCompleta);
        }

        // Buscar si alguna clave existente representa al mismo profesional
        for (const [existingKey, value] of this.profesionalesMap.entries()) {
            if (this.sonMismoProfesional(keyCompleta, existingKey)) {
                this.profesionalesMap.set(keyCompleta, value);
                return value;
            }
        }

        this.contadorProfesionales++;
        const sustituto = `Profesional Sanitario ${this.contadorProfesionales}`;
        this.profesionalesMap.set(keyCompleta, sustituto);
        return sustituto;
    },

    /**
     * Obtiene sustituto para FAMILIARES: "Familiar 1, 2..."
     * @param {string} nombreOriginal - Descripción del familiar
     * @returns {string} - Pseudónimo asignado
     */
    obtenerSustitutoFamiliar(nombreOriginal) {
        if (!nombreOriginal || nombreOriginal.trim() === '') return '';

        const relacionesFamiliares = [
            'esposa', 'esposo', 'madre', 'padre', 'hijo', 'hija',
            'hermano', 'hermana', 'abuelo', 'abuela', 'tío', 'tía',
            'primo', 'prima', 'sobrino', 'sobrina', 'cuñado', 'cuñada',
            'suegro', 'suegra', 'yerno', 'nuera', 'pareja', 'cónyuge',
            'tutor', 'tutora'
        ];

        const textoLower = nombreOriginal.toLowerCase();
        let relacionEncontrada = null;

        for (const relacion of relacionesFamiliares) {
            if (textoLower.includes(relacion)) {
                relacionEncontrada = relacion;
                break;
            }
        }

        const key = relacionEncontrada || textoLower.trim();

        if (this.familiaresMap.has(key)) {
            return this.familiaresMap.get(key);
        }

        this.contadorFamiliares++;
        const sustituto = `Familiar ${this.contadorFamiliares}`;
        this.familiaresMap.set(key, sustituto);
        return sustituto;
    },

    /**
     * Detecta el género basándose en el nombre
     * @param {string} nombre - Nombre a analizar
     * @returns {string} - 'M' o 'F'
     */
    detectarGenero(nombre) {
        const primerNombre = nombre.split(' ')[0].toLowerCase();

        // Abreviaturas frecuentes de nombres femeninos
        if (['mª', 'm.ª', 'm.', 'ma', 'ma.'].includes(primerNombre)) {
            return 'F';
        }

        // Nombres que terminan en 'a' suelen ser femeninos (con excepciones)
        if (primerNombre.endsWith('a') || primerNombre.endsWith('ía')) {
            const excepcionesMasculinas = ['luca', 'bautista', 'borja', 'santiago', 'garcía', 'joshua', 'ezra'];
            if (excepcionesMasculinas.includes(primerNombre)) return 'M';
            return 'F';
        }

        // Nombres femeninos que no terminan en 'a'
        const nombresFemeninos = [
            'carmen', 'rocío', 'consuelo', 'rosario', 'raquel', 'isabel',
            'pilar', 'mar', 'mercedes', 'dolores', 'nieves', 'milagros',
            'belen', 'belén', 'montserrat', 'nuria', 'ines', 'inés'
        ];
        if (nombresFemeninos.includes(primerNombre)) return 'F';

        return 'M';
    }
};

export default AsignadorSustitutos;
