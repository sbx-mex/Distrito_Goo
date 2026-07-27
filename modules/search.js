import { state } from './state.js';
import { $, $$, normalize, isInputActive } from './utils.js';
import { modalResult, emptyState } from './components.js';
import { openTool, renderTools } from './cards.js';
import { getContentCatalog, openContent } from './experience.js';

export function bindSearch(){
  const spotlightInput = document.getElementById('spotlight-input');
  spotlightInput?.addEventListener('input', e => {
    state.query = e.target.value;
    renderTools(true);
  });
  document.getElementById('open-spotlight')?.addEventListener('click', openSpotlight);
  document.getElementById('close-spotlight')?.addEventListener('click', () => document.getElementById('spotlight-modal')?.close());
  document.getElementById('modal-search-input')?.addEventListener('input', e => renderSearchResults(e.target.value));
  document.addEventListener('keydown', e => {
    if(e.key === '/' && !isInputActive()){ e.preventDefault(); openSpotlight(); }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); openSpotlight(); }
  });
}

export function searchTools(query){
  const q = normalize(query);
  if(!q) return state.herramientas;
  const terms = q.split(/\s+/).filter(Boolean);
  return state.herramientas
    .map(tool => {
      const name = normalize(tool.nombre);
      const category = normalize(tool.categoria);
      const keywords = normalize((tool.keywords || []).join(' '));
      const meta = normalize([tool.notas, tool.grupo, tool.tipo, tool.url, tool.webUrl, tool.alias, tool.etiquetas, tool.funcion].join(' '));
      const haystack = `${name} ${category} ${keywords} ${meta}`;
      let score = 0;
      if(name === q) score += 120;
      if(name.startsWith(q)) score += 80;
      if(name.includes(q)) score += 60;
      if(category.includes(q)) score += 36;
      if(keywords.includes(q)) score += 28;
      if(meta.includes(q)) score += 16;
      for(const term of terms){
        if(name.includes(term)) score += 14;
        else if(category.includes(term)) score += 9;
        else if(keywords.includes(term)) score += 7;
        else if(meta.includes(term)) score += 4;
        else if(!haystack.includes(term)) score -= 12;
      }
      return {tool, score};
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || a.tool.orden - b.tool.orden)
    .map(x => x.tool);
}

export function openSpotlight(){
  const modal = $('#spotlight-modal');
  if(!modal?.showModal) return;
  modal.showModal();
  const input = $('#modal-search-input');
  if(!input) return;
  input.value = '';
  renderSearchResults('');
  setTimeout(() => input.focus(), 50);
}

function searchContent(query){
  const q = normalize(query);
  const terms = q.split(/\s+/).filter(Boolean);
  return getContentCatalog().map(item => {
    const title = normalize(item.title);
    const category = normalize(item.category);
    const meta = normalize(`${item.description} ${item.short} ${item.label} ${item.source}`);
    let score = q ? 0 : 1;
    if(title === q) score += 120;
    if(title.startsWith(q)) score += 80;
    if(title.includes(q)) score += 60;
    if(category.includes(q)) score += 30;
    if(meta.includes(q)) score += 18;
    terms.forEach(term => {
      if(title.includes(term)) score += 14;
      else if(category.includes(term)) score += 9;
      else if(meta.includes(term)) score += 5;
      else score -= 8;
    });
    return {item, score};
  }).filter(result => result.score > 0)
    .sort((a,b)=>b.score-a.score || a.item.priority-b.item.priority)
    .map(result=>result.item);
}

function contentResult(item){
  const image = item.image
    ? `<img class="modal-result-thumb" src="${item.image}" alt="" width="58" height="58" loading="lazy" decoding="async">`
    : '<span class="modal-result-thumb" aria-hidden="true"></span>';
  return `<button class="modal-content-result" type="button" data-content-id="${item.id}">${image}<span><strong>${item.title}</strong><br><small>${item.category} · ${item.label}</small></span></button>`;
}

export function renderSearchResults(query=''){
  const container = document.getElementById('modal-results');
  if(!container) return;
  const content = searchContent(query).slice(0, 8);
  const tools = searchTools(query).slice(0, 8);
  container.innerHTML = content.length || tools.length
    ? `${content.length ? `<div class="modal-group-label">Contenido</div>${content.map(contentResult).join('')}` : ''}${tools.length ? `<div class="modal-group-label">Herramientas</div>${tools.map(modalResult).join('')}` : ''}`
    : emptyState('Sin resultados', 'Prueba con operación, personas, evento o herramienta.');
  $$('.modal-content-result').forEach(row => {
    row.addEventListener('click', () => {
      const item = getContentCatalog().find(entry => entry.id === row.dataset.contentId);
      document.getElementById('spotlight-modal')?.close();
      openContent(item, row);
    });
  });
  $$('.modal-result').forEach(row => {
    row.addEventListener('click', () => { document.getElementById('spotlight-modal')?.close(); openTool(row.dataset.id); });
    row.addEventListener('keydown', e => { if(e.key === 'Enter'){ document.getElementById('spotlight-modal')?.close(); openTool(row.dataset.id); } });
  });
}
