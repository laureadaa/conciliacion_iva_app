# Freelance AI Suite

Asistente freelance con IA para desarrolladoras: propuestas, precios, perfiles para Malt/Upwork/LinkedIn, emails profesionales, clientes y tracker de ingresos. Todo potenciado por Claude (Anthropic).

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts + Sonner
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM
- **Base de datos**: SQLite (`better-sqlite3`)
- **IA**: Anthropic SDK (modelo `claude-sonnet-4-20250514`)
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
# edita .env y añade tu ANTHROPIC_API_KEY
npm run dev
```

Frontend en `http://localhost:5173`, backend en `http://localhost:4000`.

> Si `setup.sh` no es ejecutable: `chmod +x setup.sh`.

## Variables de entorno

Ver `.env.example`. Principales:

| Variable | Descripción |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clave de Anthropic (obligatoria para IA) |
| `ANTHROPIC_MODEL` | Modelo Claude (por defecto `claude-sonnet-4-20250514`) |
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
2. **Propuestas IA**: Claude redacta propuestas profesionales de ~200 palabras (ES/EN). Estados borrador/enviada/aceptada/rechazada. Copiar, exportar a PDF.
3. **Calculadora de precios** con 3 rangos (económico/recomendado/premium), desglose por horas y justificación generada por IA.
4. **Perfiles** para Malt, Upwork, LinkedIn, en ES y EN.
5. **Emails IA**: primer contacto, seguimiento, entrega, reseña, recordatorio de pago.
6. **CRUD de clientes** con notas y estado (potencial/activo/recurrente/inactivo).
7. **Tracker de ingresos** con gráfica mensual y proyección.

Otras: modo oscuro/claro, toasts, responsive, manejo de errores, loading states.

## Docker

```bash
docker compose up -d --build
```

Sirve el backend en `:4000`. Para producción puedes servir el `client/dist` detrás de un reverse proxy (Caddy/nginx) o sustituir `vite preview`/Express para servir estáticos.

## Notas

- La primera vez que el servidor arranca crea las tablas automáticamente (idempotente).
- Las llamadas a Claude requieren `ANTHROPIC_API_KEY`; sin clave, los endpoints IA devolverán un error 500 con mensaje explicativo.
