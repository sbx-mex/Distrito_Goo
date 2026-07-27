import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, app, experience, sw, version, operational] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/app.js'),
  read('modules/experience.js'),
  read('sw.js'),
  read('data/version.v10.json').then(JSON.parse),
  read('data/operacional.v10.json').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail = '') => checks.push({name, ok:Boolean(ok), detail});
const mondayRoster = operational.dutyRoster?.find(item => item['Día'] === 'Lunes');
const mondayDetails = operational.dutyDetail?.filter(item => item['Día'] === 'Lunes') || [];
const mondayCritical = mondayDetails.filter(item => item['Crítico'] === true).length;
const mondayStations = [...new Set(mondayDetails.map(item => item.Estación))];

check('Versión v34', version.version === '34.0.0' && version.runtimeFix === 'v34.0.0', `${version.version} / ${version.runtimeFix}`);
check('Caché v34', sw.includes('distrito-go-v34.0.0-duty-inmersivo'), 'Service Worker actualizado');
check('Recursos versionados', html.includes('navigation-v26.css?v=34.0.0') && html.includes('app.js?v=34.0.0'), 'CSS y entrada JS');
check('Duty lunes', mondayRoster?.Estaciones === 'Food, Show Case', mondayRoster?.Estaciones || '');
check('Nueve puntos lunes', mondayDetails.length === 9, `${mondayDetails.length} puntos`);
check('Cuatro críticos lunes', mondayCritical === 4, `${mondayCritical} críticos`);
check('Dos estaciones lunes', mondayStations.length === 2 && mondayStations.includes('Food') && mondayStations.includes('Show Case'), mondayStations.join(', '));
check('Enfoque lunes', mondayRoster?.Enfoque === 'Seguridad alimentaria, caducidades, refrigeración y preparación de alimentos.', mondayRoster?.Enfoque || '');
check('Guía visual real', experience.includes('data-image-viewer=') && experience.includes('ImagenesOriginales'), 'recurso original del CMS');
check('Visor contain', css.includes('.image-viewer-media') && css.includes('object-fit:contain!important'), 'imagen completa');
check('Ampliación opcional', app.includes('data-image-zoom') && css.includes('.image-viewer-stage.is-zoomed'), 'lectura detallada sin cambiar el original');
check('Duty modal dinámico', experience.includes('dgx:open-duty-detail') && app.includes("window.addEventListener('dgx:open-duty-detail'"), 'sin desplazamiento a otra sección');
check('Una estación seleccionada', app.includes('data-duty-station-panel') && app.includes('aria-pressed') && app.includes('dutyStationPanelMarkup'), 'panel único');
check('SVG por estación', app.includes('DUTY_STATION_SCENES') && app.includes('dutyStationScene(station)'), 'ilustración contextual');
check('Datos desde CMS', app.includes('state.operacional.dutyRoster') && app.includes('state.operacional.dutyDetail'), 'sin actividades fijas');
check('Responsive móvil', css.includes('@media(max-width:700px)') && css.includes('scroll-snap-type:x mandatory'), 'selector adaptable');
check('Menú horizontal conservado', css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'), 'Inicio, Explorar y Guardados');

const report = {
  ok: checks.every(item => item.ok),
  generatedAt: new Date().toISOString(),
  summary: {
    passed: checks.filter(item => item.ok).length,
    failed: checks.filter(item => !item.ok).length,
    total: checks.length
  },
  checks
};

const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]){
  await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if(!report.ok) process.exitCode = 1;
