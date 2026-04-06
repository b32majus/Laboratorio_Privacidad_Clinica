// UbicacionesManager - Gestiona la coherencia de ubicaciones
// Asigna códigos consistentes a hospitales y ciudades

export const UbicacionesManager = {
    centrosMap: new Map(),
    ciudadesMap: new Map(),
    contadorCentros: 0,
    contadorCiudades: 0,

    /**
     * Resetea los mapas para una nueva sesión
     */
    reset() {
        this.centrosMap.clear();
        this.ciudadesMap.clear();
        this.contadorCentros = 0;
        this.contadorCiudades = 0;
    },

    /**
     * Normaliza el nombre del centro para consistencia
     * Extrae el nombre propio del hospital
     * @param {string} centro - Nombre del centro
     * @returns {string} - Nombre normalizado
     */
    normalizarCentro(centro) {
        if (!centro) return '';
        let normalized = centro.toLowerCase().trim();

        // Eliminar palabras que no son parte del nombre del centro
        normalized = normalized.replace(/\s+(período|periodo|médico|medico)\s*$/gi, '');

        // Normalizar variantes comunes de hospitales
        normalized = normalized.replace(/^h\.\s*u\.\s*/i, 'hospital universitario ');
        normalized = normalized.replace(/^h\.\s*/i, 'hospital ');

        // Eliminar "de día" y similares
        normalized = normalized.replace(/\s+de\s+día\s*/gi, ' ');

        // Normalizar espacios múltiples
        normalized = normalized.replace(/\s+/g, ' ').trim();

        // Extraer nombre propio del hospital
        const matchNombrePropio = normalized.match(
            /(?:hospital|clínica|clinica|centro de salud|consultorio)\s+(?:universitario\s+)?(?:infantil\s+)?(?:general\s+)?(?:regional\s+)?(?:comarcal\s+)?(?:provincial\s+)?(?:materno\s+)?(?:clínico\s+)?(?:de\s+día\s+)?(.+)/i
        );

        if (matchNombrePropio && matchNombrePropio[1]) {
            normalized = matchNombrePropio[1].trim();
        }

        return normalized;
    },

    /**
     * Obtiene código para un centro sanitario
     * @param {string} centroOriginal - Nombre del centro
     * @returns {string} - Código asignado (ej: "Centro A")
     */
    obtenerCentro(centroOriginal) {
        if (!centroOriginal || centroOriginal.trim() === '') return '';

        const key = this.normalizarCentro(centroOriginal);

        // Buscar si ya existe una clave similar
        for (const [existingKey, value] of this.centrosMap.entries()) {
            if (existingKey.includes(key) || key.includes(existingKey)) {
                this.centrosMap.set(key, value);
                return value;
            }
        }

        if (this.centrosMap.has(key)) {
            return this.centrosMap.get(key);
        }

        this.contadorCentros++;
        const letra = String.fromCharCode(64 + this.contadorCentros); // A, B, C...
        const sustituto = `Centro ${letra}`;
        this.centrosMap.set(key, sustituto);
        return sustituto;
    },

    /**
     * Obtiene código para una ciudad
     * @param {string} ciudadOriginal - Nombre de la ciudad
     * @returns {string} - Código asignado (ej: "Ciudad A")
     */
    obtenerCiudad(ciudadOriginal) {
        if (!ciudadOriginal || ciudadOriginal.trim() === '') return '';

        const key = ciudadOriginal.toLowerCase().trim();
        if (this.ciudadesMap.has(key)) {
            return this.ciudadesMap.get(key);
        }

        this.contadorCiudades++;
        const letra = String.fromCharCode(64 + this.contadorCiudades);
        const sustituto = `Ciudad ${letra}`;
        this.ciudadesMap.set(key, sustituto);
        return sustituto;
    }
};

export default UbicacionesManager;
