import { state } from './state.js';
import { $, $$ } from './utils.js';
import { renderTools } from './cards.js';
import { openSpotlight } from './search.js';

const LAST_VIEW_KEY = 'dgx_last_view';

export function bindNavigation(){
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => nav(btn.dataset.view)));
  const savedView = sessionStorage.getItem(LAST_VIEW_KEY);
  if(savedView && savedView !== 'home') requestAnimationFrame(() => nav(savedView, false));
  const showAll = $('#show-all');
  if(showAll) showAll.addEventListener('click', () => {
    revealWorkspace(false);
    state.categoria = 'all'; state.query = '';
    const input = document.getElementById('spotlight-input');
    if(input) input.value = '';
    window.dispatchEvent(new CustomEvent('dgx:filtersChanged'));
    renderTools(true);
  });
}

export function revealWorkspace(scroll = true){
  const section = $('#tool-workspace');
  const body = $('#workspace-body');
  if(body && body.hidden){
    body.hidden = false;
    section.classList.remove('is-collapsed');
    const toggle = $('#toggle-tools');
    if(toggle) toggle.textContent = 'Herramientas abiertas';
  }
  if(scroll && section) section.scrollIntoView({behavior:'smooth', block:'start'});
}

export function nav(view, smooth = true){
  sessionStorage.setItem(LAST_VIEW_KEY, view);
  $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
  if(view === 'home') window.scrollTo({top:0, behavior: smooth ? 'smooth' : 'auto'});
  if(view === 'today') document.getElementById('dia-a-dia')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'coffee') document.getElementById('coffee-master-2026')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'events') document.getElementById('eventos-cms')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'duty') document.getElementById('duty-roster')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'weekly-summary') document.getElementById('resumen-comunicado-semana-actual')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'altas') document.getElementById('altas-curso')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'search') openSpotlight();
  if(view === 'all') revealWorkspace();
}
