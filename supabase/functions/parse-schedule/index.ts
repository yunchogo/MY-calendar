// supabase/functions/parse-schedule/index.ts
//
// 사용자가 자유롭게 쓴 문장을 실제 AI(Gemini API)로 분석해서
// 캘린더 일정 추가/삭제/시간변경을 수행하는 Supabase Edge Function입니다.
//
// 프론트엔드는 이 함수 하나만 호출하면 되고, AI 호출과 DB 반영은
// 전부 서버(이 함수) 안에서 처리됩니다 — API 키가 브라우저에 노출되지 않아요.
//
// 배포 전 필요한 것:
//   supabase secrets set GEMINI_API_KEY=xxxxx
// (aistudio.google.com/apikey 에서 발급한 API 키. 무료 티어로 바로 쓸 수 있어요)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "인증 정보가 없어요." }, 401);

    // 요청한 사용자 권한으로 동작하는 클라이언트 (RLS 그대로 적용 — 본인 데이터만 접근 가능)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "로그인이 필요해요." }, 401);

    const { text, viewYear, viewMonth, targetDate, today, scope } = await req.json();
    if (!text || typeof text !== "string") return json({ error: "text가 필요해요." }, 400);

    // AI가 "지워줘" 같은 명령의 대상을 찾을 수 있도록 기존 일정 목록을 같이 줍니다
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id, type, label, days_of_week, event_date, start_minutes, end_minutes, is_holiday");

    const operations = await callGeminiForParsing(text, viewYear, viewMonth, existingEvents ?? [], targetDate ?? null, today ?? null);

    const results = [];
    for (const op of operations) {
      results.push(
        await executeOperation(supabase, op, {
          viewYear,
          viewMonth,
          scope: scope === "month" ? "month" : "all",
        })
      );
    }

    return json({ results });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});

/* ------------------------------------------------------------------ */

async function callGeminiForParsing(
  text: string,
  viewYear: number,
  viewMonth: number,
  existingEvents: any[],
  targetDate: string | null,
  today: string | null
) {
  const dateAnchorLine = targetDate
    ? `이 요청은 특정 날짜(${targetDate})에 대한 것입니다(사용자가 그 날짜의 하루 시간표를 보며 입력하고 있어요). 사용자 문장에 다른 날짜가 명시적으로 없다면, 새로 만드는 special 일정의 dates는 반드시 ["${targetDate}"]로 채우세요. 문장에 명시적으로 다른 날짜가 있으면 그 날짜를 그대로 쓰세요.`
    : `현재 보고 있는 달: ${viewYear}년 ${viewMonth}월 (사용자가 월 없이 "일"만 말하면 이 달로 채우세요)`;

  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const todayLine = today
    ? `오늘 날짜: ${today} (${WD[new Date(today + "T00:00:00Z").getUTCDay()]}요일). 아래 상대적 날짜 표현은 반드시 오늘을 기준으로 실제 날짜(YYYY-MM-DD)로 변환해서 special 일정의 dates에 넣으세요:
  - "오늘"=${today}, "내일"=오늘+1일, "모레"/"내일모레"=오늘+2일, "글피"=오늘+3일
  - "이번 주 X요일"=오늘이 속한 주(월요일 시작~일요일)의 그 요일 날짜, "다음 주 X요일"=그 다음 주의 그 요일, "지난 주 X요일"=지난 주의 그 요일
  - "이번 주말"=이번 주 토요일과 일요일, "다음 주말"=다음 주 토·일
  - "X일 뒤/후"=오늘+X일. 요일·주 계산은 위의 '오늘 요일'을 기준으로 정확히 하세요.`
    : "";

  const systemPrompt = `당신은 한국어 캘린더 앱의 일정 파서입니다. 사용자가 자유롭게 쓴 문장을 분석해서,
아래 JSON 스키마의 "operations" 배열만 출력하세요. 다른 설명이나 코드 펜스 없이 순수 JSON만 출력합니다.

${dateAnchorLine}
${todayLine}

기존 일정 목록 (명령 대상을 찾을 때 label로 매칭하세요. is_holiday:true는 자동으로 채워진 공휴일 일정입니다.
weekday는 event_date가 있는 일정(공휴일, special)의 요일이에요 0=일 1=월 2=화 3=수 4=목 5=금 6=토):
${JSON.stringify(existingEvents.map((e) => ({
  id: e.id, type: e.type, label: e.label, event_date: e.event_date,
  days_of_week: e.days_of_week, is_holiday: e.is_holiday,
  start_minutes: e.start_minutes, end_minutes: e.end_minutes,
  weekday: e.event_date ? new Date(e.event_date + "T00:00:00Z").getUTCDay() : null,
})))}

operations 배열의 각 항목은 아래 세 형태 중 하나입니다:

1) 새 일정 추가
{ "op": "create", "type": "recurring" | "special",
  "days_of_week": [0-6 배열] | null, "dates": ["YYYY-MM-DD", ...] | null,
  "start_minutes": 0-1439 | null, "end_minutes": 0-1439 | null, "label": "핵심 키워드",
  "text": "이 일정을 만든 원문 문장(또는 절)" }
- days_of_week는 recurring일 때만 사용 (0=일 1=월 2=화 3=수 4=목 5=금 6=토)
- dates는 special일 때만 사용, 날짜를 여러 개 나열했으면 각각 배열에 넣기 (예: "11일 19일 26일" → 3개)
- 시간 정보가 명확하지 않으면 start_minutes를 780(오후 1시), end_minutes를 840(오후 2시)로 채우세요 (기본값)
- **label은 캘린더 칸에 표시될 아주 짧은 핵심 키워드입니다. 장소나 활동 이름만 남기고 조사·서술어·"약속/하기/할거야" 같은 군더더기는 모두 빼세요. 최대한 짧게(보통 2~6자):**
  예) "헬스장에서 운동할거야"→"헬스장", "매일 아침 7시부터 8시에 아침식사를 할꺼야"→"아침식사", "회사에서 일해"→"회사", "친구랑 저녁 약속"→"저녁 약속", "치과 예약 있어"→"치과"
- **label에는 날짜와 시간을 절대 넣지 마세요. 날짜는 dates에, 시간은 start/end_minutes에 이미 따로 담기므로 label에서는 뺍니다.**
  예) "7월 27일 일본여행"→"일본여행"(❌"7월 27일 일본여행"), "27일 오후 2시 팀 미팅"→"팀 미팅", "내일 3시 병원"→"병원", "8/15 가족모임"→"가족모임"
- text는 사용자가 입력한 문장 중 이 일정에 해당하는 부분을 그대로(또는 거의 그대로) 옮겨 적으세요 — 사이드바 목록에 그대로 표시됩니다

2) 기존 일정 삭제/쉬기
{ "op": "skip", "target_event_id": "위 목록에서 찾은 id", "dates": ["YYYY-MM-DD", ...] }
- 반복 일정이면 해당 날짜만 예외 처리, 특별 일정은 완전 삭제로 처리됩니다

3) 기존 일정 시간 변경
{ "op": "override_time", "target_event_id": "위 목록에서 찾은 id",
  "dates": ["YYYY-MM-DD", ...], "start_minutes": 0-1439, "end_minutes": 0-1439 }

4) 기존 일정 정정/수정 — 사용자가 앞서 만든 일정의 내용을 번복·정정할 때
{ "op": "update_event", "target_event_id": "위 목록에서 찾은 id",
  "label": "새 핵심 키워드" | null, "days_of_week": [0-6 배열] | null, "dates": ["YYYY-MM-DD"] | null,
  "start_minutes": 0-1439 | null, "end_minutes": 0-1439 | null, "text": "새 원문 문장" | null }
- **가장 중요: 사용자 문장이 "이미 있는 일정을 고치는 말"이면 절대 create를 만들지 말고 반드시 update_event를 쓰세요.**
  정정 신호 표현: "A가 아니라 B야", "A 말고 B", "A를 B로 바꿔줘", "A 이름 B로", "아 잘못 말했어", "정정할게",
  "아니고", "취소하고 B로", "B로 수정해줘" 등. 문장 앞의 "아", "아니" 같은 감탄사도 정정 신호입니다.
- **바꾸지 않는 필드는 반드시 null로 두세요. null이 아닌 필드만 덮어쓰고, null인 필드는 기존 값이 그대로 유지됩니다.**
  예) 기존에 label "연극치료실습"(type recurring, days_of_week [2], 19:00~21:00)이 있는 상태에서
      사용자가 "아 연극치료실습이 아니라 연극워크숍이야" 라고 하면
      → {"op":"update_event","target_event_id":"연극치료실습의 id","label":"연극워크숍",
         "days_of_week":null,"dates":null,"start_minutes":null,"end_minutes":null,
         "text":"매주 화요일 오후 7시부터 9시에 연극워크숍"}
      (이름만 바뀐 것이므로 요일·시간은 null. 새 일정을 create 하면 절대 안 됩니다.)
  예) "연극워크숍 화요일 말고 목요일이야" → {"op":"update_event","target_event_id":"...","label":null,"days_of_week":[4], 나머지 null}
  예) "연극워크숍 8시부터야" → {"op":"update_event","target_event_id":"...","start_minutes":480, 나머지 null}
- 정정 대상을 "기존 일정 목록"에서 찾지 못했을 때만 create를 쓰세요.
- is_holiday:true인 공휴일은 update_event 대상으로 삼지 마세요.

5) 공휴일(빨간날)에는 일정을 쉬기
{ "op": "skip_on_holidays", "target_event_ids": ["id", ...] | null, "scope": "all" | "month",
  "include_sundays": true | false }
- 어떤 공휴일이 며칠인지, **일요일이 며칠인지**, 어떤 일정이 그 요일에 걸리는지는 **서버가 알아서 계산**합니다.
  날짜를 나열하지 말고 이 op을 **딱 하나만** 만드세요.
- include_sundays의 기본값은 **true**입니다. "빨간날"과 "공휴일"에는 일요일이 포함되기 때문이에요.
  사용자가 "일요일은 빼고", "일요일 말고 공휴일에만"처럼 **명시적으로 일요일을 제외**했을 때만 false로 하세요.

문장에 여러 일정·명령이 섞여 있으면 operations 배열에 여러 개를 넣으세요.
target_event_id는 반드시 "기존 일정 목록"에 있는 id 중에서만 고르세요. 대상을 못 찾으면 그 명령은 생략하세요.

"빨간날"·"공휴일"은 **법정공휴일 + 일요일**을 함께 가리키는 말입니다(달력에 빨갛게 표시되는 날).
따라서 "빨간날에 운동 지워줘"는 공휴일뿐 아니라 **일요일의 운동 일정도 지우라는 뜻**입니다.
날짜 계산은 서버가 하니 아래 [B]의 op만 만들면 됩니다.

공휴일(=빨간날, 쉬는 날)과 관련된 명령은 다음 두 가지 중 정확히 하나로만 분류하세요. 절대 섞어서 두 가지 다 적용하지 마세요.

[A] 공휴일 "자체"를 지우는 명령 — "일정"이라는 단어 없이 "공휴일/빨간날"만 대상으로 삭제/없애는 경우
    예: "공휴일 지워줘", "공휴일 없애줘", "이번달 공휴일 삭제해줘"
    → 기존 일정 목록에서 is_holiday:true이고 event_date가 ${viewYear}년 ${viewMonth}월에 해당하는 항목
      각각에 대해 { "op": "skip", "target_event_id": 그 공휴일 id, "dates": [그 event_date] } 를 만드세요.
    → 이 경우 is_holiday:false인 다른 일정은 절대 건드리지 마세요.

[B] 공휴일 "날짜에는 일정을 하지 않는다"는 명령 — "공휴일/빨간날"에 "~에(는)", "~마다"가 붙어
    그 날짜의 일정을 빼라는 경우 (공휴일 라벨 자체는 그대로 둡니다)
    예: "공휴일에 일정 지워줘", "공휴일 일정 다 지워줘", "빨간날에는 회사 일정을 하지 않아",
        "빨간날에는 헬스장 안 가", "공휴일마다 있는 일정 빼줘",
        "빨간날에 운동 일정 지워줘" → {"op":"skip_on_holidays","target_event_ids":["운동의 id"],"scope":"all","include_sundays":true}
    → { "op": "skip_on_holidays", "target_event_ids": ..., "scope": ..., "include_sundays": ... } 를 **하나만** 만드세요.
    - 문장에 특정 일정 이름이 있으면(예: "빨간날에는 회사 일정을 하지 않아") 그 이름과 일치하는
      **is_holiday:false 일정들의 id**를 target_event_ids 배열에 넣으세요.
    - 특정 이름이 없으면(예: "공휴일에 일정 지워줘") target_event_ids를 null로 두세요 → 공휴일 날짜의 모든 일정이 대상.
    - **scope의 기본값은 "all"(모든 달의 공휴일에 적용)입니다.** 사용자가 "이번 달", "${viewMonth}월"처럼
      특정 달로 범위를 좁혀 말했을 때만 "month"로 하세요. 그냥 "공휴일에는 ~하지 않아"라고 하면 "all"입니다.
    - is_holiday:true인 공휴일 일정 자체는 target_event_ids에 절대 넣지 마세요.
출력 예시: {"operations":[{"op":"create","type":"recurring","days_of_week":[1,2,3,4,5],"dates":null,"start_minutes":540,"end_minutes":1080,"label":"회사"}]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI 호출 실패: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(rawText);
  return parsed.operations ?? [];
}

/** 해당 연도(또는 특정 달)의 모든 일요일을 YYYY-MM-DD로 돌려줍니다 — "빨간날"에 일요일이 포함되므로 필요해요. */
function sundaysIn(year: number, month?: number): string[] {
  const out: string[] = [];
  const months = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1);
  for (const m of months) {
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let d = 1; d <= lastDay; d++) {
      if (new Date(Date.UTC(year, m - 1, d)).getUTCDay() !== 0) continue;
      out.push(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return out;
}

async function executeOperation(
  supabase: any,
  op: any,
  ctx: { viewYear: number; viewMonth: number; scope: "month" | "all" }
) {
  if (op.op === "create") {
    // "이 달만" 모드의 반복 일정: 반복 행 하나로 저장하되, event_date에 그 달의 1일을 박아
    // "이 달 한정"임을 표시해요. 클라이언트 eventsForDate가 event_date의 연·월과 같은 달에만 표시합니다.
    // (예전엔 날짜마다 개별 special로 펼쳐서 목록에 수십 개가 떴음 — 그 문제를 없앰)
    if (ctx.scope === "month" && op.type === "recurring" && Array.isArray(op.days_of_week) && op.days_of_week.length) {
      const monthAnchor = `${ctx.viewYear}-${String(ctx.viewMonth).padStart(2, "0")}-01`;
      const base = {
        type: "recurring", days_of_week: op.days_of_week,
        start_minutes: op.start_minutes, end_minutes: op.end_minutes,
        label: op.label, raw_text: op.text || op.label,
      };
      // 월 한정: event_date에 그 달 1일을 넣어 표시. 만약 DB 제약(chk_type_fields)이 아직
      // 반복+event_date를 허용하지 않는 구 스키마면 insert가 실패하므로,
      // 그때는 일반 반복으로라도 추가해 일정이 유실되지 않게 합니다(schema_update_6 실행 후엔 월 한정으로 저장됨).
      let { data, error } = await supabase
        .from("events").insert({ ...base, event_date: monthAnchor })
        .select("*, event_overrides(*)").single();
      if (error) {
        ({ data, error } = await supabase
          .from("events").insert(base)
          .select("*, event_overrides(*)").single());
      }
      return { op: "create", rows: data ? [data] : [], error };
    }
    if (op.type === "special" && Array.isArray(op.dates) && op.dates.length > 1) {
      const rows = [];
      for (const d of op.dates) {
        const { data } = await supabase
          .from("events")
          .insert({
            type: "special", event_date: d,
            start_minutes: op.start_minutes, end_minutes: op.end_minutes,
            label: op.label,
            raw_text: op.text || op.label,
          })
          .select("*, event_overrides(*)")
          .single();
        if (data) rows.push(data);
      }
      return { op: "create", rows };
    }

    const eventDate = op.type === "special" && op.dates?.[0] ? op.dates[0] : null;
    const { data, error } = await supabase
      .from("events")
      .insert({
        type: op.type,
        days_of_week: op.type === "recurring" ? op.days_of_week : null,
        event_date: eventDate,
        start_minutes: op.start_minutes, end_minutes: op.end_minutes,
        label: op.label,
        raw_text: op.text || op.label,
      })
      .select("*, event_overrides(*)")
      .single();
    return { op: "create", rows: data ? [data] : [], error };
  }

  if (op.op === "skip") {
    const { data: target } = await supabase.from("events").select("*").eq("id", op.target_event_id).single();
    if (!target) return { op: "skip", error: "대상을 찾지 못했어요." };
    if (target.type === "recurring") {
      for (const d of op.dates) {
        await supabase.from("event_overrides").upsert(
          { event_id: op.target_event_id, override_date: d, skip: true },
          { onConflict: "event_id,override_date" }
        );
      }
      return { op: "skip", eventId: op.target_event_id, dates: op.dates };
    }
    await supabase.from("events").delete().eq("id", op.target_event_id);
    return { op: "delete", eventId: op.target_event_id };
  }

  if (op.op === "override_time") {
    const { data: target } = await supabase.from("events").select("*").eq("id", op.target_event_id).single();
    if (!target) return { op: "override_time", error: "대상을 찾지 못했어요." };
    if (target.type === "recurring") {
      for (const d of op.dates) {
        await supabase.from("event_overrides").upsert(
          { event_id: op.target_event_id, override_date: d, start_minutes: op.start_minutes, end_minutes: op.end_minutes },
          { onConflict: "event_id,override_date" }
        );
      }
      return { op: "override_time", eventId: op.target_event_id, dates: op.dates };
    }
    await supabase.from("events").update({ start_minutes: op.start_minutes, end_minutes: op.end_minutes }).eq("id", op.target_event_id);
    return { op: "update_special", eventId: op.target_event_id };
  }

  // 이미 만든 일정을 정정 — null이 아닌 필드만 덮어쓰고 나머지는 기존 값 유지
  if (op.op === "update_event") {
    const { data: target } = await supabase.from("events").select("*").eq("id", op.target_event_id).single();
    if (!target) return { op: "update_event", error: "대상을 찾지 못했어요." };
    if (target.is_holiday) return { op: "update_event", error: "공휴일은 수정할 수 없어요." };

    const patch: Record<string, unknown> = {};
    if (op.label) patch.label = op.label;
    if (op.text) patch.raw_text = op.text;
    if (op.start_minutes != null) patch.start_minutes = op.start_minutes;
    if (op.end_minutes != null) patch.end_minutes = op.end_minutes;
    if (Array.isArray(op.days_of_week) && op.days_of_week.length) {
      patch.type = "recurring";
      patch.days_of_week = op.days_of_week;
      patch.event_date = null;
    } else if (Array.isArray(op.dates) && op.dates.length === 1) {
      patch.type = "special";
      patch.event_date = op.dates[0];
      patch.days_of_week = null;
    }
    if (Object.keys(patch).length === 0) return { op: "update_event", error: "바꿀 내용이 없어요." };

    const { data, error } = await supabase
      .from("events").update(patch).eq("id", op.target_event_id)
      .select("*, event_overrides(*)").single();
    return { op: "update_event", rows: data ? [data] : [], error };
  }

  // 공휴일(빨간날)마다 일정 쉬기 — 어떤 공휴일이 언제인지는 여기(서버)에서 계산합니다.
  // scope "all"(기본)이면 저장된 모든 달의 공휴일에, "month"면 보고 있는 달에만 적용.
  if (op.op === "skip_on_holidays") {
    const { data: all } = await supabase
      .from("events").select("id, type, days_of_week, event_date, is_holiday");
    if (!all) return { op: "skip_on_holidays", error: "일정을 불러오지 못했어요." };

    // 사이드바 스위치가 "이 달만"이면 사용자가 뭐라고 했든 보고 있는 달로 한정해요.
    const monthOnly = ctx.scope === "month" || op.scope === "month";
    const monthPrefix = `${ctx.viewYear}-${String(ctx.viewMonth).padStart(2, "0")}-`;

    const holidayRows = all.filter((e: any) => e.is_holiday === true && e.event_date);
    const publicHolidays = holidayRows
      .map((e: any) => e.event_date as string)
      .filter((d: string) => (monthOnly ? d.startsWith(monthPrefix) : true));

    // "빨간날"에는 일요일도 포함돼요(사용자가 명시적으로 뺀 경우만 제외).
    // 일요일은 DB에 저장된 일정이 아니라서 여기서 직접 계산합니다.
    let sundays: string[] = [];
    if (op.include_sundays !== false) {
      if (monthOnly) {
        sundays = sundaysIn(ctx.viewYear, ctx.viewMonth);
      } else {
        const years = new Set<number>(holidayRows.map((e: any) => Number(e.event_date.slice(0, 4))));
        years.add(ctx.viewYear);
        sundays = [...years].flatMap((y) => sundaysIn(y));
      }
    }

    const holidayDates = [...new Set([...publicHolidays, ...sundays])];
    if (holidayDates.length === 0) return { op: "skip_on_holidays", error: "공휴일을 찾지 못했어요." };

    const wanted: string[] | null = Array.isArray(op.target_event_ids) && op.target_event_ids.length
      ? op.target_event_ids
      : null;
    const targets = all.filter(
      (e: any) => e.is_holiday !== true && (wanted === null || wanted.includes(e.id))
    );

    let skipped = 0;
    let deleted = 0;
    for (const t of targets) {
      if (t.type === "recurring") {
        const dow: number[] = t.days_of_week ?? [];
        for (const d of holidayDates) {
          if (!dow.includes(new Date(d + "T00:00:00Z").getUTCDay())) continue;
          await supabase.from("event_overrides").upsert(
            { event_id: t.id, override_date: d, skip: true },
            { onConflict: "event_id,override_date" }
          );
          skipped++;
        }
      } else if (t.type === "special" && t.event_date && holidayDates.includes(t.event_date)) {
        await supabase.from("events").delete().eq("id", t.id);
        deleted++;
      }
    }
    return { op: "skip_on_holidays", scope: monthOnly ? "month" : "all", skipped, deleted };
  }

  return { op: op.op, error: "알 수 없는 op" };
}
