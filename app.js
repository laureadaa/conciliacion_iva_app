/* =========================================================
   Conciliación del IVA — España. Versión simple, automática.
   ----------------------------------------------------------
   Sube un libro de ventas y otro de compras (Excel/CSV). La
   app calcula automáticamente, por trimestre y anual, todas
   las casillas relevantes del Modelo 303:
     · Base y cuota a 21 % (casillas 01 / 03)
     · Base y cuota a 10 % (casillas 04 / 06)
     · Base y cuota a 4 %  (casillas 07 / 09)
     · Total cuota devengada (27)
     · Base y cuota deducible (28 / 29)
     · Resultado a ingresar o devolver (71 simplificado)
   ========================================================= */

const STORAGE_KEY = "iva-simple-v2";

const fmt = (n) => (Number(n) || 0).toLocaleString("es-ES",
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Parser de cantidades robusto: "1.234,56" (es), "1,234.56" (en),
   "(123,45)" como negativo, sufijo €. */
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
    if (p.length > 2 || (p.length === 2 && p[1].length === 3))
      r = parseFloat(s.replace(/,/g, ""));
    else r = parseFloat(s.replace(",", "."));
  } else if (ld >= 0) {
    const p = s.split(".");
    if (p.length > 2 || (p.length === 2 && p[1].length === 3))
      r = parseFloat(s.replace(/\./g, ""));
    else r = parseFloat(s);
  } else {
    r = parseFloat(s);
  }
  return isFinite(r) ? (neg ? -r : r) : 0;
}

/* Fechas: "DD/MM/YYYY" con/sin hora, ISO o serial Excel. */
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

const HINTS = {
  fecha:       ["fecha", "f.factura", "fecha factura", "fecha emision", "fecha expedicion", "f expedicion", "fecha_pro"],
  contraparte: ["cliente", "proveedor", "razon social", "denominacion", "tercero", "nombre"],
  apellidos:   ["apellidos"],
  nombre_solo: ["nombre"],
  tipoIva:     ["tipo iva", "% iva", "%iva", "iva %", "tipo impositivo", "porcentaje"],
  base:        ["base", "base imponible", "importe base", "neto", "subtotal"],
  cuota:       ["cuota", "cuota iva", "iva", "importe iva", "impuesto"],
};

function detectarColumna(headers, claves) {
  const norm = headers.map(normHeader);
  for (const k of claves) {
    const i = norm.findIndex((h) => h === k);
    if (i >= 0) return i;
  }
  for (const k of claves) {
    const i = norm.findIndex((h) => h.includes(k) || k.includes(h));
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
      if (cab.some((c) => c && claves.some((k) => c === k || c.includes(k) || k.includes(c)))) score++;
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

function parsearLibro(filas) {
  const headerIdx = detectarFilaCabecera(filas);
  const headers = (filas[headerIdx] || []).map((c) => String(c ?? ""));
  const datos = filas.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));

  const idxFecha = detectarColumna(headers, HINTS.fecha);
  const idxApe   = detectarColumna(headers, HINTS.apellidos);
  const idxNom   = detectarColumna(headers, HINTS.nombre_solo);
  const idxCp    = detectarColumna(headers, HINTS.contraparte);
  const grupos   = detectarMultiRate(headers);

  const get = (r, i) => i != null ? r[i] : "";
  const cpDe = (r) => {
    const ape = String(get(r, idxApe) ?? "").trim();
    const nom = String(get(r, idxNom) ?? "").trim();
    const cp = [ape, nom].filter(Boolean).join(" ").trim();
    return cp || String(get(r, idxCp) ?? "").trim();
  };

  const facturas = [];
  if (grupos) {
    for (const r of datos) {
      const fecha = parseFecha(get(r, idxFecha));
      const cp = cpDe(r);
      for (const g of grupos) {
        const base = num(get(r, g.base));
        const cuota = num(get(r, g.cuota));
        let iva = num(get(r, g.iva));
        if (base === 0 && cuota === 0) continue;
        if (!iva && base > 0) iva = Math.round(cuota / base * 100);
        facturas.push({ fecha, contraparte: cp, tipoIva: normTipoIva(iva), base, cuota });
      }
    }
    return { facturas, mapeo: { multitipo: true, grupos: grupos.length } };
  }

  const idxIva   = detectarColumna(headers, HINTS.tipoIva);
  const idxBase  = detectarColumna(headers, HINTS.base);
  const idxCuota = detectarColumna(headers, HINTS.cuota);
  if (idxFecha == null || (idxBase == null && idxCuota == null)) {
    return { facturas: [], mapeo: { error: "No se han detectado las columnas de fecha y/o base/cuota." } };
  }
  for (const r of datos) {
    const fecha = parseFecha(get(r, idxFecha));
    const tipoIva = normTipoIva(get(r, idxIva) || 21);
    const base = num(get(r, idxBase));
    let cuota = num(get(r, idxCuota));
    if (cuota === 0 && base !== 0) cuota = Math.round(base * tipoIva) / 100;
    if (base === 0 && cuota === 0) continue;
    facturas.push({ fecha, contraparte: cpDe(r), tipoIva, base, cuota });
  }
  return { facturas, mapeo: { multitipo: false } };
}

async function leerArchivo(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" })
    .filter((r) => r.some((c) => c !== "" && c != null));
}

/* === Estado === */
const estadoInicial = () => ({ ejercicio: 2025, ventas: [], compras: [] });
let state = cargar() || estadoInicial();
function cargar() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

/* === Cálculo automático del 303 ===
   Para cada trimestre y para el año entero: bases y cuotas devengadas por
   tipo (21/10/4), totales y resultado. */
function totales303(facturas, trimestre /* 1-4, o null = anual */) {
  const r = { b21: 0, c21: 0, b10: 0, c10: 0, b4: 0, c4: 0, base_total: 0, cuota_total: 0 };
  for (const f of facturas) {
    if (trimestre != null) {
      const t = trimestreDeFecha(f.fecha);
      if (t !== trimestre) continue;
    }
    if (f.tipoIva === 21) { r.b21 += f.base; r.c21 += f.cuota; }
    else if (f.tipoIva === 10) { r.b10 += f.base; r.c10 += f.cuota; }
    else if (f.tipoIva === 4)  { r.b4  += f.base; r.c4  += f.cuota; }
    r.base_total += f.base;
    r.cuota_total += f.cuota;
  }
  return r;
}

/* === Render === */
function render() {
  document.getElementById("ejercicio").value = state.ejercicio;
  document.getElementById("info-ventas").textContent = state.ventas.length
    ? `✓ ${state.ventas.length} líneas cargadas. Pulsa para reemplazar.`
    : "Suelta aquí tu Excel/CSV o haz clic.";
  document.getElementById("info-compras").textContent = state.compras.length
    ? `✓ ${state.compras.length} líneas cargadas. Pulsa para reemplazar.`
    : "Suelta aquí tu Excel/CSV o haz clic.";

  const ventasPorPer = [1, 2, 3, 4].map((t) => totales303(state.ventas, t));
  const ventasAnual = totales303(state.ventas, null);
  const comprasPorPer = [1, 2, 3, 4].map((t) => totales303(state.compras, t));
  const comprasAnual = totales303(state.compras, null);

  const filas = [
    { c: "Base 21 % (casilla 01)",      v: ventasPorPer.map((p) => p.b21), tot: ventasAnual.b21 },
    { c: "Cuota 21 % (casilla 03)",     v: ventasPorPer.map((p) => p.c21), tot: ventasAnual.c21 },
    { c: "Base 10 % (casilla 04)",      v: ventasPorPer.map((p) => p.b10), tot: ventasAnual.b10 },
    { c: "Cuota 10 % (casilla 06)",     v: ventasPorPer.map((p) => p.c10), tot: ventasAnual.c10 },
    { c: "Base 4 % (casilla 07)",       v: ventasPorPer.map((p) => p.b4),  tot: ventasAnual.b4 },
    { c: "Cuota 4 % (casilla 09)",      v: ventasPorPer.map((p) => p.c4),  tot: ventasAnual.c4 },
    { c: "Total cuota devengada (27)", v: ventasPorPer.map((p) => p.cuota_total), tot: ventasAnual.cuota_total, fuerte: true },
    { sep: true },
    { c: "Base IVA deducible (28)",    v: comprasPorPer.map((p) => p.base_total),  tot: comprasAnual.base_total },
    { c: "Cuota IVA deducible (29)",   v: comprasPorPer.map((p) => p.cuota_total), tot: comprasAnual.cuota_total, fuerte: true },
    { sep: true },
    { c: "Resultado a ingresar / devolver (71)",
      v: ventasPorPer.map((p, i) => p.cuota_total - comprasPorPer[i].cuota_total),
      tot: ventasAnual.cuota_total - comprasAnual.cuota_total,
      destacado: true },
  ];

  const html = `
    <thead><tr>
      <th>Concepto</th>
      <th class="num">1T</th><th class="num">2T</th><th class="num">3T</th><th class="num">4T</th>
      <th class="num">Anual</th>
    </tr></thead>
    <tbody>
      ${filas.map((f) => {
        if (f.sep) return `<tr class="sep"><td colspan="6"></td></tr>`;
        const cls = f.destacado ? "fila-resultado" : (f.fuerte ? "fila-fuerte" : "");
        return `<tr${cls ? ` class="${cls}"` : ""}>
          <td>${f.c}</td>
          ${f.v.map((x) => `<td class="num">${fmt(x)}</td>`).join("")}
          <td class="num"><strong>${fmt(f.tot)}</strong></td>
        </tr>`;
      }).join("")}
    </tbody>
  `;
  document.getElementById("tabla-resumen").innerHTML = html;

  const meta = document.getElementById("resumen-meta");
  meta.textContent = (state.ventas.length || state.compras.length)
    ? `· cálculo automático del Modelo 303 ${state.ejercicio}`
    : "";
  document.getElementById("hint-resumen").style.display =
    state.ventas.length || state.compras.length ? "none" : "";
}

/* === Toast === */
let toastTimer;
function toast(msg, isErr) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = isErr ? "err" : "";
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* === Modal de mapeo manual (sólo si la auto-detección falla) === */
function abrirModalMapeo(headers, datos, tipo, callback) {
  const body = document.getElementById("modal-body");
  const campos = [
    { k: "fecha", label: "Fecha" },
    { k: "contraparte", label: tipo === "ventas" ? "Cliente" : "Proveedor" },
    { k: "tipoIva", label: "Tipo IVA (%)" },
    { k: "base", label: "Base imponible" },
    { k: "cuota", label: "Cuota IVA" },
  ];
  body.innerHTML = `
    <p>No hemos podido detectar las columnas. Asígnalas manualmente:</p>
    ${campos.map((c) => `
      <div class="field-row">
        <label>${c.label}</label>
        <select data-k="${c.k}">
          <option value="">—</option>
          ${headers.map((h, i) => `<option value="${i}">${(h || "").trim()} (col ${i + 1})</option>`).join("")}
        </select>
      </div>`).join("")}
  `;
  document.getElementById("modal").hidden = false;
  document.getElementById("modal-title").textContent =
    `Mapeo manual — ${tipo === "ventas" ? "Libro de Ventas" : "Libro de Compras"}`;

  const cerrar = () => { document.getElementById("modal").hidden = true; };
  document.getElementById("modal-cancel").onclick = cerrar;
  document.getElementById("modal-ok").onclick = () => {
    const map = {};
    body.querySelectorAll("select").forEach((s) => {
      if (s.value !== "") map[s.dataset.k] = parseInt(s.value, 10);
    });
    if (map.fecha == null || (map.base == null && map.cuota == null)) {
      toast("Faltan al menos fecha y base/cuota", true);
      return;
    }
    const facturas = [];
    for (const r of datos) {
      const fecha = parseFecha(r[map.fecha]);
      const tipoIva = normTipoIva(map.tipoIva != null ? r[map.tipoIva] : 21);
      const base = map.base != null ? num(r[map.base]) : 0;
      let cuota = map.cuota != null ? num(r[map.cuota]) : 0;
      if (cuota === 0 && base !== 0) cuota = Math.round(base * tipoIva) / 100;
      if (base === 0 && cuota === 0) continue;
      const cp = map.contraparte != null ? String(r[map.contraparte] ?? "").trim() : "";
      facturas.push({ fecha, contraparte: cp, tipoIva, base, cuota });
    }
    cerrar();
    callback(facturas);
  };
}

/* === Importación === */
async function importar(file, tipo) {
  try {
    const filas = await leerArchivo(file);
    if (!filas.length) { toast("Archivo vacío", true); return; }
    const { facturas, mapeo } = parsearLibro(filas);
    if (mapeo.error || facturas.length === 0) {
      const headerIdx = detectarFilaCabecera(filas);
      const headers = (filas[headerIdx] || []).map((c) => String(c ?? ""));
      const datos = filas.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));
      abrirModalMapeo(headers, datos, tipo, (manuales) => {
        state[tipo] = manuales;
        save();
        toast(`${manuales.length} líneas importadas en ${tipo}.`);
      });
      return;
    }
    state[tipo] = facturas;
    save();
    const extra = mapeo.multitipo ? ` (multi-tipo, ${mapeo.grupos} grupos)` : "";
    toast(`${facturas.length} líneas importadas en ${tipo}${extra}.`);
  } catch (e) {
    toast("Error: " + e.message, true);
  }
}

/* === Wiring === */
function wireDropzone(inputId, tipo) {
  const zone = document.querySelector(`label[for="${inputId}"]`);
  const input = document.getElementById(inputId);
  input.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (f) await importar(f, tipo);
    e.target.value = "";
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
wireDropzone("up-ventas", "ventas");
wireDropzone("up-compras", "compras");

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
