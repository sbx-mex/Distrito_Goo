import { state } from './state.js';
import { normalize } from './utils.js';
import { renderTools } from './cards.js';

export function bindSearch(){
  const searchInput = document.getElementById('general-search-input');
  searchInput?.addEventListener('input', e => {
    state.query = e.target.value;
    renderTools(true);
  });
}

export function searchTools(query){
  const q = normalize(query);
  if(!q) return state.herramientas;
  const terms = q.split(/\s+/).filter(Boolean);
  return state.herramientas
    .map(tool => {
      const name = normalize(tool.nombre);
      const category = normalize(tool.categoria);
      const keywords = normalize((tool.keywords || []).join(' '));
      const meta = normalize([tool.notas, tool.grupo, tool.tipo, tool.url, tool.webUrl, tool.alias, tool.etiquetas, tool.funcion].join(' '));
      const haystack = `${name} ${category} ${keywords} ${meta}`;
      let score = 0;
      if(name === q) score += 120;
      if(name.startsWith(q)) score += 80;
      if(name.includes(q)) score += 60;
      if(category.includes(q)) score += 36;
      if(keywords.includes(q)) score += 28;
      if(meta.includes(q)) score += 16;
      for(const term of terms){
        if(name.includes(term)) score += 14;
        else if(category.includes(term)) score += 9;
        else if(keywords.includes(term)) score += 7;
        else if(meta.includes(term)) score += 4;
        else if(!haystack.includes(term)) score -= 12;
      }
      return {tool, score};
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || a.tool.orden - b.tool.orden)
    .map(x => x.tool);
}

export function focusGeneralSearch(){
  const input = document.getElementById('general-search-input');
  input?.scrollIntoView({behavior:'smooth', block:'center'});
  window.setTimeout(() => input?.focus(), 250);
}
