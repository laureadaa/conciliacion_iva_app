# Freelance Suite

Asistente freelance para desarrolladoras: propuestas, precios, perfiles para Malt/Upwork/LinkedIn, emails profesionales, clientes y tracker de ingresos.

**Sin APIs externas, sin claves, sin coste.** Toda la generación de texto (propuestas, emails, bios, justificaciones de precio) se hace con plantillas locales inteligentes en el servidor. Funciona offline.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts + Sonner
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM
- **Base de datos**: SQLite (`better-sqlite3`)
- **Generación de texto**: plantillas locales (en `server/src/services/generator.ts`)
- **Auth**: JWT (email + contraseña, bcrypt)
- **Deploy**: Dockerfile multi-stage + `docker-compose.yml`

## Estructura

```
.
├── client/      # Frontend React
├── server/      # Backend Express
├── shared/      # Tipos TypeScript compartidos
├── data/        # SQLite (generado)
├── Dockerfile
├── docker-compose.yml
├── setup.sh
└── .env.example
```

## Arranque rápido

```bash
bash setup.sh
npm run dev
```

Frontend en `http://localhost:5173`, backend en `http://localhost:4000`.

> Si `setup.sh` no es ejecutable: `chmod +x setup.sh`.

## Variables de entorno

Ver `.env.example`. Principales:

| Variable | Descripción |
| --- | --- |
| `JWT_SECRET` | Secreto para firmar JWT |
| `DATABASE_URL` | Ruta del archivo SQLite (por defecto `./data/app.db`) |
| `PORT` | Puerto del backend (por defecto `4000`) |

## Scripts útiles

```bash
npm run dev           # arranca client + server
npm run build         # build de producción
npm run db:migrate    # crea tablas si no existen
npm run start         # arranca el servidor compilado
```

## Funcionalidades

1. **Dashboard** con métricas (ingresos del mes, proyectos activos, propuestas enviadas, conversión) y proyección.
2. **Propuestas**: generador de propuestas profesionales de ~200 palabras (ES/EN) con plantillas estructuradas y variaciones aleatorias para que no se repitan. Estados borrador/enviada/aceptada/rechazada, copiar, exportar a PDF.
3. **Calculadora de precios** con 3 rangos (económico/recomendado/premium), desglose por horas y justificación automática para enviar al cliente.
4. **Perfiles** para Malt, Upwork, LinkedIn y "otros", en ES y EN, cada uno con su tono propio.
5. **Emails**: primer contacto, seguimiento, entrega, reseña, recordatorio de pago — con asunto + cuerpo listos para enviar.
6. **CRUD de clientes** con notas y estado (potencial/activo/recurrente/inactivo).
7. **Tracker de ingresos** con gráfica mensual y proyección.

Otras: modo oscuro/claro, toasts, responsive, manejo de errores, loading states.

## Cómo personalizar las plantillas

Toda la generación está en un único archivo:

```
server/src/services/generator.ts
```

Cada función (`generateProposal`, `generateEmail`, `generateProfile`, `generateJustification`) está aislada y tiene variaciones aleatorias. Edita los textos a tu gusto o añade más variantes en los `pick([...])` para que el output sea aún más variado.

Si en el futuro quieres conectarlo a un LLM (Claude, OpenAI, Gemini, Ollama local…), solo necesitas reemplazar el cuerpo de esas funciones — los routes ya pasan toda la información necesaria.

## Docker

```bash
docker compose up -d --build
```

Sirve el backend en `:4000`. Para producción puedes servir el `client/dist` detrás de un reverse proxy (Caddy/nginx).
