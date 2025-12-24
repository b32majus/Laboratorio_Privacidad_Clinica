import { NOMBRES_MUJER } from '../dictionaries/nombres-mujer.js';
import { NOMBRES_HOMBRE } from '../dictionaries/nombres-hombre.js';
import { APELLIDOS } from '../dictionaries/apellidos.js';

export class AsignadorSustitutos {
    constructor() {
        this.mapaAsignaciones = new Map();
        this.nombresUsados = { M: new Set(), F: new Set() };
        this.apellidosUsados = new Set();
    }

    // Resetear para nueva sesión
    reset() {
        this.mapaAsignaciones.clear();
        this.nombresUsados = { M: new Set(), F: new Set() };
        this.apellidosUsados.clear();
    }

    // Obtener o generar sustituto
    obtenerSustituto(nombreOriginal, genero = null) {
        if (!nombreOriginal) return '[NOMBRE]';

        // Normalizar clave
        const key = nombreOriginal.toLowerCase().trim();
        if (this.mapaAsignaciones.has(key)) {
            return this.mapaAsignaciones.get(key);
        }

        // Detectar si es nombre compuesto/completo
        const partes = nombreOriginal.trim().split(/\s+/);

        // Si parece un nombre completo (Nombre + Apellido), generamos equivalente
        let sustituto = '';

        // Detectar género si no se proporciona
        const generoDetectado = genero || this.detectarGenero(partes[0]);

        const nuevoNombre = this.seleccionarNombre(generoDetectado);

        if (partes.length > 1) {
            // Generar apellidos
            const apellido1 = this.seleccionarApellido();
            // Si el original tenía > 2 partes, asumimos que tenía 2 apellidos o nombre compuesto + apellido
            const apellido2 = partes.length > 2 ? this.seleccionarApellido() : '';
            sustituto = `${nuevoNombre} ${apellido1} ${apellido2}`.trim();
        } else {
            // Solo nombre
            sustituto = nuevoNombre;
        }

        this.mapaAsignaciones.set(key, sustituto);
        return sustituto;
    }

    detectarGenero(nombre) {
        if (!nombre) return 'M';
        const primerNombre = nombre.toLowerCase();

        // Terminaciones típicas femeninas en español
        if (primerNombre.endsWith('a') || primerNombre.endsWith('ía')) {
            // Excepciones comunes
            if (['luca', 'bautista', 'borja', 'santiago'].includes(primerNombre)) return 'M';
            return 'F';
        }

        // Excepciones masculinas comunes
        const excepcionesMasculinas = ['garcía', 'borja', 'josema', 'garcia'];
        if (excepcionesMasculinas.includes(primerNombre)) {
            return 'M';
        }

        // Excepciones femeninas terminadas en consonate/o
        if (['carmen', 'rocío', 'rocio', 'consuelo', 'rosario', 'raquel', 'isabel', 'belen', 'belén'].includes(primerNombre)) return 'F';

        return 'M'; // Por defecto masculino
    }

    seleccionarNombre(genero) {
        const lista = genero === 'F' ? NOMBRES_MUJER : NOMBRES_HOMBRE;
        const usados = this.nombresUsados[genero];

        // Buscar uno no usado
        // Intentamos 50 veces encontrar uno libre aleatoriamente
        for (let i = 0; i < 50; i++) {
            const nombre = lista[Math.floor(Math.random() * lista.length)];
            if (!usados.has(nombre)) {
                usados.add(nombre);
                return nombre;
            }
        }

        // Si no encontramos (raro), devolvemos uno aleatorio aunque esté repetido
        return lista[Math.floor(Math.random() * lista.length)];
    }

    seleccionarApellido() {
        // Intentamos 50 veces encontrar uno libre
        for (let i = 0; i < 50; i++) {
            const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
            if (!this.apellidosUsados.has(apellido)) {
                this.apellidosUsados.add(apellido);
                return apellido;
            }
        }
        return APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];
    }

    // Obtener tabla de mapeo para el informe
    obtenerMapeo() {
        return Array.from(this.mapaAsignaciones.entries()).map(([original, sustituto]) => ({
            original,
            sustituto
        }));
    }
}

// Singleton para uso global
export const sustitucionTransformer = new AsignadorSustitutos();
