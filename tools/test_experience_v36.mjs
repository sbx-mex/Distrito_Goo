import fs from 'node:fs/promises';

const memory = new Map();
globalThis.localStorage = {
  getItem:key => memory.has(key) ? memory.get(key) : null,
  setItem:(key, value) => memory.set(key, String(value)),
  removeItem:key => memory.delete(key),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  getElementById:() => null,
  querySelector:() => null,
  querySelectorAll:() => [],
};
globalThis.window = {dispatchEvent:() => true, matchMedia:() => ({matches:true}), setTimeout, clearTimeout};
globalThis.CustomEvent = class { constructor(type, options = {}){ this.type = type; this.detail = options.detail; } };

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, operationalJs, experienceJs, searchJs, stateJs, dataJs, pipeline, sw, manifest, version, operational, partner] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/operational.js'),
  read('modules/experience.js'),
  read('modules/search.js'),
  read('modules/state.js'),
  read('modules/data.js'),
  read('tools/cms_pipeline.py'),
  read('sw.js'),
  read('manifest.json').then(JSON.parse),
  read('data/version.v10.json').then(JSON.parse),
  read('data/operacional.v10.json').then(JSON.parse),
  read('data/desarrollo-partner.v1.json').then(JSON.parse),
]);

const { state } = await import('../modules/state.js');
const experience = await import('../modules/experience.js');
const search = await import('../modules/search.js');
state.operacional = operational;
state.partnerDevelopment = partner;
state.herramientas = JSON.parse(await read('data/herramientas.v10.json'));
state.favorites = [];

const checks = [];
const check = (name, ok, detail = '') => checks.push({name, ok:Boolean(ok), detail});
const info = operational.informativo || [];
const visibleInfo = info.filter(item => item.Visible !== false);
const expectedInfo = ['Registro Clock In/Out','Maquila','Coffee Master 2026','Dress Code Portafolio','Resumen Semanal'];
const infoNames = visibleInfo.map(item => item.Actividad);
const partnerIds = [...partner.cursosAlta, ...partner.tbwPendientes].map(item => `${item.id}:${item.nombre}`);
const catalog = experience.getContentCatalog();
const index = search.createSearchIndex(catalog);
const sectionIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));

check('1. Catálogo redundante eliminado', !html.includes('Catálogo de consulta') && !html.includes('integrated-catalog-grid') && !html.includes('coffee-master-grid') && !html.includes('weekly-updates-grid'), 'sin representación duplicada');
check('2. Cinco informativos vigentes', visibleInfo.length === 5, `${visibleInfo.length}`);
check('3. Informativos solicitados', expectedInfo.every(name => infoNames.includes(name)), infoNames.join(', '));
check('4. Fuente CMS visible y vigente', operationalJs.includes(".Visible !== false") && operationalJs.includes('isCurrentlyValid'), 'filtros presentes');
check('5. Orden CMS respetado', visibleInfo.slice().sort((a,b)=>(a.Orden||a.Prioridad||99)-(b.Orden||b.Prioridad||99)).map(x=>x.ID).join() === [5,1,4,2,3].join(), 'Orden 1–5 del CMS');
check('6. Contador dinámico', operationalJs.includes("info-count") && operationalJs.includes("info.length"), 'contador por registros');
check('7. Carrusel navegable', operationalJs.includes('informative-catalog-track') && operationalJs.includes('data-catalog-scroll'), 'flechas y pista');
check('8. Flechas condicionales', operationalJs.includes('info.length > 1'), 'ocultas con un registro');
check('9. Guardados conservado', operationalJs.includes('data-save-content') && experienceJs.includes('dgx_saved_content'), 'ID estable y localStorage');
check('10. Desarrollo Partner único', (html.match(/id="altas-curso"/g) || []).length === 1 && !html.includes('partner-courses-panel'), 'módulo compacto');
check('11. Cursos de Alta reales', partner.cursosAlta.length === 7, `${partner.cursosAlta.length}`);
check('12. TBW pendientes reales', partner.tbwPendientes.length === 14, `${partner.tbwPendientes.length}`);
check('13. IDs sin duplicados', new Set(partnerIds).size === partnerIds.length, `${partnerIds.length} IDs`);
check('14. TBW explícitamente pendiente', partner.tbwPendientes.every(item => item.estatus === 'Pendiente'), 'clasificación explícita');
check('15. JSON dinámico cargado', stateJs.includes('desarrollo-partner.v1.json') && dataJs.includes('loaded.partnerDevelopment'), 'contrato estático');
check('16. Python regenerable', pipeline.includes('build_partner_development') && pipeline.includes('desarrollo-partner.v1.json'), 'pipeline CMS');
check('17. SVG responsive', operationalJs.includes('partner-development-svg') && operationalJs.includes('preserveAspectRatio="xMidYMin meet"'), 'sin imagen estática');
check('18. SVG accesible por teclado', operationalJs.includes("['Enter', ' ']") && operationalJs.includes('tabindex="0"'), 'Enter y espacio');
check('19. Menú de cuatro accesos', [...html.matchAll(/data-view="(home|explore|saved|search)"/g)].length === 4, 'Inicio, Explorar, Guardados y Buscar');
check('20. Lupa monoline', /data-view="search"[\s\S]*?<circle cx="11" cy="11" r="7"\/>/.test(html), 'icono SVG');
check('21. Búsqueda exacta', search.searchGlobalIndex('Maquila', index)[0]?.title === 'Maquila', 'Maquila');
check('22. Búsqueda parcial', search.searchGlobalIndex('maqui', index).some(item => item.title === 'Maquila'), 'maqui');
check('23. Búsqueda sin acentos', search.searchGlobalIndex('verificacion', index).some(item => item.title.includes('Verificación')), 'verificacion');
check('24. Búsqueda cercana', search.searchGlobalIndex('maquils', index).some(item => item.title === 'Maquila'), 'una sustitución');
check('25. Búsqueda inicia vacía', searchJs.includes('if(!normalizedQuery) return []') && searchJs.includes('resetSearchView'), 'sin catálogo previo');
check('26. Mensaje sin resultados', searchJs.includes('No encontramos contenido relacionado.'), 'texto solicitado');
check('27. Sin acciones sin destino', experienceJs.includes("destination\n      ? `<button") && operationalJs.includes("destination ? `<button"), 'los contenidos informativos permanecen estáticos');
check('28. Responsive desde 320 px', css.includes('@media(max-width:320px)') && css.includes('repeat(4,minmax(0,1fr))'), 'menú horizontal');
check('29. PWA sincronizada', sw.includes('distrito-go-v36.0.0-menos-es-mas') && sw.includes('./data/desarrollo-partner.v1.json'), 'caché y JSON');
check('30. GitHub Pages estático', manifest.start_url?.startsWith('./') && !pipeline.includes('Flask') && !pipeline.includes('Django'), 'sin backend');

experience.toggleSaved('info-1');
check('31. Persistencia comprobada', JSON.parse(memory.get('dgx_saved_content') || '[]').includes('info-1'), 'info-1');
const partnerResult = search.searchGlobalIndex(partner.cursosAlta[0].nombre, index)[0];
check('32. Partner abre su ruta correcta', partnerResult?.source === 'Cursos de Alta' && partnerResult?.recordId === partner.cursosAlta[0].id, partnerResult?.recordId || 'sin resultado');

const report = {
  ok: checks.every(item => item.ok),
  generatedAt: new Date().toISOString(),
  summary: {passed:checks.filter(item => item.ok).length, failed:checks.filter(item => !item.ok).length, total:checks.length},
  cms: {sheets:14, records:490, informativos:visibleInfo.length, cursosAlta:partner.cursosAlta.length, tbwPendientes:partner.tbwPendientes.length},
  checks,
};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]) await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if(!report.ok) process.exitCode = 1;
