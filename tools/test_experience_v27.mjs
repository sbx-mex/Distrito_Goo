import fs from 'node:fs/promises';

const memory = new Map();
globalThis.localStorage = {
  getItem:key => memory.has(key) ? memory.get(key) : null,
  setItem:(key, value) => memory.set(key, String(value)),
  removeItem:key => memory.delete(key),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  getElementById:() => null,
  querySelector:() => null,
  querySelectorAll:() => [],
};
globalThis.window = {
  dispatchEvent:() => true,
  matchMedia:() => ({matches:true}),
  setTimeout,
  clearTimeout,
};
globalThis.CustomEvent = class {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

const { state } = await import('../modules/state.js');
const experience = await import('../modules/experience.js');
const search = await import('../modules/search.js');
const operational = JSON.parse(await fs.readFile(new URL('../data/operacional.v10.json', import.meta.url), 'utf8'));
const tools = JSON.parse(await fs.readFile(new URL('../data/herramientas.v10.json', import.meta.url), 'utf8'));
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

state.operacional = operational;
state.herramientas = tools;
state.favorites = [];

const checks = [];
const assert = (name, condition, detail) => {
  checks.push({name, ok:Boolean(condition), detail});
  if(!condition) throw new Error(`${name}: ${detail}`);
};

const catalog = experience.getContentCatalog();
const daily = catalog.filter(item => item.source === 'Actividad diaria');
const partners = catalog.filter(item => item.source === 'Persona');
const index = search.createSearchIndex(catalog);
const sectionIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));

assert('Siete rutinas CMS', daily.length === 7, `${daily.length} rutinas`);
assert('Orden estable de rutinas', daily.map(item => item.title).join('|') === [
  'Verificación Espresso',
  'RSA Checklist',
  'Protocolo de Apertura',
  'Corte de Leche',
  'Store Walk',
  '10 pasos para un turno exitoso',
  'Menu Core',
].join('|'), daily.map(item => item.title).join(', '));
assert('Partners indexados', partners.length > 0, `${partners.length} registros individuales`);

const partner = partners[0];
const exact = search.searchGlobalIndex(partner.title, index);
assert('Búsqueda exacta de Partner', exact[0]?.id === partner.id, partner.title);
assert('Sin duplicado exacto', exact.filter(item => item.id === partner.id).length === 1, partner.id);

const withoutAccents = partner.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const normalized = search.searchGlobalIndex(withoutAccents, index);
assert('Búsqueda sin acentos o mayúsculas', normalized.some(item => item.id === partner.id), withoutAccents);

const withoutDestination = catalog.filter(item => (
  !item.link
  && !item.fullImage
  && !item.imageOriginal
  && !(item.section && sectionIds.has(item.section))
));
assert('Sin acciones sin destino', withoutDestination.length === 0, withoutDestination.map(item => item.id).join(', ') || '0 casos');

const target = daily[0];
experience.toggleSaved(target.id);
assert('Guardar persiste', JSON.parse(memory.get('dgx_saved_content')).includes(target.id), target.id);
experience.toggleSaved(target.id);
assert('Retirar favorito persiste', !JSON.parse(memory.get('dgx_saved_content')).includes(target.id), target.id);

const report = {ok:checks.every(check => check.ok), checks, catalogItems:catalog.length, searchItems:index.length};
const reportFlag = process.argv.indexOf('--report');
if(reportFlag >= 0 && process.argv[reportFlag + 1]){
  await fs.writeFile(process.argv[reportFlag + 1], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
