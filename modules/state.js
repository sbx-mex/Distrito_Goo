import { getJSON } from './storage.js';

export const DATA = {
  config: './data/config.v10.json',
  identity: './data/identity.json',
  categorias: './data/categorias.v10.json',
  herramientas: './data/herramientas.v10.json',
  dashboard: './data/dashboard.v10.json',
  favoritos: './data/favoritos.v10.json',
  version: './data/version.v10.json',
  operacional: './data/operacional.v10.json'
};

export const state = {
  config: null,
  categorias: [],
  herramientas: [],
  dashboard: null,
  favoritosBase: [],
  version: null,
  operacional: { eventos: [], actividadesDiarias: [], actividadesSemanales: [], dutyRoster: [], dutyDetail: [], checklistApertura: [], altasCurso: { bt: [], ss: [], tbw: [] }, wfm: [], informativo: [], celebraciones: [], wfmRegla: "" },
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
