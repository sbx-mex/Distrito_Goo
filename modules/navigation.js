import { state } from './state.js';
import { $, $$ } from './utils.js';
import { renderTools } from './cards.js';
import { openSpotlight } from './search.js';
import { showVisualView } from './experience.js';

const LAST_VIEW_KEY = 'dgx_last_view';

export function bindNavigation(){
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => nav(btn.dataset.view)));
  document.body.addEventListener('click', event => {
    const target = event.target.closest('[data-nav-target]');
    if(!target) return;
    document.getElementById('quick-modal')?.close();
    nav(target.dataset.navTarget);
  });
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
  if(view === 'more'){
    window.dispatchEvent(new CustomEvent('dgx:open-navigation', {detail:{trigger:document.querySelector('[data-view="more"]')}}));
    return;
  }
  sessionStorage.setItem(LAST_VIEW_KEY, view);
  const primary = ['home','explore','search','saved'].includes(view) ? view : 'explore';
  $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === primary));
  if(view === 'home') showVisualView('home');
  if(view === 'explore') showVisualView('explore');
  if(view === 'saved') showVisualView('saved');
  if(view === 'today') document.getElementById('dia-a-dia')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'coffee') document.getElementById('coffee-master-2026')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'events') document.getElementById('eventos-cms')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'duty') document.getElementById('duty-roster')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'weekly-summary') document.getElementById('actualizaciones-semana')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'altas') document.getElementById('altas-curso')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'celebrations') document.getElementById('aniversarios-cumpleanos')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'informativo') document.getElementById('informativo')?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  if(view === 'search') openSpotlight();
  if(view === 'all') revealWorkspace();
  if(!['home','explore','search','saved','today','coffee','events','duty','weekly-summary','altas','celebrations','informativo','all','more'].includes(view)){
    document.getElementById(view)?.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  }
}
