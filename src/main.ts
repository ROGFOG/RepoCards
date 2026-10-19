import { fetchCard, renderCard, sample } from './card.js';
import type { CardData, Theme } from './card.js';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let data: CardData = sample;
let isSample = true;
function render() {
  // renderCard XML-escapes every external string; no raw API HTML is inserted.
  const documentSvg = new DOMParser().parseFromString(renderCard(data, el<HTMLSelectElement>('theme').value as Theme), 'image/svg+xml');
  el('preview').replaceChildren(document.importNode(documentSvg.documentElement, true));
  el('state').textContent = isSample ? 'Sample data' : 'Public data snapshot';
}
el<HTMLFormElement>('generate').addEventListener('submit', async event => {
  event.preventDefault(); const button = el<HTMLButtonElement>('load'); button.disabled = true; el('error').textContent = ''; el('state').textContent = 'Fetching public data…';
  try { data = await fetchCard(el<HTMLInputElement>('repository').value); isSample = false; render(); }
  catch (reason) { el('error').textContent = reason instanceof Error && reason.name !== 'TimeoutError' ? reason.message : 'Request timed out. Try again later.'; el('state').textContent = isSample ? 'Sample data' : 'Previous snapshot'; }
  finally { button.disabled = false; }
});
el('theme').addEventListener('change', render);
el('sample').addEventListener('click', () => { data = sample; isSample = true; el('error').textContent = ''; render(); });
el('download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([renderCard(data, el<HTMLSelectElement>('theme').value as Theme)], {type:'image/svg+xml'})); const link = document.createElement('a'); link.download = 'repository-card.svg'; link.href = url; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
el('markdown').addEventListener('click', async () => { const text = `[![Repository card](assets/repository-card.svg)](https://github.com/${encodeURI(data.repository.full_name)})`; try { await navigator.clipboard.writeText(text); el('copy-status').textContent = 'Markdown copied. Add the downloaded SVG to assets/repository-card.svg.'; } catch { el('copy-status').textContent = text; } });
render();
