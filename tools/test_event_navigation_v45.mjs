import fs from 'node:fs';

const app = fs.readFileSync('modules/app.js', 'utf8');
const experience = fs.readFileSync('modules/experience.js', 'utf8');
const operational = fs.readFileSync('modules/operational.js', 'utf8');
const events = JSON.parse(fs.readFileSync('data/eventos.v10.json', 'utf8'));
const checks = [];
const check = (name, ok) => checks.push({name, ok:Boolean(ok)});

const eco = events.find(item => /eco/i.test(item.Actividad || ''));
const destinationBody = app.slice(app.indexOf('function openContentDestination'), app.indexOf('function openContentDetail'));
check('ECO existe en eventos', eco);
check('ECO conserva enlace Slik Pro', eco?.Link === 'https://app.slikpro.com/login/alsea');
check('ECO conserva imagen de apoyo', /eco_2026\.(?:jpe?g|webp)/i.test(eco?.ImagenOriginal || eco?.ImagenPath || ''));
check('Enlace tiene prioridad sobre imagen', destinationBody.indexOf('if(link)') < destinationBody.indexOf('if(image'));
check('Enlace abre pestaña segura', destinationBody.includes("window.open(link, '_blank', 'noopener')"));
check('Eventos de Explorar abren destino directo', experience.includes("if(item.source === 'Evento')") && experience.includes("'dgx:open-destination'"));
check('URLs abreviadas se rechazan', app.includes("text.includes('...')") && experience.includes("text.includes('...')") && operational.includes("text.includes('...')"));
check('Eventos sin destino son informativos', operational.includes("destination.kind === 'informative'") && operational.includes('event-card-main is-static'));
check('Eventos con enlace no abren detalle', operational.includes("new CustomEvent('dgx:open-destination'") && !operational.includes("section:'eventos-cms'"));
check('Caché actualizado', fs.readFileSync('sw.js', 'utf8').includes('v46.0.0-informativos-visuales'));

for(const item of checks) console.log(`${item.ok ? 'OK' : 'FALLO'} ${item.name}`);
const failed = checks.filter(item => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} controles de navegación de eventos aprobados.`);
if(failed.length) process.exit(1);
