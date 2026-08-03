import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const events = JSON.parse(read('data/eventos.v10.json'));
const operational = read('modules/operational.js');
const html = read('index.html');
const sw = read('sw.js');
const failures = [];
const check = (name, ok, detail='') => { if(!ok) failures.push(`${name}: ${detail}`); else console.log(`OK ${name}`); };

const eco = events.find(item => item.ID === 'EVT-049');
check('ECO publicado', Boolean(eco), 'falta EVT-049');
check('ECO vigente', eco?.['Fecha Inicio']?.startsWith('2026-08-01') && eco?.['Fecha Fin']?.startsWith('2026-08-23'));
check('ECO enlaza a Slik Pro', eco?.Link === 'https://app.slikpro.com/login/alsea');
check('ECO tiene tres rutas visuales', /eco_2026\.webp/.test(eco?.ImagenPath || '') && /eco_2026\.thumb\.webp/.test(eco?.MiniaturaPath || '') && /eco_2026\.jpeg/.test(eco?.ImagenOriginal || ''));

const reference = new Date(2026, 7, 3);
const projected = new Date(reference); projected.setDate(projected.getDate() + 15);
const monday = new Date(projected); monday.setDate(projected.getDate() - ((projected.getDay() + 6) % 7));
const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
check('WFM proyecta semana 34', operational.includes('planningWindow') && monday.toISOString().startsWith('2026-08-17') && sunday.toISOString().startsWith('2026-08-23'));
check('WFM lee días del CMS', operational.includes('state.operacional.wfmRegla'));
check('Eventos abre en Hoy', operational.includes("let eventFilter = 'today'") && html.includes('data-event-filter="today"'));
for (const title of ['AutoICA', 'Corte de Nómina']) {
  const item = events.find(row => row.Actividad === title && row['Fecha Inicio'].slice(0,10) <= '2026-08-03' && row['Fecha Fin'].slice(0,10) >= '2026-08-03');
  check(`${title} vigente el 3 de agosto`, Boolean(item));
}
check('Caché v43', sw.includes('v43.0.0-wfm-eventos-eco'));

if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log('WFM y Eventos v43: validación aprobada.');
