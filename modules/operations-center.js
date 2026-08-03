import { matchesSelectedStore, state } from './state.js';
import { escapeHtml, normalize } from './utils.js';
import { getTodayCompletedIds, renderHomePriorities } from './experience.js';
import { renderOperationalSections } from './operational.js';
import { focusGeneralSearch } from './search.js';
import { nav } from './navigation.js';

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function dateValue(value){
  if(!value) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value = new Date()){
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value = new Date()){
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function formatShort(value){
  return value?.toLocaleDateString('es-MX', {day:'2-digit', month:'short'}).replace('.', '') || '';
}

function scopedEvents(){
  const today = startOfDay();
  return (state.operacional.eventos || [])
    .filter(item => item.Publicar !== false && matchesSelectedStore(item.Tienda))
    .map(item => ({...item, start:dateValue(item['Fecha Inicio']), end:dateValue(item['Fecha Fin']) || dateValue(item['Fecha Inicio'])}))
    .filter(item => item.end && endOfDay(item.end) >= today)
    .sort((a,b) => (a.end || 0) - (b.end || 0));
}

function todayActivities(){
  const day = DAY_NAMES[new Date().getDay()];
  const daily = (state.operacional.actividadesDiarias || [])
    .filter(item => item.Visible !== false)
    .map(item => `daily-${item.ID}`);
  const weekly = (state.operacional.actividadesSemanales || [])
    .filter(item => normalize(item['Día']) === normalize(day))
    .map(item => `weekly-${item.ID}`);
  const inventory = scopedEvents()
    .filter(item => /inventario (?:semanal|fin de mes)/i.test(item.Actividad || ''))
    .filter(item => startOfDay(item.start) <= endOfDay() && endOfDay(item.end) >= startOfDay())
    .map(item => `event-${item.ID}`);
  return [...daily, ...weekly, ...inventory];
}

function storeOptions(){
  const values = [
    ...(state.operacional.eventos || []).map(item => item.Tienda),
    ...(state.partnerDevelopment?.cursosAlta || []).map(item => item.tienda),
    ...(state.partnerDevelopment?.tbwPendientes || []).map(item => item.tienda),
    ...(state.operacional.celebraciones || []).map(item => item.TIENDA),
  ].map(value => String(value || '').trim())
    .filter(value => value && !['todas','todos','distrito'].includes(normalize(value)));
  return [...new Map(values.map(value => [normalize(value).replace(/^cc\s+/, ''), value])).values()]
    .sort((a,b) => a.localeCompare(b, 'es-MX', {sensitivity:'base'}));
}

function renderStoreSelector(){
  const select = document.getElementById('store-profile-select');
  if(!select) return;
  const options = storeOptions();
  select.innerHTML = `<option value="">Todo el distrito</option>${options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  if(state.selectedStore && !options.includes(state.selectedStore)){
    select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(state.selectedStore)}">${escapeHtml(state.selectedStore)}</option>`);
  }
  select.value = state.selectedStore;
}

function commandCard({tone, kicker, value, title, detail, target}){
  return `<button class="command-summary-card is-${tone}" type="button" data-command-target="${escapeHtml(target)}">
    <span>${escapeHtml(kicker)}</span><strong>${escapeHtml(value)}</strong><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small>
  </button>`;
}

export function renderOperationalCenter(){
  const grid = document.getElementById('command-center-grid');
  if(!grid) return;
  const now = new Date();
  const activities = todayActivities();
  const completed = getTodayCompletedIds().filter(id => activities.includes(id)).length;
  const progress = activities.length ? Math.round((completed / activities.length) * 100) : 0;
  const events = scopedEvents();
  const active = events.filter(item => item.start && startOfDay(item.start) <= endOfDay(now) && endOfDay(item.end) >= startOfDay(now));
  const soonLimit = new Date(now); soonLimit.setDate(now.getDate() + 3);
  const dueSoon = events.filter(item => item.end <= endOfDay(soonLimit)).length;
  const inventory = events.find(item => /inventario (?:semanal|fin de mes)/i.test(item.Actividad || ''));
  const development = [
    ...(state.partnerDevelopment?.cursosAlta || []),
    ...(state.partnerDevelopment?.tbwPendientes || []),
  ].filter(item => matchesSelectedStore(item.tienda));
  const profile = state.selectedStore || 'Todo el distrito';
  const inventoryDetail = inventory ? `${inventory.Actividad} · ${formatShort(inventory.start)}` : 'Sin inventario próximo publicado';
  grid.innerHTML = [
    commandCard({tone:progress === 100 ? 'success' : 'focus', kicker:'Avance diario', value:`${progress}%`, title:`${completed} de ${activities.length} completadas`, detail:'Se reinicia cada día', target:'daily-routine-title'}),
    commandCard({tone:inventory ? 'warning' : 'neutral', kicker:'Agenda', value:inventory ? formatShort(inventory.start) : 'Al día', title:inventory ? inventory.Actividad : 'Sin inventario próximo', detail:inventoryDetail, target:'weekly-activity-title'}),
    commandCard({tone:dueSoon ? 'danger' : 'success', kicker:'Vencimientos', value:String(dueSoon), title:`${active.length} eventos activos`, detail:dueSoon ? 'Revisa los próximos 3 días' : 'Sin vencimientos cercanos', target:'eventos-cms'}),
    commandCard({tone:'people', kicker:'Desarrollo', value:String(development.length), title:'Registros vigentes', detail:profile, target:'altas-curso'}),
  ].join('');
  const summary = document.getElementById('command-center-summary');
  if(summary) summary.textContent = `${profile} · ${activities.length} actividades operativas · ${events.length} eventos vigentes o próximos.`;
}

function updateSystemStatus(){
  const online = navigator.onLine;
  const cms = document.getElementById('cms-status');
  const sync = document.getElementById('sync-status');
  const version = document.getElementById('version-status');
  if(cms) cms.innerHTML = `<i aria-hidden="true"></i> CMS ${escapeHtml(state.cmsBuild?.generatedAt || 'vigente')}`;
  if(sync) sync.textContent = online ? 'En línea · datos sincronizados' : 'Sin conexión · usando datos guardados';
  if(version) version.textContent = state.config?.version || 'Distrito Go';
  document.getElementById('command-center')?.classList.toggle('is-offline', !online);
}

function updateContextTrail(){
  const trail = document.getElementById('context-trail');
  const current = document.getElementById('context-trail-current');
  const view = document.body.dataset.appView || 'home';
  const detail = document.body.dataset.detailTarget || '';
  const labels = {home:'Inicio', explore:'Explorar', saved:'Guardados', 'dia-a-dia':'Día operativo', 'eventos-cms':'Eventos', 'altas-curso':'Desarrollo Partner', 'duty-roster':'Duty Roster', 'aniversarios-cumpleanos':'Celebraciones'};
  if(!trail || !current) return;
  trail.hidden = view === 'home' && !detail;
  current.textContent = labels[detail] || labels[view] || 'Detalle';
}

function openTarget(id){
  if(id === 'daily-routine-title' || id === 'weekly-activity-title'){
    nav('home');
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({behavior:'smooth', block:'start'}));
    return;
  }
  nav(id);
}

export function initOperationsCenter(){
  renderStoreSelector();
  renderOperationalCenter();
  updateSystemStatus();
  updateContextTrail();
  document.getElementById('store-profile-select')?.addEventListener('change', event => {
    state.selectedStore = event.target.value;
    localStorage.setItem('dgx_selected_store', state.selectedStore);
    renderOperationalCenter();
    renderOperationalSections();
    renderHomePriorities();
    window.dispatchEvent(new CustomEvent('dgx:store-changed', {detail:{store:state.selectedStore}}));
  });
  document.getElementById('command-center-grid')?.addEventListener('click', event => {
    const target = event.target.closest('[data-command-target]');
    if(target) openTarget(target.dataset.commandTarget);
  });
  document.getElementById('header-search')?.addEventListener('click', () => {
    nav('explore');
    window.setTimeout(focusGeneralSearch, 180);
  });
  document.querySelector('[data-context-home]')?.addEventListener('click', () => nav('home'));
  window.addEventListener('dgx:completion-changed', renderOperationalCenter);
  window.addEventListener('online', updateSystemStatus);
  window.addEventListener('offline', updateSystemStatus);
  window.addEventListener('dgx:navigation-changed', updateContextTrail);
  new MutationObserver(updateContextTrail).observe(document.body, {attributes:true, attributeFilter:['data-app-view','data-detail-target']});
}
