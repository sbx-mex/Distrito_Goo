import { state } from './state.js';
import { escapeHtml, normalize } from './utils.js';
import { getJSON, setJSON } from './storage.js';
import { toast } from './toast.js';

const SAVED_KEY = 'dgx_saved_content';
const COMPLETED_KEY = 'dgx_completed_activities';
const WEEK_DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const ICONS = {
  today:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 10h18v15H7zM11 6v7m10-7v7M7 15h18"/><path d="m12 20 2 2 5-5"/></svg>',
  opening:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 25h20M9 25V13l7-6 7 6v12"/><path d="M13 25v-7h6v7"/></svg>',
  peak:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 24h20M8 20l5-6 4 3 7-9"/><path d="M19 8h5v5"/></svg>',
  people:'<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="11" r="4"/><circle cx="22" cy="13" r="3"/><path d="M5 25c0-6 3-9 7-9s7 3 7 9m0-7c1-1 2-2 4-2 3 0 5 3 5 7"/></svg>',
  week:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 9h18v16H7zM11 6v6m10-6v6M7 14h18"/><path d="M11 19h3m4 0h3"/></svg>'
};
function safeId(prefix, value){
  return `${prefix}-${normalize(value || 'item').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}
function asBoolean(value, fallback = true){
  if(value === '' || value == null) return fallback;
  return value === true || ['si','sí','true','1','yes'].includes(normalize(value));
}
function isTrackableRow(item){
  return ['Verificable','Seguimiento','Permite Check','Check','Completable']
    .some(field => asBoolean(item?.[field], false));
}
function originalFor(item){
  return item.OriginalRecurso || item.ImagenOriginal || item.imageOriginal || item.Recurso || item.ImagenPath || '';
}
function resourceFor(item){
  return item.Recurso || item.ImagenPath || item.Link || '';
}
function isImage(path=''){ return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(path); }
function imageMarkup(item, className, eager = false){
  const optimized = item.image || item.fullImage || '';
  const original = item.imageOriginal || optimized;
  if(!optimized || !isImage(optimized)) return '';
  const img = `<img class="${className}" src="${escapeHtml(original)}" alt="${escapeHtml(item.title)}" width="1200" height="800" loading="${eager ? 'eager' : 'lazy'}" decoding="async"/>`;
  return optimized.includes('.webp')
    ? `<picture><source type="image/webp" srcset="${escapeHtml(optimized)}"/>${img}</picture>`
    : img;
}
function dateValue(value){
  if(!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function isCurrentEvent(item){
  const now = new Date();
  now.setHours(0,0,0,0);
  const end = dateValue(item['Fecha Fin']) || dateValue(item['Fecha Inicio']);
  return !end || end >= now;
}
function isWithinValidity(item){
  const now = new Date();
  const start = dateValue(item.validFrom);
  const end = dateValue(item.validTo);
  if(start) start.setHours(0,0,0,0);
  if(end) end.setHours(23,59,59,999);
  return (!start || now >= start) && (!end || now <= end);
}
function labelFor(item, fallback='Actualizado'){
  return String(item.Etiqueta || item.label || fallback).trim();
}
function categoryForInfo(item){
  if(normalize(item.Frecuencia) === 'semanal') return 'Semana';
  const value = normalize(item.Categoría);
  if(value.includes('partner') || value.includes('persona') || normalize(item.Actividad).includes('coffee master')) return 'Personas';
  return 'Operación';
}
function contentFromInfo(item){
  const resource = resourceFor(item);
  const original = originalFor(item);
  const imageResource = isImage(resource);
  const linkResource = item.TipoRecurso === 'link' ? resource : '';
  return {
    id:`info-${item.ID}`, source:'Informativo', category:categoryForInfo(item),
    title:item.Actividad, description:item['Descripción'] || '', short:item.DescripcionBreve || item['Descripción'] || '',
    label:labelFor(item, normalize(item.Frecuencia) === 'semanal' ? 'Importante' : 'Actualizado'),
    image:item.MiniaturaRecurso || (imageResource ? resource : ''), fullImage:imageResource ? resource : '', imageOriginal:isImage(original) ? original : resource,
    link:linkResource, section:imageResource || linkResource ? '' : 'informativo',
    access:item['Acceso Rápido'] || '',
    priority:Number(item.Prioridad || 99), order:Number(item.Orden || item.Prioridad || 99),
    showHome:asBoolean(item['Mostrar Inicio'], normalize(item.Frecuencia) === 'semanal'),
    showExplore:asBoolean(item['Mostrar Explorar'], true),
    validFrom:item['Vigencia Inicio'] || '', validTo:item['Vigencia Fin'] || ''
  };
}
function contentFromDaily(item){
  const resource = resourceFor(item);
  const original = originalFor(item);
  const lightweightImage = /\.webp(?:[?#].*)?$/i.test(resource)
    ? resource.replace(/\.webp(?=[?#]|$)/i, '.thumb.webp')
    : (item.MiniaturaRecurso || (isImage(resource) ? resource : ''));
  return {
    id:`daily-${item.ID}`, source:'Actividad diaria', category:'Operación',
    title:item.Actividad, description:item['Descripción'] || '', short:item.DescripcionBreve || item['Descripción'] || '',
    label:item.Prioridad === 1 ? 'Importante' : 'Actualizado', image:lightweightImage, fullImage:isImage(resource) ? resource : '',
    imageOriginal:isImage(original) ? original : resource, link:item.TipoRecurso === 'link' ? resource : '',
    section:resource ? '' : 'dia-a-dia', access:item['Acceso Rápido'] || 'Hoy',
    priority:Number(item.Prioridad || 99), order:Number(item.Orden || item.ID || item.Prioridad || 99), showExplore:true,
    validFrom:item['Vigencia Inicio'] || '', validTo:item['Vigencia Fin'] || '',
    trackable:isTrackableRow(item)
  };
}
function contentFromEvent(item){
  const image = item.ImagenPath || '';
  const link = item.Link || '';
  return {
    id:`event-${item.ID}`, source:'Evento', category:'Eventos', title:item.Actividad,
    description:item['Contexto / Recordatorio'] || '', short:item['Contexto / Recordatorio'] || '',
    label:'Actualizado', image:item.MiniaturaPath || image, fullImage:image, imageOriginal:item.ImagenOriginal || image,
    link, section:image || link ? '' : 'eventos-cms', access:/inventario/i.test(item.Actividad || '') ? 'Semana' : '',
    dateStart:item['Fecha Inicio'] || '', dateEnd:item['Fecha Fin'] || '',
    priority:20, order:Number(dateValue(item['Fecha Inicio'])?.getTime() || 0),
    showExplore:isCurrentEvent(item)
  };
}
function contentFromTool(tool){
  const link = tool.url || tool.webUrl || '';
  return {
    id:`tool-${tool.id}`, source:'Herramienta', category:'Herramientas', title:tool.nombre,
    description:tool.notas || '', short:tool.notas || '', label:'Herramienta', image:tool.imagen || '', fullImage:tool.imagen || '',
    imageOriginal:tool.imagen || '', link, toolId:tool.id,
    section:link ? '' : 'tool-workspace', priority:50, order:Number(tool.orden || 99), showExplore:true,
    keywords:[tool.categoria, tool.grupo, tool.alias, tool.etiquetas, tool.funcion, ...(tool.keywords || [])].filter(Boolean)
  };
}
function contentFromWeekly(item){
  const resource = resourceFor(item);
  const original = originalFor(item);
  return {
    id:`weekly-${item.ID}`, source:'Actividad semanal', category:'Semana', title:item.Actividad,
    description:item['Descripción'] || '', short:item['Descripción'] || '', label:'Semana',
    image:item.MiniaturaRecurso || (isImage(resource) ? resource : ''), fullImage:isImage(resource) ? resource : '',
    imageOriginal:isImage(original) ? original : resource, link:isImage(resource) ? '' : (item.Link || resource || ''),
    section:'', access:'Semana', dayName:item['Día'] || '', timeLabel:item['Hora / Corte'] || '',
    dateLabel:[item['Día'], item['Hora / Corte']].filter(Boolean).join(' · '),
    priority:30, order:Number(item.ID || 99), showExplore:false, searchOnly:true,
    validFrom:item['Vigencia Inicio'] || '', validTo:item['Vigencia Fin'] || '',
    keywords:[item['Día'], item['Hora / Corte'], item.Categoría].filter(Boolean),
    trackable:isTrackableRow(item)
  };
}
function contentFromPartnerDevelopment(item, program){
  const name = item.nombre || '';
  const store = item.tienda || '';
  const status = program === 'TBW' && item.avance !== '' ? `${item.estatus} · ${item.avance}%` : item.estatus;
  return {
    id:`person-${normalize(program).replace(/\s+/g, '-')}-${item.id || safeId('partner', name)}`,
    recordId:item.id,
    source:program === 'TBW' ? 'TBW' : 'Cursos de Alta', category:'Desarrollo Partner', title:name,
    description:[program, store, status].filter(Boolean).join(' · '),
    short:[store, status].filter(Boolean).join(' · '), label:program,
    image:'', fullImage:'', imageOriginal:'', link:'', section:'altas-curso', access:'Personas',
    priority:60, order:60, showExplore:false, searchOnly:true,
    keywords:[item.id, item.programa, item.avance, item.fecha, 'Desarrollo Partner', 'Cursos de Alta', 'TBW', store, status].filter(Boolean)
  };
}
function contentFromCelebration(item){
  const source = normalize(item.Tipo).includes('anivers') ? 'Aniversario' : 'Cumpleaños';
  return {
    id:`celebration-${item.ID}`, source, category:'Personas', title:item.NOMBRE,
    description:[source, item.PUESTO, item.TIENDA, item.Fecha].filter(Boolean).join(' · '),
    short:[source, item.TIENDA].filter(Boolean).join(' · '), label:source,
    image:'', fullImage:'', imageOriginal:'', link:'', section:'aniversarios-cumpleanos', access:'Personas',
    priority:65, order:65, showExplore:false, searchOnly:true,
    keywords:[item.NUM_EMP, item.CECO, item.PUESTO, item.TIENDA, item.Fecha].filter(Boolean)
  };
}
function sectionItems(){
  const duty = (state.operacional.dutyRoster || [])[0] || {};
  return [
    {id:'section-duty',source:'Operación',category:'Operación',title:'Duty Roster',description:'Consulta estaciones, enfoque, cobertura y detalle crítico del día.',short:'Enfoque, cobertura y estaciones del día.',label:'Hoy',access:'Operación',image:duty.MiniaturasPath?.[0] || duty.ImagenesPath?.[0] || '',fullImage:duty.ImagenesPath?.[0] || '',imageOriginal:duty.ImagenOriginal || duty.ImagenesPath?.[0] || '',section:'duty-roster',priority:5,order:5,showExplore:true,keywords:['peak','ritmo','cobertura','despliegue','turno']},
    {id:'section-celebrations',source:'Personas',category:'Personas',title:'Celebraciones',description:'Consulta aniversarios y cumpleaños vigentes del distrito.',short:'Aniversarios y cumpleaños.',label:'Personas',access:'Personas',image:'',imageOriginal:'',section:'aniversarios-cumpleanos',priority:20,order:20,showExplore:true},
    {id:'section-partner',source:'Personas',category:'Personas',title:'Desarrollo Partner',description:'Consulta las rutas vigentes de formación y seguimiento.',short:'Cursos de Alta y TBW.',label:'Personas',access:'Personas',image:'',imageOriginal:'',section:'altas-curso',priority:21,order:21,showExplore:true}
  ];
}

export function getContentCatalog(){
  const info = (state.operacional.informativo || []).filter(item => item.Visible !== false).map(contentFromInfo);
  const daily = (state.operacional.actividadesDiarias || []).filter(item => item.Visible !== false).map(contentFromDaily);
  const weekly = (state.operacional.actividadesSemanales || []).map(contentFromWeekly);
  const events = (state.operacional.eventos || []).filter(item => item.Publicar !== false && isCurrentEvent(item)).map(contentFromEvent);
  const tools = (state.herramientas || []).map(contentFromTool);
  const partners = [
    ...(state.partnerDevelopment?.cursosAlta || []).map(item => contentFromPartnerDevelopment(item, 'Cursos de Alta')),
    ...(state.partnerDevelopment?.tbwPendientes || []).map(item => contentFromPartnerDevelopment(item, 'TBW')),
  ];
  const celebrations = (state.operacional.celebraciones || []).filter(item => item.Publicar !== false).map(contentFromCelebration);
  return [...info, ...daily, ...weekly, ...events, ...sectionItems(), ...tools, ...partners, ...celebrations]
    .filter(isWithinValidity)
    .sort((a,b) => a.priority - b.priority || a.order - b.order || String(a.title).localeCompare(String(b.title), 'es'));
}

function storyMarkup(story, active){
  return `<button class="story-item ${active ? 'is-active' : ''}" type="button" role="listitem" data-story="${story.id}" data-access="${escapeHtml(story.label)}" aria-label="Filtrar por ${escapeHtml(story.label)}" aria-pressed="${active}">
    <span class="story-ring"><span class="story-ring-inner">${ICONS[story.icon]}</span></span><span>${escapeHtml(story.label)}</span>
  </button>`;
}
function coverIcon(item){
  const value = normalize(`${item.category} ${item.title}`);
  if(value.includes('persona') || value.includes('coffee')) return ICONS.people;
  if(value.includes('semana') || value.includes('evento')) return ICONS.week;
  if(value.includes('apertura')) return ICONS.opening;
  if(value.includes('peak') || value.includes('duty') || value.includes('turno')) return ICONS.peak;
  return ICONS.today;
}
function shouldUseStandardCover(item){
  const value = normalize(`${item.source} ${item.title}`);
  return ['Informativo','Actividad diaria','Evento'].includes(item.source)
    || /(maquila|pasos|checklist|coffee master|comunicado|guia|protocolo|resumen)/.test(value);
}
function standardCoverMarkup(item){
  const allowedLabel = ['Nuevo','Importante','Actualizado'].includes(item.label) ? item.label : '';
  return `<span class="standard-cover" aria-hidden="true">
    <span class="standard-cover-head"><span class="standard-cover-icon">${coverIcon(item)}</span>${allowedLabel ? `<span class="content-badge">${escapeHtml(allowedLabel)}</span>` : ''}</span>
    <span class="standard-cover-meta"><small>${escapeHtml(item.category || item.source)}</small><strong>${escapeHtml(item.title)}</strong></span>
  </span>`;
}
function cardMarkup(item){
  const standardCover = shouldUseStandardCover(item);
  const hasImage = !standardCover && Boolean(item.image && isImage(item.image));
  const actionable = hasDestination(item);
  const content = standardCover ? standardCoverMarkup(item) : (hasImage ? `${imageMarkup(item, 'explore-card-media')}<span class="explore-card-body"><span class="content-badge">${escapeHtml(item.label)}</span><h4>${escapeHtml(item.title)}</h4></span>` : standardCoverMarkup(item));
  return `<article class="explore-card ${hasImage ? 'has-image' : ''}" data-content-card="${escapeHtml(item.id)}">
    ${actionable
      ? `<button class="explore-card-main" type="button" data-open-content="${escapeHtml(item.id)}" aria-label="Abrir ${escapeHtml(item.title)}">${content}</button>`
      : `<div class="explore-card-main is-static" aria-label="${escapeHtml(item.title)}">${content}</div>`}
    ${savedButtonMarkup(item, 'save-content')}
  </article>`;
}
function getSavedIds(){ return getJSON(SAVED_KEY, []).filter(id => typeof id === 'string'); }
function saveIds(ids){ setJSON(SAVED_KEY, [...new Set(ids)].slice(0,80)); }
export function isContentSaved(id){ return getSavedIds().includes(id); }
function savedButtonMarkup(item, className = 'save-content'){
  const saved = isContentSaved(item.id);
  const label = saved ? `Quitar ${item.title} de Guardados` : `Guardar ${item.title}`;
  return `<button class="${className} ${saved ? 'is-saved' : ''}" type="button" data-save-content="${escapeHtml(item.id)}" aria-label="${escapeHtml(label)}" aria-pressed="${saved}"><span aria-hidden="true">${saved ? '♥' : '♡'}</span><span class="save-content-label">${saved ? 'Guardado' : 'Guardar'}</span></button>`;
}

function updateSavedControls(id){
  const selectorId = globalThis.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
  document.querySelectorAll(`[data-save-content="${selectorId}"]`).forEach(button => {
    const item = findContent(id);
    if(!item) return;
    const saved = isContentSaved(id);
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', saved ? `Quitar ${item.title} de Guardados` : `Guardar ${item.title}`);
    const icon = button.querySelector('[aria-hidden="true"]');
    const label = button.querySelector('.save-content-label');
    if(icon) icon.textContent = saved ? '♥' : '♡';
    if(label) label.textContent = saved ? 'Guardado' : 'Guardar';
  });
}
function migrateLegacyFavorites(){
  const defaultIds = new Set(state.favoritosBase || []);
  const migrated = (state.favorites || [])
    .filter(id => !defaultIds.has(id))
    .map(id => `tool-${id}`);
  if(migrated.length) saveIds([...getSavedIds(), ...migrated]);
}
function cleanDefaultSavedOnce(){
  if(getJSON('dgx_saved_clean_v28', false)) return;
  const defaults = new Set((state.favoritosBase || []).map(id => `tool-${id}`));
  saveIds(getSavedIds().filter(id => !defaults.has(id)));
  setJSON('dgx_saved_clean_v28', true);
}

export function findContent(id){ return getContentCatalog().find(item => item.id === id) || null; }
export function openContent(item, trigger){
  if(!item) return;
  if(item.source === 'Cursos de Alta' || item.source === 'TBW'){
    window.dispatchEvent(new CustomEvent('dgx:open-partner-route', {detail:{
      route:item.source === 'TBW' ? 'tbw' : 'courses',
      recordId:item.recordId,
      trigger
    }}));
    return;
  }
  window.dispatchEvent(new CustomEvent('dgx:open-detail', {detail:{item, trigger}}));
}
export function toggleSaved(id){
  const item = findContent(id);
  if(!item) return;
  const current = getSavedIds();
  const exists = current.includes(id);
  saveIds(exists ? current.filter(item => item !== id) : [id, ...current]);
  if(item.toolId){
    state.favorites = exists
      ? state.favorites.filter(toolId => toolId !== item.toolId)
      : [item.toolId, ...state.favorites.filter(toolId => toolId !== item.toolId)];
    setJSON('dgx_favorites', state.favorites);
  }
  renderExplore();
  renderSaved();
  updateSavedControls(id);
  window.dispatchEvent(new CustomEvent('dgx:saved-changed', {detail:{id, saved:!exists}}));
  toast(exists ? 'Quitado de Guardados' : 'Guardado en este dispositivo');
}

let activeCategory = 'Todo';
let activeAccess = '';
function isThisWeek(startValue, endValue){
  const startDate = dateValue(startValue);
  const endDate = dateValue(endValue) || startDate;
  if(!startDate || !endDate) return false;
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return endDate >= start && startDate < end;
}
function matchesAccess(item, access){
  const explicit = normalize(item.access);
  if(explicit === normalize(access)) return true;
  if(access === 'Hoy') return item.source === 'Actividad diaria' || item.label === 'Hoy';
  if(access === 'Apertura') return normalize(`${item.title} ${item.description}`).includes('apertura');
  if(access === 'Operación') return item.category === 'Operación' || explicit === 'peak' || /(peak|ritmo|cobertura|despliegue|servicio|turno)/.test(normalize(`${item.title} ${item.description}`));
  if(access === 'Personas') return item.category === 'Personas';
  if(access === 'Semana') return item.category === 'Semana' || (item.category === 'Eventos' && isThisWeek(item.dateStart, item.dateEnd));
  return true;
}
export function renderExplore(){
  const catalog = getContentCatalog().filter(item => !item.searchOnly || activeAccess === 'Semana');
  const list = activeAccess ? catalog.filter(item => matchesAccess(item, activeAccess)) : [];
  const title = document.getElementById('visual-explore-title');
  if(title) title.textContent = activeAccess || 'Hoy';
  const grid = document.getElementById('explore-grid');
  if(grid) grid.innerHTML = list.length
    ? list.slice(0,36).map(cardMarkup).join('')
    : '<div class="saved-empty"><strong>Sin contenido vigente</strong><p>Actualiza la clasificación o vigencia desde el CMS.</p></div>';
}
export function renderSaved(){
  const ids = getSavedIds();
  const byId = new Map(getContentCatalog().map(item => [item.id, item]));
  const items = ids.map(id => byId.get(id)).filter(Boolean);
  if(items.length !== ids.length) saveIds(items.map(item => item.id));
  const grid = document.getElementById('saved-grid');
  if(grid) grid.innerHTML = items.length ? items.map(cardMarkup).join('') : '<div class="saved-empty"><strong>Aún no tienes elementos guardados.</strong><p>Selecciona el corazón de una herramienta, rutina o actividad para personalizar este espacio.</p></div>';
}
function todayName(){
  return new Intl.DateTimeFormat('es-MX', {weekday:'long'}).format(new Date());
}
function compactText(value, max = 105){
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}
const COVER_SCENES = {
  espresso:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M67 42h226v77H67zM91 119v30m178-30v30M111 82h138M132 149h96v63h-96zM115 212h130"/><path d="M154 149v-24h52v24m-88 21H91v28h27m124-28h27v28h-27"/><path class="cover-accent" d="M166 125c0 13-17 13-17 27m62-27c0 13-17 13-17 27"/></svg>',
  checklist:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="106" y="38" width="148" height="184" rx="18"/><path d="M151 38v-9h58v28h-58zM139 96l11 11 22-26m-33 69 11 11 22-26m18-37h35m-35 54h35"/><circle class="cover-accent" cx="180" cy="132" r="91"/></svg>',
  opening:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M76 217h208M98 217V101l82-57 82 57v116M148 217v-69h64v69"/><path class="cover-accent" d="M71 83h218M236 48l13-19m15 46 23-8m-72-34-5-25"/></svg>',
  walk:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M69 213c38-83 84-22 112-91 27-66 69-22 110-76"/><circle cx="76" cy="201" r="19"/><path d="m67 201 7 7 13-16"/><path class="cover-accent" d="M277 34c22 0 37 16 37 36 0 28-37 63-37 63s-37-35-37-63c0-20 15-36 37-36z"/><circle cx="277" cy="70" r="10"/></svg>',
  steps:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M70 211h62v-43h57v-44h54V81h51"/><circle cx="101" cy="190" r="15"/><circle cx="161" cy="146" r="15"/><circle cx="216" cy="102" r="15"/><circle cx="270" cy="59" r="15"/><path class="cover-accent" d="m94 190 5 5 10-12m45-37 5 5 10-12m40-37 5 5 10-12m39-36 5 5 10-12"/></svg>',
  menu:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="76" y="45" width="208" height="170" rx="20"/><path d="M76 91h208M123 45v170m33-91h87m-87 33h87m-87 32h58"/><circle class="cover-accent" cx="99" cy="69" r="8"/></svg>',
  milk:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M83 85h89v132H83zM83 85l22-37h49l18 37m-67-37v37m49-37v37M231 90l48 75m0-75-48 75"/><circle cx="222" cy="77" r="18"/><circle cx="288" cy="77" r="18"/><path class="cover-accent" d="M105 141h45"/></svg>',
  planning:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="70" y="53" width="220" height="167" rx="18"/><path d="M70 99h220M111 36v35m138-35v35M104 187l45-44 35 25 69-52"/><path class="cover-accent" d="M230 116h23v23"/></svg>',
  review:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M180 38l73 28v57c0 47-31 78-73 101-42-23-73-54-73-101V66z"/><path d="m143 127 25 25 52-59"/><path class="cover-accent" d="M180 38v186"/></svg>',
  metrics:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M67 214h229M96 214v-58h43v58m26 0V99h43v115m26 0V55h43v159"/><path class="cover-accent" d="m89 127 62-47 45 21 77-63"/></svg>',
  expenses:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="65" y="64" width="230" height="137" rx="20"/><path d="M65 103h230m-189 55h58m88 0h1"/><circle class="cover-accent" cx="252" cy="158" r="19"/></svg>',
  community:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="116" y="34" width="128" height="193" rx="21"/><path d="M151 62h58M134 187h92"/><path class="cover-accent" d="M148 95h65v48h-31l-21 17v-17h-13z"/></svg>',
  learning:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="m65 94 115-53 115 53-115 53zM106 116v59c42 25 106 25 148 0v-59M295 94v77"/><path class="cover-accent" d="M283 177h24"/></svg>',
  coffee:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M94 98h151v73c0 31-23 48-52 48h-47c-29 0-52-17-52-48zM245 119h24c37 0 37 53 0 53h-24M74 219h210"/><path class="cover-accent" d="M135 79c-18-25 22-27 5-52m56 52c-18-25 22-27 5-52"/></svg>',
  message:'<svg viewBox="0 0 360 260" aria-hidden="true"><path d="M65 68h230v135H166l-49 31v-31H65zM103 108h154m-154 39h112"/><path class="cover-accent" d="M249 147h8"/></svg>',
  default:'<svg viewBox="0 0 360 260" aria-hidden="true"><rect x="71" y="48" width="218" height="170" rx="22"/><path d="M71 94h218M111 31v35m138-35v35m-137 75 25 25 53-55"/><path class="cover-accent" d="M224 139h29m-29 29h29"/></svg>'
};
function coverSceneKey(item){
  const value = normalize(`${item.title} ${item.category}`);
  if(value.includes('espresso')) return 'espresso';
  if(value.includes('rsa') || value.includes('checklist')) return 'checklist';
  if(value.includes('apertura')) return 'opening';
  if(value.includes('store walk') || value.includes('recorrido')) return 'walk';
  if(value.includes('10 pasos') || value.includes('turno exitoso')) return 'steps';
  if(value.includes('menu core')) return 'menu';
  if(value.includes('leche')) return 'milk';
  if(value.includes('green apron') || value.includes('revision dm') || value.includes('validacion final')) return 'review';
  if(value.includes('kpi') || value.includes('pronostico')) return 'metrics';
  if(value.includes('gasto') || value.includes('pago')) return 'expenses';
  if(value.includes('workvivo')) return 'community';
  if(value.includes('college') || value.includes('curso')) return 'learning';
  if(value.includes('coffee')) return 'coffee';
  if(value.includes('comunicado')) return 'message';
  if(value.includes('wfm') || value.includes('horario') || value.includes('publicacion')) return 'planning';
  return 'default';
}
function hasDestination(item){
  const section = item.section && document.getElementById(item.section);
  return Boolean(section || (item.fullImage && isImage(item.fullImage)) || safeContentLink(item.link) || item.action);
}
function safeContentLink(value){
  return /^https?:\/\//i.test(String(value || '').trim()) ? String(value).trim() : '';
}
function catalogCoverVisual(item, kind){
  const scene = coverSceneKey(item);
  return `<span class="catalog-cover-visual is-${scene}" aria-hidden="true">
    <span class="catalog-cover-art">${COVER_SCENES[scene] || COVER_SCENES.default}</span>
    <span class="catalog-cover-stamp">${kind === 'weekly' ? ICONS.week : coverIcon(item)}</span>
  </span>`;
}
function catalogCoverCardMarkup(item, kind){
  if(!item) return `<div class="home-focus-empty"><strong>Sin actividad vigente</strong><span>Consulta Explorar Distrito Go para revisar el contenido disponible.</span></div>`;
  const weekly = kind === 'weekly';
  const action = weekly ? 'Abrir actividad' : 'Ver rutina';
  const meta = weekly ? (item.label || 'Semana') : (item.label || 'Hoy');
  const date = weekly && item.dateLabel ? `<span class="catalog-cover-date">${escapeHtml(item.dateLabel)}</span>` : '';
  const destination = hasDestination(item);
  const completed = getJSON(COMPLETED_KEY, []).includes(item.id);
  const tracking = item.trackable ? `<label class="catalog-check" data-catalog-check-wrap>
    <input type="checkbox" data-complete-content="${escapeHtml(item.id)}" ${completed ? 'checked' : ''}/>
    <span>${completed ? 'Completada' : 'Marcar al completar'}</span>
  </label>` : '';
  const content = `${catalogCoverVisual(item, kind)}
    <span class="catalog-cover-copy">
      <span class="catalog-cover-badge">${escapeHtml(meta)}</span>
      ${date}
      <strong>${escapeHtml(item.title)}</strong>
      <span class="catalog-cover-rule" aria-hidden="true"></span>
      <span class="catalog-cover-description">${escapeHtml(compactText(item.short || item.description, 120))}</span>
      ${destination ? `<b>${action} →</b>` : '<em class="catalog-info-state">Informativa</em>'}
    </span>`;
  return `<article class="catalog-cover-card ${weekly ? 'is-weekly' : 'is-daily'}" data-catalog-cover="${escapeHtml(item.id)}">
    ${destination
      ? `<button class="catalog-cover-main" type="button" data-open-cover="${escapeHtml(item.id)}" aria-label="${action}: ${escapeHtml(item.title)}">${content}</button>`
      : `<div class="catalog-cover-main is-static" aria-label="${escapeHtml(item.title)}">${content}</div>`}
    ${tracking}
    ${savedButtonMarkup(item, 'catalog-cover-save')}
  </article>`;
}
function renderDailyCatalog(items){
  if(!items.length) return '<div class="home-focus-empty"><strong>Sin rutinas vigentes</strong><span>Consulta Explorar Distrito Go para revisar el contenido disponible.</span></div>';
  return `<div class="daily-catalog">
    <div class="home-catalog-toolbar">
      <span id="daily-catalog-status" aria-live="polite">1 de ${items.length}</span>
      <div class="home-catalog-controls" aria-label="Controles de Rutina diaria">
        <button type="button" data-catalog-scroll="prev" data-catalog-kind="daily" aria-label="Rutina anterior">‹</button>
        <button type="button" data-catalog-scroll="next" data-catalog-kind="daily" aria-label="Rutina siguiente">›</button>
      </div>
    </div>
    <div id="daily-catalog-track" class="home-catalog-track daily-catalog-track" tabindex="0" aria-label="Catálogo de rutinas diarias">
      ${items.map(item => catalogCoverCardMarkup(item, 'daily')).join('')}
    </div>
  </div>`;
}
let selectedWeekDay = todayName();
function weekDate(index){
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + index);
}
function weekDayPickerMarkup(){
  const today = normalize(todayName());
  return `<div class="week-day-picker" role="group" aria-label="Días de la semana">
    ${WEEK_DAYS.map((day, index) => {
      const date = weekDate(index);
      const active = normalize(day) === normalize(selectedWeekDay);
      const current = normalize(day) === today;
      const relation = index < ((new Date().getDay() + 6) % 7) ? 'is-past' : index > ((new Date().getDay() + 6) % 7) ? 'is-future' : 'is-today';
      const shortDay = day.slice(0,3).toLocaleUpperCase('es-MX');
      const shortDate = date.toLocaleDateString('es-MX', {day:'2-digit', month:'short'}).replace('.', '').toLocaleUpperCase('es-MX');
      return `<button class="week-day ${active ? 'is-selected' : ''} ${relation}" type="button" data-week-day="${escapeHtml(day)}" aria-pressed="${active}" ${current ? 'aria-current="date"' : ''}><strong>${shortDay}</strong><span>${shortDate}</span></button>`;
    }).join('')}
  </div>`;
}
function weekBounds(){
  const start = weekDate(0);
  const end = weekDate(6);
  start.setHours(0,0,0,0);
  end.setHours(23,59,59,999);
  return {start, end};
}
function celebrationOccurrence(item, year){
  const source = dateValue(item.Fecha);
  if(!source) return null;
  const occurrence = new Date(year, source.getMonth(), source.getDate());
  if(normalize(item.Tipo).includes('anivers') && year - source.getFullYear() < 1) return null;
  return occurrence;
}
function weeklyCelebrations(){
  const {start, end} = weekBounds();
  return (state.operacional.celebraciones || [])
    .filter(item => item.Publicar !== false)
    .flatMap(item => [...new Set([start.getFullYear(), end.getFullYear()])]
      .map(year => celebrationOccurrence(item, year))
      .filter(occurrence => occurrence && occurrence >= start && occurrence <= end)
      .map(occurrence => ({...item, occurrence})))
    .sort((a,b) => a.occurrence - b.occurrence || String(a.NOMBRE).localeCompare(String(b.NOMBRE), 'es'));
}
function weeklyCelebrationsMarkup(){
  const items = weeklyCelebrations();
  if(!items.length) return '';
  return `<section class="week-celebrations" aria-labelledby="week-celebrations-title">
    <div class="week-feature-heading">
      <span class="week-feature-icon" aria-hidden="true">✦</span>
      <div><small>Personas que nos inspiran</small><strong id="week-celebrations-title">Esta semana celebramos</strong></div>
      <b>${items.length}</b>
    </div>
    <div class="week-celebrations-track" aria-label="Cumpleaños y aniversarios de la semana">
      ${items.map(item => {
        const anniversary = normalize(item.Tipo).includes('anivers');
        const source = dateValue(item.Fecha);
        const years = anniversary && source ? item.occurrence.getFullYear() - source.getFullYear() : 0;
        const occurrence = `${item.occurrence.getFullYear()}-${String(item.occurrence.getMonth()+1).padStart(2,'0')}-${String(item.occurrence.getDate()).padStart(2,'0')}`;
        const date = item.occurrence.toLocaleDateString('es-MX', {weekday:'short', day:'2-digit', month:'short'});
        return `<button class="week-celebration-card ${anniversary ? 'is-anniversary' : 'is-birthday'}" type="button" data-celebration-id="${escapeHtml(item.ID || '')}" data-celebration-date="${occurrence}" aria-label="Crear felicitación para ${escapeHtml(item.NOMBRE || 'Partner')}">
          <span aria-hidden="true">${anniversary ? '🏅' : '🎂'}</span>
          <span><small>${escapeHtml(date)}</small><strong>${escapeHtml(item.NOMBRE || 'Partner')}</strong><em>${escapeHtml(anniversary ? `${Math.max(1, years)} año${years === 1 ? '' : 's'} con nosotros` : 'Cumpleaños')}</em></span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}
function dutyForDay(day){
  return (state.operacional.dutyRoster || []).find(item => normalize(item['Día']) === normalize(day)) || null;
}
function dutyMarkup(day){
  const duty = dutyForDay(day);
  if(!duty) return '';
  const details = (state.operacional.dutyDetail || [])
    .filter(item => normalize(item['Día']) === normalize(day))
    .sort((a,b) => Number(a.Orden || 0) - Number(b.Orden || 0));
  const critical = details.filter(item => item['Crítico'] === true || normalize(item['Crítico']) === 'true');
  const image = duty.ImagenOriginal || duty.ImagenesOriginales?.[0] || duty.ImagenesPath?.[0] || '';
  const stations = [...new Set([
    ...String(duty.Estaciones || '').split(',').map(item => item.trim()).filter(Boolean),
    ...details.map(item => String(item.Estación || '').trim()).filter(Boolean)
  ])];
  return `<section class="week-duty" aria-labelledby="week-duty-title">
    <div class="week-feature-heading">
      <span class="week-feature-icon" aria-hidden="true">🧭</span>
      <div><small>Duty del ${escapeHtml(day.toLocaleLowerCase('es-MX'))}</small><strong id="week-duty-title">${escapeHtml(duty.Estaciones || 'Duty Roster')}</strong></div>
      <b>${details.length} puntos</b>
    </div>
    <p>${escapeHtml(compactText(duty.Enfoque || '', 150))}</p>
    <div class="week-duty-meta">
      <span><b>${critical.length}</b> crítico${critical.length === 1 ? '' : 's'}</span>
      <span><b>${stations.length}</b> estación${stations.length === 1 ? '' : 'es'}</span>
    </div>
    <div class="week-duty-actions">
      ${image && isImage(image) ? `<button type="button" data-image-viewer="${escapeHtml(image)}" data-image-title="${escapeHtml(`${day} · ${duty.Estaciones || 'Duty Roster'}`)}">Ver guía visual</button>` : ''}
      <button type="button" data-week-duty-detail="${escapeHtml(day)}">Consultar actividades Duty</button>
    </div>
  </section>`;
}
function renderWeeklyCatalog(items){
  const selectedIndex = Math.max(0, WEEK_DAYS.findIndex(day => normalize(day) === normalize(selectedWeekDay)));
  const selectedDate = weekDate(selectedIndex);
  const selectedDateLabel = selectedDate.toLocaleDateString('es-MX', {weekday:'long', day:'2-digit', month:'long'});
  const recurringItems = items
    .filter(item => normalize(item.dayName) === normalize(selectedWeekDay))
    .map(item => ({...item, dateLabel:[selectedDateLabel, item.timeLabel].filter(Boolean).join(' · ')}));
  const inventoryItems = (state.operacional.eventos || [])
    .filter(item => item.Publicar !== false && /inventario (?:semanal|fin de mes)/i.test(item.Actividad || ''))
    .filter(item => {
      const start = dateValue(item['Fecha Inicio']);
      const end = dateValue(item['Fecha Fin']) || start;
      if(!start || !end) return false;
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      const target = new Date(selectedDate);
      target.setHours(12,0,0,0);
      return target >= start && target <= end;
    })
    .map(item => ({
      ...contentFromEvent(item),
      label:normalize(item.Actividad).includes('fin de mes') ? 'Inventario fin de mes' : 'Inventario semanal',
      dateLabel:selectedDateLabel,
      priority:10,
    }));
  const dayItems = [...inventoryItems, ...recurringItems]
    .sort((a,b) => Number(a.priority || 99) - Number(b.priority || 99) || Number(a.order || 99) - Number(b.order || 99));
  return `<div class="weekly-catalog">
    <div class="week-catalog-heading">
      <div><span>Semana actual</span><strong>${escapeHtml(selectedDateLabel)}</strong></div>
      <small>${dayItems.length} actividad${dayItems.length === 1 ? '' : 'es'}</small>
    </div>
    ${weekDayPickerMarkup()}
    ${dayItems.length ? `
    <div class="home-catalog-toolbar">
      <span id="weekly-catalog-status" aria-live="polite">1 de ${dayItems.length}</span>
      <div class="home-catalog-controls" aria-label="Controles de Actividad semanal">
        <button type="button" data-catalog-scroll="prev" data-catalog-kind="weekly" aria-label="Actividad anterior">‹</button>
        <button type="button" data-catalog-scroll="next" data-catalog-kind="weekly" aria-label="Actividad siguiente">›</button>
      </div>
    </div>
    <div id="weekly-catalog-track" class="home-catalog-track weekly-catalog-track" tabindex="0" aria-label="Actividades de ${escapeHtml(selectedWeekDay)}">
      ${dayItems.map(item => catalogCoverCardMarkup(item, 'weekly')).join('')}
    </div>` : '<div class="week-day-empty"><strong>Sin actividades publicadas</strong><span>Este día permanece visible porque forma parte del catálogo semanal.</span></div>'}
    <div class="week-context-grid">
      ${dutyMarkup(selectedWeekDay)}
      ${weeklyCelebrationsMarkup()}
    </div>
  </div>`;
}
function renderWeeklyArea(){
  const weekly = (state.operacional.actividadesSemanales || [])
    .map(contentFromWeekly)
    .filter(isWithinValidity)
    .sort((a,b) => a.order - b.order);
  const weeklyTarget = document.getElementById('home-weekly-card');
  if(weeklyTarget) weeklyTarget.innerHTML = renderWeeklyCatalog(weekly);
  bindCatalog('weekly');
  bindWeeklyDayPicker();
}
function selectWeekDay(day){
  if(!WEEK_DAYS.some(item => normalize(item) === normalize(day))) return;
  selectedWeekDay = day;
  renderWeeklyArea();
  requestAnimationFrame(() => document.querySelector(`[data-week-day="${CSS.escape(day)}"]`)?.focus({preventScroll:true}));
}
function bindWeeklyDayPicker(){
  const picker = document.querySelector('.week-day-picker');
  if(!picker) return;
  let touchStart = null;
  picker.addEventListener('touchstart', event => {
    touchStart = event.changedTouches[0]?.clientX ?? null;
  }, {passive:true});
  picker.addEventListener('touchend', event => {
    if(touchStart == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
    touchStart = null;
    if(Math.abs(delta) < 48) return;
    const current = WEEK_DAYS.findIndex(day => normalize(day) === normalize(selectedWeekDay));
    const next = Math.max(0, Math.min(WEEK_DAYS.length - 1, current + (delta < 0 ? 1 : -1)));
    if(next !== current) selectWeekDay(WEEK_DAYS[next]);
  }, {passive:true});
}
function updateCatalogControls(kind){
  const track = document.getElementById(`${kind}-catalog-track`);
  if(!track) return;
  const previous = document.querySelector(`[data-catalog-kind="${kind}"][data-catalog-scroll="prev"]`);
  const next = document.querySelector(`[data-catalog-kind="${kind}"][data-catalog-scroll="next"]`);
  const max = Math.max(0, track.scrollWidth - track.clientWidth);
  if(previous) previous.disabled = track.scrollLeft <= 4;
  if(next) next.disabled = track.scrollLeft >= max - 4;
  const cards = [...track.children];
  const trackLeft = track.getBoundingClientRect().left;
  const current = cards.reduce((best, card, index) => (
    Math.abs(card.getBoundingClientRect().left - trackLeft) < best.distance
      ? {index, distance:Math.abs(card.getBoundingClientRect().left - trackLeft)}
      : best
  ), {index:0, distance:Number.POSITIVE_INFINITY}).index;
  const status = document.getElementById(`${kind}-catalog-status`);
  if(status) status.textContent = `${current + 1} de ${cards.length}`;
}
function moveCatalog(kind, direction){
  const track = document.getElementById(`${kind}-catalog-track`);
  if(!track) return;
  const card = track.firstElementChild;
  const gap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
  const distance = (card?.getBoundingClientRect().width || track.clientWidth) + gap;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  track.scrollBy({left:direction * distance, behavior:reduceMotion ? 'auto' : 'smooth'});
  window.setTimeout(() => updateCatalogControls(kind), reduceMotion ? 0 : 260);
}
function bindCatalog(kind){
  const track = document.getElementById(`${kind}-catalog-track`);
  if(!track) return;
  let frame = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => updateCatalogControls(kind));
  }, {passive:true});
  track.addEventListener('keydown', event => {
    if(event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    moveCatalog(kind, event.key === 'ArrowRight' ? 1 : -1);
  });
  requestAnimationFrame(() => updateCatalogControls(kind));
}
function renderHomePriorities(){
  const daily = (state.operacional.actividadesDiarias || [])
    .filter(item => item.Visible !== false)
    .map(contentFromDaily)
    .filter(isWithinValidity)
    .sort((a,b) => a.priority - b.priority || a.order - b.order);
  const dailyTarget = document.getElementById('home-daily-card');
  if(dailyTarget) dailyTarget.innerHTML = renderDailyCatalog(daily);
  bindCatalog('daily');
  renderWeeklyArea();
}
function bindExperience(){
  document.body.addEventListener('click', event => {
    const cover = event.target.closest('[data-open-cover]');
    if(cover){
      window.dispatchEvent(new CustomEvent('dgx:open-destination', {detail:{item:findContent(cover.dataset.openCover), trigger:cover}}));
      return;
    }
    const open = event.target.closest('[data-open-content]');
    if(open){
      openContent(findContent(open.dataset.openContent), open);
      return;
    }
    const save = event.target.closest('[data-save-content]');
    if(save){
      event.preventDefault();
      event.stopPropagation();
      toggleSaved(save.dataset.saveContent);
      return;
    }
    const completion = event.target.closest('[data-complete-content]');
    if(completion){
      event.stopPropagation();
      const current = getJSON(COMPLETED_KEY, []).filter(id => typeof id === 'string');
      const id = completion.dataset.completeContent;
      setJSON(COMPLETED_KEY, completion.checked ? [...new Set([id, ...current])] : current.filter(item => item !== id));
      const label = completion.closest('[data-catalog-check-wrap]')?.querySelector('span');
      if(label) label.textContent = completion.checked ? 'Completada' : 'Marcar al completar';
      window.dispatchEvent(new CustomEvent('dgx:completion-changed', {detail:{id, completed:completion.checked}}));
      return;
    }
    const catalogScroll = event.target.closest('[data-catalog-scroll]');
    if(catalogScroll){
      moveCatalog(catalogScroll.dataset.catalogKind, catalogScroll.dataset.catalogScroll === 'next' ? 1 : -1);
      return;
    }
    const partnerRoute = event.target.closest('[data-partner-route]');
    if(partnerRoute){
      window.dispatchEvent(new CustomEvent('dgx:open-partner-route', {detail:{route:partnerRoute.dataset.partnerRoute, trigger:partnerRoute}}));
      return;
    }
    const filter = event.target.closest('[data-explore-category]');
    if(filter){
      activeAccess = '';
      activeCategory = filter.dataset.exploreCategory || 'Todo';
      renderStories();
      renderExplore();
      document.getElementById('visual-explore-title')?.focus({preventScroll:true});
      return;
    }
    const dutyDetail = event.target.closest('[data-week-duty-detail]');
    if(dutyDetail){
      const day = dutyDetail.dataset.weekDutyDetail || selectedWeekDay;
      window.dispatchEvent(new CustomEvent('dgx:open-duty-detail', {detail:{day, trigger:dutyDetail}}));
      return;
    }
    const weekDay = event.target.closest('[data-week-day]');
    if(weekDay){
      selectWeekDay(weekDay.dataset.weekDay);
    }
  });
  document.getElementById('close-saved-view')?.addEventListener('click', () => {
    document.querySelector('[data-view="home"]')?.click();
  });
}

export function showVisualView(view){
  const home = document.getElementById('home-view');
  const exploreView = document.getElementById('explore-view');
  const saved = document.getElementById('guardados');
  const contextual = document.getElementById('explorar');
  document.body.dataset.appView = view;
  document.querySelectorAll('.app-shell > .is-detail-target').forEach(section => section.classList.remove('is-detail-target'));
  if(view === 'saved'){
    renderSaved();
    if(home) home.hidden = true;
    if(exploreView) exploreView.hidden = true;
    if(saved) saved.hidden = false;
    if(contextual) contextual.hidden = true;
    saved?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if(saved) saved.hidden = true;
  if(view === 'explore'){
    if(home) home.hidden = true;
    if(exploreView) exploreView.hidden = false;
    if(contextual) contextual.hidden = true;
    exploreView?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  activeAccess = '';
  if(home) home.hidden = false;
  if(exploreView) exploreView.hidden = true;
  if(contextual) contextual.hidden = true;
  window.scrollTo({top:0,behavior:'smooth'});
}

export function showDetailSection(id, smooth = true){
  const target = document.getElementById(id);
  if(!target) return false;
  document.body.dataset.appView = 'detail';
  document.querySelectorAll('.app-shell > .is-detail-target').forEach(section => section.classList.remove('is-detail-target'));
  target.classList.add('is-detail-target');
  target.classList.remove('is-destination-highlight');
  requestAnimationFrame(() => target.classList.add('is-destination-highlight'));
  window.setTimeout(() => target.classList.remove('is-destination-highlight'), 1800);
  target.scrollIntoView({behavior:smooth ? 'smooth' : 'auto', block:'start'});
  return true;
}

export function initExperience(){
  cleanDefaultSavedOnce();
  migrateLegacyFavorites();
  renderHomePriorities();
  renderExplore();
  renderSaved();
  bindCatalog('informative');
  bindExperience();
}
