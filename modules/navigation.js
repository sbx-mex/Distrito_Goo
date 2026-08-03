import { state } from './state.js';
import { $, $$ } from './utils.js';
import { renderTools } from './cards.js';
import { showDetailSection, showVisualView } from './experience.js';

const LAST_VIEW_KEY = 'dgx_last_view';
const PRIMARY_VIEWS = ['home','explore','saved'];

function prefersReducedMotion(){
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function scrollBehavior(smooth = true){
  return smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
}

function focusViewTarget(view){
  const targets = {
    home:document.getElementById('visual-home-title'),
    explore:document.getElementById('explore-view-title'),
    saved:document.getElementById('saved-title'),
  };
  const target = targets[view];
  if(!target) return;
  target.setAttribute('tabindex', '-1');
  target.focus({preventScroll:true});
  target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once:true});
}

export function bindNavigation(){
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => nav(btn.dataset.view)));
  const primaryNav = document.querySelector('.bottom-nav');
  primaryNav?.addEventListener('keydown', event => {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const buttons = [...primaryNav.querySelectorAll('.nav-item')];
    const current = Math.max(0, buttons.indexOf(document.activeElement));
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  });
  document.body.addEventListener('click', event => {
    const target = event.target.closest('[data-nav-target]');
    if(!target) return;
    const destination = String(target.dataset.navTarget || '').trim();
    if(!isNavigableDestination(destination)){
      target.remove();
      return;
    }
    document.getElementById('quick-modal')?.close();
    requestAnimationFrame(() => nav(destination));
  });
  const savedView = sessionStorage.getItem(LAST_VIEW_KEY);
  if(savedView && savedView !== 'home') requestAnimationFrame(() => nav(savedView, false));
  const showAll = $('#show-all');
  if(showAll) showAll.addEventListener('click', () => {
    revealWorkspace(false);
    state.categoria = 'all'; state.query = '';
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
  view = String(view || '').trim();
  if(!view) return false;
  sessionStorage.setItem(LAST_VIEW_KEY, view);
  const primary = PRIMARY_VIEWS.includes(view) ? view : 'explore';
  $$('.nav-item').forEach(button => {
    const active = button.dataset.view === primary;
    button.classList.toggle('is-active', active);
    button.toggleAttribute('aria-current', active);
    if(active) button.setAttribute('aria-current', 'page');
  });
  if(view === 'home') showVisualView('home');
  if(view === 'explore') showVisualView('explore');
  if(view === 'saved') showVisualView('saved');
  if(PRIMARY_VIEWS.includes(view)) requestAnimationFrame(() => focusViewTarget(view));
  const detailTargets = {
    today:'dia-a-dia',
    coffee:'informativo',
    events:'eventos-cms',
    duty:'duty-roster',
    'weekly-summary':'informativo',
    altas:'altas-curso',
    celebrations:'aniversarios-cumpleanos',
    informativo:'informativo',
  };
  if(detailTargets[view] === 'informativo'){
    showVisualView('home');
    requestAnimationFrame(() => {
      const target = document.getElementById('informativo');
      target?.scrollIntoView({behavior:scrollBehavior(smooth), block:'start'});
      target?.classList.add('is-destination-highlight');
      window.setTimeout(() => target?.classList.remove('is-destination-highlight'), 1800);
    });
  }else if(detailTargets[view]){
    showDetailSection(detailTargets[view], smooth);
  }
  if(view === 'all') revealWorkspace();
  if(!['home','explore','saved','today','coffee','events','duty','weekly-summary','altas','celebrations','informativo','all'].includes(view)){
    const navigated = navigateToSection(view, smooth);
    window.dispatchEvent(new CustomEvent('dgx:navigation-changed', {detail:{view}}));
    return navigated;
  }
  window.dispatchEvent(new CustomEvent('dgx:navigation-changed', {detail:{view}}));
  return true;
}

function navigateToSection(id, smooth = true){
  const target = document.getElementById(id);
  if(!target) return false;
  if(target.closest('#visual-home')){
    showVisualView('home');
    requestAnimationFrame(() => {
      target.scrollIntoView({behavior:scrollBehavior(smooth), block:'start'});
      target.classList.add('is-destination-highlight');
      window.setTimeout(() => target.classList.remove('is-destination-highlight'), 1800);
    });
    return true;
  }
  return showDetailSection(id, smooth);
}

export function isNavigableDestination(id){
  const target = document.getElementById(String(id || '').trim());
  return Boolean(target && target.closest('.app-shell'));
}
