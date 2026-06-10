---
tags: [proyecto, stack, técnico]
created: 2026-06-09
---

# Stack Técnico

← [[MOC Portfolio]]

## Backend

- **Node.js + Express** — servidor principal (`server.js`)
- **PostgreSQL** — base de datos con `pg`
- **Cloudinary** — subida y gestión de imágenes
- **dotenv** — variables de entorno
- **otplib + qrcode** — autenticación 2FA para el admin

## Frontend

- HTML/CSS/JS puro — sin framework
- **GSAP** — animaciones y cursor personalizado
- CSS por página: cada sección tiene su propio archivo

## Páginas del sitio

- `index.html` — inicio
- `animations.html`, `characters.html`, `illustrations.html`
- `models-3d.html`, `multimedia.html`
- `admin.html` — panel de administración

## Herramientas de Dev

- `live-server` — servidor de desarrollo
- `@playwright/test` — testing
