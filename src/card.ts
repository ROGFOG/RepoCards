export interface Repository { full_name: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; pushed_at: string | null; html_url: string; private?: boolean }
export type Theme = 'paper' | 'night';
export interface CardData { repository: Repository; release: string; workflow: string; capturedAt?: string; isSample?: boolean }
export function parseRepository(input: string): string {
  let value = input.trim();
  if (/^https?:/i.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Enter owner/repository or a public github.com repository URL.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS github.com repository URL without query parameters.');
    value = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/[a-zA-Z0-9_.-]{1,100}$/.test(value) || value.split('/')[1] === '.' || value.split('/')[1] === '..') throw new Error('Enter a valid owner/repository, for example ROGFOG/PolicyLens.');
  return value;
}
export function escapeXml(value: string): string {
  return value.replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[character]!);
}
function clip(value: string, length: number) { const chars = Array.from(value); return chars.length > length ? chars.slice(0, length - 1).join('') + '…' : value; }
function lines(value: string): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const result: string[] = []; let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 54 && line) { result.push(line); line = ''; }
    line = (line + ' ' + word).trim();
  }
  if (line) result.push(line);
  if (result.length > 2) result[1] = clip(result.slice(1).join(' '), 54);
  return result.slice(0, 2).map(value => clip(value, 54));
}
export function renderCard(data: CardData, theme: Theme = 'paper'): string {
  const repo = data.repository;
  if (repo.private) throw new Error('Only public repositories are supported.');
  const colors = theme === 'night' ? {bg:'#17241f', text:'#f2f4eb', muted:'#b4c5b7', line:'#374b40', accent:'#eaa878'} : {bg:'#faf9f3', text:'#22362b', muted:'#596a5d', line:'#dadfd2', accent:'#a74123'};
  const e = escapeXml;
  const description = lines(repo.description || 'A public project on GitHub.');
  const count = (value: number) => Number.isSafeInteger(value) && value >= 0 ? String(value) : '-';
  const updated = repo.pushed_at && /^\d{4}-\d{2}-\d{2}T/.test(repo.pushed_at) ? repo.pushed_at.slice(0, 10) : 'unknown';
  const captured = data.capturedAt ? new Date(data.capturedAt) : undefined;
  const captureLabel = data.isSample ? 'Sample data · Capture time: not applicable'
    : captured && Number.isFinite(captured.getTime())
      ? `Captured ${captured.toISOString().slice(0, 19).replace('T', ' ')} UTC`
      : 'Capture time: unavailable';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="300" viewBox="0 0 560 300" role="img" aria-labelledby="title description">
<title id="title">${e(repo.full_name)}</title><desc id="description">${e(repo.description || 'Public GitHub repository')}. ${e(data.workflow)}. ${e(data.release)}. ${e(captureLabel)}.</desc>
<rect x="1" y="1" width="558" height="298" rx="16" fill="${colors.bg}" stroke="${colors.line}"/>
<g font-family="Segoe UI,Arial,sans-serif"><text x="28" y="37" fill="${colors.accent}" font-size="10" letter-spacing="2">REPOSITORY / PUBLIC</text>
<text x="28" y="77" fill="${colors.text}" font-size="24" font-weight="650">${e(clip(repo.full_name, 34))}</text>
${description.map((line, index) => `<text x="28" y="${109 + index * 21}" fill="${colors.muted}" font-size="13">${e(line)}</text>`).join('\n')}
<path d="M28 153H532" stroke="${colors.line}"/>
<circle cx="33" cy="180" r="4" fill="${colors.accent}"/><text x="45" y="185" fill="${colors.text}" font-size="12">${e(clip(repo.language || 'No language yet', 22))}</text>
<text x="290" y="185" fill="${colors.muted}" font-size="12">Stars ${count(repo.stargazers_count)}   ·   Forks ${count(repo.forks_count)}</text>
<text x="28" y="215" fill="${colors.muted}" font-size="12">${e(clip(data.release, 62))}</text>
<text x="28" y="239" fill="${colors.muted}" font-size="12">${e(clip(data.workflow, 62))}</text>
<text x="28" y="262" fill="${colors.muted}" font-size="10">Last push ${e(updated)} · Snapshot, not a live badge</text>
<text x="28" y="283" fill="${colors.muted}" font-size="10">${e(captureLabel)}</text></g></svg>`;
}

export async function fetchCard(input: string, request: typeof fetch = fetch, now: () => Date = () => new Date()): Promise<CardData> {
  const slug = parseRepository(input);
  const base = `https://api.github.com/repos/${slug}`;
  const get = async (url: string) => request(url, { headers: {Accept:'application/vnd.github+json'}, signal: AbortSignal.timeout(12000), credentials:'omit', referrerPolicy:'no-referrer' });
  const response = await get(base);
  if (!response.ok) throw new Error(response.status === 404 ? 'Public repository not found.' : response.status === 403 || response.status === 429 ? 'GitHub rate limit reached. Try later; no token is required.' : `GitHub returned HTTP ${response.status}. Try again later.`);
  const repository = await response.json() as Repository;
  if (repository.private || typeof repository.full_name !== 'string' || (repository.description !== null && typeof repository.description !== 'string') || (repository.language !== null && typeof repository.language !== 'string')) throw new Error('GitHub returned unsupported repository data.');
  let release = 'Release: unavailable'; let workflow = 'Latest workflow: unavailable';
  // Optional metadata failures must not invent a successful check or a release.
  await Promise.allSettled([
    (async () => { const result = await get(base + '/releases/latest'); if (result.status === 404) release = 'Release: none published'; else if (result.ok) { const data = await result.json(); if (typeof data.tag_name === 'string') release = `Release: ${data.tag_name}`; } })(),
    (async () => { const result = await get(base + '/actions/runs?per_page=1'); if (result.ok) { const data = await result.json(); const run = data.workflow_runs?.[0]; if (!run) workflow = 'Latest workflow: no runs'; else if (typeof run.status === 'string') workflow = `Latest workflow: ${run.status === 'completed' ? (typeof run.conclusion === 'string' ? run.conclusion : 'unknown') : run.status}`; } })(),
  ]);
  return { repository, release, workflow, capturedAt: now().toISOString() };
}

export const sample: CardData = {isSample:true, repository:{full_name:'owner/project', description:'An example repository used to preview SVG card layouts.', language:'TypeScript', stargazers_count:12, forks_count:2, pushed_at:'2026-10-19T00:00:00Z', html_url:'https://github.com/owner/project'}, release:'Release: sample v0.1.0', workflow:'Latest workflow: sample success'};
