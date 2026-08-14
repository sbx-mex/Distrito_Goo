import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, app, center, experience, operational, state, search, sw, workflow] = await Promise.all([
  read('index.html'), read('modules/app.js'),
  read('modules/operations-center.js'), read('modules/experience.js'),
  read('modules/operational.js'), read('modules/state.js'), read('modules/search.js'),
  read('sw.js'), read('.github/workflows/distrito-go.yml'),
]);

const checks = [];
const check = (name, ok, detail='') => checks.push({name, ok:Boolean(ok), detail});
check('1. Centro de mando', html.includes('id="command-center"') && html.includes('id="command-center-grid"') && center.includes('renderOperationalCenter'), 'prioridades de hoy');
check('2. Agenda operativa limpia', html.includes('Agenda operativa') && experience.includes('week-day-picker') && !experience.includes('agenda-overview') && !experience.includes('Resto de la semana'), 'selector semanal sin resumen redundante');
check('3. Ruta contextual', html.includes('id="context-trail"') && center.includes('updateContextTrail'), 'volver y conservar contexto');
check('4. Buscador siempre disponible', html.includes('id="header-search"') && center.includes('focusGeneralSearch') && search.includes('createSearchIndex'), 'acceso desde encabezado');
check('5. Perfil por tienda', html.includes('id="store-profile-select"') && state.includes('selectedStore') && operational.includes('matchesSelectedStore'), 'persistente y aplicado');
check('6. Estado diario', experience.includes('completionDateKey') && experience.includes('slice(0,14)') && center.includes('Avance diario'), 'reinicio por fecha');
check('7. Estado técnico no invade la interfaz', !html.includes('id="cms-status"') && !html.includes('id="sync-status"') && !html.includes('id="version-status"') && center.includes('navigator.onLine'), 'solo comunica el modo sin conexión cuando aplica');
check('8. Temporales fuera del HTML', !html.includes('bearista-informativo') && !html.includes('contest-hero') && !html.includes('concurso_venta_dona_julio'), 'CMS como fuente');
check('9. Recursos sin uso eliminados', !html.includes('bearistahugger') && workflow.includes('cleanup_unused.py'), 'limpieza segura');
check('10. Navegación real en CI', ['playwright','test:navigation'].every(token => workflow.includes(token)), 'Chromium y navegación real');
check('11. PWA actualizada', /CACHE_NAME\s*=\s*`\$\{CACHE_PREFIX\}v[\w.-]+`/.test(sw) && sw.includes('staleWhileRevalidate') && sw.includes('./styles/distrito-go.css') && sw.includes('./modules/operations-center.js') && sw.includes('./modules/calendar.js'), 'shell rápido, caché versionado y datos vigentes');
check('12. Encabezado redundante oculto', !html.includes('Distrito Go · Hoy') && !html.includes('Lo importante de hoy') && !html.includes('command-center-summary'), 'inicio directo al centro de mando');
check('13. Informativo sin etiquetas repetidas', !operational.includes('permanent-info-meta') && !operational.includes('validityLabel'), 'sin Importante / Semanal duplicado');
check('14. Arranque observable y estado válido', !operational.includes('state.data.') && operational.includes('state.operacional.eventos') && app.includes("classList.add('app-error')") && app.includes('dataset.bootError'), 'sin rutas inexistentes y con diagnóstico inmediato');

const failed = checks.filter(item => !item.ok);
const report = {ok:!failed.length, generatedAt:new Date().toISOString(), summary:{passed:checks.length-failed.length, failed:failed.length, total:checks.length}, checks};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]) await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if(failed.length) process.exitCode = 1;
