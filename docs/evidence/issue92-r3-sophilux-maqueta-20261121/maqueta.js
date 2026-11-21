/* REC-12 R3. Controles exclusivamente de PRESENTACIÓN; jamás decisiones, export ni persistencia. */
(() => {
  "use strict";
  const screens = ["revision", "celdas", "resultado"];
  const states = ["ready", "needs", "blocked"];
  const query = new URLSearchParams(location.search);
  let activeView = screens.includes(query.get("vista")) ? query.get("vista") : "revision";
  let resultState = states.includes(query.get("estado")) ? query.get("estado") : "ready";
  let currentFinding = 0;
  const main = document.querySelector("#screen");
  const findings = Array.from({ length: 24 }, (_, i) => {
    const kinds = ["Nombre", "Identificador", "Teléfono", "Fecha", "Centro", "Identificador"];
    const kind = kinds[i % kinds.length];
    const value = i === 0 ? "[PERSONA FICTICIA 01]" : i === 1 ? "[ID FICTICIO 019]" : i === 2 ? "[TELÉFONO DE EJEMPLO]" : "[DATO FICTICIO " + String(i + 1).padStart(2, "0") + "]";
    return { kind, value, place: i < 5 ? "Cabecera del informe" : "Nota clínica " + (i + 1) };
  });
  function tag(s, variant) { return '<span class="tag ' + (variant || "") + '">' + s + "</span>"; }
  function head(eyebrow, title, desc, meta) {
    return '<header class="r3-head"><div><div class="eyebrow">' + eyebrow +
      '</div><h1 class="task-title">' + title + '</h1><p class="task-description">' + desc +
      '</p></div><div class="r3-head-meta">' + meta + "</div></header>";
  }
  function choices(cell) {
    return '<div class="decision-options">' +
      '<button type="button" class="decision-option" data-demo>✓ &nbsp; ' + (cell ? "Sustituir dato" : "Aceptar sustitución") + '<small>Propuesta protectora, no automática</small></button>' +
      '<button type="button" class="decision-option" data-demo>✎ &nbsp; Modificar propuesta<small>Decidir un reemplazo concreto</small></button>' +
      '<button type="button" class="decision-option" data-demo>◇ &nbsp; Conservar original<small>Confirmación deliberada imprescindible</small></button>' +
      "</div>";
  }
  function revision() {
    const selected = findings[currentFinding];
    const list = findings.map((f, i) =>
      '<button type="button" class="' + (i === currentFinding ? "active" : "") + '" data-finding="' + i +
      '" aria-pressed="' + (i === currentFinding) + '"><span class="detection-top"><span>' +
      String(i + 1).padStart(2, "0") + " · " + f.kind + "</span>" + tag("Pend.", "warning") +
      '</span><span class="detection-bottom"><span>' + f.place + '</span><span>Sin decidir</span></span></button>'
    ).join("");
    const extras = findings.slice(3).map((f, index) =>
      "<p>Nota clínica ficticia " + (index + 4) +
      ": seguimiento sintético; se detecta " +
      '<mark class="marked ' + (currentFinding === index + 3 ? "r3-active-mark" : "") + '">' +
      f.value + "</mark> y se preserva el contexto asistencial de ejemplo.</p>"
    ).join("");
    return [
      head("REVISIÓN · TEXTO CLÍNICO DE EJEMPLO", 'Revisa lo que <em>importa.</em>',
        "Documento, hallazgos y decisión comparten el primer espacio de trabajo.",
        '<span class="tiny-tag">Informe de muestra</span><span class="tiny-tag rose">24 detecciones · 24 pendientes</span>'),
      '<div class="r3-compact-tools"><div class="r3-progress"><span class="smallcaps">Progreso</span><div class="progress-track"><span style="width:0%"></span></div><strong>0 / 24</strong>' +
        tag("Revisión pendiente","warning") + '</div><details class="r3-context-menu"><summary>Filtros y herramientas ▾</summary><div class="r3-context-panel">' +
        '<span class="filter-chip active">Todos (24)</span><span class="filter-chip">Pendientes (24)</span><span class="filter-chip">Decididos (0)</span>' +
        '<p>Herramientas reales conservadas como controles contextuales, sin desplazar los hallazgos.</p><button class="btn btn-outline btn-sm" data-demo type="button">Marcar dato no detectado</button></div></details></div>',
      '<div class="review-grid r3-review-grid">',
      '<section class="panel document-pane" aria-label="Documento original"><div class="pane-header"><div><h2 class="panel-title">Documento original</h2><p class="panel-sub">Lectura continua · texto de prueba</p></div>' + tag("Solo lectura") + '</div>',
      '<div class="pane-scroll"><article class="doc-paper"><h2 class="r3-doc-title">Informe de seguimiento clínico</h2>',
      '<p><span class="r3-doc-kicker">DOCUMENTO SINTÉTICO</span> · Consulta de ejemplo · Sin historias reales</p>',
      '<p>Paciente: <mark class="marked ' + (currentFinding === 0 ? "r3-active-mark" : "") + '">[PERSONA FICTICIA 01]</mark><br>' +
        'Identificador: <mark class="marked ' + (currentFinding === 1 ? "r3-active-mark" : "") + '">[ID FICTICIO 019]</mark><br>Contacto: <mark class="marked ' + (currentFinding === 2 ? "r3-active-mark" : "") + '">[TELÉFONO DE EJEMPLO]</mark></p>',
      '<p>Motivo de consulta: seguimiento de evolución dermatológica. Se realiza una valoración programada y la persona refiere mejoría de los síntomas.</p>',
      '<p>Se revisa el episodio del <mark class="marked soft">12/11/2025</mark>. Consta un centro de ejemplo y varias detecciones pendientes de confirmación humana.</p>',
      '<p>Constan observaciones ficticias adicionales para ilustrar la revisión de fechas, identificadores y datos de contacto.</p>',
      '<p>Plan: mantener seguimiento, revisar resultados de laboratorio y valorar evolución clínica en la próxima cita.</p>', extras,
      '<p class="r3-doc-end">Este documento es completamente inventado.</p></article><div class="doc-meta">' +
        tag("24 detecciones", "warning") + tag("Contexto clínico preservado","success") + '</div></div></section>',
      '<section class="panel detection-pane" aria-label="Hallazgos a revisar"><div class="pane-header"><div><h2 class="panel-title">Hallazgos</h2><p class="panel-sub">Elige un dato y decide</p></div>' +
        tag("24","warning") + '</div><div class="r3-findings-top"><span>Todos los tipos</span><span>24 pendientes</span></div>',
      '<div class="r3-findings-list"><div class="detection-items" role="group" aria-label="24 hallazgos sintéticos">' + list + '</div></div>' +
        '<div class="r3-findings-foot"><span>24 detecciones reales del ejemplo</span><span>Decisión por elemento</span></div></section>',
      '<aside class="panel decision-pane" aria-label="Decisión contextual"><div class="pane-header"><div><h2 class="panel-title">Decisión actual</h2><p class="panel-sub">Una detección cada vez</p></div><span class="smallcaps">' +
        String(currentFinding + 1).padStart(2,"0") + ' / 24</span></div><div class="decision-body"><div><div class="smallcaps">' + selected.kind.toUpperCase() + " · DATO DETECTADO</div>" +
        '<div class="decision-excerpt">' + selected.value + '</div><p class="r3-inspector-meta">Contexto: ' + selected.place +
        '. Comprueba el fragmento antes de decidir.</p>' + choices(false) +
        '<div class="decision-form"><label for="replace-review" class="field-label">Sustitución propuesta</label>' +
        '<input id="replace-review" class="form-input" readonly value="[DATO PROTEGIDO DE EJEMPLO]"><p class="footnote">No se confirma ninguna decisión en esta maqueta.</p></div>' +
        '<div class="r3-inspector-footer">' + tag("Pendiente","warning") +
        '<button type="button" class="btn btn-outline btn-sm" data-demo>Siguiente pendiente →</button></div></div></div></aside>',
      '</div><div class="r3-action-foot"><p>El resultado está bloqueado hasta resolver las 24 detecciones.</p><button class="btn btn-primary" type="button" disabled>Comprobar privacidad →</button></div>'
    ].join("");
  }
  function celdas() {
    return [
      head("REVISIÓN · CELDAS DE TEXTO LIBRE", 'Cada celda, <em>en su contexto.</em>',
        "El contenido activo y su decisión se ven sin atravesar una explicación larga.",
        '<span class="tiny-tag">Tabla sintética · notas_libres</span><span class="tiny-tag rose">2 celdas · 4 detecciones</span>'),
      '<div class="r3-compact-tools"><div class="r3-progress"><span class="smallcaps">Texto libre</span>' +
        tag("4 decisiones pendientes","warning") + '<span class="muted" style="font-size:11px">Fila 02 de 2 celdas</span></div>' +
        '<button class="btn btn-outline btn-sm" type="button" data-demo>Reprocesar celdas</button></div>',
      '<div class="cell-grid r3-cells-grid">',
      '<section class="panel r3-cell-queue" aria-label="Lista de celdas"><div class="pane-header"><div><h2 class="panel-title">Celdas por revisar</h2>' +
        '<p class="panel-sub">Columna: notas_libres</p></div>' + tag("02","warning") + '</div>',
      '<div class="cell-list"><button type="button" class="cell-item active" aria-current="true" data-demo><strong>Fila 02 · notas_libres</strong><small>2 detecciones pendientes · activa</small></button>' +
        '<button type="button" class="cell-item" data-demo><strong>Fila 05 · notas_libres</strong><small>2 detecciones pendientes</small></button></div>' +
        '<div class="r3-cell-queue-foot"><div class="smallcaps">ESTADO DE LA TABLA</div><p>La revisión de columnas se conserva. No se prepara salida mientras queden celdas pendientes.</p></div></section>',
      '<section class="panel r3-cell-content" aria-label="Contenido de la celda activa"><div class="pane-header"><div><h2 class="panel-title">Contenido de la celda activa</h2>' +
        '<p class="panel-sub">Fila 02 · original sintético</p></div>' + tag("Solo lectura") + '</div>',
      '<article class="cell-text">Control de seguimiento. Se revisa a <mark class="marked r3-active-mark">[PERSONA FICTICIA 01]</mark> por evolución dermatológica. La persona refiere mejoría y ausencia de eventos adversos.' +
        '<p>Próxima valoración el <mark class="marked soft">12/11/2025</mark>. Se mantiene el plan de seguimiento del ejemplo.</p></article>' +
        '<div class="r3-cell-content-foot">' + tag("2 detecciones en esta celda","warning") + '<span class="footnote">Contexto clínico ficticio preservado.</span></div></section>',
      '<aside class="panel r3-cell-inspector" aria-label="Inspector de la celda"><div class="pane-header"><div><h2 class="panel-title">Resolver esta detección</h2>' +
        '<p class="panel-sub">Fila 02 · 1 de 2</p></div>' + tag("Pendiente","warning") + '</div>',
      '<div class="decision-body"><div><div class="smallcaps">NOMBRE EN CELDA</div><div class="decision-excerpt">[PERSONA FICTICIA 01]</div>' +
        '<p class="r3-inspector-meta">Actúa sobre el dato señalado, no sobre toda la columna.</p>' + choices(true) +
        '<div class="decision-form"><label for="replace-cell" class="field-label">Sustitución propuesta</label>' +
        '<input id="replace-cell" class="form-input" value="[PERSONA PROTEGIDA 01]" readonly></div>' +
        '<div class="r3-inspector-footer">' + tag("Sin decidir","warning") +
        '<button type="button" class="btn btn-outline btn-sm" data-demo>Siguiente hallazgo →</button></div></div></div></aside></div>',
      '<div class="r3-action-foot"><p>Volver a columnas no borra sus decisiones.</p><button class="btn btn-primary" type="button" disabled>Comprobar privacidad →</button></div>'
    ].join("");
  }
  function resultado() {
    const ready = resultState === "ready";
    const needs = resultState === "needs";
    const labels = {
      ready: ["Resultado", "preparado.", "Lista para usar", "La revisión ha terminado. Comprueba la salida y elige su destino.", "✓"],
      needs: ["Resultado", "pendiente.", "Necesita atención", "Hay decisiones sin resolver. Vuelve a la revisión antes de generar una salida.", "◇"],
      blocked: ["Salida", "bloqueada.", "Salida no disponible", "Este trabajo tiene una condición que impide preparar el resultado.", "!"]
    };
    const s = labels[resultState];
    const primary = ready ? '<button class="btn btn-primary" type="button" data-demo>Copiar texto preparado ↗</button>' : "";
    const warning = ready ?
      '<div class="r3-result-banner" role="note"><span aria-hidden="true">◇</span><div><strong>Has conservado deliberadamente un dato original.</strong>' +
      '<p>Está incluido en el texto Safe. Revisa que el destino esté autorizado antes de compartirlo.</p></div></div>' :
      '<div class="r3-result-banner" role="note"><span aria-hidden="true">◇</span><div><strong>No hay una salida Safe preparada.</strong><p>El material continúa bloqueado hasta que se cumplan las condiciones de revisión y política.</p></div></div>';
    const safeBody = ready ?
      '<article class="prepared-note" aria-label="Texto preparado sintético, no original"><h3>Informe de seguimiento clínico</h3>' +
      '<p>Paciente: [PERSONA PROTEGIDA 01]<br>Referencia: [IDENTIFICADOR PROTEGIDO]<br>Fecha: [FECHA GENERALIZADA]</p>' +
      '<p>Seguimiento dermatológico. Evolución favorable, sin incidencias relevantes. Próxima valoración según resultados.</p>' +
      '<p>Contacto conservado por decisión deliberada: <strong>contacto-demo@ejemplo.invalid</strong></p>' +
      '<p class="footnote">Dato y contenido ficticios. «Safe» no significa anonimizado.</p></article>' :
      '<div class="r3-no-preview"><span aria-hidden="true">◇</span><p><strong>No se muestra texto preparado.</strong></p>' +
      '<p>La aplicación no genera vista previa de salida mientras la revisión o las condiciones del trabajo lo impidan.</p></div>';
    return [
      '<div class="r3-result-eyebrow"><div class="eyebrow">RESULTADO · FIN DEL TRABAJO</div><span class="tiny-tag">' +
        (ready ? "Texto · salida preparada" : needs ? "Texto · revisión pendiente" : "Texto · salida bloqueada") + "</span></div>",
      '<section class="result-hero r3-result-hero"><div><div class="smallcaps">SALIDA DEL TRABAJO</div><h1 class="result-title">' + s[0] + ' <em>' + s[1] + '</em></h1>' +
        '<p class="task-description">' + s[3] + '</p><div class="result-actions">' + primary +
        '<button class="btn btn-outline" type="button" data-demo>Volver a revisión</button></div></div>' +
      '<aside class="ready-stamp" style="' + (ready ? "" : "background:var(--red-paper);border-color:#eac6c4") + '" role="status">' +
        '<span class="r3-status-icon" style="' + (ready ? "" : "color:var(--red)") + '">' + s[4] + '</span><span class="smallcaps">ESTADO DEL RESULTADO</span>' +
        '<strong style="' + (ready ? "" : "color:var(--red)") + '">' + s[2] + '</strong>' +
        '<p>' + (ready ? "Salida preparada según decisiones confirmadas. No implica certificación de anonimato." :
          "La salida no está autorizada. No se muestran archivos o texto preparados.") + '</p></aside></section>',
      warning,
      '<div class="result-grid r3-result-grid"><section class="panel panel-pad" aria-label="Vista previa de salida Safe"><div class="r3-preview-head"><div>' +
        '<span class="smallcaps">CONTENIDO DE SALIDA</span><h2 class="panel-title">Vista previa del texto Safe</h2>' +
        '<p class="panel-sub">Solo si está listo; no es el documento fuente.</p></div>' +
        tag(ready ? "Preparado" : "No disponible",ready ? "success" : "danger") + '</div>' + safeBody +
        '<p class="footnote" style="margin:11px 0 0">Vista de ejemplo, sin descargas reales desde la maqueta.</p></section>',
      '<aside class="panel panel-pad" aria-label="Opciones de formato"><span class="smallcaps">SALIDAS DISPONIBLES</span>' +
        '<h2 class="r3-formats-title">Elige el formato</h2><p class="panel-sub">El mismo contenido Safe en representaciones admitidas por el material.</p>' +
        '<div class="r3-format-list">' +
        ['texto (.txt)', 'documento (.docx)', 'PDF (.pdf)'].map(label =>
           '<button class="btn btn-outline btn-sm" type="button" data-demo ' + (ready ? "" : "disabled") +
           '>Descargar ' + label + '</button>').join("") + '</div><div class="r3-format-note">' +
        tag("Ejemplo: trabajo de texto") + '<p>En lote, la principal sería ZIP; en estructurado, XLSX. La acción Copiar no es universal.</p></div></aside></div>',
      '<section class="confidential r3-confidential" aria-label="Auditoría confidencial separada"><div><span class="r3-confidential-symbol" aria-hidden="true">◇</span>' +
        '<div><span class="smallcaps">MATERIAL RESTRINGIDO · OTRO DESTINO</span><h2 class="confidential-heading">Auditoría confidencial</h2>' +
        '<p>Contiene correspondencias con datos originales. No es otro formato Safe. Requiere una confirmación adicional e independiente.</p></div></div>' +
        '<button class="btn btn-danger" type="button" data-demo ' + (ready ? "" : "disabled") +
        '>Solicitar auditoría confidencial</button></section>',
      '<p class="footnote r3-result-footnote">Maqueta ilustrativa. La interfaz real decide permisos y formatos por material y estado; aquí no se procesan ni exportan datos.</p>'
    ].join("");
  }
  const builders = { revision, celdas, resultado };
  function render(scrollToTop) {
    document.body.dataset.activeView = activeView;
    main.innerHTML = builders[activeView]();
    document.querySelector("#sample-label").textContent = activeView === "revision" ?
      "Texto de ejemplo · 24 detecciones" : activeView === "celdas" ?
      "Tabla de ejemplo · 2 celdas" : "Resultado · ejemplo sintético";
    document.querySelectorAll("[data-view]").forEach(button => {
      button.setAttribute("aria-current", button.dataset.view === activeView ? "page" : "false");
    });
    document.querySelectorAll("[data-state]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.state === resultState));
    });
    if (scrollToTop) window.scrollTo(0, 0);
  }
  function toast() {
    const el = document.querySelector("#toast");
    el.textContent = "Maqueta visual: aquí no se aceptan decisiones, no se generan archivos y no se modifican datos.";
    el.classList.add("visible");
    window.setTimeout(() => el.classList.remove("visible"), 3000);
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.view) { activeView = button.dataset.view; render(true); return; }
    if (button.dataset.state) { resultState = button.dataset.state; activeView = "resultado"; render(true); return; }
    if (button.dataset.finding) {
      const previousListScroll = main.querySelector(".r3-findings-list")?.scrollTop || 0;
      currentFinding = Number(button.dataset.finding);
      render(false);
      const list = main.querySelector(".r3-findings-list");
      if (list) list.scrollTop = previousListScroll;
      if (innerWidth > 850) {
        const selectedMark = main.querySelector(".r3-review-grid .r3-active-mark");
        if (selectedMark) selectedMark.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    if (button.hasAttribute("data-demo")) toast();
  });
  render(false);
})();
