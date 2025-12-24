
// Script simple de verificación manual en consola
// Ejecutar con: node test_engine.js

import { Processor } from './js/engine/processor.js';
import { sustitucionTransformer } from './js/engine/transformers/sustitucion.js';

console.log('--- INICIANDO TEST DEL MOTOR DE PRIVACIDAD ---\n');

const casosPrueba = [
    {
        nombre: 'Caso Básico',
        texto: 'El paciente Juan Pérez acude el 12/05/2023 con fiebre.'
    },
    {
        nombre: 'Identificadores Múltiples',
        texto: 'DNI 12345678Z, teléfono 612345678 y NIE X1234567Q.'
    },
    {
        nombre: 'Ubicaciones y Hospitales',
        texto: 'Vive en Calle Mayor 123, Madrid. Derivado al Hospital La Paz.'
    },
    {
        nombre: 'Contexto Complejo',
        texto: 'D. Carlos Ruiz, diagnosticado de enfermedad rara. Su hermano Pedro le acompaña.'
    }
];

sustitucionTransformer.reset();

for (const caso of casosPrueba) {
    console.log(`\n🔹 PROCESANDO: "${caso.nombre}"`);
    console.log(`📝 Texto Original: "${caso.texto}"`);

    try {
        const resultado = Processor.process(caso.texto);
        console.log(`✅ Texto Procesado: "${resultado.processed}"`);
        console.log(`📊 Entidades Detectadas: ${resultado.entities.length}`);

        resultado.entities.forEach(e => {
            console.log(`   - [${e.type}] "${e.original}" -> "${e.transformed}"`);
        });

        if (resultado.alerts.length > 0) {
            console.log(`⚠️ Alertas (${resultado.alerts.length}):`);
            resultado.alerts.forEach(a => console.log(`   - ${a.text}: ${a.reason}`));
        }

    } catch (e) {
        console.error('❌ ERROR:', e);
    }
    console.log('------------------------------------------------');
}
