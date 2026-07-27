# Distrito Goo — validación de navegación única v26

Fecha de auditoría: 27 de julio de 2026  
Repositorio contrastado: `sbx-mx/Distrito_Goo`  
CMS validado: `Distrito_Go_CMS_v2_actualizado.xlsx`

## Resultado

- Menú principal único: `Inicio`, `Explorar` y `Guardados`.
- `Buscar` dejó de ser un destino independiente y quedó integrado dentro de `Explorar Distrito Goo`.
- Inicio presenta una sola Rutina diaria y una sola Actividad semanal correspondiente al día.
- Los accesos contextuales se limitan a `Hoy`, `Apertura`, `Personas` y `Semana`.
- `Peak` permanece como palabra clave dentro de Operación y Duty Roster, sin aparecer en el menú principal.
- Las categorías permanecen ocultas inicialmente y se muestran u ocultan con una sola acción.
- Favoritos, recientes, visor interno, contenido operativo, CMS, PWA y rutas de GitHub Pages se conservaron.
- El CMS no requirió cambios.

## Comparativo

| Antes | Después |
|---|---|
| Inicio, Explorar, Buscar y Guardados | Inicio, Explorar y Guardados |
| Buscador visible en Inicio | Buscador dentro de Explorar Distrito Goo |
| Menús y accesos rápidos repetidos | Un solo menú persistente |
| Categorías visibles al entrar | Categorías contraídas inicialmente |
| Rutina y agenda mezcladas con otros bloques | Una Rutina diaria y una Actividad semanal de hoy |
| Contenido operativo visible como una página extensa | Secciones de detalle abiertas bajo demanda |

## Evidencia reproducible

- Validación CMS: 14 hojas, sin errores.
- Búsqueda: 409 elementos indexados.
- Consultas comprobadas: PBT, Maquila, cumpleaños, apertura, café espresso y Duty Roster.
- Validación v26: 49 de 49 controles aprobados.
- Auditoría estática: 0 errores y 0 advertencias.
- Validación de recursos: 0 rutas faltantes.
- Sintaxis: módulos JavaScript y Service Worker aprobados.
- PWA: caché incrementada a `distrito-go-v26.0.0-navegacion-unica`.

## Limitación real

No fue posible ejecutar la inspección visual automatizada porque el entorno no
dispone del ejecutable de Chromium. Debe realizarse una validación visual final
en GitHub Pages, en teléfono y computadora, antes de fusionar o sustituir la
versión publicada.

La conexión de GitHub permitió leer el repositorio, pero rechazó la creación de
la rama con un error 403 de permisos de escritura. El paquete queda listo para
reemplazo manual o para publicarse cuando se habilite la escritura del conector.
