import fs from 'node:fs';

const app = fs.readFileSync('modules/app.js', 'utf8');
const experience = fs.readFileSync('modules/experience.js', 'utf8');
const operational = fs.readFileSync('modules/operational.js', 'utf8');
const events = JSON.parse(fs.readFileSync('data/eventos.v10.json', 'utf8'));
const checks = [];
const check = (name, ok, detail='') => checks.push({name, ok:Boolean(ok), detail});

check('Cada evento declara una acción', events.every(item => ['Enlace','Imagen','Informativo'].includes(item.TipoAccion)));
check('Enlace requiere destino completo', events.every(item => item.TipoAccion !== 'Enlace' || (/^https?:\/\/[^/\s]+/i.test(item.Link || '') && !String(item.Link).includes('...'))));
check('Imagen requiere recurso gráfico', events.every(item => item.TipoAccion !== 'Imagen' || /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(item.ImagenOriginal || item.ImagenPath || '')));
check('Informativo no se vuelve botón', operational.includes("return {kind:'informative'") && operational.includes("destination.kind === 'informative'") && operational.includes('event-card-main is-static'));
check('Informativo conserva panorama visual', operational.includes('const media = e.MiniaturaPath || e.ImagenPath') && operational.includes('event-card-media'));
check('Explorar respeta TipoAccion', experience.includes('eventActionType:item.TipoAccion') && experience.includes("eventAction === 'informativo'"));
check('Enlace abre pestaña segura', app.includes("window.open(link, '_blank', 'noopener')"));
check('URLs abreviadas se rechazan en interfaz', app.includes("text.includes('...')") && experience.includes("text.includes('...')") && operational.includes("text.includes('...')"));

const unicorn = events.filter(item => /unicorn/i.test(item.Actividad || ''));
const unicornMedia = unicorn.filter(item => item.TipoAccion === 'Imagen');
const unicornCampaign = unicorn.find(item => item.TipoAccion === 'Enlace' && String(item.Link || '').includes('Manual_Recetario'));
check('Calendario integra las tres piezas visuales Unicorn', unicornMedia.length === 3, `${unicornMedia.length}/3 recursos`);
check('Unicorn abre imágenes verificables', unicornMedia.every(item => /\.(?:jpe?g|png)(?:[?#].*)?$/i.test(item.ImagenOriginal || '')));
check('Recursos Unicorn cubren del 8 al 18 de agosto', unicornMedia.every(item => String(item['Fecha Inicio']).startsWith('2026-08-08') && String(item['Fecha Fin']).startsWith('2026-08-18')));
check('Campaña Unicorn enlaza práctica y resultados', Boolean(unicornCampaign) && String(unicornCampaign['Fecha Inicio']).startsWith('2026-08-13') && String(unicornCampaign['Fecha Fin']).startsWith('2026-08-17'));
check('Unicorn se presenta como prioridad verde', operational.includes('/referente operativo|unicorn/i') && experience.includes("title.includes('unicorn')"));

for(const item of checks) console.log(`${item.ok ? 'OK' : 'FALLO'} ${item.name}${item.detail ? ` · ${item.detail}` : ''}`);
const failed = checks.filter(item => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} controles de navegación aprobados.`);
if(failed.length) process.exit(1);
