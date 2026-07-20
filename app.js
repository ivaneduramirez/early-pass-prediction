"use strict";

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 1) => x == null ? "—" : Number(x).toLocaleString("es-EC", { maximumFractionDigits: d, minimumFractionDigits: 0 });

const estado = { indice: null, datos: {}, historico: null, periodo: null, carrera: "", asig: null, peticion: 0, activo: -1 };

const NIVEL_ORD = {
  PRIMERO: 1, SEGUNDO: 2, TERCERO: 3, CUARTO: 4, QUINTO: 5, SEXTO: 6,
  SEPTIMO: 7, "SÉPTIMO": 7, OCTAVO: 8, NOVENO: 9, DECIMO: 10, "DÉCIMO": 10,
  "DECIMO PRIMERO": 11, "DÉCIMO PRIMERO": 11, "DECIMO SEGUNDO": 12, "DÉCIMO SEGUNDO": 12,
};
const ANIO_DE_NIVEL = (n) => { const o = NIVEL_ORD[n]; return o ? Math.ceil(o / 2) : null; };

async function cargarJSON(ruta) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`no se pudo cargar ${ruta}`);
  return r.json();
}

async function init() {
  estado.indice = await cargarJSON("data/indice.json");
  cargarJSON("data/historico.json").then(h => { estado.historico = h; }).catch(() => {});
  const sel = $("sel-periodo");
  for (const p of estado.indice.periodos) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.nombre + (p.cerrado ? "" : "  · en curso (sin cierre)");
    sel.appendChild(o);
  }
  sel.value = estado.indice.periodos.find(p => !p.cerrado)?.id ?? estado.indice.periodos[0].id;
  sel.addEventListener("change", () => cambiarPeriodo(Number(sel.value)).catch(mostrarError));
  $("sel-carrera").addEventListener("change", () => {
    estado.carrera = $("sel-carrera").value;
    limpiarAsignatura();
  });

  const inp = $("inp-asig");
  inp.addEventListener("input", refrescarLista);
  inp.addEventListener("focus", refrescarLista);
  inp.addEventListener("keydown", teclado);
  inp.addEventListener("focusout", (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest?.(".buscador")) ocultarLista();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".buscador")) ocultarLista();
  });
  $("volver-carrera").addEventListener("click", () => {
    estado.asig = null;
    $("inp-asig").value = "";
    mostrarVistaCarrera();
    $("vista-carrera").scrollIntoView({ block: "start", behavior: "smooth" });
  });

  await cambiarPeriodo(Number(sel.value));
}

function limpiarAsignatura() {
  estado.asig = null;
  $("inp-asig").value = "";
  $("panel").hidden = true;
  $("aviso-carga").hidden = true;
  ocultarLista();
  // sin asignatura elegida: si hay una carrera filtrada, mostrar su malla
  if (estado.carrera && estado.datos[estado.periodo]) mostrarVistaCarrera();
  else $("vista-carrera").hidden = true;
}

function mostrarError(e) {
  const aviso = $("aviso-periodo");
  aviso.textContent = `No se pudieron cargar los datos (${e.message}). Revisa la conexión e intenta de nuevo.`;
  aviso.hidden = false;
}

async function cambiarPeriodo(id) {
  estado.periodo = id;
  const peticion = ++estado.peticion;
  const selP = $("sel-periodo"), selC = $("sel-carrera"), inp = $("inp-asig");
  if (!estado.datos[id]) {
    // datos aún no cacheados: avisar de la carga y bloquear los controles
    limpiarAsignatura();
    const aviso = $("aviso-periodo");
    aviso.textContent = "Cargando período…";
    aviso.hidden = false;
    selP.disabled = selC.disabled = inp.disabled = true;
    try {
      estado.datos[id] = await cargarJSON(`data/periodo_${id}.json`);
    } finally {
      if (peticion === estado.peticion) selP.disabled = selC.disabled = inp.disabled = false;
    }
  }
  if (peticion !== estado.peticion) return; // llegó tarde: otro período ya fue pedido
  const d = estado.datos[id];
  const aviso = $("aviso-periodo");
  if (!d.cerrado) {
    aviso.textContent = `${d.nombre} está en curso: aún no existen notas finales. Todo lo que ves es predicción hecha con el primer parcial — el caso de uso real.`;
    aviso.hidden = false;
  } else {
    aviso.textContent = `${d.nombre} ya cerró: puedes comparar la predicción (hecha solo con el primer parcial, con un modelo que no vio este período) contra el resultado real.`;
    aviso.hidden = false;
  }

  const carreras = [...new Set(d.asignaturas.map(a => a.carrera))].sort();
  selC.innerHTML = "";
  selC.appendChild(new Option("Todas las carreras", ""));
  for (const c of carreras) selC.appendChild(new Option(c, c));
  if (carreras.includes(estado.carrera)) selC.value = estado.carrera; else { estado.carrera = ""; }

  // al cambiar de período la asignatura se resetea
  limpiarAsignatura();
}

const plano = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function asignaturasFiltradas() {
  const d = estado.datos[estado.periodo];
  const q = plano($("inp-asig").value.trim());
  let lista = d.asignaturas;
  if (estado.carrera) lista = lista.filter(a => a.carrera === estado.carrera);
  if (q) lista = lista.filter(a => plano(a.asignatura).includes(q) || plano(a.carrera).includes(q));
  return lista.slice(0, 40);
}

function refrescarLista() {
  const ul = $("lista-asig");
  if (document.activeElement !== $("inp-asig")) { ul.hidden = true; return; }
  const lista = asignaturasFiltradas();
  estado.activo = -1;
  // al reconstruir la lista, ninguna opción está activa: no dejar el id colgando
  $("inp-asig").removeAttribute("aria-activedescendant");
  ul.innerHTML = "";
  lista.forEach((a, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `op-${i}`;
    li.innerHTML = `${a.asignatura}<span class="li-meta">${a.carrera} · ${a.n_matric} estudiantes</span>`;
    // sin esto, el mousedown roba el foco del input, focusout cierra la lista
    // y el click nunca llega a la opcion
    li.addEventListener("mousedown", (e) => e.preventDefault());
    li.addEventListener("click", () => { seleccionar(a); ocultarLista(); });
    ul.appendChild(li);
  });
  ul.hidden = lista.length === 0;
  $("inp-asig").setAttribute("aria-expanded", String(!ul.hidden));
}

function teclado(e) {
  const ul = $("lista-asig");
  const ops = [...ul.children];
  if (e.key === "Escape") { ocultarLista(); return; }
  if (e.key === "Enter") {
    e.preventDefault();
    const li = ops[estado.activo] ?? ops[0];
    if (li && !ul.hidden) li.click();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  if (ul.hidden) { refrescarLista(); return; }
  const paso = e.key === "ArrowDown" ? 1 : -1;
  estado.activo = Math.min(Math.max(estado.activo + paso, 0), ops.length - 1);
  ops.forEach((li, i) => li.setAttribute("aria-selected", String(i === estado.activo)));
  const act = ops[estado.activo];
  if (act) {
    act.scrollIntoView({ block: "nearest" });
    $("inp-asig").setAttribute("aria-activedescendant", act.id);
  }
}

function ocultarLista() {
  $("lista-asig").hidden = true;
  estado.activo = -1;
  $("inp-asig").setAttribute("aria-expanded", "false");
  $("inp-asig").removeAttribute("aria-activedescendant");
}

const ordenNivel = (a) => (NIVEL_ORD[a?.nivel] ?? 99);

function mostrarVistaCarrera() {
  const d = estado.datos[estado.periodo];
  $("panel").hidden = true;
  const vc = $("vista-carrera");
  const asigs = d.asignaturas.filter(a => a.carrera === estado.carrera)
    .sort((x, y) => ordenNivel(x) - ordenNivel(y) || x.asignatura.localeCompare(y.asignatura, "es"));
  if (!asigs.length) { vc.hidden = true; return; }
  vc.hidden = false;
  const fac = asigs[0].facultad;
  $("vc-titulo").textContent = estado.carrera;
  $("vc-meta").textContent = `${fac} · ${asigs.length} asignaturas · período ${d.nombre}. Haz clic en una asignatura para ver su detalle.`;

  const tb = $("tabla-carrera").querySelector("tbody");
  tb.innerHTML = "";
  let nivelActual = null;
  for (const a of asigs) {
    if (a.nivel !== nivelActual) {
      nivelActual = a.nivel;
      const anio = ANIO_DE_NIVEL(a.nivel);
      const trh = document.createElement("tr");
      trh.className = "nivel-fila";
      trh.innerHTML = `<th colspan="5" scope="colgroup">${a.nivel ?? "SIN NIVEL"}${anio ? ` · ${anio}.º año` : ""}</th>`;
      tb.appendChild(trh);
    }
    const rep = Math.round(a.reprob_esp * 0.49);
    const aprobCell = d.cerrado && a.real_pct != null
      ? `${fmt(a.pred_pct)}% <span class="muted">pred</span> · ${fmt(a.real_pct)}% <span class="muted">real</span>`
      : `${fmt(a.pred_pct)}% <span class="muted">pred</span>`;
    // fila normal (semántica de tabla intacta); el nombre es un <button> real
    // que aporta foco/teclado/nombre accesible. La fila entera queda clicable
    // para el ratón; el click del botón burbujea al único listener de la fila.
    const tr = document.createElement("tr");
    tr.className = "asig-fila";
    tr.innerHTML = `
      <td><button type="button" class="link-asig">${a.asignatura}</button></td>
      <td class="num">${fmt(a.n_matric, 0)}</td>
      <td class="num">${fmt(a.paralelos, 0)}</td>
      <td class="num">${aprobCell}</td>
      <td class="num">${fmt(rep, 0)}</td>`;
    tr.addEventListener("click", () => seleccionar(a, true));
    tb.appendChild(tr);
  }
}

function renderHistorico(a) {
  const cont = $("historico-chart");
  const sec = $("historico");
  const clave = `${a.facultad}|${a.carrera}|${a.asignatura}`;
  const serie0 = estado.historico?.[clave];
  const d = estado.datos[estado.periodo];
  if (!serie0 || !serie0.length) { sec.hidden = true; return; }
  // solo períodos hasta el seleccionado (no mostrar futuro en una herramienta de planificación)
  const serie = serie0.filter(p => p.p <= d.nombre).slice(-10);
  if (!serie.length) { sec.hidden = true; return; }
  sec.hidden = false;
  const maxM = Math.max(...serie.map(p => p.m));
  cont.innerHTML = "";
  for (const p of serie) {
    const h = maxM ? Math.round((p.m / maxM) * 100) : 0;
    const actual = p.p === d.nombre;
    const col = document.createElement("div");
    col.className = "h-col" + (actual ? " actual" : "");
    col.innerHTML = `
      <span class="h-par">${p.par}</span>
      <div class="h-barra-wrap"><div class="h-barra" style="height:${h}%"></div></div>
      <span class="h-m">${fmt(p.m, 0)}</span>
      <span class="h-p">${p.p}</span>`;
    col.title = `${p.p}: ${p.m} matriculados, ${p.par} paralelo(s)` + (p.ap != null ? `, ${fmt(p.ap)}% aprobación` : "");
    cont.appendChild(col);
  }
}

function seleccionar(a, desdeCarrera) {
  estado.asig = a;
  const d = estado.datos[estado.periodo];
  $("inp-asig").value = a.asignatura;
  $("vista-carrera").hidden = true;
  $("panel").hidden = false;
  const volver = $("volver-carrera");
  if (desdeCarrera && estado.carrera) {
    volver.textContent = `‹ Volver a ${estado.carrera}`;
    volver.hidden = false;
  } else volver.hidden = true;

  $("t-asig").textContent = a.asignatura;
  $("t-meta").textContent = `${a.carrera} — ${a.facultad} · nivel ${a.nivel ?? "?"} · ${a.paralelos} paralelo(s) · ${a.n_matric} estudiantes · período ${d.nombre}`;

  const avisoCarga = $("aviso-carga");
  if (a.sin_carga > 0) {
    avisoCarga.textContent = `Atención: ${a.sin_carga} registro(s) con el primer parcial aún sin cargar (ceros exactos); quedan fuera de la predicción.`;
    avisoCarga.hidden = false;
  } else avisoCarga.hidden = true;

  // tile 1: % aprobación
  $("lbl-pred-tipo").textContent = d.cerrado ? "(predicho vs real)" : "(predicción)";
  $("v-pct").textContent = `${fmt(a.pred_pct)}%`;
  $("v-ic").textContent = `IC 90%: ${fmt(a.ic_lo)}% – ${fmt(a.ic_hi)}% · sobre ${a.n_pred} estudiantes con 1er parcial`;
  const comp = $("comparador");
  comp.hidden = false;
  $("bar-pred").style.width = `${a.pred_pct}%`;
  $("bar-pred-v").textContent = `${fmt(a.pred_pct)}%`;
  const w = $("whisker");
  w.style.left = `${a.ic_lo}%`;
  w.style.width = `${Math.max(0, a.ic_hi - a.ic_lo)}%`;
  const barReal = $("bar-real"), barRealV = $("bar-real-v"), filaReal = $("fila-real");
  if (d.cerrado && a.real_pct != null) {
    filaReal.classList.remove("sin-dato");
    barReal.style.width = `${a.real_pct}%`;
    barRealV.textContent = `${fmt(a.real_pct)}%`;
  } else {
    filaReal.classList.add("sin-dato");
    barReal.style.width = "0";
    barRealV.textContent = "pendiente de recibir información";
  }

  // tile 2: aprobados
  $("lbl-aprob-tipo").textContent = d.cerrado ? "(esperados vs reales)" : "(esperados)";
  $("v-aprob").textContent = fmt(Math.round(a.aprob_esp), 0);
  $("v-aprob-det").textContent = d.cerrado && a.aprob_real != null
    ? `esperados ${fmt(a.aprob_esp)} · reales ${fmt(a.aprob_real, 0)} · reprobados esperados ${fmt(a.reprob_esp)} / reales ${fmt(a.reprob_real, 0)}`
    : `de ${a.n_pred} con primer parcial · reprobados esperados: ${fmt(a.reprob_esp)}`;

  // tile 3: reprobados período anterior
  $("lbl-prev").textContent = d.anterior;
  $("v-reprob-prev").textContent = fmt(a.reprob_prev, 0);
  $("v-reprob-prev-det").textContent = a.reprob_prev == null
    ? "la asignatura no se dictó en el período anterior"
    : `de ${fmt(a.matric_prev, 0)} matriculados · ${fmt(a.repetidores, 0)} reprobado(s) se rematricularon este período`;

  // tile 4: repetidores esperados el próximo período (cupos de repetición a prever).
  // Solo la parte validada del flujo: reprobados esperados × tasa de rematrícula medida.
  const TASA_REMATRICULA = 0.49;
  const repetidores_esp = a.reprob_esp * TASA_REMATRICULA;
  $("lbl-next").textContent = d.siguiente ?? "próximo";
  $("v-previstos").textContent = fmt(repetidores_esp, 0);
  $("v-previstos-det").textContent =
    `≈ ${fmt(a.reprob_esp)} reprobados esperados × 0,49 de rematrícula · cupos de repetición a prever`;

  // tabla
  $("t-tabla-nota").textContent = d.cerrado
    ? "— ordenados por riesgo predicho; el estado final permite verificar la predicción"
    : "— ordenados por riesgo predicho (sin estado final: el período sigue en curso)";
  const tb = $("tabla-est").querySelector("tbody");
  tb.innerHTML = "";
  for (const [ced, p1, prob, est, rep] of a.estudiantes) {
    const tr = document.createElement("tr");
    const probTxt = prob == null ? "—" : `${fmt(prob * 100, 0)}%`;
    const chip = est === "A" ? `<span class="chip aprobado">✓ Aprobado</span>`
      : est === "AR" ? `<span class="chip recuperacion">↻ Recuperación</span>`
      : est === "R" ? `<span class="chip reprobado">✗ Reprobado</span>`
      : d.cerrado ? `<span class="chip pendiente">sin acta</span>`
      : `<span class="chip pendiente">en curso</span>`;
    tr.innerHTML = `
      <td>${ced}</td>
      <td class="num">${p1 == null ? "sin nota" : prob == null ? "sin cargar" : fmt(p1, 2)}</td>
      <td><div class="prob-celda"><div class="prob-pista"><div class="prob-barra" style="width:${prob == null ? 0 : prob * 100}%"></div></div><span class="num">${probTxt}</span></div></td>
      <td>${chip}</td>
      <td>${rep ? '<span class="chip repite">repitiendo</span>' : ""}</td>`;
    tb.appendChild(tr);
  }

  renderHistorico(a);
}

init().catch(e => {
  document.body.insertAdjacentHTML("beforeend", `<p class="aviso alerta">Error cargando datos: ${e.message}</p>`);
});
