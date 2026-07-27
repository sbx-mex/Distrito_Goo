# Build y despliegue — experiencia visual v23

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

La experiencia nueva es la predeterminada. Para comparación temporal:

```text
?vista=clasica
```

Para regresar a la versión oficial:

```text
?vista=nueva
```
