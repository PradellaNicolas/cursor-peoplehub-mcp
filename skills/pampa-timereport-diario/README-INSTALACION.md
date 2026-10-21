# Instalación y configuración — Time Report diario Pampa

Paquete para revisar y cargar horas en **PeopleHub** desde **Cursor** (sin TFS). Cada integrante configura su **AST de célula** y el agente ayuda con el chequeo diario de **8 horas**.

Este skill vive en el mismo repositorio que el MCP, rama **`feat/peoplehub-list-calendar`**:

`https://github.com/PradellaNicolas/cursor-peoplehub-mcp`

La guía completa (clone, build, MCP y skill) está en [`docs/INSTALACION-PAMPA.md`](../../docs/INSTALACION-PAMPA.md).

| Archivo | Uso |
|---------|-----|
| `README-INSTALACION.md` | Este instructivo |
| `SKILL.md` | Skill de Cursor (regla calendario → concepto) |
| `plantilla-perfil.yaml` | Copiar y completar como perfil personal |
| `USO-DIARIO.md` | Guía rápida día a día |

**No** copiar ni compartir `%USERPROFILE%\.pampa-timereport.yaml` ni `%USERPROFILE%\.peoplehub-mcp\storage.json` (son datos de cada usuario).

---

## 1. Requisitos

- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Git**
- **Cursor** con MCP habilitado
- **Microsoft Edge** instalado (el login usa un perfil aparte, no el Edge cotidiano)
- Cuenta Accusys con acceso a [PeopleHub Time Report](https://peoplehub.accusystechnology.com/time-report)

---

## 2. Instalar MCP (misma rama)

Desde una carpeta de tu elección:

```powershell
git clone -b feat/peoplehub-list-calendar https://github.com/PradellaNicolas/cursor-peoplehub-mcp.git
cd cursor-peoplehub-mcp
npm ci
npm run build
```

El login abre un **Edge con perfil `~/.peoplehub-mcp/edge-profile`**. No hace falta cerrar tu Edge ni instalar Chromium de Playwright.

Opcional: copiar `.env.example` a `.env` solo si necesitás cambiar la URL de PeopleHub.

**Calendario (`peoplehub_list_calendar`):** incluido en esta rama. El skill lo usa para elegir **Horas Calendario (19)** vs **Hs Trabajo Remoto (85)** según [Mi calendario](https://peoplehub.accusystechnology.com/asistencia?tab=calendario) (`GET /api/attendance/me`, solo lectura).

---

## 3. Configurar Cursor (`mcp.json`)

Editar (o crear) `%USERPROFILE%\.cursor\mcp.json` y agregar **peoplehub** (ajustá la ruta al `launcher.mjs` de **tu** clone):

```json
{
  "mcpServers": {
    "peoplehub": {
      "command": "node",
      "args": [
        "C:/Users/<tu-usuario>/projects/cursor-peoplehub-mcp/scripts/launcher.mjs"
      ]
    }
  }
}
```

Si ya tenés otros MCP, solo añadí el bloque `"peoplehub"`. Recargá Cursor (**Developer: Reload Window**) y verificá **Settings → MCP**: `peoplehub` en verde.

---

## 4. Instalar el skill en Cursor

Desde la raíz del clone:

```powershell
.\scripts\install-pampa-skill.ps1
```

Copia `skills/pampa-timereport-diario` a `%USERPROFILE%\.cursor\skills\pampa-timereport-diario\`.

Si la carpeta ya existe (por ejemplo después de un `git pull`):

```powershell
.\scripts\install-pampa-skill.ps1 -Force
```

Alternativa manual:

```powershell
Copy-Item -Recurse -Force .\skills\pampa-timereport-diario $env:USERPROFILE\.cursor\skills\
```

---

## 5. Crear tu perfil

1. Copiar `plantilla-perfil.yaml` a `%USERPROFILE%\.pampa-timereport.yaml`.
2. Completar al menos:
   - `ast_principal.actividad_id` — número de **tu** AST de célula en PeopleHub
   - `reminder_time` — hora a la que querés acordarte de revisar (ej. `17:00`)
   - `concepto_oficina_id` — **19** (Horas Calendario)
   - `concepto_remoto_id` — **85** (Hs Trabajo Remoto)
   - `grupo_id` — el grupo de **cada** concepto
3. Si cubrís **dos células**, completar `ast_secundario` y `reparto_dos_ast`.

Cada persona usa **su** AST y hace **su** login. No pegues el YAML de un compañero.

---

## 6. Primer login en PeopleHub

1. En Cursor, Agent mode: pedí **`peoplehub_login`** (podés dejar abierto tu Edge).
2. Se abre una ventana Edge **aparte**. Primera vez: **Continuar con Microsoft** hasta Time Report. Después suele alcanzar un clic.
3. Las cookies quedan en `%USERPROFILE%\.peoplehub-mcp\storage.json`.
4. Verificá con **`peoplehub_session`** y `peoplehub_list_week`.

**No** compartir ni commitear `storage.json` ni `edge-profile/`. Si la sesión expira, repetí `peoplehub_login`.

---

## 7. Prueba

En Agent mode:

> Revisar mis horas de hoy (time report Pampa)

o `/pampa-timereport-diario`.

El agente debería decir **OK — 8 h cargadas**, **Faltan X h Y min**, o que **no hay carga** y ofrecer ayuda para imputar.

Para cargar horas: confirmá el **preview** (concepto 19 u 85 según calendario). El agente usa `peoplehub_log_hours` con `confirm: true`.

---

## 8. Actualizar

```powershell
git pull
npm ci
npm run build
.\scripts\install-pampa-skill.ps1 -Force
```

---

## Seguridad

- No commitear `.pampa-timereport.yaml` ni `storage.json`.
- `peoplehub_log_hours` no envía nada sin `confirm: true`.
- El calendario del MCP es **solo lectura** (no marca asistencia).

---

## Ayuda

- Uso cotidiano: `USO-DIARIO.md`
- Instalación del equipo: [`docs/INSTALACION-PAMPA.md`](../../docs/INSTALACION-PAMPA.md)
- Facilitador de célula: coordinar AST correcto por persona
