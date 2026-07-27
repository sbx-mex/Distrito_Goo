import { state } from './state.js';
import { escapeHtml, normalize } from './utils.js';
import { getJSON, setJSON } from './storage.js';
import { toast } from './toast.js';

const SAVED_KEY = 'dgx_saved_content';
const CATEGORIES = ['Todo', 'Semana', 'Operación', 'Personas', 'Eventos', 'Herramientas'];
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
  return {
    id:`info-${item.ID}`, source:'Informativo', category:categoryForInfo(item),
    title:item.Actividad, description:item['Descripción'] || '', short:item.DescripcionBreve || item['Descripción'] || '',
    label:labelFor(item, normalize(item.Frecuencia) === 'semanal' ? 'Importante' : 'Actualizado'),
    image:item.MiniaturaRecurso || (isImage(resource) ? resource : ''), fullImage:isImage(resource) ? resource : '', imageOriginal:isImage(original) ? original : resource,
    link:item.TipoRecurso === 'link' ? resource : '', section:'informativo',
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
  return {
    id:`daily-${item.ID}`, source:'Actividad diaria', category:'Operación',
    title:item.Actividad, description:item['Descripción'] || '', short:item.DescripcionBreve || item['Descripción'] || '',
    label:item.Prioridad === 1 ? 'Importante' : 'Actualizado', image:item.MiniaturaRecurso || (isImage(resource) ? resource : ''), fullImage:isImage(resource) ? resource : '',
    imageOriginal:isImage(original) ? original : resource, link:item.TipoRecurso === 'link' ? resource : '',
    section:'dia-a-dia', access:item['Acceso Rápido'] || 'Hoy',
    priority:Number(item.Prioridad || 99), order:Number(item.Prioridad || 99), showExplore:true
  };
}
function contentFromEvent(item){
  return {
    id:`event-${item.ID}`, source:'Evento', category:'Eventos', title:item.Actividad,
    description:item['Contexto / Recordatorio'] || '', short:item['Contexto / Recordatorio'] || '',
    label:'Actualizado', image:item.MiniaturaPath || item.ImagenPath || '', fullImage:item.ImagenPath || '', imageOriginal:item.ImagenOriginal || item.ImagenPath || '',
    link:item.Link || '', section:'eventos-cms', access:'',
    dateStart:item['Fecha Inicio'] || '', dateEnd:item['Fecha Fin'] || '',
    priority:20, order:Number(dateValue(item['Fecha Inicio'])?.getTime() || 0),
    showExplore:isCurrentEvent(item)
  };
}
function contentFromTool(tool){
  return {
    id:`tool-${tool.id}`, source:'Herramienta', category:'Herramientas', title:tool.nombre,
    description:tool.notas || '', short:tool.notas || '', label:'Herramienta', image:tool.imagen || '', fullImage:tool.imagen || '',
    imageOriginal:tool.imagen || '', link:tool.url || tool.webUrl || '', toolId:tool.id,
    section:'tool-workspace', priority:50, order:Number(tool.orden || 99), showExplore:true,
    keywords:[tool.categoria, tool.grupo, tool.alias, tool.etiquetas, tool.funcion, ...(tool.keywords || [])].filter(Boolean)
  };
}
function contentFromWeekly(item){
  return {
    id:`weekly-${item.ID}`, source:'Actividad semanal', category:'Semana', title:item.Actividad,
    description:item['Descripción'] || '', short:item['Descripción'] || '', label:item['Día'] || 'Semana',
    image:'', fullImage:'', imageOriginal:'', link:item.Link || '', section:'dia-a-dia', access:'Semana',
    priority:30, order:Number(item.ID || 99), showExplore:false, searchOnly:true,
    keywords:[item['Día'], item['Hora / Corte'], item.Categoría].filter(Boolean)
  };
}
function contentFromPerson(item, program){
  const name = item['NOMBRE COMPLETO'] || item.NOMBRE || '';
  const store = item.TIENDA || '';
  const status = item['ESTATUS ALTA'] || (item.Avance != null ? `${Math.round(Number(item.Avance) * 100)}% de avance` : program);
  return {
    id:`person-${program}-${item.SBX || item['NO. EMPLEADO'] || safeId('partner', name)}`,
    source:'Persona', category:'Personas', title:name,
    description:[program, store, status].filter(Boolean).join(' · '),
    short:[store, status].filter(Boolean).join(' · '), label:program,
    image:'', fullImage:'', imageOriginal:'', link:'', section:'altas-curso', access:'Personas',
    priority:60, order:60, showExplore:false, searchOnly:true,
    keywords:[item.SBX, item['NO. EMPLEADO'], item.CECO, item.CeCo, item.PUESTO, store, status].filter(Boolean)
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
    {id:'section-partner',source:'Personas',category:'Personas',title:'Desarrollo Partner',description:'Consulta BT, SS y TBW sin mezclar los focos operativos.',short:'BT, SS y TBW.',label:'Personas',access:'Personas',image:'',imageOriginal:'',section:'altas-curso',priority:21,order:21,showExplore:true}
  ];
}

export function getContentCatalog(){
  const info = (state.operacional.informativo || []).filter(item => item.Visible !== false).map(contentFromInfo);
  const daily = (state.operacional.actividadesDiarias || []).filter(item => item.Visible !== false).map(contentFromDaily);
  const weekly = (state.operacional.actividadesSemanales || []).map(contentFromWeekly);
  const events = (state.operacional.eventos || []).filter(item => item.Publicar !== false && isCurrentEvent(item)).map(contentFromEvent);
  const tools = (state.herramientas || []).map(contentFromTool);
  const partners = ['bt','ss','tbw'].flatMap(program => (state.operacional.altasCurso?.[program] || []).map(item => contentFromPerson(item, program.toUpperCase())));
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
  const saved = getSavedIds().includes(item.id);
  return `<article class="explore-card ${hasImage ? 'has-image' : ''}" data-content-card="${escapeHtml(item.id)}">
    <button class="explore-card-main" type="button" data-open-content="${escapeHtml(item.id)}" aria-label="Abrir ${escapeHtml(item.title)}">
      ${standardCover ? standardCoverMarkup(item) : (hasImage ? `${imageMarkup(item, 'explore-card-media')}<span class="explore-card-body"><span class="content-badge">${escapeHtml(item.label)}</span><h4>${escapeHtml(item.title)}</h4></span>` : standardCoverMarkup(item))}
    </button>
    <button class="save-content ${saved ? 'is-saved' : ''}" type="button" data-save-content="${escapeHtml(item.id)}" aria-label="${saved ? 'Quitar de' : 'Agregar a'} Guardados" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
  </article>`;
}
function getSavedIds(){ return getJSON(SAVED_KEY, []).filter(id => typeof id === 'string'); }
function saveIds(ids){ setJSON(SAVED_KEY, [...new Set(ids)].slice(0,80)); }

export function findContent(id){ return getContentCatalog().find(item => item.id === id) || null; }
export function openContent(item, trigger){
  if(!item) return;
  window.dispatchEvent(new CustomEvent('dgx:open-detail', {detail:{item, trigger}}));
}
function toggleSaved(id){
  const current = getSavedIds();
  const exists = current.includes(id);
  saveIds(exists ? current.filter(item => item !== id) : [id, ...current]);
  renderExplore();
  renderSaved();
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
  const catalog = getContentCatalog().filter(item => item.showExplore !== false && !item.searchOnly);
  const visibleCategories = CATEGORIES.filter(category => category === 'Todo' || catalog.some(item => item.category === category));
  const filters = document.getElementById('explore-filters');
  if(filters) filters.innerHTML = visibleCategories.map(category => `<button class="explore-filter ${category === activeCategory ? 'is-active' : ''}" type="button" data-explore-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>`).join('');
  const categoryList = activeCategory === 'Todo' ? catalog : catalog.filter(item => item.category === activeCategory);
  const list = activeAccess ? categoryList.filter(item => matchesAccess(item, activeAccess)) : categoryList;
  const title = document.getElementById('visual-explore-title');
  if(title) title.textContent = activeAccess ? activeAccess : 'Explorar Distrito Go';
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
  if(grid) grid.innerHTML = items.length ? items.map(cardMarkup).join('') : '<div class="saved-empty"><strong>Aún no tienes guardados</strong><p>Toca el corazón de cualquier contenido para encontrarlo aquí.</p></div>';
}
function renderPriority(){
  const info = (state.operacional.informativo || []).filter(item => item.Visible !== false).map(contentFromInfo).filter(isWithinValidity);
  const priority = info.filter(item => item.showHome).sort((a,b)=>a.priority-b.priority || a.order-b.order)[0]
    || info.filter(item => item.category === 'Semana').sort((a,b)=>a.priority-b.priority)[0]
    || getContentCatalog()[0];
  const target = document.getElementById('visual-priority-card');
  const status = document.getElementById('visual-priority-status');
  if(status) status.textContent = priority?.label || 'Actualizado';
  if(!target || !priority) return;
  const standard = shouldUseStandardCover(priority);
  target.innerHTML = `<button class="priority-card ${standard ? 'priority-standard' : ''}" type="button" data-open-content="${escapeHtml(priority.id)}" aria-label="Abrir ${escapeHtml(priority.title)}">
    ${standard
      ? standardCoverMarkup(priority)
      : `${imageMarkup(priority, 'priority-image', true)}<span class="priority-copy"><span class="content-badge">${escapeHtml(priority.label)}</span><h4>${escapeHtml(priority.title)}</h4><p>${escapeHtml(priority.short)}</p></span>`}
  </button>`;
}
function renderStories(){
  const stories = [
    {id:'today',label:'Hoy',icon:'today'},
    {id:'opening',label:'Apertura',icon:'opening'},
    {id:'people',label:'Personas',icon:'people'},
    {id:'week',label:'Semana',icon:'week'}
  ];
  const target = document.getElementById('operational-stories');
  if(target) target.innerHTML = stories.map(story => storyMarkup(story, normalize(activeAccess) === story.id || normalize(activeAccess) === normalize(story.label))).join('');
}
function bindExperience(){
  document.body.addEventListener('click', event => {
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
    const filter = event.target.closest('[data-explore-category]');
    if(filter){
      activeAccess = '';
      activeCategory = filter.dataset.exploreCategory || 'Todo';
      renderStories();
      renderExplore();
      document.getElementById('visual-explore-title')?.focus({preventScroll:true});
      return;
    }
    const story = event.target.closest('[data-story]');
    if(story){
      activeAccess = story.dataset.access || '';
      activeCategory = 'Todo';
      renderStories();
      renderExplore();
      document.getElementById('explorar')?.scrollIntoView({behavior:'smooth', block:'start'});
    }
  });
  document.getElementById('close-saved-view')?.addEventListener('click', () => showVisualView('home'));
}

export function showVisualView(view){
  const saved = document.getElementById('guardados');
  const explore = document.getElementById('explorar');
  if(view === 'saved'){
    renderSaved();
    if(saved) saved.hidden = false;
    if(explore) explore.hidden = true;
    saved?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if(saved) saved.hidden = true;
  if(explore) explore.hidden = false;
  if(view === 'explore') explore?.scrollIntoView({behavior:'smooth',block:'start'});
  else window.scrollTo({top:0,behavior:'smooth'});
}

export function initExperience(){
  renderStories();
  renderPriority();
  renderExplore();
  renderSaved();
  bindExperience();
}
