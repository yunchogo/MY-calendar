// src/lib/auth.js
//
// 로그인 모달(LoginModal)의 각 버튼이 호출할 실제 인증 함수들입니다.
// 모두 Promise를 반환하며, 에러는 { error } 형태로 돌려주므로
// 호출하는 쪽(UI)에서 try/catch 없이도 error 필드만 확인하면 됩니다.

import { supabase } from "./supabaseClient";

/** 구글 로그인 — 클릭하면 구글 로그인 페이지로 리다이렉트됩니다 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin, // 로그인 완료 후 돌아올 주소
    },
  });
  return { data, error };
}

/** 카카오 로그인 — 클릭하면 카카오 로그인 페이지로 리다이렉트됩니다 */
export async function signInWithKakao() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: window.location.origin,
      // 카카오 앱에 account_email 동의항목이 설정되어 있지 않으므로
      // 닉네임/프로필 사진만 요청 (PROJECT_BRIEF.md 동의항목 정책과 일치)
      scopes: "profile_nickname profile_image",
    },
  });
  return { data, error };
}

/** 이메일/비밀번호로 회원가입 */
export async function signUpWithEmail({ email, password, name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // profiles 테이블 생성 트리거가 이 값을 calendar_name 기본값으로 사용해요
    },
  });
  return { data, error };
}

/** 이메일/비밀번호로 로그인 */
export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** 로그아웃 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** 현재 로그인된 사용자 정보 (없으면 null) */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 로그인 상태 변화를 실시간으로 구독합니다.
 * App.jsx에서 useEffect로 한 번만 등록해서 view 상태(랜딩/캘린더)를 자동 전환하는 데 씁니다.
 *
 * 사용 예:
 *   useEffect(() => {
 *     const { data: { subscription } } = onAuthStateChange((event, session) => {
 *       setView(session ? "calendar" : "landing");
 *     });
 *     return () => subscription.unsubscribe();
 *   }, []);
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
