# 📋 Registro de Acciones (PWA)

Una Progressive Web App (PWA) ligera, moderna y 100% privada para registrar acciones periódicas y hábitos, guardando toda la información localmente en el dispositivo con **IndexedDB** (cero llamadas a servidor).

---

## 🚀 Características

* **Instalable (PWA):** Cumple con las especificaciones de PWA (`manifest.json` y `sw.js`). Puedes instalarla en Android, iOS o tu navegador de escritorio como una aplicación nativa.
* **100% Offline & Sin Servidor:** Una vez cargada o instalada, funciona sin conexión a internet. Los datos nunca salen de tu dispositivo.
* **Almacenamiento Local (IndexedDB):** Capacidad de almacenamiento prácticamente ilimitada en el navegador, rápida y estructurada.
* **Iconos Lucide:** Integración completa con la librería de iconos Lucide con selector visual integrado.
* **Gestión por Categorías:**
  * Organización de acciones por categorías temáticas (ej: *Estudio*, *Películas*, *Salud*).
  * **Categoría Genérica protegida:** Toda acción pertenece exactamente a una categoría. Si eliminas una categoría personalizada, sus acciones se reasignan automáticamente a "Genérica".
  * **Desduplicación automática:** Si creas una acción con un nombre ya existente, se renombra automáticamente añadiendo `(2)`, `(3)`, etc.
* **Generación de Informes en PDF:** Genera y descarga documentos PDF con un clic directamente en el cliente con **jsPDF** y **AutoTable**:
  * Filtros combinados por período, categoría y acción concreta.
  * Resumen de frecuencia y tabla detallada con columnas: `#`, `Acción`, `Categoría`, `Fecha`, `Hora` y `Notas/Observaciones`.
* **Copia de Seguridad y Restauración:** Exporta e importa copias de seguridad completas (categorías, acciones y registros) en formato JSON.
* **Feedback Táctil:** Vibración háptica en dispositivos móviles al registrar una acción con 1 toque.
* **Modo Oscuro / Claro:** Detección automática según el sistema con interruptor manual persistente.

---

## 📁 Estructura del Proyecto

```text
action-tracker-pwa/
├── index.html              # Interfaz principal (HTML5 semántico, mobile-first)
├── manifest.json           # Manifiesto de la PWA (nombre, tema, iconos standalone)
├── sw.js                   # Service Worker para funcionamiento 100% offline
├── css/
│   └── styles.css          # Estilos responsivos, temas claro/oscuro y componentes
├── js/
│   ├── app.js              # Controlador principal de la UI, navegación y eventos
│   ├── db.js               # Abstracción Promise sobre IndexedDB
│   ├── pdf-export.js       # Generador de informes PDF con jsPDF y AutoTable
│   └── vendor/             # Librerías locales para soporte offline
│       ├── lucide.min.js
│       ├── jspdf.umd.min.js
│       └── jspdf.plugin.autotable.min.js
├── icons/                  # Iconos PWA estándar y maskable
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   ├── icon-maskable-512.png
│   └── favicon.svg
└── README.md
```

---

## 💻 Cómo Ejecutar en Local

Las Progressive Web Apps requieren ser servidas bajo HTTP o HTTPS (no directamente abriendo el archivo con doble clic como `file://`) para que el Service Worker se pueda registrar:

### Opción 1: Con Python (ya disponible en la mayoría de sistemas)
Abre un terminal en la carpeta `action-tracker-pwa` y ejecuta:
```bash
python -m http.server 8080
```
Luego abre en tu navegador: **`http://localhost:8080`**

### Opción 2: Con Node.js / npx
```bash
npx serve .
```

---

## 📲 Cómo Instalar la PWA

* **En Google Chrome / Edge (Escritorio):** Verás el botón **"Instalar"** en la barra superior de la app o el icono de instalación en la barra de direcciones del navegador.
* **En Android (Chrome):** Pulsa el botón "Instalar" dentro de la app o el menú de tres puntos `⋮` > **"Añadir a la pantalla de inicio"** / **"Instalar aplicación"**.
* **En iPhone / iPad (Safari):** Pulsa el botón de Compartir (icono de caja con flecha arriba) y selecciona **"Añadir a pantalla de inicio"**.
