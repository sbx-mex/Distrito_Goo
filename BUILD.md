# Build y despliegue — centro operativo v42

```bash
python -m pip install -r requirements.txt
python tools/optimize_images.py --project . --report reports/image-optimization.json
python tools/validate_cms.py Distrito_Go_CMS_v2_actualizado.xlsx --report reports/cms-validation.json
python tools/build_data.py Distrito_Go_CMS_v2_actualizado.xlsx --project .
python tools/validate_assets.py
python tools/audit_links.py Distrito_Go_CMS_v2_actualizado.xlsx --report reports/link-audit.json
python tools/audit_static.py
find modules -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
node tools/test_experience_v37.mjs --report reports/v42-compatibility.json
node tools/test_enhancements_v42.mjs --report reports/v42-enhancements.json
```

Publicar la raíz del repositorio desde `main` con **GitHub Pages · Deploy from a branch** y conservar `.nojekyll`. El service worker instala la nueva versión en espera y sólo se activa cuando el usuario selecciona **Actualizar**.

Al reemplazar `Distrito_Go_CMS_v2_actualizado.xlsx` en la raíz, `.github/workflows/actualizar-cms.yml` valida las 14 pestañas, genera WebP y miniaturas para imágenes pesadas, regenera los JSON, comprueba rutas y publica el resultado. Los nombres de imagen se leen desde el CMS; no es necesario editar `index.html`.

`resumen_comunicado_semana_actual.png` conserva su nombre, original y estrategia `network-first`; el Inicio utiliza su miniatura WebP y el visor presenta el recurso completo. Las demás imágenes generadas incluyen una versión por contenido en los JSON para evitar caché obsoleta.

La limpieza segura se ejecuta manualmente con
`.github/workflows/limpieza-archivos-sin-uso.yml`. Primero debe utilizarse el
modo `AUDITAR`; el modo `BORRAR_CONFIRMADO` elimina únicamente archivos
huérfanos comprobados y vuelve a validar la aplicación antes de publicar.

Explorar utiliza categorías y los JSON ya cargados; no requiere una columna
adicional ni cambios en el CMS. `Peak` se conserva dentro del contenido
operativo de Duty Roster y ya no se muestra como acceso principal. El menú
único contiene Inicio, Explorar y Guardados.

La vista Personas excluye del catálogo los registros individuales de Partners.
Rutina diaria utiliza un catálogo horizontal sin reproducción automática.
Favoritos se guarda localmente mediante IDs estables y se sincroniza entre
catálogo, detalle y Guardados.

La navegación principal permanece horizontal y centrada desde 320 px. Semana
presenta agenda de hoy, mañana y resto de la semana, además de los siete días con su fecha real. Explorar
no muestra herramientas hasta que el usuario selecciona un filtro. El bloque
`JUNTÉMONOS MÁS` se alimenta de `data/identity.json`; no debe reemplazarse por
texto fijo en HTML.

El workflow `pruebas-navegacion-real.yml` instala Chromium y valida carga,
búsqueda, navegación contextual, retorno a Inicio y ausencia de cortes
horizontales en 320, 390, 768 y 1440 px.
