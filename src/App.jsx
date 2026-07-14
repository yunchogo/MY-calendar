import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { toPng } from "html-to-image";
import { signInWithGoogle, signInWithKakao, signUpWithEmail, signInWithEmail, signOut, onAuthStateChange } from "./lib/auth";
import { supabase } from "./lib/supabaseClient";
import {
  fetchEvents, createEvent, deleteEvent, updateEventBase,
  upsertOverride, fetchCellDecorations, upsertCellColor, clearCellColor,
  fetchProfile, updateProfile,
  parseScheduleWithAI, fetchHolidaysForYear, insertHolidays,
  insertEventWithId, updateEventFields, deleteOverridesForEvent,
  analyzeThemeFromImage,
} from "./lib/api";

/* ============================================================
   Bboggl · App — 랜딩 · 로그인 · 캘린더 통합 라우팅
   랜딩페이지 → (로그인 모달) → 캘린더 화면 흐름을 하나로 연결
   ============================================================ */

/* ============================================================
   Bboggl · STEP 1 — 디자인 시스템 토큰 + 랜딩페이지
   (텍스트를 입력하면 자동으로 정리된 캘린더가 되는 서비스)
   ============================================================ */

/* ---------- 아이콘 (둥근 라인 스타일) ---------- */
const LandingIcon = ({ path, size = 24, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {path}
  </svg>
);

const landingIcons = {
  sparkle: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  palette: (
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.6-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a4 4 0 0 0 4-4c0-4.4-3.6-8.2-8-8.2Zm-5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  ),
  bell: (
    <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6ZM9.5 18a2.5 2.5 0 0 0 5 0" />
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
};

/* ---------- 랜딩페이지 ---------- */
function LandingPage({ onStart = () => {}, onLogin = () => {} }) {
  const scribbleLines = [
    "월~금 오전 8시~오후 6시 회사",
    "7/26 오후 2시 팀 미팅",
    "매주 화 저녁 7시 필라테스",
    "7/28 오전 10시 병원",
  ];

  const scheduleBlocks = [
    { day: 1, label: "회사", color: "var(--accent)" },
    { day: 2, label: "회사", color: "var(--accent)" },
    { day: 3, label: "필라테스", color: "var(--green)" },
    { day: 4, label: "회사", color: "var(--accent)" },
    { day: 5, label: "회사", color: "var(--accent)" },
  ];

  const features = [
    {
      icon: "sparkle",
      title: "그냥 적으면 정리돼요",
      desc: "\u201c월~금 9시부터 6시까지 회사\u201d처럼 편하게 적으면, 반복 일정과 특별 일정 모두 자동으로 캘린더에 자리 잡아요.",
      accent: "var(--primary)",
    },
    {
      icon: "palette",
      title: "내 취향대로 꾸미기",
      desc: "테마 컬러를 골라서 나만의 캘린더로 커스터마이징할 수 있어요.",
      accent: "var(--accent)",
    },
    {
      icon: "calendar",
      title: "드래그로 바로 수정",
      desc: "일정을 끌어서 옮기거나, 텍스트를 지우는 것만으로 바로바로 편집돼요.",
      accent: "var(--green)",
    },
    {
      icon: "bell",
      title: "놓치지 않게 알려줘요",
      desc: "다가오는 일정 몇 분 전, 알람으로 미리 알려드려요.",
      accent: "var(--yellow)",
    },
  ];

  return (
    <div className="bg-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        :root{
          --primary:#4A154B;
          --accent:#1264A3;
          --green:#2EB67D;
          --yellow:#ECB22E;
          --text:#1D1C1D;
          --bg:#FFFFFF;
          --border:#E8E8E8;
        }

        *{box-sizing:border-box;}
        .bg-root{
          font-family:'Poppins',sans-serif;
          color:var(--text);
          background:var(--bg);
          min-height:100vh;
        }

        h1,h2,h3{font-weight:700; margin:0;}
        p{margin:0; line-height:1.6;}

        .btn{
          border-radius:10px;
          padding:12px 20px;
          font-weight:700;
          font-family:inherit;
          font-size:15px;
          background:var(--primary);
          color:#fff;
          border:none;
          cursor:pointer;
          transition:.15s;
          display:inline-flex;
          align-items:center;
          gap:8px;
        }
        .btn:hover{filter:brightness(1.12);}
        .btn.ghost{
          background:transparent;
          color:var(--primary);
          border:1.5px solid var(--border);
        }
        .btn.ghost:hover{filter:none; border-color:var(--primary); background:rgba(74,21,75,0.04);}

        .icon{color:inherit;}

        /* --- 헤더 --- */
        .nav{
          display:flex; align-items:center; justify-content:space-between;
          padding:20px 6vw;
          max-width:1200px; margin:0 auto;
        }
        .logo{
          display:flex; align-items:center; gap:8px;
          font-size:20px; font-weight:700; color:var(--primary);
        }
        .logo-dot{
          width:10px; height:10px; border-radius:50%;
          background:var(--yellow);
        }

        /* --- 히어로 --- */
        .hero{
          max-width:1200px; margin:0 auto;
          padding:56px 6vw 40px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:48px;
          align-items:center;
        }
        .eyebrow{
          display:inline-flex; align-items:center; gap:6px;
          background:rgba(74,21,75,0.06);
          color:var(--primary);
          font-size:13px; font-weight:600;
          padding:6px 12px; border-radius:20px;
          margin-bottom:18px;
        }
        .hero h1{
          font-size:clamp(30px, 4.2vw, 46px);
          line-height:1.25;
          letter-spacing:-0.01em;
        }
        .hero h1 .nowrap-line{white-space:nowrap;}
        .hero h1 .hl{color:var(--accent);}
        .hero-desc{
          margin-top:18px;
          font-size:17px;
          color:#5c5a5c;
          max-width:440px;
        }
        .hero-cta{
          margin-top:30px;
          display:flex; gap:12px; flex-wrap:wrap;
        }

        /* --- 히어로 비주얼: 텍스트 → 캘린더 변환 --- */
        .visual{
          position:relative;
          display:flex; align-items:center; justify-content:center;
          gap:14px;
        }
        .scribble-card{
          background:#FAFAFA;
          border:1.5px dashed var(--border);
          border-radius:16px;
          padding:20px;
          width:180px;
          transform:rotate(-3deg);
        }
        .scribble-line{
          font-size:11.5px;
          color:#8a888a;
          padding:6px 0;
          border-bottom:1px dashed #ddd;
        }
        .scribble-line:last-child{border-bottom:none;}

        .transform-arrow{
          color:var(--yellow);
          flex-shrink:0;
        }

        .calendar-card{
          background:var(--bg);
          border:1.5px solid var(--border);
          border-radius:16px;
          padding:16px;
          width:220px;
          box-shadow:0 12px 32px rgba(74,21,75,0.10);
          transform:rotate(2deg);
        }
        .calendar-card-head{
          display:flex; justify-content:space-between; align-items:center;
          font-size:12px; font-weight:600; color:var(--primary);
          margin-bottom:10px;
        }
        .calendar-row{
          display:flex; gap:4px; margin-bottom:6px;
        }
        .calendar-cell{
          flex:1; height:34px; border-radius:6px;
          background:#F5F5F5;
          font-size:9px; color:#fff; font-weight:600;
          display:flex; align-items:center; justify-content:center;
          text-align:center; padding:2px;
        }

        /* --- 기능 섹션 --- */
        .features{
          max-width:1200px; margin:0 auto;
          padding:60px 6vw 90px;
        }
        .features-head{
          text-align:center; margin-bottom:40px;
        }
        .features-head h2{
          font-size:clamp(24px, 3vw, 32px);
        }
        .features-head p{
          margin-top:10px; color:#5c5a5c;
        }
        .feature-grid{
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:20px;
        }
        .feature-card{
          border:1.5px solid var(--border);
          border-radius:16px;
          padding:24px 20px;
          transition:.15s;
        }
        .feature-card:hover{
          border-color:transparent;
          box-shadow:0 10px 28px rgba(0,0,0,0.08);
          transform:translateY(-2px);
        }
        .feature-icon-wrap{
          width:44px; height:44px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          margin-bottom:16px;
        }
        .feature-card h3{font-size:16px;}
        .feature-card p{
          margin-top:8px; font-size:13.5px; color:#6b696b;
        }

        .landing-footer{
          max-width:1200px; margin:0 auto; padding:28px 6vw 40px;
          display:flex; align-items:center; justify-content:center; gap:18px;
          border-top:1px solid var(--border); font-size:13px; color:#8a888a;
        }
        .landing-footer a{ color:#8a888a; text-decoration:none; }
        .landing-footer a:hover{ color:var(--primary); text-decoration:underline; }

        /* --- 반응형 --- */
        @media (max-width: 860px){
          .hero{grid-template-columns:1fr; padding-top:32px;}
          .visual{order:-1; transform:scale(0.9);}
          .feature-grid{grid-template-columns:1fr 1fr;}
        }
        @media (max-width: 520px){
          .feature-grid{grid-template-columns:1fr;}
          .visual{flex-direction:column;}
          .transform-arrow{transform:rotate(90deg);}
        }
      `}</style>

      {/* 헤더 */}
      <nav className="nav">
        <div className="logo">
          <span className="logo-dot" />
          My calendar
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={onLogin}>
            로그인
          </button>
          <button className="btn" onClick={onStart}>
            무료로 시작하기
          </button>
        </div>
      </nav>

      {/* 히어로 */}
      <section className="hero">
        <div>
          <span className="eyebrow">
            <LandingIcon path={landingIcons.sparkle} size={14} className="icon" />
            텍스트 한 줄이면 충분해요
          </span>
          <h1>
            <span className="nowrap-line">두서없이 적기만 해도,</span>
            <br />
            <span className="hl">캘린더가 알아서</span> 정리해요
          </h1>
          <p className="hero-desc">
            "월~금 9시부터 6시까지 회사"처럼 편하게 적으면 반복 일정으로,
            "7월 26일 오후 2시 미팅"처럼 적으면 특별 일정으로 — My calendar가
            자동으로 캘린더에 배치해드려요.
          </p>
          <div className="hero-cta">
            <button className="btn" onClick={onStart}>
              내 캘린더 만들기
              <LandingIcon path={landingIcons.arrowRight} size={16} className="icon" />
            </button>
            <button className="btn ghost" onClick={onLogin}>
              로그인하고 이어서 쓰기
            </button>
          </div>
        </div>

        {/* 텍스트 → 캘린더 변환 비주얼 */}
        <div className="visual">
          <div className="scribble-card">
            {scribbleLines.map((line, i) => (
              <div className="scribble-line" key={i}>
                {line}
              </div>
            ))}
          </div>
          <LandingIcon
            path={landingIcons.arrowRight}
            size={26}
            className="icon transform-arrow"
          />
          <div className="calendar-card">
            <div className="calendar-card-head">
              <span>7월</span>
              <LandingIcon path={landingIcons.calendar} size={14} className="icon" />
            </div>
            <div className="calendar-row">
              {scheduleBlocks.map((b) => (
                <div
                  key={b.day}
                  className="calendar-cell"
                  style={{ background: b.color }}
                >
                  {b.label}
                </div>
              ))}
            </div>
            <div className="calendar-row">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="calendar-cell"
                  style={{ background: "#F0EFF0", color: "#bbb" }}
                >
                  -
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="features">
        <div className="features-head">
          <h2>일정 관리가 이렇게 쉬워도 되나요</h2>
          <p>My calendar가 처음부터 끝까지 챙겨드려요</p>
        </div>
        <div className="feature-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <div
                className="feature-icon-wrap"
                style={{ background: `${f.accent}1A`, color: f.accent }}
              >
                <LandingIcon path={landingIcons[f.icon]} size={22} className="icon" />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 푸터 */}
      <footer className="landing-footer">
        <span>© 2026 My calendar</span>
        <a href="/guide.html">사용법</a>
        <a href="/faq.html">FAQ</a>
        <a href="/privacy.html">개인정보처리방침</a>
      </footer>
    </div>
  );
}

/* ============================================================
   Bboggl · STEP 2 — 로그인 / 회원가입 모달
   ============================================================ */

const ModalIcon = ({ path, size = 24, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {path}
  </svg>
);

const modalIcons = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.8 4.2-6 7.5-6s6.3 2.2 7.5 6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

/* 소셜 로고 (원본 브랜드 컬러 유지, 라인 스타일 아님 — 서비스 인식성을 위해 예외) */
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.2 2.8-2.5 3.6v3h4a11.6 11.6 0 0 0 3.5-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4-3c-1.1.7-2.5 1.2-3.9 1.2-3 0-5.6-2-6.5-4.8h-4.1v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.5 14.5a7.2 7.2 0 0 1 0-4.9V6.5H1.4a12 12 0 0 0 0 11l4.1-3Z" />
    <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4.1 3.1c.9-2.7 3.5-4.8 6.5-4.8Z" />
  </svg>
);

const KakaoLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#391B1B"
      d="M12 3.5C6.7 3.5 2.5 6.9 2.5 11.1c0 2.7 1.8 5.1 4.5 6.5-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.7-1.8 3.8-2.6.5.1 1.1.1 1.6.1 5.3 0 9.5-3.4 9.5-7.6S17.3 3.5 12 3.5Z"
    />
  </svg>
);

function LoginModal({
  isOpen = true,
  onClose = () => {},
  onAuthSuccess = () => {},
}) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setErrorMsg("");
    const { error } = await signInWithGoogle();
    if (error) setErrorMsg(error.message);
    // 성공 시 구글 로그인 페이지로 리다이렉트되므로 여기서 할 일 없음
  };

  const handleKakao = async () => {
    setErrorMsg("");
    const { error } = await signInWithKakao();
    if (error) setErrorMsg(error.message);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    const result =
      mode === "login"
        ? await signInWithEmail({ email, password })
        : await signUpWithEmail({ email, password, name });
    setLoading(false);
    if (result.error) {
      setErrorMsg(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setErrorMsg("가입 확인 메일을 보냈어요. 메일함을 확인해주세요.");
      return;
    }
    onAuthSuccess();
  };

  return (
    <div className="modal-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        :root{
          --primary:#4A154B;
          --accent:#1264A3;
          --green:#2EB67D;
          --yellow:#ECB22E;
          --text:#1D1C1D;
          --bg:#FFFFFF;
          --border:#E8E8E8;
        }
        *{box-sizing:border-box;}
        .modal-root{
          font-family:'Poppins',sans-serif;
          position:fixed; inset:0;
          background:rgba(29,28,29,0.45);
          display:flex; align-items:center; justify-content:center;
          padding:20px;
          z-index:100;
          animation:fadeIn .15s ease-out;
        }
        @keyframes fadeIn{ from{opacity:0;} to{opacity:1;} }
        @keyframes slideUp{ from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }

        .modal-root .modal-card {
          background:var(--bg);
          border-radius:20px;
          width:380px;
          max-width:100%;
          padding:32px 28px 28px;
          position:relative;
          box-shadow:0 24px 60px rgba(0,0,0,0.25);
          animation:slideUp .18s ease-out;
        }
        .modal-root .modal-close {
          position:absolute; top:18px; right:18px;
          background:none; border:none; cursor:pointer;
          color:#9a989a; padding:4px; border-radius:8px;
          display:flex;
        }
        .modal-root .modal-close:hover { background:#F5F5F5; color:var(--text); }

        .modal-root .modal-logo {
          display:flex; align-items:center; gap:8px;
          font-weight:700; font-size:18px; color:var(--primary);
          margin-bottom:4px;
        }
        .modal-root .logo-dot { width:9px; height:9px; border-radius:50%; background:var(--yellow); }

        .modal-root .modal-title { font-size:22px; font-weight:700; margin-top:14px; }
        .modal-root .modal-sub { font-size:13.5px; color:#6b696b; margin-top:6px; }

        .modal-root .tab-row {
          display:flex; gap:4px; margin-top:22px;
          background:#F5F5F5; border-radius:10px; padding:4px;
        }
        .modal-root .tab-btn {
          flex:1; border:none; background:transparent; cursor:pointer;
          padding:9px 0; border-radius:8px; font-family:inherit;
          font-weight:600; font-size:13.5px; color:#8a888a;
          transition:.15s;
        }
        .modal-root .tab-btn.active { background:#fff; color:var(--primary); box-shadow:0 1px 3px rgba(0,0,0,0.08); }

        .modal-root .social-col { display:flex; flex-direction:column; gap:10px; margin-top:22px; }
        .modal-root .social-btn {
          display:flex; align-items:center; justify-content:center; gap:10px;
          width:100%; padding:11px 0; border-radius:10px;
          font-family:inherit; font-weight:600; font-size:13.5px;
          border:1.5px solid var(--border); background:#fff; cursor:pointer;
          transition:.15s;
        }
        .modal-root .social-btn:hover { background:#FAFAFA; }
        .modal-root .social-btn.kakao { background:#FEE500; border-color:#FEE500; }
        .modal-root .social-btn.kakao:hover { filter:brightness(0.97); }

        .modal-root .divider {
          display:flex; align-items:center; gap:10px;
          margin:20px 0; color:#b3b1b3; font-size:12px;
        }
        .modal-root .divider::before, .modal-root .divider::after {
          content:""; flex:1; height:1px; background:var(--border);
        }

        .modal-root .field { margin-bottom:12px; }
        .modal-root .field-input-wrap {
          display:flex; align-items:center; gap:8px;
          border:1.5px solid var(--border); border-radius:10px;
          padding:10px 12px; transition:.15s;
        }
        .modal-root .field-input-wrap:focus-within { border-color:var(--accent); }
        .modal-root .field-input-wrap svg { color:#a09ea0; flex-shrink:0; }
        .modal-root .field-input-wrap input {
          border:none; outline:none; font-family:inherit;
          font-size:14px; width:100%; color:var(--text); background:transparent;
        }
        .modal-root .pw-toggle { background:none; border:none; cursor:pointer; color:#a09ea0; display:flex; }
        .modal-root .pw-toggle:hover { color:var(--text); }

        .modal-root .btn {
          width:100%; border-radius:10px; padding:12px 20px;
          font-weight:700; font-family:inherit; font-size:14.5px;
          background:var(--primary); color:#fff; border:none;
          cursor:pointer; transition:.15s; margin-top:6px;
        }
        .modal-root .btn:hover { filter:brightness(1.12); }

        .modal-root .switch-line {
          text-align:center; font-size:13px; color:#6b696b; margin-top:18px;
        }
        .modal-root .switch-line button {
          background:none; border:none; color:var(--accent); font-weight:600;
          cursor:pointer; font-family:inherit; font-size:13px; padding:0; margin-left:4px;
        }
      `}</style>

      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="닫기">
          <ModalIcon path={modalIcons.close} size={20} />
        </button>

        <div className="modal-logo">
          <span className="logo-dot" />
          My calendar
        </div>
        <h2 className="modal-title">
          {mode === "login" ? "다시 만나서 반가워요" : "환영해요, 시작해볼까요"}
        </h2>
        <p className="modal-sub">
          {mode === "login"
            ? "로그인하고 저장해둔 일정을 이어서 확인하세요."
            : "가입하면 일정이 클라우드에 안전하게 저장돼요."}
        </p>

        <div className="tab-row">
          <button
            className={`tab-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            로그인
          </button>
          <button
            className={`tab-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
          >
            회원가입
          </button>
        </div>

        <div className="social-col">
          <button className="social-btn" onClick={handleGoogle}>
            <GoogleLogo />
            Google로 {mode === "login" ? "로그인" : "시작하기"}
          </button>
          <button className="social-btn kakao" onClick={handleKakao}>
            <KakaoLogo />
            카카오로 {mode === "login" ? "로그인" : "시작하기"}
          </button>
        </div>

        {errorMsg && (
          <p style={{ color: "#E01E5A", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>{errorMsg}</p>
        )}

        <div className="divider">또는</div>

        <form onSubmit={handleEmailSubmit}>
          {mode === "signup" && (
            <div className="field">
              <div className="field-input-wrap">
                <ModalIcon path={modalIcons.user} size={16} />
                <input type="text" placeholder="이름" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
          )}
          <div className="field">
            <div className="field-input-wrap">
              <ModalIcon path={modalIcons.mail} size={16} />
              <input type="email" placeholder="이메일" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <div className="field-input-wrap">
              <ModalIcon path={modalIcons.lock} size={16} />
              <input
                type={showPw ? "text" : "password"}
                placeholder="비밀번호 (6자 이상)"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label="비밀번호 표시 전환"
              >
                <ModalIcon path={modalIcons.eye} size={16} />
              </button>
            </div>
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입하고 시작하기"}
          </button>
        </form>

        <p className="switch-line">
          {mode === "login" ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Bboggl · STEP 3 (수정 v3) — 메인 캘린더 화면
   - 자유 서술형 다중 일정 입력(문장 여러 개를 한 번에 분리해 인식)
   - 텍스트 명령으로 캘린더 수정(삭제/시간 변경, 공휴일 일괄 처리)
   - 캘린더 이름 더블클릭 편집
   - 칸 배경색에 따라 날짜 숫자 + 요일 글자 자동 대비
   - 반복 일정 "이 날짜만/모두 적용" 토글, 톤온톤·템플릿·이미지 꾸미기

   * 아래 파서는 화면 데모용 규칙 기반 휴리스틱입니다. 예시 문장들은
     잘 인식하도록 튜닝했지만, 진짜 자유 형식 자연어를 100% 이해하려면
     PART 2에서 AI(LLM) 기반 파싱 API로 교체해야 합니다.
   * 업로드 이미지는 브라우저 메모리에만 보관되는 더미 동작이며
     새로고침 시 초기화됩니다.
   ============================================================ */

const Icon = ({ path, size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);

const icons = {
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 13l4 4L19 7" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.2-2.6 4" />
      <path d="M12 17.4h.01" />
    </>
  ),
  dots: (
    <>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h9a6 6 0 1 1 0 12" />
    </>
  ),
  palette: (
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.6-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a4 4 0 0 0 4-4c0-4.4-3.6-8.2-8-8.2Zm-5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  ),
  sparkle: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  droplet: <path d="M12 3s6 6.8 6 10.8A6 6 0 0 1 6 13.8C6 9.8 12 3 12 3Z" />,
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5.5-5.5-4 4-3-3L3 16" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="3" width="18" height="6" rx="1.5" />
      <rect x="3" y="11" width="8" height="10" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_FULL = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/* 요일 라벨 — 레퍼런스에 맞춰 한/영, 전체/축약/한글자 형식을 자유롭게 전환 */
const WEEKDAY_SETS = {
  "ko-full": ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
  "ko-short": ["일", "월", "화", "수", "목", "금", "토"],
  "ko-letter": ["일", "월", "화", "수", "목", "금", "토"],
  "en-full": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "en-short": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "en-letter": ["S", "M", "T", "W", "T", "F", "S"],
};
function getWeekdayLabels(lang, format) {
  return WEEKDAY_SETS[`${lang}-${format}`] || WEEKDAY_LABELS;
}
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/* 캘린더 판 위에 넣을 큰 제목 텍스트(예: "7월", "JULY", "July") */
function getBoardTitle(monthNum, lang, titleCase) {
  if (lang === "ko") return `${monthNum}월`;
  const name = MONTH_NAMES_EN[monthNum - 1] || "";
  if (titleCase === "upper") return name.toUpperCase();
  if (titleCase === "lower") return name.toLowerCase();
  return name;
}
const WEEKDAY_CHARS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const PALETTE = ["#1264A3", "#2EB67D", "#ECB22E", "#4A154B"];
// 예전에 CSS 변수 문자열로 저장된 색을 실제 hex로 변환(일정 블록 스타일 계산이 hex를 필요로 함)
const VAR_TO_HEX = { "var(--accent)": "#1264A3", "var(--green)": "#2EB67D", "var(--yellow)": "#ECB22E", "var(--primary)": "#4A154B" };
// 일정 블록 색상 커스터마이징용 팔레트 (기본 4색 + 자주 쓰는 색)
const EVENT_COLOR_CHOICES = ["#1264A3", "#2EB67D", "#ECB22E", "#4A154B", "#E01E5A", "#C1631F", "#7A5233", "#36364F"];
const THEME_PRESETS = ["#4A154B", "#1264A3", "#2EB67D", "#E01E5A", "#36364F"];
const DEFAULT_START = 13 * 60; // 시간 정보 없는 날짜 일정의 기본값: 오후 1시~2시(추정)
const DEFAULT_END = 14 * 60;

/* 고정 날짜 공휴일의 원래 월/일 — API가 준 날짜가 이거랑 다르면 대체공휴일로 표시 */
const FIXED_HOLIDAY_CANONICAL_MD = {
  "새해": [1, 1],
  "3·1절": [3, 1],
  "어린이날": [5, 5],
  "현충일": [6, 6],
  "제헌절": [7, 17],
  "광복절": [8, 15],
  "개천절": [10, 3],
  "한글날": [10, 9],
  "크리스마스": [12, 25],
};

/* allHolidays: 같은 해의 전체 공휴일 목록(설날/추석처럼 고정 월일이 없는 음력 공휴일의
   대체공휴일을 판단하려면 같은 이름 연휴 날짜들을 함께 봐야 해요) */
function holidayLabelFor(h, allHolidays) {
  const [, m, d] = h.date.split("-").map(Number);
  const canonical = FIXED_HOLIDAY_CANONICAL_MD[h.localName];
  if (canonical && (canonical[0] !== m || canonical[1] !== d)) {
    return `${h.localName} (대체공휴일)`;
  }
  // 음력 연휴(설날/추석)는 고정 월일이 없어 위 방식으로 못 잡아요.
  // 연휴 날짜들이 하루씩 이어지지 않고 벌어져 있으면(그 사이 날이 일요일과 겹쳐 빠진 경우)
  // 원래 연휴 마지막 날 뒤에 하루가 밀려서 추가된 거라, 그 마지막 날짜가 대체공휴일이에요.
  if (!canonical && allHolidays) {
    const group = allHolidays.filter((x) => x.localName === h.localName).map((x) => x.date).sort();
    if (group.length > 1) {
      const spanDays = Math.round(
        (new Date(group[group.length - 1] + "T00:00:00Z") - new Date(group[0] + "T00:00:00Z")) / 86400000
      );
      if (spanDays > group.length - 1 && h.date === group[group.length - 1]) {
        return `${h.localName} (대체공휴일)`;
      }
    }
  }
  return h.localName;
}

const TONE_PRESETS = [
  { name: "그린 톤", bg: "#F2F8F4", border: "#CFE8DA", accent: "#2F7D5A" },
  { name: "오렌지 톤", bg: "#FFF6EC", border: "#F3D9BE", accent: "#C1631F" },
  { name: "블루 톤", bg: "#EFF5FB", border: "#CBDEF0", accent: "#1264A3" },
  { name: "브라운 톤", bg: "#F8F2EA", border: "#E1D2BE", accent: "#7A5233" },
  { name: "퍼플 톤", bg: "#F7F0F8", border: "#E1CBE6", accent: "#4A154B" },
];

const TEMPLATE_PRESETS = [
  { id: "minimal", name: "모던 미니멀", swatch: ["#E4D8C8", "#B5693F", "#F6EFE4"],
    pageBg: "#E4D8C8", cellBg: "#F6EFE4", cellBorder: "#D8C7AE", cellRadius: "4px",
    accent: "#B5693F", monthFont: "'Playfair Display', serif", monthWeight: 500, monthStyle: "italic", decor: "pill" },
  { id: "sage", name: "세이지 아치", swatch: ["#7C8B6B", "#F5F0E3", "#B5542A"],
    pageBg: "#7C8B6B", cellBg: "#F5F0E3", cellBorder: "#DCD3BC", cellRadius: "10px",
    accent: "#B5542A", monthFont: "'Playfair Display', serif", monthWeight: 500, monthStyle: "normal", decor: "pill" },
  { id: "bold", name: "볼드 레트로", swatch: ["#F1E4D6", "#D6432D", "#D6432D"],
    pageBg: "#F1E4D6", cellBg: "#F1E4D6", cellBorder: "#D6432D", cellRadius: "18px",
    accent: "#D6432D", monthFont: "'Archivo Black', sans-serif", monthWeight: 400, monthStyle: "normal", decor: "block" },
  { id: "stripe", name: "플레이풀 스트라이프", swatch: ["#3355C9", "#F5EFDD", "#D6432D"],
    pageBg: "#F5EFDD", cellBg: "#F5EFDD", cellBorder: "#3355C9", cellRadius: "10px",
    accent: "#D6432D", monthFont: "'Baloo 2', sans-serif", monthWeight: 800, monthStyle: "normal",
    decor: "stripe", stripeColors: ["#3355C9", "#6C8CE8"] },
];

function colorFor(label) {
  let hash = 0;
  for (const c of label) hash += c.charCodeAt(0);
  return PALETTE[hash % PALETTE.length];
}

/* AI가 고른 fontKey → 실제 CSS 폰트 패밀리 (프로젝트에 이미 로드된 4종만 사용) */
const AI_FONT_MAP = {
  poppins: "'Poppins', sans-serif",
  playfair: "'Playfair Display', serif",
  archivo: "'Archivo Black', sans-serif",
  baloo: "'Baloo 2', sans-serif",
};

const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const clampInt = (v, min, max, dflt) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").replace("px", ""), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : dflt;
};
const hexRgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const hexWithAlpha = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
/* amt<0 이면 어둡게, >0 이면 밝게 (−1~1) */
const shadeHex = (hex, amt) => {
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const [r, g, b] = hexRgb(hex);
  const ch = (c) => Math.round((t - c) * p + c);
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
};

/* analyze-theme가 준 원본 JSON을 기존 템플릿(activeTemplate)과 동일한 구조로 정규화 */
function buildTemplateFromAiTheme(ai) {
  if (!ai || typeof ai !== "object") return null;
  const accent = isHex(ai.accent) ? ai.accent : "#4A154B";
  const pageBg = isHex(ai.pageBg) ? ai.pageBg : "#FAFAFB";
  const cellBg = isHex(ai.cellBg) ? ai.cellBg : "#FFFFFF";
  const cellBorder = isHex(ai.cellBorder) ? ai.cellBorder : "#E8E8E8";
  const decor = ["pill", "block", "stripe", "plain"].includes(ai.decor) ? ai.decor : "pill";
  const stripeColors = Array.isArray(ai.stripeColors) && ai.stripeColors.filter(isHex).length === 2
    ? ai.stripeColors : [accent, cellBg];
  const eventStyle = ["solid", "soft", "outline", "flat"].includes(ai.eventStyle) ? ai.eventStyle : "solid";
  return {
    id: "ai-custom",
    isCustom: true,
    name: (typeof ai.name === "string" && ai.name.trim()) ? ai.name.trim().slice(0, 24) : "AI 테마",
    pageBg, cellBg, cellBorder, accent,
    cellRadius: `${clampInt(ai.cellRadius, 0, 28, 10)}px`,
    cellGap: clampInt(ai.cellGap, 0, 16, 8),
    cellMinHeight: clampInt(ai.cellMinHeight, 70, 180, 150),
    cellBorderWidth: clampInt(ai.cellBorderWidth, 0, 3, 1),
    weekdayColor: isHex(ai.weekdayColor) ? ai.weekdayColor : undefined,
    // titleFontKey(신규) 우선, 없으면 예전 fontKey 호환
    monthFont: AI_FONT_MAP[ai.titleFontKey] || AI_FONT_MAP[ai.fontKey] || AI_FONT_MAP.poppins,
    bodyFont: AI_FONT_MAP[ai.bodyFontKey] || AI_FONT_MAP.poppins,
    monthWeight: clampInt(ai.monthWeight, 400, 800, 600),
    monthStyle: ai.monthStyle === "italic" ? "italic" : "normal",
    decor, stripeColors,
    eventStyle,
    eventRadius: clampInt(ai.eventRadius, 0, 20, 7),
    swatch: [pageBg, accent, cellBg],
    // ── 레이아웃 자유도 (판 폭/정렬, 칸 비율, 요일 한·영, 날짜 숫자, 판 위 제목) ──
    boardMaxWidth: (Number.isFinite(ai.boardMaxWidth) && ai.boardMaxWidth >= 360) ? clampInt(ai.boardMaxWidth, 360, 1100, 1100) : null,
    boardAlign: ai.boardAlign === "center" ? "center" : "left",
    cellAspect: (typeof ai.cellAspect === "number" && ai.cellAspect >= 0.5 && ai.cellAspect <= 2)
      ? Math.round(ai.cellAspect * 100) / 100 : null,
    weekdayLang: ai.weekdayLang === "en" ? "en" : "ko",
    weekdayFormat: ["full", "short", "letter"].includes(ai.weekdayFormat) ? ai.weekdayFormat : "short",
    weekdayAlign: ["left", "center", "right"].includes(ai.weekdayAlign) ? ai.weekdayAlign : "center",
    showWeekday: ai.showWeekday !== false,
    dateFont: AI_FONT_MAP[ai.dateFontKey] || null,
    dateSize: clampInt(ai.dateSize, 10, 26, 12),
    dateAlign: ["left", "center", "right"].includes(ai.dateAlign) ? ai.dateAlign : "left",
    boardTitle: !!ai.boardTitle,
    titleLang: ai.titleLang === "ko" ? "ko" : "en",
    titleCase: ["upper", "title", "lower"].includes(ai.titleCase) ? ai.titleCase : "upper",
    titlePosition: ["left", "center", "right"].includes(ai.titlePosition) ? ai.titlePosition : "left",
  };
}

/* activeTemplate(있으면)에서 레이아웃 값들을 기본값과 함께 뽑아줍니다.
   테마가 없거나 예전 프리셋이면 기존과 동일한 기본 레이아웃이 되도록 함. */
function themeLayout(t) {
  return {
    boardMaxWidth: t?.boardMaxWidth || null,
    boardAlign: t?.boardAlign || "left",
    cellAspect: t?.cellAspect || null,
    weekdayLang: t?.weekdayLang || "ko",
    weekdayFormat: t?.weekdayFormat || "short",
    weekdayAlign: t?.weekdayAlign || "center",
    showWeekday: t?.showWeekday !== false,
    dateFont: t?.dateFont || null,
    dateSize: t?.dateSize || 12,
    dateAlign: t?.dateAlign || "left",
    boardTitle: !!t?.boardTitle,
    titleLang: t?.titleLang || "en",
    titleCase: t?.titleCase || "upper",
    titlePosition: t?.titlePosition || "left",
  };
}

/* 일정 블록(월간 바 / 일간 블록)을 테마 eventStyle에 맞춰 칠하는 방법을 계산 */
function eventVisualStyle(baseColor, eventStyle) {
  const hex = isHex(baseColor) ? baseColor : "#4A154B";
  if (eventStyle === "outline") return { background: "transparent", color: hex, border: `1.5px solid ${hex}` };
  if (eventStyle === "soft") return { background: hexWithAlpha(hex, 0.18), color: shadeHex(hex, -0.25), border: "none" };
  // solid / flat: 색으로 꽉 채우고 흰 글씨 (flat은 모서리만 각지게 — radius는 별도 적용)
  return { background: hex, color: getContrastText(hex), border: "none" };
}

/* 배경색 명도를 계산해 잘 보이는 텍스트 색(검정/흰색)을 반환 */
function getContrastText(hex) {
  if (!hex) return null;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1D1C1D" : "#FFFFFF";
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dk = (m, d) => `${m}-${d}`;
const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`; // Supabase date 컬럼과 매칭되는 'YYYY-MM-DD' 키

/** Supabase events 행(+event_overrides 조인 결과)을 프론트엔드 entry 형태로 변환 */
function dbRowToEntry(row) {
  const overrides = {};
  (row.event_overrides || []).forEach((ov) => {
    overrides[ov.override_date] = {
      start: ov.start_minutes,
      end: ov.end_minutes,
      skip: ov.skip,
      timeLabel: ov.start_minutes != null ? `${formatMinutes(ov.start_minutes)}~${formatMinutes(ov.end_minutes)}` : "",
    };
  });
  let date = null;
  if (row.event_date) {
    const [, m, d] = row.event_date.split("-").map(Number);
    date = { month: m, day: d };
  }
  return {
    id: row.id,
    type: row.type,
    daysOfWeek: row.days_of_week,
    date,
    eventDate: row.event_date ?? null, // 원본 날짜 문자열(YYYY-MM-DD, 연도 포함) — 실행 취소 복원에 필요
    start: row.start_minutes,
    end: row.end_minutes,
    timeLabel: row.start_minutes != null ? `${formatMinutes(row.start_minutes)}~${formatMinutes(row.end_minutes)}` : "",
    label: row.label,
    text: row.raw_text,
    color: VAR_TO_HEX[row.color] || (isHex(row.color) ? row.color : null) || (row.is_holiday ? HOLIDAY_COLOR : colorFor(row.label)),
    isHoliday: !!row.is_holiday,
    overrides,
  };
}

const HOLIDAY_COLOR = "#E01E5A";

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "오전" : "오후";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${ampm} ${hh}:${String(m).padStart(2, "0")}`;
}
function toMinutes12(ampm, hour, minute) {
  let h = hour % 12;
  if (ampm === "오후") h += 12;
  return h * 60 + (minute || 0);
}
function buildTimeResult(full, ap1, h1, m1, ap2, h2, m2) {
  const apA = ap1 || ap2 || "오전";
  const apB = ap2 || ap1 || "오전";
  const start = toMinutes12(apA, parseInt(h1, 10), m1 ? parseInt(m1, 10) : 0);
  let end = toMinutes12(apB, parseInt(h2, 10), m2 ? parseInt(m2, 10) : 0);
  if (end <= start) end += 60;
  return { matchedStr: full, start, end };
}

/* 시간 구간 파싱: "오후2시~3시" / "9시부터 18시까지" / "14:00~15:00" 등 */
function parseTimeSpan(text) {
  const kMatch = text.match(
    /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*[~-]\s*(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/
  );
  if (kMatch) return buildTimeResult(...kMatch);

  const btMatch = text.match(
    /(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*부터\s*(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*까지/
  );
  if (btMatch) return buildTimeResult(...btMatch);

  const hhMatch = text.match(/(\d{1,2}):(\d{2})\s*[~-]\s*(\d{1,2}):(\d{2})/);
  if (hhMatch) {
    const [full, h1, m1, h2, m2] = hhMatch;
    const start = parseInt(h1, 10) * 60 + parseInt(m1, 10);
    const end = parseInt(h2, 10) * 60 + parseInt(m2, 10);
    return { matchedStr: full, start, end };
  }
  return null;
}

/* 반복 요일 파싱: 평일/주말/범위(월~금)/매주 X/쉼표 나열(월,화,수) 모두 지원 */
function parseWeekdayList(text) {
  if (/평일/.test(text)) return [1, 2, 3, 4, 5];
  if (/주말/.test(text)) return [0, 6];

  const rangeMatch = text.match(/([월화수목금토일])\s*[~-]\s*([월화수목금토일])/);
  if (rangeMatch) {
    const start = WEEKDAY_CHARS[rangeMatch[1]];
    const end = WEEKDAY_CHARS[rangeMatch[2]];
    const arr = [];
    let d = start;
    while (true) { arr.push(d); if (d === end) break; d = (d + 1) % 7; }
    return arr;
  }

  const singleMatch = text.match(/매주\s*([월화수목금토일])(?:요일)?/);
  if (singleMatch) return [WEEKDAY_CHARS[singleMatch[1]]];

  const listMatch = text.match(/([월화수목금토일](?:\s*[,、]\s*[월화수목금토일]){1,6})/);
  if (listMatch) {
    const chars = listMatch[1].split(/[,、\s]+/).filter(Boolean);
    const arr = [...new Set(chars.map((c) => WEEKDAY_CHARS[c]))].sort((a, b) => a - b);
    if (arr.length >= 2) return arr;
  }
  return null;
}

/* 일정 이름(라벨) 추출: "OO에서" / "OO 약속" 패턴을 우선 사용 */
function extractLabel(text) {
  const placeMatch = text.match(/([가-힣A-Za-z0-9]{1,10})\s*에서/);
  if (placeMatch) return placeMatch[1];
  const apptMatch = text.match(/([가-힣A-Za-z0-9]{1,10})\s*(?:약속|모임|미팅)/);
  if (apptMatch) return apptMatch[1];
  return null;
}

function fallbackLabel(text, timeSpan) {
  let label = text;
  if (timeSpan) label = label.replace(timeSpan.matchedStr, " ");
  label = label
    .replace(/평일|주말|매주|요일|일정|나는|저는|그리고|하고|퇴근\s*후에|후에|약속이?\s*있어|약속|있어|일을\s*해|일해|해요?\.?$/g, " ")
    .replace(/[,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return label || "제목 없음";
}

/* 한 문장(절)을 일정 초안 배열로 변환. 날짜가 여러 개 나열되면 여러 건으로 분리 */
function parseClause(raw, viewMonth) {
  const text = raw.trim();
  if (!text) return [];

  const daysOfWeek = parseWeekdayList(text);
  const timeSpan = parseTimeSpan(text);
  const placeLabel = extractLabel(text);
  const label = placeLabel || fallbackLabel(text, timeSpan);

  if (daysOfWeek) {
    return [{
      type: "recurring", daysOfWeek, date: null,
      start: timeSpan ? timeSpan.start : null,
      end: timeSpan ? timeSpan.end : null,
      timeLabel: timeSpan ? `${formatMinutes(timeSpan.start)}~${formatMinutes(timeSpan.end)}` : "",
      label, text, overrides: {},
    }];
  }

  const textForDate = timeSpan ? text.replace(timeSpan.matchedStr, " ") : text;
  const slashMatch = textForDate.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  const kMonthDay = textForDate.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  let dates = [];
  if (slashMatch) {
    dates = [{ month: parseInt(slashMatch[1], 10), day: parseInt(slashMatch[2], 10) }];
  } else if (kMonthDay) {
    dates = [{ month: parseInt(kMonthDay[1], 10), day: parseInt(kMonthDay[2], 10) }];
  } else {
    const dayNums = [...textForDate.matchAll(/(\d{1,2})\s*일(?!주)/g)].map((m) => parseInt(m[1], 10)).filter((d) => d >= 1 && d <= 31);
    if (dayNums.length > 0) {
      dates = dayNums.map((d) => ({ month: viewMonth, day: d }));
    } else {
      const bareNum = textForDate.match(/(?:^|\s)(\d{1,2})(?=\s|$)/);
      if (bareNum) {
        const d = parseInt(bareNum[1], 10);
        if (d >= 1 && d <= 31) dates = [{ month: viewMonth, day: d }];
      }
    }
  }

  let timeInfo;
  if (timeSpan) {
    timeInfo = { start: timeSpan.start, end: timeSpan.end, timeLabel: `${formatMinutes(timeSpan.start)}~${formatMinutes(timeSpan.end)}` };
  } else if (dates.length > 0) {
    timeInfo = { start: DEFAULT_START, end: DEFAULT_END, timeLabel: `${formatMinutes(DEFAULT_START)}~${formatMinutes(DEFAULT_END)} (추정)` };
  } else {
    timeInfo = { start: null, end: null, timeLabel: "" };
  }

  if (dates.length > 0) {
    return dates.map((d) => ({ type: "special", daysOfWeek: null, date: d, ...timeInfo, label, text, overrides: {} }));
  }
  return [{ type: "special", daysOfWeek: null, date: null, ...timeInfo, label, text, overrides: {} }];
}

/* 두서없이 쓴 긴 문장을 여러 절로 분리 ("그리고", "~하고", 줄바꿈 기준) */
function splitClauses(raw) {
  return raw
    .split(/그리고|하고\s+|\n+/)
    .map((s) => s.replace(/^[\s,.]+|[\s,.]+$/g, ""))
    .filter(Boolean);
}

/* 텍스트 명령 해석: "OO 일정 지워줘" / "N일 X시부터 Y시까지만 OO로 바꿔줘" / "공휴일에서 OO 지워줘" / "공휴일 일정 없애줘" */
function tryParseCommand(text, entries, viewMonth) {
  const isDelete = /(지워줘|지워|삭제|빼줘|없애줘|줄여줘|쉬기로)/.test(text);
  const isChange = /(바꿔줘|바꿔주세요|변경)/.test(text) && /(부터|까지|[~-])/.test(text);
  if (!isDelete && !isChange) return null;

  const candidateLabels = [...new Set(entries.map((e) => e.label).filter(Boolean))];
  const targetLabel = candidateLabels.find((l) => text.includes(l));

  const mentionsHoliday = /공휴일/.test(text);
  // "공휴일에 ~" (에 조사) = 공휴일 자체가 아니라 "공휴일인 날짜에 있는 다른 일정"을 가리킴
  const holidayLocative = /공휴일에/.test(text);

  if (mentionsHoliday && isDelete && !targetLabel) {
    // "공휴일에 일정 지워줘" 처럼 특정 대상 없이 "공휴일 날짜의 일정들"을 지우라는 명령
    if (holidayLocative) return { type: "skip-holiday-events" };
    // "공휴일 지워줘/없애줘" 처럼 공휴일 자체를 지우라는 명령
    return { type: "delete-holidays" };
  }

  if (!targetLabel) return null;

  let dates = [];
  if (mentionsHoliday) {
    dates = entries
      .filter((e) => e.isHoliday && e.date && e.date.month === viewMonth)
      .map((e) => e.date.day);
  } else {
    dates = [...text.matchAll(/(\d{1,2})\s*일(?!주)/g)].map((m) => parseInt(m[1], 10)).filter((d) => d >= 1 && d <= 31);
  }

  if (isChange) {
    const timeSpan = parseTimeSpan(text);
    if (timeSpan) return { type: "override-time", label: targetLabel, dates, start: timeSpan.start, end: timeSpan.end };
  }
  if (isDelete) return { type: "skip", label: targetLabel, dates };
  return null;
}

const SEED_TEXTS = [
  "월~금 오전 9시~오후 6시 회사",
  "매주 화 오후 7시~오후 8시 필라테스",
  "26일 오후 2시~오후 3시 팀 미팅",
];

/* ---------- 하루 타임라인 (드래그로 시간 조정) — 상세 모달과 1일 보기에서 공용 ---------- */
function DayTimeline({ year, monthNum, day, events, onUpdate, onDelete, onDragActive, height = 380, fit = false, fitSignal = 0, eventStyle = "solid" }) {
  const SNAP = 5;
  const dateKey = isoDate(year, monthNum, day);
  const scrollRef = useRef(null);
  const dragRef = useRef(null);
  const previewRef = useRef({});
  const typeByIdRef = useRef({});
  const applyAllMapRef = useRef({});
  const dateKeyRef = useRef(dateKey);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onDragActiveRef = useRef(onDragActive);
  const movedRef = useRef(false); // 드래그 중 실제로 움직였는지(클릭과 구분)
  const [applyAllMap, setApplyAllMap] = useState({});
  const [fitHourH, setFitHourH] = useState(32); // fit 모드: 사용 가능한 높이에 맞춰 자동 계산
  const [, forceTick] = useState(0);

  // fit 모드가 아니면 기존처럼 시간당 52px 고정, fit이면 24시간이 화면에 딱 들어오게 압축
  const HOUR_H = fit ? fitHourH : 52;
  const hourHRef = useRef(HOUR_H);

  // 날짜가 바뀔 수 있는(1일 보기의 날짜 이동) 값들은 ref로 최신화해서
  // 드래그 종료 핸들러가 항상 현재 날짜/콜백/시간칸높이를 쓰도록 함
  useEffect(() => { dateKeyRef.current = dateKey; onUpdateRef.current = onUpdate; onDeleteRef.current = onDelete; onDragActiveRef.current = onDragActive; hourHRef.current = HOUR_H; });
  useEffect(() => { applyAllMapRef.current = applyAllMap; }, [applyAllMap]);
  useEffect(() => { events.forEach((e) => { typeByIdRef.current[e.id] = e.type; }); }, [events]);
  // 스크롤 모드(모달)에서만 아침 7시로 스크롤 — fit 모드는 스크롤이 없어요
  useEffect(() => { if (!fit && scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H - 30; }, []);
  // 날짜가 바뀌면 이전 날짜의 드래그 미리보기를 비워요
  useEffect(() => { previewRef.current = {}; forceTick((t) => t + 1); }, [dateKey]);

  // fit 모드: 타임라인 영역의 실제 높이를 재서 시간칸 높이(24등분)를 맞춰요 (창 크기 변화에도 대응)
  // fitSignal(바깥에서 계산한 컨테이너 높이)이 바뀌면 다시 재서, 첫 렌더에서도 정확히 맞아요.
  useEffect(() => {
    if (!fit) return;
    const measure = () => {
      const el = scrollRef.current;
      if (el && el.clientHeight > 0) setFitHourH(el.clientHeight / 24);
    };
    measure();
    const raf = requestAnimationFrame(measure); // 레이아웃이 확정된 다음 프레임에 한 번 더
    const ro = new ResizeObserver(measure);
    if (scrollRef.current) ro.observe(scrollRef.current);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [fit, fitSignal]);

  useEffect(() => {
    const overTrash = (x, y) => {
      const el = document.getElementById("drag-trash");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      movedRef.current = true;
      // 휴지통 위로 끌면 미리보기는 그대로 두고 삭제 대기 상태만 표시(놓으면 삭제)
      const el = document.getElementById("drag-trash");
      if (el) el.classList.toggle("over", overTrash(e.clientX, e.clientY));
      const deltaY = e.clientY - d.startY;
      const deltaMin = Math.round(((deltaY / hourHRef.current) * 60) / SNAP) * SNAP;
      let newStart = d.origStart, newEnd = d.origEnd;
      if (d.mode === "move") {
        const dur = d.origEnd - d.origStart;
        newStart = clamp(d.origStart + deltaMin, 0, 1440 - dur);
        newEnd = newStart + dur;
      } else if (d.mode === "top") {
        newStart = clamp(d.origStart + deltaMin, 0, d.origEnd - SNAP);
      } else if (d.mode === "bottom") {
        newEnd = clamp(d.origEnd + deltaMin, d.origStart + SNAP, 1440);
      }
      previewRef.current = { ...previewRef.current, [d.id]: { start: newStart, end: newEnd } };
      forceTick((t) => t + 1);
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (d) {
        if (movedRef.current && overTrash(e.clientX, e.clientY)) {
          // 휴지통에 놓음 → 삭제(반복 일정은 그 날짜만 건너뛰기 처리)
          onDeleteRef.current && onDeleteRef.current(d.id, dateKeyRef.current);
        } else {
          const pv = previewRef.current[d.id];
          if (pv) {
            const patch = { start: pv.start, end: pv.end, timeLabel: `${formatMinutes(pv.start)}~${formatMinutes(pv.end)}` };
            const isRecurring = typeByIdRef.current[d.id] === "recurring";
            const applyAll = isRecurring ? !!applyAllMapRef.current[d.id] : true;
            onUpdateRef.current(d.id, dateKeyRef.current, patch, applyAll);
          }
        }
        // 드래그가 끝나면 미리보기를 지워, 이후엔 실제 일정 값을 표시(실행 취소 등 외부 변경도 바로 반영)
        delete previewRef.current[d.id];
      }
      dragRef.current = null;
      movedRef.current = false;
      onDragActiveRef.current && onDragActiveRef.current(null);
      forceTick((t) => t + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = (id, mode, e, origStart, origEnd) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { id, mode, startY: e.clientY, origStart, origEnd };
    movedRef.current = false;
    onDragActiveRef.current && onDragActiveRef.current(id);
  };

  const timedEvents = events.filter((ev) => ev.start != null && ev.end != null);
  const allDayEvents = events.filter((ev) => ev.start == null);
  const recurringEvents = events.filter((ev) => ev.type === "recurring");
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      <style>{`
        .allday-row{ display:flex; gap:6px; flex-wrap:wrap; padding:10px 0 0; }
        .allday-chip{ font-size:11px; font-weight:600; color:#fff; padding:4px 10px; border-radius:20px; }
        .recur-section{ padding:12px 0 0; }
        .recur-title{ font-size:11px; font-weight:700; color:#8a888a; margin-bottom:6px; }
        .recur-row{ display:flex; align-items:center; gap:10px; padding:5px 0; }
        .recur-row span.name{ flex:1; font-size:12px; font-weight:600; }
        .recur-row span.mode-label{ font-size:10.5px; color:#8a888a; width:118px; text-align:right; }
        .switch{ width:32px; height:18px; border-radius:20px; background:#ddd; position:relative; cursor:pointer; flex-shrink:0; transition:.15s;}
        .switch.on{ background:var(--primary); }
        .switch-knob{ position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:.15s; box-shadow:0 1px 2px rgba(0,0,0,.25); }
        .switch.on .switch-knob{ left:16px; }
        .timeline-wrap{ overflow-y:auto; margin:14px 0 4px; border:1px solid var(--border);
          border-radius:12px; position:relative; }
        .timeline-inner{ position:relative; height:${24 * HOUR_H}px;
          background:repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_H}px, rgba(0,0,0,0.022) ${HOUR_H}px, rgba(0,0,0,0.022) ${2 * HOUR_H}px); }
        .hour-row{ position:absolute; left:0; right:0; height:${HOUR_H}px; border-top:1px solid #F0F0F0; display:flex; }
        .hour-label{ width:52px; flex-shrink:0; font-size:10px; color:#b3b1b3; padding:2px 0 0 8px; }
        .ev-block{ position:absolute; left:58px; right:10px; border-radius:var(--ev-radius, 8px); color:#fff;
          padding:5px 8px; font-size:11px; font-weight:600; cursor:grab; overflow:hidden; box-shadow:0 3px 8px rgba(0,0,0,0.15);
          font-family:var(--body-font, inherit); }
        .ev-block .ev-time{ font-size:9.5px; font-weight:500; opacity:0.9; margin-top:1px; }
        .handle{ position:absolute; left:0; right:0; height:8px; cursor:ns-resize; }
        .handle.top{ top:0; }
        .handle.bottom{ bottom:0; }
      `}</style>

      {allDayEvents.length > 0 && (
        <div className="allday-row">
          {allDayEvents.map((ev) => <span key={ev.id} className="allday-chip" style={{ background: ev.color }}>{ev.label}</span>)}
        </div>
      )}

      {recurringEvents.length > 0 && (
        <div className="recur-section">
          <div className="recur-title">반복 일정 수정 범위</div>
          {recurringEvents.map((ev) => (
            <div className="recur-row" key={ev.id}>
              <span className="name">{ev.label}</span>
              <span className={`switch ${applyAllMap[ev.id] ? "on" : ""}`} onClick={() => setApplyAllMap((p) => ({ ...p, [ev.id]: !p[ev.id] }))}>
                <span className="switch-knob" />
              </span>
              <span className="mode-label">{applyAllMap[ev.id] ? "모든 반복 일정에 적용" : "이 날짜만 적용"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="timeline-wrap" ref={scrollRef} style={fit ? { flex: 1, minHeight: 0, overflow: "hidden" } : { height }}>
        <div className="timeline-inner">
          {hours.map((h) => (
            <div key={h} className="hour-row" style={{ top: h * HOUR_H }}>
              <span className="hour-label">{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
          {timedEvents.map((ev) => {
            const pv = previewRef.current[ev.id];
            const start = pv ? pv.start : ev.start;
            const end = pv ? pv.end : ev.end;
            const vis = eventVisualStyle(ev.color, eventStyle);
            return (
              <div key={ev.id} className="ev-block"
                style={{ top: (start / 60) * HOUR_H, height: Math.max(((end - start) / 60) * HOUR_H, 22), ...vis }}
                onMouseDown={(e) => startDrag(ev.id, "move", e, ev.start, ev.end)}>
                <div className="handle top" onMouseDown={(e) => startDrag(ev.id, "top", e, ev.start, ev.end)} />
                {ev.label}
                <div className="ev-time">{formatMinutes(start)}~{formatMinutes(end)}</div>
                <div className="handle bottom" onMouseDown={(e) => startDrag(ev.id, "bottom", e, ev.start, ev.end)} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- 날짜 상세 보기 모달 ---------- */
function DayDetailModal({ year, day, monthNum, weekday, events, onClose, onUpdate, eventStyle = "solid" }) {
  return (
    <div className="detail-overlay" onClick={onClose}>
      <style>{`
        .detail-overlay{ position:fixed; inset:0; background:rgba(29,28,29,0.5); display:flex;
          align-items:center; justify-content:center; z-index:200; font-family:'Poppins',sans-serif; padding:20px; }
        .detail-card{ background:#fff; border-radius:20px; width:480px; max-width:100%;
          box-shadow:0 24px 60px rgba(0,0,0,0.28); overflow:hidden; padding:0 22px 20px; }
        .detail-head{ display:flex; align-items:center; justify-content:space-between;
          padding:20px 0 14px; border-bottom:1px solid var(--border); margin-bottom:0; }
        .detail-title{ font-size:17px; font-weight:700; }
        .detail-sub{ font-size:12px; color:#8a888a; margin-top:4px; }
        .detail-close{ background:none; border:none; cursor:pointer; color:#9a989a; }
        .detail-close:hover{ color:var(--text); }
      `}</style>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <div>
            <div className="detail-title">{monthNum}월 {day}일 ({WEEKDAY_FULL[weekday]})</div>
            <div className="detail-sub">블록을 드래그해서 옮기거나, 위/아래 끝을 드래그해서 길이를 조절하세요</div>
          </div>
          <button className="detail-close" onClick={onClose} aria-label="닫기"><Icon path={icons.close} size={20} /></button>
        </div>
        <DayTimeline year={year} monthNum={monthNum} day={day} events={events} onUpdate={onUpdate} height={380} eventStyle={eventStyle} />
      </div>
    </div>
  );
}

/* ---------- 일정 간략보기용 도형 ---------- */
const EVENT_SHAPES = [
  { key: "dot", label: "동그라미" },
  { key: "square", label: "네모" },
  { key: "roundsquare", label: "둥근네모" },
  { key: "diamond", label: "마름모" },
  { key: "triangle", label: "세모" },
  { key: "heart", label: "하트" },
  { key: "star", label: "별" },
];

function EventGlyph({ color = "#4A154B", shape = "dot", size = 10, title }) {
  const box = { width: size, height: size, display: "inline-block", flexShrink: 0 };
  if (shape === "square") return <span title={title} style={{ ...box, background: color, borderRadius: 1 }} />;
  if (shape === "roundsquare") return <span title={title} style={{ ...box, background: color, borderRadius: Math.max(2, size * 0.3) }} />;
  if (shape === "diamond") return <span title={title} style={{ ...box, background: color, transform: "rotate(45deg)", borderRadius: 1 }} />;
  if (shape === "triangle")
    return <span title={title} style={{ width: 0, height: 0, display: "inline-block", flexShrink: 0,
      borderLeft: `${size / 2}px solid transparent`, borderRight: `${size / 2}px solid transparent`, borderBottom: `${size}px solid ${color}` }} />;
  if (shape === "heart")
    return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-label={title}><path fill={color} d="M12 21s-8-5.3-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.7-8 11-8 11z" /></svg>;
  if (shape === "star")
    return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-label={title}><path fill={color} d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9.6l6.9-.7z" /></svg>;
  return <span title={title} style={{ ...box, background: color, borderRadius: "50%" }} />; // dot
}

/* ---------- 스티커 오버레이 ----------
   업로드한 사진을 캘린더 위에 자유롭게 올려두고, 드래그로 이동 · 모서리로 크기조절 ·
   위쪽 손잡이로 회전할 수 있어요. 좌표(x,y)는 스티커 '중심'을 cal-wrap 기준 px로 저장합니다. */
function StickerLayer({ stickers, setStickers, selectedId, setSelectedId }) {
  const dragRef = useRef(null);

  const beginDrag = (e, st) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(st.id);
    const mode = e.target.dataset?.mode || "move";
    const el = e.currentTarget; // .sticker
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (mode === "scale") {
      dragRef.current = { mode, id: st.id, cx, cy, startDist: Math.hypot(e.clientX - cx, e.clientY - cy), startScale: st.scale };
    } else if (mode === "rotate") {
      dragRef.current = { mode, id: st.id, cx, cy, startAngle: Math.atan2(e.clientY - cy, e.clientX - cx), startRot: st.rotation };
    } else {
      dragRef.current = { mode: "move", id: st.id };
    }
  };

  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === "move") {
      setStickers((prev) => prev.map((s) => (s.id === d.id ? { ...s, x: s.x + e.movementX, y: s.y + e.movementY } : s)));
    } else if (d.mode === "scale") {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      const scale = Math.max(0.2, Math.min(5, d.startScale * (dist / (d.startDist || 1))));
      setStickers((prev) => prev.map((s) => (s.id === d.id ? { ...s, scale } : s)));
    } else if (d.mode === "rotate") {
      const ang = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
      const deg = d.startRot + ((ang - d.startAngle) * 180) / Math.PI;
      setStickers((prev) => prev.map((s) => (s.id === d.id ? { ...s, rotation: deg } : s)));
    }
  };
  const endDrag = () => { dragRef.current = null; };

  return (
    <div className="sticker-layer">
      {stickers.map((st) => {
        const selected = st.id === selectedId;
        const w = st.base * st.scale;
        return (
          <div
            key={st.id}
            className={`sticker ${selected ? "sel" : ""}`}
            style={{ left: st.x, top: st.y, width: w, transform: `translate(-50%,-50%) rotate(${st.rotation}deg)`, zIndex: st.z || 1 }}
            onPointerDown={(e) => beginDrag(e, st)}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img className="sticker-img" src={st.src} alt="" draggable={false} />
            {selected && (
              <>
                <span className="st-handle st-rotate" data-mode="rotate" title="회전" />
                <span className="st-handle st-scale" data-mode="scale" title="크기 조절" />
                <button
                  className="st-del"
                  title="삭제"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setStickers((prev) => prev.filter((s) => s.id !== st.id)); setSelectedId(null); }}
                >×</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 첫 방문 기능 안내 투어(스포트라이트) ---------- */
const TOUR_STEPS = [
  { sel: null, title: "환영해요! 👋",
    body: "My calendar는 생각나는 대로 적기만 하면 AI가 자동으로 정리해주는 캘린더예요. 주요 기능과 버튼 위치를 1분 만에 쭉 둘러볼게요." },
  { sel: ".sidebar", title: "① 일정 입력", pos: "left",
    body: "여기에 “월~금 9시부터 6시까지 회사”, “26일 오후 2시 팀 미팅” 처럼 편하게 적고 추가하면 AI가 알아서 반복 일정·특별 일정으로 나눠 캘린더에 넣어줘요. “회사 일정 지워줘” 같은 수정 명령도 인식해요." },
  { sel: ".entry-list", title: "② 일정 목록 · 색 · 도형", pos: "left",
    body: "추가된 일정이 모이는 곳이에요. 왼쪽 색 점을 눌러 색을, 도형 아이콘을 눌러 표시 도형을 바꿀 수 있어요. 목록의 일정을 캘린더로 끌어다 날짜를 옮기거나, 화면 아래 휴지통으로 끌어 삭제할 수도 있어요." },
  { sel: ".view-switch", title: "③ 월간 / 일간 전환", pos: "bottom",
    body: "한 달 달력과 하루 시간표(데일리 플래너)를 오가며 볼 수 있어요. 일간 화면에선 시간표를 드래그로 조절하고 할 일·메모도 적을 수 있어요." },
  { sel: ".month-nav", title: "④ 날짜 이동", pos: "bottom",
    body: "화살표로 이전/다음 달(일간에선 이전/다음 날)로 이동해요. 가운데 달 이름도 표시돼요." },
  { sel: ".cal-size-ctrl", title: "⑤ 크기 조절", pos: "bottom",
    body: "왼쪽 슬라이더로 캘린더 전체 크기를, ‘가’ 슬라이더로 칸 안 글씨 크기를 조절해요. 화면에 맞게 키우거나 줄일 수 있어요." },
  { sel: "[data-tour='undo']", title: "⑥ 실행 취소", pos: "bottom",
    body: "실수로 추가·삭제·이동했을 때 되돌려요. 키보드 Ctrl+Z 로도 돼요." },
  { sel: "[data-tour='deco']", title: "⑦ 꾸미기 (핵심!)", pos: "bottom",
    body: "캘린더 디자인을 바꾸는 곳이에요. ✨사진으로 AI 테마 만들기, 템플릿·프리셋, 포인트 색, 칸 색칠, 배경 이미지(투명도·크기)·스티커, 일정 도형 표시까지 여기서 모두 설정해요." },
  { sel: "[data-tour='download']", title: "⑧ 이미지로 저장", pos: "bottom",
    body: "지금 보이는 캘린더를 이미지 파일로 저장해 공유할 수 있어요." },
  { sel: "[data-tour='settings']", title: "⑨ 설정", pos: "bottom",
    body: "알림 등 계정 설정을 볼 수 있어요." },
  { sel: null, title: "이제 시작해볼까요? 🎉",
    body: "왼쪽에 첫 일정을 적어보세요. 이 안내는 우측 상단 물음표(?) 버튼을 누르면 언제든 다시 볼 수 있어요." },
];

function OnboardingTour({ steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];

  useEffect(() => {
    const measure = () => {
      if (!step.sel) { setRect(null); return; }
      const el = document.querySelector(step.sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else setRect(null);
    };
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [i, step.sel]);

  // 모바일 등에서 대상이 화면 밖에 있으면 스크롤해서 보이게(스텝 바뀔 때 1회)
  useEffect(() => {
    if (!step.sel) return;
    const el = document.querySelector(step.sel);
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [i, step.sel]);

  const last = i === steps.length - 1;
  const first = i === 0;
  const PAD = 8;

  // 툴팁 위치: 타겟 옆(pos)에 두되, 툴팁 실제 크기를 재서 화면 밖으로 안 나가게 항상 클램프
  const tipRef = useRef(null);
  const [tip, setTip] = useState({ top: 0, left: 0, ready: false });
  useLayoutEffect(() => {
    const place = () => {
      const el = tipRef.current;
      if (!el) return;
      const tw = el.offsetWidth, th = el.offsetHeight;
      const M = 14, GAP = 14, vw = window.innerWidth, vh = window.innerHeight;
      if (!rect) { setTip({ top: (vh - th) / 2, left: (vw - tw) / 2, ready: true }); return; }
      const pos = step.pos || "bottom";
      let top, left;
      if (pos === "left") { left = rect.left - tw - GAP; top = rect.top + rect.height / 2 - th / 2; }
      else if (pos === "right") { left = rect.left + rect.width + GAP; top = rect.top + rect.height / 2 - th / 2; }
      else if (pos === "top") { left = rect.left + rect.width / 2 - tw / 2; top = rect.top - th - GAP; }
      else { left = rect.left + rect.width / 2 - tw / 2; top = rect.top + rect.height + GAP; }
      // 지정한 쪽에 공간이 없으면 반대쪽으로 뒤집기
      if (pos === "left" && left < M) left = rect.left + rect.width + GAP;
      if (pos === "right" && left + tw > vw - M) left = rect.left - tw - GAP;
      if (pos === "bottom" && top + th > vh - M) top = rect.top - th - GAP;
      if (pos === "top" && top < M) top = rect.top + rect.height + GAP;
      // 최종 클램프 — 절대 화면 밖으로 안 나가게
      left = Math.min(Math.max(left, M), vw - tw - M);
      top = Math.min(Math.max(top, M), vh - th - M);
      setTip({ top, left, ready: true });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [i, rect, step.pos]);
  const tipStyle = { top: tip.top, left: tip.left, visibility: tip.ready ? "visible" : "hidden" };

  return (
    <div className="tour-root">
      <style>{`
        .tour-root{ position:fixed; inset:0; z-index:500; font-family:'Poppins','Apple SD Gothic Neo','Malgun Gothic',sans-serif; }
        .tour-backdrop{ position:absolute; inset:0; background:${rect ? "transparent" : "rgba(20,18,22,0.62)"}; }
        .tour-spot{ position:absolute; border-radius:12px; box-shadow:0 0 0 9999px rgba(20,18,22,0.62); pointer-events:none; }
        .tour-tip{ position:absolute; width:340px; max-width:calc(100vw - 32px); background:#fff; border-radius:16px;
          box-shadow:0 20px 50px rgba(0,0,0,0.3); padding:20px 20px 16px; z-index:2; }
        .tour-tip h4{ margin:0 0 8px; font-size:16px; color:var(--primary,#4A154B); }
        .tour-tip p{ margin:0; font-size:13.5px; line-height:1.65; color:#3a393a; }
        .tour-foot{ display:flex; align-items:center; justify-content:space-between; margin-top:16px; }
        .tour-dots{ display:flex; gap:5px; }
        .tour-dots i{ width:6px; height:6px; border-radius:50%; background:#dcdbdc; display:block; }
        .tour-dots i.on{ background:var(--primary,#4A154B); width:16px; border-radius:4px; }
        .tour-btns{ display:flex; gap:8px; }
        .tour-btn{ border:none; border-radius:9px; padding:8px 14px; font-family:inherit; font-weight:700; font-size:12.5px; cursor:pointer; }
        .tour-btn.ghost{ background:#F1F0F1; color:#6b696b; }
        .tour-btn.primary{ background:var(--primary,#4A154B); color:#fff; }
        .tour-skip{ position:fixed; top:16px; right:18px; background:rgba(255,255,255,0.9); border:none; border-radius:20px;
          padding:7px 14px; font-family:inherit; font-size:12.5px; font-weight:600; color:#6b696b; cursor:pointer; z-index:3; }
      `}</style>
      <div className="tour-backdrop" />
      {rect && <div className="tour-spot" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />}
      <button className="tour-skip" onClick={onClose}>건너뛰기 ✕</button>
      <div className="tour-tip" ref={tipRef} style={tipStyle}>
        <h4>{step.title}</h4>
        <p>{step.body}</p>
        <div className="tour-foot">
          <div className="tour-dots">{steps.map((_, n) => <i key={n} className={n === i ? "on" : ""} />)}</div>
          <div className="tour-btns">
            {!first && <button className="tour-btn ghost" onClick={() => setI((n) => n - 1)}>이전</button>}
            {last
              ? <button className="tour-btn primary" onClick={onClose}>시작하기</button>
              : <button className="tour-btn primary" onClick={() => setI((n) => n + 1)}>다음</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarPage({ onLogout = () => {}, onOpenSettings = () => {} }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const monthIdx = current.getMonth();
  const monthNum = monthIdx + 1;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false); // 첫 방문 기능 안내 투어
  // 좁은 화면(모바일) 여부 — 일간 시간표를 fit(높이 압축) 대신 고정 스크롤로 바꿔 스크롤 시 튐 방지
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= 760);
  useEffect(() => {
    const onR = () => setIsNarrow(window.innerWidth <= 760);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const [inputValue, setInputValue] = useState("");
  const [todoInput, setTodoInput] = useState(""); // 일간 플래너 To-Do 입력칸
  const [aiLoading, setAiLoading] = useState(false);
  const [viewMode, setViewMode] = useState("month"); // "month"(1달 달력) | "day"(1일 시간표)
  const [dayDate, setDayDate] = useState(new Date());
  const undoStackRef = useRef([]);   // 실행 취소 스택 (일정 변경 전 상태 스냅샷들)
  const entriesRef = useRef([]);     // 항상 최신 entries — 실행 취소가 stale 값을 쓰지 않도록
  const [canUndo, setCanUndo] = useState(false);
  const dayViewRef = useRef(null);   // 1일 보기 영역 — 뷰포트 높이에 맞추려고 위치를 재요
  const [dayViewH, setDayViewH] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [colorPickerId, setColorPickerId] = useState(null); // 사이드바에서 색상 고르는 중인 일정 id
  const [calendarName, setCalendarName] = useState("나의 캘린더");
  const [isEditingName, setIsEditingName] = useState(false);

  const [decoOpen, setDecoOpen] = useState(false);
  const [decoTab, setDecoTab] = useState("template");
  const [pointColor, setPointColor] = useState("#4A154B");
  const [bgColor, setBgColor] = useState("#FAFAFB");
  const [borderColor, setBorderColor] = useState("#E8E8E8");
  const [activeTemplate, setActiveTemplate] = useState(null);
  // 일간 화면 전용 테마(월간과 따로 적용할 때).
  // dayIndependent=false면 일간은 월간 테마를 그대로 따라감. true면 dayTemplate을 씀(null이면 '테마 없음').
  const [dayTemplate, setDayTemplate] = useState(null);
  const [dayIndependent, setDayIndependent] = useState(false);
  // AI(사진) 테마를 적용할 대상: "both"(둘 다) | "month"(월간만) | "day"(일간만)
  const [aiApplyTarget, setAiApplyTarget] = useState("both");
  const [showShades, setShowShades] = useState(false);
  const [cellColorMode, setCellColorMode] = useState(false);
  const [selectedColorCell, setSelectedColorCell] = useState(null);
  const [cellColors, setCellColors] = useState({});
  const [calendarBgImage, setCalendarBgImage] = useState(null);
  // 캘린더 배경 이미지 투명도(은은하게~진하게). 브라우저에 기억
  const [bgOpacity, setBgOpacity] = useState(() => {
    const v = parseFloat(localStorage.getItem("bboggl_bg_opacity"));
    return Number.isFinite(v) ? Math.max(0.05, Math.min(1, v)) : 0.16;
  });
  // 배경 이미지 크기(%) — 100이면 판 가로에 맞춤, 키우면 확대. 브라우저/계정에 기억
  const [bgScale, setBgScale] = useState(() => {
    const v = parseFloat(localStorage.getItem("bboggl_bg_scale"));
    return Number.isFinite(v) ? Math.max(40, Math.min(300, v)) : 100;
  });
  // 월간 셀의 일정 표시 방식: "full"(글씨 바) | "compact"(작은 도형). + 도형 종류 + 도형 크기(글씨와 별개)
  const [eventDisplay, setEventDisplay] = useState(() => localStorage.getItem("bboggl_event_display") || "full");
  const [eventShape, setEventShape] = useState(() => localStorage.getItem("bboggl_event_shape") || "dot");
  const [shapeSizePct, setShapeSizePct] = useState(() => {
    const v = parseFloat(localStorage.getItem("bboggl_shape_size"));
    return Number.isFinite(v) ? Math.max(0.5, Math.min(2.5, v)) : 1;
  });
  // 일정 블록 색을 현재 테마에 어울리는 색으로 자동 지정할지
  const [themeEventColors, setThemeEventColors] = useState(() => localStorage.getItem("bboggl_theme_event_colors") === "1");
  // 일정별 도형 지정: { [eventId]: shapeKey } (없으면 기본 도형 사용)
  const [eventShapes, setEventShapes] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("bboggl_event_shapes")); return s && typeof s === "object" ? s : {}; }
    catch { return {}; }
  });
  const [shapePickerId, setShapePickerId] = useState(null); // 사이드바에서 도형 고르는 중인 일정 id
  // 드래그로 삭제: 일정 블록을 끌면 하단에 휴지통이 뜨고, 거기에 놓으면 삭제
  const [dragActive, setDragActive] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  // 일간(하루) 플래너 — 날짜별 To-Do·메모. { "YYYY-MM-DD": { todos:[{id,text,done}], notes:"" } }
  const [dayPlanner, setDayPlanner] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem("bboggl_day_planner")); return d && typeof d === "object" ? d : {}; }
    catch { return {}; }
  });
  // 스티커: 캘린더 위에 자유롭게 올리는 사진들. 브라우저에 기억(계정 로그인해도 같은 기기면 유지)
  const [stickers, setStickers] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("bboggl_stickers")); return Array.isArray(s) ? s : []; }
    catch { return []; }
  });
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  // 초기 로드로 계정 값을 채우기 전에는 저장 effect가 돌지 않도록(기본값이 계정을 덮어쓰는 것 방지)
  const hydratedRef = useRef(false);
  const stickerFileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const themeFileInputRef = useRef(null);
  const calWrapRef = useRef(null);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [aiThemeLoading, setAiThemeLoading] = useState(false);
  const [aiThemeError, setAiThemeError] = useState("");
  // 캘린더 전체 크기(줌) — 1.0이면 가로 폭을 꽉 채움, 낮추면 비율 유지한 채 작게. 브라우저에 기억
  const [calSizePct, setCalSizePct] = useState(() => {
    const v = parseFloat(localStorage.getItem("bboggl_cal_size"));
    return Number.isFinite(v) ? Math.max(0.5, Math.min(1, v)) : 1;
  });
  const [calAvailW, setCalAvailW] = useState(0); // cal-wrap 안쪽 가로 폭(패딩 제외)
  // 칸 안 글씨(날짜 숫자·일정·공휴일) 크기 배율 — 캘린더 크기와 별개로 조절. 브라우저에 기억
  const [contentFontPct, setContentFontPct] = useState(() => {
    const v = parseFloat(localStorage.getItem("bboggl_content_font"));
    return Number.isFinite(v) ? Math.max(0.5, Math.min(1.8, v)) : 1.15;
  });

  /* ---- 최초 로드: 프로필 + 일정 + 칸 꾸미기를 Supabase에서 불러옵니다 ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: eventRows }, { data: decoRows }] = await Promise.all([
        fetchProfile(),
        fetchEvents(),
        fetchCellDecorations(),
      ]);
      if (cancelled) return;

      if (profile) {
        setCalendarName(profile.calendar_name || "나의 캘린더");
        setPointColor(profile.point_color || "#4A154B");
        setBgColor(profile.bg_color || "#FAFAFB");
        setBorderColor(profile.border_color || "#E8E8E8");
        setCalendarBgImage(profile.calendar_bg_image_url || null);
        // 커스텀(AI) 테마가 있으면 그걸 우선 적용, 없으면 기존 프리셋 템플릿.
        // custom_theme 컬럼이 아직 없어 서버 저장이 안 되는 경우엔 브라우저에 캐시해둔 AI 테마로 복원.
        if (profile.custom_theme) {
          setActiveTemplate(profile.custom_theme);
        } else if (profile.active_template_id) {
          setActiveTemplate(TEMPLATE_PRESETS.find((t) => t.id === profile.active_template_id) || null);
        } else {
          let cached = null;
          try { cached = JSON.parse(localStorage.getItem("bboggl_custom_theme")); } catch { cached = null; }
          if (cached && cached.isCustom) {
            setActiveTemplate(cached);
            if (isHex(cached.pageBg)) setBgColor(cached.pageBg);
            if (isHex(cached.cellBorder)) setBorderColor(cached.cellBorder);
            if (isHex(cached.accent)) setPointColor(cached.accent);
          } else {
            setActiveTemplate(null);
          }
        }
        // 계정에 저장된 꾸미기 상태(스티커·배경 투명도) 복원. 컬럼(ui_prefs)이 아직 없으면
        // profile.ui_prefs가 undefined라 localStorage 초기값을 그대로 유지해요.
        if (profile.ui_prefs && typeof profile.ui_prefs === "object") {
          const up = profile.ui_prefs;
          if (Array.isArray(up.stickers)) setStickers(up.stickers);
          if (Number.isFinite(up.bgOpacity)) setBgOpacity(up.bgOpacity);
          if (Number.isFinite(up.bgScale)) setBgScale(up.bgScale);
          if (up.eventDisplay === "full" || up.eventDisplay === "compact") setEventDisplay(up.eventDisplay);
          if (typeof up.eventShape === "string") setEventShape(up.eventShape);
          if (Number.isFinite(up.shapeSizePct)) setShapeSizePct(up.shapeSizePct);
          if (typeof up.themeEventColors === "boolean") setThemeEventColors(up.themeEventColors);
          if (up.eventShapes && typeof up.eventShapes === "object") setEventShapes(up.eventShapes);
          if (up.dayPlanner && typeof up.dayPlanner === "object") setDayPlanner(up.dayPlanner);
          if (up.dayTemplate && typeof up.dayTemplate === "object") setDayTemplate(up.dayTemplate);
          if (typeof up.dayIndependent === "boolean") setDayIndependent(up.dayIndependent);
        }
      }
      if (eventRows) {
        // 공휴일 자동 채우기 effect(연도 바뀔 때 실행)와 동시에 돌 수 있어서,
        // 여기서 그냥 덮어쓰면(replace) 이 fetch가 늦게 도착했을 때 방금 추가된
        // 공휴일이 로컬 상태에서 사라져 보일 수 있어요(새로고침하면 다시 나타남).
        // id 기준으로 합쳐서 어느 쪽이 먼저 끝나든 서로 지우지 않게 해요.
        const fresh = eventRows.map(dbRowToEntry);
        setEntries((prev) => {
          const map = new Map(fresh.map((e) => [e.id, e]));
          prev.forEach((e) => { if (!map.has(e.id)) map.set(e.id, e); });
          return Array.from(map.values());
        });
      }
      if (decoRows) {
        const colors = {};
        decoRows.forEach((r) => { if (r.color) colors[r.cell_date] = r.color; });
        setCellColors(colors);
      }
      hydratedRef.current = true; // 이제부터 상태 변경은 계정/브라우저에 저장해도 안전
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- 현재 보고 있는 연도의 한국 공휴일을 자동으로 채워 넣어요 (이미 있는 날짜는 건너뛰고, 빠진 것만 채움) ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: existing } = await fetchHolidaysForYear(year);
      if (cancelled) return;
      const existingEntries = (existing || []).map(dbRowToEntry);
      if (existingEntries.length) {
        setEntries((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const fresh = existingEntries.filter((e) => !existingIds.has(e.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
        if (!res.ok) throw new Error(`공휴일 API 응답 오류: ${res.status}`);
        const holidays = await res.json();
        if (cancelled || !Array.isArray(holidays)) return;
        const existingMonthDays = new Set(
          existingEntries.filter((e) => e.date).map((e) => `${e.date.month}-${e.date.day}`)
        );
        const missing = holidays.filter((h) => {
          const [, m, d] = h.date.split("-").map(Number);
          return !existingMonthDays.has(`${m}-${d}`);
        });
        if (missing.length === 0) return;
        const { data: inserted } = await insertHolidays(
          missing.map((h) => ({ event_date: h.date, label: holidayLabelFor(h, holidays), start: DEFAULT_START, end: DEFAULT_END }))
        );
        if (!cancelled && inserted) {
          setEntries((prev) => [...prev, ...inserted.map(dbRowToEntry)]);
        }
      } catch (err) {
        console.error("공휴일 데이터를 가져오지 못했어요:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [year]);

  const cells = useMemo(() => {
    const firstDayIndex = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - firstDayIndex + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return { key: `blank-${i}`, day: null, weekday: i % 7 };
      return { key: `d-${dayNum}`, day: dayNum, weekday: i % 7 };
    });
  }, [year, monthIdx]);

  const eventsForDate = (y, mNum, day, weekday) => {
    if (!day) return [];
    const key = isoDate(y, mNum, day);
    return entries
      .filter((e) => (e.type === "recurring" ? e.daysOfWeek.includes(weekday) : e.date && e.date.month === mNum && e.date.day === day))
      .map((e) => {
        if (e.type === "recurring" && e.overrides && e.overrides[key]) {
          const ov = e.overrides[key];
          if (ov.skip) return null;
          return { ...e, start: ov.start ?? e.start, end: ov.end ?? e.end, timeLabel: ov.timeLabel ?? e.timeLabel };
        }
        return e;
      })
      .filter(Boolean);
  };
  const eventsForCell = (day, weekday) => eventsForDate(year, monthNum, day, weekday);

  const updateEntryBaseLocal = (id, patch) => setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const updateEntryOverrideLocal = (id, dateKey, patch) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, overrides: { ...(e.overrides || {}), [dateKey]: { ...(e.overrides && e.overrides[dateKey]), ...patch } } } : e)));

  /* ---- 실행 취소 ----
     일정을 바꾸는 동작(추가/삭제/시간 조정/날짜 이동) 직전에 현재 상태를 스냅샷으로 저장해두고,
     되돌리기를 누르면 그 스냅샷 상태로 DB와 화면을 되돌려요. */
  const entryToRow = (e) => ({
    id: e.id,
    type: e.type,
    days_of_week: e.type === "recurring" ? e.daysOfWeek : null,
    event_date: e.eventDate ?? null,
    start_minutes: e.start,
    end_minutes: e.end,
    label: e.label,
    raw_text: e.text,
    color: e.color,
    is_holiday: e.isHoliday,
  });

  const pushUndo = () => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(entriesRef.current)));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift(); // 너무 길어지지 않게 제한
    setCanUndo(true);
  };

  const restoreSnapshot = async (snap) => {
    const cur = entriesRef.current;
    const snapById = new Map(snap.map((e) => [e.id, e]));
    const curById = new Map(cur.map((e) => [e.id, e]));

    // 1) 스냅샷 이후 새로 추가된 일정 → 삭제
    for (const e of cur) {
      if (!snapById.has(e.id)) await deleteEvent(e.id);
    }
    // 2) 스냅샷 이후 삭제된 일정 → 같은 id로 다시 복원(딸린 예외까지)
    for (const e of snap) {
      if (!curById.has(e.id)) {
        await insertEventWithId(entryToRow(e));
        for (const [d, ov] of Object.entries(e.overrides || {})) {
          await upsertOverride(e.id, d, { start: ov.start, end: ov.end, skip: ov.skip });
        }
      }
    }
    // 3) 양쪽에 다 있는 일정 → 값이 달라졌으면 스냅샷대로 되돌림(시간/날짜/라벨 + 예외)
    for (const e of snap) {
      const c = curById.get(e.id);
      if (!c) continue;
      if (c.start !== e.start || c.end !== e.end || c.eventDate !== e.eventDate || c.label !== e.label || c.color !== e.color) {
        await updateEventFields(e.id, {
          event_date: e.eventDate ?? null,
          start_minutes: e.start,
          end_minutes: e.end,
          label: e.label,
          color: e.color,
        });
      }
      if (JSON.stringify(c.overrides || {}) !== JSON.stringify(e.overrides || {})) {
        await deleteOverridesForEvent(e.id);
        for (const [d, ov] of Object.entries(e.overrides || {})) {
          await upsertOverride(e.id, d, { start: ov.start, end: ov.end, skip: ov.skip });
        }
      }
    }
    setEntries(snap);
  };

  const handleUndo = async () => {
    const snap = undoStackRef.current.pop();
    setCanUndo(undoStackRef.current.length > 0);
    if (!snap) return;
    await restoreSnapshot(snap);
  };

  useEffect(() => { entriesRef.current = entries; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        const tag = document.activeElement?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT") return; // 입력창 안에서는 브라우저 기본 취소를 유지
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 1일 보기: 화면 아래 끝까지 채우도록 높이를 계산(스크롤 없이 하루 전체가 보이게)
  useEffect(() => {
    if (viewMode !== "day") return;
    const measure = () => {
      const top = dayViewRef.current?.getBoundingClientRect().top ?? 120;
      setDayViewH(Math.max(Math.floor(window.innerHeight - top - 24), 380));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [viewMode]);

  // 월간 보기: 캘린더 판이 채울 수 있는 가로 폭(cal-wrap 안쪽)을 재서, 크기 조절 기준으로 씀
  // (loading이 끝나 cal-wrap이 실제로 그려진 뒤 측정되도록 loading도 의존성에 포함)
  useEffect(() => {
    if (viewMode !== "month" || loading) return;
    const measure = () => {
      const el = calWrapRef.current;
      if (!el) return;
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setCalAvailW(Math.max(280, Math.floor(w)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [viewMode, loading]);

  useEffect(() => { localStorage.setItem("bboggl_cal_size", String(calSizePct)); }, [calSizePct]);
  useEffect(() => { localStorage.setItem("bboggl_content_font", String(contentFontPct)); }, [contentFontPct]);

  // 첫 방문(로딩 완료 후, 아직 투어를 안 봤으면) 기능 안내 투어를 자동으로 띄워요
  useEffect(() => {
    if (loading) return;
    let seen = false;
    try { seen = !!localStorage.getItem("bboggl_tour_done"); } catch { seen = false; }
    if (!seen) { setViewMode("month"); setShowTour(true); }
  }, [loading]);
  const startTour = () => { setViewMode("month"); setDecoOpen(false); setShowTour(true); };
  const closeTour = () => { setShowTour(false); try { localStorage.setItem("bboggl_tour_done", "1"); } catch { /* 무시 */ } };

  // 스티커·배경 투명도는 계정(profiles.ui_prefs)에 저장 + localStorage 백업.
  // 드래그 중 초당 수십 번 바뀌므로(큰 data URL 포함) 디바운스로 렉·과도한 요청을 방지.
  // 초기 로드가 끝난(hydrated) 뒤에만 저장해서, 기본값이 계정 값을 덮어쓰지 않게 함.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem("bboggl_stickers", JSON.stringify(stickers));
        localStorage.setItem("bboggl_bg_opacity", String(bgOpacity));
        localStorage.setItem("bboggl_bg_scale", String(bgScale));
        localStorage.setItem("bboggl_event_display", eventDisplay);
        localStorage.setItem("bboggl_event_shape", eventShape);
        localStorage.setItem("bboggl_shape_size", String(shapeSizePct));
        localStorage.setItem("bboggl_theme_event_colors", themeEventColors ? "1" : "0");
        localStorage.setItem("bboggl_event_shapes", JSON.stringify(eventShapes));
        localStorage.setItem("bboggl_day_planner", JSON.stringify(dayPlanner));
      } catch { /* 용량 초과 등은 무시 */ }
      // ui_prefs 컬럼이 아직 없으면 이 요청은 조용히 실패하고 localStorage 백업만 남아요.
      updateProfile({ ui_prefs: { stickers, bgOpacity, bgScale, eventDisplay, eventShape, shapeSizePct, themeEventColors, eventShapes, dayPlanner, dayTemplate, dayIndependent } });
    }, 600);
    return () => clearTimeout(t);
  }, [stickers, bgOpacity, bgScale, eventDisplay, eventShape, shapeSizePct, themeEventColors, eventShapes, dayPlanner, dayTemplate, dayIndependent]);

  /* ---- 텍스트 명령("OO 지워줘" 등) 처리 — 각 대상 일정에 대해 실제 DB 반영까지 수행 ---- */
  const applyCommand = async (cmd, targetYear = year, targetMonth = monthNum) => {
    if (cmd.type === "delete-holidays") {
      const targets = entries.filter((e) => e.isHoliday && e.date && e.date.month === targetMonth);
      for (const e of targets) await deleteEvent(e.id);
      setEntries((prev) => prev.filter((e) => !targets.some((t) => t.id === e.id)));
      return;
    }
    if (cmd.type === "skip-holiday-events") {
      const holidayDays = entries
        .filter((e) => e.isHoliday && e.date && e.date.month === targetMonth)
        .map((e) => e.date.day);
      const toDelete = [];
      for (const e of entries) {
        if (e.isHoliday) continue;
        if (e.type === "recurring") {
          for (const d of holidayDays) {
            const weekday = new Date(targetYear, targetMonth - 1, d).getDay();
            if (!e.daysOfWeek.includes(weekday)) continue;
            const dateKey = isoDate(targetYear, targetMonth, d);
            await upsertOverride(e.id, dateKey, { skip: true });
            updateEntryOverrideLocal(e.id, dateKey, { skip: true });
          }
        } else if (e.type === "special" && e.date && e.date.month === targetMonth && holidayDays.includes(e.date.day)) {
          toDelete.push(e.id);
        }
      }
      for (const id of toDelete) await deleteEvent(id);
      if (toDelete.length) setEntries((prev) => prev.filter((e) => !toDelete.includes(e.id)));
      return;
    }
    for (const e of entries) {
      if (e.label !== cmd.label) continue;

      if (cmd.type === "skip") {
        if (e.type === "recurring") {
          for (const d of cmd.dates) {
            const dateKey = isoDate(targetYear, targetMonth, d);
            await upsertOverride(e.id, dateKey, { skip: true });
            updateEntryOverrideLocal(e.id, dateKey, { skip: true });
          }
        } else if (e.type === "special" && e.date && e.date.month === targetMonth && cmd.dates.includes(e.date.day)) {
          await deleteEvent(e.id);
          setEntries((prev) => prev.filter((x) => x.id !== e.id));
        }
      } else if (cmd.type === "override-time") {
        const timeLabel = `${formatMinutes(cmd.start)}~${formatMinutes(cmd.end)}`;
        if (e.type === "recurring") {
          for (const d of cmd.dates) {
            const dateKey = isoDate(targetYear, targetMonth, d);
            await upsertOverride(e.id, dateKey, { start: cmd.start, end: cmd.end });
            updateEntryOverrideLocal(e.id, dateKey, { start: cmd.start, end: cmd.end, timeLabel });
          }
        } else if (e.type === "special" && e.date && e.date.month === targetMonth && cmd.dates.includes(e.date.day)) {
          await updateEventBase(e.id, { start: cmd.start, end: cmd.end });
          updateEntryBaseLocal(e.id, { start: cmd.start, end: cmd.end, timeLabel });
        }
      }
    }
  };

  const handleSubmit = async () => {
    const raw = inputValue.trim();
    if (!raw) return;
    pushUndo();
    setInputValue("");
    setAiLoading(true);

    // 일간 보기에서는 지금 보고 있는 날짜를 기준으로 파싱해요(그 날짜에 일정이 잡힘).
    // 월간 보기에서는 기존처럼 "보고 있는 달" 기준으로 동작해요.
    const isDayMode = viewMode === "day";
    const targetDate = isDayMode ? isoDate(dYear, dMonthNum, dDay) : null;
    const parseYear = isDayMode ? dYear : year;
    const parseMonth = isDayMode ? dMonthNum : monthNum;

    const { error } = await parseScheduleWithAI(raw, parseYear, parseMonth, targetDate);
    if (error) {
      console.error("AI 파싱 실패:", error);
      // 폴백: AI 호출이 실패했을 때만 기존 규칙 기반 파서로 동작 (완전히 끊기지 않도록)
      const cmd = tryParseCommand(raw, entries, parseMonth);
      if (cmd) {
        await applyCommand(cmd, parseYear, parseMonth);
      } else {
        const drafts = splitClauses(raw).flatMap((c) => parseClause(c, parseMonth));
        for (const d of drafts) {
          if (isDayMode && d.date === null) d.date = { month: dMonthNum, day: dDay };
          const { data } = await createEvent(d, parseYear);
          if (data) setEntries((prev) => [...prev, dbRowToEntry({ ...data, event_overrides: [] })]);
        }
      }
      setAiLoading(false);
      return;
    }

    // AI가 서버에서 이미 DB에 반영했으니, 최신 상태를 다시 불러와 화면에 반영
    const { data: freshEvents } = await fetchEvents();
    if (freshEvents) setEntries(freshEvents.map(dbRowToEntry));
    setAiLoading(false);
  };

  const setEntryColor = async (id, color) => {
    pushUndo();
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, color } : e)));
    await updateEventFields(id, { color });
  };

  // 일정별 도형 지정(간략보기용). shape가 null이면 기본 도형으로 되돌림
  const setEntryShape = (id, shape) => {
    setEventShapes((prev) => {
      const next = { ...prev };
      if (shape) next[id] = shape; else delete next[id];
      return next;
    });
  };

  const removeEntry = async (id) => {
    pushUndo();
    setEntries((prev) => prev.filter((e) => e.id !== id)); // 낙관적 업데이트
    const { error } = await deleteEvent(id);
    if (error) {
      // 실패 시 서버 최신 상태로 다시 불러와 롤백
      const { data } = await fetchEvents();
      if (data) setEntries(data.map(dbRowToEntry));
    }
  };

  // 드래그로 삭제 — 반복 일정을 특정 날짜에서 끌어다 버리면 '그 날 하루만' 건너뛰기(skip),
  // 특별 일정이거나 날짜 정보가 없으면(사이드바에서 끌었을 때 등) 일정 자체를 삭제
  const dragDelete = async (id, dateKey) => {
    const e = entries.find((x) => x.id === id);
    if (e && e.type === "recurring" && dateKey) {
      pushUndo();
      updateEntryOverrideLocal(id, dateKey, { skip: true });
      await upsertOverride(id, dateKey, { skip: true });
    } else {
      await removeEntry(id);
    }
  };

  const handleModalUpdate = async (id, dateKey, patch, applyAll) => {
    pushUndo();
    if (applyAll) {
      updateEntryBaseLocal(id, patch);
      await updateEventBase(id, patch);
    } else {
      updateEntryOverrideLocal(id, dateKey, patch);
      await upsertOverride(id, dateKey, patch);
    }
  };

  const handleDrop = (day) => async (ev) => {
    ev.preventDefault();
    setDragOverKey(null);
    const id = ev.dataTransfer.getData("text/plain");
    if (!id) return;
    const targetISO = isoDate(year, monthNum, day);
    const srcDate = ev.dataTransfer.getData("text/bboggl-date") || null;
    const e = entries.find((x) => x.id === id);
    if (!e) return;

    // 특별 일정: 그 날짜로 이동
    if (e.type === "special") {
      pushUndo();
      setEntries((prev) => prev.map((x) => (x.id === id ? { ...x, date: { month: monthNum, day }, eventDate: targetISO } : x)));
      await supabase.from("events").update({ event_date: targetISO }).eq("id", id).eq("type", "special");
      return;
    }

    // 반복 일정
    if (e.type === "recurring") {
      const targetOv = e.overrides && e.overrides[targetISO];
      // (1) 그날 건너뛰기(skip)된 상태면 → 취소해서 복원 (잘못 지운 걸 다시 끌어다 넣는 경우)
      if (targetOv && targetOv.skip) {
        pushUndo();
        updateEntryOverrideLocal(id, targetISO, { skip: false });
        await upsertOverride(id, targetISO, { skip: false });
        return;
      }
      // (2) 이미 그날 표시 중이면 아무 것도 안 함
      const targetWeekday = new Date(year, monthIdx, day).getDay();
      if (e.daysOfWeek.includes(targetWeekday)) return;
      // (3) 반복 요일이 아닌 날로 옮김 → 그 날짜에 같은 내용의 '특별 일정'을 만들어 표시(그 하루짜리 일정으로 분리).
      //     원래 칸(반복 요일)에서 끌어온 경우엔 그 날짜를 건너뛰기 처리해 '이동'이 되게.
      pushUndo();
      const draft = { type: "special", daysOfWeek: null, date: { month: monthNum, day }, start: e.start, end: e.end, label: e.label, text: e.text, color: e.color };
      const { data } = await createEvent(draft, year);
      if (data) setEntries((prev) => [...prev, dbRowToEntry({ ...data, event_overrides: [] })]);
      if (srcDate) {
        updateEntryOverrideLocal(id, srcDate, { skip: true });
        await upsertOverride(id, srcDate, { skip: true });
      }
    }
  };

  const changeMonth = (delta) => setCurrent(new Date(year, monthIdx + delta, 1));
  const changeDay = (delta) => setDayDate((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
  const selectedWeekday = selectedDay ? new Date(year, monthIdx, selectedDay).getDay() : null;

  // 1일 시간표 보기용 날짜 조각
  const dYear = dayDate.getFullYear();
  const dMonthNum = dayDate.getMonth() + 1;
  const dDay = dayDate.getDate();
  const dWeekday = dayDate.getDay();

  // ── 일간 플래너(To-Do·메모) — 현재 보고 있는 하루 기준 ──
  const dayKey = isoDate(dYear, dMonthNum, dDay);
  const dayPlan = dayPlanner[dayKey] || { todos: [], notes: "" };
  const patchDayPlan = (patch) =>
    setDayPlanner((prev) => {
      const cur = prev[dayKey] || { todos: [], notes: "" };
      return { ...prev, [dayKey]: { ...cur, ...patch } };
    });
  const addTodo = (text) => {
    const t = text.trim();
    if (!t) return;
    patchDayPlan({ todos: [...(dayPlan.todos || []), { id: `td-${Date.now()}`, text: t, done: false }] });
  };
  const toggleTodo = (id) =>
    patchDayPlan({ todos: (dayPlan.todos || []).map((td) => (td.id === id ? { ...td, done: !td.done } : td)) });
  const removeTodo = (id) =>
    patchDayPlan({ todos: (dayPlan.todos || []).filter((td) => td.id !== id) });
  const setDayNotes = (notes) => patchDayPlan({ notes });

  const applyPreset = (p) => {
    setActiveTemplate(null); setDayTemplate(null); setDayIndependent(false); setBgColor(p.bg); setBorderColor(p.border); setPointColor(p.accent);
    localStorage.removeItem("bboggl_custom_theme");
    updateProfile({ active_template_id: null, custom_theme: null, bg_color: p.bg, border_color: p.border, point_color: p.accent });
  };
  const applyTemplate = (t) => {
    setActiveTemplate(t); setDayTemplate(null); setDayIndependent(false); setBgColor(t.pageBg); setBorderColor(t.cellBorder); setPointColor(t.accent);
    localStorage.removeItem("bboggl_custom_theme");
    updateProfile({ active_template_id: t.id, custom_theme: null, bg_color: t.pageBg, border_color: t.cellBorder, point_color: t.accent });
  };
  const resetTemplate = () => {
    setActiveTemplate(null); setDayTemplate(null); setDayIndependent(false); setBgColor("#FAFAFB"); setBorderColor("#E8E8E8"); setPointColor("#4A154B");
    localStorage.removeItem("bboggl_custom_theme");
    updateProfile({ active_template_id: null, custom_theme: null, bg_color: "#FAFAFB", border_color: "#E8E8E8", point_color: "#4A154B" });
  };
  const choosePointColor = (c) => { setPointColor(c); updateProfile({ point_color: c }); };

  /* ---- AI 테마: 레퍼런스 이미지를 분석해 비슷한 테마를 만들어 적용 ---- */
  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result); const i = r.indexOf(","); resolve(i >= 0 ? r.slice(i + 1) : r); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 이미지를 적당한 크기로 줄여 data URL로 만들어요(스토리지 버킷 없이 프로필에 바로 저장하기 위함)
  const fileToScaledDataUrl = (file, maxDim = 900, quality = 0.82) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });

  // AI(사진) 테마 적용 — target: "both"(둘 다) | "month"(월간만) | "day"(일간만)
  const applyAiTheme = (theme, target = aiApplyTarget) => {
    setCalendarBgImage(null); // AI 테마는 배경 이미지 없이 디자인 자체로 재현
    const applyToMonth = () => {
      setActiveTemplate(theme);
      setBgColor(theme.pageBg); setBorderColor(theme.cellBorder); setPointColor(theme.accent);
      try { localStorage.setItem("bboggl_custom_theme", JSON.stringify(theme)); } catch { /* 무시 */ }
      updateProfile({
        custom_theme: theme, active_template_id: null,
        bg_color: theme.pageBg, border_color: theme.cellBorder, point_color: theme.accent,
        calendar_bg_image_url: null,
      });
    };
    if (target === "day") {
      // 일간만: 월간은 그대로 두고 일간 전용 테마만 교체
      setDayTemplate(theme);
      setDayIndependent(true);
    } else if (target === "month") {
      // 월간만: 일간을 '현재 보이는 모습'으로 고정(독립)시킨 뒤 월간만 바꿔서 일간이 안 따라오게.
      // 지금 일간이 월간을 따라가고 있었다면(dayIndependent=false) 그 값은 현재 activeTemplate(테마 없으면 null).
      setDayTemplate((prev) => (dayIndependent ? prev : activeTemplate));
      setDayIndependent(true);
      applyToMonth();
    } else {
      // 둘 다: 월간 테마로 적용하고 일간은 다시 월간을 그대로 따라가게(독립 해제)
      setDayTemplate(null);
      setDayIndependent(false);
      applyToMonth();
    }
  };

  const handleThemeImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAiThemeError("");
    setAiThemeLoading(true);
    try {
      const base64 = await readFileAsBase64(file);
      const { data, error } = await analyzeThemeFromImage(base64, file.type);
      if (error || !data?.theme) {
        setAiThemeError("테마를 분석하지 못했어요. 다른 이미지로 다시 시도해 주세요.");
        return;
      }
      const theme = buildTemplateFromAiTheme(data.theme);
      if (!theme) { setAiThemeError("테마를 만들지 못했어요."); return; }
      applyAiTheme(theme);
    } catch (err) {
      console.error("AI 테마 생성 실패:", err);
      setAiThemeError("이미지를 처리하지 못했어요.");
    } finally {
      setAiThemeLoading(false);
    }
  };

  const onCellClick = (day) => {
    if (!day) return;
    setSelectedStickerId(null); // 스티커 편집 중이었다면 해제
    const key = isoDate(year, monthNum, day);
    if (cellColorMode) { setSelectedColorCell(key); return; }
    setSelectedDay(day);
  };

  const pickCellColor = async (color) => {
    const key = selectedColorCell;
    if (!key) return;
    setCellColors((prev) => ({ ...prev, [key]: color }));
    await upsertCellColor(key, color);
  };
  const clearSelectedCellColor = async () => {
    const key = selectedColorCell;
    if (!key) return;
    setCellColors((prev) => { const c = { ...prev }; delete c[key]; return c; });
    await clearCellColor(key);
  };
  // 스티커 추가 — 업로드한 사진을 작게 줄여 캘린더 중앙에 올려둡니다(브라우저에 저장)
  const handleStickerFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToScaledDataUrl(file, 420, 0.8).catch(() => null);
    if (!dataUrl) return;
    const rect = calWrapRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 200;
    const cy = rect ? Math.min(rect.height / 2, 220) : 160;
    const maxZ = stickers.reduce((m, s) => Math.max(m, s.z || 1), 0);
    const id = `st-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setStickers((prev) => [...prev, { id, src: dataUrl, x: cx, y: cy, base: 130, scale: 1, rotation: 0, z: maxZ + 1 }]);
    setSelectedStickerId(id);
  };
  const updateSelectedSticker = (patch) => {
    if (!selectedStickerId) return;
    setStickers((prev) => prev.map((s) => (s.id === selectedStickerId ? { ...s, ...patch } : s)));
  };
  const removeSelectedSticker = () => {
    if (!selectedStickerId) return;
    setStickers((prev) => prev.filter((s) => s.id !== selectedStickerId));
    setSelectedStickerId(null);
  };
  const bringStickerToFront = () => {
    if (!selectedStickerId) return;
    const maxZ = stickers.reduce((m, s) => Math.max(m, s.z || 1), 0);
    updateSelectedSticker({ z: maxZ + 1 });
  };

  const handleBgImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToScaledDataUrl(file).catch(() => null);
    if (!dataUrl) return;
    setCalendarBgImage(dataUrl);
    updateProfile({ calendar_bg_image_url: dataUrl });
  };

  const saveCalendarName = async (v) => {
    setCalendarName(v);
    await updateProfile({ calendar_name: v });
  };

  const handleDownloadImage = async () => {
    if (!calWrapRef.current || downloadingImage) return;
    setDownloadingImage(true);
    try {
      const dataUrl = await toPng(calWrapRef.current, { pixelRatio: 2, backgroundColor: bgColor });
      const link = document.createElement("a");
      link.download = `${calendarName}-${year}년${monthNum}월.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("캘린더 이미지 다운로드 실패:", err);
    } finally {
      setDownloadingImage(false);
    }
  };

  const weekdayTextColor = getContrastText(bgColor) === "#FFFFFF" ? "rgba(255,255,255,0.85)" : "#8a888a";
  const layout = themeLayout(activeTemplate);
  // 일간 화면에 쓸 테마.
  //  - 독립(dayIndependent) + 전용 테마 있음 → 그 테마
  //  - 독립 + 테마 없음 → PLAIN_DAY(기본 흰 배경). ※ .day-planner가 .cal-root의 CSS 변수(월간 테마)를
  //    상속하므로, '테마 없음'일 때 반드시 기본값으로 명시적으로 덮어써야 월간 테마가 새어 들어오지 않음.
  //  - 독립 아님(월간 따라감) → 월간 테마(activeTemplate). null이면 dayVars 비우고 cal-root 기본값 상속.
  const PLAIN_DAY = { accent: "#4A154B", cellBg: "#FFFFFF", cellBorder: "#E8E8E8", cellRadius: "18px",
    bodyFont: "'Poppins', sans-serif", eventRadius: 6 };
  const dayTpl = dayIndependent ? (dayTemplate || PLAIN_DAY) : activeTemplate;
  const dayVars = dayTpl ? {
    "--primary": dayTpl.accent,
    "--cell-bg": dayTpl.cellBg,
    "--border": dayTpl.cellBorder,
    "--body-font": dayTpl.bodyFont || "'Poppins', sans-serif",
    "--ev-radius": Number.isFinite(dayTpl.eventRadius) ? `${dayTpl.eventRadius}px` : "6px",
    "--cell-text": getContrastText(dayTpl.cellBg) === "#FFFFFF" ? "rgba(255,255,255,0.72)" : "#9a989a",
  } : {};

  // 일정 색: '테마 색 자동'이 켜져 있고 테마(tpl)가 있으면 테마 팔레트에서 라벨 해시로 골라 씀(공휴일 제외)
  const hashIndex = (str, n) => { let h = 0; for (const c of String(str || "")) h = (h + c.charCodeAt(0)) % n; return h; };
  const eventColorFor = (e, tpl) => {
    if (e.isHoliday) return e.color;
    if (themeEventColors && tpl) { const pal = themeEventPalette(tpl); return pal[hashIndex(e.label, pal.length)]; }
    return e.color;
  };
  const shapeForEvent = (e) => eventShapes[e.id] || eventShape;
  // 사이드바 일정 목록의 색 기준 테마(지금 보고 있는 화면 기준). 테마 색 자동이 꺼져 있으면 eventColorFor가 원래 색을 그대로 돌려줌
  const listTpl = viewMode === "day" ? dayTpl : activeTemplate;

  const dateJustify = layout.dateAlign === "center" ? "center" : layout.dateAlign === "right" ? "flex-end" : "flex-start";

  // 캘린더 전체를 한 덩어리로 스케일: 판이 차지할 폭(renderedW)과, 폰트·칸·간격에 곱할 배율(calScale)
  // intrinsicW = AI가 "이 폭 기준으로" 디자인한 폭(narrow면 작음). renderedW = 실제 렌더 폭(기본은 가득).
  const intrinsicW = layout.boardMaxWidth || calAvailW || 900;
  const renderedW = calAvailW ? Math.max(300, Math.round(calAvailW * calSizePct)) : (layout.boardMaxWidth || null);
  const calScale = renderedW ? renderedW / intrinsicW : 1;
  const boardCentered = layout.boardAlign === "center" || calSizePct < 0.99;

  if (loading) return null; // 원하면 로딩 스피너로 교체 가능

  return (
    <div className="cal-root" style={{
      "--primary": pointColor, "--page-bg": bgColor, "--border": borderColor,
      "--cell-bg": activeTemplate ? activeTemplate.cellBg : "#FFFFFF",
      "--cell-radius": activeTemplate ? activeTemplate.cellRadius : "12px",
      // 어두운 테마에서도 날짜 숫자/안내 글씨가 보이도록 칸 배경 대비색 계산
      "--cell-text": activeTemplate && getContrastText(activeTemplate.cellBg) === "#FFFFFF" ? "rgba(255,255,255,0.72)" : "#9a989a",
      // AI 테마가 뽑아낸 디자인(칸 크기·간격·테두리·본문 폰트·일정 블록 모서리).
      // 프리셋 템플릿에는 이 값들이 없을 수 있어(undefined) 반드시 기본값으로 폴백 — 안 그러면
      // "undefinedpx"가 되어 칸 높이가 무너지고(위아래로 좁아짐) 테두리가 사라져 칸 구분이 안 돼요.
      "--cell-gap": Number.isFinite(activeTemplate?.cellGap) ? `${activeTemplate.cellGap}px` : "8px",
      "--cell-min-h": Number.isFinite(activeTemplate?.cellMinHeight) ? `${activeTemplate.cellMinHeight}px` : "150px",
      "--cell-border-w": Number.isFinite(activeTemplate?.cellBorderWidth) ? `${activeTemplate.cellBorderWidth}px` : "1.5px",
      "--ev-radius": Number.isFinite(activeTemplate?.eventRadius) ? `${activeTemplate.eventRadius}px` : "6px",
      "--body-font": activeTemplate?.bodyFont || "'Poppins', sans-serif",
      "--date-size": `${layout.dateSize}px`,
      "--date-font": layout.dateFont || "var(--body-font)",
      "--date-justify": dateJustify,
      "--weekday-align": layout.weekdayAlign,
      "--cell-aspect": layout.cellAspect ? String(layout.cellAspect) : "auto",
      "--cal-scale": calScale,
      "--content-scale": contentFontPct,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;1,500&family=Archivo+Black&family=Baloo+2:wght@700;800&display=swap');
        :root{ --accent:#1264A3; --green:#2EB67D; --yellow:#ECB22E; --text:#1D1C1D; --bg:#FFFFFF; }
        *{box-sizing:border-box;}
        .cal-root{ font-family:'Poppins',sans-serif; color:var(--text); background:var(--page-bg); min-height:100vh; }
        h1,h2,h3{font-weight:700; margin:0;}
        button{font-family:inherit;}

        .btn{ border-radius:10px; padding:10px 16px; font-weight:700; font-size:13.5px;
          background:var(--primary); color:#fff; border:none; cursor:pointer; transition:.15s;
          display:inline-flex; align-items:center; gap:6px; }
        .btn:hover{ filter:brightness(1.12); }
        .icon-btn{ width:34px; height:34px; border-radius:9px; border:1.5px solid var(--border);
          background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); }
        .icon-btn:hover{ background:#F5F5F5; }
        .icon-btn.active{ border-color:var(--primary); color:var(--primary); }
        .icon-btn:disabled{ opacity:0.35; cursor:default; }
        .icon-btn:disabled:hover{ background:#fff; }
        .cal-size-ctrl{ display:flex; align-items:center; gap:5px; padding:0 10px; height:34px; border:1.5px solid var(--border);
          border-radius:9px; background:#fff; color:#9a989a; }
        .cal-size-ctrl input[type=range]{ width:64px; accent-color:var(--primary); cursor:pointer; }
        .ctrl-lbl{ display:inline-flex; align-items:center; justify-content:center; color:#9a989a; }
        .ctrl-lbl-txt{ font-size:13px; font-weight:700; width:14px; }

        .topbar{ display:flex; align-items:center; justify-content:space-between;
          padding:18px 24px; background:#fff; border-bottom:1px solid var(--border); position:relative; z-index:6;}
        .topbar-left{ display:flex; align-items:center; gap:16px; }
        .logo{ display:flex; align-items:center; gap:8px; font-weight:700; font-size:17px; color:var(--primary); }
        .logo-dot{ width:9px; height:9px; border-radius:50%; background:var(--yellow); }
        .cal-name{ font-size:13px; color:#8a888a; padding-left:14px; margin-left:2px; border-left:1.5px solid var(--border);
          cursor:text; user-select:none; }
        .cal-name-input{ font-size:13px; font-family:inherit; border:1.5px solid var(--accent); border-radius:8px;
          padding:5px 9px; outline:none; margin-left:14px; width:160px; }
        .view-nav-stack{ display:flex; flex-direction:column; align-items:center; gap:7px; }
        .view-switch{ display:flex; gap:3px; background:#F0F0F0; border-radius:9px; padding:3px; }
        .view-switch button{ border:none; background:transparent; cursor:pointer; padding:4px 14px;
          border-radius:7px; font-weight:600; font-size:12px; color:#8a888a; transition:.15s; }
        .view-switch button.active{ background:#fff; color:var(--primary); box-shadow:0 1px 3px rgba(0,0,0,0.1); }
        .month-nav{ display:flex; align-items:center; gap:10px; }
        .month-label{ font-size:16px; font-weight:700; min-width:92px; text-align:center; }
        .month-label-pill{ display:inline-flex; align-items:center; gap:8px; padding:6px 16px; border-radius:30px; }
        .month-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .stripe-bar{ height:9px; width:100%; }
        .topbar-right{ display:flex; align-items:center; gap:8px; position:relative; }

        .deco-panel{ position:absolute; top:44px; right:0; background:#fff; border:1px solid var(--border);
          border-radius:14px; box-shadow:0 12px 28px rgba(0,0,0,0.14); width:290px; z-index:10; overflow:hidden; }
        .deco-tabs{ display:flex; border-bottom:1px solid var(--border); }
        .deco-tab{ flex:1; padding:11px 0; border:none; background:#fff; cursor:pointer; color:#9a989a;
          display:flex; align-items:center; justify-content:center; }
        .deco-tab.active{ color:var(--primary); background:#FAFAFB; box-shadow:inset 0 -2px 0 var(--primary); }
        .deco-section{ padding:16px; }
        .deco-subtitle{ font-size:11.5px; font-weight:700; color:#8a888a; margin-bottom:8px; }
        .deco-hint{ font-size:11.5px; color:#8a888a; margin:6px 0; }
        .preset-row{ display:flex; align-items:center; gap:10px; width:100%; padding:8px 4px;
          border:none; background:none; cursor:pointer; font-size:12.5px; font-weight:600; color:var(--text); border-radius:8px; }
        .preset-row:hover{ background:#FAFAFB; }
        .preset-dots{ display:flex; gap:3px; }
        .preset-dots i{ width:14px; height:14px; border-radius:50%; display:block; box-shadow:0 0 0 1px rgba(0,0,0,0.06); }
        .swatch-row{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .swatch{ width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid #fff; box-shadow:0 0 0 1.5px var(--border); }
        .swatch.active{ box-shadow:0 0 0 2px var(--text); }
        .color-input{ width:24px; height:24px; border:none; background:none; cursor:pointer; padding:0; }
        .link-btn{ background:none; border:none; color:var(--accent); font-size:11.5px; font-weight:600; cursor:pointer; padding:8px 0 0; }
        .toggle-line{ display:flex; align-items:center; gap:10px; font-size:12px; cursor:pointer; }
        .switch{ width:32px; height:18px; border-radius:20px; background:#ddd; position:relative; cursor:pointer; flex-shrink:0; transition:.15s;}
        .switch.on{ background:var(--primary); }
        .switch-knob{ position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:.15s; box-shadow:0 1px 2px rgba(0,0,0,.25); }
        .switch.on .switch-knob{ left:16px; }
        .ghost-btn{ background:#fff; color:var(--text); border:1.5px solid var(--border); }
        .ghost-btn:hover{ background:#FAFAFB; filter:none; }
        .ai-theme-btn{ width:100%; justify-content:center; margin-top:4px; }
        .btn:disabled{ opacity:.55; cursor:default; filter:none; }
        .ai-theme-active{ display:flex; align-items:center; gap:8px; margin-top:12px; padding:8px 10px;
          background:#FAFAFB; border-radius:9px; font-size:12px; font-weight:600; }

        .layout{ display:grid; grid-template-columns:1fr 320px; gap:0; align-items:start; }

        .cal-wrap{ padding:36px 28px 48px; position:relative; }
        .cal-bg-image{ position:absolute; inset:20px 28px; background-size:cover; background-position:center;
          opacity:.16; border-radius:16px; pointer-events:none; }
        .weekday-row{ display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:8px; position:relative; z-index:1; }
        .weekday-row span{ text-align:var(--weekday-align, center); font-size:calc(12px * var(--cal-scale, 1)); font-weight:600; padding:calc(6px * var(--cal-scale, 1)) 0; font-family:var(--body-font, inherit); }
        .cal-board{ position:relative; z-index:1; }
        .board-title{ font-weight:700; line-height:1; margin-bottom:calc(14px * var(--cal-scale, 1)); }
        .board-title.center{ text-align:center; }
        .board-title.right{ text-align:right; }
        /* ── 일간 데일리 플래너 ── */
        .day-planner{ position:relative; z-index:1; background:var(--cell-bg, #fff); border:1.5px solid var(--border);
          border-radius:18px; padding:20px 22px 22px; max-width:960px; margin:0 auto;
          display:flex; flex-direction:column; overflow:hidden; }
        .dp-header{ text-align:center; flex-shrink:0; padding-bottom:12px; margin-bottom:12px; border-bottom:1.5px solid var(--border); }
        .dp-title{ font-size:30px; font-weight:700; line-height:1.1; color:var(--primary); font-family:var(--body-font, inherit); }
        .dp-date{ font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--cell-text, #8a888a); margin-top:6px; }
        .dp-body{ flex:1; min-height:0; display:flex; gap:20px; }
        .dp-col{ display:flex; flex-direction:column; min-height:0; }
        .dp-schedule{ flex:1.4; }
        .dp-side{ flex:1; min-width:220px; overflow-y:auto; }
        .dp-label{ font-size:11px; font-weight:800; letter-spacing:.12em; color:#fff; background:var(--primary);
          border-radius:8px; padding:5px 10px; display:inline-block; margin:0 0 8px; align-self:flex-start; }
        .dp-side .dp-label{ margin-top:14px; }
        .dp-side .dp-label:first-child{ margin-top:0; }
        .day-view-hint{ font-size:11.5px; color:var(--cell-text, #8a888a); line-height:1.5; margin:0 0 4px; flex-shrink:0; }
        .dp-todo-add{ display:flex; gap:6px; margin-bottom:8px; }
        .dp-todo-add input{ flex:1; border:1.5px solid var(--border); border-radius:9px; padding:7px 10px; font-size:12.5px;
          font-family:inherit; outline:none; background:#fff; }
        .dp-todo-add input:focus{ border-color:var(--accent); }
        .dp-todo-add button{ width:34px; border:none; border-radius:9px; background:var(--primary); color:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .dp-todos{ display:flex; flex-direction:column; gap:4px; }
        .dp-empty{ font-size:11.5px; color:#b3b1b3; padding:4px 2px; }
        .dp-todo{ display:flex; align-items:center; gap:8px; padding:5px 4px; border-radius:8px; }
        .dp-todo:hover{ background:rgba(0,0,0,0.03); }
        .dp-check{ width:18px; height:18px; border-radius:5px; border:1.5px solid var(--border); background:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#fff; padding:0; }
        .dp-todo.done .dp-check{ background:var(--primary); border-color:var(--primary); }
        .dp-todo-text{ flex:1; font-size:12.5px; cursor:pointer; line-height:1.35; }
        .dp-todo.done .dp-todo-text{ text-decoration:line-through; color:#b3b1b3; }
        .dp-todo-del{ background:none; border:none; cursor:pointer; color:#c7c5c7; flex-shrink:0; display:flex; padding:2px; }
        .dp-todo-del:hover{ color:#E01E5A; }
        .dp-notes{ width:100%; min-height:90px; flex:none; border:1.5px solid var(--border); border-radius:10px; padding:9px 11px;
          font-size:12.5px; font-family:inherit; line-height:1.5; outline:none; resize:vertical; background:#fff; }
        .dp-notes:focus{ border-color:var(--accent); }
        @media (max-width: 760px){ .dp-body{ flex-direction:column; overflow-y:auto; } .dp-side{ min-width:0; } }
        .grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:calc(var(--cell-gap, 8px) * var(--cal-scale, 1)); position:relative; z-index:1; }
        .cell{ background:var(--cell-bg); border:var(--cell-border-w, 1.5px) solid var(--border); border-radius:var(--cell-radius); min-height:calc(var(--cell-min-h, 150px) * var(--cal-scale, 1));
          padding:calc(10px * var(--cal-scale, 1)); transition:.12s; cursor:default; position:relative; }
        .cell.aspect{ aspect-ratio:var(--cell-aspect); min-height:0; overflow:hidden; }
        .cell.clickable{ cursor:pointer; }
        .cell.clickable:hover{ border-color:var(--accent); }
        .cell.blank{ background:transparent; border-color:transparent; cursor:default; }
        .cell.drag-over{ border-color:var(--accent); background:rgba(18,100,163,0.05); }
        .cell-day{ font-size:calc(var(--date-size, 13px) * var(--cal-scale, 1) * var(--content-scale, 1)); font-weight:600; color:var(--cell-text, #9a989a); margin-bottom:calc(6px * var(--cal-scale, 1)); display:flex; align-items:center; gap:5px; justify-content:var(--date-justify, flex-start); font-family:var(--date-font, var(--body-font, inherit)); }
        .cell-holiday-label{ font-size:calc(10.5px * var(--cal-scale, 1) * var(--content-scale, 1)); font-weight:600; color:#E01E5A; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ev-bar{ font-size:calc(11px * var(--cal-scale, 1) * var(--content-scale, 1)); font-weight:600; color:#fff; border-radius:calc(var(--ev-radius, 6px) * var(--cal-scale, 1)); padding:calc(3px * var(--cal-scale, 1)) calc(6px * var(--cal-scale, 1));
          margin-bottom:calc(4px * var(--cal-scale, 1)); cursor:grab; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:var(--body-font, inherit); }
        .ev-bar.recurring{ cursor:pointer; opacity:0.92; }
        /* 스티커 오버레이 — cal-wrap 전체를 덮되, 레이어 자체는 클릭을 통과시키고 스티커만 잡히게 */
        .sticker-layer{ position:absolute; inset:0; z-index:4; pointer-events:none; overflow:visible; }
        .sticker{ position:absolute; pointer-events:auto; cursor:grab; touch-action:none; user-select:none;
          transform-origin:center center; }
        .sticker:active{ cursor:grabbing; }
        .sticker-img{ display:block; width:100%; height:auto; pointer-events:none; -webkit-user-drag:none;
          filter:drop-shadow(0 2px 6px rgba(0,0,0,.22)); }
        .sticker.sel{ outline:1.5px dashed var(--accent); outline-offset:3px; }
        .st-handle{ position:absolute; width:16px; height:16px; border-radius:50%; background:#fff;
          border:2px solid var(--accent); box-shadow:0 1px 3px rgba(0,0,0,.3); }
        .st-scale{ right:-9px; bottom:-9px; cursor:nwse-resize; }
        .st-rotate{ left:50%; top:-26px; transform:translateX(-50%); cursor:grab; background:var(--accent); }
        .st-del{ position:absolute; left:-11px; top:-11px; width:20px; height:20px; border-radius:50%;
          background:#E01E5A; color:#fff; border:2px solid #fff; font-size:12px; line-height:1; cursor:pointer;
          display:flex; align-items:center; justify-content:center; padding:0; }
        .range-line{ display:flex; align-items:center; gap:8px; font-size:11.5px; color:#6b696b; margin-top:10px; }
        .range-line span:first-child{ width:34px; flex-shrink:0; }
        .range-line input[type=range]{ flex:1; accent-color:var(--primary); cursor:pointer; }
        .range-val{ width:34px; text-align:right; }
        .sticker-ctrls{ margin-top:14px; border-top:1px solid var(--border); padding-top:12px; }
        .sticker-ctrls-title{ font-size:11.5px; font-weight:700; color:#8a888a; margin-bottom:2px; }
        .sticker-ctrls-row{ display:flex; gap:16px; align-items:center; }
        .link-btn.danger{ color:#E01E5A; }
        /* 드래그 삭제 휴지통 */
        .drag-trash{ position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:250;
          display:flex; align-items:center; gap:8px; padding:12px 22px; border-radius:14px;
          background:#fff; color:#E01E5A; border:2px dashed #E01E5A; font-size:13px; font-weight:700;
          box-shadow:0 10px 30px rgba(0,0,0,.18); pointer-events:auto; }
        .drag-trash.over{ background:#E01E5A; color:#fff; border-style:solid; transform:translateX(-50%) scale(1.06); }
        /* 월간 셀 일정 간략보기(도형) */
        .ev-dots{ display:flex; flex-wrap:wrap; gap:calc(3px * var(--cal-scale, 1)); align-items:center; margin-top:calc(2px * var(--cal-scale, 1)); }
        .ev-dot-btn{ background:none; border:none; padding:0; cursor:pointer; display:inline-flex; line-height:0; }
        /* 일정 표시 세그먼트 토글 */
        .seg-row{ display:flex; gap:4px; background:#F1F0F1; border-radius:10px; padding:3px; }
        .seg-btn{ flex:1; border:none; background:transparent; cursor:pointer; padding:7px 0; border-radius:8px;
          font-family:inherit; font-weight:700; font-size:12px; color:#8a888a; }
        .seg-btn.on{ background:#fff; color:var(--primary); box-shadow:0 1px 3px rgba(0,0,0,0.1); }
        /* 도형 선택 그리드 */
        .shape-grid{ display:flex; flex-wrap:wrap; gap:8px; }
        .shape-opt{ width:38px; height:38px; border:1.5px solid var(--border); border-radius:10px; background:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center; }
        .shape-opt:hover{ border-color:var(--accent); }
        .shape-opt.sel{ border-color:var(--primary); box-shadow:0 0 0 1.5px var(--primary); }

        .sidebar{ background:#fff; border-left:1px solid var(--border); min-height:calc(100vh - 71px); padding:24px 20px; }
        .sidebar h3{ font-size:15px; display:flex; align-items:center; gap:6px; }
        .sidebar-desc{ font-size:12.5px; color:#8a888a; margin-top:6px; line-height:1.5; }
        .input-row{ display:flex; flex-direction:column; gap:8px; margin-top:16px; }
        .input-row textarea{ border:1.5px solid var(--border); border-radius:10px; padding:10px 12px;
          font-size:12.5px; font-family:inherit; outline:none; resize:vertical; min-height:84px; line-height:1.5; }
        .input-row textarea:focus{ border-color:var(--accent); }
        .submit-btn{ align-self:flex-end; padding:9px 16px; border-radius:10px; border:none; background:var(--primary);
          color:#fff; cursor:pointer; font-weight:700; font-size:12.5px; display:inline-flex; align-items:center; gap:6px; }
        .submit-btn:hover{ filter:brightness(1.12); }
        .submit-btn:disabled{ opacity:.6; cursor:default; }

        .entry-list{ margin-top:18px; display:flex; flex-direction:column; gap:8px; }
        .entry{ display:flex; align-items:center; gap:10px; border:1.5px solid var(--border); border-radius:10px; padding:10px; position:relative; cursor:grab; }
        .entry:active{ cursor:grabbing; }
        .entry-dot{ width:14px; height:14px; border-radius:50%; flex-shrink:0; border:2px solid #fff; box-shadow:0 0 0 1.5px var(--border); cursor:pointer; padding:0; }
        .entry-dot:hover{ box-shadow:0 0 0 2px var(--text); }
        .ev-color-pop{ position:absolute; top:calc(100% + 4px); left:8px; z-index:20; display:flex; flex-wrap:wrap; gap:6px; width:180px;
          background:#fff; border:1px solid var(--border); border-radius:12px; padding:10px; box-shadow:0 10px 26px rgba(0,0,0,0.16); }
        .ev-color-sw{ width:24px; height:24px; border-radius:50%; cursor:pointer; border:2px solid #fff; box-shadow:0 0 0 1.5px var(--border); padding:0; }
        .ev-color-sw.sel{ box-shadow:0 0 0 2px var(--text); }
        .ev-color-custom{ width:24px; height:24px; border:none; background:none; cursor:pointer; padding:0; }
        .entry-shape{ width:20px; height:20px; flex-shrink:0; border:1.5px solid var(--border); border-radius:6px; background:#fff;
          display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }
        .entry-shape:hover{ border-color:var(--text); }
        .ev-shape-pop{ position:absolute; top:calc(100% + 4px); left:8px; z-index:20; display:flex; flex-wrap:wrap; gap:6px; width:200px;
          background:#fff; border:1px solid var(--border); border-radius:12px; padding:10px; box-shadow:0 10px 26px rgba(0,0,0,0.16); align-items:center; }
        .ev-shape-sw{ width:28px; height:28px; border-radius:8px; cursor:pointer; border:1.5px solid var(--border); background:#fff;
          display:flex; align-items:center; justify-content:center; padding:0; }
        .ev-shape-sw.sel{ border-color:var(--primary); box-shadow:0 0 0 1.5px var(--primary); }
        .ev-shape-reset{ font-size:11px; font-weight:700; color:#8a888a; background:#F1F0F1; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; }
        .entry-text{ flex:1; font-size:12.5px; line-height:1.4; }
        .entry-meta{ font-size:10.5px; color:#9a989a; margin-top:2px; }
        .entry-del{ background:none; border:none; cursor:pointer; color:#c7c5c7; flex-shrink:0; display:flex; }
        .entry-del:hover{ color:#E01E5A; }

        @media (max-width: 900px){
          .layout{ grid-template-columns:1fr; }
          .sidebar{ border-left:none; border-top:1px solid var(--border); min-height:auto; }
        }

        /* ── 모바일·좁은 화면 최적화 ── */
        @media (max-width: 760px){
          /* 상단바: 한 줄에 다 안 들어가므로 위/아래로 접어 배치 */
          .topbar{ flex-direction:column; align-items:stretch; gap:9px; padding:10px 12px; }
          .topbar-left{ flex-wrap:wrap; justify-content:center; gap:8px 12px; }
          .logo{ font-size:16px; }
          .cal-name, .cal-name-input{ display:none; }
          .view-nav-stack{ flex-direction:row; align-items:center; justify-content:center; gap:14px; width:100%; }
          .month-label{ font-size:14px; min-width:0; }
          .cal-size-ctrl{ display:none; }              /* 폭 큰 슬라이더는 모바일에서 숨김(자동으로 화면에 맞춤) */
          .topbar-right{ flex-wrap:wrap; justify-content:center; gap:6px; width:100%; }
          /* 꾸미기 패널: 화면 하단 시트처럼 띄워 항상 손이 닿게 */
          .deco-panel{ position:fixed; top:auto; bottom:10px; left:10px; right:10px; width:auto; max-height:76vh; overflow-y:auto; }
          /* 캘린더 판: JS로 계산한 폭(renderedW)이 화면보다 넓어도 무조건 화면에 맞춰 가로 넘침 방지 */
          .cal-board{ width:100% !important; max-width:100% !important; margin-left:0 !important; margin-right:0 !important; }
          .sticker-layer{ overflow:hidden; }   /* 화면 밖으로 삐져나간 스티커가 가로 스크롤 만들지 않게 */
          /* 캘린더 칸: 좁은 폭에 맞춰 여백·높이 축소 */
          .cal-wrap{ padding:12px 8px 28px; }
          .grid{ gap:4px; }
          .cell{ min-height:62px; padding:6px; }
          .cell.aspect{ min-height:52px; }
          .weekday-row span{ font-size:11px; }
          .cal-bg-image{ inset:8px 8px; }
          /* 일간: 뷰포트에 억지로 맞추지 않고(모바일 주소창 접힘에 따라 튀는 문제) 자연 높이로 스크롤 */
          .day-planner{ height:auto !important; overflow:visible; }
          .dp-body{ overflow:visible; }
          /* 사이드바 입력: 폭 여유 */
          .sidebar{ padding:18px 14px; }
          /* 드래그 삭제 휴지통이 하단 시트와 안 겹치게 살짝 위로 */
          .drag-trash{ bottom:14px; }
        }
      `}</style>

      <input type="file" accept="image/*" ref={stickerFileInputRef} style={{ display: "none" }} onChange={handleStickerFile} />
      <input type="file" accept="image/*" ref={bgFileInputRef} style={{ display: "none" }} onChange={handleBgImageFile} />
      <input type="file" accept="image/*" ref={themeFileInputRef} style={{ display: "none" }} onChange={handleThemeImageFile} />

      <div className="topbar">
        <div className="topbar-left">
          <div className="logo"><span className="logo-dot" />My calendar</div>
          {isEditingName ? (
            <input
              className="cal-name-input" autoFocus defaultValue={calendarName}
              onBlur={(e) => { const v = e.target.value.trim(); saveCalendarName(v || calendarName); setIsEditingName(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setIsEditingName(false); }}
            />
          ) : (
            <span className="cal-name" onDoubleClick={() => setIsEditingName(true)} title="더블클릭하면 이름을 바꿀 수 있어요">{calendarName}</span>
          )}
          <div className="view-nav-stack">
            <div className="view-switch">
              <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>월간</button>
              <button className={viewMode === "day" ? "active" : ""} onClick={() => setViewMode("day")}>일간</button>
            </div>
            {viewMode === "month" ? (
              <div className="month-nav">
                <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="이전 달"><Icon path={icons.chevronLeft} size={16} /></button>
                {activeTemplate && activeTemplate.decor === "pill" ? (
                  <span className="month-label-pill" style={{ background: `${activeTemplate.accent}20` }}>
                    <span className="month-label" style={{ fontFamily: activeTemplate.monthFont, fontWeight: activeTemplate.monthWeight, fontStyle: activeTemplate.monthStyle, color: activeTemplate.accent }}>
                      {year}년 {monthNum}월
                    </span>
                    <span className="month-dot" style={{ background: activeTemplate.accent }} />
                  </span>
                ) : (
                  <span className="month-label" style={activeTemplate ? {
                    fontFamily: activeTemplate.monthFont, fontWeight: activeTemplate.monthWeight, fontStyle: activeTemplate.monthStyle,
                    color: activeTemplate.decor === "block" ? activeTemplate.accent : undefined,
                    textTransform: activeTemplate.decor === "block" ? "uppercase" : "none",
                    letterSpacing: activeTemplate.decor === "block" ? "-0.02em" : "normal",
                    fontSize: activeTemplate.decor === "block" ? "19px" : undefined,
                  } : undefined}>
                    {year}년 {monthNum}월
                  </span>
                )}
                <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="다음 달"><Icon path={icons.chevronRight} size={16} /></button>
              </div>
            ) : (
              <div className="month-nav">
                <button className="icon-btn" onClick={() => changeDay(-1)} aria-label="이전 날"><Icon path={icons.chevronLeft} size={16} /></button>
                <span className="month-label">{dYear}년 {dMonthNum}월 {dDay}일 ({WEEKDAY_FULL[dWeekday]})</span>
                <button className="icon-btn" onClick={() => changeDay(1)} aria-label="다음 날"><Icon path={icons.chevronRight} size={16} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="topbar-right">
          {viewMode === "month" && (
            <div className="cal-size-ctrl">
              <span className="ctrl-lbl" title="캘린더 크기"><Icon path={icons.grid} size={13} /></span>
              <input type="range" min="0.5" max="1" step="0.02" value={calSizePct}
                onChange={(e) => setCalSizePct(parseFloat(e.target.value))} aria-label="캘린더 크기" title="캘린더 크기" />
              <span className="ctrl-lbl ctrl-lbl-txt" title="칸 안 글씨 크기">가</span>
              <input type="range" min="0.5" max="1.6" step="0.05" value={contentFontPct}
                onChange={(e) => setContentFontPct(parseFloat(e.target.value))} aria-label="글씨 크기" title="칸 안 글씨 크기" />
            </div>
          )}
          <button data-tour="undo" className="icon-btn" onClick={handleUndo} disabled={!canUndo} aria-label="실행 취소" title="실행 취소 (Ctrl+Z) — 방금 추가/삭제/변경한 일정을 되돌려요">
            <Icon path={icons.undo} size={16} />
          </button>
          <button className="icon-btn" onClick={startTour} aria-label="사용법 다시 보기" title="사용법 다시 보기">
            <Icon path={icons.help} size={16} />
          </button>
          <button data-tour="settings" className="icon-btn" onClick={onOpenSettings} aria-label="설정" title="설정">
            <Icon path={icons.gear} size={16} />
          </button>
          <button className="icon-btn" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
            <Icon path={icons.logout} size={16} />
          </button>
          <button data-tour="deco" className={`icon-btn ${decoOpen ? "active" : ""}`} onClick={() => setDecoOpen((v) => !v)} aria-label="꾸미기">
            <Icon path={icons.palette} size={17} />
          </button>
          <button data-tour="download" className="icon-btn" onClick={handleDownloadImage} disabled={downloadingImage} aria-label="이미지로 다운로드" title="이미지로 다운로드">
            <Icon path={icons.download} size={16} />
          </button>
          {decoOpen && (
            <div className="deco-panel">
              <div className="deco-tabs">
                <button className={`deco-tab ${decoTab === "ai" ? "active" : ""}`} onClick={() => setDecoTab("ai")} title="AI 테마 (사진으로 만들기)"><Icon path={icons.sparkle} size={15} /></button>
                <button className={`deco-tab ${decoTab === "template" ? "active" : ""}`} onClick={() => setDecoTab("template")} title="템플릿"><Icon path={icons.layout} size={15} /></button>
                <button className={`deco-tab ${decoTab === "preset" ? "active" : ""}`} onClick={() => setDecoTab("preset")} title="프리셋"><Icon path={icons.grid} size={15} /></button>
                <button className={`deco-tab ${decoTab === "point" ? "active" : ""}`} onClick={() => setDecoTab("point")} title="포인트 색상"><Icon path={icons.droplet} size={15} /></button>
                <button className={`deco-tab ${decoTab === "cell" ? "active" : ""}`} onClick={() => setDecoTab("cell")} title="칸 색칠"><Icon path={icons.palette} size={15} /></button>
                <button className={`deco-tab ${decoTab === "image" ? "active" : ""}`} onClick={() => setDecoTab("image")} title="이미지"><Icon path={icons.image} size={15} /></button>
                <button className={`deco-tab ${decoTab === "events" ? "active" : ""}`} onClick={() => setDecoTab("events")} title="일정 표시"><Icon path={icons.dots} size={15} /></button>
              </div>

              {decoTab === "ai" && (
                <div className="deco-section">
                  <div className="deco-subtitle">사진으로 테마 만들기</div>
                  <p className="deco-hint">마음에 드는 캘린더·플래너 사진을 올리면 AI가 색감뿐 아니라 칸 크기·간격·모양, 폰트, 일정 블록 디자인까지 분석해 비슷한 테마로 바꿔줘요.</p>
                  <div className="deco-subtitle" style={{ marginTop: 6 }}>적용할 화면</div>
                  <div className="seg-row seg3">
                    <button className={`seg-btn ${aiApplyTarget === "both" ? "on" : ""}`} onClick={() => setAiApplyTarget("both")}>둘 다</button>
                    <button className={`seg-btn ${aiApplyTarget === "month" ? "on" : ""}`} onClick={() => setAiApplyTarget("month")}>월간만</button>
                    <button className={`seg-btn ${aiApplyTarget === "day" ? "on" : ""}`} onClick={() => setAiApplyTarget("day")}>일간만</button>
                  </div>
                  <button className="btn ai-theme-btn" style={{ marginTop: 10 }} onClick={() => themeFileInputRef.current?.click()} disabled={aiThemeLoading}>
                    <Icon path={icons.sparkle} size={14} />{aiThemeLoading ? "AI가 분석 중..." : "레퍼런스 사진 올리기"}
                  </button>
                  {aiThemeError && <div className="deco-hint" style={{ color: "#E01E5A" }}>{aiThemeError}</div>}
                  {activeTemplate?.isCustom && (
                    <div className="ai-theme-active">
                      <span className="preset-dots">
                        <i style={{ background: activeTemplate.pageBg }} />
                        <i style={{ background: activeTemplate.accent }} />
                        <i style={{ background: activeTemplate.cellBg }} />
                      </span>
                      <span style={{ flex: 1 }}>월간: {activeTemplate.name}</span>
                    </div>
                  )}
                  {dayIndependent && dayTemplate?.isCustom && (
                    <div className="ai-theme-active">
                      <span className="preset-dots">
                        <i style={{ background: dayTemplate.pageBg }} />
                        <i style={{ background: dayTemplate.accent }} />
                        <i style={{ background: dayTemplate.cellBg }} />
                      </span>
                      <span style={{ flex: 1 }}>일간: {dayTemplate.name}</span>
                      <button className="link-btn" style={{ padding: 0 }} onClick={() => { setDayTemplate(null); setDayIndependent(false); }}>해제</button>
                    </div>
                  )}
                  {dayIndependent && !dayTemplate && (
                    <div className="ai-theme-active">
                      <span style={{ flex: 1 }}>일간: 테마 없음(월간과 분리됨)</span>
                      <button className="link-btn" style={{ padding: 0 }} onClick={() => setDayIndependent(false)}>월간 따라가기</button>
                    </div>
                  )}
                  {(activeTemplate || dayIndependent) && <button className="link-btn" onClick={resetTemplate}>테마 전체 해제</button>}
                </div>
              )}

              {decoTab === "template" && (
                <div className="deco-section">
                  <div className="deco-subtitle">레퍼런스 기반 캘린더 템플릿</div>
                  {TEMPLATE_PRESETS.map((t) => (
                    <button key={t.id} className="preset-row" onClick={() => applyTemplate(t)} style={activeTemplate?.id === t.id ? { background: "#FAFAFB" } : undefined}>
                      <span className="preset-dots"><i style={{ background: t.swatch[0] }} /><i style={{ background: t.swatch[1] }} /><i style={{ background: t.swatch[2] }} /></span>
                      <span style={{ flex: 1, textAlign: "left" }}>{t.name}</span>
                      <span style={{ fontFamily: t.monthFont, fontWeight: t.monthWeight, fontStyle: t.monthStyle, fontSize: 14 }}>Aa</span>
                    </button>
                  ))}
                  {activeTemplate && <button className="link-btn" onClick={resetTemplate}>템플릿 해제 (기본으로)</button>}
                </div>
              )}

              {decoTab === "preset" && (
                <div className="deco-section">
                  <div className="deco-subtitle">톤온톤 프리셋 (배경·테두리·포인트 3색)</div>
                  {TONE_PRESETS.map((p) => (
                    <button key={p.name} className="preset-row" onClick={() => applyPreset(p)}>
                      <span className="preset-dots"><i style={{ background: p.bg }} /><i style={{ background: p.border }} /><i style={{ background: p.accent }} /></span>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {decoTab === "point" && (
                <div className="deco-section">
                  <div className="deco-subtitle">포인트 색상</div>
                  <div className="swatch-row">
                    {THEME_PRESETS.map((c) => <div key={c} className={`swatch ${pointColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => choosePointColor(c)} />)}
                    <input type="color" className="color-input" value={pointColor} onChange={(e) => choosePointColor(e.target.value)} aria-label="직접 색상 선택" />
                  </div>
                  <button className="link-btn" onClick={() => setShowShades((v) => !v)}>{showShades ? "숨기기" : "비슷한 톤 더보기"}</button>
                  {showShades && (
                    <div className="swatch-row" style={{ marginTop: 8 }}>
                      {(() => {
                        const { h, s } = hexToHsl(pointColor);
                        const ss = Math.max(s, 35);
                        return [22, 36, 50, 64, 78].map((l, i) => <div key={i} className="swatch" style={{ background: hslToHex(h, ss, l) }} onClick={() => choosePointColor(hslToHex(h, ss, l))} />);
                      })()}
                    </div>
                  )}
                </div>
              )}

              {decoTab === "cell" && (
                <div className="deco-section">
                  <label className="toggle-line">
                    <span className={`switch ${cellColorMode ? "on" : ""}`} onClick={() => setCellColorMode((v) => !v)}><span className="switch-knob" /></span>
                    캘린더에서 칸 클릭해 색칠하기
                  </label>
                  {cellColorMode && !selectedColorCell && <div className="deco-hint">캘린더에서 날짜 칸을 클릭하세요</div>}
                  {selectedColorCell && (
                    <>
                      <div className="deco-hint">선택한 날짜: {monthNum}월 {selectedColorCell.split("-")[2]}일</div>
                      <div className="swatch-row">
                        {[...THEME_PRESETS, ...TONE_PRESETS.map((p) => p.bg)].map((c, i) => (
                          <div key={i} className="swatch" style={{ background: c }} onClick={() => pickCellColor(c)} />
                        ))}
                        <input type="color" className="color-input" onChange={(e) => pickCellColor(e.target.value)} aria-label="직접 색상 선택" />
                      </div>
                      <button className="link-btn" onClick={clearSelectedCellColor}>이 칸 색 지우기</button>
                    </>
                  )}
                </div>
              )}

              {decoTab === "image" && (
                <div className="deco-section">
                  <div className="deco-subtitle">캘린더 배경 이미지</div>
                  <button className="btn ghost-btn" onClick={() => bgFileInputRef.current?.click()}>이미지 불러오기</button>
                  {calendarBgImage && (
                    <>
                      <label className="range-line">
                        <span>투명도</span>
                        <input type="range" min="0.05" max="1" step="0.01" value={bgOpacity}
                          onChange={(e) => setBgOpacity(parseFloat(e.target.value))} />
                        <span className="range-val">{Math.round(bgOpacity * 100)}%</span>
                      </label>
                      <label className="range-line">
                        <span>크기</span>
                        <input type="range" min="40" max="300" step="5" value={bgScale}
                          onChange={(e) => setBgScale(parseFloat(e.target.value))} />
                        <span className="range-val">{Math.round(bgScale)}%</span>
                      </label>
                      <button className="link-btn" onClick={() => { setCalendarBgImage(null); updateProfile({ calendar_bg_image_url: null }); }}>배경 이미지 제거</button>
                    </>
                  )}

                  <div className="deco-subtitle" style={{ marginTop: 18 }}>스티커</div>
                  <p className="deco-hint">사진을 올려 캘린더 위에 자유롭게 배치하세요. 스티커를 드래그해 옮기고, 선택하면 나오는 모서리로 크기를, 위쪽 손잡이로 회전을 조절할 수 있어요.</p>
                  <button className="btn ghost-btn" onClick={() => stickerFileInputRef.current?.click()}>+ 스티커 추가</button>

                  {selectedStickerId && (
                    <div className="sticker-ctrls">
                      <div className="sticker-ctrls-title">선택한 스티커</div>
                      <label className="range-line">
                        <span>크기</span>
                        <input type="range" min="0.2" max="5" step="0.05"
                          value={stickers.find((s) => s.id === selectedStickerId)?.scale ?? 1}
                          onChange={(e) => updateSelectedSticker({ scale: parseFloat(e.target.value) })} />
                      </label>
                      <label className="range-line">
                        <span>회전</span>
                        <input type="range" min="-180" max="180" step="1"
                          value={stickers.find((s) => s.id === selectedStickerId)?.rotation ?? 0}
                          onChange={(e) => updateSelectedSticker({ rotation: parseFloat(e.target.value) })} />
                      </label>
                      <div className="sticker-ctrls-row">
                        <button className="link-btn" onClick={bringStickerToFront}>맨 앞으로</button>
                        <button className="link-btn danger" onClick={removeSelectedSticker}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {decoTab === "events" && (
                <div className="deco-section">
                  <div className="deco-subtitle">월간 일정 표시</div>
                  <div className="seg-row">
                    <button className={`seg-btn ${eventDisplay === "full" ? "on" : ""}`} onClick={() => setEventDisplay("full")}>글씨로</button>
                    <button className={`seg-btn ${eventDisplay === "compact" ? "on" : ""}`} onClick={() => setEventDisplay("compact")}>도형으로</button>
                  </div>
                  <p className="deco-hint">'도형으로'를 켜면 칸 안 일정이 작은 도형으로 간략히 표시돼요. 일정마다 다른 도형을 주려면 오른쪽 사이드바 일정 목록의 도형 아이콘을 누르세요.</p>
                  {eventDisplay === "compact" && (
                    <>
                      <div className="deco-subtitle" style={{ marginTop: 16 }}>기본 도형</div>
                      <div className="shape-grid">
                        {EVENT_SHAPES.map((sh) => (
                          <button key={sh.key} className={`shape-opt ${eventShape === sh.key ? "sel" : ""}`}
                            onClick={() => setEventShape(sh.key)} title={sh.label}>
                            <EventGlyph color={pointColor} shape={sh.key} size={16} />
                          </button>
                        ))}
                      </div>
                      <label className="range-line" style={{ marginTop: 14 }}>
                        <span>도형 크기</span>
                        <input type="range" min="0.5" max="2.5" step="0.05" value={shapeSizePct}
                          onChange={(e) => setShapeSizePct(parseFloat(e.target.value))} />
                        <span className="range-val">{Math.round(shapeSizePct * 100)}%</span>
                      </label>
                      <p className="deco-hint">글씨 크기(상단 '가' 슬라이더)와 따로 조절돼요.</p>
                    </>
                  )}

                  <div className="deco-subtitle" style={{ marginTop: 18 }}>일정 색</div>
                  <label className="toggle-line">
                    <span className={`switch ${themeEventColors ? "on" : ""}`} onClick={() => setThemeEventColors((v) => !v)}><span className="switch-knob" /></span>
                    테마에 어울리는 색으로 자동 지정
                  </label>
                  <p className="deco-hint">켜면 월간·일간 일정 블록이 각 화면 테마에 맞는 색으로 자동 표시돼요(공휴일 제외). 끄면 사이드바에서 정한 색을 그대로 써요.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeTemplate && activeTemplate.decor === "stripe" && (
        <div className="stripe-bar" style={{ background: `repeating-linear-gradient(90deg, ${activeTemplate.stripeColors[0]} 0 14px, ${activeTemplate.stripeColors[1]} 14px 28px)` }} />
      )}

      <div className="layout">
        <div className="cal-wrap" ref={calWrapRef}>
          {calendarBgImage && <div className="cal-bg-image" style={{ backgroundImage: `url(${calendarBgImage})`, opacity: bgOpacity, backgroundSize: bgScale === 100 ? "cover" : `${bgScale}%`, backgroundRepeat: "no-repeat" }} />}
          {viewMode === "month" && (
            <StickerLayer stickers={stickers} setStickers={setStickers}
              selectedId={selectedStickerId} setSelectedId={setSelectedStickerId} />
          )}
          {viewMode === "day" ? (
            <div className="day-planner" ref={dayViewRef} style={{
              ...dayVars,
              ...(dayViewH ? { height: dayViewH } : {}),
              ...(dayTpl ? { background: dayTpl.cellBg, borderColor: dayTpl.cellBorder, borderRadius: dayTpl.cellRadius } : {}),
            }}>
              <div className="dp-header">
                <div className="dp-title" style={dayTpl ? {
                  fontFamily: dayTpl.monthFont, fontStyle: dayTpl.monthStyle,
                  fontWeight: dayTpl.monthWeight, color: dayTpl.accent,
                } : undefined}>Daily Planner</div>
                <div className="dp-date">{dYear}. {String(dMonthNum).padStart(2, "0")}. {String(dDay).padStart(2, "0")} ({WEEKDAY_FULL[dWeekday]})</div>
              </div>
              <div className="dp-body">
                <div className="dp-col dp-schedule">
                  <div className="dp-label">SCHEDULE</div>
                  <p className="day-view-hint">블록을 드래그해 옮기거나 위/아래 끝으로 길이를 조절하세요. 오른쪽에 텍스트로 입력하면 자동으로 채워져요.</p>
                  <DayTimeline
                    year={dYear} monthNum={dMonthNum} day={dDay}
                    events={eventsForDate(dYear, dMonthNum, dDay, dWeekday).map((e) => ({ ...e, color: eventColorFor(e, dayTpl) }))}
                    onUpdate={handleModalUpdate}
                    onDelete={(id, dk) => { dragDelete(id, dk); }}
                    onDragActive={(id) => { setDraggingId(id); setDragActive(!!id); }}
                    fit={!isNarrow} fitSignal={dayViewH || 0}
                    height={isNarrow ? 540 : 380}
                    eventStyle={dayTpl?.eventStyle}
                  />
                </div>
                <div className="dp-col dp-side">
                  <div className="dp-label">TO DO LIST</div>
                  <div className="dp-todo-add">
                    <input type="text" value={todoInput} placeholder="할 일 추가"
                      onChange={(e) => setTodoInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { addTodo(todoInput); setTodoInput(""); } }} />
                    <button onClick={() => { addTodo(todoInput); setTodoInput(""); }} aria-label="추가"><Icon path={icons.plus} size={14} /></button>
                  </div>
                  <div className="dp-todos">
                    {(dayPlan.todos || []).length === 0 && <div className="dp-empty">아직 할 일이 없어요.</div>}
                    {(dayPlan.todos || []).map((td) => (
                      <div key={td.id} className={`dp-todo ${td.done ? "done" : ""}`}>
                        <button className="dp-check" onClick={() => toggleTodo(td.id)} aria-label="완료 표시">
                          {td.done ? <Icon path={icons.check} size={12} /> : null}
                        </button>
                        <span className="dp-todo-text" onClick={() => toggleTodo(td.id)}>{td.text}</span>
                        <button className="dp-todo-del" onClick={() => removeTodo(td.id)} aria-label="삭제"><Icon path={icons.close} size={13} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="dp-label">NOTES</div>
                  <textarea className="dp-notes" value={dayPlan.notes || ""} placeholder="메모를 적어보세요"
                    onChange={(e) => setDayNotes(e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
          <div className="cal-board" style={{
            width: renderedW ? `${renderedW}px` : undefined,
            maxWidth: "100%",
            marginLeft: boardCentered ? "auto" : undefined,
            marginRight: boardCentered ? "auto" : undefined,
          }}>
          {layout.boardTitle && (
            <div className={`board-title ${layout.titlePosition}`} style={{
              fontFamily: activeTemplate?.monthFont, fontStyle: activeTemplate?.monthStyle,
              color: activeTemplate?.accent, fontSize: 36 * calScale,
            }}>{getBoardTitle(monthNum, layout.titleLang, layout.titleCase)}</div>
          )}
          {layout.showWeekday && (
            <div className="weekday-row">{getWeekdayLabels(layout.weekdayLang, layout.weekdayFormat).map((w, i) => <span key={i} style={{ color: weekdayTextColor }}>{w}</span>)}</div>
          )}
          <div className="grid">
            {cells.map(({ key, day, weekday }) => {
              const evs = eventsForCell(day, weekday);
              const isOver = dragOverKey === key;
              const cellKey = day ? isoDate(year, monthNum, day) : null;
              const customBg = cellKey ? cellColors[cellKey] : null;
              return (
                <div key={key} className={`cell ${day ? "clickable" : "blank"} ${isOver ? "drag-over" : ""} ${layout.cellAspect ? "aspect" : ""}`}
                  style={customBg ? { background: customBg } : undefined}
                  onClick={() => onCellClick(day)}
                  onDragOver={(e) => { if (day) { e.preventDefault(); setDragOverKey(key); } }}
                  onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                  onDrop={day ? handleDrop(day) : undefined}>
                  {day && (
                    <div className="cell-day" style={customBg ? { color: getContrastText(customBg) } : undefined}>
                      {day}
                      {evs.filter((e) => e.isHoliday).map((e) => (
                        <span key={e.id} className="cell-holiday-label" title={e.label}>{e.label}</span>
                      ))}
                    </div>
                  )}
                  {eventDisplay === "compact" ? (
                    (() => {
                      const nonHol = evs.filter((e) => !e.isHoliday);
                      if (!nonHol.length) return null;
                      const gsize = Math.max(5, Math.round(12 * calScale * shapeSizePct));
                      return (
                        <div className="ev-dots">
                          {nonHol.map((e) => (
                            <button key={e.id} className="ev-dot-btn" title={`${e.timeLabel ? e.timeLabel + " " : ""}${e.label}`}
                              draggable
                              onDragStart={(ev) => { ev.stopPropagation(); ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.setData("text/bboggl-date", cellKey || ""); setDraggingId(e.id); setDragActive(true); }}
                              onDragEnd={() => { setDragActive(false); setDraggingId(null); }}
                              onClick={(ev) => { ev.stopPropagation(); onCellClick(day); }}>
                              <EventGlyph color={eventColorFor(e, activeTemplate)} shape={shapeForEvent(e)} size={gsize} />
                            </button>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    evs.filter((e) => !e.isHoliday).map((e) => (
                      <div key={e.id} className={`ev-bar ${e.type}`} style={eventVisualStyle(eventColorFor(e, activeTemplate), activeTemplate?.eventStyle)}
                        draggable
                        onDragStart={(ev) => { ev.stopPropagation(); ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.setData("text/bboggl-date", cellKey || ""); setDraggingId(e.id); setDragActive(true); }}
                        onDragEnd={() => { setDragActive(false); setDraggingId(null); }}
                        onClick={(ev) => { ev.stopPropagation(); onCellClick(day); }}
                        title={e.text}>
                        {e.timeLabel ? `${e.timeLabel} ` : ""}{e.label}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
          </div>
          )}
        </div>

        <div className="sidebar">
          <h3><Icon path={icons.sparkle} size={16} />일정 입력</h3>
          <p className="sidebar-desc">
            생각나는 대로 쭉 적어도 돼요. 여러 일정을 한 문장에 적으면 자동으로 나눠서 추가해요.
            "회사 일정 지워줘", "28일 회사 쉬어" 같은 수정 명령도 인식해요.
          </p>
          <div className="input-row">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
              placeholder={`예: 나는 매주 평일에는 9시부터 18시까지 회사에서 일해 그리고 11일 19일 26일에는 데이트 약속이 있어`}
              rows={4}
            />
            <button className="submit-btn" onClick={handleSubmit} disabled={aiLoading}>
              <Icon path={icons.plus} size={14} />{aiLoading ? "AI가 분석 중..." : "일정 추가"}
            </button>
          </div>

          <div className="entry-list">
            {entries.filter((e) => !e.isHoliday).map((e) => (
              <div className="entry" key={e.id} draggable
                onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.id); setDraggingId(e.id); setDragActive(true); }}
                onDragEnd={() => { setDragActive(false); setDraggingId(null); }}
                title="드래그해서 캘린더에 놓거나 휴지통으로 삭제">
                <button className="entry-dot" style={{ background: eventColorFor(e, listTpl) }} title="색상 바꾸기"
                  onClick={() => { setColorPickerId((c) => (c === e.id ? null : e.id)); setShapePickerId(null); }} aria-label="일정 색상 바꾸기" />
                <button className="entry-shape" title="도형 바꾸기 (간략보기용)"
                  onClick={() => { setShapePickerId((s) => (s === e.id ? null : e.id)); setColorPickerId(null); }} aria-label="일정 도형 바꾸기">
                  <EventGlyph color={eventColorFor(e, listTpl)} shape={eventShapes[e.id] || eventShape} size={13} />
                </button>
                <div className="entry-text">
                  {e.text}
                  <div className="entry-meta">{e.type === "recurring" ? "반복 일정" : "특별 일정"}{e.timeLabel ? ` · ${e.timeLabel}` : ""}</div>
                </div>
                <button className="entry-del" onClick={() => removeEntry(e.id)} aria-label="삭제"><Icon path={icons.trash} size={15} /></button>
                {colorPickerId === e.id && (
                  <div className="ev-color-pop">
                    {EVENT_COLOR_CHOICES.map((c) => (
                      <button key={c} className={`ev-color-sw ${e.color === c ? "sel" : ""}`} style={{ background: c }}
                        onClick={() => { setEntryColor(e.id, c); setColorPickerId(null); }} aria-label={`색상 ${c}`} />
                    ))}
                    <input type="color" className="ev-color-custom" value={isHex(e.color) ? e.color : "#4A154B"}
                      onChange={(ev) => setEntryColor(e.id, ev.target.value)} aria-label="직접 색상 선택" title="직접 색상 선택" />
                  </div>
                )}
                {shapePickerId === e.id && (
                  <div className="ev-shape-pop">
                    {EVENT_SHAPES.map((sh) => (
                      <button key={sh.key} className={`ev-shape-sw ${(eventShapes[e.id] || eventShape) === sh.key ? "sel" : ""}`}
                        onClick={() => { setEntryShape(e.id, sh.key); setShapePickerId(null); }} title={sh.label}>
                        <EventGlyph color={e.color} shape={sh.key} size={15} />
                      </button>
                    ))}
                    <button className="ev-shape-reset" onClick={() => { setEntryShape(e.id, null); setShapePickerId(null); }}>기본</button>
                  </div>
                )}
              </div>
            ))}
            {entries.filter((e) => !e.isHoliday).length === 0 && <p className="sidebar-desc">아직 입력한 일정이 없어요.</p>}
          </div>
        </div>
      </div>

      {dragActive && (
        <div id="drag-trash" className="drag-trash"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }}
          onDragLeave={(e) => e.currentTarget.classList.remove("over")}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || draggingId; const dk = e.dataTransfer.getData("text/bboggl-date") || null; if (id) dragDelete(id, dk); setDragActive(false); setDraggingId(null); }}>
          <Icon path={icons.trash} size={20} />
          <span>여기로 끌어다 놓으면 삭제</span>
        </div>
      )}

      {selectedDay && (
        <DayDetailModal
          year={year} day={selectedDay} monthNum={monthNum} weekday={selectedWeekday}
          events={eventsForCell(selectedDay, selectedWeekday)}
          onClose={() => setSelectedDay(null)} onUpdate={handleModalUpdate}
          eventStyle={activeTemplate?.eventStyle}
        />
      )}

      {showTour && <OnboardingTour steps={TOUR_STEPS} onClose={closeTour} />}
    </div>
  );
}

/* --- 색상 유틸: 같은 톤의 다른 명도 셰이드 생성(포인트 색상 탭에서 사용) --- */
function hexToHsl(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/* 테마(accent 기준)에서 서로 구분되면서도 어울리는 일정 블록 색 팔레트를 만듭니다.
   유사색(analogous) 위주로 색상만 살짝 돌리고 채도/명도는 읽기 좋게 보정 */
function themeEventPalette(tpl) {
  const accent = (tpl && isHex(tpl.accent)) ? tpl.accent : "#4A154B";
  const base = hexToHsl(accent);
  const s = Math.max(42, Math.min(78, base.s));
  const l = Math.max(38, Math.min(58, base.l));
  const rot = [0, 28, -30, 55, -58, 14, -14];
  return rot.map((d, i) => hslToHex((base.h + d + 360) % 360, s * (i % 2 ? 0.92 : 1), l + (i === 5 ? -8 : i === 6 ? 8 : 0)));
}

/* ============================================================
   Bboggl · 설정 페이지
   - 알림: 구독 여부와 무관하게 항상 브라우저 푸시로만 작동
   - 구독 미리보기: 실제 결제/메신저 발송은 PART 2(백엔드) 연동 필요,
     여기서는 요금제·이미지 양식을 "미리 보고 고르는" UI만 구현
   ============================================================ */

const SettingsIcon = ({ path, size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);

const settingsIcons = {
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6ZM9.5 18a2.5 2.5 0 0 0 5 0" />,
  check: <path d="M5 13l4 4L19 7" />,
  crown: <path d="M4 18h16l1-9-5 4-4-6-4 6-5-4 1 9Z" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.8 4.2-6 7.5-6s6.3 2.2 7.5 6" />
    </>
  ),
};

const LEAD_OPTIONS = [5, 10, 15, 30, 60];

const PLANS = [
  { id: "free", name: "무료", price: 0, desc: "기본 캘린더 기능", features: ["텍스트로 일정 자동 등록", "테마·꾸미기 커스터마이징", "브라우저 푸시 알림"] },
  { id: "basic", name: "베이직", price: 3900, desc: "매일 아침 텍스트 요약 발송", features: ["무료 플랜 전체 포함", "매일 7시 카카오톡 텍스트 요약", "일정 변경 시 자동 반영"] },
  { id: "premium", name: "프리미엄", price: 6900, desc: "이미지 시간표 발송 + 양식 선택", features: ["베이직 전체 포함", "매일 7시 이미지 시간표 발송", "이미지 양식 3종 중 선택 가능"], highlight: true },
];

const FORMATS = [
  { id: "circle", name: "원형 시간표" },
  { id: "text", name: "텍스트 정리형" },
  { id: "block", name: "구간별 이미지형" },
];

function FormatPreview({ id }) {
  if (id === "circle") {
    return (
      <svg viewBox="0 0 80 80" width="100%" height="64">
        <circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" strokeWidth="2" />
        <path d="M40 40 L40 14 A26 26 0 0 1 62 52 Z" fill="var(--accent)" opacity="0.75" />
        <path d="M40 40 L62 52 A26 26 0 0 1 24 63 Z" fill="var(--green)" opacity="0.75" />
        <circle cx="40" cy="40" r="4" fill="var(--text)" />
      </svg>
    );
  }
  if (id === "text") {
    return (
      <svg viewBox="0 0 80 64" width="100%" height="64">
        {[10, 24, 38, 52].map((y, i) => (
          <g key={y}>
            <rect x="6" y={y} width="10" height="8" rx="2" fill={["var(--accent)", "var(--green)", "var(--yellow)", "var(--primary)"][i]} />
            <rect x="22" y={y + 1} width="52" height="6" rx="3" fill="var(--border)" />
          </g>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 64" width="100%" height="64">
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect key={`${row}-${col}`} x={4 + col * 19} y={4 + row * 20} width="15" height="14" rx="3"
            fill={(row + col) % 3 === 0 ? "var(--accent)" : (row + col) % 3 === 1 ? "var(--green)" : "#EFEFEF"} opacity={(row + col) % 3 === 2 ? 1 : 0.8} />
        ))
      )}
    </svg>
  );
}

function SettingsPage({ onBack = () => {}, onLogout = () => {} }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBlocked, setPushBlocked] = useState(false);
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [selectedFormat, setSelectedFormat] = useState("circle");

  const togglePush = async () => {
    if (pushEnabled) { setPushEnabled(false); return; }
    if (typeof Notification === "undefined") { setPushBlocked(true); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") { setPushEnabled(true); setPushBlocked(false); }
      else { setPushBlocked(true); }
    } catch {
      setPushBlocked(true);
    }
  };

  return (
    <div className="set-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        :root{ --primary:#4A154B; --accent:#1264A3; --green:#2EB67D; --yellow:#ECB22E; --text:#1D1C1D; --bg:#FFFFFF; --border:#E8E8E8; }
        *{box-sizing:border-box;}
        .set-root{ font-family:'Poppins',sans-serif; color:var(--text); background:#FAFAFB; min-height:100vh; }
        h1,h2,h3{font-weight:700; margin:0;}
        button{font-family:inherit;}

        .set-topbar{ display:flex; align-items:center; gap:14px; padding:18px 24px; background:#fff; border-bottom:1px solid var(--border); }
        .back-btn{ width:34px; height:34px; border-radius:9px; border:1.5px solid var(--border); background:#fff;
          display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); }
        .back-btn:hover{ background:#F5F5F5; }
        .set-title{ font-size:17px; }

        .set-body{ max-width:720px; margin:0 auto; padding:32px 24px 64px; display:flex; flex-direction:column; gap:28px; }
        .card{ background:#fff; border:1.5px solid var(--border); border-radius:16px; padding:24px; }
        .card-head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
        .card-head h2{ font-size:16px; }
        .card-sub{ font-size:12.5px; color:#8a888a; margin-bottom:18px; line-height:1.5; }

        .row{ display:flex; align-items:center; justify-content:space-between; padding:10px 0; }
        .row-label{ font-size:13.5px; font-weight:600; }
        .row-desc{ font-size:11.5px; color:#8a888a; margin-top:2px; }
        .switch{ width:38px; height:22px; border-radius:24px; background:#ddd; position:relative; cursor:pointer; flex-shrink:0; transition:.15s; border:none; }
        .switch.on{ background:var(--primary); }
        .switch-knob{ position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.15s; box-shadow:0 1px 2px rgba(0,0,0,.25); }
        .switch.on .switch-knob{ left:18px; }
        .warn-text{ font-size:11.5px; color:#E01E5A; margin-top:8px; }

        .chip-row{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .chip{ padding:7px 14px; border-radius:20px; border:1.5px solid var(--border); background:#fff;
          font-size:12.5px; font-weight:600; cursor:pointer; color:var(--text); }
        .chip.active{ background:var(--primary); border-color:var(--primary); color:#fff; }
        .chip:disabled{ opacity:.4; cursor:not-allowed; }

        .plan-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .plan-card{ border:1.5px solid var(--border); border-radius:14px; padding:18px; cursor:pointer; position:relative; transition:.12s; }
        .plan-card:hover{ border-color:var(--accent); }
        .plan-card.selected{ border-color:var(--primary); box-shadow:0 0 0 1.5px var(--primary); }
        .plan-card.highlight{ background:linear-gradient(180deg, rgba(74,21,75,0.04), transparent); }
        .plan-badge{ position:absolute; top:-10px; right:14px; background:var(--yellow); color:#1D1C1D;
          font-size:10px; font-weight:700; padding:3px 8px; border-radius:10px; display:flex; align-items:center; gap:3px; }
        .plan-name{ font-size:14px; font-weight:700; }
        .plan-price{ font-size:20px; font-weight:700; margin-top:6px; }
        .plan-price span{ font-size:11px; font-weight:600; color:#8a888a; }
        .plan-desc{ font-size:11.5px; color:#8a888a; margin-top:4px; }
        .plan-features{ margin-top:12px; display:flex; flex-direction:column; gap:6px; }
        .plan-features div{ display:flex; align-items:flex-start; gap:6px; font-size:11px; color:#5c5a5c; }
        .plan-features svg{ color:var(--green); flex-shrink:0; margin-top:1px; }
        .plan-select-check{ position:absolute; top:14px; right:14px; width:18px; height:18px; border-radius:50%;
          border:1.5px solid var(--border); display:flex; align-items:center; justify-content:center; color:#fff; }
        .plan-card.selected .plan-select-check{ background:var(--primary); border-color:var(--primary); }

        .format-note{ font-size:11.5px; color:#8a888a; margin:14px 0 10px; }
        .format-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .format-card{ border:1.5px solid var(--border); border-radius:12px; padding:12px; cursor:pointer; text-align:center; }
        .format-card:hover{ border-color:var(--accent); }
        .format-card.selected{ border-color:var(--primary); box-shadow:0 0 0 1.5px var(--primary); }
        .format-card .fname{ font-size:11.5px; font-weight:600; margin-top:8px; }

        .backend-note{ display:flex; gap:8px; align-items:flex-start; background:#FFF8E8; border:1px solid #F0DFAE;
          border-radius:10px; padding:12px 14px; font-size:11.5px; color:#7A5D1F; line-height:1.5; margin-top:16px; }

        .account-row{ display:flex; align-items:center; gap:12px; }
        .avatar{ width:44px; height:44px; border-radius:50%; background:var(--primary); color:#fff;
          display:flex; align-items:center; justify-content:center; }
        .account-name{ font-size:14px; font-weight:700; }
        .account-email{ font-size:12px; color:#8a888a; margin-top:2px; }
        .logout-btn{ margin-left:auto; display:inline-flex; align-items:center; gap:6px; padding:9px 14px;
          border-radius:10px; border:1.5px solid var(--border); background:#fff; cursor:pointer; font-size:12.5px; font-weight:600; color:var(--text); }
        .logout-btn:hover{ border-color:#E01E5A; color:#E01E5A; }

        @media (max-width: 640px){
          .plan-grid, .format-grid{ grid-template-columns:1fr; }
        }
      `}</style>

      <div className="set-topbar">
        <button className="back-btn" onClick={onBack} aria-label="뒤로"><SettingsIcon path={settingsIcons.chevronLeft} size={16} /></button>
        <h1 className="set-title">설정</h1>
      </div>

      <div className="set-body">
        {/* 알림 */}
        <div className="card">
          <div className="card-head"><SettingsIcon path={settingsIcons.bell} size={17} /><h2>알림</h2></div>
          <p className="card-sub">구독 여부와 관계없이 브라우저 푸시 알림으로만 동작해요. 카카오톡 등 메신저 알림은 구독 플랜의 별도 기능이에요.</p>

          <div className="row">
            <div>
              <div className="row-label">일정 임박 푸시 알림</div>
              <div className="row-desc">{pushEnabled ? "켜짐 · 이 브라우저에서 알림을 받을 수 있어요" : "꺼짐"}</div>
            </div>
            <button className={`switch ${pushEnabled ? "on" : ""}`} onClick={togglePush} aria-label="푸시 알림 켜기/끄기">
              <span className="switch-knob" />
            </button>
          </div>
          {pushBlocked && <div className="warn-text">브라우저 알림 권한이 거부되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.</div>}

          <div style={{ marginTop: 14 }}>
            <div className="row-label">몇 분 전에 알려줄까요?</div>
            <div className="chip-row">
              {LEAD_OPTIONS.map((m) => (
                <button key={m} className={`chip ${leadMinutes === m ? "active" : ""}`} disabled={!pushEnabled} onClick={() => setLeadMinutes(m)}>
                  {m}분 전
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 구독 미리보기 */}
        <div className="card">
          <div className="card-head"><SettingsIcon path={settingsIcons.crown} size={17} /><h2>구독 미리보기</h2></div>
          <p className="card-sub">요금제를 미리 둘러보고 골라보세요. 실제 결제·메신저 발송 연동은 PART 2(백엔드)에서 진행돼요.</p>

          <div className="plan-grid">
            {PLANS.map((p) => (
              <div key={p.id} className={`plan-card ${p.highlight ? "highlight" : ""} ${selectedPlan === p.id ? "selected" : ""}`} onClick={() => setSelectedPlan(p.id)}>
                {p.highlight && <span className="plan-badge"><SettingsIcon path={settingsIcons.crown} size={10} />인기</span>}
                <div className="plan-select-check">{selectedPlan === p.id && <SettingsIcon path={settingsIcons.check} size={11} />}</div>
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">{p.price === 0 ? "무료" : p.price.toLocaleString()}{p.price > 0 && <span> 원/월</span>}</div>
                <div className="plan-desc">{p.desc}</div>
                <div className="plan-features">
                  {p.features.map((f, i) => <div key={i}><SettingsIcon path={settingsIcons.check} size={12} />{f}</div>)}
                </div>
              </div>
            ))}
          </div>

          {selectedPlan === "premium" && (
            <>
              <div className="format-note">프리미엄에서 받을 이미지 시간표 양식을 골라보세요</div>
              <div className="format-grid">
                {FORMATS.map((f) => (
                  <div key={f.id} className={`format-card ${selectedFormat === f.id ? "selected" : ""}`} onClick={() => setSelectedFormat(f.id)}>
                    <FormatPreview id={f.id} />
                    <div className="fname">{f.name}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="backend-note">
            ⚠️ 지금은 요금제·양식을 "선택해보는" 화면만 동작해요. 실제 결제(PG 연동)와 매일 아침 카카오톡 발송은 백엔드 작업이 필요해서, 그 부분은 진행 시점을 먼저 여쭤보고 진행할게요.
          </div>
        </div>

        {/* 계정 */}
        <div className="card">
          <div className="card-head"><SettingsIcon path={settingsIcons.user} size={17} /><h2>계정</h2></div>
          <div className="account-row">
            <div className="avatar"><SettingsIcon path={settingsIcons.user} size={20} /></div>
            <div>
              <div className="account-name">민준님</div>
              <div className="account-email">example@bboggl.com</div>
            </div>
            <button className="logout-btn" onClick={onLogout}><SettingsIcon path={settingsIcons.logout} size={14} />로그아웃</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- App: 랜딩 → 로그인 → 캘린더 라우팅 ---------- */
export default function App() {
  const [view, setView] = useState("landing"); // 'landing' | 'calendar' | 'settings'
  const [showLogin, setShowLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // 앱 시작 시 기존 세션 확인 + 로그인 상태 변화 실시간 구독
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setView(session ? "calendar" : "landing");
      setAuthLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setShowLogin(false);
      setView(session ? "calendar" : "landing");
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = () => {
    // 이메일/비밀번호 로그인은 즉시 세션이 생기므로 바로 전환.
    // 구글/카카오는 리다이렉트 후 위 onAuthStateChange가 알아서 처리해줘요.
    setShowLogin(false);
    setView("calendar");
  };

  const handleLogout = async () => {
    await signOut();
    setView("landing"); // onAuthStateChange도 곧 동일하게 반영하지만 즉각적인 UX를 위해 먼저 처리
  };

  if (authLoading) return null; // 세션 확인 중 깜빡임 방지 (원하면 로딩 스피너로 교체 가능)

  return (
    <>
      {view === "landing" && (
        <LandingPage onStart={() => setShowLogin(true)} onLogin={() => setShowLogin(true)} />
      )}
      {view === "calendar" && (
        <CalendarPage onLogout={handleLogout} onOpenSettings={() => setView("settings")} />
      )}
      {view === "settings" && <SettingsPage onBack={() => setView("calendar")} onLogout={handleLogout} />}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
