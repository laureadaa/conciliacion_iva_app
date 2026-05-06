/* =========================================================
   Conciliación del IVA — España. Simple, automática.
   ----------------------------------------------------------
   1) Sube libro de ventas (Excel/CSV) — ves el modal con la
      auto-detección, confirmas y la app reparte por trimestre.
   2) Sube libro de compras igual.
   3) Sube tus PDFs del Modelo 303 declarado — la app extrae
      las casillas, detecta el trimestre y las contrasta con
      los libros, mostrando las diferencias coloreadas.
   ========================================================= */

const STORAGE_KEY = "iva-simple-v3";
const TOL_EUR = 1.0;

const fmt = (n) => (Number(n) || 0).toLocaleString("es-ES",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- Parsers básicos ---------- */
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[^\d.,\-+]/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (!s) return 0;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  let r;
  if (lc >= 0 && ld >= 0) {
    r = lc > ld ? parseFloat(s.replace(/\./g, "").replace(",", "."))
                : parseFloat(s.replace(/,/g, ""));
  } else if (lc >= 0) {
    const p = s.split(",");
    r = (p.length > 2 || (p.length === 2 && p[1].length === 3))
      ? parseFloat(s.replace(/,/g, ""))
      : parseFloat(s.replace(",", "."));
  } else if (ld >= 0) {
    const p = s.split(".");
    r = (p.length > 2 || (p.length === 2 && p[1].length === 3))
      ? parseFloat(s.replace(/\./g, ""))
      : parseFloat(s);
  } else r = parseFloat(s);
  return isFinite(r) ? (neg ? -r : r) : 0;
}

function parseFecha(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  let s = String(v).trim();
  s = s.replace(/[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?(?:\s*[\-+]\d{2}:?\d{2}|Z)?\s*$/i, "").trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s;
}

function trimestreDeFecha(f) {
  const m = String(f).match(/^(\d{4})-(\d{2})/);
  return m ? Math.ceil(parseInt(m[2], 10) / 3) : null;
}

function normTipoIva(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  if (!isFinite(n)) return 21;
  if (Math.abs(n - 21) < 1) return 21;
  if (Math.abs(n - 10) < 1) return 10;
  if (Math.abs(n - 4) < 1) return 4;
  if (Math.abs(n - 0) < 0.5) return 0;
  return Math.round(n);
}

function normHeader(h) {
  return String(h || "").toLowerCase().trim()
    .replace(/ /g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[º°]/g, "")
    .replace(/\s+/g, " ");
}

/* ---------- Detección de columnas ---------- */
const HINTS = {
  fecha:       ["fecha", "f.factura", "f. factura", "fecha factura", "fecha emision",
                "fecha expedicion", "f expedicion", "fecha_pro"],
  contraparte: ["cliente", "proveedor", "razon social", "denominacion", "tercero", "nombre cliente"],
  apellidos:   ["apellidos"],
  nombre_solo: ["nombre"],
  tipoIva:     ["tipo iva", "tipo de iva", "% iva", "%iva", "iva %", "tipo impositivo",
                "porcentaje iva", "porcentaje", "tipo"],
  base:        ["base imponible", "base", "importe base", "neto", "subtotal", "b. imponible",
                "b imponible"],
  cuota:       ["cuota iva", "cuota", "importe iva", "iva soportado", "iva repercutido",
                "iva devengado", "importe cuota", "iva"],
};

/* Detección dirigida: buscamos exactos primero, después h.includes(k) — solo
   en ESTA dirección. La dirección contraria k.includes(h) provocaba que un
   header llamado "iva" se mapeara a "tipo iva" (porque "tipo iva".includes("iva")).
   También ignoramos columnas ya asignadas a otros campos (parámetro `usados`). */
function detectarColumna(headers, claves, usados) {
  const norm = headers.map(normHeader);
  const libre = (i) => !usados || !usados.has(i);
  for (const k of claves) {
    const i = norm.findIndex((h, idx) => libre(idx) && h === k);
    if (i >= 0) return i;
  }
  for (const k of claves) {
    const i = norm.findIndex((h, idx) => libre(idx) && h && h.includes(k));
    if (i >= 0) return i;
  }
  return null;
}

function detectarFilaCabecera(filas) {
  let mejor = { idx: 0, score: -1 };
  const max = Math.min(filas.length, 25);
  for (let i = 0; i < max; i++) {
    const cab = (filas[i] || []).map(normHeader);
    let score = 0;
    Object.values(HINTS).forEach((claves) => {
      if (cab.some((c) => c && claves.some((k) => c === k || c.includes(k)))) score++;
    });
    if (score > mejor.score) mejor = { idx: i, score };
  }
  return mejor.score >= 2 ? mejor.idx : 0;
}

/* Multi-tipo: Base1/IVA1/tiva1 ... Base{N}/IVA{N}/tiva{N} */
function detectarMultiRate(headers) {
  const norm = headers.map(normHeader);
  const find = (k) => norm.findIndex((h) => h === k);
  const grupos = [];
  for (let n = 1; n <= 9; n++) {
    const b = find(`base${n}`);
    const c = find(`tiva${n}`);
    const i = find(`iva${n}`);
    if (b >= 0 && c >= 0) grupos.push({ base: b, iva: i, cuota: c });
  }
  return grupos.length ? grupos : null;
}

function detectarMapeoEstandar(headers) {
  const usados = new Set();
  const fecha       = detectarColumna(headers, HINTS.fecha, usados);       if (fecha != null) usados.add(fecha);
  const apellidos   = detectarColumna(headers, HINTS.apellidos, usados);   if (apellidos != null) usados.add(apellidos);
  const nombre_solo = detectarColumna(headers, HINTS.nombre_solo, usados); if (nombre_solo != null) usados.add(nombre_solo);
  const contraparte = detectarColumna(headers, HINTS.contraparte, usados); if (contraparte != null) usados.add(contraparte);
  const tipoIva     = detectarColumna(headers, HINTS.tipoIva, usados);     if (tipoIva != null) usados.add(tipoIva);
  const cuota       = detectarColumna(headers, HINTS.cuota, usados);       if (cuota != null) usados.add(cuota);
  const base        = detectarColumna(headers, HINTS.base, usados);        if (base != null) usados.add(base);
  return { fecha, apellidos, nombre_solo, contraparte, tipoIva, base, cuota };
}

/* ---------- Aplicar mapeo (estándar o multitipo) ---------- */
function aplicarMapeoEstandar(datos, m) {
  const get = (r, i) => i != null ? r[i] : "";
  const cpDe = (r) => {
    const ape = String(get(r, m.apellidos) ?? "").trim();
    const nom = String(get(r, m.nombre_solo) ?? "").trim();
    const cp = [ape, nom].filter(Boolean).join(" ").trim();
    return cp || String(get(r, m.contraparte) ?? "").trim();
  };
  const out = [];
  for (const r of datos) {
    const fecha = parseFecha(get(r, m.fecha));
    const tipoIva = normTipoIva(get(r, m.tipoIva) || 21);
    const base = num(get(r, m.base));
    let cuota = num(get(r, m.cuota));
    if (cuota === 0 && base !== 0) cuota = Math.round(base * tipoIva) / 100;
    if (base === 0 && cuota === 0) continue;
    out.push({ fecha, contraparte: cpDe(r), tipoIva, base, cuota });
  }
  return out;
}

function aplicarMapeoMultitipo(datos, m, headers) {
  const get = (r, i) => i != null ? r[i] : "";
  const cpDe = (r) => {
    const ape = String(get(r, m.apellidos) ?? "").trim();
    const nom = String(get(r, m.nombre_solo) ?? "").trim();
    const cp = [ape, nom].filter(Boolean).join(" ").trim();
    return cp || String(get(r, m.contraparte) ?? "").trim();
  };
  const out = [];
  for (const r of datos) {
    const fecha = parseFecha(get(r, m.fecha));
    const cp = cpDe(r);
    for (const g of m.grupos) {
      const base = num(get(r, g.base));
      const cuota = num(get(r, g.cuota));
      let iva = num(get(r, g.iva));
      if (base === 0 && cuota === 0) continue;
      if (!iva && base > 0) iva = Math.round(cuota / base * 100);
      out.push({ fecha, contraparte: cp, tipoIva: normTipoIva(iva), base, cuota });
    }
  }
  return out;
}

/* ---------- Excel / CSV ---------- */
async function leerArchivo(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })
    .filter((r) => r.some((c) => c !== "" && c != null));
}

/* ---------- PDF (Modelo 303) ---------- */
async function extraerLineasPdf(file) {
  if (!window.pdfjsLib) throw new Error("PDF.js no cargado");
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lineas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const buckets = [];
    for (const it of tc.items) {
      if (!it.str) continue;
      const x = it.transform[4], y = it.transform[5];
      let b = buckets.find((bb) => Math.abs(bb.y - y) <= 2.5);
      if (!b) { b = { y, items: [] }; buckets.push(b); }
      b.items.push({ x, str: it.str });
    }
    buckets.sort((a, b) => b.y - a.y);
    for (const b of buckets) {
      b.items.sort((a, c) => a.x - c.x);
      lineas.push({ items: b.items, text: b.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim() });
    }
  }
  return lineas;
}

function detectarTrimestre303(texto) {
  const t = texto.toUpperCase();
  let m = t.match(/\b([1-4])\s*T(?:RIMESTRE)?\b/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/PER[ÍI]ODO\D{0,5}([0-3])([1-4])/);
  if (m) return parseInt(m[2], 10);
  m = t.match(/\b0([1-4])\b\s*(?:TRIM|TRIMESTRE)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function detectarEjercicio303(texto) {
  const m = texto.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

const CASILLAS = {
  b21: "01", c21: "03",
  b10: "04", c10: "06",
  b4:  "07", c4:  "09",
  c_intra: "11", c_isp: "13",
  b_ded: "28", c_ded: "29",
  c71: "71",
};

function _esTokenCasilla(s, n) {
  s = s.trim();
  return s === n || s === `(${n})` || s === `[${n}]` || s === `${n}.` || s === `${n}:`;
}
function _esTokenNumero(s) {
  s = s.trim();
  return /^[\-+]?\(?-?\d[\d.,]*\)?\s*(?:€|EUR|EUROS?)?$/i.test(s);
}

/* Para cada casilla: busca un token cuyo texto sea exactamente el número
   (ej. "01") y toma el siguiente número en la misma línea, o uno por debajo
   con x parecida. Doble pasada: posicional + regex sobre el texto plano. */
function detectarCasillas303(lineas, texto) {
  const out = {};
  // Posicional
  for (const [k, n] of Object.entries(CASILLAS)) {
    let val = null;
    for (let li = 0; li < lineas.length && val == null; li++) {
      const items = lineas[li].items;
      for (let i = 0; i < items.length && val == null; i++) {
        if (!_esTokenCasilla(items[i].str, n)) continue;
        for (let j = i + 1; j < items.length; j++) {
          if (_esTokenNumero(items[j].str)) {
            const v = num(items[j].str);
            if (v !== 0) { val = v; break; }
          }
        }
        if (val == null && li + 1 < lineas.length) {
          const xRef = items[i].x;
          for (const nit of lineas[li + 1].items) {
            if (Math.abs(nit.x - xRef) < 80 && _esTokenNumero(nit.str)) {
              const v = num(nit.str);
              if (v !== 0) { val = v; break; }
            }
          }
        }
      }
    }
    if (val != null) out[k] = val;
  }
  // Regex como respaldo
  for (const [k, n] of Object.entries(CASILLAS)) {
    if (out[k] != null) continue;
    const candidatos = [];
    const patrones = [
      new RegExp(`(?:^|[\\s\\[\\(])${n}\\s*[\\]\\)\\.:\\-]?\\s+([\\-+]?\\(?\\d[\\d.,]*\\)?)`, "g"),
      new RegExp(`[Cc]asilla\\s*${n}\\s*[\\.:\\-]?\\s+([\\-+]?\\(?\\d[\\d.,]*\\)?)`, "g"),
    ];
    for (const re of patrones) {
      let m;
      while ((m = re.exec(texto)) !== null) {
        const v = num(m[1]);
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

/* ---------- Estado ---------- */
const empty303 = () => ({});
const estadoInicial = () => ({
  ejercicio: 2025,
  ventas: [],
  compras: [],
  m303: { 1: empty303(), 2: empty303(), 3: empty303(), 4: empty303() },
});
let state = cargar() || estadoInicial();
function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && !s.m303) s.m303 = { 1: {}, 2: {}, 3: {}, 4: {} };
    return s;
  } catch { return null; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

/* ---------- Cálculos ---------- */
function totales303Libro(facturas, t) {
  const r = { b21: 0, c21: 0, b10: 0, c10: 0, b4: 0, c4: 0, base_total: 0, cuota_total: 0 };
  for (const f of facturas) {
    if (t != null) {
      const tt = trimestreDeFecha(f.fecha);
      if (tt !== t) continue;
    }
    if (f.tipoIva === 21) { r.b21 += f.base; r.c21 += f.cuota; }
    else if (f.tipoIva === 10) { r.b10 += f.base; r.c10 += f.cuota; }
    else if (f.tipoIva === 4)  { r.b4  += f.base; r.c4  += f.cuota; }
    r.base_total += f.base;
    r.cuota_total += f.cuota;
  }
  return r;
}

/* ---------- Render ---------- */
function hay303() {
  return [1, 2, 3, 4].some((t) => Object.keys(state.m303[t] || {}).length > 0);
}

function render() {
  document.getElementById("ejercicio").value = state.ejercicio;
  document.getElementById("info-ventas").textContent = state.ventas.length
    ? `✓ ${state.ventas.length} líneas. Pulsa para reemplazar.`
    : "Excel/CSV anual";
  document.getElementById("info-compras").textContent = state.compras.length
    ? `✓ ${state.compras.length} líneas. Pulsa para reemplazar.`
    : "Excel/CSV anual";
  const cargados303 = [1,2,3,4].filter((t) => Object.keys(state.m303[t] || {}).length > 0);
  document.getElementById("info-303").textContent = cargados303.length
    ? `✓ ${cargados303.length} trimestres cargados (${cargados303.map((t) => t + "T").join(", ")})`
    : "Suelta los PDFs (uno por trimestre)";

  const ventasT = [1,2,3,4].map((t) => totales303Libro(state.ventas, t));
  const ventasA = totales303Libro(state.ventas, null);
  const comprasT = [1,2,3,4].map((t) => totales303Libro(state.compras, t));
  const comprasA = totales303Libro(state.compras, null);

  // Filas: cada una con los 4 valores trimestrales + anual del LIBRO,
  // y opcionalmente los valores DECLARADOS por trimestre (de m303).
  const filas = [
    { c: "Base 21 % (01)",   k: "b21", lib: ventasT.map((p) => p.b21), totL: ventasA.b21 },
    { c: "Cuota 21 % (03)",  k: "c21", lib: ventasT.map((p) => p.c21), totL: ventasA.c21 },
    { c: "Base 10 % (04)",   k: "b10", lib: ventasT.map((p) => p.b10), totL: ventasA.b10 },
    { c: "Cuota 10 % (06)",  k: "c10", lib: ventasT.map((p) => p.c10), totL: ventasA.c10 },
    { c: "Base 4 % (07)",    k: "b4",  lib: ventasT.map((p) => p.b4),  totL: ventasA.b4 },
    { c: "Cuota 4 % (09)",   k: "c4",  lib: ventasT.map((p) => p.c4),  totL: ventasA.c4 },
    { c: "Base IVA deducible (28)",  k: "b_ded", lib: comprasT.map((p) => p.base_total),  totL: comprasA.base_total },
    { c: "Cuota IVA deducible (29)", k: "c_ded", lib: comprasT.map((p) => p.cuota_total), totL: comprasA.cuota_total },
    { c: "Resultado (71)",   k: "c71",
      lib: ventasT.map((p, i) => p.cuota_total - comprasT[i].cuota_total),
      totL: ventasA.cuota_total - comprasA.cuota_total,
      destacado: true },
  ];

  const conPDF = hay303();
  let html;
  if (!conPDF) {
    html = `
      <thead><tr>
        <th>Concepto</th>
        <th class="num">1T</th><th class="num">2T</th><th class="num">3T</th><th class="num">4T</th>
        <th class="num">Anual</th>
      </tr></thead>
      <tbody>
        ${filas.map((f) => {
          const cls = f.destacado ? 'fila-resultado' : '';
          return `<tr${cls ? ` class="${cls}"` : ""}>
            <td>${f.c}</td>
            ${f.lib.map((x) => `<td class="num">${fmt(x)}</td>`).join("")}
            <td class="num"><strong>${fmt(f.totL)}</strong></td>
          </tr>`;
        }).join("")}
      </tbody>`;
  } else {
    // Vista de conciliación: por cada trimestre 3 sub-columnas (Libro / Declarado / Dif)
    const colsPorT = (t) => `
      <th class="num col-lib tri-header">Libro</th>
      <th class="num">303</th>
      <th class="num">Dif.</th>`;
    const filasHtml = filas.map((f) => {
      let cells = "";
      for (let t = 1; t <= 4; t++) {
        const lib = f.lib[t - 1];
        const decRaw = state.m303[t][f.k];
        const tieneDec = decRaw != null;
        const dec = tieneDec ? num(decRaw) : null;
        const dif = tieneDec ? lib - dec : null;
        const difCls = !tieneDec ? "" : (Math.abs(dif) <= TOL_EUR ? "ok" : "warn");
        cells += `<td class="num lib">${fmt(lib)}</td>`;
        cells += `<td class="num dec">${tieneDec ? fmt(dec) : "—"}</td>`;
        cells += `<td class="num dif ${difCls}">${tieneDec ? fmt(dif) : "—"}</td>`;
      }
      const cls = f.destacado ? 'fila-resultado' : '';
      return `<tr${cls ? ` class="${cls}"` : ""}>
        <td>${f.c}</td>${cells}
        <td class="num"><strong>${fmt(f.totL)}</strong></td>
      </tr>`;
    }).join("");
    html = `
      <thead>
        <tr>
          <th rowspan="2">Concepto</th>
          <th class="tri-header" colspan="3">1T</th>
          <th class="tri-header" colspan="3">2T</th>
          <th class="tri-header" colspan="3">3T</th>
          <th class="tri-header" colspan="3">4T</th>
          <th rowspan="2" class="num">Anual<br>libro</th>
        </tr>
        <tr>${[1,2,3,4].map(colsPorT).join("")}</tr>
      </thead>
      <tbody>${filasHtml}</tbody>`;
  }
  const tbl = document.getElementById("tabla-resumen");
  tbl.className = conPDF ? "conc" : "";
  tbl.innerHTML = html;

  document.getElementById("resumen-meta").textContent = (state.ventas.length || state.compras.length || conPDF)
    ? (conPDF ? "· conciliación libro vs Modelo 303 declarado" : "· cálculo automático del 303 desde los libros")
    : "";
  document.getElementById("hint-resumen").style.display =
    state.ventas.length || state.compras.length ? "none" : "";
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = isErr ? "err" : "";
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ---------- Modal de mapeo (siempre visible al subir libro) ---------- */
function abrirModalLibro({ headers, datos, mapping, multi, tipo }) {
  document.getElementById("modal").hidden = false;
  document.getElementById("modal-title").textContent =
    `Importar libro de ${tipo === "ventas" ? "ventas" : "compras"}`;
  const body = document.getElementById("modal-body");
  const optHtml = (sel) => `
    <option value="">— sin asignar —</option>
    ${headers.map((h, i) => `<option value="${i}" ${sel === i ? "selected" : ""}>${escapeHtml(h)} (col ${i + 1})</option>`).join("")}`;

  let bodyHtml;
  if (multi) {
    bodyHtml = `
      <p class="hint">Detectado <strong>formato multi-tipo</strong> (${multi.grupos.length} grupos Base/IVA/cuota por fila).
        Cada fila se expandirá en una línea por tipo IVA no-cero.</p>
      <div class="field-row"><label>Fecha</label>
        <select data-k="fecha">${optHtml(mapping.fecha)}</select></div>
      <div class="field-row"><label>Apellidos</label>
        <select data-k="apellidos">${optHtml(mapping.apellidos)}</select></div>
      <div class="field-row"><label>Nombre</label>
        <select data-k="nombre_solo">${optHtml(mapping.nombre_solo)}</select></div>
      <div class="field-row"><label>Contraparte (alt.)</label>
        <select data-k="contraparte">${optHtml(mapping.contraparte)}</select></div>
      <p class="hint" style="margin-top:8px;">Grupos detectados:
        ${multi.grupos.map((g, i) => `<code>Base${i+1}/IVA${i+1}/tiva${i+1}</code>`).join(" · ")}</p>
      <div class="preview" id="preview"></div>`;
  } else {
    bodyHtml = `
      <p class="hint">Verifica el mapeo (auto-rellenado donde se ha podido). Las flechas verdes ✓ marcan lo detectado automáticamente.</p>
      <div class="field-row"><label>Fecha</label>
        <select data-k="fecha">${optHtml(mapping.fecha)}</select>
        ${mapping.fecha != null ? '<span class="auto">✓ auto</span>' : ""}</div>
      <div class="field-row"><label>${tipo === "ventas" ? "Cliente" : "Proveedor"}</label>
        <select data-k="contraparte">${optHtml(mapping.contraparte)}</select>
        ${mapping.contraparte != null ? '<span class="auto">✓ auto</span>' : ""}</div>
      <div class="field-row"><label>Apellidos (alt.)</label>
        <select data-k="apellidos">${optHtml(mapping.apellidos)}</select></div>
      <div class="field-row"><label>Nombre (alt.)</label>
        <select data-k="nombre_solo">${optHtml(mapping.nombre_solo)}</select></div>
      <div class="field-row"><label>Tipo IVA (%)</label>
        <select data-k="tipoIva">${optHtml(mapping.tipoIva)}</select>
        ${mapping.tipoIva != null ? '<span class="auto">✓ auto</span>' : ""}</div>
      <div class="field-row"><label>Base imponible</label>
        <select data-k="base">${optHtml(mapping.base)}</select>
        ${mapping.base != null ? '<span class="auto">✓ auto</span>' : ""}</div>
      <div class="field-row"><label>Cuota IVA</label>
        <select data-k="cuota">${optHtml(mapping.cuota)}</select>
        ${mapping.cuota != null ? '<span class="auto">✓ auto</span>' : ""}</div>
      <div class="preview" id="preview"></div>`;
  }
  body.innerHTML = bodyHtml;

  function leerMapeoActual() {
    const m = { ...(multi || {}) };
    body.querySelectorAll("select[data-k]").forEach((s) => {
      m[s.dataset.k] = s.value === "" ? null : parseInt(s.value, 10);
    });
    return m;
  }

  function actualizarPreview() {
    const m = leerMapeoActual();
    const muestra = datos.slice(0, 5);
    const filas = multi
      ? aplicarMapeoMultitipo(muestra, m, headers).slice(0, 5)
      : aplicarMapeoEstandar(muestra, m).slice(0, 5);
    const totalParseado = (multi
      ? aplicarMapeoMultitipo(datos, m, headers)
      : aplicarMapeoEstandar(datos, m));
    const sumBase  = totalParseado.reduce((a, f) => a + f.base, 0);
    const sumCuota = totalParseado.reduce((a, f) => a + f.cuota, 0);
    document.getElementById("preview").innerHTML = `
      <h4>Vista previa (5 primeras líneas) · ${totalParseado.length} líneas en total · base ${fmt(sumBase)} € · cuota ${fmt(sumCuota)} €</h4>
      <table>
        <thead><tr>
          <th>Fecha</th><th>Contraparte</th>
          <th class="num">Tipo</th><th class="num">Base</th><th class="num">Cuota</th>
        </tr></thead>
        <tbody>
          ${filas.map((f) => `<tr>
            <td>${escapeHtml(f.fecha)}</td>
            <td>${escapeHtml(f.contraparte)}</td>
            <td class="num">${f.tipoIva} %</td>
            <td class="num">${fmt(f.base)}</td>
            <td class="num">${fmt(f.cuota)}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  }
  body.querySelectorAll("select[data-k]").forEach((s) => s.addEventListener("change", actualizarPreview));
  actualizarPreview();

  const cerrar = () => { document.getElementById("modal").hidden = true; };
  document.getElementById("modal-cancel").onclick = cerrar;
  document.getElementById("modal-ok").onclick = () => {
    const m = leerMapeoActual();
    if (m.fecha == null) { toast("Asigna al menos la columna Fecha", true); return; }
    if (!multi && m.base == null && m.cuota == null) {
      toast("Asigna al menos Base o Cuota", true); return;
    }
    const facturas = multi
      ? aplicarMapeoMultitipo(datos, m, headers)
      : aplicarMapeoEstandar(datos, m);
    if (!facturas.length) { toast("No hay líneas con importes", true); return; }
    state[tipo] = facturas;
    save();
    cerrar();
    toast(`${facturas.length} líneas importadas en ${tipo}.`);
  };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ---------- Importación ---------- */
async function importarLibro(file, tipo) {
  try {
    const filas = await leerArchivo(file);
    if (!filas.length) { toast("Archivo vacío", true); return; }
    const headerIdx = detectarFilaCabecera(filas);
    const headers = (filas[headerIdx] || []).map((c) => String(c ?? ""));
    const datos = filas.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));
    const grupos = detectarMultiRate(headers);
    const mapping = detectarMapeoEstandar(headers);
    abrirModalLibro({
      headers, datos,
      mapping,
      multi: grupos ? { ...mapping, grupos } : null,
      tipo,
    });
  } catch (e) {
    toast("Error: " + e.message, true);
  }
}

async function importar303s(files) {
  const resultados = [];
  for (const f of files) {
    try {
      const lineas = await extraerLineasPdf(f);
      const txt = lineas.map((l) => l.text).join("\n");
      const tri = detectarTrimestre303(txt);
      const ej = detectarEjercicio303(txt);
      const cas = detectarCasillas303(lineas, txt);
      const numCasillas = Object.keys(cas).length;
      if (numCasillas === 0) {
        resultados.push({ name: f.name, ok: false, info: "no se detectaron casillas" });
        continue;
      }
      if (!tri) {
        resultados.push({ name: f.name, ok: false, info: "no se detectó el trimestre" });
        continue;
      }
      state.m303[tri] = cas;
      if (ej && !state.ejercicio) state.ejercicio = ej;
      resultados.push({ name: f.name, ok: true, info: `${tri}T · ${numCasillas} casillas` });
    } catch (e) {
      resultados.push({ name: f.name, ok: false, info: e.message });
    }
  }
  save();
  const ok = resultados.filter((r) => r.ok);
  const fail = resultados.filter((r) => !r.ok);
  let msg = `${ok.length} de ${resultados.length} PDFs procesados`;
  if (fail.length) {
    msg += " · " + fail.map((r) => `${r.name}: ${r.info}`).join("; ");
    toast(msg, true);
  } else {
    msg += " (" + ok.map((r) => r.info).join(", ") + ")";
    toast(msg);
  }
}

/* ---------- Wiring ---------- */
function wireDropzone(inputId, onFiles) {
  const zone = document.querySelector(`label[for="${inputId}"]`);
  const input = document.getElementById(inputId);
  input.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) await onFiles(files);
  });
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, () => zone.classList.remove("drag")));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    const dt = new DataTransfer();
    [...e.dataTransfer.files].forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  });
}
wireDropzone("up-ventas",  (fs) => importarLibro(fs[0], "ventas"));
wireDropzone("up-compras", (fs) => importarLibro(fs[0], "compras"));
wireDropzone("up-303",     (fs) => importar303s(fs));

document.getElementById("ejercicio").addEventListener("input", (e) => {
  state.ejercicio = parseInt(e.target.value, 10) || new Date().getFullYear();
  save();
});
document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("¿Borrar todos los datos?")) {
    state = estadoInicial();
    save();
  }
});

render();
