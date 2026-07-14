# 처음 배포하기 — 아주 쉬운 단계별 가이드

> 목표: 내 컴퓨터에서만 돌던 사이트를 **인터넷에 올려서 남들도 접속**할 수 있게 하기.
> 준비물은 전부 **무료**이고, **도메인을 따로 살 필요 없습니다**(Vercel이 `내이름.vercel.app` 주소를 공짜로 줘요).
> 이미 코드 저장소(git)는 만들어 두었습니다. 아래 A→B→C 순서대로만 하면 됩니다.

---

## A. 코드를 GitHub에 올리기 (코드 보관소 만들기)

1. https://github.com 에서 **계정 만들기**(이미 있으면 로그인).
2. 오른쪽 위 **+** → **New repository** 클릭.
   - Repository name: 예) `my-calendar`
   - **Public** 선택(무료).
   - “Add a README” 등은 **체크하지 말기**(비어있게).
   - **Create repository** 클릭.
3. 만들어진 페이지에 나오는 주소(예: `https://github.com/내아이디/my-calendar.git`)를 복사.
4. 이 폴더에서 아래 명령을 실행(주소만 본인 것으로 교체):
   ```bash
   git remote add origin https://github.com/내아이디/my-calendar.git
   git push -u origin main
   ```
   - 로그인 창이 뜨면 GitHub 계정으로 로그인(또는 토큰). 성공하면 코드가 GitHub에 올라갑니다.

> 💡 앞으로 사이트를 고칠 때마다 `git push` 한 번이면 **자동으로 재배포**됩니다.

## B. Vercel로 배포하기 (인터넷에 올리기)

1. https://vercel.com 접속 → **Sign Up** → **Continue with GitHub**(위에서 만든 계정으로).
2. **Add New… → Project** 클릭 → 방금 올린 저장소(`my-calendar`) **Import**.
3. 설정 화면에서 **Framework Preset이 “Vite”로 자동 인식**됩니다(그대로 두기).
   - Build Command·Output 폴더는 건드리지 않아도 됩니다.
4. **Environment Variables**(환경 변수) 두 개를 추가 — 이게 있어야 로그인·저장이 됩니다:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | 내 `.env.local` 파일의 같은 값 |
   | `VITE_SUPABASE_ANON_KEY` | 내 `.env.local` 파일의 같은 값 |
   - `.env.local` 파일을 메모장으로 열면 두 값이 적혀 있어요. 그대로 복사해 붙여넣기.
5. **Deploy** 클릭 → 1~2분 기다리면 `https://my-calendar-xxxx.vercel.app` 같은 **내 사이트 주소**가 나옵니다. 🎉

## C. 로그인 되게 만들기 (Supabase 설정 — 꼭 해야 함)

배포하면 주소가 바뀌기 때문에, Supabase에 새 주소를 알려줘야 구글 로그인이 정상 작동합니다.

1. https://supabase.com/dashboard → 프로젝트 → **Authentication** → **URL Configuration**.
2. **Site URL**: 위에서 받은 Vercel 주소(`https://my-calendar-xxxx.vercel.app`) 입력.
3. **Redirect URLs**에 같은 주소 추가(끝에 `/**` 붙여도 됨: `https://my-calendar-xxxx.vercel.app/**`).
4. 저장.

## D. 확인

- 배포 주소로 접속 → 구글 로그인 → 캘린더가 뜨고 저장되는지 확인.
- `배포주소/privacy.html` 이 열리는지 확인(AdSense 신청 때 필요).

---

## 자주 묻는 것
- **도메인 꼭 사야 하나요?** 아니요. `*.vercel.app` 무료 주소로 충분하고, AdSense 신청도 그 주소로 가능합니다. 나중에 원하면 Vercel에서 커스텀 도메인을 연결할 수 있어요.
- **비밀 키가 노출되나요?** `.env.local`은 GitHub에 올라가지 않게 이미 막아뒀습니다(`.gitignore`). Vercel 환경 변수에 넣는 `ANON KEY`는 원래 공개돼도 되는 키예요(실제 보안은 Supabase RLS가 담당).
- **다음(AdSense)은?** 배포가 끝나면 `ADSENSE_SETUP.md` 순서대로 진행하면 됩니다.

막히는 부분이 있으면 그 화면에서 보이는 내용을 알려주세요. 단계별로 같이 풀어드릴게요.
