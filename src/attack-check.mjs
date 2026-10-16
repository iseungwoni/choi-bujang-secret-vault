import { execFileSync } from 'node:child_process';

const timeout = () => ({ signal: AbortSignal.timeout(10000), redirect: 'error' });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', timeout: 5000 }).trim();
const safeFetch = async (url, options = timeout()) => {
  try { return await fetch(url, options); }
  catch { return new Response('', { status: 599 }); }
};

function previousSampleNotes() {
  const raw = git('show', '47525e5456ac08e18d00fa90de39095469bf53a0:data.json');
  const data = JSON.parse(raw);
  return data.notes.map(note => note.content).filter(value => typeof value === 'string');
}

function localHeadSearch(phrases) {
  const files = git('ls-tree', '-r', '--name-only', 'HEAD').split(/\r?\n/u).filter(Boolean);
  let matches = 0;
  for (const file of files) {
    if (!/\.(?:html?|css|mjs?|cjs|json|md|sql|ya?ml|txt)$/iu.test(file)) continue;
    const content = git('show', `HEAD:${file}`);
    matches += phrases.reduce((count, phrase) => count + (content.includes(phrase) ? 1 : 0), 0);
  }
  return matches;
}

async function githubLatestSearch(config, phrases) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/iu.exec(config.repoUrl);
  if (!match) return 'GitHub 검색을 건너뜀 (repoUrl 형식 확인 필요)';
  try {
    const headers = { accept: 'application/vnd.github+json', 'user-agent': 'aleph-defense-stage-check' };
    const repoResponse = await safeFetch(`https://api.github.com/repos/${match[1]}/${match[2]}`, { ...timeout(), headers });
    if (!repoResponse.ok) return `GitHub 최신 파일 검색 실패 (저장소 정보 HTTP ${repoResponse.status})`;
    const repo = await repoResponse.json();
    const treeResponse = await safeFetch(`https://api.github.com/repos/${match[1]}/${match[2]}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`, { ...timeout(), headers });
    if (!treeResponse.ok) return `GitHub 최신 파일 검색 실패 (파일 목록 HTTP ${treeResponse.status})`;
    const tree = await treeResponse.json();
    const paths = (tree.tree ?? []).filter(item => item.type === 'blob'
      && /\.(?:html?|css|mjs?|cjs|json|md|sql|ya?ml|txt)$/iu.test(item.path)).map(item => item.path);
    let matches = 0;
    for (let start = 0; start < paths.length; start += 8) {
      const batch = await Promise.all(paths.slice(start, start + 8).map(async path => {
        const response = await safeFetch(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${encodeURIComponent(repo.default_branch)}/${path.split('/').map(encodeURIComponent).join('/')}`, timeout());
        return response.ok ? response.text() : '';
      }));
      for (const content of batch) {
        matches += phrases.filter(phrase => content.includes(phrase)).length;
      }
    }
    return matches === 0
      ? `GitHub 기본 브랜치 최신 파일 검색 결과: 일치 0건 (${paths.length}개 텍스트 파일)`
      : `GitHub 기본 브랜치 최신 파일 검색 결과: 일치 ${matches}건`;
  } catch {
    return 'GitHub 최신 파일 검색 실패 (요청 시간 초과 또는 네트워크 오류)';
  }
}

export async function runAttackChecks(config) {
  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 확인해 주세요.');
  }
  const phrases = previousSampleNotes();
  const results = [];

  const [home, staticData, notesApi, identity] = await Promise.all([
    safeFetch(new URL('/', app)),
    safeFetch(new URL('/data.json', app)),
    safeFetch(new URL('/api/notes', app)),
    safeFetch(new URL('/aleph.json', app)),
  ]);
  const homeText = await home.text();
  let staticBody = '';
  let identityBody = '';
  let staticHasNotes = false;
  if (staticData.ok) {
    staticBody = await staticData.text();
    try {
      const body = JSON.parse(staticBody);
      staticHasNotes = Array.isArray(body.notes) && body.notes.length > 0;
    } catch {
      // A successful non-JSON response does not count as a data file with notes.
    }
  }
  if (identity.ok) identityBody = await identity.text();
  const staticHits = phrases.reduce((count, phrase) => count
    + Number(homeText.includes(phrase)) + Number(staticBody.includes(phrase))
    + Number(identityBody.includes(phrase)), 0);
  const staticSafe = staticData.status === 404 || (staticData.ok && !staticHasNotes && staticHits === 0);
  results.push({ attackId: 'deployed_static_scan', expected: '정적 파일과 /data.json에 가상 메모 문장이 없음',
    observed: `정적 파일 검색 ${staticHits}건; /data.json HTTP ${staticData.status}${staticSafe ? '' : ' (메모 응답 확인 필요)'}` });

  let apiCount = 0;
  if (notesApi.ok) {
    try {
      const body = await notesApi.json();
      if (Array.isArray(body.notes)) apiCount = body.notes.length;
    } catch {
      // Do not include response bodies in the submission bundle.
    }
  }
  results.push({ attackId: 'anonymous_public_api', expected: '인증 없는 API 요청은 JSON 오류로 거부',
    observed: notesApi.ok ? `로그인 없이 API에서 가상 자료 ${apiCount}건을 읽을 수 있음 (서버 키는 기록하지 않음)`
      : `로그인 없이 API에서 자료를 읽지 못함 (HTTP ${notesApi.status}; 서버 키는 기록하지 않음)` });

  let identityValid = false;
  if (identity.ok) {
    try {
      const value = JSON.parse(identityBody);
      identityValid = value?.schema === 'aleph.defense.deployment.v1'
        && value.step === config.step && value.publicAppUrl === config.publicAppUrl;
    } catch {
      // A malformed identity file is recorded as absent, never as valid.
    }
  }
  results.push({ attackId: 'deployment_identity', expected: '배포 /aleph.json에 현재 단계와 주소가 기록됨',
    observed: identityValid ? '현재 단계·배포 주소 확인' : `/aleph.json 확인 안 됨 (HTTP ${identity.status})` });

  const localHits = localHeadSearch(phrases);
  results.push({ attackId: 'local_head_source_scan', expected: '현재 저장점의 텍스트 파일에서 가상 메모 문장이 검색되지 않음',
    observed: `현재 HEAD 텍스트 파일 검색 일치 ${localHits}건` });
  results.push({ attackId: 'github_latest_source_scan', expected: 'GitHub 기본 브랜치 최신 파일에서 가상 메모 문장이 검색되지 않음',
    observed: await githubLatestSearch(config, phrases) });
  return results;
}
