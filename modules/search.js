import { state } from './state.js';
import { escapeHtml, normalize } from './utils.js';
import { getContentCatalog, hasDestination, isContentSaved, openContent } from './experience.js';
import { openTool, renderTools } from './cards.js';

const INITIAL_LIMIT = 8;
const SEARCH_DELAY = 200;
let searchIndex = [];
let debounceTimer = 0;
let showAllResults = false;

const RESULT_ICONS = {
  Herramienta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8m-8 4h5"/></svg>',
  Evento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM8 3v6m8-6v6M4 10h16"/></svg>',
  Operación: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 16l4-5 3 3 5-8"/><path d="M15 6h3v3"/></svg>',
  default: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
};

function indexEntry(item){
  const title = normalize(item.title);
  const category = normalize(`${item.category || ''} ${item.source || ''}`);
  const description = normalize(`${item.description || ''} ${item.short || ''}`);
  const label = normalize(item.label || '');
  const keywords = normalize(Array.isArray(item.keywords) ? item.keywords.join(' ') : item.keywords || '');
  return {
    item,
    title,
    category,
    description,
    label,
    keywords,
    haystack: `${title} ${category} ${description} ${label} ${keywords}`,
  };
}

export function createSearchIndex(items = getContentCatalog()){
  const unique = new Map();
  items.forEach(item => {
    const partnerRecord = /^(?:person|celebration)-/.test(String(item?.id || ''))
      || ['Cursos de Alta','TBW','Cumpleaños','Aniversario','Persona'].includes(item?.source);
    const actionable = hasDestination(item);
    if(item?.id && item?.title && !partnerRecord && actionable && !unique.has(item.id)) unique.set(item.id, indexEntry(item));
  });
  return [...unique.values()];
}

export function initializeGlobalSearch(){
  searchIndex = createSearchIndex();
  return searchIndex.length;
}

function isNearWord(word, term){
  if(word.includes(term) || term.includes(word)) return true;
  if(term.length < 4 || Math.abs(word.length - term.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while(i < word.length && j < term.length){
    if(word[i] === term[j]){
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if(edits > 1) return false;
    if(word.length > term.length) i += 1;
    else if(term.length > word.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + Number(i < word.length || j < term.length) <= 1;
}

function termMatches(entry, term){
  if(entry.haystack.includes(term)) return true;
  return entry.haystack.split(/\s+/).some(word => isNearWord(word, term));
}

function scoreEntry(entry, query){
  const terms = query.split(/\s+/).filter(Boolean);
  if(!terms.length || !terms.every(term => termMatches(entry, term))) return 0;
  let score = 0;
  if(entry.title === query) score += 180;
  else if(entry.title.startsWith(query)) score += 140;
  else if(entry.title.includes(query)) score += 110;
  if(entry.category.includes(query)) score += 48;
  if(entry.description.includes(query)) score += 34;
  if(entry.label.includes(query)) score += 26;
  if(entry.keywords.includes(query)) score += 22;
  terms.forEach(term => {
    if(entry.title.includes(term)) score += 20;
    else if(entry.category.includes(term)) score += 12;
    else if(entry.description.includes(term)) score += 8;
    else if(entry.label.includes(term)) score += 6;
    else if(entry.keywords.includes(term)) score += 5;
    else score += 2;
  });
  return score;
}

export function searchGlobalIndex(query, index = searchIndex){
  const normalizedQuery = normalize(query);
  if(!normalizedQuery) return [];
  return index
    .map(entry => ({...entry, score:scoreEntry(entry, normalizedQuery)}))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score
      || Number(a.item.priority || 99) - Number(b.item.priority || 99)
      || String(a.item.title).localeCompare(String(b.item.title), 'es', {sensitivity:'base'}))
    .map(entry => entry.item);
}

function resultType(item){
  if(item.source === 'Herramienta') return 'Herramienta';
  if(item.source === 'Evento') return 'Evento';
  return item.category || item.source || 'Operación';
}

function resultCard(item){
  const type = resultType(item);
  const favorite = isContentSaved(item.id);
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async">`
    : (RESULT_ICONS[type] || RESULT_ICONS.default);
  return `<article class="global-result-card" data-search-result="${escapeHtml(item.id)}">
    <button class="global-result-main" type="button" data-open-search-result="${escapeHtml(item.id)}" aria-label="Abrir ${escapeHtml(item.title)}">
      <span class="global-result-media">${image}</span>
      <span class="global-result-copy">
        <span class="global-result-meta"><small>${escapeHtml(type)}</small>${item.label ? `<em>${escapeHtml(item.label)}</em>` : ''}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span class="global-result-description">${escapeHtml(item.short || item.description || 'Consulta el detalle disponible.')}</span>
      </span>
      <span class="global-result-open">Abrir</span>
    </button>
    <button class="global-result-favorite ${favorite ? 'is-favorite' : ''}" type="button" data-save-content="${escapeHtml(item.id)}" aria-label="${escapeHtml(favorite ? `Quitar ${item.title} de Guardados` : `Guardar ${item.title}`)}" aria-pressed="${favorite}"><span aria-hidden="true">${favorite ? '♥' : '♡'}</span><span class="sr-only save-content-label">${favorite ? 'Guardado' : 'Guardar'}</span></button>
  </article>`;
}

function setStatus(title, message){
  const status = document.getElementById('global-search-status');
  if(status){
    status.hidden = false;
    status.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  }
}

function resetSearchView(){
  const results = document.getElementById('global-search-results');
  const grid = document.getElementById('global-search-grid');
  const count = document.getElementById('global-search-count');
  if(results) results.hidden = true;
  if(grid) grid.innerHTML = '';
  if(count) count.textContent = '';
  document.body.classList.remove('is-global-searching');
  const status = document.getElementById('global-search-status');
  if(status){ status.hidden = true; status.innerHTML = ''; }
}

function renderSearchResults(query){
  const results = searchGlobalIndex(query);
  const wrapper = document.getElementById('global-search-results');
  const grid = document.getElementById('global-search-grid');
  const title = document.getElementById('global-search-title');
  const count = document.getElementById('global-search-count');
  const showAll = document.getElementById('show-all-search-results');
  if(!wrapper || !grid || !title || !count || !showAll) return;

  document.body.classList.add('is-global-searching');
  wrapper.hidden = false;
  title.textContent = `Resultados para “${query.trim()}”`;
  count.textContent = results.length === 1 ? '1 resultado encontrado' : `${results.length} resultados encontrados`;
  const visible = showAllResults ? results : results.slice(0, INITIAL_LIMIT);
  grid.innerHTML = visible.length
    ? visible.map(resultCard).join('')
    : '<div class="global-search-empty"><strong>No encontramos contenido relacionado.</strong><span>Prueba con otra palabra o revisa la escritura.</span></div>';
  showAll.hidden = results.length <= INITIAL_LIMIT || showAllResults;
  setStatus(
    results.length ? count.textContent : 'No encontramos contenido relacionado.',
    results.length ? 'Selecciona una tarjeta para abrir el contenido correcto.' : 'Prueba con otra palabra o revisa la escritura.',
  );
}

function clearSearch(input){
  window.clearTimeout(debounceTimer);
  input.value = '';
  state.query = '';
  state.categoria = 'all';
  showAllResults = false;
  document.getElementById('clear-global-search')?.setAttribute('hidden', '');
  resetSearchView();
  window.dispatchEvent(new CustomEvent('dgx:filtersChanged'));
  renderTools(true);
  input.focus();
}

export function bindSearch(){
  const input = document.getElementById('general-search-input');
  const clear = document.getElementById('clear-global-search');
  if(!input) return;
  if(!searchIndex.length) initializeGlobalSearch();

  input.addEventListener('input', event => {
    window.clearTimeout(debounceTimer);
    const query = event.target.value;
    state.query = query;
    showAllResults = false;
    clear?.toggleAttribute('hidden', !query);
    renderTools(true);
    if(!normalize(query)){
      resetSearchView();
      return;
    }
    document.body.classList.add('is-global-searching');
    setStatus('Buscando en el CMS…', 'Consultando herramientas, actividades, eventos e informativos disponibles.');
    debounceTimer = window.setTimeout(() => renderSearchResults(query), SEARCH_DELAY);
  });
  input.addEventListener('keydown', event => {
    if(event.key === 'Escape' && input.value){
      event.preventDefault();
      clearSearch(input);
      return;
    }
    if(event.key === 'ArrowDown' && normalize(input.value)){
      const firstResult = document.querySelector('#global-search-grid [data-open-search-result]');
      if(firstResult){
        event.preventDefault();
        firstResult.focus();
      }
    }
  });

  clear?.addEventListener('click', () => clearSearch(input));
  document.getElementById('show-all-search-results')?.addEventListener('click', () => {
    showAllResults = true;
    renderSearchResults(input.value);
  });
  document.getElementById('global-search-grid')?.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open-search-result]');
    if(!trigger) return;
    const item = searchIndex.find(entry => entry.item.id === trigger.dataset.openSearchResult)?.item;
    if(!item) return;
    if(item.toolId) openTool(item.toolId);
    else openContent(item, trigger);
  });
  document.getElementById('global-search-grid')?.addEventListener('keydown', event => {
    if(!['ArrowDown','ArrowUp'].includes(event.key)) return;
    const buttons = [...document.querySelectorAll('#global-search-grid [data-open-search-result]')];
    const current = buttons.indexOf(document.activeElement);
    if(current < 0) return;
    event.preventDefault();
    const next = Math.min(buttons.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
    buttons[next]?.focus();
  });
  window.addEventListener('dgx:saved-changed', () => {
    if(normalize(input.value)) renderSearchResults(input.value);
  });
}

export function searchTools(query){
  const tools = searchGlobalIndex(query).filter(item => item.toolId);
  return tools.map(item => state.herramientas.find(tool => tool.id === item.toolId)).filter(Boolean);
}

export function focusGeneralSearch(){
  const input = document.getElementById('general-search-input');
  input?.scrollIntoView({behavior:'smooth', block:'center'});
  window.setTimeout(() => input?.focus(), 250);
}
