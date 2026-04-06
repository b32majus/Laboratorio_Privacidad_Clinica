// Índice principal del módulo Core
// Exporta todos los componentes del motor de anonimización

// Procesador principal
import { Processor } from './processor.js';
export { Processor };

// Managers
import { AsignadorSustitutos } from './managers/AsignadorSustitutos.js';
import { UbicacionesManager } from './managers/UbicacionesManager.js';
import { FechasManager } from './managers/FechasManager.js';
export { AsignadorSustitutos, UbicacionesManager, FechasManager };

// Detectores
import { detectIdentificadores } from './detectors/identificadores.js';
import { detectFechas } from './detectors/fechas.js';
import { detectUbicaciones } from './detectors/ubicaciones.js';
import { detectProfesionales, detectPacientes, detectFamiliares } from './detectors/nombres.js';
import { detectCuasiIdentificadores } from './detectors/cuasiidentificadores.js';
export {
    detectIdentificadores,
    detectFechas,
    detectUbicaciones,
    detectProfesionales,
    detectPacientes,
    detectFamiliares,
    detectCuasiIdentificadores
};

// Scoring y Heurísticas
import { ScoringEngine } from './scoring/ScoringEngine.js';
import { HeuristicasContextuales } from './scoring/HeuristicasContextuales.js';
export { ScoringEngine, HeuristicasContextuales };

// Utilidades
import { TextNormalizer } from './utils/TextNormalizer.js';
export { TextNormalizer };

// Export default del procesador para uso simplificado
export default { Processor };
