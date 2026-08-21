import { getJSON } from './storage.js';
import { normalize } from './utils.js';

export const DATA = {
  config: './data/config.v10.json',
  identity: './data/identity.json',
  categorias: './data/categorias.v10.json',
  herramientas: './data/herramientas.v10.json',
  dashboard: './data/dashboard.v10.json',
  favoritos: './data/favoritos.v10.json',
  version: './data/version.v10.json',
  cmsBuild: './data/cms-build.v1.json',
  operacional: './data/operacional.v10.json',
  informativeResources: './data/informativo-recursos.v1.json',
  partnerDevelopment: './data/desarrollo-partner.v1.json'
};

export const state = {
  config: null,
  categorias: [],
  herramientas: [],
  dashboard: null,
  favoritosBase: [],
  version: null,
  cmsBuild: null,
  operacional: { eventos: [], actividadesDiarias: [], actividadesSemanales: [], dutyRoster: [], dutyDetail: [], checklistApertura: [], altasCurso: { bt: [], ss: [], tbw: [] }, wfm: [], informativo: [], celebraciones: [], wfmRegla: "" },
  partnerDevelopment: { actualizado: "", cursosAlta: [], tbwPendientes: [] },
  selectedStore: localStorage.getItem('dgx_selected_store') || '',
  query: '',
  categoria: localStorage.getItem('dgx_tool_category') || '',
  visibleCount: 16,
  toolMode: 'all',
  toolSort: localStorage.getItem('dgx_tool_sort') || 'cms',
  deferredPrompt: null,
  recents: getJSON('dgx_recents', []),
  usage: getJSON('dgx_usage', {}),
  favorites: getJSON('dgx_favorites', null),
  auth: getJSON('dgx_auth_profile', { enabled: false, role: 'partner', name: 'Partner' })
};

function normalizedStore(value){
  return normalize(value).replace(/^(?:cc|starbucks)\s+/, '').trim();
}

export function matchesSelectedStore(value){
  const selected = normalizedStore(state.selectedStore);
  const candidate = normalizedStore(value);
  return !selected || !candidate || ['todas','todos','distrito'].includes(candidate) || candidate === selected;
}
