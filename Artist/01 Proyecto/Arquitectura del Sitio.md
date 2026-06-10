---
tags: [proyecto, arquitectura]
created: 2026-06-09
---

# Arquitectura del Sitio

← [[MOC Portfolio]]

## Estructura de archivos (simplificada)

```
artist-portfolio/
├── server.js          ← Express + rutas API
├── cms.js             ← lógica del CMS
├── script.js          ← JS principal (index)
├── style.css          ← estilos globales
├── content.json       ← contenido editable
├── index.html
├── animations.html    ┐
├── characters.html    │ páginas de galería
├── illustrations.html │
├── models-3d.html     │
├── multimedia.html    ┘
├── admin.html         ← panel de admin
└── images/            ← imágenes locales
```

> ⚠️ `node_modules/` existe pero no está en este vault. El código se edita en VS Code.

## Flujo de datos

1. Contenido guardado en PostgreSQL (producción) o `content.json` (local)
2. Imágenes subidas a Cloudinary via API
3. Admin con 2FA protege las rutas de escritura
4. Frontend consume la API de Express

## Patrones notables

- Cada página tiene su propio `.css` y `.page.js`
- `gallery-common.js` y `gallery-common.css` son compartidos
- `shared-ui.js` — componentes reutilizables (header, nav)
