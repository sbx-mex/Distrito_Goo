const BUSINESS_TIME_ZONE = 'America/Mexico_City';
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value){
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function businessDateKey(reference = new Date(), timeZone = BUSINESS_TIME_ZONE){
  if(typeof reference === 'string' && DATE_KEY.test(reference)) return reference;
  const date = validDate(reference) ? reference : new Date(reference);
  if(!validDate(date)) throw new TypeError('La fecha de referencia WFM no es válida.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function utcDate(dateKey){
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date){
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount){
  const output = new Date(date);
  output.setUTCDate(output.getUTCDate() + amount);
  return output;
}

function isoWeek(date){
  const target = new Date(date);
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

export function getWfmPlanningSummary(reference = new Date(), leadDays = 15, locale = 'es-MX'){
  const safeLeadDays = Math.max(1, Number.parseInt(leadDays, 10) || 15);
  const current = utcDate(businessDateKey(reference));
  const planningDate = addDays(current, safeLeadDays);
  const planningDay = planningDate.getUTCDay() || 7;
  const weekStart = addDays(planningDate, 1 - planningDay);
  const weekEnd = addDays(weekStart, 6);
  const formatter = new Intl.DateTimeFormat(locale, {timeZone:'UTC', day:'numeric', month:'long'});
  return {
    leadDays:safeLeadDays,
    week:isoWeek(planningDate),
    range:`${formatter.format(weekStart)} al ${formatter.format(weekEnd)}`,
    start:dateKey(weekStart),
    end:dateKey(weekEnd),
  };
}
