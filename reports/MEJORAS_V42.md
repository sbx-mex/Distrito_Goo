# Distrito Go v42 · Validación de mejoras

## Cambios implementados

1. Centro de mando en Inicio con avance, inventario, vencimientos y Desarrollo Partner.
2. Agenda operativa con Hoy, Mañana, resto de la semana y fechas reales del CMS.
3. Ruta contextual con regreso directo a Inicio.
4. Buscador único disponible desde el encabezado.
5. Perfil de tienda persistente en el dispositivo y aplicado a eventos, personas y celebraciones.
6. Estados de actividades reiniciados por fecha con historial local limitado a 14 días.
7. Estado visible del CMS, conexión y versión instalada.
8. Eliminación del contenido temporal Bearista y del bloque duplicado Concurso de Venta; el concurso vigente permanece en el CMS.
9. Retiro de cinco imágenes sin referencias verificadas y actualización del caché PWA.
10. Workflow Playwright para 320, 390, 768 y 1440 px.

## Evidencia

- CMS: 14 pestañas, 14 tablas y 513 registros; sin errores estructurales o de fórmulas detectados.
- Control integral: consultar `quality-gate-v42.json`.
- Compatibilidad: consultar `v42-compatibility.json`.
- Mejoras v42: consultar `v42-enhancements.json`.
- Limpieza: consultar `unused-files-v42.json`.

La instalación local de Chromium no pudo completarse en el entorno de construcción por bloqueo de su CDN. La prueba real quedó automatizada en GitHub Actions, donde instala Chromium antes de ejecutarse. No se declara como ejecutada localmente.
