# CTS Odoo Docs

Portal técnico y funcional (MkDocs Material) sobre el Odoo de Industrias CTS: módulos custom, procesos (Recepción, Alistamiento, Entrega), modelos, wizards, vistas y decisiones de arquitectura (ADR). Documenta el trabajo hecho sobre `odoo-docker` (rama `changes_stock`) para entrega de cargo.

- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Ejecutar en desarrollo](#ejecutar-en-desarrollo)
- [Generar el sitio estático](#generar-el-sitio-estático)
- [Ver el sitio ya construido](#ver-el-sitio-ya-construido)
- [¿Es autocontenido?](#es-autocontenido)
- [Estructura](#estructura)

## Requisitos

- Python 3.10+ (probado con 3.10.11).
- `pip`.
- Internet la primera vez, para instalar dependencias y para que carguen fuentes/diagramas al ver el sitio (ver [¿Es autocontenido?](#es-autocontenido)).

## Instalación

```bash
git clone <url-de-este-repo>
cd cts-odoo-docs

python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
```

`requirements.txt` solo fija `mkdocs-material==9.7.7` — pip resuelve `mkdocs` y el resto de dependencias transitivas solo.

## Ejecutar en desarrollo

```bash
mkdocs serve
```

Sirve el sitio en [http://localhost:8000](http://localhost:8000) con recarga automática al guardar cualquier archivo de `docs/`.

## Generar el sitio estático

```bash
mkdocs build
```

Genera `site/` (HTML ya renderizado, gitignorado — no se commitea, se regenera con este comando).

## Ver el sitio ya construido

**No abras `site/index.html` con doble clic.** Sírvelo por HTTP:

```bash
python -m http.server --directory site 8000
```

Los diagramas dibujados a mano (los 8 archivos `*.diagram.html` en `docs/`) se cargan con `fetch()` desde JavaScript (`docs/javascripts/diagrams.js`) — los navegadores bloquean ese `fetch` por CORS cuando la página se abre como `file://`. Con `mkdocs serve` esto ya funciona porque sirve por HTTP.

## ¿Es autocontenido?

**Para construir el sitio, sí** — todo el contenido (Markdown, HTML de diagramas, CSS, JS propio) vive dentro de `docs/`; nada del build depende de archivos fuera de este repo.

**Para *verlo*, no del todo.** El sitio carga 2 recursos desde CDN en el navegador de quien lo mira, no en el build:

| Recurso | De dónde | Dónde se usa | Si no hay internet |
|---|---|---|---|
| Fuentes (Instrument Serif, Geist, Geist Mono) | `fonts.googleapis.com` | `mkdocs.yml` (`extra_css`, todo el sitio) + repetido dentro de 5 de los 8 `*.diagram.html` (los de `etiquetas_rc.*` y `custom_barcode_activos`) | Cae a la fuente de reemplazo del sistema — se ve, cambia la tipografía |
| Mermaid.js `11.4.1` | `cdn.jsdelivr.net` | `mkdocs.yml` (`extra_javascript`) | Los bloques ` ```mermaid ` de los `.md` **no renderizan** (quedan vacíos o en error) |

Los 8 diagramas `*.diagram.html` (dibujados a mano, no Mermaid) no dependen de esa CDN de JS para renderizar — son SVG puro embebido; solo 5 de ellos pierden la tipografía sin internet, ninguno deja de mostrarse.

`docs/stylesheets/extra.css` no tiene `@import` externos — es 100% local.

## Estructura

```text
docs/
├── index.md, guia.md, arquitectura.md, modelos.md, wizards.md, vistas.md,
│   flujos.md, historial.md, adr.md, api.md
├── modulos/            # una página por módulo custom + módulo Etiquetas RC
├── procesos/           # Recepción, Alistamiento, Entrega
├── javascripts/         diagrams.js — motor de Mermaid + diagramas estáticos
├── stylesheets/         extra.css
└── *.diagram.html        8 diagramas dibujados a mano (SVG), fuera del árbol de nav de mkdocs.yml,
                          enlazados desde su página con <div class="diagram" data-diagram-src="...">
mkdocs.yml               configuración del sitio (tema, nav, extensiones)
requirements.txt         mkdocs-material==9.7.7
.venv/                   entorno virtual (gitignorado)
site/                    salida de `mkdocs build` (gitignorado)
```

---

Nota: este repositorio todavía no tiene ningún commit (`git status` marca "No commits yet"). El primer commit queda pendiente.
