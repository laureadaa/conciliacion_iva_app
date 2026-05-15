# Freelance Suite

Tu sistema operativo freelance: propuestas, precios, perfiles, emails, clientes, **facturas con PDF**, ingresos y **leads con auditor automático de webs**. Todo personalizado con tus datos y sin APIs externas.

## Para qué sirve

1. **Conseguir clientes** — Módulo de Leads que audita la web del prospecto (HTTPS, velocidad, SEO, CMS) y genera un email de outreach personalizado con los hallazgos concretos. Importas leads desde CSV en bloque.
2. **Cerrar trabajos** — Generador de propuestas (~200 palabras, ES/EN), calculadora de precios con 3 rangos y justificación generada.
3. **Cobrar** — Facturas con numeración automática, IVA configurable, PDF descargable y registro automático del ingreso al marcarlas como pagadas.
4. **Medir** — Dashboard con métricas (ingresos del mes, conversión, proyección), gráfica mensual y tracker de ingresos por cliente.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts + Sonner + html2pdf
- **Backend**: Node.js 20 + Express + TypeScript + Drizzle ORM + Zod
- **DB**: SQLite (better-sqlite3) con WAL y backups atómicos
- **Generación de texto**: plantillas locales (cero APIs externas) — ver `server/src/services/generator.ts`
- **Auditor de webs**: nativo Node 20 (`fetch`) — ver `server/src/services/auditor.ts`
- **Auth**: JWT + bcrypt
- **Deploy**: Docker multi-stage + Caddy (HTTPS automático) + sidecar de backups

## Arranque rápido (dev)

```bash
bash setup.sh
npm run dev
```

Abre `http://localhost:5173`.

## Despliegue a producción en un VPS (1 comando)

Requisitos: VPS con Docker + Docker Compose v2, dominio apuntando al VPS.

```bash
# clona en el servidor y entra en el repo
git clone <repo> freelance-suite && cd freelance-suite

# despliega: genera JWT seguro, build de Docker, levanta app + Caddy + backups
DOMAIN=app.midominio.com LETSENCRYPT_EMAIL=tu@email.com ./deploy.sh
```

Esto:
- Crea `.env` con un `JWT_SECRET` de 64 chars generado al vuelo
- Pone `NODE_ENV=production`
- Construye la imagen y arranca 3 servicios: `app`, `caddy` (HTTPS), `backup` (snapshot SQLite cada 24h, retención 14 días)
- Espera al healthcheck del backend antes de declarar el deploy OK
- Lanza un backup inicial

Después, comandos útiles:

```bash
docker compose logs -f app                                          # logs
docker compose exec backup sh /usr/local/bin/backup.sh              # backup manual
docker compose down                                                  # parar
docker compose ps                                                    # estado
```

Los backups quedan en el volumen `app_backups` (montar a host si quieres copiarlos fuera). Restaurar es tan simple como descomprimir el `.gz` sobre `data/app.db`.

## Local con Docker (sin dominio)

```bash
./deploy.sh    # con DOMAIN=localhost
# app en http://localhost
```

## Estructura

```
.
├── client/                    # React + Vite + Tailwind
├── server/                    # Express + Drizzle + SQLite
│   └── src/services/
│       ├── generator.ts       # plantillas locales (propuestas, emails, bios)
│       ├── generator-helpers.ts
│       └── auditor.ts         # auditor de webs
├── shared/                    # tipos TS compartidos
├── scripts/backup.sh          # backup atómico SQLite
├── .github/workflows/ci.yml   # CI: build + smoke test + docker build
├── Dockerfile                 # imagen única (API + frontend)
├── docker-compose.yml         # app + Caddy + backup
├── Caddyfile                  # HTTPS auto con Let's Encrypt
├── deploy.sh                  # despliegue de 1 comando
└── setup.sh                   # bootstrap dev
```

## Variables de entorno

| Variable | Descripción | Prod |
| --- | --- | --- |
| `JWT_SECRET` | Secreto JWT. Generar con `openssl rand -hex 32` | **obligatorio** |
| `JWT_EXPIRES_IN` | `7d`, `30d`, etc. | opcional |
| `DOMAIN` | Dominio público para Caddy + HTTPS auto | obligatorio en VPS |
| `LETSENCRYPT_EMAIL` | Email para certs Let's Encrypt | recomendado |
| `DATABASE_URL` | Ruta SQLite (`/app/data/app.db` en Docker) | opcional |
| `PORT` | Puerto backend (4000 por defecto) | opcional |

## Personalización

Tus datos (nombre, IBAN, tarifa, firma, prefijo de facturas, IVA) se editan en **Ajustes** y se inyectan automáticamente en:
- Propuestas (firma + tarifa + moneda + nombre)
- Emails de outreach (firma + nombre)
- Facturas (cabecera con tus datos + numeración con tu prefijo)
- Justificaciones de precio (moneda)

Los textos generados están en `server/src/services/generator.ts` — cada función tiene varios `pick([...])` con variantes aleatorias. Si quieres más sabor: añade variantes ahí.

## Funcionalidades clave

- **Dashboard** con métricas, gráfica 12 meses y accesos rápidos.
- **Propuestas IA** con 4 estados (borrador / enviada / aceptada / rechazada), filtros, copiar, exportar a PDF.
- **Calculadora de precios** con 3 rangos (económico / recomendado / premium), desglose por horas usando **tu tarifa** y justificación generada.
- **Perfiles** para Malt / Upwork / LinkedIn, en ES y EN.
- **Emails** profesionales (primer contacto, seguimiento, entrega, reseña, recordatorio de pago) con firma personalizada.
- **Clientes** con CRUD y estados.
- **Leads** con auditor (HTTPS, velocidad, viewport, OG, CMS, peso) → outreach contextualizado con los puntos débiles detectados → importación masiva por CSV.
- **Facturas** con numeración automática, IVA, PDF, y registro de ingreso al cobrar.
- **Ingresos** con gráfica mensual y proyección.

UI: modo oscuro/claro, responsive, toasts.
