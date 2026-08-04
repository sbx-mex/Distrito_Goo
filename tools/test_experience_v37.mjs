import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, operationalJs, experienceJs, searchJs, pipeline, workflow, sw, partner] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/operational.js'),
  read('modules/experience.js'),
  read('modules/search.js'),
  read('tools/cms_pipeline.py'),
  read('.github/workflows/actualizar-cms.yml'),
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
check('2. Alta conserva siete Partners', alta?.total === 7 && partner.cursosAlta.length === 7, `${alta?.total}`);
check('3. TBW conserva catorce Partners', tbw?.total === 14 && partner.tbwPendientes.length === 14, `${tbw?.total}`);
check('4. Alta agrupada en cuatro tiendas', alta?.tiendas === 4 && alta.grupos.length === 4, `${alta?.tiendas}`);
check('5. TBW agrupado en seis tiendas', tbw?.tiendas === 6 && tbw.grupos.length === 6, `${tbw?.tiendas}`);
check('6. Totales Alta reconciliados', sumGroups(alta) === alta?.total, `${sumGroups(alta)}`);
check('7. Totales TBW reconciliados', sumGroups(tbw) === tbw?.total, `${sumGroups(tbw)}`);
check('8. Programas Alta reconciliados', alta?.programas?.BT === 6 && alta?.programas?.SS === 1, JSON.stringify(alta?.programas));
check('9. Progreso TBW reconciliado', tbw?.progreso?.sinIniciar === 13 && tbw?.progreso?.enCurso === 1, JSON.stringify(tbw?.progreso));
check('10. Periodo Alta agrupado', alta?.periodo === 'Julio', alta?.periodo);
check('11. Corte TBW agrupado', tbw?.corte === '2026-07-20', tbw?.corte);
check('12. Nombres normalizados', [...flattened(alta), ...flattened(tbw)].every(item => item.nombre && !/\s{2,}/.test(item.nombre)), 'sin dobles espacios');
check('13. IDs reales conservados', new Set([...flattened(alta), ...flattened(tbw)].map(item => item.id)).size === 21, '21 IDs');
check('14. Pestañas semánticas', html.includes('role="tablist"') && (html.match(/role="tab"/g) || []).length === 2 && html.includes('role="tabpanel"'), 'tablist, tabs y panel');
check('15. Vista informativa sin interacción por Partner', !operationalJs.includes('data-partner-record') && !operationalJs.includes('partner-svg-row'), 'sin clic por registro');
check('16. Metadatos repetidos eliminados', operationalJs.includes('Información agrupada por tienda') && !operationalJs.includes('Corte ${item.fecha}'), 'corte y actualización globales');
check('17. Tarjetas agrupadas por tienda', operationalJs.includes('partner-store-card') && operationalJs.includes('partner-store-grid'), 'agrupación visual');
check('18. Retícula equivalente en escritorio', css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'), 'tres columnas');
check('19. Retícula responsive', css.includes('@media(max-width:580px)') && css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'), 'dos columnas en móvil amplio');
check('20. Generación dinámica desde CMS', pipeline.includes('"vistas":') && pipeline.includes('group_partners_by_store') && pipeline.includes('clean_partner_text'), 'Python CMS');
check('21. Datos legados conservados', Array.isArray(partner.cursosAlta) && Array.isArray(partner.tbwPendientes), 'compatibilidad de búsqueda');
check('22. PWA sincronizada', sw.includes('distrito-go-') && sw.includes('v46.0.0-informativos-visuales') && sw.includes('./data/desarrollo-partner.v1.json') && sw.includes('./modules/search.js') && sw.includes('./modules/operations-center.js'), 'caché v46 aislado con informativos visuales y destinos validados');
check('23. Workflow actualizado', workflow.includes('test_experience_v37.mjs') && workflow.includes('test_enhancements_v42.mjs') && workflow.includes('reports/v42-enhancements.json'), 'compatibilidad v37 y mejoras v42');
check('24. Menú principal simplificado', [...html.matchAll(/data-view="(home|explore|saved)"/g)].length === 3 && !html.includes('data-view="search"') && html.includes('global-search-panel'), 'Inicio, Explorar y Guardados; buscador dentro de Explorar');
check('25. Celebraciones oculto en Explorar', !experienceJs.includes("id:'section-celebrations'"), 'sin tarjeta Celebraciones que abra una vista vacía');
check('26. Destino único reutilizable', experienceJs.includes('export function hasDestination') && searchJs.includes('hasDestination(item)'), 'misma regla para catálogo y búsqueda');
check('27. Contenido sin recurso informativo', experienceJs.includes("link, section:'', access:/inventario/") && experienceJs.includes("section:'', access:item['Acceso Rápido'] || 'Hoy'"), 'eventos y actividades sin sección heredada');
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
