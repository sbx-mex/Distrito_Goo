import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const events = JSON.parse(read('data/eventos.v10.json'));
const operational = read('modules/operational.js');
const experience = read('modules/experience.js');
const failures = [];
const check = (name, ok, detail='') => ok ? console.log(`OK ${name}`) : failures.push(`${name}: ${detail}`);

check('Eventos tienen ID único', events.every(item => item.ID) && new Set(events.map(item => item.ID)).size === events.length, `${events.length} eventos`);
check('Eventos tienen rango válido', events.every(item => item['Fecha Inicio'] && item['Fecha Fin'] && item['Fecha Inicio'].slice(0,10) <= item['Fecha Fin'].slice(0,10)), 'fechas gobernadas por CMS');
check('Acciones gobernadas por CMS', events.every(item => ['Enlace','Imagen','Informativo'].includes(item.TipoAccion)), 'TipoAccion obligatorio');
check('Enlaces completos', events.every(item => item.TipoAccion !== 'Enlace' || (/^https?:\/\/[^/\s]+/i.test(item.Link || '') && !String(item.Link).includes('...'))), 'sin URL abreviadas');
check('Planeación usa anticipación del CMS', operational.includes('planningLeadDays()') && operational.includes('state.operacional.wfmRegla'));
check('Planeación calcula semana en ejecución', operational.includes('planningWindow(today, leadDays)') && operational.includes('getWeekNumber(planningDate)'));
check('Calendario semanal usa rango de cada evento', experience.includes('function eventsForDate(targetDate)') && experience.includes("item['Fecha Inicio']") && experience.includes("item['Fecha Fin']"));
check('WFM semanal calcula rango sin fecha fija', experience.includes('function wfmPlanningSummary(reference = new Date())') && !experience.includes('Semana 34'));
check('Agenda semanal sin contadores redundantes', experience.includes('week-day-picker') && !experience.includes('return recurring + eventsForDate(date).length') && !experience.includes('agenda-overview'));

if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log(`Calendario dinámico aprobado con ${events.length} eventos del CMS.`);
