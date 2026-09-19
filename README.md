# Vault CRM

CRM local para gestionar clientes, pagos, revisiones y contabilidad desde tu Mac,
sustituyendo las hojas de Google Sheets sueltas por una sola herramienta.

Es una aplicación web que se ejecuta **en tu propio ordenador** (no en la nube):
todos los datos se guardan en un fichero SQLite local (`data/crm.db`), no salen
de tu Mac y no necesitas conexión a internet para usarla una vez instalada.

## Qué incluye

- **Clientes**: nombre, contacto, fecha de inscripción, plan/cuota, periodicidad
  de cobro y próxima fecha de renovación.
- **Pagos**: historial de pagos por cliente, con opción de actualizar
  automáticamente la próxima renovación al registrar un cobro.
- **Revisiones**: control de revisiones/seguimientos pendientes, realizadas o
  canceladas por cliente. El panel avisa de qué clientes activos no tienen una
  revisión reciente (o nunca la han tenido) y muestra las completadas en los
  últimos 7 días; el umbral de aviso (por defecto 60 días) se configura en
  `REVISION_ALERT_THRESHOLD_DAYS` (`src/lib/types.ts`).
- **Gastos**: registro de gastos por categoría.
- **Contabilidad**: balance mensual (ingresos vs. gastos) y desglose de gastos
  por categoría, por año.
- **Publicidad (Centro de mando)**: inversión en ads por fuente (Meta, Google,
  TikTok, orgánico...), leads, llamadas agendadas y cierres, con coste por
  lead/llamada/cierre y coste por cliente según de dónde viene. Los clientes
  llevan un campo "fuente" para poder atribuirlos a un canal.
- **Importar**: sube tus hojas de Google Sheets exportadas como CSV (clientes,
  pagos, gastos) y mapea las columnas a los campos del CRM.
- **Resumen (dashboard)**: clientes activos, renovaciones próximas o vencidas,
  revisiones pendientes y balance del mes.

## Requisitos

- [Node.js](https://nodejs.org/) 22.5 o superior (usa la base de datos SQLite
  integrada de Node, sin dependencias nativas que compilar).

Comprueba tu versión con:

```bash
node --version
```

Si no lo tienes instalado, en Mac puedes hacerlo con [Homebrew](https://brew.sh/):

```bash
brew install node
```

## Puesta en marcha

1. Instala las dependencias (solo la primera vez):

   ```bash
   npm install
   ```

2. Arranca la aplicación:

   ```bash
   npm run dev
   ```

3. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

La base de datos se crea automáticamente la primera vez en `data/crm.db`. Ese
fichero es tu CRM completo: haz copia de seguridad de esa carpeta de vez en
cuando (por ejemplo, con Time Machine o copiándola a la nube manualmente).

### Dejarlo funcionando de forma permanente

Para uso diario puedes dejar `npm run dev` corriendo en una pestaña de
Terminal, o generar una versión optimizada:

```bash
npm run build
npm run start
```

## Importar tus hojas de Google Sheets

1. En Google Sheets: **Archivo → Descargar → Valores separados por comas (.csv)**
   para cada hoja (clientes, pagos, gastos).
2. En el CRM, ve a **Importar**.
3. Sube el CSV correspondiente: el sistema detecta las columnas y sugiere
   automáticamente la relación con los campos del CRM (nombre, fecha, importe,
   etc.), que puedes ajustar manualmente.
4. Pulsa **Importar** y revisa el resumen de filas importadas/omitidas.

Importa primero los **clientes**, y después los **pagos** (que se relacionan
por nombre o email exacto del cliente).

## Estructura del proyecto

```
src/
  app/            páginas (dashboard, clientes, pagos, gastos, revisiones, contabilidad, importar)
  components/     componentes de UI reutilizables
  lib/
    db.ts         conexión y esquema de la base de datos SQLite
    queries.ts    lecturas de datos (listados, dashboard, balances)
    actions.ts    altas/bajas/modificaciones (Server Actions)
    importActions.ts  importación de CSV
data/
  crm.db          base de datos local (se crea sola, no se sube a git)
```

## Tecnología

Next.js (App Router) + TypeScript + Tailwind CSS + SQLite (`node:sqlite`),
sin dependencias externas de base de datos ni servicios en la nube.
