import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, experience, operationalModule, sw, version, operational, identity] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/experience.js'),
  read('modules/operational.js'),
  read('sw.js'),
  read('data/version.v10.json').then(JSON.parse),
  read('data/operacional.v10.json').then(JSON.parse),
  read('data/identity.json').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail = '') => checks.push({name, ok:Boolean(ok), detail});
const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

check('Versión v33', version.version === '33.0.0' && version.runtimeFix === 'v33.0.0', `${version.version} / ${version.runtimeFix}`);
check('Caché v33', sw.includes('distrito-go-v33.0.0-navegacion-horizontal'), 'Service Worker actualizado');
check('Recursos versionados', html.includes('navigation-v26.css?v=33.0.0') && html.includes('app.js?v=33.0.0'), 'CSS y entrada JS');
check('Tres destinos', ['Inicio','Explorar','Guardados'].every(label => html.includes(`<span>${label}</span>`)), 'menú completo');
check('Navegación horizontal', css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important') && css.includes('grid-auto-flow:column!important'), 'tres columnas');
check('Centrada dinámicamente', css.includes('inset-inline-start:50%!important') && css.includes('transform:translateX(-50%)!important'), 'centrado');
check('Ancho fluido', css.includes('inline-size:min(560px,calc(100dvw - 20px))!important'), 'viewport dinámico');
check('Sin salto ni desplazamiento', css.includes('white-space:nowrap!important') && css.includes('overflow:hidden!important'), 'etiquetas contenidas');
check('Móvil compacto', css.includes('@media(max-width:320px)'), 'pantallas estrechas');
check('Horizontal apaisado', css.includes('@media(orientation:landscape) and (max-height:520px)'), 'presentación horizontal');
check('Semana CMS completa', operational.actividadesSemanales?.length === 15, `${operational.actividadesSemanales?.length || 0} actividades`);
check('Duty CMS completo', operational.dutyRoster?.length === 7 && days.every(day => operational.dutyRoster.some(item => item['Día'] === day)), `${operational.dutyRoster?.length || 0} días`);
check('Duty Detail completo', operational.dutyDetail?.length === 57, `${operational.dutyDetail?.length || 0} puntos`);
check('Celebraciones CMS completas', operational.celebraciones?.length === 286, `${operational.celebraciones?.length || 0} registros`);
check('Semana inicia en hoy', experience.includes('let selectedWeekDay = todayName()') && experience.includes('selectedWeekDay = todayName()'), 'selección inicial y acceso Semana');
check('Día único por selección', experience.includes("filter(item => normalize(item.dayName) === normalize(selectedWeekDay))"), 'filtrado por día');
check('Siete fechas', experience.includes('weekDate(index)') && days.every(day => experience.includes(`'${day}'`)), 'lunes a domingo');
check('Duty por día', experience.includes('function dutyForDay(day)') && experience.includes('data-week-duty-detail'), 'resumen y destino real');
check('Detalle Duty seleccionado', experience.includes('dgx:show-duty-day') && operationalModule.includes("window.addEventListener('dgx:show-duty-day'") && operationalModule.includes('renderDuty(day)'), 'el detalle respeta el día elegido');
check('Guía Duty real', experience.includes('data-image-viewer=') && experience.includes('ImagenesOriginales'), 'imagen del CMS');
check('Celebraciones semanales', experience.includes('function weeklyCelebrations()') && experience.includes('data-celebration-id'), 'cumpleaños y aniversarios');
check('Hero compacto', css.includes('min-height:82px') && css.includes('font-size:.69rem'), 'cuatro apartados reducidos');
check('Juntémonos íntegro', identity.hero?.campaign?.display === 'JUNTÉMONOS MÁS' && identity.hero?.journey?.length === 4, identity.hero?.campaign?.display || '');
check('Datos offline', sw.includes("'./data/operacional.v10.json'") && sw.includes("'./data/identity.json'"), 'Semana e identidad en caché');

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
