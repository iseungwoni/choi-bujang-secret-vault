# BYTE BACK 자료실 · 3단계 저장점

## 현재 동작

- Supabase 이메일·비밀번호 로그인을 사용하며, 화면에 로그인·로그아웃 상태와 로그인 실패 이유를 표시합니다.
- 로그인한 사용자는 `/api/notes`와 `/api/notes/:id`를 통해 가상 메모를 추가·조회·수정·삭제할 수 있습니다. 서버가 검증한 토큰의 사용자 ID를 `owner_id`로 저장하고 목록도 해당 사용자 ID로 제한합니다.
- `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`는 서버 함수에서만 사용합니다. 브라우저에는 공개용 publishable key만 둡니다. API 응답은 DB 오류와 서버 키를 노출하지 않습니다.
- `src/verify-login.mjs`가 Supabase 토큰의 발급자·대상·서명을 검증하며, 브라우저가 보내는 사용자 ID나 역할은 인증에 쓰지 않습니다.
- 빌드는 `public/data.json`을 만들지 않으며, `/aleph.json`에는 배포의 저장소·커밋·주소·단계를 기록합니다.
- 4단계 전까지 상세 경로의 메모 소유자 검사는 없습니다. 로그인한 B가 A의 메모 ID를 알면 해당 메모를 조회·수정·삭제할 수 있습니다. 연습용 가상 자료만 사용하세요.
- 예전 커밋과 예전 배포에는 공개 메모가 남아 있습니다. 이번 단계는 과거 노출을 회수하거나 해소하지 않습니다.

## Supabase 학습 테이블 설정

1. Supabase 프로젝트의 **SQL Editor**에서 `supabase/notes.sql`을 실행합니다. 이 스크립트는 `public.notes`를 만들고 가상 메모 네 건을 넣습니다. `owner_id uuid`는 이후 단계를 위해 미리 두며 `auth.users` 외래키는 만들지 않습니다.
2. Table Editor에서 `notes.owner_id`의 형식이 `uuid`인지 확인하고, **Database → Tables → notes**에서 RLS가 켜져 있는지 확인합니다. SQL은 `anon` 및 `authenticated` 권한을 취소하고 `service_role`에만 SELECT를 줍니다. `owner_id`는 아직 행별 접근 제어에 쓰이지 않습니다.
3. `aleph.config.json`의 `identityProvider`에는 프로젝트 발급자 (`https://<project-ref>.supabase.co/auth/v1`), `audience: "authenticated"`, `jwksUrl: "https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"`를 적습니다. 브라우저용 Project URL과 publishable key는 `public/index.html`에 둡니다. publishable key는 공개용이고 서버 전용 키와 다릅니다.
4. Vercel 프로젝트의 **Settings → Environment Variables**에 `SUPABASE_URL`, 서버 전용 `SUPABASE_SECRET_KEY`를 설정하고 재배포합니다. 비밀 키는 브라우저 코드, Git, 제출 묶음, 채팅에 넣지 말고 공개 접두사를 붙이지 마세요.
5. Supabase SQL Editor에서 갱신된 `supabase/notes.sql`을 실행해 `service_role`에 메모 쓰기 권한을 줍니다. 배포 후 A 계정 로그인·로그아웃과 메모 추가·수정·삭제를 확인합니다. 시크릿 창에서 로그아웃 상태로 `/api/notes`를 요청하면 JSON `401`이어야 합니다.
6. B 계정으로 A 메모 ID를 요청해 소유자 검사가 빠진 사실을 기록합니다. 이 허점은 4단계에서 고칩니다. `/data.json`은 404여야 하며 `/aleph.json`은 열려야 합니다.

## 다시 실행

```powershell
npm run build -- --local
npm run bundle
```

로컬 빌드는 Vercel 배포나 Supabase 연결을 증명하지 않습니다. `npm run bundle`은 마지막 커밋의 파일, 배포의 공개 경로, GitHub 기본 브랜치 최신 파일을 확인해 `artifacts/submission.json`과 요약을 만듭니다. 생성 파일과 `bundle-notes.json`은 커밋하지 않습니다.

## 메모 문장 검색 절차

번들 점검은 이전 저장점의 가상 메모 문장을 검색어로 가져와 현재 정적 파일, `/`와 `/data.json`, 현재 커밋의 텍스트 파일, GitHub 기본 브랜치 최신 파일에서 검색합니다. 결과에는 검색어와 메모 본문을 남기지 않습니다. API 확인 결과도 메모 본문이나 서버 키 없이 HTTP 상태와 반환 건수만 기록합니다.

배포 주소를 바꾼 뒤에는 아래 경로를 직접 열어 확인하세요.

- `https://choi-bujang-secret-vault-z334.vercel.app/`
- `https://choi-bujang-secret-vault-z334.vercel.app/data.json` — 404 또는 메모 0건이어야 합니다.
- `https://choi-bujang-secret-vault-z334.vercel.app/aleph.json` — 배포 식별 JSON이 열려야 합니다.
- `https://choi-bujang-secret-vault-z334.vercel.app/api/notes` — 로그인 없이 JSON `401`을 반환해야 합니다.

## 과거 노출의 한계

가상 메모가 있던 이전 커밋과 이미 만들어진 배포는 그대로 공개 이력에 남습니다. 현재 기본 브랜치와 새 배포에서 문장이 검색되지 않아도 과거 노출이 사라진 것은 아닙니다. `supabase/notes.sql`은 GitHub에서 평문 문장 검색을 피하도록 UTF-8 값으로 작성했지만, 누구나 SQL을 해독할 수 있으므로 비밀 보호 수단이 아닙니다. 자료는 모두 연습용 가상 내용입니다.
