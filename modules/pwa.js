import { state } from './state.js';
import { $ } from './utils.js';
import { toast } from './toast.js';

let waitingWorker = null;

function showUpdate(registration){
  waitingWorker = registration.waiting;
  const banner = $('#update-banner');
  if(banner) banner.hidden = false;
}

export function bindPWA(){
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); state.deferredPrompt = e;
  });
  window.addEventListener('dgx:install', installPWA);
  $('#apply-update')?.addEventListener('click', () => {
    if(!waitingWorker) return;
    sessionStorage.setItem('dgx_allow_sw_reload', '1');
    waitingWorker.postMessage({type:'SKIP_WAITING'});
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js?v=53.0.0', {updateViaCache:'none'}).then(reg => {
      if(reg.waiting) showUpdate(reg);
      reg.update().catch(() => {});
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if(worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(reg);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if(sessionStorage.getItem('dgx_allow_sw_reload') !== '1') return;
        sessionStorage.removeItem('dgx_allow_sw_reload');
        location.reload();
      });
    }).catch(error => console.warn('[Distrito Go] Service worker no disponible', error));
  }
}

export async function installPWA(){
  if(!state.deferredPrompt){ toast('Agrega Distrito Go desde el menú del navegador'); return; }
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
}

export function bindPullToRefresh(){
  let startY = 0; let pulling = false;
  const indicator = $('#pull-indicator');
  window.addEventListener('touchstart', e => { if(scrollY === 0) startY = e.touches[0].clientY; }, {passive:true});
  window.addEventListener('touchmove', e => {
    if(scrollY === 0 && e.touches[0].clientY - startY > 82){ pulling = true; indicator?.classList.add('show'); }
  }, {passive:true});
  window.addEventListener('touchend', () => {
    if(pulling) location.reload();
    pulling = false; indicator?.classList.remove('show');
  });
}
