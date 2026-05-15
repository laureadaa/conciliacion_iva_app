// ============================================================
// Lead discovery via OpenStreetMap (Overpass API).
// Multi-mirror with fallback. No API key.
// ============================================================

import type { DiscoverHit } from "@pitchfork/shared";

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// Sector → OSM filter group. Each entry produces a `node[...]` line inside the union.
const SECTORS: Record<string, string[]> = {
  // Restauración
  restaurante: ['node["amenity"="restaurant"]'],
  bar: ['node["amenity"="bar"]', 'node["amenity"="pub"]'],
  cafeteria: ['node["amenity"="cafe"]'],
  comida_rapida: ['node["amenity"="fast_food"]'],

  // Comercio
  panaderia: ['node["shop"="bakery"]'],
  fruteria: ['node["shop"="greengrocer"]'],
  carniceria: ['node["shop"="butcher"]'],
  pescaderia: ['node["shop"="seafood"]'],
  ultramarinos: ['node["shop"="convenience"]'],
  estanco: ['node["shop"="tobacco"]'],
  joyeria: ['node["shop"="jewelry"]'],
  zapateria: ['node["shop"="shoes"]'],
  ropa: ['node["shop"="clothes"]'],
  optica: ['node["shop"="optician"]', 'node["amenity"="optician"]'],
  ferreteria: ['node["shop"="hardware"]', 'node["shop"="doityourself"]'],
  floristeria: ['node["shop"="florist"]'],
  libreria: ['node["shop"="books"]'],
  herbolario: ['node["shop"="herbalist"]'],
  bicicletas: ['node["shop"="bicycle"]'],
  electronica: ['node["shop"="electronics"]'],

  // Servicios
  peluqueria: ['node["shop"="hairdresser"]', 'node["amenity"="hairdresser"]'],
  estetica: ['node["shop"="beauty"]', 'node["amenity"="beauty_salon"]'],
  taller_mecanico: ['node["shop"="car_repair"]', 'node["amenity"="car_repair"]'],
  dentista: ['node["amenity"="dentist"]'],
  veterinario: ['node["amenity"="veterinary"]'],
  farmacia: ['node["amenity"="pharmacy"]'],
  fisio: ['node["healthcare"="physiotherapist"]'],
  clinica: ['node["amenity"="clinic"]'],
  gimnasio: ['node["leisure"="fitness_centre"]', 'node["amenity"="gym"]'],
  autoescuela: ['node["amenity"="driving_school"]'],

  // Oficios
  fontanero: ['node["craft"="plumber"]'],
  electricista: ['node["craft"="electrician"]'],
  pintor: ['node["craft"="painter"]'],
  carpintero: ['node["craft"="carpenter"]'],
  albanil: ['node["craft"="builder"]'],
  cerrajero: ['node["craft"="locksmith"]'],

  // Oficinas
  abogado: ['node["office"="lawyer"]'],
  gestoria: ['node["office"="tax_advisor"]', 'node["office"="accountant"]'],
  inmobiliaria: ['node["office"="estate_agent"]'],
  arquitecto: ['node["office"="architect"]'],
  agencia_viajes: ['node["shop"="travel_agency"]'],
};

export const SECTOR_LABELS: Record<string, string> = {
  restaurante: "Restaurantes",
  bar: "Bares y pubs",
  cafeteria: "Cafeterías",
  comida_rapida: "Comida rápida",
  panaderia: "Panaderías",
  fruteria: "Fruterías",
  carniceria: "Carnicerías",
  pescaderia: "Pescaderías",
  ultramarinos: "Ultramarinos",
  estanco: "Estancos",
  joyeria: "Joyerías",
  zapateria: "Zapaterías",
  ropa: "Tiendas de ropa",
  optica: "Ópticas",
  ferreteria: "Ferreterías",
  floristeria: "Floristerías",
  libreria: "Librerías",
  herbolario: "Herbolarios",
  bicicletas: "Tiendas bicis",
  electronica: "Electrónica",
  peluqueria: "Peluquerías",
  estetica: "Centros estética",
  taller_mecanico: "Talleres mecánicos",
  dentista: "Dentistas",
  veterinario: "Veterinarios",
  farmacia: "Farmacias",
  fisio: "Fisioterapeutas",
  clinica: "Clínicas",
  gimnasio: "Gimnasios",
  autoescuela: "Autoescuelas",
  fontanero: "Fontaneros",
  electricista: "Electricistas",
  pintor: "Pintores",
  carpintero: "Carpinteros",
  albanil: "Albañiles",
  cerrajero: "Cerrajeros",
  abogado: "Abogados",
  gestoria: "Gestorías / asesorías",
  inmobiliaria: "Inmobiliarias",
  arquitecto: "Arquitectos",
  agencia_viajes: "Agencias viajes",
};

function buildQuery(opts: {
  city: string;
  sectors: string[];
  onlyWithoutWebsite: boolean;
}): string {
  const filters: string[] = [];
  for (const s of opts.sectors) {
    const lines = SECTORS[s];
    if (!lines) continue;
    for (const base of lines) {
      const tagFilter = opts.onlyWithoutWebsite
        ? '[!website][!"contact:website"]'
        : "";
      filters.push(`${base}["name"]${tagFilter}(area.searchArea);`);
    }
  }
  if (filters.length === 0) return "";

  // Use admin_level 8 (municipio) for Spain.
  return `[out:json][timeout:90];
area["name"="${opts.city.replace(/"/g, '\\"')}"]["admin_level"="8"]->.searchArea;
(
${filters.join("\n")}
);
out body 800;`;
}

async function fetchMirror(query: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of MIRRORS) {
    try {
      const body = new URLSearchParams({ data: query }).toString();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Pitchfork/1.0 (lead discovery)",
          Accept: "application/json",
        },
        body,
      });
      if (!res.ok) {
        lastError = new Error(`Mirror ${url} returned ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All Overpass mirrors failed");
}

export async function discoverLeads(opts: {
  city: string;
  sectors: string[];
  onlyWithoutWebsite: boolean;
  limit?: number;
}): Promise<DiscoverHit[]> {
  const q = buildQuery(opts);
  if (!q) return [];
  const data = (await fetchMirror(q)) as {
    elements: Array<{
      id: number;
      lat?: number;
      lon?: number;
      tags?: Record<string, string>;
    }>;
  };
  const out: DiscoverHit[] = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    if (!t.name) continue;
    // Determine matched category
    let category = "otro";
    for (const [k, lines] of Object.entries(SECTORS)) {
      for (const base of lines) {
        const m = base.match(/\["([^"]+)"="([^"]+)"\]/);
        if (m && t[m[1]] === m[2]) {
          category = k;
          break;
        }
      }
    }
    const address = [t["addr:street"], t["addr:housenumber"]]
      .filter(Boolean)
      .join(" ")
      .trim();
    const website = t.website || t["contact:website"] || null;
    const email = t.email || t["contact:email"] || null;
    const phone = t.phone || t["contact:phone"] || null;
    out.push({
      name: t.name,
      category,
      website,
      email,
      phone,
      city: t["addr:city"] || opts.city,
      address: address || null,
      lat: el.lat ?? 0,
      lon: el.lon ?? 0,
      osmId: `osm:${el.id}`,
    });
  }
  // Deduplicate by name + lat/lon
  const seen = new Set<string>();
  const dedup: DiscoverHit[] = [];
  for (const h of out) {
    const key = `${h.name.toLowerCase()}|${h.lat.toFixed(4)}|${h.lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(h);
  }
  return opts.limit ? dedup.slice(0, opts.limit) : dedup;
}

// Try to discover an email by fetching the lead's website and looking for mailto:.
export async function findEmailFromWebsite(
  websiteUrl: string
): Promise<string | null> {
  try {
    let url = websiteUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Pitchfork/1.0 (email discovery)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const m1 = html.match(/mailto:([^"'>\s?]+)/i);
    if (m1) return decodeURIComponent(m1[1]).trim();
    // Generic email regex (filter common false positives)
    const m2 = html.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    if (m2 && !/sentry|wixpress|wordpress|example|@2x/i.test(m2[0])) {
      return m2[0];
    }
    return null;
  } catch {
    return null;
  }
}
