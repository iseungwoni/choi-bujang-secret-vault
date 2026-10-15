import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

const config = {
  step: 2,
  repoUrl: 'https://github.com/student-a/aleph-defense',
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
};
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('build identity uses Vercel Git and deployment metadata', () => {
  assert.deepEqual(deploymentIdentity(env, config), {
    schema: 'aleph.defense.deployment.v1',
    step: 2,
    repoUrl: 'https://github.com/student-a/aleph-defense',
    commit: 'a'.repeat(40),
    publicAppUrl: 'https://student-defense-123.vercel.app',
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
  });
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_PROVIDER: undefined }, config));
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_COMMIT_SHA: 'short' }, config));
});

test('stage-two self-check records static removal and the anonymous API weakness', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, init) => {
      const requestUrl = String(url);
      requests.push(requestUrl);
      if (requestUrl.endsWith('/')) return new Response('<main>자료실</main>', { status: 200 });
      if (requestUrl.endsWith('/data.json')) return new Response('', { status: 404 });
      if (requestUrl.endsWith('/api/notes')) return new Response(JSON.stringify({
        notes: Array.from({ length: 4 }, () => ({ title: 'fixture', content: 'fixture' })),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (requestUrl.endsWith('/aleph.json')) return new Response(JSON.stringify({
        schema: 'aleph.defense.deployment.v1', step: 2,
        publicAppUrl: config.publicAppUrl,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (requestUrl === 'https://api.github.com/repos/student-a/aleph-defense') {
        return new Response(JSON.stringify({ default_branch: 'main' }), { status: 200 });
      }
      if (requestUrl.endsWith('/git/trees/main?recursive=1')) {
        return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      }
      throw new Error('unexpected request');
    };
    const results = await runAttackChecks(config);
    assert.equal(results.find(item => item.attackId === 'deployed_static_scan').observed,
      '정적 파일 검색 0건; /data.json HTTP 404');
    assert.match(results.find(item => item.attackId === 'anonymous_public_api').observed,
      /로그인 없이 API에서 가상 자료 4건/u);
    assert.match(results.find(item => item.attackId === 'deployment_identity').observed,
      /현재 단계·배포 주소 확인/u);
    assert.ok(requests.includes('https://student-defense.vercel.app/api/notes'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
