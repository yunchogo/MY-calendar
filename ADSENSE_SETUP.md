# Google AdSense 연동 준비 체크리스트

AdSense는 **① 공개 배포 → ② 개인정보처리방침 + 신청 → ③ 승인(퍼블리셔 ID) → ④ 광고 코드 연동** 순서로만 진행됩니다.
승인 전에는 광고 코드를 넣어도 아무 광고가 나오지 않으므로, 아래 순서대로 진행하세요.

---

## ✅ 이번에 코드로 준비해 둔 것
- `public/privacy.html` — 개인정보처리방침 페이지(배포 시 `https://도메인/privacy.html`). AdSense 신청의 필수 요건.
- 랜딩 페이지 하단 푸터에 개인정보처리방침 링크 추가.
- `public/ads.txt` — 퍼블리셔 ID만 넣으면 되는 템플릿(현재는 주석 처리).
- `index.html` 언어(ko)·설명 메타 보강.

---

## 1. 공개 도메인에 배포 (가장 먼저 — 아직 안 됨)
AdSense는 **실제로 접속되는 공개 웹사이트**만 심사합니다. 지금은 배포가 안 되어 있습니다.

1. 저장소 준비: `git init` → GitHub 등 원격 저장소에 push
2. 호스팅 선택(택1) — Vite 정적 빌드라 아래 모두 무료로 가능:
   - **Vercel** / **Netlify** / **Cloudflare Pages** (추천: 클릭 몇 번, SPA 자동 지원)
   - 빌드 명령: `npm run build` · 출력 폴더: `dist`
3. **환경변수 설정**(호스팅 대시보드에):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **SPA 리라이트** 설정(새로고침 404 방지): 모든 경로를 `/index.html`로.
   단, `/privacy.html`·`/ads.txt`는 정적 파일 그대로 서빙되어야 함.
5. **Supabase 리디렉트 URL 갱신**(중요 — 배포하면 Google 로그인 깨짐):
   - Supabase 대시보드 → Authentication → URL Configuration →
     Site URL과 Redirect URLs에 배포 도메인 추가.

## 2. 개인정보처리방침 확인 + AdSense 신청
1. 배포 후 `https://내도메인/privacy.html` 이 열리는지 확인.
2. 사이트에 실제 콘텐츠가 어느 정도 있어야 승인 가능(로그인 없이 볼 수 있는 랜딩/소개가 있으면 유리).
3. https://adsense.google.com 가입 → 사이트 도메인 등록 → 신청.

## 3. 승인 대기 (수일~수주)
AdSense가 사이트를 검토합니다. 승인되면 **퍼블리셔 ID**(`pub-…`)가 발급됩니다.

## 4. 승인 후 광고 코드 연동 (퍼블리셔 ID 생긴 뒤에)
1. `public/ads.txt` 의 `pub-XXXXXXXXXXXXXXXX` 를 실제 ID로 바꾸고 주석 해제.
2. `index.html` `<head>` 에 AdSense 로더 스크립트 추가:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
3. 광고를 넣을 위치에 `<ins class="adsbygoogle" …>` 슬롯 배치 후 `(adsbygoogle = window.adsbygoogle || []).push({})`.
   - 캘린더 앱 특성상 UX를 해치지 않게 사이드바 하단/랜딩 등 제한적으로 배치 권장.
   - 이 단계는 퍼블리셔 ID가 생긴 뒤 요청하면 컴포넌트로 깔끔하게 붙여드립니다.

---

### 지금 결정이 필요한 것
- 어느 호스팅에 배포할지 (Vercel / Netlify / Cloudflare Pages / 기타)
- AdSense 계정이 이미 있는지, 등록할 도메인이 있는지
