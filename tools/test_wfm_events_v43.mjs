import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const events = JSON.parse(read('data/eventos.v10.json'));
const operational = read('modules/operational.js');
const experience = read('modules/experience.js');
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
check('WFM semanal lee días del CMS', experience.includes('state.operacional.wfmRegla') && experience.includes('dynamicWeeklyItem'));
check('WFM semanal muestra semana y rango dinámicos', experience.includes('WFM · Semana ${planning.week}') && experience.includes('planning.range'));
check('Eventos abre en Hoy', operational.includes("let eventFilter = 'today'") && html.includes('data-event-filter="today"'));
for (const title of ['AutoICA', 'Corte de Nómina']) {
  const item = events.find(row => row.Actividad === title && row['Fecha Inicio'].slice(0,10) <= '2026-08-03' && row['Fecha Fin'].slice(0,10) >= '2026-08-03');
  check(`${title} vigente el 3 de agosto`, Boolean(item));
}
const onAugustThird = events.filter(row => row.Publicar !== false && row['Fecha Inicio'].slice(0,10) <= '2026-08-03' && row['Fecha Fin'].slice(0,10) >= '2026-08-03');
check('Seis eventos vigentes el 3 de agosto', onAugustThird.length === 6, `${onAugustThird.length} encontrados`);
for (const title of ['ECO 2026 | Referente operativo', 'AutoICA', 'Corte de Nómina', 'Best Talent - Cascada DM - SM', 'Upsize sin costo adicional', 'Concurso de Venta']) {
  check(`${title} integrado al calendario`, onAugustThird.some(row => row.Actividad === title));
}
check('Calendario semanal incluye todos los eventos por rango', experience.includes('function eventsForDate(targetDate)') && !experience.includes("/inventario (?:semanal|fin de mes)/i.test(item.Actividad || '')"));
check('Contadores usan la misma fuente de eventos', experience.includes('return recurring + eventsForDate(date).length'));
check('Eventos sin destino permanecen informativos', experience.includes('const destination = hasDestination(item)'));
check('Caché v46', sw.includes('v46.0.0-informativos-visuales'));

if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log('Calendario de Eventos y WFM v46: validación aprobada.');
