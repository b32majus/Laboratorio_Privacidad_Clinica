import { tokenizer } from './tokenizer.js';
import { patterns } from './patterns/index.js';
import { transformers } from './transformers/index.js';

export class Processor {
    static process(text) {
        const startTime = performance.now();
        const sessionId = crypto.randomUUID().slice(0, 8); // Simple ID

        if (!text) return this.createEmptyResult(sessionId);

        // 1. Detección
        let entities = this.detectEntities(text);

        // 2. Resolución de conflictos (overlaps)
        entities = this.resolveConflicts(entities);

        // 3. Transformación
        const transformations = [];
        let processedText = text;

        // Ordenar entidades de final a principio para reemplazar sin afectar índices
        const sortedEntities = [...entities].sort((a, b) => b.position.start - a.position.start);

        for (const entity of sortedEntities) {
            const transformed = this.transformEntity(entity);
            entity.transformed = transformed;

            // Reemplazo en string
            processedText = processedText.slice(0, entity.position.start) +
                transformed +
                processedText.slice(entity.position.end);

            transformations.push(entity);
        }

        // Ordenar de nuevo por aparición natural
        transformations.sort((a, b) => a.position.start - b.position.start);

        // 4. Estadísticas
        const stats = this.calculateStats(transformations);

        return {
            original: text,
            processed: processedText,
            entities: transformations,
            alerts: this.detectAlerts(text), // Alertas contextuales (no transforman)
            stats,
            sessionId,
            processingTime: Math.round(performance.now() - startTime)
        };
    }

    static detectEntities(text) {
        let allEntities = [];
        // Ejecutar todos los detectores excepto contextuales (que son alertas)
        const activePatterns = ['identificadores', 'fechas', 'nombres', 'ubicaciones'];

        for (const patternKey of activePatterns) {
            const detector = patterns[patternKey];
            if (detector && detector.detect) {
                const results = detector.detect(text);
                allEntities = [...allEntities, ...results];
            }
        }

        return allEntities;
    }

    static resolveConflicts(entities) {
        // Ordenar por confianza (mayor primero) y longitud (mayor primero)
        entities.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return (b.position.end - b.position.start) - (a.position.end - a.position.start);
        });

        const resolved = [];
        const occupied = new Uint8Array(200000); // Mapa simple de ocupación (hasta 200k chars) 
        // Nota: Para textos muy largos esto podría optimizarse con un árbol de intervalos

        for (const entity of entities) {
            let isCollision = false;
            // Verificar colisión
            for (let i = entity.position.start; i < entity.position.end; i++) {
                if (occupied[i]) {
                    isCollision = true;
                    break;
                }
            }

            if (!isCollision) {
                resolved.push(entity);
                // Marcar ocupado
                for (let i = entity.position.start; i < entity.position.end; i++) {
                    occupied[i] = 1;
                }
            }
        }

        return resolved.sort((a, b) => a.position.start - b.position.start);
    }

    static transformEntity(entity) {
        if (entity.type === 'NOMBRE') {
            return transformers.sustitucion.obtenerSustituto(entity.text);
        }
        if (entity.type === 'FECHA') {
            return transformers.fechas.transform(entity.text);
        }
        if (entity.type === 'IDENTIFICADOR' || entity.type === 'EMAIL' || entity.type === 'TELEFONO') {
            return transformers.eliminacion.transform(entity.subtype || entity.type, entity.text);
        }
        if (entity.type === 'UBICACION') {
            return transformers.generalizacion.transform(entity.text, entity.metadata, entity.subtype);
        }
        return `[${entity.type}]`;
    }

    static detectAlerts(text) {
        if (patterns.contextuales && patterns.contextuales.detect) {
            return patterns.contextuales.detect(text);
        }
        return [];
    }

    static calculateStats(entities) {
        const stats = {
            totalEntities: entities.length,
            byType: {
                nombres: 0,
                fechas: 0,
                identificadores: 0,
                ubicaciones: 0
            },
            requiresReview: 0,
            reviewed: 0
        };

        for (const e of entities) {
            const type = e.type.toLowerCase() + 's';
            if (stats.byType[type] !== undefined) {
                stats.byType[type]++;
            } else if (type.startsWith('identificador')) {
                stats.byType.identificadores++;
            }
        }

        return stats;
    }

    static createEmptyResult(sessionId) {
        return {
            original: '',
            processed: '',
            entities: [],
            alerts: [],
            stats: { totalEntities: 0, byType: {}, requiresReview: 0, reviewed: 0 },
            sessionId,
            processingTime: 0
        };
    }
}
