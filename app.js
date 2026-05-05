/* =========================================================
   Conciliación del IVA — España
   ----------------------------------------------------------
   Tres conciliaciones:
     1) Contabilidad ↔ Libros IVA
     2) Libros IVA ↔ Modelo 303
     3) Σ Modelo 303 ↔ Modelo 390
   Tolerancia: ±1 € o ±1 % por línea.
   ========================================================= */

const STORAGE_KEY = "iva-conciliacion-v3";
const TOLERANCIA_EUR = 1.0;
const TOLERANCIA_PCT = 1.0;

const TIPOS_IVA = ["21", "10", "4", "12", "10.5", "0"];
const TIPOS_REAGYP = [12, 10.5];

const TRIMESTRES = ["1T", "2T", "3T", "4T"];
const MESES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const NOMBRE_MES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function periodKeys(modo) {
  return modo === "mensual" ? MESES : TRIMESTRES;
}
function periodLabel(key, modo) {
  if (!modo) modo = state.modoDeclaracion;
  if (modo === "mensual") return `${NOMBRE_MES[parseInt(key, 10)]}`;
  return key;
}
function periodShort(key) { return key; }

const empty303 = () => ({
  b21: 0, c21: 0,
  b10: 0, c10: 0,
  b4: 0, c4: 0,
  b_intra: 0, c_intra: 0,
  b_isp: 0, c_isp: 0,
  b_ded_corr: 0, c_ded_corr: 0,
  b_ded_inv: 0, c_ded_inv: 0,
  b_ded_intra: 0, c_ded_intra: 0,
  c_reagyp: 0,
  c78: 0, // cuotas a compensar de períodos anteriores
});

function emptyBucket() {
  return { emitidas: [], recibidas: [], m303: empty303() };
}

function emptyPeriodos(modo) {
  const out = {};
  periodKeys(modo).forEach((k) => { out[k] = emptyBucket(); });
  return out;
}

const defaultState = () => ({
  ejercicio: 2025,
  presenta390: true,
  modoDeclaracion: "trimestral",
  entidad: { nombre: "", nif: "", sector: "", periodoInicio: "", periodoFin: "" },
  periodos: {
    trimestral: emptyPeriodos("trimestral"),
    mensual: emptyPeriodos("mensual"),
  },
  m390: { b21: 0, c21: 0, b10: 0, c10: 0, b4: 0, c4: 0, b_ded: 0, c_ded: 0, c_reagyp: 0 },
  contab: { c477: 0, c472: 0, c4750: 0, c4700: 0 },
});

function activePeriodos() {
  return state.periodos[state.modoDeclaracion];
}
function bucket(key) {
  const ap = activePeriodos();
  if (!ap[key]) ap[key] = emptyBucket();
  return ap[key];
}
function todosLosBuckets() {
  return periodKeys(state.modoDeclaracion).map((k) => bucket(k));
}

function migrar(s) {
  if (!s) return null;
  // Migración desde v1/v2 (state.trimestres) a v3 (state.periodos)
  if (s.trimestres && !s.periodos) {
    const nuevos = emptyPeriodos("trimestral");
    [1, 2, 3, 4].forEach((n) => {
      const k = TRIMESTRES[n - 1];
      if (s.trimestres[n]) nuevos[k] = s.trimestres[n];
    });
    s.periodos = { trimestral: nuevos, mensual: emptyPeriodos("mensual") };
    delete s.trimestres;
  }
  // Asegurar buckets en ambos modos
  if (!s.periodos) s.periodos = { trimestral: emptyPeriodos("trimestral"), mensual: emptyPeriodos("mensual") };
  if (!s.periodos.trimestral) s.periodos.trimestral = emptyPeriodos("trimestral");
  if (!s.periodos.mensual) s.periodos.mensual = emptyPeriodos("mensual");
  // Asegurar todas las keys en cada modo y rellenar campos nuevos del m303
  ["trimestral", "mensual"].forEach((modo) => {
    periodKeys(modo).forEach((k) => {
      if (!s.periodos[modo][k]) s.periodos[modo][k] = emptyBucket();
      const def = empty303();
      s.periodos[modo][k].m303 = { ...def, ...(s.periodos[modo][k].m303 || {}) };
    });
  });
  if (!s.modoDeclaracion) s.modoDeclaracion = "trimestral";
  if (!s.entidad) s.entidad = { nombre: "", nif: "", sector: "", periodoInicio: "", periodoFin: "" };
  if (!s.contab) s.contab = { c477: 0, c472: 0, c4750: 0, c4700: 0 };
  if (!s.m390) s.m390 = { b21: 0, c21: 0, b10: 0, c10: 0, b4: 0, c4: 0, b_ded: 0, c_ded: 0, c_reagyp: 0 };
  return s;
}

let state = migrar(load()) || defaultState();

/* ---------- Auto-guardado (debounce) ---------- */
let _saveTimer = null;
function autoSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => save(), 250);
}

/* ---------- Persistencia del período activo ---------- */
const PER_PREF_KEY = "iva-conciliacion-periodo-activo";
const _perPref = (() => {
  try { return JSON.parse(localStorage.getItem(PER_PREF_KEY)) || {}; }
  catch { return {}; }
})();
function _perInicial(field) {
  const keys = periodKeys(state.modoDeclaracion);
  const guardado = _perPref[state.modoDeclaracion] && _perPref[state.modoDeclaracion][field];
  return guardado && keys.includes(guardado) ? guardado : keys[0];
}
let periodoLibroActivo = _perInicial("libro");
let periodo303Activo = _perInicial("m303");
let periodoResultActivo = _perInicial("result");
function persistPeriodo() {
  try {
    const m = state.modoDeclaracion;
    const data = JSON.parse(localStorage.getItem(PER_PREF_KEY) || "{}");
    data[m] = { libro: periodoLibroActivo, m303: periodo303Activo, result: periodoResultActivo };
    localStorage.setItem(PER_PREF_KEY, JSON.stringify(data));
  } catch {}
}

/* ---------- Utilidades ---------- */
const fmt = (n) =>
  (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Parser de cantidades robusto para formato español, inglés y mixto.
   Acepta: 1.234,56 (es) · 1,234.56 (en) · 1234,56 · 1234.56 · "1.234,56 €" ·
   "(123,45)" como negativo · números puros. El bug previo era que "1.234,56"
   se convertía en "1.234.56" → parseFloat() devolvía 1, no 1234,56. */
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // Paréntesis = negativo (formato contable)
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  // Quitar todo lo que no sea dígito, separadores o signo
  s = s.replace(/[^\d.,\-+]/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let parsed;
  if (lastComma >= 0 && lastDot >= 0) {
    // Ambos: el de más a la derecha es el decimal
    if (lastComma > lastDot) parsed = parseFloat(s.replace(/\./g, "").replace(",", "."));
    else parsed = parseFloat(s.replace(/,/g, ""));
  } else if (lastComma >= 0) {
    // Solo comas. Si hay varias o la parte tras la coma tiene exactamente
    // 3 dígitos y nada más, asumimos miles inglesas (1,234). Si no, decimal español.
    const partes = s.split(",");
    const todasTresDigitos = partes.slice(1).every((p) => p.length === 3);
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && todasTresDigitos)) {
      parsed = parseFloat(s.replace(/,/g, ""));
    } else {
      parsed = parseFloat(s.replace(",", "."));
    }
  } else if (lastDot >= 0) {
    // Solo puntos. Dos o más → todos miles. Uno con 3 dígitos detrás → miles.
    const partes = s.split(".");
    const sufijoTresDigitos = partes.length === 2 && partes[1].length === 3;
    if (partes.length > 2 || sufijoTresDigitos) {
      parsed = parseFloat(s.replace(/\./g, ""));
    } else {
      parsed = parseFloat(s);
    }
  } else {
    parsed = parseFloat(s);
  }
  if (!isFinite(parsed)) return 0;
  return neg ? -parsed : parsed;
}
const num303 = num; // mismo parser

const round2 = (n) => Math.round(n * 100) / 100;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("tab-" + t.dataset.tab).classList.add("active");
    if (t.dataset.tab === "result") renderResultados();
    if (t.dataset.tab === "inicio") renderInicio();
  });
});

/* Toggle "Vista detallada" — muestra/oculta la barra de pestañas avanzadas */
const _btnToggleTabs = document.getElementById("btn-toggle-tabs");
if (_btnToggleTabs) _btnToggleTabs.addEventListener("click", () => {
  const tabs = document.querySelector("nav.tabs");
  const oculto = tabs.hasAttribute("hidden");
  if (oculto) {
    tabs.removeAttribute("hidden");
    _btnToggleTabs.textContent = "🏠 Vista simple";
  } else {
    tabs.setAttribute("hidden", "");
    _btnToggleTabs.textContent = "⚙ Vista detallada";
    // Volver a la vista simple
    const inicio = document.querySelector('.tab[data-tab="inicio"]');
    if (inicio) inicio.click();
  }
});

/* ---------- Selectores período (dinámicos) ---------- */
function renderPeriodSwitchers() {
  const labelMode = state.modoDeclaracion === "mensual" ? "month" : "trim";
  const keys = periodKeys(state.modoDeclaracion);
  const labelFor = (k) => state.modoDeclaracion === "mensual" ? `${k} ${NOMBRE_MES[parseInt(k, 10)].slice(0, 3)}` : k;

  function renderOne(containerName, activeRef, onChange) {
    const cont = document.querySelector(`.trimester-switch[data-switch="${containerName}"]`);
    if (!cont) return;
    cont.innerHTML = keys.map((k) => `
      <label><input type="radio" name="${containerName}" value="${k}" ${k === activeRef() ? "checked" : ""} /> ${labelFor(k)}</label>
    `).join("");
    cont.querySelectorAll("input").forEach((r) => {
      r.addEventListener("change", (e) => onChange(e.target.value));
    });
  }
  renderOne("tri-libro", () => periodoLibroActivo, (v) => { periodoLibroActivo = v; renderLibros(); persistPeriodo(); });
  renderOne("tri-303", () => periodo303Activo, (v) => { periodo303Activo = v; render303(); persistPeriodo(); });
  renderOne("tri-result", () => periodoResultActivo, (v) => { periodoResultActivo = v; renderResultados(); persistPeriodo(); });
}

/* ---------- Botones ---------- */
document.getElementById("btn-guardar").addEventListener("click", () => {
  recogerTodo();
  save();
  flash("Guardado en este navegador.");
});
document.getElementById("btn-limpiar").addEventListener("click", () => {
  if (confirm("¿Borrar todos los datos introducidos?")) {
    state = defaultState();
    save();
    renderTodo();
  }
});
document.getElementById("btn-ejemplo").addEventListener("click", () => {
  state = ejemploDataset();
  save();
  renderTodo();
  flash("Datos del ejemplo cargados.");
});

document.querySelectorAll("[data-add]").forEach((b) => {
  b.addEventListener("click", () => {
    const tipo = b.dataset.add;
    const t = bucket(periodoLibroActivo);
    const fila = tipo === "emitidas"
      ? { fecha: "", numero: "", contraparte: "", tipoIva: "21", base: 0, cuota: 0 }
      : { fecha: "", numero: "", contraparte: "", tipoIva: "21", base: 0, cuota: 0, deducible: 100 };
    t[tipo].push(fila);
    renderLibros();
    autoSave();
  });
});

document.getElementById("ejercicio").addEventListener("input", (e) => {
  state.ejercicio = parseInt(e.target.value, 10) || new Date().getFullYear();
  autoSave();
});

document.getElementById("btn-export").addEventListener("click", exportarInformeExcel);
document.getElementById("show-formulas").addEventListener("change", renderDesgloseVivo);

document.getElementById("presenta-390").addEventListener("change", (e) => {
  state.presenta390 = e.target.checked;
  document.getElementById("m390-form").style.opacity = state.presenta390 ? "1" : ".4";
  document.getElementById("m390-form").style.pointerEvents = state.presenta390 ? "auto" : "none";
  autoSave();
});

/* ---------- Volcar libros del período activo a las casillas del 303 ---------- */
document.getElementById("btn-303-desde-libro").addEventListener("click", () => {
  const pk = periodo303Activo;
  if (!confirm(`Se sustituirán las casillas del Modelo 303 de ${periodLabel(pk)} por los totales del libro de ese período. ¿Continuar?`)) return;
  const emit = totalesLibroEmitidasPorTipo(pk);
  const reci = totalesLibroRecibidasPorTipo(pk);
  const reagyp = totalReagypTrimestre(pk);
  const m = bucket(pk).m303;
  m.b21 = round2(emit[21].base);  m.c21 = round2(emit[21].cuota);
  m.b10 = round2(emit[10].base);  m.c10 = round2(emit[10].cuota);
  m.b4  = round2(emit[4].base);   m.c4  = round2(emit[4].cuota);
  // Deducible se vuelca a "corriente" (28/29) por defecto; el usuario puede
  // repartir manualmente entre 28/29, 30/31 (inversión) y 36/37 (intracom).
  m.b_ded_corr = round2(reci[21].base + reci[10].base + reci[4].base);
  m.c_ded_corr = round2(reci[21].cuota + reci[10].cuota + reci[4].cuota);
  m.c_reagyp = round2(reagyp);
  render303();
  save();
  flash(`Casillas del 303 ${periodLabel(pk)} rellenadas desde libros.`);
});

/* ---------- Export / Import JSON ---------- */
document.getElementById("btn-export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conciliacion_iva_${state.entidad.nif || "datos"}_${state.ejercicio}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  flash("Copia de seguridad descargada.");
});
document.getElementById("imp-json").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const txt = await f.text();
    const parsed = JSON.parse(txt);
    if (!parsed || (!parsed.periodos && !parsed.trimestres)) throw new Error("Formato no reconocido");
    if (!confirm("Esto sobrescribirá los datos actuales. ¿Continuar?")) return;
    state = migrar(parsed) || defaultState();
    save();
    renderTodo();
    flash("Datos importados.");
  } catch (err) {
    flash("Error importando JSON: " + err.message);
  }
});

/* ---------- Render: Libros ---------- */
function renderLibros() {
  const t = bucket(periodoLibroActivo);
  renderTablaFacturas("emitidas", t.emitidas);
  renderTablaFacturas("recibidas", t.recibidas);
  renderTotalesTipo();
}

function renderTablaFacturas(tipo, filas) {
  const tbody = document.querySelector(`#tbl-${tipo} tbody`);
  tbody.innerHTML = "";
  filas.forEach((f, i) => {
    const tr = document.createElement("tr");
    tr.dataset.row = i;
    tr.innerHTML = `
      <td><input type="date" value="${f.fecha}" data-i="${i}" data-k="fecha"></td>
      <td><input type="text" value="${escapeHtml(f.numero)}" data-i="${i}" data-k="numero"></td>
      <td><input type="text" value="${escapeHtml(f.contraparte)}" data-i="${i}" data-k="contraparte"></td>
      <td>
        <select data-i="${i}" data-k="tipoIva">
          ${TIPOS_IVA.map(t => `<option value="${t}" ${t===f.tipoIva?"selected":""}>${t} %</option>`).join("")}
        </select>
      </td>
      <td class="num"><input class="num" type="number" step="0.01" value="${f.base}" data-i="${i}" data-k="base"></td>
      <td class="num"><input class="num" type="number" step="0.01" value="${f.cuota}" data-i="${i}" data-k="cuota"></td>
      ${tipo === "recibidas"
        ? `<td><input type="number" min="0" max="100" step="1" value="${f.deducible ?? 100}" data-i="${i}" data-k="deducible" title="% deducible"></td>`
        : ""}
      <td><button class="row-del" data-del="${i}" data-tipo="${tipo}" title="Eliminar">×</button></td>
    `;
    aplicarValidacionFila(tr, f);
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", (e) => {
      const i = parseInt(e.target.dataset.i, 10);
      const k = e.target.dataset.k;
      let v = e.target.value;
      if (["base", "cuota", "deducible"].includes(k)) v = num(v);
      filas[i][k] = v;
      // Auto-cuota: si la cuota sigue a 0 y hay base + tipo > 0, calculamos
      // cuota = base × tipo. No la pisamos si el usuario ya tecleó otro valor
      // (rectificativas, redondeos manuales).
      if (k === "base" || k === "tipoIva") {
        const tasa = parseFloat(filas[i].tipoIva) / 100;
        if (filas[i].cuota === 0 && filas[i].base !== 0 && tasa > 0) {
          filas[i].cuota = round2(filas[i].base * tasa);
          const cuotaInput = tbody.querySelector(`input[data-i="${i}"][data-k="cuota"]`);
          if (cuotaInput) cuotaInput.value = filas[i].cuota;
        }
      }
      renderTotalesTipo();
      actualizarFooterTabla(tipo);
      const tr = e.target.closest("tr");
      if (tr) aplicarValidacionFila(tr, filas[i]);
      autoSave();
    });
  });

  tbody.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", (e) => {
      const i = parseInt(e.currentTarget.dataset.del, 10);
      filas.splice(i, 1);
      renderLibros();
      autoSave();
    });
  });

  actualizarFooterTabla(tipo);
}

/* Marca filas cuya cuota difiera de base × tipo en más de 1 cent. Útil para
   detectar tipos mal codificados o errores de tecleo antes de pasar al 303. */
function aplicarValidacionFila(tr, fila) {
  const tasa = parseFloat(fila.tipoIva) / 100;
  const base = num(fila.base);
  const cuota = num(fila.cuota);
  const esperada = round2(base * tasa);
  const tieneDatos = base !== 0 || cuota !== 0;
  const noCuadra = tieneDatos && tasa > 0 && Math.abs(cuota - esperada) > 0.01;
  tr.classList.toggle("row-warn", noCuadra);
  if (noCuadra) {
    tr.title = `Cuota esperada según tipo ${fila.tipoIva} %: ${fmt(esperada)} (diferencia ${fmt(cuota - esperada)})`;
  } else {
    tr.removeAttribute("title");
  }
}

function actualizarFooterTabla(tipo) {
  const t = bucket(periodoLibroActivo);
  const filas = t[tipo];
  const totalBase = filas.reduce((a, f) => a + num(f.base), 0);
  const totalCuota = filas.reduce((a, f) => {
    const ded = tipo === "recibidas" ? num(f.deducible) / 100 : 1;
    return a + num(f.cuota) * ded;
  }, 0);
  document.getElementById(`tot-${tipo}-base`).textContent = fmt(totalBase);
  document.getElementById(`tot-${tipo}-cuota`).textContent = fmt(totalCuota);
}

function renderTotalesTipo() {
  ["emitidas", "recibidas"].forEach((tipo) => {
    const filas = bucket(periodoLibroActivo)[tipo];
    const porTipo = {};
    filas.forEach((f) => {
      const k = f.tipoIva;
      if (!porTipo[k]) porTipo[k] = { base: 0, cuota: 0 };
      const ded = tipo === "recibidas" ? num(f.deducible) / 100 : 1;
      porTipo[k].base += num(f.base) * ded;
      porTipo[k].cuota += num(f.cuota) * ded;
    });
    const cont = document.getElementById(`tot-${tipo}-tipo`);
    cont.innerHTML = Object.entries(porTipo)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map(([k, v]) => `<span><b>${k} %</b> · base ${fmt(v.base)} · cuota ${fmt(v.cuota)}</span>`)
      .join("");
  });
}

/* ---------- Render: Modelo 303 ---------- */
function render303() {
  const m = bucket(periodo303Activo).m303;
  document.querySelectorAll("[data-303]").forEach((el) => {
    el.value = m[el.dataset["303"]] ?? 0;
    el.oninput = () => {
      m[el.dataset["303"]] = num(el.value);
      actualizarResumen303();
      autoSave();
    };
  });
  actualizarResumen303();
}

function actualizarResumen303() {
  const m = bucket(periodo303Activo).m303;
  // Casilla 27 = total cuota devengada (régimen general + intracom + ISP)
  const dev = num(m.c21) + num(m.c10) + num(m.c4) + num(m.c_intra) + num(m.c_isp);
  // Casilla 45 = total a deducir; la compensación REAGYP (41) se suma aquí.
  const ded = num(m.c_ded_corr) + num(m.c_ded_inv) + num(m.c_ded_intra) + num(m.c_reagyp);
  const res = dev - ded; // casilla 46
  // Casilla 71 (a ingresar/devolver) = 46 − 78 (compensación períodos anteriores)
  const c71 = res - num(m.c78);
  document.getElementById("r303-dev").textContent = fmt(dev);
  document.getElementById("r303-ded").textContent = fmt(ded);
  document.getElementById("r303-res").textContent = fmt(res);
  const el78 = document.getElementById("r303-78");
  if (el78) el78.textContent = fmt(num(m.c78));
  document.getElementById("r303-71").textContent = fmt(c71);
  renderResumenAnual303();
}

function renderResumenAnual303() {
  const t = document.getElementById("resumen-anual-303");
  if (!t) return;
  const keys = periodKeys(state.modoDeclaracion);
  const sum = (k) => todosLosBuckets().reduce((a, b) => a + num(b.m303[k]), 0);

  const rows = [
    { c: "Cuota devengada 21 % (03)", k: "c21" },
    { c: "Cuota devengada 10 % (06)", k: "c10" },
    { c: "Cuota devengada 4 % (09)", k: "c4" },
    { c: "Cuota intracom. (11)", k: "c_intra" },
    { c: "Cuota ISP (13)", k: "c_isp" },
    { c: "Σ Total devengado (27)", k: "_dev" },
    { c: "Cuota deducible corriente (29)", k: "c_ded_corr" },
    { c: "Cuota deducible inversión (31)", k: "c_ded_inv" },
    { c: "Cuota deducible intracom. (37)", k: "c_ded_intra" },
    { c: "Compensación REAGYP (41)", k: "c_reagyp" },
    { c: "Σ Total deducible (45)", k: "_ded" },
    { c: "Compensación períodos anteriores (78)", k: "c78" },
    { c: "Σ Resultado (71)", k: "_71" },
  ];
  const calc = (m, k) => {
    if (k === "_dev") return num(m.c21) + num(m.c10) + num(m.c4) + num(m.c_intra) + num(m.c_isp);
    if (k === "_ded") return num(m.c_ded_corr) + num(m.c_ded_inv) + num(m.c_ded_intra) + num(m.c_reagyp);
    if (k === "_71")  return calc(m, "_dev") - calc(m, "_ded") - num(m.c78);
    return num(m[k]);
  };
  const total = (k) => keys.reduce((a, pk) => a + calc(bucket(pk).m303, k), 0);

  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th>
      ${keys.map((k) => `<th class="num">${periodLabel(k)}</th>`).join("")}
      <th class="num">Total anual</th>
    </tr></thead>
    <tbody>
      ${rows.map((r) => {
        const fuerte = r.c.startsWith("Σ");
        const cels = keys.map((pk) => `<td class="num">${fmt(calc(bucket(pk).m303, r.k))}</td>`).join("");
        return `<tr${fuerte ? ' style="font-weight:600;background:#fafbfd;"' : ""}>
          <td>${r.c}</td>
          ${cels}
          <td class="num"><strong>${fmt(total(r.k))}</strong></td>
        </tr>`;
      }).join("")}
    </tbody>
  `;
}

/* ---------- Render: Modelo 390 ---------- */
function render390() {
  document.getElementById("presenta-390").checked = state.presenta390;
  const form = document.getElementById("m390-form");
  form.style.opacity = state.presenta390 ? "1" : ".4";
  form.style.pointerEvents = state.presenta390 ? "auto" : "none";
  document.querySelectorAll("[data-390]").forEach((el) => {
    el.value = state.m390[el.dataset["390"]] ?? 0;
    el.oninput = () => { state.m390[el.dataset["390"]] = num(el.value); autoSave(); };
  });
}

/* ---------- Render: Contabilidad ---------- */
function renderContab() {
  document.querySelectorAll("[data-cont]").forEach((el) => {
    el.value = state.contab[el.dataset.cont] ?? 0;
    el.oninput = () => { state.contab[el.dataset.cont] = num(el.value); autoSave(); };
  });
}

/* ---------- Render: Entidad ---------- */
function renderEntidad() {
  document.querySelectorAll("[data-ent]").forEach((el) => {
    el.value = state.entidad[el.dataset.ent] ?? "";
    el.oninput = () => { state.entidad[el.dataset.ent] = el.value; autoSave(); };
  });
  const sel = document.getElementById("modo-decl");
  if (sel) {
    sel.value = state.modoDeclaracion;
    sel.onchange = () => {
      state.modoDeclaracion = sel.value;
      // Asegurar que el modo destino tenga todas sus claves
      periodKeys(state.modoDeclaracion).forEach((k) => {
        if (!state.periodos[state.modoDeclaracion][k]) {
          state.periodos[state.modoDeclaracion][k] = emptyBucket();
        }
      });
      const keys = periodKeys(state.modoDeclaracion);
      periodoLibroActivo = keys.includes(periodoLibroActivo) ? periodoLibroActivo : keys[0];
      periodo303Activo = keys.includes(periodo303Activo) ? periodo303Activo : keys[0];
      periodoResultActivo = keys.includes(periodoResultActivo) ? periodoResultActivo : keys[0];
      save();
      persistPeriodo();
      renderTodo();
    };
  }
}

/* ---------- Cálculos ---------- */
function totalesLibroEmitidasPorTipo(periodo) {
  const r = { 21: { base: 0, cuota: 0 }, 10: { base: 0, cuota: 0 }, 4: { base: 0, cuota: 0 }, 0: { base: 0, cuota: 0 } };
  bucket(periodo).emitidas.forEach((f) => {
    const k = f.tipoIva;
    if (!r[k]) r[k] = { base: 0, cuota: 0 };
    r[k].base += num(f.base);
    r[k].cuota += num(f.cuota);
  });
  return r;
}

function totalesLibroRecibidasPorTipo(periodo) {
  const r = { 21: { base: 0, cuota: 0 }, 10: { base: 0, cuota: 0 }, 4: { base: 0, cuota: 0 }, 0: { base: 0, cuota: 0 } };
  bucket(periodo).recibidas.forEach((f) => {
    if (esReagyp(f.tipoIva)) return;
    const k = f.tipoIva;
    const ded = num(f.deducible) / 100;
    if (!r[k]) r[k] = { base: 0, cuota: 0 };
    r[k].base += num(f.base) * ded;
    r[k].cuota += num(f.cuota) * ded;
  });
  return r;
}

function totalLibroDevengadoAnual() {
  let total = 0;
  todosLosBuckets().forEach((b) => {
    b.emitidas.forEach((f) => total += num(f.cuota));
  });
  return total;
}
function totalLibroDeducibleAnual() {
  let total = 0;
  todosLosBuckets().forEach((b) => {
    b.recibidas.forEach((f) => {
      if (esReagyp(f.tipoIva)) return;
      total += num(f.cuota) * num(f.deducible) / 100;
    });
  });
  return total;
}
function totalReagypAnual() {
  let total = 0;
  todosLosBuckets().forEach((b) => {
    b.recibidas.forEach((f) => {
      if (!esReagyp(f.tipoIva)) return;
      total += num(f.cuota) * num(f.deducible) / 100;
    });
  });
  return total;
}
function totalReagypTrimestre(periodo) {
  let total = 0;
  bucket(periodo).recibidas.forEach((f) => {
    if (!esReagyp(f.tipoIva)) return;
    total += num(f.cuota) * num(f.deducible) / 100;
  });
  return total;
}

function evaluarDif(libro, declarado) {
  const dif = round2(libro - declarado);
  const base = Math.max(Math.abs(libro), Math.abs(declarado));
  const pct = base === 0 ? 0 : Math.abs(dif) / base * 100;
  let estado = "OK";
  if (Math.abs(dif) > TOLERANCIA_EUR && pct > TOLERANCIA_PCT) estado = "REVISAR";
  else if (Math.abs(dif) > TOLERANCIA_EUR) estado = "AVISO";
  return { dif, pct, estado };
}

/* ---------- Clasificación de riesgo ---------- */
function calcularRiesgo() {
  const devLibro = totalLibroDevengadoAnual();
  const dedLibro = totalLibroDeducibleAnual();
  const reagypLib = totalReagypAnual();
  let dev303 = 0, ded303 = 0, reagyp303 = 0;
  todosLosBuckets().forEach((b) => {
    const m = b.m303;
    dev303 += num(m.c21) + num(m.c10) + num(m.c4);
    ded303 += num(m.c_ded_corr) + num(m.c_ded_inv) + num(m.c_ded_intra);
    reagyp303 += num(m.c_reagyp);
  });
  const dDev = Math.abs(devLibro - dev303);
  const dDed = Math.abs(dedLibro - ded303);
  const dReagyp = Math.abs(reagypLib - reagyp303);
  const difTotal = dDev + dDed + dReagyp;
  const base = dev303 + ded303 + reagyp303;
  const pct = base === 0 ? 0 : (difTotal / base) * 100;

  let nivel = "BAJO";
  if (difTotal > TOLERANCIA_EUR * 4 || pct > TOLERANCIA_PCT) nivel = "MODERADO";
  if (difTotal > TOLERANCIA_EUR * 20 || pct > TOLERANCIA_PCT * 5) nivel = "ALTO";
  return { nivel, difTotal: round2(difTotal), pct: round2(pct), dDev: round2(devLibro - dev303),
           dDed: round2(dedLibro - ded303), dReagyp: round2(reagypLib - reagyp303) };
}

/* ---------- Render: pestaña Inicio (vista simple) ----------
   Muestra de un vistazo el IVA por período y anual, el resultado a
   ingresar/devolver y, si hay 303 / contabilidad, las diferencias. */
function renderInicio() {
  const t = document.getElementById("resumen-iva-simple");
  if (!t) return;
  const keys = periodKeys(state.modoDeclaracion);
  const periodLabelHdr = state.modoDeclaracion === "mensual"
    ? keys.map((k) => NOMBRE_MES[parseInt(k, 10)].slice(0, 3))
    : keys;

  // Totales del libro por período
  const filas = [
    { c: "IVA Repercutido (ventas)", calc: (pk) => {
        const e = totalesLibroEmitidasPorTipo(pk);
        return e[21].cuota + e[10].cuota + e[4].cuota; }},
    { c: "IVA Soportado (compras)", calc: (pk) => {
        const r = totalesLibroRecibidasPorTipo(pk);
        return r[21].cuota + r[10].cuota + r[4].cuota; }},
    { c: "Resultado (a ingresar / a devolver)", clase: "fila-resultado", calc: (pk) => {
        const e = totalesLibroEmitidasPorTipo(pk);
        const r = totalesLibroRecibidasPorTipo(pk);
        return (e[21].cuota + e[10].cuota + e[4].cuota) -
               (r[21].cuota + r[10].cuota + r[4].cuota); }},
  ];
  const totales = filas.map((f) => keys.reduce((a, pk) => a + f.calc(pk), 0));

  t.className = "iva-resumen-table";
  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th>
      ${keys.map((k, i) => `<th class="num">${escapeHtml(periodLabelHdr[i])}</th>`).join("")}
      <th class="num">Total ${state.ejercicio}</th>
    </tr></thead>
    <tbody>
      ${filas.map((f, i) => {
        const cells = keys.map((pk) => `<td class="num">${fmt(f.calc(pk))}</td>`).join("");
        return `<tr${f.clase ? ` class="${f.clase}"` : ""}>
          <td>${escapeHtml(f.c)}</td>
          ${cells}
          <td class="num"><strong>${fmt(totales[i])}</strong></td>
        </tr>`;
      }).join("")}
    </tbody>
  `;

  renderConciliacionSimple();
}

function renderConciliacionSimple() {
  const cont = document.getElementById("conciliacion-simple");
  if (!cont) return;
  // ¿Hay datos de 303 o contabilidad para conciliar?
  const tiene303 = todosLosBuckets().some((b) => {
    const m = b.m303;
    return num(m.c21) + num(m.c10) + num(m.c4) +
           num(m.c_ded_corr) + num(m.c_ded_inv) + num(m.c_ded_intra) !== 0;
  });
  const tieneCont = num(state.contab.c477) || num(state.contab.c472) ||
                    num(state.contab.c4750) || num(state.contab.c4700);
  if (!tiene303 && !tieneCont) {
    cont.innerHTML = `<p class="hint" style="margin-top:14px;">
      Para ver la <strong>conciliación</strong>, sube también tus PDFs del Modelo 303
      (y opcionalmente del 390) o introduce los saldos contables 477/472 en la vista detallada.
    </p>`;
    return;
  }
  let html = "";
  if (tiene303) {
    const r = calcularRiesgo();
    const cls = r.nivel === "BAJO" ? "ok" : r.nivel === "MODERADO" ? "warn" : "err";
    html += `
      <h3 style="margin:18px 0 8px;font-size:14px;">Libros ↔ Modelo 303 (anual)</h3>
      <div class="risk-grid">
        <div class="risk-item"><span class="risk-label">Estado</span>
          <span class="badge ${cls} big">${r.nivel}</span></div>
        <div class="risk-item"><span class="risk-label">Diferencia devengado</span>
          <strong>${fmt(r.dDev)} €</strong></div>
        <div class="risk-item"><span class="risk-label">Diferencia deducible</span>
          <strong>${fmt(r.dDed)} €</strong></div>
        <div class="risk-item"><span class="risk-label">Desviación global</span>
          <strong>${r.pct.toFixed(2)} %</strong></div>
      </div>`;
  }
  if (tieneCont) {
    const dev = totalLibroDevengadoAnual();
    const ded = totalLibroDeducibleAnual();
    const c = state.contab;
    const dif477 = round2(dev - num(c.c477));
    const dif472 = round2(ded - num(c.c472));
    const cls = (Math.abs(dif477) < 1 && Math.abs(dif472) < 1) ? "ok" : "warn";
    html += `
      <h3 style="margin:18px 0 8px;font-size:14px;">Libros ↔ Contabilidad (anual)</h3>
      <table class="recon-table">
        <thead><tr><th>Cuenta</th><th class="num">Libro</th><th class="num">Contabilidad</th><th class="num">Diferencia</th></tr></thead>
        <tbody>
          <tr class="${Math.abs(dif477) < 1 ? "ok" : "warn"}">
            <td>477 IVA repercutido</td>
            <td class="num">${fmt(dev)}</td>
            <td class="num">${fmt(c.c477)}</td>
            <td class="num">${fmt(dif477)}</td>
          </tr>
          <tr class="${Math.abs(dif472) < 1 ? "ok" : "warn"}">
            <td>472 IVA soportado</td>
            <td class="num">${fmt(ded)}</td>
            <td class="num">${fmt(c.c472)}</td>
            <td class="num">${fmt(dif472)}</td>
          </tr>
        </tbody>
      </table>`;
  }
  cont.innerHTML = html;
}

/* ---------- Render: Resultados ---------- */
function renderResultados() {
  renderRiesgo();
  renderReconContab();
  renderRecon303();
  renderRecon390();
  renderDesgloseVivo();
  comprobarCausas();
}

function renderDesgloseVivo() {
  const cont = document.getElementById("desglose-vivo");
  const toggle = document.getElementById("show-formulas");
  if (!cont || !toggle) return;
  cont.hidden = !toggle.checked;
  if (!toggle.checked) return;

  const pk = periodoResultActivo;
  const periodo = periodLabel(pk);
  const emit = totalesLibroEmitidasPorTipo(pk);
  const reci = totalesLibroRecibidasPorTipo(pk);
  const reagypP = totalReagypTrimestre(pk);
  const m = bucket(pk).m303;

  const facturasEmit = bucket(pk).emitidas;
  const facturasReci = bucket(pk).recibidas;

  // Listas de sumandos
  const sumando = (lista, tipo) => lista
    .filter((f) => String(f.tipoIva) === String(tipo))
    .map((f) => num(f.cuota))
    .filter((x) => x !== 0);
  const sumandoDed = (lista, tipo) => lista
    .filter((f) => String(f.tipoIva) === String(tipo) && !esReagyp(f.tipoIva))
    .map((f) => round2(num(f.cuota) * num(f.deducible) / 100))
    .filter((x) => x !== 0);

  const linea = (lbl, libVal, modVal, sumandos) => {
    const desglose = sumandos.length
      ? sumandos.map((x) => fmt(x)).join(" + ") + " = " + fmt(libVal)
      : fmt(libVal);
    const dif = round2(libVal - modVal);
    return `<div class="breakdown-row">
      <strong>${lbl}</strong><br>
      Libro: ${desglose}<br>
      Modelo 303: ${fmt(modVal)}<br>
      Diferencia = ${fmt(libVal)} − ${fmt(modVal)} = <strong>${fmt(dif)} €</strong>
    </div>`;
  };

  const sumDev = m.c21 + m.c10 + m.c4 + m.c_intra + m.c_isp;
  const sumDed = m.c_ded_corr + m.c_ded_inv + m.c_ded_intra;

  // Riesgo: mostrar todos los pasos
  const dev303Total = sumar303("c21") + sumar303("c10") + sumar303("c4");
  const ded303Total = sumar303("c_ded_corr") + sumar303("c_ded_inv") + sumar303("c_ded_intra");
  const reagyp303Total = sumar303("c_reagyp");
  const devLib = totalLibroDevengadoAnual();
  const dedLib = totalLibroDeducibleAnual();
  const reagypLib = totalReagypAnual();
  const r = calcularRiesgo();

  cont.innerHTML = `
    <h4>Período activo: ${periodo}  ·  ${facturasEmit.length} facturas emitidas, ${facturasReci.length} recibidas</h4>

    ${linea("Devengado 21 % cuota (vs casilla 03)", emit[21].cuota, m.c21, sumando(facturasEmit, "21"))}
    ${linea("Devengado 10 % cuota (vs casilla 06)", emit[10].cuota, m.c10, sumando(facturasEmit, "10"))}
    ${linea("Devengado 4 % cuota (vs casilla 09)",  emit[4].cuota,  m.c4,  sumando(facturasEmit, "4"))}
    ${linea("Deducible 21 % efectivo (parte 29)",   reci[21].cuota, 0,     sumandoDed(facturasReci, "21"))}
    ${linea("Deducible 10 % efectivo (parte 29)",   reci[10].cuota, 0,     sumandoDed(facturasReci, "10"))}
    ${linea("Compensación REAGYP (vs casilla 41)",  reagypP, m.c_reagyp,
       facturasReci.filter((f) => esReagyp(f.tipoIva))
                  .map((f) => round2(num(f.cuota) * num(f.deducible) / 100)))}

    <h4>Resumen del 303 ${periodo}</h4>
    <div class="breakdown-row">
      <strong>Total cuota devengada (27)</strong> = ${fmt(m.c21)} + ${fmt(m.c10)} + ${fmt(m.c4)} + ${fmt(m.c_intra)} + ${fmt(m.c_isp)} = <strong>${fmt(sumDev)} €</strong>
    </div>
    <div class="breakdown-row">
      <strong>Total a deducir (45)</strong> = ${fmt(m.c_ded_corr)} + ${fmt(m.c_ded_inv)} + ${fmt(m.c_ded_intra)} = <strong>${fmt(sumDed)} €</strong>
    </div>
    <div class="breakdown-row">
      <strong>Resultado régimen general (46)</strong> = ${fmt(sumDev)} − ${fmt(sumDed)} = <strong>${fmt(sumDev - sumDed)} €</strong>
    </div>

    <h4>Riesgo global anual</h4>
    <div class="breakdown-row">
      <strong>Devengado libro</strong> = Σ cuotas emitidas = <strong>${fmt(devLib)} €</strong><br>
      <strong>Devengado 303</strong> = Σ trim casilla 03+06+09 = <strong>${fmt(dev303Total)} €</strong><br>
      dDev = |${fmt(devLib)} − ${fmt(dev303Total)}| = <strong>${fmt(Math.abs(devLib - dev303Total))}</strong>
    </div>
    <div class="breakdown-row">
      <strong>Deducible libro</strong> = Σ cuotas recibidas (sin REAGYP) × %ded = <strong>${fmt(dedLib)} €</strong><br>
      <strong>Deducible 303</strong> = Σ trim casillas 29+31+37 = <strong>${fmt(ded303Total)} €</strong><br>
      dDed = |${fmt(dedLib)} − ${fmt(ded303Total)}| = <strong>${fmt(Math.abs(dedLib - ded303Total))}</strong>
    </div>
    <div class="breakdown-row">
      <strong>REAGYP libro</strong> = ${fmt(reagypLib)} €  ·  <strong>REAGYP 303</strong> = ${fmt(reagyp303Total)} €<br>
      dReagyp = <strong>${fmt(Math.abs(reagypLib - reagyp303Total))}</strong>
    </div>
    <div class="breakdown-row">
      <strong>Diferencia total</strong> = dDev + dDed + dReagyp = <strong>${fmt(r.difTotal)} €</strong><br>
      <strong>Desviación global</strong> = ${fmt(r.difTotal)} / ${fmt(dev303Total + ded303Total + reagyp303Total)} × 100 = <strong>${r.pct.toFixed(2)} %</strong><br>
      → Riesgo: <strong>${r.nivel}</strong>
    </div>
  `;
}

function renderRiesgo() {
  const r = calcularRiesgo();
  const cont = document.getElementById("riesgo-summary");
  if (!cont) return;
  const cls = r.nivel === "BAJO" ? "ok" : r.nivel === "MODERADO" ? "warn" : "err";
  cont.innerHTML = `
    <div class="risk-grid">
      <div class="risk-item">
        <span class="risk-label">Nivel de riesgo</span>
        <span class="badge ${cls} big">${r.nivel}</span>
      </div>
      <div class="risk-item">
        <span class="risk-label">Diferencia devengado</span>
        <strong>${fmt(r.dDev)} €</strong>
      </div>
      <div class="risk-item">
        <span class="risk-label">Diferencia deducible</span>
        <strong>${fmt(r.dDed)} €</strong>
      </div>
      <div class="risk-item">
        <span class="risk-label">Diferencia REAGYP</span>
        <strong>${fmt(r.dReagyp)} €</strong>
      </div>
      <div class="risk-item">
        <span class="risk-label">Desviación global</span>
        <strong>${r.pct.toFixed(2)} %</strong>
      </div>
    </div>
  `;
}

/* ---------- Exportar informe a Excel ---------- */
function exportarInformeExcel() {
  if (!window.XLSX) { flash("Esperando motor Excel..."); return; }
  const wb = XLSX.utils.book_new();
  const r = calcularRiesgo();
  const ent = state.entidad;

  // Hoja 1: Resumen
  const resumen = [
    ["INFORME DE CONCILIACIÓN DEL IVA"],
    [],
    ["Entidad", ent.nombre || ""],
    ["NIF", ent.nif || ""],
    ["Sector", ent.sector || ""],
    ["Ejercicio", state.ejercicio],
    ["Período", `${ent.periodoInicio || ""} a ${ent.periodoFin || ""}`],
    ["Modo", state.modoDeclaracion],
    ["Fecha informe", new Date().toLocaleDateString("es-ES")],
    [],
    ["RESULTADO GLOBAL"],
    ["Nivel de riesgo", r.nivel],
    ["Diferencia total (€)", r.difTotal],
    ["Desviación (%)", r.pct],
    [],
    ["TOTALES ANUALES"],
    ["Concepto", "Libro", "Modelos", "Diferencia"],
    ["IVA devengado", totalLibroDevengadoAnual(), sumar303("c21") + sumar303("c10") + sumar303("c4"), r.dDev],
    ["IVA deducible", totalLibroDeducibleAnual(), sumar303("c_ded_corr") + sumar303("c_ded_inv") + sumar303("c_ded_intra"), r.dDed],
    ["REAGYP", totalReagypAnual(), sumar303("c_reagyp"), r.dReagyp],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

  // Hoja 2: Conciliación Contabilidad ↔ Libros
  const cont = state.contab;
  const concilCont = [
    ["CONCILIACIÓN CONTABILIDAD ↔ LIBROS"],
    [],
    ["Concepto", "Libro (€)", "Contabilidad (€)", "Diferencia (€)", "Estado"],
    ["477 H.P. IVA repercutido", totalLibroDevengadoAnual(), cont.c477, totalLibroDevengadoAnual() - cont.c477, evalEstado(totalLibroDevengadoAnual(), cont.c477)],
    ["472 H.P. IVA soportado", totalLibroDeducibleAnual(), cont.c472, totalLibroDeducibleAnual() - cont.c472, evalEstado(totalLibroDeducibleAnual(), cont.c472)],
    ["Saldo neto IVA (4750-4700)", totalLibroDevengadoAnual() - totalLibroDeducibleAnual(), cont.c4750 - cont.c4700,
     (totalLibroDevengadoAnual() - totalLibroDeducibleAnual()) - (cont.c4750 - cont.c4700),
     evalEstado(totalLibroDevengadoAnual() - totalLibroDeducibleAnual(), cont.c4750 - cont.c4700)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(concilCont), "1. Cont vs Libros");

  // Hoja 3: Conciliación Libros ↔ 303 (los 4 trimestres)
  const colPeriodo = state.modoDeclaracion === "mensual" ? "Mes" : "Trimestre";
  const concil303 = [["CONCILIACIÓN LIBROS ↔ MODELO 303"], [],
    [colPeriodo, "Concepto", "Libro (€)", "Modelo 303 (€)", "Diferencia (€)", "% dif", "Estado"]];
  periodKeys(state.modoDeclaracion).forEach((pk) => {
    const emit = totalesLibroEmitidasPorTipo(pk);
    const reci = totalesLibroRecibidasPorTipo(pk);
    const m = bucket(pk).m303;
    const reagypT = totalReagypTrimestre(pk);
    const filas = [
      ["Devengado 21 % cuota", emit[21].cuota, m.c21],
      ["Devengado 10 % cuota", emit[10].cuota, m.c10],
      ["Devengado 4 % cuota", emit[4].cuota, m.c4],
      ["Deducible total", reci[21].cuota + reci[10].cuota + reci[4].cuota, m.c_ded_corr + m.c_ded_inv + m.c_ded_intra],
      ["Compensación REAGYP", reagypT, m.c_reagyp],
    ];
    filas.forEach(([c, lib, mod]) => {
      const ev = evaluarDif(lib, mod);
      concil303.push([periodLabel(pk), c, lib, mod, ev.dif, ev.pct, ev.estado]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(concil303), "2. Libros vs 303");

  // Hoja 4: Conciliación Σ 303 ↔ 390
  if (state.presenta390) {
    const concil390 = [["CONCILIACIÓN Σ 303 ↔ MODELO 390"], [],
      ["Concepto", "Σ 303 (€)", "Modelo 390 (€)", "Diferencia (€)", "Estado"]];
    [["Cuota devengada 21 %", sumar303("c21"), state.m390.c21],
     ["Cuota devengada 10 %", sumar303("c10"), state.m390.c10],
     ["Cuota devengada 4 %", sumar303("c4"), state.m390.c4],
     ["Cuota deducible total", sumar303("c_ded_corr") + sumar303("c_ded_inv") + sumar303("c_ded_intra"), state.m390.c_ded],
     ["Compensación REAGYP", sumar303("c_reagyp"), state.m390.c_reagyp || 0],
    ].forEach(([c, a, b]) => {
      const ev = evaluarDif(a, b);
      concil390.push([c, a, b, ev.dif, ev.estado]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(concil390), "3. 303 vs 390");
  }

  // Hojas: Detalle facturas por período
  periodKeys(state.modoDeclaracion).forEach((pk) => {
    const emit = bucket(pk).emitidas;
    const reci = bucket(pk).recibidas;
    if (emit.length || reci.length) {
      const detalle = [
        [`DETALLE FACTURAS — ${periodLabel(pk)}`], [],
        ["EMITIDAS"],
        ["Fecha", "Nº factura", "Cliente", "Tipo IVA", "Base", "Cuota"],
        ...emit.map((f) => [f.fecha, f.numero, f.contraparte, f.tipoIva, num(f.base), num(f.cuota)]),
        [], ["RECIBIDAS"],
        ["Fecha", "Nº factura", "Proveedor", "Tipo IVA", "Base", "Cuota", "% Deducible", "REAGYP"],
        ...reci.map((f) => [f.fecha, f.numero, f.contraparte, f.tipoIva, num(f.base), num(f.cuota),
                            num(f.deducible || 100), esReagyp(f.tipoIva) ? "Sí" : ""]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detalle), `${pk} detalle`);
    }
  });

  const fname = `Conciliacion_IVA_${ent.nif || "INFORME"}_${state.ejercicio}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  flash("Informe generado.");
}

function sumar303(k) {
  return todosLosBuckets().reduce((a, b) => a + (b.m303[k] || 0), 0);
}

function evalEstado(a, b) {
  const r = evaluarDif(a, b);
  return r.estado;
}

function renderReconContab() {
  const devLibro = totalLibroDevengadoAnual();
  const dedLibro = totalLibroDeducibleAnual();
  const cont = state.contab;
  const saldoNeto = cont.c4750 - cont.c4700;
  const netoLibro = round2(devLibro - dedLibro);

  const filas = [
    { concepto: "477 H.P. IVA repercutido", libro: devLibro, contab: cont.c477 },
    { concepto: "472 H.P. IVA soportado", libro: dedLibro, contab: cont.c472 },
    { concepto: "Saldo neto IVA (4750 − 4700)", libro: netoLibro, contab: round2(saldoNeto) },
  ];

  const t = document.getElementById("recon-cont");
  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th><th class="num">Libro</th><th class="num">Contabilidad</th>
      <th class="num">Diferencia</th><th class="num">% dif.</th><th class="estado">Estado</th>
    </tr></thead>
    <tbody>
      ${filas.map(f => filaRecon(f.concepto, f.libro, f.contab)).join("")}
    </tbody>
  `;
}

function renderRecon303() {
  const pk = periodoResultActivo;
  const emit = totalesLibroEmitidasPorTipo(pk);
  const reci = totalesLibroRecibidasPorTipo(pk);
  const m = bucket(pk).m303;

  const reagypLib = totalReagypTrimestre(pk);
  const filas = [
    ["Devengado 21 % — base (01)", emit[21].base, m.b21],
    ["Devengado 21 % — cuota (03)", emit[21].cuota, m.c21],
    ["Devengado 10 % — base (04)", emit[10].base, m.b10],
    ["Devengado 10 % — cuota (06)", emit[10].cuota, m.c10],
    ["Devengado 4 % — base (07)", emit[4].base, m.b4],
    ["Devengado 4 % — cuota (09)", emit[4].cuota, m.c4],
    ["Deducible — cuota total (29+31+37)", reci[21].cuota + reci[10].cuota + reci[4].cuota,
      m.c_ded_corr + m.c_ded_inv + m.c_ded_intra],
    ["Compensación REAGYP (41)", reagypLib, m.c_reagyp],
  ];

  const t = document.getElementById("recon-303");
  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th><th class="num">Libro ${periodLabel(pk)}</th><th class="num">Modelo 303</th>
      <th class="num">Diferencia</th><th class="num">% dif.</th><th class="estado">Estado</th>
    </tr></thead>
    <tbody>${filas.map(([c, a, b]) => filaRecon(c, a, b)).join("")}</tbody>
  `;

  const dev = emit[21].cuota + emit[10].cuota + emit[4].cuota;
  const ded = reci[21].cuota + reci[10].cuota + reci[4].cuota;
  document.getElementById("hint-303").textContent =
    `Resultado libro ${periodLabel(pk)}: devengado ${fmt(dev)} − deducible ${fmt(ded)} = ${fmt(dev - ded)} €  ·  Resultado 303 (casilla 71): ${fmt(
      (m.c21 + m.c10 + m.c4 + m.c_intra + m.c_isp) - (m.c_ded_corr + m.c_ded_inv + m.c_ded_intra)
    )} €`;
}

function renderRecon390() {
  const t = document.getElementById("recon-390");
  if (!state.presenta390) {
    t.innerHTML = `<tbody><tr><td colspan="6" style="padding:16px;color:var(--muted);">No procede modelo 390 (SII / REDEME / otros). Conciliar contra libros AEAT.</td></tr></tbody>`;
    return;
  }

  const sum303 = sumar303;

  const dedTotal303 = sum303("c_ded_corr") + sum303("c_ded_inv") + sum303("c_ded_intra");
  const dedBase303 = sum303("b_ded_corr") + sum303("b_ded_inv") + sum303("b_ded_intra");

  const filas = [
    ["Base devengada 21 %", sum303("b21"), state.m390.b21],
    ["Cuota devengada 21 %", sum303("c21"), state.m390.c21],
    ["Base devengada 10 %", sum303("b10"), state.m390.b10],
    ["Cuota devengada 10 %", sum303("c10"), state.m390.c10],
    ["Base devengada 4 %", sum303("b4"), state.m390.b4],
    ["Cuota devengada 4 %", sum303("c4"), state.m390.c4],
    ["Base deducible total", dedBase303, state.m390.b_ded],
    ["Cuota deducible total", dedTotal303, state.m390.c_ded],
    ["Compensación REAGYP", sum303("c_reagyp"), state.m390.c_reagyp || 0],
  ];

  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th><th class="num">Σ 303</th><th class="num">Modelo 390</th>
      <th class="num">Diferencia</th><th class="num">% dif.</th><th class="estado">Estado</th>
    </tr></thead>
    <tbody>${filas.map(([c, a, b]) => filaRecon(c, a, b)).join("")}</tbody>
  `;
}

function filaRecon(concepto, a, b) {
  const r = evaluarDif(a, b);
  const cls = r.estado === "OK" ? "ok" : r.estado === "AVISO" ? "warn" : "err";
  const badge = r.estado === "OK"
    ? `<span class="badge ok">OK</span>`
    : r.estado === "AVISO"
      ? `<span class="badge warn">AVISO</span>`
      : `<span class="badge err">REVISAR</span>`;
  return `<tr class="${cls}">
    <td>${concepto}</td>
    <td class="num">${fmt(a)}</td>
    <td class="num">${fmt(b)}</td>
    <td class="num diff">${fmt(r.dif)}</td>
    <td class="num">${r.pct.toFixed(2)} %</td>
    <td class="estado">${badge}</td>
  </tr>`;
}

function comprobarCausas() {
  const card = document.getElementById("causas-card");
  const hayProblemas = !!document.querySelector(".recon-table tr.err, .recon-table tr.warn");
  card.hidden = !hayProblemas;
}

/* ---------- Recoger datos del DOM antes de guardar ---------- */
function recogerTodo() {
  // Las entradas van actualizando state directamente vía oninput; nada extra.
}

/* ---------- Render global ---------- */
function renderTodo() {
  document.getElementById("ejercicio").value = state.ejercicio;
  renderEntidad();
  renderPeriodSwitchers();
  renderLibros();
  render303();
  render390();
  renderContab();
  renderResultados();
  renderInicio();
}

/* ---------- Helpers ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

let flashTimer;
function flash(msg) {
  let n = document.getElementById("flash-msg");
  if (!n) {
    n = document.createElement("div");
    n.id = "flash-msg";
    n.style.cssText =
      "position:fixed;bottom:24px;right:24px;background:#0f766e;color:white;padding:10px 16px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:13px;z-index:50;transition:opacity .2s;";
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.style.opacity = "1";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (n.style.opacity = "0"), 2000);
}

/* ---------- Dataset de ejemplo (1T 2025 del enunciado) ---------- */
function ejemploDataset() {
  const s = defaultState();
  s.ejercicio = 2025;

  // 1T — emitidas
  s.periodos.trimestral["1T"].emitidas = [
    { fecha: "2025-01-15", numero: "F-001", contraparte: "Cliente A", tipoIva: "21", base: 100000, cuota: 21000 },
    { fecha: "2025-02-10", numero: "F-002", contraparte: "Cliente B", tipoIva: "10", base: 30000, cuota: 3000 },
    { fecha: "2025-03-20", numero: "F-003", contraparte: "Cliente C", tipoIva: "4", base: 5000, cuota: 200 },
  ];
  s.periodos.trimestral["1T"].recibidas = [
    { fecha: "2025-01-10", numero: "P-100", contraparte: "Proveedor X", tipoIva: "21", base: 50000, cuota: 10500, deducible: 100 },
    { fecha: "2025-02-05", numero: "P-101", contraparte: "Proveedor Y", tipoIva: "21", base: 10000, cuota: 2100, deducible: 100 },
    { fecha: "2025-03-12", numero: "P-102", contraparte: "Proveedor Z", tipoIva: "10", base: 8000, cuota: 800, deducible: 100 },
  ];
  s.periodos.trimestral["1T"].m303 = {
    b21: 100000, c21: 21000,
    b10: 30000, c10: 3000,
    b4: 5000, c4: 200,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 60000, c_ded_corr: 12600,
    b_ded_inv: 0, c_ded_inv: 0,
    b_ded_intra: 8000, c_ded_intra: 800,
  };

  // 2T — caso con diferencia (libro 22.000 vs 303 21.580)
  s.periodos.trimestral["2T"].emitidas = [
    { fecha: "2025-04-12", numero: "F-010", contraparte: "Cliente A", tipoIva: "21", base: 104761.90, cuota: 22000 },
    { fecha: "2025-05-22", numero: "F-011", contraparte: "Cliente D", tipoIva: "10", base: 11000, cuota: 1100 },
  ];
  s.periodos.trimestral["2T"].recibidas = [
    { fecha: "2025-04-05", numero: "P-200", contraparte: "Proveedor X", tipoIva: "21", base: 40000, cuota: 8400, deducible: 100 },
  ];
  s.periodos.trimestral["2T"].m303 = {
    b21: 102761.90, c21: 21580,
    b10: 11000, c10: 1100,
    b4: 0, c4: 0,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 40000, c_ded_corr: 8400,
    b_ded_inv: 0, c_ded_inv: 0,
    b_ded_intra: 0, c_ded_intra: 0,
  };

  // 3T y 4T (datos plausibles para que cuadre el anual del enunciado: total 21% = 425.000 / 89.250)
  // 1T: 100.000/21.000 ; 2T (libro): 104.761,90/22.000 ; necesitamos sumar 220.238,10 / 46.250 entre 3T+4T
  s.periodos.trimestral["3T"].emitidas = [
    { fecha: "2025-08-15", numero: "F-020", contraparte: "Cliente A", tipoIva: "21", base: 95000, cuota: 19950 },
  ];
  s.periodos.trimestral["3T"].m303 = {
    b21: 95000, c21: 19950,
    b10: 0, c10: 0, b4: 0, c4: 0,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 0, c_ded_corr: 0, b_ded_inv: 0, c_ded_inv: 0, b_ded_intra: 0, c_ded_intra: 0,
  };
  s.periodos.trimestral["4T"].emitidas = [
    { fecha: "2025-11-30", numero: "F-030", contraparte: "Cliente A", tipoIva: "21", base: 120000, cuota: 25200 },
  ];
  s.periodos.trimestral["4T"].m303 = {
    b21: 120000, c21: 25200,
    b10: 0, c10: 0, b4: 0, c4: 0,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 0, c_ded_corr: 0, b_ded_inv: 0, c_ded_inv: 0, b_ded_intra: 0, c_ded_intra: 0,
  };

  // Modelo 390: cuadra con la suma 303
  s.m390 = {
    b21: 100000 + 102761.90 + 95000 + 120000,
    c21: 21000 + 21580 + 19950 + 25200,
    b10: 30000 + 11000,
    c10: 3000 + 1100,
    b4: 5000,
    c4: 200,
    b_ded: 60000 + 8000 + 40000,
    c_ded: 12600 + 800 + 8400,
  };

  // Contabilidad: cuadra con devengado y deducible reales del libro
  s.contab = {
    c477: 21000 + 22000 + 1100 + 19950 + 25200 + 3000 + 200, // suma cuotas libro emitidas
    c472: 10500 + 2100 + 800 + 8400,                          // suma cuotas libro recibidas
    c4750: 0,
    c4700: 0,
  };

  return s;
}

/* =========================================================
   Importación Excel / CSV / PDF
   ========================================================= */

const HEADER_HINTS = {
  fecha:       ["fecha", "date", "f.factura", "f. factura", "fecha factura", "fecha emision",
                "fecha emisión", "fecha expedicion", "fecha expedición", "fec.expedicion",
                "f.emision", "f. emision", "f. emisión"],
  numero:      ["numero", "número", "nº", "n factura", "num factura", "factura", "n. factura",
                "num. factura", "núm. factura", "n.º factura", "nº factura", "serie-numero",
                "serie-número", "id factura", "ref factura", "referencia"],
  contraparte: ["cliente", "proveedor", "razon social", "razón social", "nombre", "nombre cliente",
                "nombre proveedor", "denominacion", "denominación", "tercero", "destinatario",
                "emisor", "obligado tributario", "contraparte"],
  tipoIva:     ["tipo iva", "tipo", "% iva", "%iva", "iva %", "porcentaje", "tipo impositivo",
                "tipo impositivo iva", "% impositivo", "tipo %", "iva (%)", "porcentaje iva"],
  base:        ["base", "base imponible", "importe base", "neto", "subtotal", "b.imponible",
                "b. imponible", "b imponible", "base iva", "base imp.", "base imp"],
  cuota:       ["cuota", "cuota iva", "iva", "importe iva", "impuesto", "cuota repercutida",
                "cuota soportada", "cuota devengada", "importe cuota", "iva soportado",
                "iva repercutido", "iva devengado"],
  deducible:   ["deducible", "% deducible", "deduccion", "deducción", "porcentaje deducible",
                "ded.", "ded", "% ded", "% ded."],
};

function _normHeader(h) {
  return String(h || "").toLowerCase().trim()
    .replace(/ /g, " ")               // NBSP → espacio
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // sin tildes
    .replace(/[º°]/g, "")                   // ordinal: "Nº" → "n"
    .replace(/\s+/g, " ");
}

function detectarColumnas(headers) {
  const map = {};
  const norm = headers.map(_normHeader);
  // Comparamos también las hints sin tildes
  Object.entries(HEADER_HINTS).forEach(([campo, claves]) => {
    const clavesNorm = claves.map(_normHeader);
    let idx = -1;
    // Primero: coincidencia exacta
    for (const k of clavesNorm) {
      idx = norm.findIndex((h) => h === k);
      if (idx >= 0) break;
    }
    // Si no, que la cabecera contenga la hint o viceversa
    if (idx < 0) {
      for (const k of clavesNorm) {
        idx = norm.findIndex((h) => h.includes(k) || k.includes(h));
        if (idx >= 0) break;
      }
    }
    if (idx >= 0) map[campo] = idx;
  });
  return map;
}

/* Encuentra la fila más probable de cabecera puntuándola por número de
   coincidencias con HEADER_HINTS. Maneja banners y filas sueltas iniciales
   (típicas en libros AEAT o exports de ERPs). */
function detectarFilaCabecera(filas) {
  let mejor = { idx: 0, score: -1 };
  const max = Math.min(filas.length, 25);
  for (let i = 0; i < max; i++) {
    const cab = filas[i].map(_normHeader);
    let score = 0;
    Object.values(HEADER_HINTS).forEach((claves) => {
      const cn = claves.map(_normHeader);
      if (cab.some((c) => c && cn.some((k) => c === k || c.includes(k) || k.includes(c)))) score++;
    });
    if (score > mejor.score) mejor = { idx: i, score };
  }
  return mejor.score >= 2 ? mejor.idx : 0;
}

function normalizarTipoIva(v) {
  const s = String(v ?? "").replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  if (!isFinite(n)) return "21";
  if (Math.abs(n - 21) < 0.5) return "21";
  if (Math.abs(n - 12) < 0.4) return "12";
  if (Math.abs(n - 10.5) < 0.4) return "10.5";
  if (Math.abs(n - 10) < 0.4) return "10";
  if (Math.abs(n - 4) < 0.5) return "4";
  if (Math.abs(n - 0) < 0.5) return "0";
  return "21";
}

function esReagyp(tipoIva) {
  const n = parseFloat(tipoIva);
  return TIPOS_REAGYP.some((t) => Math.abs(n - t) < 0.4);
}

function parseFecha(v) {
  if (!v && v !== 0) return "";
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  let s = String(v).trim();
  // Quitar parte de hora si está pegada: "02/10/2024 0:00" / "2024-10-02T..."
  s = s.replace(/[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?(?:\s*[\-+]\d{2}:?\d{2}|Z)?\s*$/i, "");
  s = s.trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    const [_, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

async function leerArchivoExcel(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellDates: false });
  const hojas = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    return { nombre: name, rows: rows.filter((r) => r.some((c) => c !== "" && c != null)) };
  }).filter((h) => h.rows.length > 0);
  return hojas;
}

async function elegirHoja(hojas) {
  if (!hojas.length) throw new Error("Archivo sin hojas con datos");
  if (hojas.length === 1) return hojas[0].rows;
  return new Promise((resolve) => {
    document.getElementById("modal-title").textContent = "Selecciona la hoja";
    const body = document.getElementById("modal-body");
    body.innerHTML = `
      <p class="preview-meta">El archivo tiene ${hojas.length} hojas. ¿Cuál quieres importar?</p>
      <div id="hoja-list">
        ${hojas.map((h, i) => `
          <label class="mapping-row" style="cursor:pointer;">
            <input type="radio" name="hoja-sel" value="${i}" ${i === 0 ? "checked" : ""} />
            <span><b>${escapeHtml(h.nombre)}</b> · ${h.rows.length} filas</span>
          </label>
        `).join("")}
      </div>
    `;
    abrirModal(() => {
      const idx = parseInt(document.querySelector('input[name="hoja-sel"]:checked').value, 10);
      resolve(hojas[idx].rows);
      return true;
    });
  });
}

function importarLibroDesdeFilas(filas, tipo, tri) {
  if (!filas.length) { flash("Archivo vacío"); return; }
  // Buscar la fila más parecida a una cabecera de libro de IVA puntuándola
  // por coincidencias con HEADER_HINTS. Cae a la primera fila si nada encaja.
  const headerIdx = detectarFilaCabecera(filas);
  const headers = filas[headerIdx].map((c) => String(c ?? ""));
  const datos = filas.slice(headerIdx + 1)
    .filter((r) => r.some((c) => c !== "" && c != null));

  // Detectar primero un formato multi-tipo (Base1/IVA1/tiva1 ... Base7/IVA7/tiva7),
  // típico de programas como ContaPlus, A3 ASESOR y muchos asesoramientos.
  // En este formato cada fila representa una factura con HASTA N tipos de IVA
  // distintos en columnas paralelas, así que tenemos que expandirla en N filas.
  const mappingMulti = detectarColumnasMultirate(headers);
  if (mappingMulti && datos.length) {
    abrirModalConfirmacionMultirate({
      headers, mapping: mappingMulti, datos, tipo, tri, headerIdx,
    });
    return;
  }

  // Formato estándar (1 fila = 1 factura con base+cuota en sus propias columnas)
  const mapping = detectarColumnas(headers);
  const tieneFecha = mapping.fecha != null;
  const tieneImporte = mapping.base != null || mapping.cuota != null;
  if (tieneFecha && tieneImporte && datos.length) {
    abrirModalConfirmacion({ headers, mapping, datos, tipo, tri, headerIdx });
  } else {
    abrirModalMapeo({ headers, mapping, datos, tipo, tri });
  }
}

/* Detecta libros con N tipos de IVA por factura en columnas Base1/IVA1/tiva1 …
   donde:
     BaseN  = base imponible al tipo N
     IVAN   = % de ese tipo (21, 10, 4, 0, etc.)
     tivaN  = cuota IVA correspondiente (= BaseN × IVAN/100)
   También recoge serie/numero, apellidos/nombre, cif, fecha (con o sin hora). */
function detectarColumnasMultirate(headers) {
  const norm = headers.map(_normHeader);
  const find = (...claves) => {
    for (const k of claves) {
      const i = norm.findIndex((h) => h === k);
      if (i >= 0) return i;
    }
    return null;
  };
  // Localizar grupos Base/IVA/tiva (1..9 por si hay variantes)
  const grupos = [];
  for (let n = 1; n <= 9; n++) {
    const baseIdx = find(`base${n}`, `base ${n}`);
    const ivaIdx  = find(`iva${n}`,  `iva ${n}`,  `tipo${n}`,  `tipo ${n}`);
    const cuotaIdx = find(`tiva${n}`, `tiva ${n}`, `cuota${n}`, `cuota ${n}`,
                          `cuotaiva${n}`);
    // Necesitamos al menos base+cuota; el % puede inferirse si falta
    if (baseIdx != null && cuotaIdx != null) {
      grupos.push({ n, base: baseIdx, iva: ivaIdx, cuota: cuotaIdx });
    }
  }
  if (grupos.length === 0) return null;
  return {
    serie:     find("serie"),
    numero:    find("numero", "num", "n", "n factura", "num factura"),
    fecha:     find("fecha", "fecha factura", "f factura", "fecha emision",
                    "fecha expedicion"),
    fechaPro:  find("fecha pro", "fecha_pro", "fechapro", "fecha protocolo",
                    "fecha registro"),
    cif:       find("cif", "nif", "cif/nif", "nif/cif"),
    apellidos: find("apellidos"),
    nombre:    find("nombre", "razon social", "denominacion"),
    grupos,
  };
}

/* Expande cada fila multi-tipo en una o más facturas (una por grupo no-cero).
   Reparte por período según fecha; si no hay fecha válida cae a triFallback. */
function expandirYAplicarMultirate(datos, mapping, tipo, triFallback) {
  const porPeriodo = {};
  const periodosTocados = new Set();
  let total = 0, saltadas = 0;
  for (const r of datos) {
    const get = (i) => i != null ? r[i] : "";
    const fechaRaw = get(mapping.fecha) || get(mapping.fechaPro);
    const fecha = parseFecha(fechaRaw);
    const pk = periodoDesdeFecha(fecha) || triFallback;
    const apellidos = String(get(mapping.apellidos) ?? "").trim();
    const nombreCp  = String(get(mapping.nombre) ?? "").trim();
    const contraparte = [apellidos, nombreCp].filter(Boolean).join(" ").trim()
                       || String(get(mapping.cif) ?? "").trim();
    const serie = String(get(mapping.serie) ?? "").trim();
    const numeroBase = String(get(mapping.numero) ?? "").trim();
    const numero = serie && numeroBase ? `${serie}/${numeroBase}` : (numeroBase || serie);

    let algunaFila = false;
    for (const g of mapping.grupos) {
      const base = num(get(g.base));
      const cuota = num(get(g.cuota));
      let ivaPct = num(get(g.iva));
      if (base === 0 && cuota === 0) continue;
      if (!ivaPct && base > 0) ivaPct = round2(cuota / base * 100);
      const tipoIva = normalizarTipoIva(String(ivaPct || 21));
      const fila = { fecha, numero, contraparte, tipoIva, base, cuota };
      if (tipo === "recibidas") fila.deducible = 100;
      bucket(pk)[tipo].push(fila);
      total++;
      algunaFila = true;
      porPeriodo[pk] = (porPeriodo[pk] || 0) + 1;
      periodosTocados.add(pk);
    }
    if (!algunaFila) saltadas++;
  }
  return { total, porPeriodo, periodosTocados, saltadas };
}

function abrirModalConfirmacionMultirate({ headers, mapping, datos, tipo, tri, headerIdx }) {
  let tipoActual = tipo;
  document.getElementById("modal-title").textContent =
    `Importar ${tipoActual === "emitidas" ? "facturas emitidas" : "facturas recibidas"} (multi-tipo)`;
  const body = document.getElementById("modal-body");

  const labels = {
    fecha: "Fecha", numero: "Nº factura", contraparte: tipoActual === "emitidas" ? "Cliente" : "Proveedor",
  };
  const colName = (idx) => idx == null ? "—" : `“${escapeHtml(headers[idx] || "?")}”`;

  // Preview: expandir las primeras filas en sus N sub-filas
  const muestra = datos.slice(0, 5);
  const filasPreview = [];
  for (const r of muestra) {
    const get = (i) => i != null ? r[i] : "";
    const fecha = parseFecha(get(mapping.fecha) || get(mapping.fechaPro));
    const apellidos = String(get(mapping.apellidos) ?? "").trim();
    const nombreCp  = String(get(mapping.nombre) ?? "").trim();
    const contraparte = [apellidos, nombreCp].filter(Boolean).join(" ").trim();
    const serie = String(get(mapping.serie) ?? "").trim();
    const numeroBase = String(get(mapping.numero) ?? "").trim();
    const numero = serie && numeroBase ? `${serie}/${numeroBase}` : (numeroBase || serie);
    for (const g of mapping.grupos) {
      const base = num(get(g.base));
      const cuota = num(get(g.cuota));
      let ivaPct = num(get(g.iva));
      if (base === 0 && cuota === 0) continue;
      if (!ivaPct && base > 0) ivaPct = round2(cuota / base * 100);
      filasPreview.push({ fecha, numero, contraparte,
        tipoIva: normalizarTipoIva(String(ivaPct || 21)), base, cuota });
    }
  }

  // Totales agregados
  let totalBase = 0, totalCuota = 0, totalFilas = 0;
  for (const r of datos) {
    const get = (i) => i != null ? r[i] : "";
    let any = false;
    for (const g of mapping.grupos) {
      const base = num(get(g.base));
      const cuota = num(get(g.cuota));
      if (base === 0 && cuota === 0) continue;
      totalBase += base;
      totalCuota += cuota;
      totalFilas++;
      any = true;
    }
    if (any) totalFilas; // contador
  }

  const cabeceras = `<th>Fecha</th><th>Nº</th><th>${labels.contraparte}</th>
    <th class="num">Tipo</th><th class="num">Base</th><th class="num">Cuota</th>`;
  const cuerpo = filasPreview.map((f) => `<tr>
    <td>${escapeHtml(f.fecha || "")}</td>
    <td>${escapeHtml(String(f.numero ?? ""))}</td>
    <td>${escapeHtml(String(f.contraparte ?? ""))}</td>
    <td class="num">${escapeHtml(f.tipoIva)} %</td>
    <td class="num">${fmt(f.base)}</td>
    <td class="num">${fmt(f.cuota)}</td>
  </tr>`).join("");

  // Resumen año/períodos a partir del campo fecha (o fechaPro si la fecha falta)
  const yearsSet = new Set();
  const periodosSet = new Set();
  for (const r of datos) {
    const get = (i) => i != null ? r[i] : "";
    const f = parseFecha(get(mapping.fecha) || get(mapping.fechaPro));
    const m = String(f).match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    yearsSet.add(m[1]);
    const mm = parseInt(m[2], 10);
    if (state.modoDeclaracion === "mensual") periodosSet.add(String(mm).padStart(2, "0"));
    else periodosSet.add(TRIMESTRES[Math.floor((mm - 1) / 3)]);
  }
  const years = [...yearsSet].sort();
  const periodosTxt = [...periodosSet].sort().join(", ") || "—";
  const yearMismatch = years.length === 1 && years[0] !== String(state.ejercicio);
  const yearWarn = yearMismatch
    ? `<div class="hint" style="background:var(--warn-bg);color:var(--warn);padding:8px 10px;border-radius:6px;margin-bottom:10px;">
         ⚠ El archivo es del ejercicio <strong>${escapeHtml(years[0])}</strong> pero tu ejercicio activo es <strong>${state.ejercicio}</strong>.
         <a href="#" id="lnk-cambiar-ejercicio2" style="color:inherit;text-decoration:underline;">Cambiar a ${escapeHtml(years[0])}</a>.
       </div>`
    : "";

  body.innerHTML = `
    ${yearWarn}
    <div class="mapping-row" style="margin-bottom:12px;">
      <label><strong>Tipo de libro</strong></label>
      <select id="confirm-tipo-libro-mr">
        <option value="emitidas" ${tipoActual === "emitidas" ? "selected" : ""}>📤 Emitidas (ventas / clientes)</option>
        <option value="recibidas" ${tipoActual === "recibidas" ? "selected" : ""}>📥 Recibidas (compras / proveedores)</option>
      </select>
    </div>
    <p class="preview-meta">
      Detectado <strong>formato multi-tipo</strong> (cada fila puede llevar hasta
      ${mapping.grupos.length} tipos de IVA distintos). Cabecera en la fila
      <strong>${headerIdx + 1}</strong>. <strong>${datos.length}</strong> facturas
      del archivo se expandirán a <strong>${totalFilas}</strong> líneas de libro.
      Total base detectada: <strong>${fmt(totalBase)} €</strong> · cuota:
      <strong>${fmt(totalCuota)} €</strong>.<br>
      Año(s): <strong>${escapeHtml(years.join(", ") || "no detectado")}</strong>.
      Períodos cubiertos: <strong>${escapeHtml(periodosTxt)}</strong>.
    </p>
    <ul style="margin:0 0 12px 16px;padding:0;font-size:12px;line-height:1.7;color:var(--muted);">
      <li>Fecha → ${colName(mapping.fecha)} ${mapping.fechaPro != null ? `(o ${colName(mapping.fechaPro)} si vacía)` : ""}</li>
      <li id="lbl-contraparte">${tipoActual === "emitidas" ? "Cliente" : "Proveedor"} → ${colName(mapping.apellidos)} + ${colName(mapping.nombre)}</li>
      <li>Nº factura → ${mapping.serie != null ? colName(mapping.serie) + " / " : ""}${colName(mapping.numero)}</li>
      <li>${mapping.grupos.length} grupos Base/IVA/cuota detectados:
        ${mapping.grupos.map((g) => `Base${g.n}/IVA${g.n}/tiva${g.n}`).join(", ")}</li>
    </ul>
    <h4 style="margin:6px 0;font-size:13px;">Vista previa (líneas expandidas):</h4>
    <div class="table-scroll">
      <table class="preview-table">
        <thead><tr>${cabeceras}</tr></thead>
        <tbody>${cuerpo}</tbody>
      </table>
    </div>
  `;
  document.getElementById("modal-ok").textContent = `Importar ${totalFilas} líneas`;

  document.getElementById("confirm-tipo-libro-mr").addEventListener("change", (e) => {
    tipoActual = e.target.value;
    document.getElementById("modal-title").textContent =
      `Importar ${tipoActual === "emitidas" ? "facturas emitidas" : "facturas recibidas"} (multi-tipo)`;
    const lbl = document.getElementById("lbl-contraparte");
    if (lbl) lbl.firstChild.textContent =
      `${tipoActual === "emitidas" ? "Cliente" : "Proveedor"} → `;
  });
  const lnkY2 = document.getElementById("lnk-cambiar-ejercicio2");
  if (lnkY2) lnkY2.addEventListener("click", (e) => {
    e.preventDefault();
    state.ejercicio = parseInt(years[0], 10);
    document.getElementById("ejercicio").value = state.ejercicio;
    save();
    e.target.closest(".hint").remove();
  });

  abrirModal(() => {
    document.getElementById("modal-ok").textContent = "Aplicar";
    const res = expandirYAplicarMultirate(datos, mapping, tipoActual, tri);
    autoRellenar303SiVacio(res.periodosTocados, tipoActual);
    save();
    renderLibros();
    if (periodKeys(state.modoDeclaracion).some((k) => k === periodo303Activo)) render303();
    renderResultados();
    const partes = Object.entries(res.porPeriodo)
      .map(([p, n]) => `${n} en ${periodLabel(p)}`).join(", ");
    const skip = res.saltadas ? ` · ${res.saltadas} sin importes` : "";
    flash(`${res.total} líneas (${tipoActual}) importadas (${partes || "sin reparto"})${skip}.`);
    return true;
  });
}

/* Modal compacto: enseña la cabecera detectada, qué columna se asigna a qué
   campo y un preview con los importes ya parseados (para que se vea si los
   "1.234,56" se leen como 1234,56 € o como otra cosa). El usuario confirma
   con un clic; opcionalmente abre el modal completo para ajustar. */
function _resumenAnual(datos, mapping) {
  // Devuelve set de años, periodos cubiertos y meses (para mostrar al usuario
  // qué períodos cubre el archivo).
  const years = new Set();
  const meses = new Set();
  const periodos = new Set();
  let conFecha = 0;
  for (const r of datos) {
    const f = parseFecha(mapping.fecha != null ? r[mapping.fecha] : "");
    const m = String(f).match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    conFecha++;
    years.add(m[1]);
    meses.add(m[2]);
    const mm = parseInt(m[2], 10);
    if (state.modoDeclaracion === "mensual") periodos.add(String(mm).padStart(2, "0"));
    else periodos.add(TRIMESTRES[Math.floor((mm - 1) / 3)]);
  }
  return { years: [...years].sort(), meses: [...meses].sort(),
           periodos: [...periodos].sort(), conFecha, total: datos.length };
}

function abrirModalConfirmacion({ headers, mapping, datos, tipo, tri, headerIdx }) {
  let tipoActual = tipo; // permite cambio dentro del modal
  document.getElementById("modal-title").textContent =
    `Importar ${tipoActual === "emitidas" ? "facturas emitidas" : "facturas recibidas"}`;
  const body = document.getElementById("modal-body");

  const campos = ["fecha", "numero", "contraparte", "tipoIva", "base", "cuota"];
  if (tipoActual === "recibidas") campos.push("deducible");

  const labels = {
    fecha: "Fecha", numero: "Nº factura", contraparte: tipoActual === "emitidas" ? "Cliente" : "Proveedor",
    tipoIva: "Tipo IVA", base: "Base", cuota: "Cuota", deducible: "% Deducible",
  };

  const mapeoHtml = campos.map((c) => {
    const idx = mapping[c];
    if (idx != null) {
      return `<li style="color:var(--ok);">✓ ${labels[c]} → columna “${escapeHtml(headers[idx] || "?")}”</li>`;
    } else {
      const txt = c === "deducible" ? "no detectada (100 % por defecto)"
                : c === "tipoIva"   ? "no detectada (21 % por defecto)"
                : c === "numero"    ? "no detectada"
                : c === "contraparte" ? "no detectada"
                : "no detectada";
      return `<li style="color:var(--muted);">✗ ${labels[c]} ${txt}</li>`;
    }
  }).join("");

  // Preview de las 5 primeras filas con importes ya parseados
  const muestra = datos.slice(0, 5);
  const filas = muestra.map((r) => {
    const get = (k) => mapping[k] != null ? r[mapping[k]] : "";
    const tipoIvaTok = normalizarTipoIva(get("tipoIva") || "21");
    const base = num(get("base"));
    let cuota = num(get("cuota"));
    if (cuota === 0 && base !== 0) cuota = round2(base * parseFloat(tipoIvaTok) / 100);
    const fecha = parseFecha(get("fecha"));
    const dedRaw = mapping.deducible != null ? get("deducible") : "";
    const ded = (dedRaw === "" || dedRaw == null) ? 100 : num(dedRaw);
    return { fecha, numero: get("numero"), contraparte: get("contraparte"),
             tipoIva: tipoIvaTok, base, cuota, deducible: ded };
  });

  const cabeceras = `<th>Fecha</th><th>Nº</th><th>${labels.contraparte}</th>
    <th class="num">Tipo</th><th class="num">Base</th><th class="num">Cuota</th>
    ${tipo === "recibidas" ? '<th class="num">% Ded.</th>' : ""}`;
  const cuerpo = filas.map((f) => `<tr>
    <td>${escapeHtml(f.fecha || "")}</td>
    <td>${escapeHtml(String(f.numero ?? ""))}</td>
    <td>${escapeHtml(String(f.contraparte ?? ""))}</td>
    <td class="num">${escapeHtml(f.tipoIva)} %</td>
    <td class="num">${fmt(f.base)}</td>
    <td class="num">${fmt(f.cuota)}</td>
    ${tipo === "recibidas" ? `<td class="num">${f.deducible}</td>` : ""}
  </tr>`).join("");

  const totalBase = datos.reduce((a, r) => a + num(mapping.base != null ? r[mapping.base] : ""), 0);
  const totalCuota = datos.reduce((a, r) => {
    const b = num(mapping.base != null ? r[mapping.base] : "");
    const c = num(mapping.cuota != null ? r[mapping.cuota] : "");
    const t = normalizarTipoIva(String(mapping.tipoIva != null ? r[mapping.tipoIva] : "21"));
    return a + (c !== 0 ? c : round2(b * parseFloat(t) / 100));
  }, 0);

  const resumen = _resumenAnual(datos, mapping);
  const yearsTxt = resumen.years.length ? resumen.years.join(", ") : "no detectado";
  const periodosTxt = resumen.periodos.length ? resumen.periodos.join(", ") : "—";
  const yearMismatch = resumen.years.length === 1 &&
                       resumen.years[0] !== String(state.ejercicio);
  const yearWarn = yearMismatch
    ? `<div class="hint" style="background:var(--warn-bg);color:var(--warn);padding:8px 10px;border-radius:6px;margin-bottom:10px;">
         ⚠ El archivo es del ejercicio <strong>${escapeHtml(resumen.years[0])}</strong> pero tu ejercicio activo es <strong>${state.ejercicio}</strong>.
         <a href="#" id="lnk-cambiar-ejercicio" style="color:inherit;text-decoration:underline;">Cambiar a ${escapeHtml(resumen.years[0])}</a>.
       </div>`
    : "";

  body.innerHTML = `
    ${yearWarn}
    <div class="mapping-row" style="margin-bottom:12px;">
      <label><strong>Tipo de libro</strong></label>
      <select id="confirm-tipo-libro">
        <option value="emitidas" ${tipoActual === "emitidas" ? "selected" : ""}>📤 Emitidas (ventas / clientes)</option>
        <option value="recibidas" ${tipoActual === "recibidas" ? "selected" : ""}>📥 Recibidas (compras / proveedores)</option>
      </select>
    </div>
    <p class="preview-meta">
      Cabecera detectada en la fila <strong>${headerIdx + 1}</strong>.
      <strong>${datos.length}</strong> facturas. Total base: <strong>${fmt(totalBase)} €</strong>,
      total cuota: <strong>${fmt(totalCuota)} €</strong>.<br>
      Año(s): <strong>${escapeHtml(yearsTxt)}</strong>. Períodos cubiertos: <strong>${escapeHtml(periodosTxt)}</strong>.
      Cada factura se asignará a su período según la fecha.
    </p>
    <ul style="margin:0 0 12px 16px;padding:0;font-size:13px;line-height:1.7;">${mapeoHtml}</ul>
    <h4 style="margin:6px 0;font-size:13px;">Vista previa (primeras 5):</h4>
    <div class="table-scroll">
      <table class="preview-table">
        <thead><tr>${cabeceras}</tr></thead>
        <tbody>${cuerpo}</tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px;">
      ¿Las cantidades no encajan o falta alguna columna?
      <a href="#" id="lnk-ajustar-mapeo">Ajustar el mapeo manualmente</a>.
    </p>
  `;
  document.getElementById("modal-ok").textContent = `Importar ${datos.length} facturas`;

  document.getElementById("confirm-tipo-libro").addEventListener("change", (e) => {
    tipoActual = e.target.value;
    document.getElementById("modal-title").textContent =
      `Importar ${tipoActual === "emitidas" ? "facturas emitidas" : "facturas recibidas"}`;
  });
  const lnkY = document.getElementById("lnk-cambiar-ejercicio");
  if (lnkY) lnkY.addEventListener("click", (e) => {
    e.preventDefault();
    state.ejercicio = parseInt(resumen.years[0], 10);
    document.getElementById("ejercicio").value = state.ejercicio;
    save();
    e.target.closest(".hint").remove();
  });
  const lnk = document.getElementById("lnk-ajustar-mapeo");
  lnk.addEventListener("click", (e) => {
    e.preventDefault();
    cerrarModal();
    abrirModalMapeo({ headers, mapping, datos, tipo: tipoActual, tri });
  });

  abrirModal(() => {
    document.getElementById("modal-ok").textContent = "Aplicar";
    const res = aplicarFilasAutomaticas(datos, mapping, tipoActual, tri);
    autoRellenar303SiVacio(res.periodosTocados, tipoActual);
    save();
    renderLibros();
    if (periodKeys(state.modoDeclaracion).some((k) => k === periodo303Activo)) render303();
    renderResultados();
    const partes = Object.entries(res.porPeriodo)
      .map(([p, n]) => `${n} en ${periodLabel(p)}`).join(", ");
    const skip = res.saltadas ? ` · ${res.saltadas} sin importes` : "";
    flash(`${res.total} facturas (${tipoActual}) importadas (${partes || "sin reparto"})${skip}.`);
    return true;
  });
}

/* Reparte las facturas en buckets por período usando la fecha de cada fila.
   Si el modo es trimestral, calcula el trimestre desde el mes; si es mensual,
   usa el mes directamente. Las filas sin fecha válida caen al período activo. */
function periodoDesdeFecha(fechaIso) {
  if (!fechaIso) return null;
  const m = String(fechaIso).match(/^(\d{4})-(\d{1,2})-/);
  if (!m) return null;
  const mes = parseInt(m[2], 10);
  if (!(mes >= 1 && mes <= 12)) return null;
  if (state.modoDeclaracion === "mensual") return String(mes).padStart(2, "0");
  return TRIMESTRES[Math.floor((mes - 1) / 3)];
}

function aplicarFilasAutomaticas(datos, mapping, tipo, triFallback) {
  const porPeriodo = {};
  const periodosTocados = new Set();
  let total = 0;
  let saltadas = 0;
  datos.forEach((r) => {
    const get = (k) => mapping[k] != null ? r[mapping[k]] : "";
    const tipoIva = normalizarTipoIva(get("tipoIva") || "21");
    const base = num(get("base"));
    let cuota = num(get("cuota"));
    if (cuota === 0 && base !== 0) cuota = round2(base * parseFloat(tipoIva) / 100);
    if (base === 0 && cuota === 0) { saltadas++; return; }
    const fecha = parseFecha(get("fecha"));
    const pk = periodoDesdeFecha(fecha) || triFallback;
    const fila = {
      fecha,
      numero: String(get("numero") ?? ""),
      contraparte: String(get("contraparte") ?? ""),
      tipoIva, base, cuota,
    };
    if (tipo === "recibidas") {
      // Distinguir entre "no hay columna" / "celda vacía" (→ 100 % por
      // defecto) y un valor explícito (incluido el 0).
      let ded = 100;
      if (mapping.deducible != null) {
        const raw = get("deducible");
        if (raw !== "" && raw !== null && raw !== undefined) ded = num(raw);
      }
      fila.deducible = ded;
    }
    bucket(pk)[tipo].push(fila);
    porPeriodo[pk] = (porPeriodo[pk] || 0) + 1;
    periodosTocados.add(pk);
    total++;
  });
  return { total, porPeriodo, periodosTocados, saltadas };
}

/* Tras importar libros, rellena las casillas del 303 que estén a 0. No pisa
   nada que el usuario haya tecleado a mano. Solo afecta a las casillas que
   pueden derivarse del libro recién importado (devengado en emitidas o
   deducible/REAGYP en recibidas). */
function autoRellenar303SiVacio(periodos, tipo) {
  for (const pk of periodos) {
    const m = bucket(pk).m303;
    const emit = totalesLibroEmitidasPorTipo(pk);
    const reci = totalesLibroRecibidasPorTipo(pk);
    if (tipo === "emitidas") {
      if (num(m.b21) === 0) m.b21 = round2(emit[21].base);
      if (num(m.c21) === 0) m.c21 = round2(emit[21].cuota);
      if (num(m.b10) === 0) m.b10 = round2(emit[10].base);
      if (num(m.c10) === 0) m.c10 = round2(emit[10].cuota);
      if (num(m.b4)  === 0) m.b4  = round2(emit[4].base);
      if (num(m.c4)  === 0) m.c4  = round2(emit[4].cuota);
    } else {
      const baseDed = round2(reci[21].base + reci[10].base + reci[4].base);
      const cuotaDed = round2(reci[21].cuota + reci[10].cuota + reci[4].cuota);
      if (num(m.b_ded_corr) === 0) m.b_ded_corr = baseDed;
      if (num(m.c_ded_corr) === 0) m.c_ded_corr = cuotaDed;
      if (num(m.c_reagyp) === 0) m.c_reagyp = round2(totalReagypTrimestre(pk));
    }
  }
}

function abrirModalMapeo({ headers, mapping, datos, tipo, tri }) {
  const body = document.getElementById("modal-body");
  document.getElementById("modal-title").textContent =
    `Importar ${tipo === "emitidas" ? "facturas emitidas" : "facturas recibidas"} — ${periodLabel(tri)}`;

  const campos = ["fecha", "numero", "contraparte", "tipoIva", "base", "cuota"];
  if (tipo === "recibidas") campos.push("deducible");

  const opcionesCol = (sel) => `
    <option value="">— sin asignar —</option>
    ${headers.map((h, i) => `<option value="${i}" ${sel === i ? "selected" : ""}>${escapeHtml(h)} (col ${i + 1})</option>`).join("")}
  `;

  body.innerHTML = `
    <p class="preview-meta">${datos.length} filas detectadas. Verifica el mapeo de columnas:</p>
    <div id="mapeo">
      ${campos.map((c) => `
        <div class="mapping-row">
          <label>${c}</label>
          <select data-campo="${c}">${opcionesCol(mapping[c] ?? "")}</select>
        </div>
      `).join("")}
    </div>
    <h4 style="margin:14px 0 6px;">Vista previa (primeras 5 filas)</h4>
    <div id="preview"></div>
  `;

  const renderPreview = () => {
    const map = {};
    body.querySelectorAll("select[data-campo]").forEach((s) => {
      const v = s.value;
      if (v !== "") map[s.dataset.campo] = parseInt(v, 10);
    });
    const cabeceras = campos.map((c) => `<th>${c}</th>`).join("");
    const cuerpo = datos.slice(0, 5).map((r) => {
      const cels = campos.map((c) => {
        const idx = map[c];
        const val = idx == null ? "" : r[idx];
        const num = ["base", "cuota", "deducible"].includes(c);
        return `<td class="${num ? "num" : ""}">${escapeHtml(String(val ?? ""))}</td>`;
      }).join("");
      return `<tr>${cels}</tr>`;
    }).join("");
    document.getElementById("preview").innerHTML =
      `<table class="preview-table"><thead><tr>${cabeceras}</tr></thead><tbody>${cuerpo}</tbody></table>`;
  };
  body.querySelectorAll("select[data-campo]").forEach((s) => s.addEventListener("change", renderPreview));
  renderPreview();

  abrirModal(() => {
    const map = {};
    body.querySelectorAll("select[data-campo]").forEach((s) => {
      if (s.value !== "") map[s.dataset.campo] = parseInt(s.value, 10);
    });
    if (map.base == null && map.cuota == null) { flash("Debes asignar al menos base o cuota"); return false; }

    const dest = bucket(tri)[tipo];
    let añadidas = 0;
    datos.forEach((r) => {
      const get = (k) => map[k] != null ? r[map[k]] : "";
      const tipoIva = normalizarTipoIva(get("tipoIva") || "21");
      const base = num(get("base"));
      let cuota = num(get("cuota"));
      if (cuota === 0 && base !== 0) cuota = round2(base * parseFloat(tipoIva) / 100);
      const fila = {
        fecha: parseFecha(get("fecha")),
        numero: String(get("numero") ?? ""),
        contraparte: String(get("contraparte") ?? ""),
        tipoIva, base, cuota,
      };
      if (tipo === "recibidas") {
        const ded = num(get("deducible"));
        fila.deducible = ded === 0 ? 100 : ded;
      }
      if (base === 0 && cuota === 0) return;
      dest.push(fila);
      añadidas++;
    });
    save();
    renderLibros();
    flash(`${añadidas} líneas importadas en ${periodLabel(tri)}.`);
    return true;
  });
}

/* ---------- PDF ---------- */
async function extraerTextoPdf(file) {
  if (!window.pdfjsLib) throw new Error("PDF.js no cargado todavía");
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const partes = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const linea = tc.items.map((it) => it.str).join(" ");
    partes.push(linea);
  }
  return partes.join("\n");
}

/* Extracción posicional: agrupa items por coordenada y (con tolerancia ~2pt)
   y los ordena por x. Imprescindible para parsear tablas de PDFs reales,
   donde los items de cada celda llegan en orden arbitrario. */
async function extraerLineasPdf(file) {
  if (!window.pdfjsLib) throw new Error("PDF.js no cargado todavía");
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lineas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // Bucket por y con tolerancia
    const buckets = []; // {y, items}
    for (const it of tc.items) {
      if (!it.str) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let b = buckets.find((bb) => Math.abs(bb.y - y) <= 2.5);
      if (!b) { b = { y, items: [] }; buckets.push(b); }
      b.items.push({ x, str: it.str });
    }
    buckets.sort((a, b) => b.y - a.y); // top first
    for (const b of buckets) {
      b.items.sort((a, c) => a.x - c.x);
      lineas.push({
        page: p,
        y: b.y,
        items: b.items,
        text: b.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(),
      });
    }
  }
  return lineas;
}

/* Detecta el valor de cada casilla del 303. Trabaja en dos pasadas:
   1) Posicional (si tenemos líneas con coords): para cada casilla, busca un
      ítem cuyo texto sea exactamente "NN", "(NN)" o "[NN]" y toma el número
      más cercano a su derecha en la misma línea (o en la siguiente).
   2) Fallback regex sobre el texto plano (formatos inline tipo
      "Casilla 01: 100.000,00" o "[01] 100.000,00").
   Combinamos ambas: la posicional gana, la regex rellena lo que falte. */
const CASILLAS_303 = {
  b21: "01", c21: "03",
  b10: "04", c10: "06",
  b4:  "07", c4:  "09",
  b_intra: "10", c_intra: "11",
  b_isp: "12", c_isp: "13",
  b_ded_corr: "28", c_ded_corr: "29",
  b_ded_inv:  "30", c_ded_inv:  "31",
  b_ded_intra: "36", c_ded_intra: "37",
  c_reagyp: "41",
  c78: "78",
};

function _esTokenCasilla(str, cas) {
  const s = str.trim();
  return s === cas || s === `(${cas})` || s === `[${cas}]` ||
         s === `${cas}.` || s === `${cas}:` || s === `${cas})`;
}
function _esTokenNumero(str) {
  const s = str.trim();
  // acepta 1.234,56 / 1234.56 / -123,45 / (123,45)
  return /^[\-+]?\(?-?[\d][\d.,]*\)?$/.test(s) && /\d/.test(s);
}

function detectarCasillas303Posicional(lineas) {
  const out = {};
  for (const [k, cas] of Object.entries(CASILLAS_303)) {
    let valor = null;
    // Buscar en cada línea un item cuyo texto sea exactamente la casilla
    for (let li = 0; li < lineas.length && valor == null; li++) {
      const items = lineas[li].items;
      for (let i = 0; i < items.length; i++) {
        if (!_esTokenCasilla(items[i].str, cas)) continue;
        // Buscar el siguiente número a la derecha en la misma línea
        for (let j = i + 1; j < items.length; j++) {
          if (_esTokenNumero(items[j].str)) {
            const v = num303(items[j].str);
            if (v !== 0) { valor = v; break; }
          }
        }
        if (valor != null) break;
        // Si nada en la misma línea, mirar la siguiente con x parecida
        if (li + 1 < lineas.length) {
          const xRef = items[i].x;
          const next = lineas[li + 1].items;
          for (const nit of next) {
            if (Math.abs(nit.x - xRef) < 80 && _esTokenNumero(nit.str)) {
              const v = num303(nit.str);
              if (v !== 0) { valor = v; break; }
            }
          }
        }
        if (valor != null) break;
      }
    }
    if (valor != null) out[k] = valor;
  }
  return out;
}

function detectarCasillas303Regex(texto) {
  const out = {};
  const limpio = texto.replace(/ /g, " ");
  const patrones = (cas) => [
    new RegExp(`(?:^|[\\s\\[\\(])${cas}\\s*[\\]\\)\\.:\\-]?\\s+([\\-+]?\\(?[\\d][\\d.,]*\\)?)`, "g"),
    new RegExp(`[Cc]asilla\\s*${cas}\\s*[\\.:\\-]?\\s+([\\-+]?\\(?[\\d][\\d.,]*\\)?)`, "g"),
    new RegExp(`\\(${cas}\\)\\s+([\\-+]?\\(?[\\d][\\d.,]*\\)?)`, "g"),
  ];
  for (const [k, cas] of Object.entries(CASILLAS_303)) {
    const candidatos = [];
    for (const re of patrones(cas)) {
      let m;
      while ((m = re.exec(limpio)) !== null) {
        const v = num303(m[1]);
        if (v !== 0) candidatos.push(v);
      }
    }
    if (candidatos.length) {
      candidatos.sort((a, b) => Math.abs(b) - Math.abs(a));
      out[k] = candidatos[0];
    }
  }
  return out;
}

function detectarCasillas303(texto, lineas) {
  const posicional = lineas ? detectarCasillas303Posicional(lineas) : {};
  const regex = detectarCasillas303Regex(texto);
  // Posicional gana; regex rellena los que faltan
  return { ...regex, ...posicional };
}

// Detecta período (trimestre + ejercicio) en PDF del Modelo 303
function detectarPeriodo303(texto) {
  const t = texto.toUpperCase();
  let trimestre = null, ejercicio = null;
  const mTri = t.match(/\b([1-4])\s*T(?:RIMESTRE)?\b/);
  if (mTri) trimestre = parseInt(mTri[1], 10);
  const mPer = t.match(/PER[ÍI]ODO\D{0,5}([0-3])([1-4])/);
  if (mPer && !trimestre) trimestre = parseInt(mPer[2], 10);
  const mEj = t.match(/\b(20\d{2})\b/);
  if (mEj) ejercicio = parseInt(mEj[1], 10);
  return { trimestre, ejercicio };
}

async function importarPdf303Multiple(files, periodoDefault) {
  flash(`Procesando ${files.length} PDF${files.length === 1 ? "" : "s"}...`);
  const items = [];
  for (const file of files) {
    try {
      const lineas = await extraerLineasPdf(file);
      const txt = lineas.map((l) => l.text).join("\n");
      const detect = detectarCasillas303(txt, lineas);
      const periodo = detectarPeriodo303(txt);
      let pkFinal = periodoDefault;
      if (state.modoDeclaracion === "trimestral" && periodo.trimestre) {
        pkFinal = TRIMESTRES[periodo.trimestre - 1];
      } else if (state.modoDeclaracion === "mensual" && periodo.mes) {
        pkFinal = String(periodo.mes).padStart(2, "0");
      }
      items.push({ fileName: file.name, detect, periodo, pk: pkFinal,
                   ok: Object.keys(detect).length > 0 });
    } catch (e) {
      items.push({ fileName: file.name, detect: {}, periodo: {}, pk: periodoDefault,
                   ok: false, error: e.message });
    }
  }
  abrirModalPreviewMultiple303(items);
}

function abrirModalPreviewMultiple303(items) {
  document.getElementById("modal-title").textContent =
    `Importar ${items.length} modelo${items.length === 1 ? "" : "s"} 303`;
  const body = document.getElementById("modal-body");
  const opciones = periodKeys(state.modoDeclaracion).map((k) =>
    `<option value="${k}">${periodLabel(k)}</option>`
  ).join("");

  const filas = items.map((it, i) => {
    const opcionesSel = periodKeys(state.modoDeclaracion).map((k) =>
      `<option value="${k}" ${k === it.pk ? "selected" : ""}>${periodLabel(k)}</option>`
    ).join("");
    return `
      <tr>
        <td>${escapeHtml(it.fileName)}</td>
        <td>${it.ok ? `<span style="color:var(--ok);">✓ ${Object.keys(it.detect).length} casillas</span>`
                    : `<span style="color:var(--err);">✗ ${escapeHtml(it.error || "no detectado")}</span>`}</td>
        <td>${it.periodo.trimestre ? it.periodo.trimestre + "T" : "—"} ${it.periodo.ejercicio || ""}</td>
        <td>
          <select data-row="${i}" ${it.ok ? "" : "disabled"}>${opcionesSel}</select>
        </td>
        <td class="num">${it.ok ? fmt(it.detect.c21 || 0) : "—"}</td>
        <td class="num">${it.ok ? fmt(it.detect.c_ded_corr || 0) : "—"}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <p class="preview-meta">
      Cada fila es un PDF. La aplicación ha detectado el período de cada uno; ajusta si hace falta antes de aplicar.
    </p>
    <table class="preview-table">
      <thead>
        <tr>
          <th>Archivo</th><th>Detección</th><th>Período PDF</th>
          <th>Asignar a</th><th class="num">Cuota 21 %</th><th class="num">Cuota deduc.</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;

  abrirModal(() => {
    let aplicados = 0;
    items.forEach((it, i) => {
      if (!it.ok) return;
      const sel = body.querySelector(`select[data-row="${i}"]`);
      const pk = sel.value;
      const m = bucket(pk).m303;
      Object.entries(it.detect).forEach(([k, v]) => { m[k] = v; });
      aplicados++;
    });
    save();
    render303();
    renderResultados();
    flash(`${aplicados} modelo${aplicados === 1 ? "" : "s"} 303 aplicados.`);
    return true;
  });
}

function abrirModalPreview303(detect, pkActiva, textoOrig, periodo) {
  document.getElementById("modal-title").textContent = `Importar Modelo 303`;
  const body = document.getElementById("modal-body");
  const labels = {
    b21: "Base 21 % (01)", c21: "Cuota 21 % (03)",
    b10: "Base 10 % (04)", c10: "Cuota 10 % (06)",
    b4:  "Base 4 % (07)",  c4:  "Cuota 4 % (09)",
    b_intra: "Base intracom. (10)", c_intra: "Cuota intracom. (11)",
    b_isp: "Base ISP (12)", c_isp: "Cuota ISP (13)",
    b_ded_corr: "Base deducible corriente (28)", c_ded_corr: "Cuota deducible corriente (29)",
    b_ded_inv: "Base inversión (30)", c_ded_inv: "Cuota inversión (31)",
    b_ded_intra: "Base intracom. ded. (36)", c_ded_intra: "Cuota intracom. ded. (37)",
    c_reagyp: "Compensación REAGYP (41)",
  };
  const detectInfo = periodo && (periodo.trimestre || periodo.ejercicio)
    ? `Detectado: ${periodo.trimestre ? periodo.trimestre + "T " : ""}${periodo.ejercicio || ""}`
    : "Período no detectado.";
  const opciones = periodKeys(state.modoDeclaracion).map((k) => `
    <option value="${k}" ${k === pkActiva ? "selected" : ""}>${periodLabel(k)}</option>
  `).join("");
  body.innerHTML = `
    <p class="preview-meta">${detectInfo} Asigna el período destino y revisa los importes detectados.</p>
    <div class="mapping-row">
      <label>Período destino</label>
      <select id="pdf-tri-target">${opciones}</select>
    </div>
    <div class="grid casillas">
      ${Object.keys(labels).map((k) => `
        <div class="casilla-row" style="background:#fafbfd;padding:8px;border-radius:4px;">
          <span>${labels[k]}</span>
          <input data-pdf="${k}" type="number" step="0.01" value="${detect[k] ?? 0}" />
        </div>
      `).join("")}
    </div>
  `;
  abrirModal(() => {
    const pkDest = document.getElementById("pdf-tri-target").value;
    const m = bucket(pkDest).m303;
    body.querySelectorAll("[data-pdf]").forEach((el) => {
      m[el.dataset.pdf] = num(el.value);
    });
    save();
    if (pkDest === periodo303Activo) render303();
    flash(`Modelo 303 ${periodLabel(pkDest)} actualizado.`);
    return true;
  });
}

async function importarPdf390(file) {
  try {
    const txt = await extraerTextoPdf(file);
    // Heurística simple: buscar etiquetas y los siguientes importes
    const buscar = (etiqueta) => {
      const re = new RegExp(etiqueta + "[^0-9]{0,30}([\\-+]?[0-9.,]+)", "i");
      const m = txt.match(re);
      return m ? num303(m[1]) : 0;
    };
    const detect = {
      b21: buscar("base.{0,30}21"),
      c21: buscar("cuota.{0,30}21"),
      b10: buscar("base.{0,30}10"),
      c10: buscar("cuota.{0,30}10"),
      b4:  buscar("base.{0,30}4"),
      c4:  buscar("cuota.{0,30}4"),
      b_ded: buscar("base.{0,30}deducible"),
      c_ded: buscar("cuota.{0,30}deducible"),
    };
    document.getElementById("modal-title").textContent = "Importar Modelo 390 (anual)";
    const body = document.getElementById("modal-body");
    const labels = {
      b21: "Base 21 %", c21: "Cuota 21 %",
      b10: "Base 10 %", c10: "Cuota 10 %",
      b4: "Base 4 %", c4: "Cuota 4 %",
      b_ded: "Base deducible total", c_ded: "Cuota deducible total",
    };
    body.innerHTML = `
      <p class="preview-meta">Detección heurística — verifica antes de aplicar.</p>
      <div class="grid casillas">
        ${Object.keys(labels).map((k) => `
          <div class="casilla-row" style="background:#fafbfd;padding:8px;border-radius:4px;">
            <span>${labels[k]}</span>
            <input data-pdf="${k}" type="number" step="0.01" value="${detect[k] ?? 0}" />
          </div>
        `).join("")}
      </div>
    `;
    abrirModal(() => {
      body.querySelectorAll("[data-pdf]").forEach((el) => {
        state.m390[el.dataset.pdf] = num(el.value);
      });
      save();
      render390();
      flash("Modelo 390 actualizado.");
      return true;
    });
  } catch (e) {
    flash("Error leyendo PDF: " + e.message);
  }
}

/* Parser PDF de libro de IVA — robusto a layouts variados (AEAT, Sage, A3,
   Holded, etc.). Trabaja a nivel de línea posicional: para cada línea del
   PDF identifica si parece una factura buscando una fecha, un porcentaje
   IVA y al menos dos números (base y cuota). El resto de tokens se
   interpretan como número de factura y nombre de contraparte. */
const RE_FECHA = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/;
// Token "parece un importe": empieza por dígito (con posible signo o paréntesis
// de apertura), tiene al menos un dígito y solo caracteres de número/separadores
// con sufijo opcional € / EUR.
const RE_NUMERO_PURO = /^[\-+]?\(?-?\d[\d.,]*\)?\s*(?:€|EUR|EUROS?)?$/i;
const RE_PORC_IVA = /^(21|10|4|12|10[.,]5|0)\s*%?$/i;
const RE_PORC_IVA_BLANDA = /(?:^|\s)(21|10|4|12|10[.,]5|0)\s*%/i;

function parsearLineaFacturaPdf(linea) {
  // Tokens "ricos" (preservan posición x)
  const items = linea.items || [];
  if (!items.length) return null;

  // Localizar fecha en cualquier item (puede estar pegada a otros caracteres)
  let fechaTok = null, fechaIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const m = items[i].str.match(RE_FECHA);
    if (m) { fechaTok = m[1]; fechaIdx = i; break; }
  }
  if (!fechaTok) return null;

  // Localizar tipo IVA y números
  let tipoIvaTok = null;
  const numericos = []; // {x, val, idx}
  for (let i = 0; i < items.length; i++) {
    const s = items[i].str.trim();
    if (!s) continue;
    if (!tipoIvaTok && RE_PORC_IVA.test(s)) {
      tipoIvaTok = s.replace(/[^\d.,]/g, "").replace(",", ".");
      continue;
    }
    if (RE_NUMERO_PURO.test(s)) {
      const v = num303(s);
      if (isFinite(v) && v !== 0) numericos.push({ x: items[i].x, val: v, idx: i });
    }
  }

  // Si no encontramos tipo IVA aislado, probar en el texto unido
  if (!tipoIvaTok) {
    const tm = linea.text.match(RE_PORC_IVA_BLANDA);
    if (tm) tipoIvaTok = tm[1].replace(",", ".");
  }

  // Necesitamos al menos 2 importes (base + cuota); si solo hay 1, no es fila.
  if (numericos.length < 2) return null;

  // Heurística: los 2 últimos números (más a la derecha) son base y cuota.
  numericos.sort((a, b) => a.x - b.x);
  const ultimos = numericos.slice(-2);
  const base = ultimos[0].val;
  const cuota = ultimos[1].val;

  // Tipo IVA: el explícito si existe; si no, lo deducimos del ratio cuota/base.
  let tipoIva = tipoIvaTok || "21";
  if (!tipoIvaTok && base > 0) {
    tipoIva = normalizarTipoIva(String(cuota / base * 100));
  }

  // Número de factura: token tras la fecha que NO sea numérico ni tipo IVA.
  // Contraparte: el resto de tokens textuales de la línea.
  const noFijos = new Set([fechaIdx, ...ultimos.map((u) => u.idx)]);
  const noNumIvaIdx = items.findIndex((it, i) =>
    i > fechaIdx && !noFijos.has(i) && it.str.trim() &&
    !RE_NUMERO_PURO.test(it.str.trim()) && !RE_PORC_IVA.test(it.str.trim())
  );
  let numero = "";
  if (noNumIvaIdx >= 0) numero = items[noNumIvaIdx].str.trim();

  const contraparte = items
    .map((it, i) => ({ it, i }))
    .filter(({ it, i }) =>
      i !== fechaIdx && i !== noNumIvaIdx && !noFijos.has(i) &&
      it.str.trim() && !RE_NUMERO_PURO.test(it.str.trim()) &&
      !RE_PORC_IVA.test(it.str.trim()))
    .map(({ it }) => it.str.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { fecha: fechaTok, numero, contraparte, tipoIva, base, cuota };
}

async function importarLibroDesdePdf(file, tipo, tri) {
  try {
    const lineas = await extraerLineasPdf(file);
    const filas = [["fecha", "numero", "contraparte", "tipo iva", "base", "cuota"]];
    for (const linea of lineas) {
      const f = parsearLineaFacturaPdf(linea);
      if (f) filas.push([f.fecha, f.numero, f.contraparte, f.tipoIva, f.base, f.cuota]);
    }
    if (filas.length <= 1) {
      flash("No se han detectado líneas de factura en el PDF. Prueba con Excel/CSV.");
      return;
    }
    importarLibroDesdeFilas(filas, tipo, tri);
  } catch (e) {
    flash("Error leyendo PDF: " + e.message);
  }
}

/* ---------- Modal genérico ---------- */
let modalCallback = null;
function abrirModal(onOk) {
  modalCallback = onOk;
  document.getElementById("modal").hidden = false;
}
function cerrarModal() {
  modalCallback = null;
  document.getElementById("modal").hidden = true;
  // Restaurar el texto por defecto del botón principal
  const ok = document.getElementById("modal-ok");
  if (ok) ok.textContent = "Aplicar";
}
document.getElementById("modal-close").addEventListener("click", cerrarModal);
document.getElementById("modal-cancel").addEventListener("click", cerrarModal);
document.getElementById("modal-ok").addEventListener("click", () => {
  if (modalCallback) {
    const r = modalCallback();
    if (r !== false) cerrarModal();
  } else cerrarModal();
});

/* ---------- Listeners de los inputs file ---------- */
function bindImport(id, handler) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await handler(f);
    e.target.value = "";
  });
}
function bindImportMultiple(id, handler) {
  document.getElementById(id).addEventListener("change", async (e) => {
    const fs = Array.from(e.target.files || []);
    if (!fs.length) return;
    await handler(fs);
    e.target.value = "";
  });
}
bindImport("imp-emitidas-xlsx", async (f) => {
  const hojas = await leerArchivoExcel(f);
  const filas = await elegirHoja(hojas);
  importarLibroDesdeFilas(filas, "emitidas", periodoLibroActivo);
});
bindImport("imp-recibidas-xlsx", async (f) => {
  const hojas = await leerArchivoExcel(f);
  const filas = await elegirHoja(hojas);
  importarLibroDesdeFilas(filas, "recibidas", periodoLibroActivo);
});
bindImportMultiple("imp-emitidas-pdf", async (fs) => {
  for (const f of fs) await importarLibroDesdePdf(f, "emitidas", periodoLibroActivo);
});
bindImportMultiple("imp-recibidas-pdf", async (fs) => {
  for (const f of fs) await importarLibroDesdePdf(f, "recibidas", periodoLibroActivo);
});
bindImportMultiple("imp-303-pdf", (fs) => importarPdf303Multiple(fs, periodo303Activo));
bindImport("imp-390-pdf", (f) => importarPdf390(f));

/* ---------- Plantilla descargable ---------- */
document.getElementById("link-plantilla").addEventListener("click", (e) => {
  e.preventDefault();
  if (!window.XLSX) { flash("Esperando a que se cargue el motor Excel..."); return; }
  const wb = XLSX.utils.book_new();
  const emit = [
    ["Fecha", "Nº factura", "Cliente", "Tipo IVA", "Base", "Cuota"],
    ["2025-01-15", "F-001", "Cliente A", 21, 100000, 21000],
    ["2025-02-10", "F-002", "Cliente B", 10, 30000, 3000],
  ];
  const reci = [
    ["Fecha", "Nº factura", "Proveedor", "Tipo IVA", "Base", "Cuota", "Deducible"],
    ["2025-01-10", "P-100", "Proveedor X", 21, 50000, 10500, 100],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(emit), "Emitidas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reci), "Recibidas");
  XLSX.writeFile(wb, "plantilla-libros-iva.xlsx");
});

/* ---------- Drag & drop sobre las dropzones ---------- */
function bindDropzones() {
  document.querySelectorAll("label.dropzone").forEach((zone) => {
    const inputId = zone.getAttribute("for");
    const input = inputId && document.getElementById(inputId);
    if (!input) return;
    ["dragenter", "dragover"].forEach((ev) =>
      zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag-over"); }));
    ["dragleave", "drop"].forEach((ev) =>
      zone.addEventListener(ev, () => zone.classList.remove("drag-over")));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      const dt = new DataTransfer();
      Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

/* ---------- Zona universal: detecta el tipo de archivo y enruta ----------
   El usuario suelta cualquier Excel/CSV/PDF en una única zona y nosotros
   decidimos si es libro de ventas/compras o Modelo 303/390. */
async function manejarArchivoUniversal(file) {
  try {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const lower = file.name.toLowerCase();

    if (ext === "pdf") {
      const lineas = await extraerLineasPdf(file);
      const txt = lineas.map((l) => l.text).join("\n");

      // ¿Es modelo 303? Buscamos casillas conocidas; si encontramos varias,
      // lo es. Si no, miramos si parece 390 o libro PDF.
      const detect303 = detectarCasillas303(txt, lineas);
      const numCasillas303 = Object.keys(detect303).length;
      if (numCasillas303 >= 3 || /modelo\s*303|303[\s_-]/i.test(lower)) {
        await importarPdf303Multiple([file], periodo303Activo);
        return;
      }
      if (/modelo\s*390|390[\s_-]/i.test(lower) || /resumen\s*anual/i.test(txt)) {
        await importarPdf390(file);
        return;
      }
      // Asumimos libro PDF — auto-detectar emitidas/recibidas
      const tipoLibro = detectarTipoDesdeNombre(file.name) ||
                        detectarTipoDesdeTextoPdf(txt) || "emitidas";
      await importarLibroDesdePdf(file, tipoLibro, periodoLibroActivo);
      return;
    }

    if (["xlsx", "xls", "csv"].includes(ext)) {
      const hojas = await leerArchivoExcel(file);
      const filas = await elegirHoja(hojas);
      const tipoLibro = detectarTipoDesdeNombre(file.name) ||
                        detectarTipoDesdeFilas(filas) || "emitidas";
      importarLibroDesdeFilas(filas, tipoLibro, periodoLibroActivo);
      return;
    }
    flash("Tipo de archivo no reconocido: " + file.name);
  } catch (err) {
    flash("Error procesando " + file.name + ": " + err.message);
  }
}

function detectarTipoDesdeNombre(name) {
  const n = String(name || "").toLowerCase();
  if (/(venta|emiti|emisi|ingreso|repercut|cliente)/i.test(n)) return "emitidas";
  if (/(compra|recib|gasto|soport|proveedor)/i.test(n)) return "recibidas";
  return null;
}
function detectarTipoDesdeFilas(filas) {
  const headerIdx = detectarFilaCabecera(filas);
  const headers = (filas[headerIdx] || []).map((h) => _normHeader(String(h ?? "")));
  if (headers.some((h) => h.includes("cliente"))) return "emitidas";
  if (headers.some((h) => h.includes("proveedor"))) return "recibidas";
  // Cuenta de mayor (PGC): 43xxx → cliente (emitidas) · 40xxx → proveedor (recibidas)
  const idxMayor = headers.findIndex((h) => h === "mayor" || h === "cuenta" || h === "cuenta mayor");
  if (idxMayor >= 0) {
    let votos = { emitidas: 0, recibidas: 0 };
    const fin = Math.min(headerIdx + 1 + 20, filas.length);
    for (let i = headerIdx + 1; i < fin; i++) {
      const v = String(filas[i][idxMayor] ?? "").trim();
      if (/^43\d/.test(v)) votos.emitidas++;
      else if (/^40\d/.test(v)) votos.recibidas++;
    }
    if (votos.emitidas > votos.recibidas) return "emitidas";
    if (votos.recibidas > votos.emitidas) return "recibidas";
  }
  return null;
}
function detectarTipoDesdeTextoPdf(txt) {
  const t = String(txt || "").toLowerCase();
  if (/libro.*(venta|emiti|repercut)|facturas?\s*emitidas/.test(t)) return "emitidas";
  if (/libro.*(compra|recib|soport)|facturas?\s*recibidas/.test(t)) return "recibidas";
  return null;
}

document.getElementById("imp-universal").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  for (const f of files) await manejarArchivoUniversal(f);
  refrescarBarraEstado();
});

/* ---------- Barra de estado: progreso del flujo ---------- */
function refrescarBarraEstado() {
  const sb = document.getElementById("status-bar");
  if (!sb) return;
  let totalFacturas = 0;
  let periodosCon303 = 0;
  todosLosBuckets().forEach((b) => {
    totalFacturas += b.emitidas.length + b.recibidas.length;
    const m = b.m303;
    const algoTeclado = num(m.c21) + num(m.c10) + num(m.c4) +
                        num(m.c_ded_corr) + num(m.c_ded_inv) + num(m.c_ded_intra) +
                        num(m.c_reagyp);
    if (algoTeclado !== 0) periodosCon303++;
  });
  const tieneEnt = !!(state.entidad.nombre || state.entidad.nif);
  const tieneCont = num(state.contab.c477) || num(state.contab.c472) ||
                    num(state.contab.c4750) || num(state.contab.c4700);
  const partes = [
    `<span class="step ${tieneEnt ? "done" : "empty"}">${tieneEnt ? "✓" : "○"} Entidad${tieneEnt ? `: ${escapeHtml(state.entidad.nombre || state.entidad.nif)}` : ""}</span>`,
    `<span class="step ${totalFacturas ? "done" : "empty"}">${totalFacturas ? "✓" : "○"} Libros: <strong>${totalFacturas}</strong> facturas</span>`,
    `<span class="step ${periodosCon303 ? "done" : "empty"}">${periodosCon303 ? "✓" : "○"} 303: <strong>${periodosCon303}</strong>/${periodKeys(state.modoDeclaracion).length} períodos</span>`,
    `<span class="step ${tieneCont ? "done" : "empty"}">${tieneCont ? "✓" : "○"} Contabilidad</span>`,
  ];
  // Hint del siguiente paso
  let nextHint = "";
  if (!tieneEnt) nextHint = `<a href="#" class="next-hint" data-go="entidad">→ Empieza por Entidad</a>`;
  else if (!totalFacturas) nextHint = `<a href="#" class="next-hint" data-go="libros">→ Sube tus libros</a>`;
  else if (!periodosCon303) nextHint = `<a href="#" class="next-hint" data-go="m303">→ Revisa el Modelo 303</a>`;
  else nextHint = `<a href="#" class="next-hint" data-go="result">→ Ver Conciliación</a>`;
  sb.innerHTML = partes.join("") + nextHint;
  sb.querySelectorAll("[data-go]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = document.querySelector(`.tab[data-tab="${a.dataset.go}"]`);
      if (tab) tab.click();
    });
  });
}

// Refrescar la barra y el resumen Inicio en cada save() y en cada render global.
const _save_orig = save;
save = function () { _save_orig(); refrescarBarraEstado(); renderInicio(); };
const _renderTodo_orig = renderTodo;
renderTodo = function () { _renderTodo_orig(); refrescarBarraEstado(); };

/* ---------- Init ---------- */
bindDropzones();
renderTodo();
refrescarBarraEstado();
