// ============================================================
// Lightweight web auditor — fetches a URL and detects signals
// useful for cold outreach: HTTPS, response time, viewport meta,
// CMS hints, page weight, etc. No external dependencies.
// ============================================================

import type { LeadAudit } from "@freelance/shared";

const UA =
  "Mozilla/5.0 (compatible; FreelanceSuiteAuditor/1.0; +https://example.com/bot)";

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function decode(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extract(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? decode(m[1]).trim() : null;
}

export async function auditUrl(rawUrl: string): Promise<LeadAudit> {
  const url = normalizeUrl(rawUrl);
  const start = Date.now();
  const signals: string[] = [];
  const opportunities: string[] = [];
  const now = new Date().toISOString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res: Response | null = null;
  let html = "";
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    html = await res.text();
  } catch {
    clearTimeout(timeout);
    return {
      url,
      reachable: false,
      statusCode: null,
      https: url.startsWith("https://"),
      responseTimeMs: null,
      responsiveMeta: false,
      generator: null,
      title: null,
      description: null,
      hasFavicon: false,
      approxSizeKb: 0,
      imageCount: 0,
      scriptCount: 0,
      signals: ["⚠️ Web no accesible (timeout o error)"],
      opportunities: [
        "La web no responde — gran oportunidad para ofrecer rehacerla o moverla a un hosting fiable.",
      ],
      score: 95,
      auditedAt: now,
    };
  }
  clearTimeout(timeout);
  const responseTimeMs = Date.now() - start;
  const finalUrl = res.url || url;
  const isHttps = finalUrl.startsWith("https://");

  const title = extract(html, /<title[^>]*>([^<]*)<\/title>/i);
  const description =
    extract(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    extract(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const generator =
    extract(html, /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i) ||
    extract(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i);

  const responsiveMeta = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasFavicon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html);
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const approxSizeKb = Math.round(Buffer.byteLength(html, "utf8") / 1024);
  const hasOG = /<meta[^>]+property=["']og:/i.test(html);
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasFlash = /<object|<embed[^>]+\.swf/i.test(html);
  const lowerHtml = html.toLowerCase();
  const cms = generator || detectCMS(lowerHtml);

  // Signals + opportunities
  let score = 0;

  if (!isHttps) {
    signals.push("❌ Sin HTTPS");
    opportunities.push("Migrar a HTTPS con certificado Let's Encrypt — confianza inmediata.");
    score += 25;
  }
  if (responseTimeMs > 3000) {
    signals.push(`🐢 Lenta (${responseTimeMs} ms)`);
    opportunities.push(
      `La web tarda ${responseTimeMs} ms — optimizar imágenes, caché y hosting puede bajar a < 1s.`
    );
    score += 20;
  } else if (responseTimeMs > 1500) {
    signals.push(`⚠️ Algo lenta (${responseTimeMs} ms)`);
    score += 8;
  } else {
    signals.push(`✅ Velocidad correcta (${responseTimeMs} ms)`);
  }
  if (!responsiveMeta) {
    signals.push("📱 No declara viewport (probablemente no responsive)");
    opportunities.push(
      "La web no es responsive — más del 60% del tráfico se pierde en móvil. Rehacer mobile-first."
    );
    score += 20;
  } else {
    signals.push("✅ Viewport responsive declarado");
  }
  if (!title) {
    signals.push("❌ Sin <title>");
    opportunities.push("Falta <title> — SEO básico sin hacer. Punto de entrada fácil.");
    score += 10;
  }
  if (!description) {
    signals.push("⚠️ Sin meta description");
    opportunities.push("Sin meta description — perjudica CTR en Google. Quick win.");
    score += 6;
  }
  if (!hasOG) {
    signals.push("⚠️ Sin Open Graph");
    opportunities.push(
      "Sin Open Graph: al compartir en redes la previsualización es pobre. Lo añadimos en 1 hora."
    );
    score += 4;
  }
  if (!hasJsonLd) {
    score += 3;
  }
  if (!hasFavicon) {
    signals.push("⚠️ Sin favicon");
    score += 2;
  }
  if (hasFlash) {
    signals.push("☠️ Usa Flash/SWF (obsoleto)");
    opportunities.push("Uso de Flash detectado — la web está rota desde 2020. Rehacer.");
    score += 25;
  }
  if (approxSizeKb > 1500) {
    signals.push(`🏋️ HTML pesado (${approxSizeKb} KB)`);
    opportunities.push("HTML muy pesado — purgar CSS/JS no usado, dividir bundles, lazy-load.");
    score += 8;
  }
  if (imageCount > 30) {
    signals.push(`🖼️ Muchas imágenes (${imageCount})`);
    opportunities.push(
      "Optimización de imágenes (WebP/AVIF + lazy-loading) puede bajar peso a la mitad."
    );
    score += 5;
  }
  if (cms) {
    signals.push(`🛠️ CMS detectado: ${cms}`);
    if (/wordpress/i.test(cms)) {
      opportunities.push(
        "WordPress: oportunidad de hardening + caché + plugin cleanup, o migración a Astro/Next."
      );
    }
  }

  if (score === 0) {
    signals.push("✅ Sin problemas evidentes detectados");
  }

  return {
    url: finalUrl,
    reachable: true,
    statusCode: res.status,
    https: isHttps,
    responseTimeMs,
    responsiveMeta,
    generator: cms || null,
    title,
    description,
    hasFavicon,
    approxSizeKb,
    imageCount,
    scriptCount,
    signals,
    opportunities,
    score: Math.min(100, score),
    auditedAt: now,
  };
}

function detectCMS(html: string): string | null {
  if (/wp-content|wp-includes/.test(html)) return "WordPress";
  if (/shopify\.com|cdn\.shopify/.test(html)) return "Shopify";
  if (/wixstatic|wix\.com/.test(html)) return "Wix";
  if (/squarespace/.test(html)) return "Squarespace";
  if (/cdn\.prestashop/.test(html)) return "PrestaShop";
  if (/joomla/.test(html)) return "Joomla";
  if (/drupal-settings-json/.test(html)) return "Drupal";
  if (/__nuxt|nuxt-link/.test(html)) return "Nuxt";
  if (/__next|_next\/static/.test(html)) return "Next.js";
  if (/data-reactroot/.test(html)) return "React (custom)";
  return null;
}
