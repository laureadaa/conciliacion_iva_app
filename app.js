/* =========================================================
   Conciliación del IVA — España
   ----------------------------------------------------------
   Tres conciliaciones:
     1) Contabilidad ↔ Libros IVA
     2) Libros IVA ↔ Modelo 303
     3) Σ Modelo 303 ↔ Modelo 390
   Tolerancia: ±1 € o ±1 % por línea.
   ========================================================= */

const STORAGE_KEY = "iva-conciliacion-v1";
const TOLERANCIA_EUR = 1.0;
const TOLERANCIA_PCT = 1.0;

const TIPOS_IVA = ["21", "10", "4", "0"];

const empty303 = () => ({
  b21: 0, c21: 0,
  b10: 0, c10: 0,
  b4: 0, c4: 0,
  b_intra: 0, c_intra: 0,
  b_isp: 0, c_isp: 0,
  b_ded_corr: 0, c_ded_corr: 0,
  b_ded_inv: 0, c_ded_inv: 0,
  b_ded_intra: 0, c_ded_intra: 0,
});

const defaultState = () => ({
  ejercicio: 2025,
  presenta390: true,
  trimestres: {
    1: { emitidas: [], recibidas: [], m303: empty303() },
    2: { emitidas: [], recibidas: [], m303: empty303() },
    3: { emitidas: [], recibidas: [], m303: empty303() },
    4: { emitidas: [], recibidas: [], m303: empty303() },
  },
  m390: { b21: 0, c21: 0, b10: 0, c10: 0, b4: 0, c4: 0, b_ded: 0, c_ded: 0 },
  contab: { c477: 0, c472: 0, c4750: 0, c4700: 0 },
});

let state = load() || defaultState();
let triLibroActivo = 1;
let tri303Activo = 1;
let triResultActivo = 1;

/* ---------- Utilidades ---------- */
const fmt = (n) =>
  (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
};
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
  });
});

/* ---------- Selectores trimestre ---------- */
document.querySelectorAll('input[name="tri-libro"]').forEach((r) => {
  r.addEventListener("change", (e) => {
    triLibroActivo = parseInt(e.target.value, 10);
    renderLibros();
  });
});
document.querySelectorAll('input[name="tri-303"]').forEach((r) => {
  r.addEventListener("change", (e) => {
    tri303Activo = parseInt(e.target.value, 10);
    render303();
  });
});
document.querySelectorAll('input[name="tri-result"]').forEach((r) => {
  r.addEventListener("change", (e) => {
    triResultActivo = parseInt(e.target.value, 10);
    renderResultados();
  });
});

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
    const t = state.trimestres[triLibroActivo];
    const fila = tipo === "emitidas"
      ? { fecha: "", numero: "", contraparte: "", tipoIva: "21", base: 0, cuota: 0 }
      : { fecha: "", numero: "", contraparte: "", tipoIva: "21", base: 0, cuota: 0, deducible: 100 };
    t[tipo].push(fila);
    renderLibros();
  });
});

document.getElementById("ejercicio").addEventListener("input", (e) => {
  state.ejercicio = parseInt(e.target.value, 10) || new Date().getFullYear();
});

document.getElementById("presenta-390").addEventListener("change", (e) => {
  state.presenta390 = e.target.checked;
  document.getElementById("m390-form").style.opacity = state.presenta390 ? "1" : ".4";
  document.getElementById("m390-form").style.pointerEvents = state.presenta390 ? "auto" : "none";
});

/* ---------- Render: Libros ---------- */
function renderLibros() {
  const t = state.trimestres[triLibroActivo];
  renderTablaFacturas("emitidas", t.emitidas);
  renderTablaFacturas("recibidas", t.recibidas);
  renderTotalesTipo();
}

function renderTablaFacturas(tipo, filas) {
  const tbody = document.querySelector(`#tbl-${tipo} tbody`);
  tbody.innerHTML = "";
  filas.forEach((f, i) => {
    const tr = document.createElement("tr");
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
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", (e) => {
      const i = parseInt(e.target.dataset.i, 10);
      const k = e.target.dataset.k;
      let v = e.target.value;
      if (["base", "cuota", "deducible"].includes(k)) v = num(v);
      filas[i][k] = v;
      // Auto-cuota si el usuario edita base y la cuota está vacía o el tipo es coherente
      if (k === "base" || k === "tipoIva") {
        const tasa = parseFloat(filas[i].tipoIva) / 100;
        if (Math.abs(filas[i].cuota - filas[i].base * tasa) > 0.01 && filas[i].cuota === 0) {
          filas[i].cuota = round2(filas[i].base * tasa);
        }
      }
      renderTotalesTipo();
      actualizarFooterTabla(tipo);
    });
  });

  tbody.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", (e) => {
      const i = parseInt(e.currentTarget.dataset.del, 10);
      filas.splice(i, 1);
      renderLibros();
    });
  });

  actualizarFooterTabla(tipo);
}

function actualizarFooterTabla(tipo) {
  const t = state.trimestres[triLibroActivo];
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
    const filas = state.trimestres[triLibroActivo][tipo];
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
  const m = state.trimestres[tri303Activo].m303;
  document.querySelectorAll("[data-303]").forEach((el) => {
    el.value = m[el.dataset["303"]] ?? 0;
    el.oninput = () => {
      m[el.dataset["303"]] = num(el.value);
      actualizarResumen303();
    };
  });
  actualizarResumen303();
}

function actualizarResumen303() {
  const m = state.trimestres[tri303Activo].m303;
  const dev = m.c21 + m.c10 + m.c4 + m.c_intra + m.c_isp;
  const ded = m.c_ded_corr + m.c_ded_inv + m.c_ded_intra;
  const res = dev - ded;
  document.getElementById("r303-dev").textContent = fmt(dev);
  document.getElementById("r303-ded").textContent = fmt(ded);
  document.getElementById("r303-res").textContent = fmt(res);
  document.getElementById("r303-71").textContent = fmt(res);
}

/* ---------- Render: Modelo 390 ---------- */
function render390() {
  document.getElementById("presenta-390").checked = state.presenta390;
  const form = document.getElementById("m390-form");
  form.style.opacity = state.presenta390 ? "1" : ".4";
  form.style.pointerEvents = state.presenta390 ? "auto" : "none";
  document.querySelectorAll("[data-390]").forEach((el) => {
    el.value = state.m390[el.dataset["390"]] ?? 0;
    el.oninput = () => { state.m390[el.dataset["390"]] = num(el.value); };
  });
}

/* ---------- Render: Contabilidad ---------- */
function renderContab() {
  document.querySelectorAll("[data-cont]").forEach((el) => {
    el.value = state.contab[el.dataset.cont] ?? 0;
    el.oninput = () => { state.contab[el.dataset.cont] = num(el.value); };
  });
}

/* ---------- Cálculos ---------- */
function totalesLibroEmitidasPorTipo(tri) {
  const r = { 21: { base: 0, cuota: 0 }, 10: { base: 0, cuota: 0 }, 4: { base: 0, cuota: 0 }, 0: { base: 0, cuota: 0 } };
  state.trimestres[tri].emitidas.forEach((f) => {
    const k = f.tipoIva;
    if (!r[k]) r[k] = { base: 0, cuota: 0 };
    r[k].base += num(f.base);
    r[k].cuota += num(f.cuota);
  });
  return r;
}

function totalesLibroRecibidasPorTipo(tri) {
  const r = { 21: { base: 0, cuota: 0 }, 10: { base: 0, cuota: 0 }, 4: { base: 0, cuota: 0 }, 0: { base: 0, cuota: 0 } };
  state.trimestres[tri].recibidas.forEach((f) => {
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
  for (let t = 1; t <= 4; t++) {
    state.trimestres[t].emitidas.forEach((f) => total += num(f.cuota));
  }
  return total;
}
function totalLibroDeducibleAnual() {
  let total = 0;
  for (let t = 1; t <= 4; t++) {
    state.trimestres[t].recibidas.forEach((f) => total += num(f.cuota) * num(f.deducible) / 100);
  }
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

/* ---------- Render: Resultados ---------- */
function renderResultados() {
  renderReconContab();
  renderRecon303();
  renderRecon390();
  comprobarCausas();
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
  const tri = triResultActivo;
  const emit = totalesLibroEmitidasPorTipo(tri);
  const reci = totalesLibroRecibidasPorTipo(tri);
  const m = state.trimestres[tri].m303;

  const filas = [
    ["Devengado 21 % — base (01)", emit[21].base, m.b21],
    ["Devengado 21 % — cuota (03)", emit[21].cuota, m.c21],
    ["Devengado 10 % — base (04)", emit[10].base, m.b10],
    ["Devengado 10 % — cuota (06)", emit[10].cuota, m.c10],
    ["Devengado 4 % — base (07)", emit[4].base, m.b4],
    ["Devengado 4 % — cuota (09)", emit[4].cuota, m.c4],
    ["Deducible — cuota total (29+31+37)", reci[21].cuota + reci[10].cuota + reci[4].cuota,
      m.c_ded_corr + m.c_ded_inv + m.c_ded_intra],
  ];

  const t = document.getElementById("recon-303");
  t.innerHTML = `
    <thead><tr>
      <th>Concepto</th><th class="num">Libro ${tri}T</th><th class="num">Modelo 303</th>
      <th class="num">Diferencia</th><th class="num">% dif.</th><th class="estado">Estado</th>
    </tr></thead>
    <tbody>${filas.map(([c, a, b]) => filaRecon(c, a, b)).join("")}</tbody>
  `;

  // Hint sobre liquidación
  const dev = emit[21].cuota + emit[10].cuota + emit[4].cuota;
  const ded = reci[21].cuota + reci[10].cuota + reci[4].cuota;
  document.getElementById("hint-303").textContent =
    `Resultado libro ${tri}T: devengado ${fmt(dev)} − deducible ${fmt(ded)} = ${fmt(dev - ded)} €  ·  Resultado 303 (casilla 71): ${fmt(
      (m.c21 + m.c10 + m.c4 + m.c_intra + m.c_isp) - (m.c_ded_corr + m.c_ded_inv + m.c_ded_intra)
    )} €`;
}

function renderRecon390() {
  const t = document.getElementById("recon-390");
  if (!state.presenta390) {
    t.innerHTML = `<tbody><tr><td colspan="6" style="padding:16px;color:var(--muted);">No procede modelo 390 (SII / REDEME / otros). Conciliar contra libros AEAT.</td></tr></tbody>`;
    return;
  }

  const sum303 = (k) => state.trimestres[1].m303[k] + state.trimestres[2].m303[k] +
    state.trimestres[3].m303[k] + state.trimestres[4].m303[k];

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
  renderLibros();
  render303();
  render390();
  renderContab();
  renderResultados();
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
  s.trimestres[1].emitidas = [
    { fecha: "2025-01-15", numero: "F-001", contraparte: "Cliente A", tipoIva: "21", base: 100000, cuota: 21000 },
    { fecha: "2025-02-10", numero: "F-002", contraparte: "Cliente B", tipoIva: "10", base: 30000, cuota: 3000 },
    { fecha: "2025-03-20", numero: "F-003", contraparte: "Cliente C", tipoIva: "4", base: 5000, cuota: 200 },
  ];
  s.trimestres[1].recibidas = [
    { fecha: "2025-01-10", numero: "P-100", contraparte: "Proveedor X", tipoIva: "21", base: 50000, cuota: 10500, deducible: 100 },
    { fecha: "2025-02-05", numero: "P-101", contraparte: "Proveedor Y", tipoIva: "21", base: 10000, cuota: 2100, deducible: 100 },
    { fecha: "2025-03-12", numero: "P-102", contraparte: "Proveedor Z", tipoIva: "10", base: 8000, cuota: 800, deducible: 100 },
  ];
  s.trimestres[1].m303 = {
    b21: 100000, c21: 21000,
    b10: 30000, c10: 3000,
    b4: 5000, c4: 200,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 60000, c_ded_corr: 12600,
    b_ded_inv: 0, c_ded_inv: 0,
    b_ded_intra: 8000, c_ded_intra: 800,
  };

  // 2T — caso con diferencia (libro 22.000 vs 303 21.580)
  s.trimestres[2].emitidas = [
    { fecha: "2025-04-12", numero: "F-010", contraparte: "Cliente A", tipoIva: "21", base: 104761.90, cuota: 22000 },
    { fecha: "2025-05-22", numero: "F-011", contraparte: "Cliente D", tipoIva: "10", base: 11000, cuota: 1100 },
  ];
  s.trimestres[2].recibidas = [
    { fecha: "2025-04-05", numero: "P-200", contraparte: "Proveedor X", tipoIva: "21", base: 40000, cuota: 8400, deducible: 100 },
  ];
  s.trimestres[2].m303 = {
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
  s.trimestres[3].emitidas = [
    { fecha: "2025-08-15", numero: "F-020", contraparte: "Cliente A", tipoIva: "21", base: 95000, cuota: 19950 },
  ];
  s.trimestres[3].m303 = {
    b21: 95000, c21: 19950,
    b10: 0, c10: 0, b4: 0, c4: 0,
    b_intra: 0, c_intra: 0, b_isp: 0, c_isp: 0,
    b_ded_corr: 0, c_ded_corr: 0, b_ded_inv: 0, c_ded_inv: 0, b_ded_intra: 0, c_ded_intra: 0,
  };
  s.trimestres[4].emitidas = [
    { fecha: "2025-11-30", numero: "F-030", contraparte: "Cliente A", tipoIva: "21", base: 120000, cuota: 25200 },
  ];
  s.trimestres[4].m303 = {
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
  fecha:       ["fecha", "date", "f.factura", "fecha factura", "fecha emision", "fecha expedicion"],
  numero:      ["numero", "número", "nº", "n factura", "num factura", "factura", "n. factura"],
  contraparte: ["cliente", "proveedor", "razon social", "razón social", "nombre", "denominacion", "tercero"],
  tipoIva:     ["tipo iva", "tipo", "% iva", "%iva", "iva %", "porcentaje", "tipo impositivo"],
  base:        ["base", "base imponible", "importe base", "neto", "subtotal"],
  cuota:       ["cuota", "cuota iva", "iva", "importe iva", "impuesto"],
  deducible:   ["deducible", "% deducible", "deduccion", "porcentaje deducible"],
};

function detectarColumnas(headers) {
  const map = {};
  const norm = headers.map((h) => String(h || "").toLowerCase().trim().replace(/\s+/g, " "));
  Object.entries(HEADER_HINTS).forEach(([campo, claves]) => {
    let idx = -1;
    for (const k of claves) {
      idx = norm.findIndex((h) => h === k || h.includes(k));
      if (idx >= 0) break;
    }
    if (idx >= 0) map[campo] = idx;
  });
  return map;
}

function normalizarTipoIva(v) {
  const s = String(v ?? "").replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  if (!isFinite(n)) return "21";
  if (Math.abs(n - 21) < 0.5) return "21";
  if (Math.abs(n - 10) < 0.5) return "10";
  if (Math.abs(n - 4) < 0.5) return "4";
  if (Math.abs(n - 0) < 0.5) return "0";
  return "21";
}

function parseFecha(v) {
  if (!v && v !== 0) return "";
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return s.slice(0, 10);
  return s;
}

async function leerArchivoExcel(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  return rows;
}

function importarLibroDesdeFilas(filas, tipo, tri) {
  if (!filas.length) { flash("Archivo vacío"); return; }
  // Buscar fila de cabecera (la primera con al menos 3 textos)
  let headerIdx = filas.findIndex((r) =>
    r.filter((c) => typeof c === "string" && c.trim().length > 0).length >= 3);
  if (headerIdx < 0) headerIdx = 0;
  const headers = filas[headerIdx].map((c) => String(c ?? ""));
  const mapping = detectarColumnas(headers);
  const datos = filas.slice(headerIdx + 1)
    .filter((r) => r.some((c) => c !== "" && c != null));

  abrirModalMapeo({ headers, mapping, datos, tipo, tri });
}

function abrirModalMapeo({ headers, mapping, datos, tipo, tri }) {
  const body = document.getElementById("modal-body");
  document.getElementById("modal-title").textContent =
    `Importar ${tipo === "emitidas" ? "facturas emitidas" : "facturas recibidas"} — ${tri}T`;

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

    const dest = state.trimestres[tri][tipo];
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
    flash(`${añadidas} líneas importadas en ${tri}T.`);
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

const num303 = (s) => {
  if (!s) return 0;
  const t = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
};

function detectarCasillas303(texto) {
  // Patrón: número de casilla seguido (cerca) de un importe
  // El PDF de la AEAT pinta: "[01] 100.000,00" o tablas con número y cuantía
  const out = {};
  const buscar = (cas) => {
    const re = new RegExp(`(?:^|\\s|\\[)${cas}\\s*[\\]\\)\\.:\\-]?\\s+([\\-+]?[0-9.,]+)`, "g");
    let last = null, m;
    while ((m = re.exec(texto)) !== null) {
      const v = num303(m[1]);
      if (v !== 0) last = v;
    }
    return last;
  };
  const casillas = {
    b21: "01", c21: "03",
    b10: "04", c10: "06",
    b4:  "07", c4:  "09",
    b_intra: "10", c_intra: "11",
    b_isp: "12", c_isp: "13",
    b_ded_corr: "28", c_ded_corr: "29",
    b_ded_inv:  "30", c_ded_inv:  "31",
    b_ded_intra: "36", c_ded_intra: "37",
  };
  Object.entries(casillas).forEach(([k, c]) => {
    const v = buscar(c);
    if (v != null) out[k] = v;
  });
  return out;
}

async function importarPdf303(file, tri) {
  try {
    const txt = await extraerTextoPdf(file);
    const detect = detectarCasillas303(txt);
    if (Object.keys(detect).length === 0) {
      flash("No se han podido detectar casillas en el PDF.");
      return;
    }
    abrirModalPreview303(detect, tri, txt);
  } catch (e) {
    flash("Error leyendo PDF: " + e.message);
  }
}

function abrirModalPreview303(detect, tri, textoOrig) {
  document.getElementById("modal-title").textContent = `Importar Modelo 303 — ${tri}T`;
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
  };
  body.innerHTML = `
    <p class="preview-meta">Verifica los importes detectados. Puedes editarlos antes de aplicar.</p>
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
    const m = state.trimestres[tri].m303;
    body.querySelectorAll("[data-pdf]").forEach((el) => {
      m[el.dataset.pdf] = num(el.value);
    });
    save();
    if (tri === tri303Activo) render303();
    flash(`Modelo 303 ${tri}T actualizado.`);
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

async function importarLibroDesdePdf(file, tipo, tri) {
  try {
    const txt = await extraerTextoPdf(file);
    // Heurística: cada línea con fecha + nº + texto + % iva + 2 importes
    const lineas = txt.split(/\n+/);
    const filas = [];
    const headerLike = ["FECHA", "Nº FACTURA", "CLIENTE", "PROVEEDOR", "TIPO IVA", "BASE", "CUOTA"];
    filas.push(headerLike);
    const re = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(\S+)\s+(.+?)\s+(21|10|4|0)\s*%?\s+([\-+]?[0-9.,]+)\s+([\-+]?[0-9.,]+)/;
    lineas.forEach((l) => {
      const m = l.match(re);
      if (m) filas.push([m[1], m[2], m[3], parseFecha(m[1]) ? null : null, m[4], num303(m[5]), num303(m[6])].slice(0, 7));
    });
    if (filas.length <= 1) { flash("No se han detectado líneas de factura en el PDF."); return; }

    // Convertir al formato de filas planas (encabezado + filas)
    const filasOrdenadas = [
      ["fecha", "numero", "contraparte", "tipo iva", "base", "cuota"],
      ...filas.slice(1).map((f) => [f[0], f[1], f[2], f[4], f[5], f[6]])
    ];
    importarLibroDesdeFilas(filasOrdenadas, tipo, tri);
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
bindImport("imp-emitidas-xlsx", async (f) => {
  const filas = await leerArchivoExcel(f);
  importarLibroDesdeFilas(filas, "emitidas", triLibroActivo);
});
bindImport("imp-recibidas-xlsx", async (f) => {
  const filas = await leerArchivoExcel(f);
  importarLibroDesdeFilas(filas, "recibidas", triLibroActivo);
});
bindImport("imp-emitidas-pdf", (f) => importarLibroDesdePdf(f, "emitidas", triLibroActivo));
bindImport("imp-recibidas-pdf", (f) => importarLibroDesdePdf(f, "recibidas", triLibroActivo));
bindImport("imp-303-pdf", (f) => importarPdf303(f, tri303Activo));
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

/* ---------- Init ---------- */
renderTodo();
