import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, experience, dataModule, css, weekly, daily] = await Promise.all([
  fs.readFile(new URL('index.html', root), 'utf8'),
  fs.readFile(new URL('modules/experience.js', root), 'utf8'),
  fs.readFile(new URL('modules/data.js', root), 'utf8'),
  fs.readFile(new URL('styles/navigation-v26.css', root), 'utf8'),
  fs.readFile(new URL('data/actividades-semanales.v10.json', root), 'utf8').then(JSON.parse),
  fs.readFile(new URL('data/actividades-diarias.v10.json', root), 'utf8').then(JSON.parse),
]);

const checks = [];
const check = (name, ok, detail) => checks.push({name, ok:Boolean(ok), detail});
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));

check('Rutinas completas del CMS', daily.length === 7, `${daily.length} registros`);
check('Semana completa del CMS', weekly.length === 15, `${weekly.length} registros`);
check('Lunes conserva sus actividades', weekly.filter(item => item['Día'] === 'Lunes').length === 6, `${weekly.filter(item => item['Día'] === 'Lunes').length} registros`);
check('Catálogo diario de una tarjeta', /\.daily-routine-card\s*\{[\s\S]*?flex:0 0 100%/.test(css), 'cada rutina ocupa el 100% del visor');
check('Catálogo semanal de una tarjeta', /\.weekly-catalog-track>\.home-focus-card-shell\s*\{[\s\S]*?flex:0 0 100%/.test(css), 'cada actividad ocupa el 100% del visor');
check('Controles independientes', experience.includes("bindCatalog('daily')") && experience.includes("bindCatalog('weekly')"), 'Hoy y Semana');
check('Flechas accesibles', (experience.match(/<button[^>]+data-catalog-scroll=/g) || []).length === 4, '4 controles');
check('Guardados sin valores predeterminados', /state\.favorites = \[\]/.test(dataModule), 'inicio vacío');
check('Limpieza de favoritos heredados', experience.includes('dgx_saved_clean_v28'), 'migración v28');
check('Instructivo de Guardados', html.includes('Solo lo que tú elijas aparecerá aquí.'), 'visible');
check('Buscador general conservado', ids.has('general-search-input') && ids.has('global-search-results'), 'entrada y resultados');
check('Destino operativo conservado', ids.has('dia-a-dia') && experience.includes("section:'dia-a-dia'"), 'Ir a la sección');
check('Nombre visual consistente', !html.includes('Distrito Goo'), 'Distrito Go');

const report = {ok:checks.every(item => item.ok), checks};
const reportIndex = process.argv.indexOf('--report');
if(reportIndex >= 0 && process.argv[reportIndex + 1]){
  await fs.writeFile(process.argv[reportIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if(!report.ok) process.exitCode = 1;
