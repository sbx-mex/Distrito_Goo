import { state } from './state.js';
import { $, $$ } from './utils.js';
import { renderTools } from './cards.js';
import { focusGeneralSearch } from './search.js';
import { showDetailSection, showVisualView } from './experience.js';

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
    const input = document.getElementById('general-search-input');
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
  const requestedView = view;
  if(view === 'search') view = 'explore';
  sessionStorage.setItem(LAST_VIEW_KEY, view);
  const primary = ['home','explore','saved'].includes(view) ? view : 'explore';
  $$('.nav-item').forEach(button => {
    const active = button.dataset.view === primary;
    button.classList.toggle('is-active', active);
    button.toggleAttribute('aria-current', active);
    if(active) button.setAttribute('aria-current', 'page');
  });
  if(view === 'home') showVisualView('home');
  if(view === 'explore') showVisualView('explore');
  if(view === 'saved') showVisualView('saved');
  const detailTargets = {
    today:'dia-a-dia',
    coffee:'coffee-master-2026',
    events:'eventos-cms',
    duty:'duty-roster',
    'weekly-summary':'actualizaciones-semana',
    altas:'altas-curso',
    celebrations:'aniversarios-cumpleanos',
    informativo:'informativo',
  };
  if(detailTargets[view]) showDetailSection(detailTargets[view], smooth);
  if(requestedView === 'search'){
    revealWorkspace(false);
    focusGeneralSearch();
  }
  if(view === 'all') revealWorkspace();
  if(!['home','explore','search','saved','today','coffee','events','duty','weekly-summary','altas','celebrations','informativo','all'].includes(view)){
    showDetailSection(view, smooth);
  }
}
