import { identificadoresPattern } from './identificadores.js';
import { fechasPattern } from './fechas.js';
import { nombresPattern } from './nombres.js';
import { ubicacionesPattern } from './ubicaciones.js';
import { contextualesPattern } from './contextuales.js';

export const patterns = {
    identificadores: identificadoresPattern,
    fechas: fechasPattern,
    nombres: nombresPattern,
    ubicaciones: ubicacionesPattern,
    contextuales: contextualesPattern
};
