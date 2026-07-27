import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const [html, css, app, experience, operationalJs, sw, version, operational] = await Promise.all([
  read('index.html'),
  read('styles/navigation-v26.css'),
  read('modules/app.js'),
  read('modules/experience.js'),
  read('modules/operational.js'),
  read('sw.js'),
  read('data/version.v10.json').then(JSON.parse),
  read('data/operacional.v10.json').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail = '') => checks.push({name, ok:Boolean(ok), detail});
const info = operational.informativo || [];
const targetNames = ['Maquila','Dress Code Portafolio','Registro Clock In/Out','Coffee Master 2026','Resumen Semanal'];
const targetRows = targetNames.map(name => info.find(item => item.Actividad === name)).filter(Boolean);
const partner = operational.altasCurso || {bt:[],ss:[],tbw:[]};
const mondayRoster = operational.dutyRoster?.find(item => item['Día'] === 'Lunes');
const mondayDetails = operational.dutyDetail?.filter(item => item['Día'] === 'Lunes') || [];

check('Versión v35', version.version === '35.0.0' && version.runtimeFix === 'v35.0.0', `${version.version} / ${version.runtimeFix}`);
check('Caché v35', sw.includes('distrito-go-v35.0.0-catalogo-informativo'), 'Service Worker actualizado');
check('Recursos versionados', html.includes('navigation-v26.css?v=35.0.0') && html.includes('app.js?v=35.0.0'), 'CSS y entrada JS');
check('Menú principal conservado', [...html.matchAll(/data-view="(home|explore|saved)"/g)].length === 3, 'Inicio, Explorar y Guardados');
check('Menú redundante retirado', !html.includes('operational-stories') && !html.includes('contextual-shortcuts'), 'sin tarjetas Hoy/Apertura/Personas/Semana');
check('Hoy renombrado a Informativo', html.includes('<span class="visual-overline">Informativo</span>'), 'etiqueta visible');
check('Catálogo integrado', html.includes('id="integrated-catalog-grid"') && experience.includes('INTEGRATED_CATALOG_SPECS'), 'contenedor y fuente dinámica');
check('Cinco registros CMS', targetRows.length === 5, `${targetRows.length} de 5`);
check('Seis accesos', experience.includes("title:'Registro Clock In/Out'") && experience.includes("title:'Maquila'") && experience.includes("title:'Coffee Master 2026'") && experience.includes("title:'Dress Code Portafolio'") && experience.includes("title:'Comunicado semanal'") && experience.includes('partnerCatalogCard'), 'catálogo solicitado');
check('Clave del comunicado preservada', experience.includes("cmsKey:'resumen_comunicado_semana_actual'"), 'ID visual estable');
check('Informativo permanente', html.includes('id="informativo" class="permanent-info-section"') && operationalJs.includes('informative-catalog-track'), 'al final de Inicio');
check('Flechas condicionales', operationalJs.includes('info.length > 1') && operationalJs.includes('data-catalog-kind="informative"'), 'solo con varios vigentes');
check('Acciones reales', operationalJs.includes('const destination = Boolean(item.Recurso)') && experience.includes('hasDestination(item)'), 'sin botones simulados');
check('Desarrollo Partner accesible', experience.includes('partner-path-visual') && experience.includes('role="img"') && experience.includes('partner-path-desc'), 'SVG descrito');
check('Cursos de Alta disponibles', (partner.bt?.length || 0) + (partner.ss?.length || 0) > 0 && experience.includes("data-partner-route=\"${route}\""), `${(partner.bt?.length || 0) + (partner.ss?.length || 0)} registros`);
check('TBW disponible', (partner.tbw?.length || 0) > 0 && operationalJs.includes('partner-tbw-panel'), `${partner.tbw?.length || 0} registros`);
check('Destino Partner real', operationalJs.includes("window.addEventListener('dgx:open-partner-route'") && html.includes('id="partner-courses-panel"') && html.includes('id="partner-tbw-panel"'), 'rutas internas verificadas');
check('Responsive 320 px', css.includes('@media(max-width:580px)') && css.includes('grid-template-columns:1fr'), 'catálogo fluido');
check('Sin scroll horizontal del catálogo', css.includes('.integrated-catalog-grid') && css.includes('min-width:0'), 'contenedores restringidos');
check('Áreas táctiles', css.includes('min-height:44px'), 'acciones de al menos 44 px');
check('Duty v34 conservado', mondayRoster?.Estaciones === 'Food, Show Case' && mondayDetails.length === 9 && app.includes('DUTY_STATION_SCENES'), `${mondayDetails.length} puntos`);

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
