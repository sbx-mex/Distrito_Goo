import { state } from './state.js';
import { loadData } from './data.js';
import { $ } from './utils.js';
import { toast } from './toast.js';
import { bindNavigation, isNavigableDestination, revealWorkspace } from './navigation.js';
import { bindPWA, bindPullToRefresh } from './pwa.js';
import { renderDashboard, renderQuickActions, renderChips, renderCategories } from './quick-actions.js';
import { renderTools, loadMoreTools } from './cards.js';
import { renderOperationalSections } from './operational.js';
import { initExperience, isContentSaved, showDetailSection } from './experience.js';
import { bindSearch } from './search.js';
import { initOperationsCenter } from './operations-center.js';

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
  bindSearch();
  initOperationsCenter();
  renderCategories();
  bindCategoryDisclosure();
  renderTools(true);
  collapseFiltersByDefault();
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
  document.addEventListener('click', handleImageViewerZoom);
  document.addEventListener('click', handleDutyDialogClick);
  document.addEventListener('change', handlePaymentAssessment);
  window.addEventListener('dgx:filtersChanged', () => { renderChips(); renderTools(true); });
  window.addEventListener('dgx:open-detail', event => openContentDetail(event.detail?.item, event.detail?.trigger));
  window.addEventListener('dgx:open-destination', event => openContentDestination(event.detail?.item, event.detail?.trigger));
  window.addEventListener('dgx:open-duty-detail', event => openDutyDetail(event.detail?.day, event.detail?.trigger));
  window.addEventListener('dgx:saved-changed', () => renderTools(false));
}


const IMAGE_LINK_PATTERN = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const DUTY_STATION_SCENES = {
  food:'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M58 174h204M80 174V83h160v91M80 115h160M112 83V55h96v28"/><path d="M111 145h43m18 0h37M137 55V37h46v18"/><path class="duty-scene-accent" d="M99 69h20m82 0h20"/></svg>',
  'show case':'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M56 177h208M72 177V66h176v111M72 105h176M72 142h176"/><path d="M97 87h36m24 0h67M99 124h48m23 0h54M98 160h77"/><path class="duty-scene-accent" d="M56 66h208"/></svg>',
  pic:'<svg viewBox="0 0 320 220" aria-hidden="true"><rect x="83" y="43" width="154" height="142" rx="18"/><path d="M118 43v-9h84v27h-84zM116 97l12 12 24-29m-36 73 12 12 24-29m25-39h31m-31 56h31"/><circle class="duty-scene-accent" cx="160" cy="116" r="82"/></svg>',
  lobby:'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M48 177h224M75 177v-62h58v62m54 0v-62h58v62M104 115V82h112v33"/><path d="M130 82V54h60v28M104 143h29m54 0h58"/><path class="duty-scene-accent" d="M91 54h138"/></svg>',
  boh:'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M55 178h210M72 178V58h176v120M72 101h176M114 58v120m91-120v120"/><path d="M84 79h18m28 0h61m28 0h17M83 133h20m28 0h60m28 0h17"/><path class="duty-scene-accent" d="M58 58h204"/></svg>',
  espresso:'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M62 55h196v68H62zM84 123v27m152-27v27M103 88h114M122 150h76v50h-76zM106 200h108"/><path d="M139 150v-21h42v21m-64 18H93v24h24m86-24h24v24h-24"/><path class="duty-scene-accent" d="M150 129c0 12-15 12-15 24m50-24c0 12-15 12-15 24"/></svg>',
  'café filtrado':'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M88 96h128v64c0 27-20 42-45 42h-38c-25 0-45-15-45-42zM216 113h20c32 0 32 46 0 46h-20M70 202h174"/><path class="duty-scene-accent" d="M123 79c-15-22 19-24 5-46m48 46c-15-22 19-24 5-46"/></svg>',
  cbs:'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M104 49h112l-13 151H117zM115 94h90M121 151h78"/><path d="M137 49V28h46v21M147 121h26"/><path class="duty-scene-accent" d="M95 49h130"/></svg>',
  'drive thru':'<svg viewBox="0 0 320 220" aria-hidden="true"><path d="M51 164h218M79 164l18-58h116l28 58M112 106l20-36h55l22 36"/><circle cx="111" cy="165" r="22"/><circle cx="221" cy="165" r="22"/><path class="duty-scene-accent" d="M134 70V43h64v27"/></svg>',
  default:'<svg viewBox="0 0 320 220" aria-hidden="true"><rect x="70" y="35" width="180" height="160" rx="22"/><path d="M70 78h180M105 23v30m110-30v30m-108 73 22 22 50-53"/><path class="duty-scene-accent" d="M197 126h26m-26 29h26"/></svg>'
};


function handlePaymentAssessment(event){
  const input = event.target.closest('[data-payment-check]');
  if(!input) return;
  const box = input.closest('[data-payment-assessment]');
  if(!box) return;
  const checks = [...box.querySelectorAll('[data-payment-check]')];
  const done = checks.filter(item => item.checked).length;
  const status = box.querySelector('[data-payment-score]');
  if(status){
    status.textContent = done === checks.length ? `Listo para enviar · ${done}/${checks.length}` : `Validación ${done}/${checks.length}`;
    status.classList.toggle('is-complete', done === checks.length);
  }
}

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
    <div class="image-viewer-toolbar" aria-label="Controles de imagen">
      <button type="button" data-image-zoom aria-pressed="false">Ampliar</button>
    </div>
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

function dutyStationsFor(day){
  const roster = (state.operacional.dutyRoster || []).find(item => String(item['Día'] || '').toLocaleLowerCase('es-MX') === String(day || '').toLocaleLowerCase('es-MX'));
  const details = (state.operacional.dutyDetail || [])
    .filter(item => String(item['Día'] || '').toLocaleLowerCase('es-MX') === String(day || '').toLocaleLowerCase('es-MX'))
    .sort((a,b) => Number(a.Orden || 0) - Number(b.Orden || 0));
  const stations = [...new Set([
    ...String(roster?.Estaciones || '').split(',').map(item => item.trim()).filter(Boolean),
    ...details.map(item => String(item.Estación || '').trim()).filter(Boolean)
  ])];
  return {roster, details, stations};
}

function dutyStationScene(station){
  const key = String(station || '').trim().toLocaleLowerCase('es-MX');
  return DUTY_STATION_SCENES[key] || DUTY_STATION_SCENES.default;
}

function dutyStationPanelMarkup(day, station, details){
  const items = details.filter(item => String(item.Estación || '').toLocaleLowerCase('es-MX') === String(station || '').toLocaleLowerCase('es-MX'));
  const critical = items.filter(item => item['Crítico'] === true || String(item['Crítico']).toLocaleLowerCase('es-MX') === 'true').length;
  return `<section class="duty-station-panel" data-duty-station-panel aria-live="polite">
    <div class="duty-station-visual">
      <span class="duty-station-svg">${dutyStationScene(station)}</span>
      <span><small>${escapeHeroText(day)}</small><strong>${escapeHeroText(station || 'Estación')}</strong><em>${items.length} punto${items.length === 1 ? '' : 's'} · ${critical} crítico${critical === 1 ? '' : 's'}</em></span>
    </div>
    <ol class="duty-station-list">
      ${items.map(item => {
        const isCritical = item['Crítico'] === true || String(item['Crítico']).toLocaleLowerCase('es-MX') === 'true';
        return `<li class="${isCritical ? 'is-critical' : ''}"><span aria-hidden="true">${item.Icono || '•'}</span><span><small>${escapeHeroText(item.Categoría || 'Actividad')}</small><strong>${escapeHeroText(item.Actividad || '')}</strong></span>${isCritical ? '<b>Crítico</b>' : ''}</li>`;
      }).join('')}
    </ol>
  </section>`;
}

function openDutyDetail(day, trigger){
  const modal = byId('quick-modal');
  if(!modal?.showModal) return;
  const {roster, details, stations} = dutyStationsFor(day);
  if(!roster || !details.length || !stations.length){
    toast('No hay actividades Duty disponibles para este día');
    return;
  }
  lastQuickModalTrigger = trigger || null;
  const critical = details.filter(item => item['Crítico'] === true || String(item['Crítico']).toLocaleLowerCase('es-MX') === 'true').length;
  const selected = stations[0];
  setText('quick-modal-title', `Duty del ${String(day).toLocaleLowerCase('es-MX')}`);
  setHtml('quick-modal-body', `<article class="duty-detail-dialog" data-duty-dialog="${escapeHeroText(day)}">
    <header class="duty-dialog-summary">
      <span>Duty del ${escapeHeroText(String(day).toLocaleLowerCase('es-MX'))}</span>
      <h2>${escapeHeroText(roster.Estaciones || 'Duty Roster')}</h2>
      <p>${escapeHeroText(roster.Enfoque || '')}</p>
      <div><b>${details.length} puntos</b><b>${critical} críticos</b><b>${stations.length} estaciones</b></div>
    </header>
    <nav class="duty-station-picker" aria-label="Seleccionar estación">
      ${stations.map((station, index) => `<button type="button" data-duty-station="${escapeHeroText(station)}" aria-pressed="${index === 0}">${escapeHeroText(station)}</button>`).join('')}
    </nav>
    ${dutyStationPanelMarkup(day, selected, details)}
  </article>`);
  document.body.classList.add('is-modal-open');
  if(!modal.open) modal.showModal();
  requestAnimationFrame(() => modal.querySelector('[data-duty-station]')?.focus({preventScroll:true}));
}

function handleDutyDialogClick(event){
  const button = event.target.closest('[data-duty-station]');
  if(!button) return;
  const dialog = button.closest('[data-duty-dialog]');
  const day = dialog?.dataset.dutyDialog || '';
  const {details} = dutyStationsFor(day);
  dialog?.querySelectorAll('[data-duty-station]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const panel = dialog?.querySelector('[data-duty-station-panel]');
  if(panel) panel.outerHTML = dutyStationPanelMarkup(day, button.dataset.dutyStation || '', details);
}

function handleImageViewerZoom(event){
  const button = event.target.closest('[data-image-zoom]');
  if(!button) return;
  const stage = button.closest('.image-viewer-stage');
  const zoomed = stage?.classList.toggle('is-zoomed');
  button.setAttribute('aria-pressed', String(Boolean(zoomed)));
  button.textContent = zoomed ? 'Ver completa' : 'Ampliar';
}

function safeDetailLink(value){
  const text = String(value || '').trim();
  if(/^assets\/docs\/[a-z0-9_ .()%-]+\.(?:pdf|pptx)$/i.test(text)) return text;
  if(!/^https?:\/\//i.test(text) || text.includes('...') || /[{}<>]/.test(text)) return '';
  try{
    const url = new URL(text);
    return /^https?:$/.test(url.protocol) && url.hostname ? url.href : '';
  }catch{
    return '';
  }
}

function openContentDestination(item, trigger){
  if(!item) return;
  const link = safeDetailLink(item.link);
  const image = item.imageOriginal || item.fullImage || '';
  if(item.section && showDetailSection(item.section)){
    toast('Sección abierta');
    return;
  }
  if(link){
    const opened = window.open(link, '_blank', 'noopener');
    if(opened) opened.opener = null;
    return;
  }
  if(image && IMAGE_LINK_PATTERN.test(image)){
    lastImageViewerTrigger = trigger || null;
    openImageViewer(item.title, image);
  }
}

function openContentDetail(item, trigger){
  if(!item) return;
  const modal = byId('quick-modal');
  if(!modal?.showModal) return;
  lastQuickModalTrigger = trigger || null;
  const link = safeDetailLink(item.link);
  const detailLink = safeDetailLink(item.detailLink);
  const fullImage = item.fullImage || item.image || '';
  const detailImage = item.imageOriginal || fullImage;
  const secondaryImage = item.secondaryImageOriginal || item.secondaryImage || '';
  const image = fullImage ? `<picture>
    ${String(fullImage).includes('.webp') ? `<source type="image/webp" srcset="${escapeHeroText(fullImage)}">` : ''}
    <img class="visual-detail-media" src="${escapeHeroText(detailImage)}" alt="${escapeHeroText(item.title)}" width="1200" height="800" decoding="async">
  </picture>` : '';
  const date = item.dateLabel ? `<p class="visual-detail-date">${escapeHeroText(item.dateLabel)}</p>` : '';
  const action = item.section && isNavigableDestination(item.section)
    ? `<button type="button" data-nav-target="${escapeHeroText(item.section)}">Ir a la sección</button>`
    : link
      ? `<a href="${escapeHeroText(link)}" target="_blank" rel="noopener">Abrir acceso</a>`
      : detailImage
        ? `<button type="button" data-image-viewer="${escapeHeroText(detailImage)}" data-image-title="${escapeHeroText(item.title)}">Ver imagen completa</button>`
        : '';
  const localDownload = /^assets\/docs\//i.test(detailLink);
  const detailAction = detailLink
    ? `<a class="visual-detail-download" href="${escapeHeroText(detailLink)}" ${localDownload ? 'download' : 'target="_blank" rel="noopener"'}>${localDownload ? 'Descargar PDF ↓' : 'Abrir recurso ↗'}</a>`
    : '';
  const secondary = secondaryImage ? `<section class="payment-secondary"><div><span class="visual-overline">Validación rápida</span><strong>¿Está lista la incidencia?</strong><p>Revisa el segundo visual antes de enviar a pago.</p></div><button type="button" data-image-viewer="${escapeHeroText(secondaryImage)}" data-image-title="Pagos Especiales · Validación rápida">Ver segunda infografía</button></section>` : '';
  const points = Array.isArray(item.points) && item.points.length ? `<section class="payment-key-points"><span class="visual-overline">Puntos clave</span><ul>${item.points.map(point => `<li>${escapeHeroText(point)}</li>`).join('')}</ul></section>` : '';
  const checklist = Array.isArray(item.checklist) && item.checklist.length ? `<section class="payment-assessment" data-payment-assessment><div class="payment-assessment-head"><div><span class="visual-overline">Autoevaluación operativa</span><strong>Antes de enviar</strong></div><span data-payment-score>Validación 0/${item.checklist.length}</span></div>${item.checklist.map((question,index) => `<label><input type="checkbox" data-payment-check><span>${index+1}</span><b>${escapeHeroText(question)}</b></label>`).join('')}</section>` : '';
  const saved = isContentSaved(item.id);
  const secondaryMeta = item.category && item.category !== item.label
    ? `<small>${escapeHeroText(item.category || item.source || '')}</small>`
    : '';
  setText('quick-modal-title', item.title || 'Detalle');
  setHtml('quick-modal-body', `<article class="visual-detail payment-special-detail">
    ${image}
    <div class="visual-detail-meta"><span class="content-badge">${escapeHeroText(item.label || 'Actualizado')}</span>${secondaryMeta}</div>
    ${date}
    <p>${escapeHeroText(item.description || item.short || '')}</p>
    ${points}
    ${secondary}
    ${checklist}
    <div class="visual-detail-actions">${action}${detailAction}<button class="${saved ? 'is-saved' : ''}" type="button" data-save-content="${escapeHeroText(item.id)}" aria-label="${escapeHeroText(saved ? `Quitar ${item.title} de Guardados` : `Guardar ${item.title}`)}" aria-pressed="${saved}"><span aria-hidden="true">${saved ? '♥' : '♡'}</span> <span class="save-content-label">${saved ? 'Guardado' : 'Guardar'}</span></button></div>
  </article>`);
  document.body.classList.add('is-modal-open');
  modal.showModal();
  requestAnimationFrame(() => modal.querySelector('a,button,input')?.focus());
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
  document.body.classList.add('app-error');
  document.body.dataset.bootError = error?.message || 'Error de arranque';
  toast(error?.message || 'No se pudo cargar Distrito Go');
});
