// ==================== FUNCIONES DE REVISIÓN REUTILIZABLES ====================
// Este archivo contiene las funciones críticas de review.html que se reutilizan en batch-review.html

function renderMainText(result) {
  const container = document.getElementById('main-text-scroll-area');
  if (!container || !result) return;

  let html = result.processed;

  const entities = [...result.entities].sort((a, b) => b.position.start - a.position.start);

  for (const entity of entities) {
    const originalIndex = result.entities.indexOf(entity);
    const span = createEntitySpan(entity, originalIndex);
    html = html.substring(0, entity.position.start) + span + html.substring(entity.position.end);
  }

  const paragraphs = html.split(/\n\s*\n/).filter(p => p.trim());
  container.innerHTML = paragraphs.map(p => `<p class="mb-6">${p}</p>`).join('') + '<div class="h-32"></div>';

  // Add click listeners to new spans
  container.querySelectorAll('span[id^="entity-"]').forEach(span => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const entityId = span.id;
      const card = document.querySelector(`.pending-entity-card[data-target-id="${entityId}"]`);
      if (card) card.click();
    });
  });
}

function createEntitySpan(entity, index) {
  let classes = "px-1 rounded-sm cursor-pointer hover:opacity-80 transition-opacity whitespace-pre-wrap";
  if (entity.type === 'NOMBRE') classes += " highlight-sub";
  else if (entity.type === 'IDENTIFICADOR') classes += " highlight-del";
  else if (entity.type === 'FECHA') classes += " highlight-rel";
  else if (entity.type === 'UBICACION') classes += " highlight-sub";
  else if (entity.type === 'SOSPECHOSO') classes += " highlight-warning";
  else classes += " highlight-review";

  const uniqueId = `entity-${index}`;
  return `<span id="${uniqueId}" class="${classes}" data-type="${entity.type}" data-original="${entity.original || entity.text}">${entity.transformed}</span>`;
}

function renderSidePanel(result) {
  const listContainer = document.querySelector('.flex-1.overflow-y-auto.p-4.space-y-3');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  const reviewActionBar = document.getElementById('review-action-bar');

  result.entities.forEach((entity, index) => {
    const card = document.createElement('div');
    card.className = "pending-entity-card flex flex-col bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 p-3 cursor-pointer hover:bg-white dark:hover:bg-stone-800 transition-all";
    card.dataset.targetId = `entity-${index}`;

    let colorClass = "text-stone-500", iconName = "help";
    if (entity.type === 'NOMBRE') { colorClass = "text-emerald-600"; iconName = "person"; }
    else if (entity.type === 'IDENTIFICADOR') { colorClass = "text-rose-600"; iconName = "badge"; }
    else if (entity.type === 'FECHA') { colorClass = "text-sky-600"; iconName = "calendar_month"; }
    else if (entity.type === 'UBICACION') { colorClass = "text-indigo-600"; iconName = "location_on"; }
    else if (entity.type === 'SOSPECHOSO') { colorClass = "text-amber-600"; iconName = "warning"; }

    const educationalTooltips = {
      'NOMBRE': '🔐 Los nombres son identificadores directos que pueden revelar la identidad del paciente. Se reemplazan por nombres ficticios.',
      'IDENTIFICADOR': '🆔 DNIs, números de historia clínica y otros códigos únicos se ocultan por ser identificadores directos de alta sensibilidad.',
      'FECHA': '📅 Las fechas se relativizan para mantener intervalos temporales sin exponer fechas exactas que puedan identificar eventos.',
      'UBICACION': '📍 Las ubicaciones se generalizan (ciudad → provincia → CCAA) para proteger la privacidad geográfica del paciente.',
      'SOSPECHOSO': '⚠️ Términos detectados que podrían ser cuasi-identificadores: combinaciones que juntas pueden identificar al paciente.'
    };

    const tooltip = educationalTooltips[entity.type] || 'Información protegida por RGPD';

    card.innerHTML = `
      <div class="flex items-center gap-2 mb-1">
        <span class="material-symbols-outlined ${colorClass} text-lg">${iconName}</span>
        <p class="text-stone-900 dark:text-stone-100 font-medium text-sm truncate">${entity.transformed}</p>
        <span class="ml-auto text-xs font-medium ${colorClass}">${entity.type}</span>
        <button class="info-tooltip-btn group relative ml-1 shrink-0" type="button" aria-label="Información">
          <span class="material-symbols-outlined text-stone-400 hover:text-primary text-sm">info</span>
          <div class="tooltip-content hidden group-hover:block absolute right-0 top-6 w-64 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs rounded-lg p-3 shadow-xl z-50 pointer-events-none">
            <div class="absolute -top-1 right-2 w-2 h-2 bg-stone-900 dark:bg-stone-100 rotate-45"></div>
            ${tooltip}
          </div>
        </button>
      </div>
      <p class="text-stone-500 dark:text-stone-400 text-xs">Original: <span class="font-semibold">${entity.original || entity.text}</span></p>
    `;

    const infoBtn = card.querySelector('.info-tooltip-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    card.addEventListener('click', () => {
      document.querySelectorAll('.highlighted-for-scroll').forEach(el => {
        el.classList.remove('highlighted-for-scroll', 'selected-entity', 'ring-2', 'ring-primary');
      });
      document.querySelectorAll('.pending-entity-card').forEach(el => {
        el.dataset.selected = 'false';
        el.classList.remove('ring-2', 'ring-primary', 'ring-offset-1');
      });

      card.dataset.selected = 'true';
      card.classList.add('ring-2', 'ring-primary', 'ring-offset-1');

      const targetId = card.dataset.targetId;
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.classList.add('highlighted-for-scroll', 'selected-entity', 'ring-2', 'ring-primary');
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        targetElement.addEventListener('animationend', () => {
          targetElement.classList.remove('highlighted-for-scroll');
        }, { once: true });
      }

      if (reviewActionBar) {
        const titleEl = document.getElementById('action-bar-title');
        const typeEl = document.getElementById('action-bar-type');

        if (titleEl) titleEl.textContent = entity.transformed;
        if (typeEl) typeEl.textContent = `[${entity.type}]`;

        reviewActionBar.classList.remove('hidden');
      }
    });

    listContainer.appendChild(card);
  });

  updateReviewCounter();
}

function updateReviewCounter() {
  const cards = document.querySelectorAll('.pending-entity-card');
  const reviewedCards = Array.from(cards).filter(c => c.dataset.reviewed === 'true');
  const total = cards.length;
  const reviewed = reviewedCards.length;
  const percentage = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  document.getElementById('reviewed-count').textContent = reviewed;
  document.getElementById('total-count').textContent = total;
  document.getElementById('review-percentage').textContent = percentage + '%';
  document.getElementById('review-progress-bar').style.width = percentage + '%';
}

function setupExportButtons() {
  const copyBtn = document.getElementById('copy-btn');
  const pdfBtn = document.getElementById('pdf-btn');

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!processingResult) return;
      try {
        await navigator.clipboard.writeText(processingResult.processed);
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">check</span><span class="text-sm font-medium">¡Copiado!</span>';
        copyBtn.classList.add('bg-emerald-700');
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove('bg-emerald-700');
        }, 2000);
      } catch (err) {
        console.error('Error copying:', err);
      }
    });
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (!processingResult || !window.jspdf) return;
      // Usar la función generateSinglePDF de batch-exporter.js si está disponible
      if (window.BatchExporter && typeof window.BatchExporter.exportIndividualPDFs !== 'undefined') {
        const doc = { name: 'documento.pdf', result: processingResult };
        window.BatchExporter.exportIndividualPDFs([doc]);
      }
    });
  }
}

function initializeReviewLogic() {
  const actionBar = document.getElementById('review-action-bar');
  if (!actionBar) return;

  const acceptBtn = document.getElementById('accept-btn');
  const ignoreBtn = document.getElementById('ignore-btn');
  const modifyBtn = document.getElementById('modify-btn');
  let currentEditingEntity = null;

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      const titleSpan = document.getElementById('action-bar-title');
      if (!titleSpan) return;

      const originalHTML = acceptBtn.innerHTML;
      acceptBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">done</span> ¡Aceptado!';
      acceptBtn.disabled = true;

      const cards = document.querySelectorAll('.pending-entity-card');
      let currentIndex = -1;

      cards.forEach((card, idx) => {
        if (card.dataset.targetId && document.getElementById(card.dataset.targetId) && document.getElementById(card.dataset.targetId).classList.contains('selected-entity')) {
          card.dataset.reviewed = 'true';
          card.classList.add('opacity-50', 'bg-emerald-50', 'dark:bg-emerald-950');
          card.classList.remove('hover:bg-white', 'dark:hover:bg-stone-800');
          card.querySelector('.material-symbols-outlined').textContent = 'check_circle';
          card.querySelector('.material-symbols-outlined').classList.replace('text-amber-600', 'text-emerald-600');
          currentIndex = idx;
        }
      });

      updateReviewCounter();

      setTimeout(() => {
        acceptBtn.innerHTML = originalHTML;
        acceptBtn.disabled = false;

        const nextCard = Array.from(cards).find((c, i) => i > currentIndex && c.dataset.reviewed !== 'true');
        if (nextCard) {
          nextCard.click();
        } else {
          actionBar.classList.add('hidden');
        }
      }, 400);
    });
  }

  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', () => {
      if (ignoreBtn.dataset.mode === 'confirm') {
        let selectedSpan = document.querySelector('.selected-entity');
        if (!selectedSpan) {
          const selectedCard = document.querySelector('.pending-entity-card[data-selected="true"]');
          if (selectedCard && selectedCard.dataset.targetId) {
            selectedSpan = document.getElementById(selectedCard.dataset.targetId);
          }
        }

        if (selectedSpan) {
          const originalText = selectedSpan.dataset.original;
          if (originalText) {
            const textNode = document.createTextNode(originalText);
            selectedSpan.parentNode.replaceChild(textNode, selectedSpan);

            const activeCard = document.querySelector('.pending-entity-card[data-selected="true"]');
            if (activeCard) {
              activeCard.dataset.reviewed = 'true';
              activeCard.classList.add('opacity-50', 'line-through', 'bg-stone-200', 'dark:bg-stone-800');
              activeCard.querySelector('.material-symbols-outlined').textContent = 'cancel';
              updateReviewCounter();
            }

            delete ignoreBtn.dataset.mode;
            ignoreBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">undo</span> Restaurar';
            ignoreBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            ignoreBtn.classList.add('bg-stone-600', 'hover:bg-stone-700');

            actionBar.classList.add('hidden');
          }
        }
        return;
      }

      ignoreBtn.dataset.mode = 'confirm';
      ignoreBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">warning</span> ¿Confirmar?';
      ignoreBtn.classList.remove('bg-stone-600', 'hover:bg-stone-700');
      ignoreBtn.classList.add('bg-red-600', 'hover:bg-red-700');

      setTimeout(() => {
        if (ignoreBtn.dataset.mode === 'confirm') {
          delete ignoreBtn.dataset.mode;
          ignoreBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">undo</span> Restaurar';
          ignoreBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
          ignoreBtn.classList.add('bg-stone-600', 'hover:bg-stone-700');
        }
      }, 3000);
    });
  }

  // Modal de edición
  const editModal = document.getElementById('edit-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalEditInput = document.getElementById('modal-edit-input');
  const modalNotesInput = document.getElementById('modal-notes-input');
  const modalOriginalText = document.getElementById('modal-original-text');

  let currentEditingSpan = null;

  if (modifyBtn) {
    modifyBtn.addEventListener('click', () => {
      let selectedSpan = document.querySelector('.selected-entity');
      if (!selectedSpan) {
        const selectedCard = document.querySelector('.pending-entity-card[data-selected="true"]');
        if (selectedCard && selectedCard.dataset.targetId) {
          selectedSpan = document.getElementById(selectedCard.dataset.targetId);
        }
      }

      if (selectedSpan) {
        currentEditingSpan = selectedSpan;
        currentEditingEntity = {
          original: selectedSpan.dataset.original,
          transformed: selectedSpan.textContent,
          domId: selectedSpan.id
        };

        modalOriginalText.textContent = currentEditingEntity.original;
        modalEditInput.value = currentEditingEntity.transformed;
        modalNotesInput.value = '';

        editModal.classList.remove('hidden');
        editModal.classList.add('flex');
        modalEditInput.focus();
        modalEditInput.select();
      }
    });
  }

  function closeModal() {
    editModal.classList.add('hidden');
    editModal.classList.remove('flex');
    currentEditingEntity = null;
    currentEditingSpan = null;
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
      const newValue = modalEditInput.value.trim();
      const notes = modalNotesInput.value.trim();

      if (newValue && currentEditingSpan) {
        currentEditingSpan.textContent = newValue;
        if (notes) {
          currentEditingSpan.dataset.notes = notes;
        }

        const entityId = currentEditingSpan.id;
        const entityIndex = parseInt(entityId.replace('entity-', ''));
        if (processingResult && processingResult.entities && processingResult.entities[entityIndex]) {
          processingResult.entities[entityIndex].transformed = newValue;
          if (notes) {
            processingResult.entities[entityIndex].notes = notes;
          }
        }

        const card = document.querySelector(`.pending-entity-card[data-target-id="${currentEditingSpan.id}"]`);
        if (card) {
          const cardTitle = card.querySelector('.font-medium');
          if (cardTitle) cardTitle.textContent = newValue;
        }

        const actionBarTitle = document.getElementById('action-bar-title');
        if (actionBarTitle) {
          actionBarTitle.textContent = newValue;
        }
      }

      closeModal();
    });
  }

  if (modalDeleteBtn) {
    modalDeleteBtn.addEventListener('click', () => {
      if (currentEditingSpan) {
        const originalText = currentEditingSpan.dataset.original;
        const notes = modalNotesInput.value.trim();

        const entityId = currentEditingSpan.id;
        const entityIndex = parseInt(entityId.replace('entity-', ''));
        if (processingResult && processingResult.entities && processingResult.entities[entityIndex]) {
          processingResult.entities[entityIndex].deleted = true;
          processingResult.entities[entityIndex].transformed = originalText;
          if (notes) {
            processingResult.entities[entityIndex].notes = notes;
          }
        }

        const textNode = document.createTextNode(originalText);
        currentEditingSpan.parentNode.replaceChild(textNode, currentEditingSpan);

        const card = document.querySelector(`.pending-entity-card[data-target-id="${entityId}"]`);
        if (card) {
          card.dataset.reviewed = 'true';
          card.dataset.action = 'deleted';
          if (notes) card.dataset.notes = notes;
          card.classList.add('opacity-50', 'line-through', 'bg-stone-200', 'dark:bg-stone-800');
          card.querySelector('.material-symbols-outlined').textContent = 'cancel';
          updateReviewCounter();
        }

        actionBar.classList.add('hidden');
      }

      closeModal();
    });
  }
}
