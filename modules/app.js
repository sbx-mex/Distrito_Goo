import { state } from './state.js';
import { loadData } from './data.js';
import { $ } from './utils.js';
import { toast } from './toast.js';
import { bindSearch } from './search.js';
import { bindNavigation, revealWorkspace } from './navigation.js';
import { bindPWA, bindPullToRefresh } from './pwa.js';
import { renderDashboard, renderQuickActions, renderChips, renderCategories } from './quick-actions.js';
import { renderTools, loadMoreTools } from './cards.js';
import { renderOperationalSections } from './operational.js';
import { initExperience, isContentSaved, showDetailSection } from './experience.js';

function byId(id){ return document.getElementById(id); }
function setText(id, value){ const el = byId(id); if(el) el.textContent = value; }
function setHtml(id, value){ const el = byId(id); if(el) el.innerHTML = value; }
let lastImageViewerTrigger = null;
let lastQuickModalTrigger = null;

async function boot(){
  bindStaticEvents();
  await loadData();
  renderHeader();
  renderDashboard();
  renderQuickActions();
  renderChips();
  renderOperationalSections();
  initExperience();
  renderCategories();
  bindCategoryDisclosure();
  renderTools(true);
  collapseFiltersByDefault();
  bindSearch();
  bindToolControls();
  bindNavigation();
  bindPWA();
  bindPullToRefresh();
  bindLazyLoading();
  bindBearistaInformativo();
  document.body.classList.add('app-ready');
}

function bindCategoryDisclosure(){
  const clear = byId('clear-tool-filter');
  if(!clear) return;
  clear.hidden = !state.categoria;
  clear.addEventListener('click', () => {
    state.categoria = '';
    localStorage.removeItem('dgx_tool_category');
    document.querySelectorAll('.category-card').forEach(item => {
      item.classList.remove('is-active');
      item.setAttribute('aria-pressed', 'false');
    });
    clear.hidden = true;
    renderTools(true);
    byId('categories-title')?.focus?.({preventScroll:true});
  });
}

function bindToolControls(){
  document.querySelectorAll('[data-tool-mode]').forEach(button => {
    button.addEventListener('click', () => {
      state.toolMode = button.dataset.toolMode || 'all';
      document.querySelectorAll('[data-tool-mode]').forEach(item => item.classList.toggle('is-active', item === button));
      renderTools(true);
    });
  });
  const sort = byId('tool-sort');
  if(sort){
    sort.value = state.toolSort;
    sort.addEventListener('change', () => {
      state.toolSort = sort.value;
      localStorage.setItem('dgx_tool_sort', state.toolSort);
      renderTools(true);
    });
  }
}

function getPartnerGreeting(now = new Date()){
  const hour = now.getHours();
  const greeting = state.identity?.hero?.greeting || {};
  if(hour < 12) return greeting.morning || '';
  if(hour < 19) return greeting.afternoon || '';
  return greeting.evening || '';
}

const HERO_ICONS = {
  goal: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 40V8m0 4h23l-7 8 7 8H12"/><path d="M7 40h10"/></svg>',
  experience: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="27" cy="9" r="4"/><path d="m22 17 8 4 7 8m-14-11-6 10-8 3m14-3-3 11-9 2m14-12 8 10"/></svg>',
  team: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="14" r="6"/><circle cx="10" cy="20" r="4"/><circle cx="38" cy="20" r="4"/><path d="M14 39c0-7 4-11 10-11s10 4 10 11M3 38c0-6 3-9 8-9 2 0 4 1 5 2m29 7c0-6-3-9-8-9-2 0-4 1-5 2"/></svg>',
  results: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 30 9 33l5-8c1-7 7-14 21-17-1 14-8 20-15 21Z"/><path d="m19 29-5 10m8-14 7-7"/><circle cx="30" cy="17" r="2"/></svg>'
};

function escapeHeroText(value){
  return String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function renderHeroContent(){
  const hero = state.identity?.hero || {};
  const journey = Array.isArray(hero.journey) ? hero.journey : [];
  const journeyEl = byId('hero-journey');
  if(journeyEl){
    journeyEl.innerHTML = journey.map((step, index) => `<li class="hero-step">
      <span class="hero-step-icon">${HERO_ICONS[step.icon] || HERO_ICONS.goal}</span>
      <strong>${escapeHeroText(step.title)}</strong><span>${escapeHeroText(step.description)}</span>
      ${index < journey.length - 1 ? '<i class="hero-step-arrow" aria-hidden="true">→</i>' : ''}
    </li>`).join('');
  }
  const district = hero.districtMessage || {};
  const districtEl = byId('hero-district-message');
  if(districtEl){
    districtEl.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg><span><strong>${escapeHeroText(district.title)}</strong>: ${escapeHeroText(district.message)}</span>`;
  }
  const targets = { priorities: 'start-day', tools: 'open-tools-panel' };
  (Array.isArray(hero.actions) ? hero.actions : []).forEach(action => setText(targets[action.action], action.label || ''));
}

function renderHeader(){
  setText('app-title', state.config.appName);

  const campaign = state.identity?.hero?.campaign || {};
  setText('hero-title', getPartnerGreeting());
  setText('hero-campaign-primary', campaign.primary || '');
  setText('hero-campaign-accent', campaign.accent || '');
  const hashtags = Array.isArray(state.identity?.hero?.hashtags) ? state.identity.hero.hashtags : [];
  setText('hero-hashtags', hashtags.join(' · '));
  setText('workspace-campaign', campaign.display || [campaign.primary, campaign.accent].filter(Boolean).join(' '));

  const campaignEl = byId('hero-campaign');
  if(campaignEl){
    campaignEl.style.setProperty('--campaign-primary', campaign.primaryColor || '#006241');
    campaignEl.style.setProperty('--campaign-accent', campaign.accentColor || '#111111');
  }

  renderHeroContent();

  updateClock();
  setInterval(updateClock, 60000);
}

function updateClock(){
  const now = new Date();
  const date = now.toLocaleDateString('es-MX', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  const time = now.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit', hour12:true})
    .replace(/a\.\s?m\./i, 'a.m.').replace(/p\.\s?m\./i, 'p.m.');
  setText('hero-title', getPartnerGreeting(now));
  setText('hero-date', `${date} · ${time}`);
}

function bindStaticEvents(){
  byId('start-day')?.addEventListener('click', () => byId('dia-a-dia')?.scrollIntoView({behavior:'smooth', block:'start'}));
  byId('open-tools-panel')?.addEventListener('click', revealWorkspace);
  const toggleTools = $('#toggle-tools');
  if(toggleTools) toggleTools.addEventListener('click', revealWorkspace);
  const toggleFilters = $('#toggle-filters');
  if(toggleFilters){
    toggleFilters.addEventListener('click', () => {
      const panel = $('#tool-workspace');
      const collapsed = panel.classList.toggle('filters-collapsed');
      toggleFilters.textContent = collapsed ? 'Mostrar filtros' : 'Ocultar filtros';
      toggleFilters.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  byId('close-quick-modal')?.addEventListener('click', closeQuickModal);
  byId('quick-modal')?.addEventListener('click', event => {
    if(event.target === byId('quick-modal')) closeQuickModal();
  });
  byId('quick-modal')?.addEventListener('close', resetImageViewer);
  document.addEventListener('click', handleImageViewerClick);
  window.addEventListener('dgx:filtersChanged', () => { renderChips(); renderTools(true); });
  window.addEventListener('dgx:open-detail', event => openContentDetail(event.detail?.item, event.detail?.trigger));
  window.addEventListener('dgx:open-destination', event => openContentDestination(event.detail?.item, event.detail?.trigger));
  window.addEventListener('dgx:saved-changed', () => renderTools(false));
}


const IMAGE_LINK_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

function closeQuickModal(){
  const modal = byId('quick-modal');
  if(!modal) return;
  if(modal.open) modal.close();
  else resetImageViewer();
}

function resetImageViewer(){
  const modal = byId('quick-modal');
  if(!modal) return;
  document.body.classList.remove('is-modal-open');
  modal.classList.remove('is-image-viewer');
  modal.removeAttribute('data-image-orientation');
  modal.classList.remove('is-navigation-menu');
  setHtml('quick-modal-body', '');
  const trigger = lastImageViewerTrigger?.isConnected ? lastImageViewerTrigger : lastQuickModalTrigger;
  lastImageViewerTrigger = null;
  lastQuickModalTrigger = null;
  if(trigger?.isConnected) requestAnimationFrame(() => trigger.focus({preventScroll:true}));
}

function openImageViewer(title, src){
  if(!src) return;
  const modal = byId('quick-modal');
  if(!modal?.showModal) return;
  setText('quick-modal-title', title || 'Imagen');
  const safeTitle = escapeHeroText(title || 'Imagen');
  const safeSrc = escapeHeroText(src);
  setHtml('quick-modal-body', `<div class="image-viewer-stage">
    <img class="modal-image image-viewer-media" src="${safeSrc}" alt="${safeTitle}" loading="eager" decoding="async"/>
  </div>`);
  modal.classList.add('is-image-viewer');
  document.body.classList.add('is-modal-open');
  if(!modal.open) modal.showModal();
  const image = modal.querySelector('.image-viewer-media');
  image?.addEventListener('load', () => {
    const orientation = image.naturalHeight > image.naturalWidth ? 'portrait' : image.naturalHeight === image.naturalWidth ? 'square' : 'landscape';
    modal.dataset.imageOrientation = orientation;
  }, {once:true});
  requestAnimationFrame(() => byId('close-quick-modal')?.focus({preventScroll:true}));
}

function safeDetailLink(value){
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text : '';
}

function openContentDestination(item, trigger){
  if(!item) return;
  const link = safeDetailLink(item.link);
  const image = item.imageOriginal || item.fullImage || '';
  if(item.section && showDetailSection(item.section)){
    toast('Sección abierta');
    return;
  }
  if(image && IMAGE_LINK_PATTERN.test(image)){
    lastImageViewerTrigger = trigger || null;
    openImageViewer(item.title, image);
    return;
  }
  if(link){
    const opened = window.open(link, '_blank', 'noopener');
    if(opened) opened.opener = null;
  }
}

function openContentDetail(item, trigger){
  if(!item) return;
  const modal = byId('quick-modal');
  if(!modal?.showModal) return;
  lastQuickModalTrigger = trigger || null;
  const link = safeDetailLink(item.link);
  const fullImage = item.fullImage || item.image || '';
  const detailImage = item.imageOriginal || fullImage;
  const image = fullImage ? `<picture>
    ${String(fullImage).includes('.webp') ? `<source type="image/webp" srcset="${escapeHeroText(fullImage)}">` : ''}
    <img class="visual-detail-media" src="${escapeHeroText(detailImage)}" alt="${escapeHeroText(item.title)}" width="1200" height="800" decoding="async">
  </picture>` : '';
  const date = item.dateLabel ? `<p class="visual-detail-date">${escapeHeroText(item.dateLabel)}</p>` : '';
  const action = item.section && byId(item.section)
    ? `<button type="button" data-nav-target="${escapeHeroText(item.section)}">Ir a la sección</button>`
    : detailImage
      ? `<button type="button" data-image-viewer="${escapeHeroText(detailImage)}" data-image-title="${escapeHeroText(item.title)}">Ver imagen completa</button>`
      : link
        ? `<a href="${escapeHeroText(link)}" target="_blank" rel="noopener">Abrir recurso</a>`
        : '';
  const saved = isContentSaved(item.id);
  const secondaryMeta = item.category && item.category !== item.label
    ? `<small>${escapeHeroText(item.category || item.source || '')}</small>`
    : '';
  setText('quick-modal-title', item.title || 'Detalle');
  setHtml('quick-modal-body', `<article class="visual-detail">
    ${image}
    <div class="visual-detail-meta"><span class="content-badge">${escapeHeroText(item.label || 'Actualizado')}</span>${secondaryMeta}</div>
    ${date}
    <p>${escapeHeroText(item.description || item.short || '')}</p>
    <div class="visual-detail-actions">${action}<button class="${saved ? 'is-saved' : ''}" type="button" data-save-content="${escapeHeroText(item.id)}" aria-label="${escapeHeroText(saved ? `Quitar ${item.title} de Guardados` : `Guardar ${item.title}`)}" aria-pressed="${saved}"><span aria-hidden="true">${saved ? '♥' : '♡'}</span> <span class="save-content-label">${saved ? 'Guardado' : 'Guardar'}</span></button></div>
  </article>`);
  document.body.classList.add('is-modal-open');
  modal.showModal();
  requestAnimationFrame(() => modal.querySelector('a,button')?.focus());
}

function handleImageViewerClick(event){
  const trigger = event.target.closest('[data-image-viewer],[data-image],[data-campaign-modal],[data-bearista-modal],a[href]');
  if(!trigger) return;
  let src = trigger.dataset.imageViewer || trigger.dataset.image || trigger.dataset.campaignModal || trigger.dataset.bearistaModal || '';
  if(!src && trigger.matches('a[href]')){
    const href = trigger.getAttribute('href') || '';
    if(!IMAGE_LINK_PATTERN.test(href)) return;
    src = href;
  }
  if(!src) return;
  event.preventDefault();
  event.stopPropagation();
  lastImageViewerTrigger = trigger;
  const nestedImage = trigger.querySelector('img');
  const title = trigger.dataset.imageTitle || trigger.dataset.title || nestedImage?.alt || trigger.getAttribute('aria-label') || 'Imagen';
  openImageViewer(title, src);
}


function collapseFiltersByDefault(){
  const panel = $('#tool-workspace');
  const toggleFilters = $('#toggle-filters');
  if(!panel || !toggleFilters) return;
  panel.classList.add('filters-collapsed');
  toggleFilters.textContent = 'Mostrar filtros';
  toggleFilters.setAttribute('aria-expanded', 'false');
}

function bindBearistaInformativo(){
  const card = $('#bearista-informativo');
  if(!card) return;
  const now = new Date();
  const start = new Date('2026-07-05T00:00:00');
  const end = new Date('2026-07-07T00:00:00');
  const force = new URLSearchParams(window.location.search).get('bearista') === '1';
  const active = force || (now >= start && now < end);
  if(!active){
    card.remove();
    return;
  }
  card.classList.remove('hidden');
  if(localStorage.getItem('dgx_bearista_hugger_closed') === '1') card.classList.add('is-collapsed');
  const close = $('#bearista-close');
  if(close){
    close.addEventListener('click', () => {
      localStorage.setItem('dgx_bearista_hugger_closed', '1');
      card.classList.add('is-collapsed');
      toast('Informativo minimizado');
    });
  }
}

function bindLazyLoading(){
  const sentinel = $('#lazy-sentinel');
  if(!sentinel) return;
  const observer = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)) loadMoreTools();
  }, {rootMargin:'360px'});
  observer.observe(sentinel);
}

window.addEventListener('online', () => updateConnectionState());
window.addEventListener('offline', () => updateConnectionState());
function updateConnectionState(){
  const el = byId('connection-status');
  if(!el) return;
  el.hidden = navigator.onLine;
  el.textContent = navigator.onLine ? '' : 'Sin conexión · usando contenido disponible';
}
updateConnectionState();

boot().catch(error => {
  console.error('[Distrito Go] Falló el arranque de la aplicación:', error);
  toast(error?.message || 'No se pudo cargar Distrito Go');
});
