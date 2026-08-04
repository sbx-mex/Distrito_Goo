# Distrito Goo — versión 48 · operativo sostenible

Distrito Goo continúa siendo una PWA 100% estática para GitHub Pages. Python se utiliza únicamente durante auditoría y compilación para validar el CMS y generar JSON; no forma parte del runtime ni requiere servidor.

## Arquitectura

- `index.html`, `styles/distrito-go.css` y `modules/`: interfaz existente con estilos consolidados.
- `data/`: JSON estáticos consumidos por la aplicación.
- `tools/validate_cms.py`, `tools/build_data.py` y `tools/audit_links.py`: validan el CMS, generan JSON y producen auditorías reproducibles.
- `tools/audit_static.py`: valida JSON, rutas locales, IDs HTML, navegación y APP_SHELL.
- `tools/cleanup_unused.py`: detecta recursos huérfanos con una política conservadora y solo los elimina con confirmación explícita.
- `.github/workflows/actualizar-cms.yml`: compila cada reemplazo del CMS en aislamiento y publica únicamente si todo aprueba.
- `cms-contract.json`: contrato editable de las 14 pestañas, sus claves y salidas.
- `tools/validate_cms_sync.py`: reconciliación por SHA, registros y salidas; también prueba cambios de `# Evento` sin efectos colaterales.
- `modules/operations-center.js`: centro de mando, perfil de tienda, vigencia y ruta contextual.
- `sw.js`: caché offline compatible con rutas relativas de GitHub Pages.
- `.github/workflows/pruebas-navegacion-real.yml`: navegación real con Chromium en 320, 390, 768 y 1440 px.

## Actualizar desde el CMS

```bash
python -m pip install -r requirements.txt
python tools/optimize_images.py --project . --report reports/image-optimization.json
python tools/validate_cms.py /ruta/Distrito_Go_CMS.xlsx --report reports/cms-validation.json
python tools/build_data.py /ruta/Distrito_Go_CMS.xlsx --project .
python tools/validate_assets.py
python tools/audit_links.py /ruta/Distrito_Go_CMS.xlsx --report reports/link-audit.json
python tools/audit_static.py
```

El pipeline lee por nombre de pestaña y encabezado. Detiene la generación cuando falta una pestaña o encabezado obligatorio y nunca depende de posiciones fijas de columnas. En `Informativo`, el nombre escrito en `Link /Imagen` se resuelve automáticamente y usa una variante WebP cuando existe.

## Validación antes de publicar

```bash
find modules -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
python tools/audit_static.py
```

## GitHub Pages

Publicar el contenido de la raíz de `main` mediante **Deploy from a branch**. Conservar `.nojekyll`, las rutas relativas `./` y todos los archivos incluidos en `APP_SHELL`.

Después de publicar una nueva versión, abrir la PWA una vez con conexión para instalar la caché `distrito-go-v48.0.0-operativo-sostenible`.

## Inicio y navegación

- Existe un único menú horizontal y centrado con `Inicio`, `Explorar` y `Guardados`; la búsqueda global está siempre disponible desde el encabezado y abre el buscador único de Explorar.
- Inicio incorpora un centro de mando con avance diario, inventario próximo, vencimientos, desarrollo y un perfil de tienda persistente.
- La agenda presenta hoy, mañana y el resto de la semana, además de los siete días con fecha real y actividades gobernadas por el CMS.
- `JUNTÉMONOS MÁS` se renderiza desde `data/identity.json` con saludo, fecha, ruta y mensaje dinámicos.
- `Personas` muestra recursos generales y las rutas vigentes de Desarrollo Partner.
- `Peak` no aparece como acceso principal. Su contenido real permanece dentro de `Operación`, especialmente en Duty Roster, ritmo, cobertura y despliegue.
- Explorar mantiene las herramientas ocultas hasta seleccionar un filtro y, al hacerlo, las presenta arriba de las categorías para reducir desplazamientos.
- Las acciones `Abrir` o `Ir a la sección` se muestran únicamente cuando existe una sección específica, imagen, enlace web o acción real. Los registros sin destino permanecen informativos y no pueden abrirse ni guardarse.
- `Celebraciones` no se ofrece como tarjeta en Explorar; las celebraciones reales continúan visibles en Semana y en su apartado operativo.
- Las actividades sin destino real permanecen informativas y no muestran una acción simulada.
- Los checks se habilitan únicamente en rutinas diarias y actividades semanales operativas; su avance se reinicia por fecha y conserva 14 días locales.
- `Guardados` conserva identificadores estables del CMS en el dispositivo y sincroniza el corazón entre tarjetas, catálogo, búsqueda, detalle y herramientas.
- La información completa se abre en el visor interno; las tarjetas no duplican la descripción extensa.
- Maquila, comunicados e infografías utilizan portadas HTML/CSS; el original se abre completo en el visor interno.
- El Service Worker precarga únicamente la interfaz y los datos esenciales; imágenes y PDF se cargan al solicitarlos.
- Desarrollo Partner y Duty Roster se renderizan al acercarse a su sección.
- Solo **Actualizaciones de la semana** conserva el tratamiento visual prioritario.

## Controles visuales del CMS

La pestaña `Informativo` conserva sus encabezados originales y agrega:

- `Etiqueta`: `Nuevo`, `Importante`, `Actualizado` u otra etiqueta breve.
- `Vigencia Inicio` y `Vigencia Fin`: límites opcionales en formato de fecha.
- `Orden`: prioridad de presentación visual.
- `Mostrar Inicio`: debe existir solamente una prioridad principal.
- `Mostrar Explorar`: permite incluir o retirar la tarjeta sin editar `index.html`.
- `Acceso Rápido`: clasifica registros en `Hoy`, `Apertura`, `Personas` o `Semana`. El valor histórico `Peak`, si existe, se interpreta dentro de `Operación`.

Duty Roster conserva las referencias operativas de Peak como contenido de `Operación`, sin mostrarlas como un quinto acceso superior.

El pipeline conserva el original, genera WebP y miniaturas únicamente para recursos utilizados y publica en JSON las rutas optimizada, miniatura y respaldo.

## Auditoría integral

- El proyecto conserva únicamente las rutas activas o necesarias para mantenimiento.
- El apartado **Maquila** consume `assets/photos/maquila_actualizado.png` y el mensaje autorizado desde el CMS.
- `photos/`, `logo/`, `premium/`, las variantes antiguas de Duty Roster y los JSON heredados sin consumo fueron retirados.
- La imagen `resumen_comunicado_semana_actual.png` continúa con estrategia `network-first`; el resto de imágenes mantiene `cache-first`.
- Los reportes de validación se conservan como artefactos temporales de Actions y no dentro del sitio.

## Limpieza segura

El workflow `.github/workflows/mantenimiento-seguro.yml` administra únicamente contenido vencido. `.github/workflows/depurar-proyecto.yml` audita archivos huérfanos cada semana y solo elimina con la confirmación `ELIMINAR_ARCHIVOS_HUERFANOS`; después valida la aplicación y bloquea cualquier commit que no contenga exclusivamente eliminaciones.

## Qué ocurre al editar el Excel

Puedes cambiar una celda, una fecha, una descripción o `# Evento`. El pipeline lee columnas por encabezado, no por posición; calcula una huella de las 14 pestañas, compila en una copia temporal y comprueba que cada salida corresponda al Excel actual. Las pruebas no exigen cantidades, meses o IDs históricos. Si cualquier control falla, no se hace commit y GitHub Pages conserva la última versión aprobada.

Workflows propios vigentes: `actualizar-cms.yml`, `control-calidad.yml`, `pruebas-navegacion-real.yml`, `mantenimiento-seguro.yml` y `depurar-proyecto.yml`.

## Felicitaciones PDF

En **Aniversarios y cumpleaños**, cada tarjeta genera un PDF cuadrado al seleccionarla. Cumpleaños utiliza una composición cálida y festiva; aniversario emplea verde profundo, dorado y un sello de antigüedad calculado desde la fecha de ingreso. Ambos formatos ajustan automáticamente nombres largos y funcionan con las celebraciones de la semana o mes que corresponda al abrir la PWA.

Para revisar el machote sin abrir la aplicación:

```bash
python tools/generate_celebration_machote.py --type birthday --name "Nombre Partner" --store "Tienda" --output felicitacion.pdf

python tools/generate_celebration_machote.py --type anniversary --name "Nombre Partner" --store "Tienda" --source-date 2022-07-27 --date 2026-07-27 --output aniversario.pdf
```
