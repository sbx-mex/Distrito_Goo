import { escapeHtml } from './utils.js';

export function skeletonCards(count = 4){
  return Array.from({length: count}, () => '<div class="skeleton-card"></div>').join('');
}

export function emptyState(title, subtitle = 'Cambia el filtro o revisa la sección correspondiente.'){
  return `<div class="empty-state"><div class="empty-icon">☕</div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(subtitle)}</p></div></div>`;
}

export function metricCard(card){
  return `<article class="metric-card"><div class="metric-icon" aria-hidden="true">${card.icono}</div><div><div class="metric-value">${card.valor}</div><div class="metric-label">${escapeHtml(card.label)}</div></div></article>`;
}

export function quickAction(action){
  return `<button class="quick-card" type="button" data-action="${escapeHtml(action.action)}"><span aria-hidden="true">${action.icono}</span><span>${escapeHtml(action.label)}</span></button>`;
}

export function chip(c, active){
  return `<button class="chip ${active ? 'is-active' : ''}" type="button" data-category="${escapeHtml(c.id)}">${c.icono} ${escapeHtml(c.nombre)} · ${c.contador}</button>`;
}

export function categoryHub(c){
  return `<button class="category-card" type="button" data-category="${escapeHtml(c.id)}" aria-pressed="false"><span class="category-card-head"><span class="cat-icon" aria-hidden="true">${c.icono}</span><strong>${escapeHtml(c.nombre)}</strong></span><span class="category-description">${escapeHtml(c.descripcion)}</span><span class="counter">${c.contador} herramientas</span></button>`;
}

export function toolCard(tool, isFav, compact = false){
  const actionable = Boolean(tool.url || (tool.tipo === 'app' && tool.package));
  const image = tool.imagen ? `<img class="tool-image" src="./${escapeHtml(tool.imagen)}" alt="${escapeHtml(tool.nombre)}" loading="lazy" />` : '';
  const cta = actionable && tool.cta ? `<span class="tool-cta">${escapeHtml(tool.cta)} <span aria-hidden="true">↗</span></span>` : '<span class="catalog-info-state">Informativo</span>';
  const interaction = actionable ? ` tabindex="0" role="button" data-id="${escapeHtml(tool.id)}" aria-label="Abrir ${escapeHtml(tool.nombre)}"` : ' aria-label="Contenido informativo"';
  return `<article class="tool-card ${tool.imagen ? 'has-image' : ''} ${compact ? 'is-compact' : ''} ${actionable ? '' : 'is-static'}"${interaction}>${image}<div class="tool-card-body"><div class="tool-top"><div class="tool-icon" aria-hidden="true">${tool.icono}</div><span class="tool-category">${escapeHtml(tool.categoria || '')}</span></div><h4>${escapeHtml(tool.nombre)}</h4><p>${escapeHtml(tool.notas)}</p>${cta}</div></article>`;
}
