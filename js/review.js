import { Processor } from './engine/processor.js';
import { copyToClipboard, showCopyFeedback } from './export/clipboard.js';
import { PDFReportGenerator } from './export/pdf-report.js';

let processingResult = null; // Store globally for export functions

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar texto
    const originalText = localStorage.getItem('clinicalText');
    if (!originalText) {
        // Si no hay texto, volver al inicio o mostrar placeholder
        console.warn('No clinical text found in session storage.');
        return;
    }

    // 2. Procesar
    console.time('Processing');
    const result = Processor.process(originalText);
    processingResult = result; // Store for export
    console.timeEnd('Processing');

    console.log('Result:', result);

    // 3. Renderizar Texto Principal con Highlighting
    renderMainText(result);

    // 4. Renderizar Panel Lateral (Pendientes)
    renderSidePanel(result);

    // 5. Configurar botones de exportación
    setupExportButtons();
});

function renderMainText(result) {
    const container = document.getElementById('main-text-scroll-area').querySelector('.leading-relaxed');
    if (!container) return;

    // Limpiar contenido actual (excepto el spacer final si se quiere mantener)
    container.innerHTML = '';

    // Convertir saltos de línea en párrafos
    // El texto procesado ya tiene las sustituciones.
    // Para hacer highlighting interactivo, idealmente reconstruiríamos desde `result.entities`
    // pero Processor.process devuelve un string plano `processed`.

    // REVISIÓN: El output de Processor.process modifica el string.
    // Para tener interactividad, necesitamos saber DÓNDE están las entidades en el texto PROCESADO.
    // Pero entity.position refiere al ORIGINAL.

    // ESTRATEGIA: Reconstruir el HTML combinando fragmentos de texto planos y spans de entidad.
    // Las entidades en result.entities están ordenadas y tienen {original, transformed, position (original)}.
    // Esto es complicado si las posiciones no se actualizan.

    // SOLUCIÓN SIMPLIFICADA PARA FASE 3:
    // Usaremos el texto procesado directamente por ahora, pero lo envolveremos en párrafos.
    // NOTA: Para highlighting real, el engine debería devolver mapa de posiciones en TIEMPO REAL o tokens.
    // O... reconstruimos.

    // Vamos a reconstruir el HTML usando el texto original y sustituyéndolo por SPANS con el contenido transformado.
    let html = result.original;

    // Ordenar entidades de atrás hacia adelante para reemplazar sin romper índices
    const entities = [...result.entities].sort((a, b) => b.position.start - a.position.start);

    for (const entity of entities) {
        const span = createEntitySpan(entity);
        html = html.substring(0, entity.position.start) + span + html.substring(0 + entity.position.end);
    }

    // Convertir newlines a <p>
    const paragraphs = html.split(/\n\s*\n/).filter(p => p.trim());

    container.innerHTML = paragraphs.map(p => `<p class="mb-6">${p}</p>`).join('') + '<div class="h-32"></div>';

    // Re-attach event listeners for clicks
    attachEntityListeners();
}

function createEntitySpan(entity) {
    let classes = 'px-1 rounded-sm cursor-pointer transition-opacity hover:opacity-80 ';
    let icon = '';

    switch (entity.type) {
        case 'NOMBRE':
            classes += 'bg-emerald-100 text-emerald-800 border-b-2 border-emerald-500'; // Sustituido
            icon = 'check_circle';
            break;
        case 'FECHA':
            classes += 'bg-sky-100 text-sky-800 border-b-2 border-sky-500'; // Relativizado
            icon = 'today';
            break;
        case 'IDENTIFICADOR':
        case 'EMAIL':
        case 'TELEFONO':
            classes += 'bg-rose-100 text-rose-800 border-b-2 border-rose-500 line-through decoration-rose-500/50'; // Eliminado
            icon = 'delete';
            break;
        case 'UBICACION':
            classes += 'bg-slate-100 text-slate-800 border-b-2 border-slate-500'; // Generalizado
            icon = 'location_on';
            break;
        default:
            classes += 'bg-gray-100 text-gray-800';
    }

    // Data attributes para interacción
    return `<span class="${classes}" data-type="${entity.type}" data-original="${entity.original}" data-transformed="${entity.transformed}" tabindex="0">${entity.transformed}</span>`;
}

function renderSidePanel(result) {
    const listContainer = document.querySelector('.flex-1.overflow-y-auto.p-4.space-y-3'); // Selector un poco frágil, mejor ID
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Limpiar mocks

    // Renderizar entidades
    result.entities.forEach(entity => {
        const card = document.createElement('div');
        card.className = "pending-entity-card flex flex-col bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 p-3 cursor-pointer hover:bg-white dark:hover:bg-stone-800 transition-all hover:shadow-md";

        // Icono y color según tipo
        let colorClass = "text-stone-500";
        let iconName = "help";
        if (entity.type === 'NOMBRE') { colorClass = "text-emerald-600"; iconName = "check_circle"; }
        if (entity.type === 'IDENTIFICADOR') { colorClass = "text-rose-600"; iconName = "delete"; }
        if (entity.type === 'FECHA') { colorClass = "text-sky-600"; iconName = "today"; }

        card.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined ${colorClass} text-lg">${iconName}</span>
                <p class="text-stone-900 dark:text-stone-100 font-medium text-sm truncate">${entity.transformed}</p>
                <span class="ml-auto text-xs font-medium ${colorClass.replace('text-', 'text-opacity-80-')}">${entity.type}</span>
            </div>
            <p class="text-stone-500 dark:text-stone-400 text-xs line-clamp-2">Original: <span class="font-semibold text-stone-800 dark:text-stone-200">${entity.original}</span></p>
        `;

        listContainer.appendChild(card);
    });

    // Renderizar Alertas (si hay)
    if (result.alerts && result.alerts.length > 0) {
        result.alerts.forEach(alert => {
            const card = document.createElement('div');
            card.className = "pending-entity-card flex flex-col bg-amber-50 dark:bg-amber-900/20 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 p-3 cursor-pointer hover:shadow-md";

            card.innerHTML = `
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-amber-600 text-lg">warning</span>
                    <p class="text-stone-900 dark:text-stone-100 font-medium text-sm truncate">Revisar Contexto</p>
                </div>
                <p class="text-stone-600 dark:text-stone-300 text-xs mb-1">"${alert.text}"</p>
                <p class="text-amber-700 dark:text-amber-400 text-[10px] font-medium">${alert.reason}</p>
            `;
            listContainer.insertBefore(card, listContainer.firstChild); // Alertas primero
        });
    }

    // Actualizar barra de progreso (Simulada por ahora)
    const progressText = document.querySelector('p.text-xs.font-medium.leading-normal');
    if (progressText) progressText.textContent = `${result.entities.length} entidades detectadas`;
}

function attachEntityListeners() {
    const mainArea = document.getElementById('main-text-scroll-area');
    const actionBar = document.getElementById('review-action-bar');

    if (!actionBar) return;

    // Delegate click
    mainArea.addEventListener('click', (e) => {
        const target = e.target.closest('span[data-type]');
        if (target) {
            // Mostrar Action Bar
            actionBar.classList.remove('hidden');
            actionBar.classList.add('animate-slide-up-small');

            const original = target.getAttribute('data-original');
            const type = target.getAttribute('data-type');

            // Llenar datos
            actionBar.querySelector('h4 span:last-child').textContent = original;
            actionBar.querySelector('p span').textContent = `[${type}]`;

            // Highlight activo
            document.querySelectorAll('.ring-2').forEach(el => el.classList.remove('ring-2', 'ring-primary'));
            target.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
        } else {
            // Ocultar si click fuera
            // actionBar.classList.add('hidden');
        }
    });

    // Botón Aceptar (simulado)
    const acceptBtn = actionBar.querySelector('button.bg-primary');
    if (acceptBtn) {
        acceptBtn.onclick = () => {
            actionBar.classList.add('hidden');
            document.querySelectorAll('.ring-2').forEach(el => el.classList.remove('ring-2', 'ring-primary'));
        };
    }
}

function setupExportButtons() {
    const copyBtn = document.getElementById('copy-btn');
    const pdfBtn = document.getElementById('pdf-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!processingResult) return;

            const success = await copyToClipboard(processingResult.processed);
            showCopyFeedback(copyBtn, success);
        });
    }

    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            if (!processingResult) return;

            const pdfGenerator = new PDFReportGenerator();
            pdfGenerator.generate(processingResult);
        });
    }
}
