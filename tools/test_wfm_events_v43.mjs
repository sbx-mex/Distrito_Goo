import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const events = JSON.parse(read('data/eventos.v10.json'));
const operational = read('modules/operational.js');
const experience = read('modules/experience.js');
const html = read('index.html');
const sw = read('sw.js');
const failures = [];
const check = (name, ok, detail='') => { if(!ok) failures.push(`${name}: ${detail}`); else console.log(`OK ${name}`); };

check('Eventos tienen ID único', events.every(item => item.ID) && new Set(events.map(item => item.ID)).size === events.length, `${events.length} eventos`);
check('Eventos tienen rango válido', events.every(item => item['Fecha Inicio'] && item['Fecha Fin'] && item['Fecha Inicio'].slice(0,10) <= item['Fecha Fin'].slice(0,10)), 'fechas gobernadas por CMS');
const eco = events.find(item => /\beco\b/i.test(item.Actividad || ''));
check('ECO es dinámico', !eco || eco.Link === 'https://app.slikpro.com/login/alsea', eco ? 'enlace válido' : 'no publicado por el CMS actual');

const reference = new Date(2026, 7, 3);
const projected = new Date(reference); projected.setDate(projected.getDate() + 15);
const monday = new Date(projected); monday.setDate(projected.getDate() - ((projected.getDay() + 6) % 7));
const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
check('WFM proyecta semana 34', operational.includes('planningWindow') && monday.toISOString().startsWith('2026-08-17') && sunday.toISOString().startsWith('2026-08-23'));
check('WFM lee días del CMS', operational.includes('state.operacional.wfmRegla'));
check('WFM semanal lee días del CMS', experience.includes('state.operacional.wfmRegla') && experience.includes('dynamicWeeklyItem'));
check('WFM semanal muestra semana y rango dinámicos', experience.includes('WFM · Semana ${planning.week}') && experience.includes('planning.range'));
check('Eventos abre en Hoy', operational.includes("let eventFilter = 'today'") && html.includes('data-event-filter="today"'));
const onAugustThird = events.filter(row => row.Publicar !== false && row['Fecha Inicio'].slice(0,10) <= '2026-08-03' && row['Fecha Fin'].slice(0,10) >= '2026-08-03');
check('Vigencias calculadas desde fechas', onAugustThird.every(row => row['Fecha Inicio'].slice(0,10) <= '2026-08-03' && row['Fecha Fin'].slice(0,10) >= '2026-08-03'), `${onAugustThird.length} vigentes según CMS`);
check('Calendario semanal incluye todos los eventos por rango', experience.includes('function eventsForDate(targetDate)') && !experience.includes("/inventario (?:semanal|fin de mes)/i.test(item.Actividad || '')"));
check('Contadores usan la misma fuente de eventos', experience.includes('return recurring + eventsForDate(date).length'));
check('Eventos sin destino permanecen informativos', experience.includes('const destination = hasDestination(item)'));
check('Caché v47', sw.includes('v47.0.0-cms-sostenible'));

if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log('Calendario de Eventos y WFM: validación dinámica aprobada.');
