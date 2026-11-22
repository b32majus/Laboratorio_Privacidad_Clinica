"use strict";
/* R6 presentational prototype ONLY: no persistence, fetch, exports, processing
   or clinical/reviewer decisions. Selection changes the inspector context only.
   These names/statuses are illustrative, not serialized from source patients. */
const HEADERS = Object.freeze([
  "NHC","DNI","Fecha_Visita","Fecha_Nacimiento","Centro","Diagnostico",
  "Notas","Telefono","Email_Contacto","Direccion","Codigo_Postal","Medico",
  "Tratamiento","Medicacion","Motivo_Consulta","Edad","Sexo","Peso_Kg",
  "Talla_Cm","Tension_Arterial","Glucosa","Alergias","Dosis","Servicio",
  "Planta","Cama","Fecha_Alta","Motivo_Ingreso","Observaciones_Libres",
  "ZZ_Campo_Libre_F3","Codigo_Episodio","Grupo_Sanguineo"
]);
const CLASSIFICATIONS = Object.freeze([
  "Identificador","Identificador","Cuasi-identificador","Cuasi-identificador",
  "Cuasi-identificador","Sensible","Desconocido","Identificador","Identificador",
  "Identificador","Desconocido","Identificador","Sensible","Sensible","Sensible",
  "Desconocido","Desconocido","Desconocido","Desconocido","Desconocido",
  "Desconocido","Desconocido","Desconocido","Cuasi-identificador",
  "Cuasi-identificador","Desconocido","Desconocido","Desconocido","Desconocido",
  "Desconocido","Desconocido","Desconocido"
]);
const PENDING = Object.freeze([2,3,6,10,15,16,17,18,19,20,21,22,25,26,27,28,29,30,31]);
const pendingSet = new Set(PENDING);
const tableBody = document.getElementById("column-rows");
const message = document.getElementById("demo-message");
let selectedIndex = 2;
let activeFilter = "all";
function dataFor(index) {
  const pending = pendingSet.has(index), name = HEADERS[index], classification = CLASSIFICATIONS[index];
  const treatment = pending ? "Requiere revisión" :
    classification === "Identificador" || classification === "Sensible" ? "Eliminar" :
    classification === "Cuasi-identificador" ? "Seudonimizar" : "Conservar";
  return {name, classification, treatment, pending, dateRole:"Ninguno"};
}
function td(value) {
  const el=document.createElement("td");
  el.textContent=value;
  return el;
}
function renderTable() {
  tableBody.replaceChildren();
  HEADERS.forEach((name,index) => {
    if(activeFilter==="pending"&&!pendingSet.has(index))return;
    const data = dataFor(index);
    const tr=document.createElement("tr");
    tr.setAttribute("aria-selected",String(index===selectedIndex));
    const first=document.createElement("td");
    const number=document.createElement("span");
    number.className="ordinal";number.textContent=(index+1)+".";
    const button=document.createElement("button");
    button.type="button";button.textContent=name;
    button.setAttribute("aria-pressed",String(index===selectedIndex));
    button.addEventListener("click",()=>{
      selectColumn(index);
      document.getElementById("decision").scrollIntoView({block:"start",behavior:"smooth"});
      document.getElementById("active-name").focus?.();
    });
    first.append(number,button);
    tr.append(first,td(data.classification),td(data.treatment),td(data.pending?"Requiere revisión":"Sin pendientes"));
    tableBody.append(tr);
  });
}
function selectColumn(index) {
  selectedIndex=index;
  const data=dataFor(index);
  document.getElementById("active-position").textContent=(index+1)+" / 32";
  document.getElementById("active-name").textContent=data.name;
  document.querySelectorAll("[data-name]").forEach(n=>n.textContent=data.name);
  document.getElementById("active-class").textContent=data.classification;
  document.getElementById("active-treatment").textContent=data.treatment;
  document.getElementById("active-date").textContent=data.dateRole;
  const status=document.getElementById("active-status");
  status.textContent=data.pending?"Requiere revisión":"Sin pendientes";
  status.className="tag "+(data.pending?"pending":"done");
  document.getElementById("class-select").value=data.classification;
  document.getElementById("date-select").value=data.dateRole;
  const action=document.getElementById("action-select");
  action.replaceChildren(new Option(data.treatment,data.treatment));
  action.value=data.treatment;
  const hint=document.getElementById("active-guidance");
  hint.textContent=data.pending ?
    "Esta columna continúa pendiente: la clasificación, el rol o la acción deben resolverse desde la aplicación real. Nunca se acepta automáticamente." :
    "Esta fila no tiene pendientes en la demostración. Eso no significa que toda la tabla esté preparada: quedan 19 pendientes.";
  message.textContent="Columna "+(index+1)+" seleccionada para visualizarla. Sin cambios en clasificaciones ni salidas.";
  renderTable();
}
function showDemoOnly(label) {
  message.textContent=label+" no se ejecuta en la maqueta. No hay datos ni decisiones almacenadas.";
}
document.querySelectorAll("[data-demo-action]").forEach(button=>
  button.addEventListener("click",()=>showDemoOnly(button.dataset.demoAction)));
for(const select of ["class-select","date-select","action-select","patient-id-column"]){
  const node=document.getElementById(select);
  node.addEventListener("change",()=>{
    const original=select==="class-select"?dataFor(selectedIndex).classification:
      select==="action-select"?dataFor(selectedIndex).treatment:
      select==="date-select"?"Ninguno":"Sin seleccionar";
    node.value=original;
    showDemoOnly("Cambiar clasificación/rol/acción/identificación");
  });
}
document.getElementById("next-pending").addEventListener("click",()=>{
  const next=PENDING.find(index=>index>selectedIndex)??PENDING[0];
  selectColumn(next);
});
document.querySelectorAll("[data-filter]").forEach(button=>{
  button.addEventListener("click",()=>{
    activeFilter=button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
    renderTable();
  });
});
document.querySelector('a[href="#tabla"]').addEventListener("click",()=>{
  activeFilter="all";
  document.querySelectorAll("[data-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.filter==="all")));
  renderTable();
});
selectColumn(selectedIndex);
