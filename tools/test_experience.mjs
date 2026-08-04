import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, center, experience, operational, state, search, sw, visualWorkflow, cleanupWorkflow] = await Promise.all([
  read('index.html'), read('modules/operations-center.js'), read('modules/experience.js'),
  read('modules/operational.js'), read('modules/state.js'), read('modules/search.js'),
  read('sw.js'), read('.github/workflows/pruebas-navegacion-real.yml'),
  read('.github/workflows/depurar-proyecto.yml'),
]);

const checks = [];
const check = (name, ok, detail='') => checks.push({name, ok:Boolean(ok), detail});
check('1. Centro de mando', html.includes('id="command-center"') && html.includes('id="command-center-grid"') && center.includes('renderOperationalCenter'), 'prioridades de hoy');
check('2. Agenda operativa', html.includes('Agenda operativa') && experience.includes('agenda-overview') && experience.includes('Resto de la semana'), 'hoy, mañana y resto');
check('3. Ruta contextual', html.includes('id="context-trail"') && center.includes('updateContextTrail'), 'volver y conservar contexto');
check('4. Buscador siempre disponible', html.includes('id="header-search"') && center.includes('focusGeneralSearch') && search.includes('createSearchIndex'), 'acceso desde encabezado');
check('5. Perfil por tienda', html.includes('id="store-profile-select"') && state.includes('selectedStore') && operational.includes('matchesSelectedStore'), 'persistente y aplicado');
check('6. Estado diario', experience.includes('completionDateKey') && experience.includes('slice(0,14)') && center.includes('Avance diario'), 'reinicio por fecha');
check('7. Vigencia visible', html.includes('id="cms-status"') && center.includes('cmsBuild?.generatedAt') && center.includes('navigator.onLine'), 'CMS, conexión y versión');
check('8. Temporales fuera del HTML', !html.includes('bearista-informativo') && !html.includes('contest-hero') && !html.includes('concurso_venta_dona_julio'), 'CMS como fuente');
check('9. Recursos sin uso eliminados', !html.includes('bearistahugger') && cleanupWorkflow.includes('ELIMINAR_ARCHIVOS_HUERFANOS'), 'limpieza segura');
check('10. Navegación real en CI', ['320','390','768','1440','playwright'].every(token => visualWorkflow.includes(token)), 'cuatro anchos y Chromium');
check('11. PWA actualizada', sw.includes('v48.0.0-operativo-sostenible') && sw.includes('./styles/distrito-go.css') && sw.includes('./modules/operations-center.js'), 'shell completo');

const failed = checks.filter(item => !item.ok);
const report = {ok:!failed.length, generatedAt:new Date().toISOString(), summary:{passed:checks.length-failed.length, failed:failed.length, total:checks.length}, checks};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]) await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if(failed.length) process.exitCode = 1;
