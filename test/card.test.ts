import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepository, renderCard, fetchCard, sample, escapeXml } from '../src/card.ts';
test('accepts only repository identifiers or canonical HTTPS URLs', () => { assert.equal(parseRepository(' ROGFOG/PolicyLens '), 'ROGFOG/PolicyLens'); assert.equal(parseRepository('https://github.com/ROGFOG/RepoCards/'), 'ROGFOG/RepoCards'); for (const bad of ['https://evil.test/a/b','https://github.com/a/b/issues','http://github.com/a/b','https://x@github.com/a/b','a/..','a/b?x','https://github.com/a/b#x']) assert.throws(() => parseRepository(bad)); });
test('escapes malicious metadata and strips XML controls', () => { const svg = renderCard({...sample, repository:{...sample.repository, full_name:'<script>&"', description:'<image onload="evil()"/>\u0001'}}); assert.ok(!svg.includes('<script>')); assert.ok(!svg.includes('<image ')); assert.ok(svg.includes('&lt;image')); assert.ok(!svg.includes('\u0001')); assert.equal(escapeXml("<&>\"'"), '&lt;&amp;&gt;&quot;&apos;'); });
test('renders both themes and honest snapshot labels', () => { for (const theme of ['paper','night'] as const) { const svg = renderCard(sample, theme); assert.ok(svg.includes('Snapshot, not a live badge')); assert.ok(svg.includes('sample success')); } });
test('rejects private repository cards', () => { assert.throws(() => renderCard({...sample, repository:{...sample.repository,private:true}})); });
test('optional API failures never produce passing status', async () => { const request = async (url: string | URL | Request) => String(url).endsWith('/a/b') ? Response.json({...sample.repository,full_name:'a/b'}) : new Response('', {status:403}); const data = await fetchCard('a/b', request as typeof fetch); assert.equal(data.workflow, 'Latest workflow: unavailable'); assert.equal(data.release, 'Release: unavailable'); });
test('handles missing releases and empty workflows', async () => { const request = async (url: string | URL | Request) => String(url).includes('/releases/') ? new Response('', {status:404}) : String(url).includes('/actions/') ? Response.json({workflow_runs:[]}) : Response.json(sample.repository); const data = await fetchCard('a/b', request as typeof fetch); assert.equal(data.release, 'Release: none published'); assert.equal(data.workflow, 'Latest workflow: no runs'); });
test('rate limit produces an actionable message', async () => { await assert.rejects(fetchCard('a/b', (async () => new Response('', {status:403})) as typeof fetch), /rate limit/); });
test('metadata uses explicit no-credential request options', async () => { const request = async (_url: unknown, options: RequestInit) => { assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer'); return Response.json(sample.repository); }; await fetchCard('a/b', request as typeof fetch); });

test('capture time is recorded once after metadata requests and survives palette changes', async () => {
  const complete = new Set<string>();
  let clockCalls = 0;
  const request = async (url: string | URL | Request) => {
    const path = String(url);
    if (path.includes('/releases/')) { complete.add('release'); return new Response('', {status:404}); }
    if (path.includes('/actions/')) { complete.add('workflow'); return Response.json({workflow_runs:[]}); }
    return Response.json(sample.repository);
  };
  const data = await fetchCard('a/b', request as typeof fetch, () => {
    assert.equal(complete.size, 2);
    clockCalls++;
    return new Date('2026-10-20T14:31:12+03:00');
  });
  assert.equal(data.capturedAt, '2026-10-20T11:31:12.000Z');
  for (const theme of ['paper', 'night'] as const) {
    const svg = renderCard(data, theme);
    assert.ok(svg.includes('Captured 2026-10-20 11:31:12 UTC'));
    assert.ok(svg.includes('Last push 2026-10-19'));
    assert.ok(svg.includes('viewBox="0 0 560 300"'));
  }
  assert.equal(clockCalls, 1);
});
test('sample capture time is explicitly inapplicable even when a timestamp is supplied', () => {
  const svg = renderCard({...sample, capturedAt:'2026-10-20T11:31:12.000Z'});
  assert.ok(svg.includes('Sample data · Capture time: not applicable'));
  assert.ok(!svg.includes('Captured 2026-10-20'));
});
test('older and invalid capture times stay unavailable instead of using render time', () => {
  for (const capturedAt of [undefined, 'not-a-date', '<script>alert(1)</script>']) {
    const svg = renderCard({...sample, isSample:false, capturedAt});
    assert.ok(svg.includes('Capture time: unavailable'));
    assert.ok(!svg.includes('<script>'));
  }
});
