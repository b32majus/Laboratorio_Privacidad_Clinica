import { sustitucionTransformer } from './sustitucion.js';
import { fechasTransformer } from './fechas.js';
import { generalizacionTransformer } from './generalizacion.js';
import { eliminacionTransformer } from './eliminacion.js';

export const transformers = {
    sustitucion: sustitucionTransformer,
    fechas: fechasTransformer,
    generalizacion: generalizacionTransformer,
    eliminacion: eliminacionTransformer
};
