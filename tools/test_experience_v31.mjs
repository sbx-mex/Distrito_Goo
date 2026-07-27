import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, experience, app, cards, quickActions, stateModule, sw, weekly, daily, identity, version, events, operational] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/experience.js'),
  read('modules/app.js'),
  read('modules/cards.js'),
  read('modules/quick-actions.js'),
  read('modules/state.js'),
  read('sw.js'),
  read('data/actividades-semanales.v10.json').then(JSON.parse),
  read('data/actividades-diarias.v10.json').then(JSON.parse),
  read('data/identity.json').then(JSON.parse),
  read('data/version.v10.json').then(JSON.parse),
  read('data/eventos.v10.json').then(JSON.parse),
  read('data/operacional.v10.json').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail) => checks.push({name, ok:Boolean(ok), detail});
const navLabels = [...html.matchAll(/class="nav-item[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)].map(match => match[1]);
const trackableFields = ['Verificable','Seguimiento','Permite Check','Check','Completable'];
const trackable = [...daily, ...weekly].filter(item => trackableFields.some(field => ['si','sí','true','1','yes'].includes(String(item[field] ?? '').trim().toLocaleLowerCase('es-MX'))));
const monday = weekly.filter(item => item['Día'] === 'Lunes');
const wfm = weekly.find(item => item.Actividad === 'WFM - Pronóstico');
const greenApron = weekly.find(item => item.Actividad === 'Green Apron Review');

check('Versión v31', version.version === '31.0.0' && version.runtimeFix === 'v31.0.0', `${version.version} / ${version.runtimeFix}`);
check('Navegación exacta', JSON.stringify(navLabels) === JSON.stringify(['Inicio','Explorar','Guardados']), navLabels.join(', '));
check('Menú horizontal centrado', css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important') && css.includes('transform:translateX(-50%)!important'), '3 columnas centradas');
check('Menú horizontal en escritorio', css.includes('body{\n  padding-left:0!important') && /\.bottom-nav\.sidebar-nav\{[\s\S]*?display:grid!important;[\s\S]*?grid-template-columns:repeat\(3/.test(css.slice(css.lastIndexOf('/* v31'))), 'sin barra lateral final');
check('Áreas táctiles', css.includes('min-height:52px!important') && css.includes('min-height:44px'), '44 px o más');
check('Ancho 320 px', css.includes('@media(max-width:360px)') && css.includes('width:calc(100vw - 14px)!important'), 'regla específica');
check('Sin desbordamiento de página', css.includes('overflow-x:hidden') && css.includes('overscroll-behavior-inline:contain'), 'página estable y carruseles contenidos');
check('Estado activo accesible', html.includes('aria-current="page"') && css.includes('.nav-item[aria-current="page"]'), 'atributo y estilo');

check('Rutinas completas', daily.length === 7, `${daily.length} registros`);
check('Semana completa', weekly.length === 15, `${weekly.length} registros`);
check('Lunes completo', monday.length === 6, `${monday.length} actividades`);
check('Siete días visibles', ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].every(day => experience.includes(`'${day}'`)), 'lunes a domingo');
check('Fechas semanales reales', experience.includes("toLocaleDateString('es-MX', {day:'2-digit', month:'short'})") && experience.includes('weekDate(index)'), 'fecha calculada');
check('Día actual resaltado', experience.includes("aria-current=\"date\"") && css.includes('.week-day.is-today::after'), 'Hoy comunicado con texto');
check('Una actividad por posición', css.includes('.weekly-catalog-track>.catalog-cover-card') && css.includes('flex:0 0 100%'), '100% del visor');
check('Semana táctil', experience.includes("picker.addEventListener('touchstart'") && experience.includes("picker.addEventListener('touchend'"), 'gesto entre días');
check('Flechas independientes', (experience.match(/<button type="button" data-catalog-scroll=/g) || []).length === 4, 'Hoy y Semana');
check('Teclado en catálogos', experience.includes("'ArrowLeft'") && experience.includes("'ArrowRight'"), 'flechas de teclado');

check('WFM informativo', wfm && !wfm.Link, 'sin enlace en CMS/JSON');
check('WFM sin destino simulado', experience.includes("section:'', access:'Semana'") && experience.includes("catalog-info-state"), 'tarjeta estática');
check('Green Apron accionable', /^https:\/\/forms\.office\.com\//.test(greenApron?.Link || ''), 'formulario válido');
check('Resolución dinámica de acciones', experience.includes('function hasDestination(item)') && app.includes('function openContentDestination(item, trigger)'), 'sección, imagen o enlace real');
check('Sin href vacío', !/href=["'](?:#|javascript:void\(0\))["']/.test(html + experience), 'sin enlaces simulados');
check('Checks configurables', experience.includes('function isTrackableRow(item)') && experience.includes('data-complete-content'), 'solo por campo explícito');
check('Sin checks falsos actuales', trackable.length === 0, `${trackable.length} actividades verificables declaradas`);
check('Persistencia de checks', experience.includes("const COMPLETED_KEY = 'dgx_completed_activities'") && experience.includes('setJSON(COMPLETED_KEY'), 'almacenamiento local');

check('Explorar inicia oculto', html.includes('class="tools-section" aria-labelledby="tools-title" hidden'), 'herramientas ocultas');
check('Filtros visibles', html.includes('id="category-hubs" class="category-grid skeleton-grid" aria-label="Filtros de herramientas"'), 'categorías disponibles');
check('Mensaje inicial correcto', html.includes('Selecciona un filtro') && html.includes('Las herramientas aparecerán aquí'), 'sin estado vacío prematuro');
check('Filtro explícito', stateModule.includes("categoria: localStorage.getItem('dgx_tool_category') || ''"), 'sin primera categoría automática');
check('Mostrar tras selección', cards.includes('const hasFilter = Boolean(state.categoria)') && quickActions.includes("localStorage.setItem('dgx_tool_category'"), 'selección persistente');
check('Limpiar filtro', html.includes('id="clear-tool-filter"') && app.includes("localStorage.removeItem('dgx_tool_category')"), 'acción disponible');
check('Mensaje sin resultados', cards.includes('No hay herramientas disponibles en esta categoría.'), 'solo después del filtro');

check('Juntémonos integrado', html.includes('id="juntemonos-hero"') && html.includes('id="hero-journey"'), 'hero compacto dinámico');
check('Campaña desde JSON', identity.hero?.campaign?.display === 'JUNTÉMONOS MÁS', identity.hero?.campaign?.display);
check('Ruta completa Juntémonos', identity.hero?.journey?.length === 4 && identity.hero.journey.map(item => item.title).join('|') === 'META|EXPERIENCIA|ACTIVIDAD|RESULTADOS', `${identity.hero?.journey?.length || 0} pasos`);
check('Mensajes y hashtags conservados', identity.hero?.districtMessage?.message && identity.hero?.hashtags?.includes('#GreenApronService'), identity.hero.hashtags.join(', '));
check('JSON UTF-8 y acento', JSON.stringify(identity).includes('JUNTÉMONOS') && !JSON.stringify(identity).includes('\\u00c9'), 'texto legible');
check('Hero sin degradado nuevo', !css.slice(css.lastIndexOf('/* v31')).match(/linear-gradient|radial-gradient/), 'superficies sólidas');

check('Evento nuevo conservado', events.length === 27 && operational.eventos?.length === 27, `${events.length} eventos`);
check('CMS compilado íntegro', operational.actividadesDiarias?.length === 7 && operational.actividadesSemanales?.length === 15, '7 diarias y 15 semanales');
check('Guardados conservado', experience.includes("const SAVED_KEY = 'dgx_saved_content'") && html.includes('Solo lo que tú elijas aparecerá aquí.'), 'sin precarga nueva');
check('Buscador global conservado', html.includes('id="general-search-input"') && html.includes('id="global-search-results"'), 'entrada y resultados');
check('Visor conservado', app.includes('openImageViewer') && html.includes('id="quick-modal"'), 'visor interno');
check('PWA v31', sw.includes("distrito-go-v31.0.0-semana-explorar-juntemonos"), 'caché incrementada');
check('APP_SHELL completo', ['./index.html','./styles/navigation-v26.css','./data/identity.json','./data/operacional.v10.json','./modules/experience.js'].every(path => sw.includes(`'${path}'`)), 'recursos esenciales');
check('GitHub Pages relativo', !/href="\/|src="\//.test(html), 'sin rutas absolutas locales');

const report = {
  ok:checks.every(item => item.ok),
  generatedAt:new Date().toISOString(),
  summary:{passed:checks.filter(item => item.ok).length, failed:checks.filter(item => !item.ok).length, total:checks.length},
  checks
};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]){
  await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if(!report.ok) process.exitCode = 1;
