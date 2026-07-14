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

    const { text, viewYear, viewMonth, targetDate } = await req.json();
    if (!text || typeof text !== "string") return json({ error: "text가 필요해요." }, 400);

    // AI가 "지워줘" 같은 명령의 대상을 찾을 수 있도록 기존 일정 목록을 같이 줍니다
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id, type, label, days_of_week, event_date, start_minutes, end_minutes, is_holiday");

    const operations = await callGeminiForParsing(text, viewYear, viewMonth, existingEvents ?? [], targetDate ?? null);

    const results = [];
    for (const op of operations) {
      results.push(await executeOperation(supabase, op));
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
  targetDate: string | null
) {
  const dateAnchorLine = targetDate
    ? `이 요청은 특정 날짜(${targetDate})에 대한 것입니다(사용자가 그 날짜의 하루 시간표를 보며 입력하고 있어요). 사용자 문장에 다른 날짜가 명시적으로 없다면, 새로 만드는 special 일정의 dates는 반드시 ["${targetDate}"]로 채우세요. 문장에 명시적으로 다른 날짜가 있으면 그 날짜를 그대로 쓰세요.`
    : `현재 보고 있는 달: ${viewYear}년 ${viewMonth}월 (사용자가 월 없이 "일"만 말하면 이 달로 채우세요)`;

  const systemPrompt = `당신은 한국어 캘린더 앱의 일정 파서입니다. 사용자가 자유롭게 쓴 문장을 분석해서,
아래 JSON 스키마의 "operations" 배열만 출력하세요. 다른 설명이나 코드 펜스 없이 순수 JSON만 출력합니다.

${dateAnchorLine}

기존 일정 목록 (명령 대상을 찾을 때 label로 매칭하세요. is_holiday:true는 자동으로 채워진 공휴일 일정입니다.
weekday는 event_date가 있는 일정(공휴일, special)의 요일이에요 0=일 1=월 2=화 3=수 4=목 5=금 6=토):
${JSON.stringify(existingEvents.map((e) => ({
  id: e.id, type: e.type, label: e.label, event_date: e.event_date,
  days_of_week: e.days_of_week, is_holiday: e.is_holiday,
  weekday: e.event_date ? new Date(e.event_date + "T00:00:00Z").getUTCDay() : null,
})))}

operations 배열의 각 항목은 아래 세 형태 중 하나입니다:

1) 새 일정 추가
{ "op": "create", "type": "recurring" | "special",
  "days_of_week": [0-6 배열] | null, "dates": ["YYYY-MM-DD", ...] | null,
  "start_minutes": 0-1439 | null, "end_minutes": 0-1439 | null, "label": "일정 이름",
  "text": "이 일정을 만든 원문 문장(또는 절)" }
- days_of_week는 recurring일 때만 사용 (0=일 1=월 2=화 3=수 4=목 5=금 6=토)
- dates는 special일 때만 사용, 날짜를 여러 개 나열했으면 각각 배열에 넣기 (예: "11일 19일 26일" → 3개)
- 시간 정보가 명확하지 않으면 start_minutes를 780(오후 1시), end_minutes를 840(오후 2시)로 채우세요 (기본값)
- text는 사용자가 입력한 문장 중 이 일정에 해당하는 부분을 그대로(또는 거의 그대로) 옮겨 적으세요 — 사이드바 목록에 그대로 표시됩니다

2) 기존 일정 삭제/쉬기
{ "op": "skip", "target_event_id": "위 목록에서 찾은 id", "dates": ["YYYY-MM-DD", ...] }
- 반복 일정이면 해당 날짜만 예외 처리, 특별 일정은 완전 삭제로 처리됩니다

3) 기존 일정 시간 변경
{ "op": "override_time", "target_event_id": "위 목록에서 찾은 id",
  "dates": ["YYYY-MM-DD", ...], "start_minutes": 0-1439, "end_minutes": 0-1439 }

문장에 여러 일정·명령이 섞여 있으면 operations 배열에 여러 개를 넣으세요.
target_event_id는 반드시 "기존 일정 목록"에 있는 id 중에서만 고르세요. 대상을 못 찾으면 그 명령은 생략하세요.

공휴일과 관련된 삭제 명령은 다음 두 가지 중 정확히 하나로만 분류하세요. 절대 섞어서 두 가지 다 적용하지 마세요.

[A] 공휴일 "자체"를 지우는 명령 — "일정"이라는 단어 없이 "공휴일"만 대상으로 삭제/없애는 경우
    예: "공휴일 지워줘", "공휴일 없애줘", "이번달 공휴일 삭제해줘"
    → 기존 일정 목록에서 is_holiday:true이고 event_date가 ${viewYear}년 ${viewMonth}월에 해당하는 항목
      각각에 대해 { "op": "skip", "target_event_id": 그 공휴일 id, "dates": [그 event_date] } 를 만드세요.
    → 이 경우 is_holiday:false인 다른 일정은 절대 건드리지 마세요.

[B] 공휴일 "날짜에 있는 다른 일정들"을 지우는 명령 — "일정"이라는 단어가 함께 있거나 "~에"가 붙어
    "그 날짜의 다른 일정"을 가리키는 경우 (공휴일 자체는 그대로 둡니다)
    예: "공휴일에 일정 지워줘", "공휴일에 있는 일정 지워줘", "공휴일 일정 다 지워줘", "공휴일마다 있는 일정 빼줘"
    → 기존 일정 목록에서 is_holiday:true이고 event_date가 ${viewYear}년 ${viewMonth}월에 해당하는 공휴일들을 찾은 뒤,
      각 공휴일에 대해 is_holiday:false인 일정 중
      - type이 recurring이고 days_of_week에 그 공휴일의 weekday가 포함된 것,
      - type이 special이고 event_date가 그 공휴일의 event_date와 같은 것
      을 모두 찾아 각각 { "op": "skip", "target_event_id": 그 일정의 id, "dates": [그 공휴일의 event_date] } 를 만드세요.
    → 이 경우 is_holiday:true인 공휴일 일정 자체는 target_event_id로 절대 포함하지 마세요(공휴일 라벨은 그대로 남아야 합니다).

(문장에 특정 일정 이름이 함께 언급되어 있으면[예: "공휴일에 회사 지워줘"], 공휴일 여부와 무관하게 그 이름의 일정만 대상으로 하세요 — 이 경우는 위 [A][B]가 아니라 일반 삭제 규칙을 따르세요.)
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

async function executeOperation(supabase: any, op: any) {
  if (op.op === "create") {
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

  return { op: op.op, error: "알 수 없는 op" };
}
