import { state } from './state.js';
import { $, $$, escapeHtml } from './utils.js';
import { categoryHub, chip } from './components.js';
import { renderTools } from './cards.js';
import { focusGeneralSearch } from './search.js';
import { toast } from './toast.js';
import { goToSection } from './operational.js';
import { revealWorkspace } from './navigation.js';

export function renderDashboard(){
  // Premium: sin métricas redundantes; el foco vive en los bloques accionables.
}

export function renderQuickActions(){
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6); weekEnd.setHours(23,59,59,999);
  const eventosSemana = (state.operacional.eventos || []).filter(e => {
    const start = new Date(`${e['Fecha Inicio']}T00:00:00`);
    const end = new Date(`${e['Fecha Fin'] || e['Fecha Inicio']}T23:59:59`);
    return end >= weekStart && start <= weekEnd;
  }).length;
  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const duty = (state.operacional.dutyRoster || []).find(d => d['Día'] === dayNames[today.getDay()]);
  const cards = [
    {title:'Día operativo', icon:'✅', text:'Rutina, WFM y foco semanal.', action:'showToday'},
    {title:'Duty Roster', icon:'🧭', text:duty ? `${duty['Día']}: ${duty.Estaciones}` : 'Imagen y detalle del día.', action:'showDuty'},
    {title:'Herramientas', icon:'🧰', text:'Abre apps por categoría.', action:'showTools'},
    {title:'Eventos activos', icon:'📅', text:'Recordatorios próximos.', action:'showEvents', badge:eventosSemana ? `${eventosSemana} semana` : ''}
  ];
  const commandGrid = document.getElementById('command-grid');
  if(!commandGrid) return;
  commandGrid.innerHTML = cards.map(c => `<button class="command-card" type="button" data-action="${c.action}"><span class="command-icon">${c.icon}</span><strong>${escapeHtml(c.title)}</strong><p>${escapeHtml(c.text)}</p>${c.badge?`<em>${escapeHtml(c.badge)}</em>`:''}</button>`).join('');
  $$('#command-grid .command-card').forEach(btn => btn.addEventListener('click', () => runAction(btn.dataset.action)));
}

export function renderChips(){
  const chips = [
    { id:'all', nombre:'Todo', icono:'🧭', contador: state.herramientas.length },
    ...state.categorias.map(c => ({...c, contador: state.herramientas.filter(t => t.categoriaId === c.id).length}))
  ];
  const activeChips = document.getElementById('active-chips');
  if(!activeChips) return;
  activeChips.innerHTML = chips.map(c => chip(c, state.categoria === c.id)).join('');
  $$('.chip').forEach(el => el.addEventListener('click', () => {
    state.categoria = el.dataset.category;
    renderChips(); renderTools(true);
  }));
}

export function renderCategories(){
  const available = state.categorias
    .map(c => ({...c, contador: state.herramientas.filter(t => t.categoriaId === c.id).length}))
    .filter(c => c.contador > 0);
  const withCounts = [
    {id:'all', nombre:'Todas', icono:'⌁', descripcion:'Consulta el catálogo completo.', contador:state.herramientas.length},
    ...available
  ];
  const categoryHubs = document.getElementById('category-hubs');
  if(!categoryHubs) return;
  categoryHubs.innerHTML = withCounts.map(categoryHub).join('');
  $$('.category-card').forEach(card => {
    card.classList.toggle('is-active', state.categoria === card.dataset.category);
    card.setAttribute('aria-pressed', String(state.categoria === card.dataset.category));
    card.addEventListener('click', () => {
    revealWorkspace(false);
    state.categoria = card.dataset.category;
    localStorage.setItem('dgx_tool_category', state.categoria);
    $$('.category-card').forEach(item => {
      const active = item.dataset.category === state.categoria;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    const clear = document.getElementById('clear-tool-filter');
    if(clear) clear.hidden = false;
    renderChips(); renderTools(true);
    document.querySelector('.tools-section').scrollIntoView({behavior:'smooth', block:'start'});
  });
  });
}

export function runAction(action){
  if(action === 'openSearch'){
    revealWorkspace(false);
    focusGeneralSearch();
  }
  if(action === 'showToday') goToSection('dia-a-dia');
  if(action === 'showEvents') goToSection('eventos-cms');
  if(action === 'showAltas') goToSection('altas-curso');
  if(action === 'showDuty') goToSection('duty-roster');
  if(action === 'showTools') revealWorkspace();
  if(action === 'refreshData') location.reload();
  if(!['openSearch','showToday','showEvents','showAltas','showDuty','refreshData','showTools'].includes(action)) toast('Acción preparada');
}
