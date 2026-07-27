import { state } from './state.js';
import { $, $$, normalize } from './utils.js';
import { toolCard, emptyState } from './components.js';
import { openNativeApp } from './native-apps.js';
import { toast } from './toast.js';

function setTextIfPresent(id, value){ const el = document.getElementById(id); if(el) el.textContent = value; }
function setHtmlIfPresent(id, value){ const el = document.getElementById(id); if(el) el.innerHTML = value; }
import { setJSON } from './storage.js';

export function getFilteredTools(){
  const q = normalize(state.query);
  let tools = state.herramientas.filter(tool => {
    const inCategory = state.categoria === 'all' || tool.categoriaId === state.categoria;
    const haystack = normalize([tool.nombre, tool.notas, tool.categoria, tool.grupo, tool.tipo, tool.url, tool.webUrl, tool.alias, tool.etiquetas, tool.funcion, ...(tool.keywords || [])].join(' '));
    const inMode = state.toolMode === 'favorites'
      ? state.favorites.includes(tool.id)
      : state.toolMode === 'recent'
        ? state.recents.includes(tool.id)
        : true;
    return inCategory && inMode && (!q || haystack.includes(q));
  });
  if(state.toolMode === 'recent'){
    tools.sort((a,b) => state.recents.indexOf(a.id) - state.recents.indexOf(b.id));
  }else if(state.toolSort === 'name'){
    tools.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity:'base'}));
  }else if(state.toolSort === 'used'){
    tools.sort((a,b) => (state.usage[b.id] || 0) - (state.usage[a.id] || 0) || a.orden - b.orden);
  }else{
    tools.sort((a,b) => a.orden - b.orden);
  }
  return tools;
}

export function renderTools(reset = false){
  if(reset) state.visibleCount = 16;
  const toolsSection = document.querySelector('.tools-section');
  const initial = document.getElementById('tool-filter-empty');
  const hasFilter = Boolean(state.categoria);
  if(toolsSection) toolsSection.hidden = !hasFilter;
  if(initial) initial.hidden = hasFilter;
  const clear = document.getElementById('clear-tool-filter');
  if(clear) clear.hidden = !hasFilter;
  if(!hasFilter){
    setTextIfPresent('result-count', '');
    setHtmlIfPresent('tools-grid', '');
    document.getElementById('lazy-sentinel')?.classList.add('hidden');
    return;
  }
  const all = getFilteredTools();
  const visible = all.slice(0, state.visibleCount);
  toolsSection?.classList.remove('is-initially-hidden');
  setTextIfPresent('result-count', `${all.length} herramienta${all.length === 1 ? '' : 's'} disponible${all.length === 1 ? '' : 's'}`);
  setHtmlIfPresent('tools-grid', visible.map(t => toolCard(t, false)).join('') || emptyState('No hay herramientas disponibles en esta categoría.'));
  bindToolCards('#tools-grid');
  document.getElementById('lazy-sentinel')?.classList.toggle('hidden', visible.length >= all.length);
}

export function loadMoreTools(){
  const total = getFilteredTools().length;
  if(state.visibleCount < total){
    state.visibleCount += 12;
    renderTools(false);
  }
}

export function renderToolCollection(selector, tools, compact = false){
  const el = $(selector);
  el.innerHTML = tools.map(t => toolCard(t, false, compact)).join('') || emptyState('Sin elementos por ahora');
  bindToolCards(selector);
}

export function bindToolCards(scope){
  $$(`${scope} .tool-card`).forEach(card => {
    card.addEventListener('click', event => {
      if(event.target.closest('.fav-toggle')) return;
      openTool(card.dataset.id);
    });
    card.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openTool(card.dataset.id); }
    });
  });
}

export function openTool(id){
  const tool = state.herramientas.find(t => t.id === id);
  if(!tool){ toast('Enlace no disponible'); return; }
  if(!tool.url && !(tool.tipo === 'app' && tool.package)){ toast('Enlace no disponible'); return; }
  pushRecent(tool.id);
  state.usage[tool.id] = (state.usage[tool.id] || 0) + 1;
  setJSON('dgx_usage', state.usage);
  if(tool.tipo === 'app' && tool.package){
    openNativeApp(tool);
  }else{
    toast(`Abriendo ${tool.nombre}`);
    window.open(tool.url, '_blank', 'noopener');
  }
}

export function toggleFavorite(id){
  state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [id, ...state.favorites];
  setJSON('dgx_favorites', state.favorites);
  const savedKey = 'dgx_saved_content';
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(savedKey)) || []; } catch { saved = []; }
  const contentId = `tool-${id}`;
  saved = state.favorites.includes(id)
    ? [contentId, ...saved.filter(item => item !== contentId)]
    : saved.filter(item => item !== contentId);
  setJSON(savedKey, [...new Set(saved)].slice(0,80));
  renderTools(false);
  window.dispatchEvent(new CustomEvent('dgx:saved-changed', {detail:{id:contentId, saved:state.favorites.includes(id)}}));
  toast(state.favorites.includes(id) ? 'Agregado a favoritos' : 'Quitado de favoritos');
}

export function pushRecent(id){
  state.recents = [id, ...state.recents.filter(x => x !== id)].slice(0, 10);
  setJSON('dgx_recents', state.recents);
}

export function getByIds(ids){
  return ids.map(id => state.herramientas.find(t => t.id === id)).filter(Boolean);
}

export function getSmartFavorites(){
  return [...state.favorites]
    .sort((a,b) => (state.usage[b] || 0) - (state.usage[a] || 0) || state.favorites.indexOf(a) - state.favorites.indexOf(b))
    .map(id => state.herramientas.find(t => t.id === id))
    .filter(Boolean)
    .slice(0, 8);
}

export function renderSmartSections(){
  // Favoritos y recientes se retiraron de la vista principal en la versión LaunchPad Premium.
}
