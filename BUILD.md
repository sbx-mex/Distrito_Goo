# Build y despliegue — experiencia personalizada v27

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
```

Publicar la raíz del repositorio desde `main` con **GitHub Pages · Deploy from a branch** y conservar `.nojekyll`. El service worker instala la nueva versión en espera y sólo se activa cuando el usuario selecciona **Actualizar**.

Al reemplazar `Distrito_Go_CMS_v2_actualizado.xlsx` en la raíz, `.github/workflows/actualizar-cms.yml` valida las 14 pestañas, genera WebP y miniaturas para imágenes pesadas, regenera los JSON, comprueba rutas y publica el resultado. Los nombres de imagen se leen desde el CMS; no es necesario editar `index.html`.

`resumen_comunicado_semana_actual.png` conserva su nombre, original y estrategia `network-first`; el Inicio utiliza su miniatura WebP y el visor presenta el recurso completo. Las demás imágenes generadas incluyen una versión por contenido en los JSON para evitar caché obsoleta.

La versión limpia es la experiencia oficial. El workflow temporal
`.github/workflows/limpieza-auditada.yml` debe retirarse porque la limpieza
autorizada ya finalizó; conservar únicamente `actualizar-cms.yml`.

La búsqueda global se genera dentro de `Explorar Distrito Goo` con los JSON ya
cargados. No requiere una columna adicional ni cambios en el CMS. `Peak` se
conserva como palabra clave operativa de Duty Roster, agrupada bajo `Operación`,
y ya no se muestra como acceso principal. El menú único contiene Inicio,
Explorar y Guardados.

La vista Personas excluye del renderizado los registros individuales de Partners,
pero conserva esos nombres en el índice global. Rutina diaria utiliza un catálogo
horizontal sin reproducción automática. Favoritos se guarda localmente mediante
IDs estables y se sincroniza entre catálogo, búsqueda, detalle y Guardados.
