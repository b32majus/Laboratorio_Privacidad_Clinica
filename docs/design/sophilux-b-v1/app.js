/* Interaction is presentational only. NO data processing, file reading, exports or backend. */
const VIEWS = [
  ["entrada", "Entrada"], ["revision", "Revisión"], ["lote", "Lote"],
  ["estructurado", "Estructurado"], ["celdas", "Texto libre"],
  ["comprobacion", "Privacidad"], ["resultado", "Resultado"]
];
const mock = {
  current: "entrada", inputMode: "texto", selectedDetection:0, decisions: {},
  batchFilter:"Todos", selectedDoc:0, selectedColumn:1, gateBlocked:false,
  resultBlocked:false, patientId:"NHC", helpOpen:false
};
const detectionList = [
  {label:"Nombre y apellidos",value:"María [EJEMPLO]",place:"Línea 2",kind:"Identificador"},
  {label:"Identificador clínico",value:"NHC-000042",place:"Línea 2",kind:"Identificador"},
  {label:"Fecha completa",value:"12/03/2025",place:"Línea 4",kind:"Cuasi-identificador"},
  {label:"Teléfono",value:"600 000 000",place:"Línea 5",kind:"Identificador"},
  {label:"Centro",value:"Hospital de Ejemplo",place:"Línea 1",kind:"Cuasi-identificador"}
];
const docs = [
  {name:"consulta_urgencias_01.pdf",status:"Pendiente",note:"5 detecciones por revisar"},
  {name:"seguimiento_02.docx",status:"Listo",note:"Revisión completada"},
  {name:"alta_03.pdf",status:"Atención",note:"PDF sin texto extraíble"},
  {name:"informe_04.txt",status:"Listo",note:"Salida preparada"},
  {name:"notas_05.docx",status:"Pendiente",note:"2 detecciones por revisar"},
  {name:"visita_06.pdf",status:"Listo",note:"Revisión completada"},
  {name:"documento_07.pdf",status:"Atención",note:"Archivo dañado; no procesado"},
];
const structuredColumns = [
 ["NHC","Identificador","ID de estudio","Definido"],
 ["fecha_nacimiento","Cuasi-identificador","Revisar","Pendiente"],
 ["sexo","Desconocida","Revisar","Pendiente"],
 ["diagnostico","Sensible","Conservar","Definido"],
 ["centro","Cuasi-identificador","Seudonimizar","Propuesta"],
 ["notas_libres","Desconocida","Revisar","Pendiente"],
 ...Array.from({length:26},(_,i)=>[
  "CampoLibre"+String(i+1).padStart(2,"0"),"Desconocida","Revisar","Pendiente"
 ])
].map(([name,classification,action,status],i)=>({id:i,name,classification,action,status}));
const h = String.raw;
const icon = (name) => {
 const icons={arrow:'→',check:'✓',back:'←',sparkle:'✧',chevron:'⌄',lock:'◇',plus:'+',forward:'↗'};
 return icons[name]||'';
};
const btn = (text,action,kind="primary",extra="")=>`<button type="button" class="btn btn-${kind}" data-action="${action}" ${extra}>${text}</button>`;
const chip = (text,type="")=>`<span class="tag ${type}">${type==="success"?'<span class="dot"></span>':''}${text}</span>`;
const eyebrow = (text)=>`<div class="eyebrow">${text}</div>`;
const heading = (label,title,description,meta='')=>`<div class="screen-header"><div><div class="step-context">${label}</div><h1 class="task-title">${title}</h1><p class="task-description">${description}</p></div>${meta?`<div class="meta-stack">${meta}</div>`:''}</div>`;

function inputView(){
 return `<div class="intro-grid">
  <section class="intro-story" aria-label="Introducción y propósito">
   ${eyebrow('TRABAJA CON TRANQUILIDAD')}
   <h1 class="display-title">Protege los datos.<br><em>Conserva el sentido.</em></h1>
   <p class="intro-copy">La información clínica merece un tratamiento cuidadoso. Revisa textos, documentos y tablas antes de compartirlos con herramientas de IA, sin perder el contexto que importa.</p>
   <div class="intro-assurance"><span><b class="check">✓</b> Revisión humana</span><span><b class="check">✓</b> Trabajo local</span><span><b class="check">✓</b> Control sobre la salida</span></div>
   <div class="intro-art" aria-hidden="true"><p>La privacidad también puede ser elegante.</p></div>
  </section>
  <section class="panel intake-card" aria-label="Nuevo trabajo">
    <div class="intake-head"><div><div class="smallcaps">NUEVO TRABAJO</div><h2 style="font:600 27px/1.1 var(--serif);margin:5px 0 0">¿Qué vamos a revisar?</h2></div>${chip('Sesión nueva','success')}</div>
    <div class="intake-switch" role="group" aria-label="Tipo de entrada"><button data-mode="texto" class="${mock.inputMode==='texto'?'active':''}" aria-pressed="${mock.inputMode==='texto'}">✎ &nbsp; Texto clínico</button><button data-mode="archivos" class="${mock.inputMode==='archivos'?'active':''}" aria-pressed="${mock.inputMode==='archivos'}">▤ &nbsp; Archivos y tablas</button></div>
    <div class="intake-body">${mock.inputMode==='texto'?`
     <label for="demo-text" class="field-label">Pega el contenido que quieras preparar</label>
     <textarea class="form-textarea intake-textarea" id="demo-text" placeholder="Ejemplo: Nota de evolución clínica, informe de consulta o correspondencia…">Informe de seguimiento [EJEMPLO]. Paciente sintético con identificador NHC-000042. Consulta realizada el 12/03/2025.</textarea>
     <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 9px"><span class="footnote">Solo datos sintéticos en este prototipo.</span><button type="button" class="text-link" data-action="example">Usar ejemplo sintético</button></div>
    `:`<div class="droparea"><div class="drop-icon" aria-hidden="true">↥</div><div style="font-size:14px;font-weight:750">Arrastra un documento o una tabla</div><p class="muted" style="font-size:11px;max-width:290px;margin:7px 0 15px">TXT, PDF, DOCX, CSV, XLS, XLSX. En el producto real, la lectura se realiza localmente.</p>${btn('Simular archivo cargado','file-demo','outline')}</div><p class="footnote" style="margin:12px 0 0">En esta maqueta no se leen ni suben archivos.</p>`}
     <details style="margin-top:13px"><summary style="color:var(--rose-deep);font-size:11px;font-weight:700;cursor:pointer">Uso previsto y política de privacidad</summary><div class="soft-panel" style="font-size:11px;color:var(--ink-soft);margin-top:8px">Estándar, IA externa, Investigación longitudinal y Estricta son políticas diferentes. La disponibilidad depende del trabajo y se comprueba antes de preparar la salida.</div></details>
    </div>
    <div class="intake-foot"><span class="usage-note">Tu tarea empieza aquí: sin pantallas de bienvenida adicionales ni configuración innecesaria.</span>${btn(`Crear trabajo &nbsp; ${icon('arrow')}`,mock.inputMode==='texto'?'start-review':'start-batch')}</div>
  </section>
 </div>`;
}
function reviewView(){
 const finished=Object.keys(mock.decisions).length;
 const pct=Math.round(finished/detectionList.length*100);
 const selected=detectionList[mock.selectedDetection];
 return `${heading('REVISIÓN · TEXTO O DOCUMENTO','Revisa lo que <em>importa.</em>','Documento y decisiones, juntos. La evidencia está disponible sin apartar de la vista el texto que estás revisando.',chip('Trabajo · informe_ejemplo.txt')+chip(`${finished} de ${detectionList.length} decisiones`))}
  <div class="subnav"><span class="smallcaps">PROGRESO DE REVISIÓN</span><div class="progress-track" style="width:160px"><span style="width:${pct}%"></span></div><span class="footnote">${pct}% completado</span><span style="margin-left:auto">${chip('Preparación pendiente','warning')}</span></div>
  <div class="review-grid">
   <section class="panel document-pane"><div class="pane-header"><div><h2 class="panel-title">Documento original</h2><p class="panel-sub">Lectura continua · detecciones señaladas</p></div>${chip('Solo lectura')}</div>
    <div class="pane-scroll"><article class="doc-paper"><h4>Informe de seguimiento clínico</h4><p>Centro: <span class="marked soft">Hospital de Ejemplo</span><br>Paciente: <span class="marked">María [EJEMPLO]</span><br>Referencia: <span class="marked">NHC-000042</span></p><p>Motivo de consulta: seguimiento de proceso dermatológico y evaluación de respuesta clínica. Evolución favorable, sin incidencias relevantes.</p><p>Revisión realizada el <span class="marked soft">12/03/2025</span>. Próxima valoración pendiente de resultados de laboratorio.</p><p>Contacto administrativo: <span class="marked">600 000 000</span>. Se facilita información sobre los cuidados y el seguimiento previstos.</p><p>Documento de demostración. No contiene información de pacientes reales.</p></article><div class="doc-meta">${chip('3 identificadores')}${chip('2 cuasi-identificadores')}${chip('Contexto clínico preservado','success')}</div></div></section>
   <section class="panel detection-pane"><div class="pane-header"><div><h2 class="panel-title">Hallazgos</h2><p class="panel-sub">Elige cuál revisar</p></div><span class="smallcaps">05</span></div><div class="detection-items" role="list">${detectionList.map((d,i)=>`<button role="listitem" class="${i===mock.selectedDetection?'active':''}" data-detection="${i}" aria-pressed="${i===mock.selectedDetection}"><span class="detection-top"><span>${d.label}</span>${mock.decisions[i]?chip('✓','success'):chip('Pend.','warning')}</span><span class="detection-bottom"><span>${d.place}</span><span>${d.kind}</span></span></button>`).join('')}</div></section>
   <aside class="panel decision-pane"><div class="pane-header"><div><h2 class="panel-title">Decisión actual</h2><p class="panel-sub">Tienes la última palabra</p></div><span class="smallcaps">${String(mock.selectedDetection+1).padStart(2,'0')}/05</span></div><div class="decision-body"><div><span class="smallcaps">${selected.kind}</span><div class="decision-excerpt">${selected.value}</div><p class="muted" style="font-size:11px;margin:0">Detección propuesta. Comprueba el contexto antes de decidir.</p><div class="decision-options"><button class="decision-option ${mock.decisions[mock.selectedDetection]==='replace'?'active':''}" data-decision="replace">✓ &nbsp; Aceptar sustitución<small>Protege el identificador en la salida</small></button><button class="decision-option ${mock.decisions[mock.selectedDetection]==='modify'?'active':''}" data-decision="modify">✎ &nbsp; Modificar propuesta<small>Personaliza la sustitución</small></button><button class="decision-option ${mock.decisions[mock.selectedDetection]==='keep'?'active':''}" data-decision="keep">◇ &nbsp; Mantener original<small>Requiere decisión deliberada</small></button></div></div><div class="decision-form"><label for="review-replacement" class="field-label">Sustitución propuesta</label><input id="review-replacement" class="form-input" readonly value="[DATO PROTEGIDO]"><p class="footnote" style="margin:9px 0 0">Los originales conservados se advertirán explícitamente en Resultado.</p></div></div></aside>
  </div>
  <div class="workspace-actions"><button class="text-link" data-route="entrada">${icon('back')} &nbsp;Volver a entrada</button><div style="display:flex;gap:10px;align-items:center">${btn('Comprobar privacidad &nbsp; →','go-gate','primary')}</div></div>`;
}
function batchView(){
 const current=docs[mock.selectedDoc];
 const shown=docs.map((d,i)=>({...d,i})).filter(d=>mock.batchFilter==='Todos'||(mock.batchFilter==='Atención'&&d.status==='Atención')||(mock.batchFilter==='Pendientes'&&d.status==='Pendiente')||(mock.batchFilter==='Listos'&&d.status==='Listo'));
 return `${heading('TRABAJO POR LOTES','Muchos documentos. <em>Una sola visión.</em>','Ves lo que requiere atención sin perder lo ya resuelto. Cada documento conserva su estado y sus acciones.',chip('lote_consultas_octubre')+chip('7 documentos'))}
 <div class="batch-summary"><div class="stat"><strong>07</strong><span>Documentos en el lote</span></div><div class="stat"><strong>03</strong><span>Listos para salida</span></div><div class="stat"><strong>02</strong><span>Revisión pendiente</span></div><div class="stat"><strong style="color:var(--red)">02</strong><span>Con incidencia local</span></div></div>
 <div class="batch-grid"><section class="panel"><div class="pane-header"><div><h2 class="panel-title">Cola de documentos</h2><p class="panel-sub">Selecciona un elemento para continuar</p></div></div><div class="filter-strip">${['Todos','Atención','Pendientes','Listos'].map(f=>`<button class="filter-chip ${mock.batchFilter===f?'active':''}" data-filter="${f}" aria-pressed="${mock.batchFilter===f}">${f}</button>`).join('')}</div><div class="batch-items">${shown.map(d=>`<button type="button" class="batch-item ${d.i===mock.selectedDoc?'selected':''}" data-doc="${d.i}" aria-pressed="${d.i===mock.selectedDoc}"><span class="batch-num">${String(d.i+1).padStart(2,'0')}</span><span class="batch-info"><span class="batch-filename">${d.name}</span><span class="batch-subtitle">${d.note}</span></span>${chip(d.status,d.status==='Atención'?'danger':d.status==='Listo'?'success':'warning')}</button>`).join('')}</div></section>
 <section class="panel"><div class="pane-header"><div><h2 class="panel-title">Documento seleccionado</h2><p class="panel-sub">${current.name}</p></div>${chip(current.status,current.status==='Atención'?'danger':current.status==='Listo'?'success':'warning')}</div><div class="batch-preview"><article class="doc-paper"><h4>${current.status==='Atención'?'Atención requerida':'Resumen de consulta'}</h4>${current.status==='Atención'?'<p>Este documento no pudo procesarse correctamente. Los demás elementos del lote mantienen sus decisiones y resultados.</p><p>Comprueba el archivo original y vuelve a intentarlo o retíralo del lote deliberadamente.</p>':'<p>Paciente de demostración: <span class="marked">[IDENTIFICADOR DETECTADO]</span></p><p>Evaluación clínica documentada en consulta. Se propone proteger los identificadores preservando la descripción de los hallazgos.</p><p>Consulta registrada el <span class="marked soft">14/09/2025</span>. Seguimiento según evolución.</p>'}</article><aside class="batch-inspector"><div class="smallcaps">PRÓXIMA ACCIÓN</div><h3 class="inspector-name" style="margin-top:8px">${current.status==='Atención'?'Resolver incidencia':current.status==='Listo'?'Documento listo':'Continuar revisión'}</h3><p class="muted" style="font-size:11px;line-height:1.8">${current.status==='Atención'?'No se invalida el trabajo del resto del lote.':'Las decisiones de cada documento se conservan de forma independiente.'}</p>${current.status==='Atención'?btn('Reintentar este documento','retry-doc','outline'):current.status==='Listo'?btn('Ver resultado','go-result','primary'):btn('Revisar documento','go-review','primary')}<div class="divider"></div><button class="text-link" data-action="remove-doc">Retirar del lote…</button></aside></div></section></div>
 <div class="workspace-actions"><span class="muted" style="font-size:11px">Los documentos con incidencia no desaparecen del resumen.</span>${btn('Ver resumen del lote &nbsp; →','go-result','primary')}</div>`;
}
function structuredView(){
 const selected=structuredColumns[mock.selectedColumn];
 return `${heading('CONFIGURACIÓN · TABLAS','Tus columnas, <em>bajo control.</em>','Clasificación, tratamiento y bloqueos en una sola comparación. Selecciona una columna para revisar sus decisiones.',chip('tabla_sintetica_32.csv')+chip('32 columnas'))}
  <div class="structured-summary"><div class="summary-stat"><strong>32</strong><span>Columnas detectadas</span></div><div class="summary-stat"><strong>${structuredColumns.filter(c=>c.status==='Pendiente').length}</strong><span>Pendientes de revisión</span></div><div class="summary-stat"><strong>01</strong><span>Bloqueo de fecha por resolver</span></div><div class="summary-stat rose-wash"><label class="field-label" for="pid">Identificador único del paciente</label><select class="form-select" id="pid" data-pid><option ${mock.patientId==='NHC'?'selected':''}>NHC</option><option ${mock.patientId==='Sin seleccionar'?'selected':''}>Sin seleccionar</option><option ${mock.patientId==='CampoLibre01'?'selected':''}>CampoLibre01</option></select></div></div>
  <div class="compact-alert" style="margin-bottom:14px"><span style="font-size:16px">◇</span><div><strong>La salida estructurada todavía no está preparada.</strong><br>Quedan columnas desconocidas y una fecha sin tratamiento aceptado. No se conservarán automáticamente.</div></div>
  <div class="structured-grid"><section class="panel"><div class="table-head"><div><h2 class="panel-title">Comparativa de columnas</h2><p class="panel-sub">Datos sintéticos · fila seleccionada resaltada · desplazamiento horizontal propio en móvil</p></div>${chip('4 campos visibles')}</div><div class="table-region" tabindex="0" role="region" aria-label="Tabla comparativa desplazable"><table class="comparison"><thead><tr><th>Columna</th><th>Clasificación</th><th>Tratamiento efectivo</th><th>Estado</th></tr></thead><tbody>${structuredColumns.map((c)=>`<tr class="${c.id===mock.selectedColumn?'selected':''}"><td><button class="colname-btn" aria-pressed="${c.id===mock.selectedColumn}" data-column="${c.id}">${String(c.id+1).padStart(2,'0')}. ${c.name}</button></td><td>${c.classification}</td><td>${c.action}</td><td>${chip(c.status,c.status==='Pendiente'?'warning':c.status==='Definido'?'success':'')}</td></tr>`).join('')}</tbody></table></div></section>
  <aside class="panel" id="column-inspector"><div class="pane-header"><div><span class="smallcaps">INSPECTOR CONTEXTUAL</span><h2 class="inspector-name">${selected.name}</h2></div>${chip(selected.status,selected.status==='Pendiente'?'warning':'success')}</div><div class="inspector-body"><div class="fact-row"><span>Clase actual</span><strong>${selected.classification}</strong></div><div class="fact-row"><span>Acción efectiva</span><strong>${selected.action}</strong></div><div class="fact-row"><span>Bloqueo</span><strong>${selected.status==='Pendiente'?'Sí, requiere decisión':'No'}</strong></div><div style="margin-top:19px"><label class="field-label" for="class-select">Modificar clasificación</label><select class="form-select" id="class-select" data-class><option ${selected.classification==='Desconocida'?'selected':''}>Desconocida</option><option ${selected.classification==='Identificador'?'selected':''}>Identificador</option><option ${selected.classification==='Cuasi-identificador'?'selected':''}>Cuasi-identificador</option><option ${selected.classification==='Sensible'?'selected':''}>Sensible</option><option ${selected.classification==='No sensible'?'selected':''}>No sensible</option></select></div><div style="margin-top:14px"><label class="field-label" for="action-select">Tratamiento permitido</label><select class="form-select" id="action-select" data-column-action><option ${selected.action==='Revisar'?'selected':''}>Revisar</option><option ${selected.action==='Eliminar'?'selected':''}>Eliminar</option><option ${selected.action==='Seudonimizar'?'selected':''}>Seudonimizar</option><option ${selected.action==='Conservar'?'selected':''}>Conservar</option><option ${selected.action==='Procesar como texto'?'selected':''}>Procesar como texto</option><option ${selected.action==='ID de estudio'?'selected':''}>ID de estudio</option></select></div><details style="margin-top:16px"><summary style="font-size:11px;font-weight:700;color:var(--rose-deep);cursor:pointer">Ver evidencia y propuesta detectada</summary><p class="footnote" style="margin:8px 0">Propuesta sintética, sin valores de pacientes. En producción, las acciones disponibles derivan de las autoridades de clasificación.</p></details><div class="divider"></div>${btn('Siguiente columna pendiente →','next-column','outline','style="width:100%"')}</div></aside></div>
 <div class="workspace-actions"><details class="soft-panel" style="padding:11px 17px;min-width:230px"><summary style="font-size:11px;font-weight:750;color:var(--rose-deep);cursor:pointer">Opciones de salida y Study ID</summary><p class="footnote" style="margin:10px 0">Las opciones de formato no alteran los criterios de privacidad.</p><input class="form-input" value="ESTUDIO-" aria-label="Prefijo Study ID" readonly></details>${btn('Continuar a comprobación &nbsp; →','go-gate','outline')}</div>
 <p class="footnote" style="margin-top:9px">En la aplicación real, los bloqueos impiden preparar la salida hasta resolver las decisiones pertinentes. Esta maqueta únicamente muestra la composición.</p>`;
}
function cellsView(){
 return `${heading('REVISIÓN · CELDAS DE TEXTO LIBRE','El contexto <em>también cuenta.</em>','Cuando una columna se trata como texto libre, revisas las celdas que lo necesitan. Si no hay ninguna, este paso no aparece.',chip('tabla_sintetica_32.csv')+chip('3 celdas para revisar'))}
  <div class="subnav">${chip('La clasificación de columnas se conserva','success')}${chip('Revisión de texto libre · activa','warning')}</div>
  <div class="cell-grid"><section class="panel"><div class="pane-header"><div><h2 class="panel-title">Celdas pendientes</h2><p class="panel-sub">Columna: notas_libres</p></div>${chip('03')}</div><div class="cell-list"><button class="cell-item active">Fila 02 · notas_libres <small>Una detección por decidir</small></button><button class="cell-item">Fila 05 · notas_libres <small>Dos detecciones por decidir</small></button><button class="cell-item">Fila 08 · notas_libres <small>Sin cambios confirmados</small></button></div></section>
  <section class="panel"><div class="pane-header"><div><h2 class="panel-title">Contenido de celda</h2><p class="panel-sub">Fila 02 · texto clínico preservado</p></div>${chip('Original sintético')}</div><article class="cell-text">Control de seguimiento. Se revisa a <span class="marked">[PACIENTE DE EJEMPLO]</span> por evolución dermatológica. La persona refiere mejoría y ausencia de eventos adversos. Próxima valoración el <span class="marked soft">12/11/2025</span>. Se mantiene el plan establecido.</article></section>
  <aside class="panel"><div class="pane-header"><div><h2 class="panel-title">Resolver detección</h2><p class="panel-sub">Una decisión por vez</p></div></div><div class="inspector-body"><span class="smallcaps">IDENTIFICADOR EN CELDA</span><div class="decision-excerpt">[PACIENTE DE EJEMPLO]</div><div class="decision-options"><button class="decision-option" data-action="cell-accept">✓ &nbsp; Sustituir identificador</button><button class="decision-option" data-action="cell-modify">✎ &nbsp; Modificar sustitución</button><button class="decision-option" data-action="cell-keep">◇ &nbsp; Conservar deliberadamente</button></div><p class="footnote" style="margin-top:13px">Volver a Configurar no borra las decisiones de columnas.</p></div></aside></div>
 <div class="workspace-actions"><button class="text-link" data-route="estructurado">← &nbsp; Volver a columnas</button>${btn('Comprobar privacidad &nbsp; →','go-gate','primary')}</div>`;
}
function gateView(){
 const ready=!mock.gateBlocked;
 return `${heading('PUNTO DE CONTROL · PRIVACIDAD','Antes de preparar <em>la salida.</em>','Una comprobación clara del estado actual, sin convertir la revisión en una pantalla de marketing.',`<div class="state-switch" aria-label="Estados ilustrativos"><button data-gate-state="ready" class="${ready?'active':''}" aria-pressed="${ready}">Ejemplo listo</button><button data-gate-state="blocked" class="${!ready?'active':''}" aria-pressed="${!ready}">Ejemplo bloqueado</button></div>`)}
  <div class="gate-overview"><section class="gate-hero">${eyebrow('COMPROBACIÓN DEL TRABAJO')}<h2>La tranquilidad de <em style="color:var(--rose);font-weight:400">saber dónde estás.</em></h2><p class="task-description" style="font-size:13px;max-width:510px">El Laboratorio comprueba el estado de la revisión y la política vigente. Si falta una decisión, el proceso no ofrece una salida segura.</p><div style="margin-top:24px">${ready?chip('Preparación disponible','success'):chip('Salida no autorizada','danger')}</div></section>
  <section class="panel panel-pad"><div class="smallcaps">ESTADO ACTUAL</div><h2 style="font:600 34px var(--serif);margin:7px 0 4px">${ready?'Todo listo para continuar':'Faltan decisiones'}</h2><p class="muted" style="font-size:11px">Política vigente · Estándar</p><div class="gate-checklist"><div class="gate-check"><span class="status-icon">✓</span><div><strong>Información cargada</strong><small>Trabajo identificado y preparado localmente</small></div></div><div class="gate-check"><span class="status-icon" style="${ready?'':'background:#fff0f0;color:#943f49'}">${ready?'✓':'!'}</span><div><strong>Revisión humana</strong><small>${ready?'Decisiones completadas':'2 detecciones pendientes de resolver'}</small></div></div><div class="gate-check"><span class="status-icon">✓</span><div><strong>Política de privacidad</strong><small>Vigente y reconocida para este tipo de trabajo</small></div></div></div><div style="margin-top:17px;display:grid;gap:8px">${ready?btn('Continuar al resultado &nbsp; →','go-result','primary'):btn('Volver a correcciones &nbsp; →','go-review','primary')}${btn('Revisar la política','policy-help','subtle')}</div></section></div>
  <p class="footnote" style="margin-top:15px">Los estados anteriores son demostrativos. Los bloqueos reales dependen de las reglas de privacidad y de las decisiones humanas, no del diseño visual.</p>`;
}
function resultView(){
 const ready=!mock.resultBlocked;
 return `<div class="screen-header"><div><div class="step-context">RESULTADO · FINAL DEL RECORRIDO</div></div><div class="state-switch" aria-label="Estados ilustrativos"><button data-result-state="ready" class="${ready?'active':''}" aria-pressed="${ready}">Lista</button><button data-result-state="blocked" class="${!ready?'active':''}" aria-pressed="${!ready}">Necesita atención</button></div></div>
 <section class="result-hero"><div>${eyebrow('TU INFORMACIÓN, PREPARADA CON CRITERIO')}<h1 class="result-title">${ready?'Ahora sí. <em>Con confianza.</em>':'Aún queda <em>una decisión.</em>'}</h1><p class="task-description" style="font-size:13px;max-width:565px;margin-bottom:20px">${ready?'Has revisado las detecciones y puedes continuar con el texto preparado. El resultado mantiene separado cualquier material confidencial.':'La revisión sigue pendiente. No se puede preparar ni descargar la salida hasta resolver las decisiones que faltan.'}</p><div class="result-actions">${btn('Copiar texto preparado &nbsp; ↗','copy-output','primary',ready?'':'disabled')}${btn('Volver a revisión','go-review','outline')}</div></div><aside class="ready-stamp" style="${ready?'':'background:#fff0ef;border-color:#eac6c4'}"><span style="font-size:24px;color:${ready?'var(--sage)':'var(--red)'}">${ready?'✓':'◇'}</span><strong style="${ready?'':'color:var(--red)'}">${ready?'Salida preparada':'Salida bloqueada'}</strong><small>${ready?'La acción principal es el texto preparado. Otros formatos quedan disponibles según el material.':'Las decisiones anteriores siguen disponibles para corregirse. No se muestra una falsa descarga.'}</small></aside></section>
 <div class="result-grid"><section class="panel panel-pad"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h2 class="panel-title">Texto preparado</h2><p class="panel-sub">Vista previa · contenido estrictamente sintético</p></div>${chip(ready?'Salida segura':'No disponible',ready?'success':'danger')}</div>${ready?`<div class="prepared-note" style="margin-top:15px">Informe de seguimiento clínico<br>Paciente: [IDENTIFICADOR PROTEGIDO]<br>Referencia: [NHC PROTEGIDO]<br><br>Seguimiento dermatológico. Evolución favorable, sin incidencias relevantes. Próxima valoración prevista según resultados.</div>`:`<div class="prepared-note" style="margin-top:15px;color:var(--ink-faint)">La vista previa se habilitará cuando la revisión esté completa. No hay contenido preparado disponible.</div>`}<div class="workspace-actions" style="margin-top:13px"><span class="footnote">${ready?'1 original conservado deliberadamente · revisar advertencia antes de compartir':'El resultado no se genera a partir de decisiones pendientes'}</span>${btn('Otros formatos ▾','other-formats','subtle','style="min-height:34px"')}</div></section>
 <aside class="panel panel-pad"><span class="smallcaps">ANTES DE COMPARTIR</span><h2 style="font:600 30px/1.08 var(--serif);margin:9px 0 15px">Tu última mirada.</h2><p class="muted" style="font-size:12px;line-height:1.8">${ready?'Has conservado un dato original de manera deliberada. Comprueba que quieres incluirlo en el contexto de destino.':'Una o varias detecciones siguen pendientes. Regresa a la revisión y completa las decisiones.'}</p><div class="soft-panel" style="margin-top:17px;font-size:11px;color:var(--rose-deep)">${ready?'◇ Un original conservado no se oculta detrás de un indicador verde.':'◇ Una salida bloqueada no ofrece formatos alternativos.'}</div><div class="divider"></div>${btn('Regresar a la revisión','go-review','outline','style="width:100%"')}</aside></div>
 <section class="confidential"><div style="display:flex;gap:13px;align-items:flex-start"><span style="font-size:26px;line-height:1;color:var(--red)">◇</span><div><h2 class="confidential-heading">Auditoría confidencial · acceso deliberado</h2><p>La correspondencia con datos originales nunca es un formato más de la salida segura. Exige una decisión explícita adicional y mantiene una separación visual inequívoca.</p>${btn('Solicitar acceso confidencial','confidential','danger',''+(ready?'':'disabled'))}</div></div></section>`;
}
function render(preserveScroll=false){
 const y=window.scrollY;
 const view=mock.current;
 const nav=document.querySelector('#prototype-nav');
 nav.innerHTML=VIEWS.map(([id,name],i)=>`<button type="button" data-route="${id}" aria-current="${view===id?'page':'false'}">${String(i+1).padStart(2,'0')} &nbsp;${name}</button>`).join('');
 document.querySelector('#current-job-label').textContent = view==='entrada'?'Sin trabajo activo':view==='lote'?'Lote · 7 documentos':view==='estructurado'||view==='celdas'?'Tabla · 32 columnas':'Trabajo de ejemplo';
 const views={entrada:inputView,revision:reviewView,lote:batchView,estructurado:structuredView,celdas:cellsView,comprobacion:gateView,resultado:resultView};
 document.querySelector('#screen').innerHTML=views[view]();
 document.title=`${VIEWS.find(v=>v[0]===view)?.[1]} · Laboratorio Sophilux B · Propuesta`;
 if(preserveScroll) window.scrollTo(0,y);
 else window.scrollTo(0,0);
}
let toastTimeout;
function toast(message){const node=document.querySelector('#toast');node.textContent=message;node.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('visible'),4200)}
function route(to){mock.current=to;location.hash=to;render();}
document.addEventListener('click', e=>{
 const target=e.target.closest('button'); if(!target)return;
 const {route:dest,mode,detection,decision,filter,doc,column,gateState,resultState,action}=target.dataset;
 if(dest){route(dest);return}
 if(mode){mock.inputMode=mode;render(true);return}
 if(detection!==undefined){mock.selectedDetection=Number(detection);render(true);return}
 if(decision){mock.decisions[mock.selectedDetection]=decision;render(true);toast('Decisión simulada. La maqueta no procesa datos.');return}
 if(filter){mock.batchFilter=filter;const shown=docs.map((d,i)=>({...d,i})).filter(d=>filter==='Todos'||(filter==='Atención'&&d.status==='Atención')||(filter==='Pendientes'&&d.status==='Pendiente')||(filter==='Listos'&&d.status==='Listo'));if(shown.length&&!shown.some(d=>d.i===mock.selectedDoc))mock.selectedDoc=shown[0].i;render(true);return}
 if(doc!==undefined){mock.selectedDoc=Number(doc);render(true);return}
 if(column!==undefined){mock.selectedColumn=Number(column);render(true);if(window.innerWidth<851)document.getElementById('column-inspector')?.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(gateState){mock.gateBlocked=gateState==='blocked';render(true);return}
 if(resultState){mock.resultBlocked=resultState==='blocked';render(true);return}
 if(!action)return;
 switch(action){
  case 'new':route('entrada');return;
  case 'start-review':case 'go-review':route('revision');return;
  case 'start-batch':case 'file-demo':route('lote');return;
  case 'go-gate':route('comprobacion');return;
  case 'go-result':route('resultado');return;
  case 'next-column': {let next=structuredColumns.find(c=>c.id>mock.selectedColumn&&c.status==='Pendiente')||structuredColumns.find(c=>c.status==='Pendiente');if(next){mock.selectedColumn=next.id;render(true)}return;}
  case 'help':toast('La ayuda detallada se diseñará por contexto, sin repetirse bajo cada pantalla.');return;
  case 'example':document.getElementById('demo-text').value='Consulta sintética. Paciente [EJEMPLO]. NHC-000042. Seguimiento realizado el 12/03/2025.';toast('Ejemplo sintético cargado.');return;
  case 'copy-output':toast('Demostración: el botón no copia ni genera información clínica.');return;
  case 'other-formats':toast('Aquí se mostrarían únicamente los formatos autorizados para este material.');return;
  case 'confidential':toast('En V4, esta acción requiere una confirmación adicional y explícita.');return;
  case 'policy-help':toast('La política real depende del material y no se duplica en la interfaz.');return;
  case 'retry-doc':case 'remove-doc':toast('Acción demostrativa: el lote no se modifica.');return;
  default: toast('Interacción visual de ejemplo, sin procesamiento real.');
 }
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-pid]')){mock.patientId=e.target.value;render(true);toast('Selector simulado: no modifica la autoridad clínica real.');return;}
 if(e.target.matches('[data-class]')){const c=structuredColumns[mock.selectedColumn];c.classification=e.target.value;c.status=e.target.value==='Desconocida'?'Pendiente':'Definido';if(c.status==='Definido'&&c.action==='Revisar')c.action='Conservar';render(true);toast('Fila actualizada en la propuesta visual; no se han aplicado reglas clínicas.');}
 if(e.target.matches('[data-column-action]')){const c=structuredColumns[mock.selectedColumn];c.action=e.target.value;c.status=e.target.value==='Revisar'?'Pendiente':'Definido';render(true)}
});
window.addEventListener('hashchange',()=>{const dest=decodeURIComponent(location.hash.slice(1));if(VIEWS.some(v=>v[0]===dest)&&mock.current!==dest){mock.current=dest;render()}});
const initial=decodeURIComponent(location.hash.slice(1));if(VIEWS.some(v=>v[0]===initial))mock.current=initial;
render();
