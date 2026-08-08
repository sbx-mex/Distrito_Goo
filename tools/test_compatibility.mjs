import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, operationalJs, experienceJs, searchJs, pipeline, workflow, sw, partner] = await Promise.all([
  read('index.html'),
  read('styles/distrito-go.css'),
  read('modules/operational.js'),
  read('modules/experience.js'),
  read('modules/search.js'),
  read('tools/cms_pipeline.py'),
  read('.github/workflows/distrito-go.yml'),
  read('sw.js'),
  read('data/desarrollo-partner.v1.json').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail = '') => checks.push({name, ok:Boolean(ok), detail});
const alta = partner.vistas?.alta;
const tbw = partner.vistas?.tbw;
const sumGroups = view => view?.grupos?.reduce((sum, group) => sum + group.total, 0);
const flattened = view => view?.grupos?.flatMap(group => group.partners) || [];

check('1. JSON conserva las dos rutas', Boolean(alta && tbw), 'Alta y TBW');
check('2. Alta reconciliada con CMS', alta?.total === partner.cursosAlta.length, `${alta?.total}/${partner.cursosAlta.length}`);
check('3. TBW reconciliado con CMS', tbw?.total === partner.tbwPendientes.length, `${tbw?.total}/${partner.tbwPendientes.length}`);
check('4. Tiendas de Alta reconciliadas', alta?.tiendas === alta?.grupos?.length, `${alta?.tiendas}`);
check('5. Tiendas TBW reconciliadas', tbw?.tiendas === tbw?.grupos?.length, `${tbw?.tiendas}`);
check('6. Totales Alta reconciliados', sumGroups(alta) === alta?.total, `${sumGroups(alta)}`);
check('7. Totales TBW reconciliados', sumGroups(tbw) === tbw?.total, `${sumGroups(tbw)}`);
check('8. Programas Alta reconciliados', Object.values(alta?.programas || {}).reduce((sum, value) => sum + value, 0) === alta?.total, JSON.stringify(alta?.programas));
check('9. Progreso TBW reconciliado', (tbw?.progreso?.sinIniciar || 0) + (tbw?.progreso?.enCurso || 0) === tbw?.total, JSON.stringify(tbw?.progreso));
check('10. Periodo Alta dinámico', alta?.total === 0 || Boolean(alta?.periodo), alta?.periodo);
check('11. Corte TBW dinámico', tbw?.total === 0 || /^\d{4}-\d{2}-\d{2}$/.test(tbw?.corte || ''), tbw?.corte);
check('12. Nombres normalizados', [...flattened(alta), ...flattened(tbw)].every(item => item.nombre && !/\s{2,}/.test(item.nombre)), 'sin dobles espacios');
const allPartners = [...flattened(alta), ...flattened(tbw)];
check('13. IDs reales conservados', allPartners.every(item => item.id) && new Set(allPartners.map(item => item.id)).size === allPartners.length, `${allPartners.length} IDs únicos`);
check('14. Pestañas semánticas', html.includes('role="tablist"') && (html.match(/role="tab"/g) || []).length === 2 && html.includes('role="tabpanel"'), 'tablist, tabs y panel');
check('15. Vista informativa sin interacción por Partner', !operationalJs.includes('data-partner-record') && !operationalJs.includes('partner-svg-row'), 'sin clic por registro');
check('16. Metadatos repetidos eliminados', operationalJs.includes('Información agrupada por tienda') && !operationalJs.includes('Corte ${item.fecha}'), 'corte y actualización globales');
check('17. Tarjetas agrupadas por tienda', operationalJs.includes('partner-store-card') && operationalJs.includes('partner-store-grid'), 'agrupación visual');
check('18. Retícula equivalente en escritorio', css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'), 'tres columnas');
check('19. Retícula responsive', css.includes('@media(max-width:580px)') && css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'dos columnas en móvil amplio');
check('20. Generación dinámica desde CMS', pipeline.includes('"vistas":') && pipeline.includes('group_partners_by_store') && pipeline.includes('clean_partner_text'), 'Python CMS');
check('21. Datos legados conservados', Array.isArray(partner.cursosAlta) && Array.isArray(partner.tbwPendientes), 'compatibilidad de búsqueda');
check('22. PWA sincronizada', sw.includes('distrito-go-') && sw.includes('v49.0.0-interfaz-limpia') && sw.includes('./styles/distrito-go.css') && sw.includes('./data/desarrollo-partner.v1.json') && sw.includes('./modules/search.js') && sw.includes('./modules/operations-center.js'), 'caché v49 y CSS consolidado');
check('23. Workflow sostenible', workflow.includes('cms_release.py') && workflow.includes('cleanup_unused.py') && workflow.includes('test:navigation'), 'publicación, limpieza y navegación en un flujo');
check('24. Menú principal simplificado', [...html.matchAll(/data-view="(home|explore|saved)"/g)].length === 3 && !html.includes('data-view="search"') && html.includes('global-search-panel'), 'Inicio, Explorar y Guardados; buscador dentro de Explorar');
check('25. Celebraciones oculto en Explorar', !experienceJs.includes("id:'section-celebrations'"), 'sin tarjeta Celebraciones que abra una vista vacía');
check('26. Destino único reutilizable', experienceJs.includes('export function hasDestination') && searchJs.includes('hasDestination(item)'), 'misma regla para catálogo y búsqueda');
check('27. Contenido sin recurso informativo', experienceJs.includes("eventActionType:item.TipoAccion") && experienceJs.includes("section:'', access:/inventario/") && experienceJs.includes("section:'', access:item['Acceso Rápido'] || 'Hoy'"), 'eventos y actividades sin sección heredada');
check('28. Texto inicial redundante oculto', !html.includes('Busca información del CMS') && !html.includes('Escribe una palabra para consultar solo resultados'), 'buscador limpio');
check('29. Subtítulo informativo oculto', !html.includes('Consulta los contenidos vigentes publicados desde el CMS.'), 'encabezado compacto');
check('30. Herramientas antes que filtros', html.indexOf('class="tools-section"') < html.indexOf('class="categories-section"'), 'las herramientas filtradas aparecen arriba');
check('31. Herramientas permanecen ocultas', /<section class="tools-section"[^>]*hidden>/.test(html), 'se revelan solo al elegir un filtro');
check('32. Guardado solo con destino', experienceJs.includes("actionable ? savedButtonMarkup") && experienceJs.includes("destination ? savedButtonMarkup"), 'sin favoritos para tarjetas informativas');

const report = {
  ok:checks.every(item => item.ok),
  generatedAt:new Date().toISOString(),
  summary:{
    passed:checks.filter(item => item.ok).length,
    failed:checks.filter(item => !item.ok).length,
    total:checks.length,
  },
  cms:{
    cursosAlta:partner.cursosAlta.length,
    tbwPendientes:partner.tbwPendientes.length,
    tiendasAlta:alta?.tiendas,
    tiendasTbw:tbw?.tiendas,
  },
  checks,
};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]){
  await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if(!report.ok) process.exitCode = 1;
