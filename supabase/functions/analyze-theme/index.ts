// supabase/functions/analyze-theme/index.ts
//
// 사용자가 업로드한 레퍼런스 캘린더/플래너 이미지를 Gemini(비전)로 분석해서
// 그 이미지와 비슷한 "테마" JSON을 만들어 돌려주는 Edge Function입니다.
// (이미지 생성이 아니라 분석 → 색감/모양/타이포/장식 스타일을 뽑아냄)
//
// 프론트엔드는 이 함수가 준 JSON을 기존 템플릿과 같은 방식으로 화면에 적용합니다.
// 필요한 것: supabase secrets set GEMINI_API_KEY=xxxxx (이미 설정되어 있음)

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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

const SYSTEM_PROMPT = `당신은 캘린더/플래너 UI의 디자인을 분석하는 전문가입니다.
주어진 이미지(캘린더나 다이어리/플래너 디자인)를 보고, 색상뿐 아니라 "디자인 전체"(칸의 크기·모양·간격, 폰트,
일정 블록 스타일)를 최대한 비슷하게 재현할 수 있는 테마 값을 아래 JSON 스키마로만 출력하세요.
설명이나 코드펜스 없이 순수 JSON만 출력합니다.

{
  "name": "이 테마를 한국어로 짧게 부르는 이름(예: 세이지 그린 미니멀)",
  "pageBg": "#RRGGBB — 전체 배경(가장자리/여백)의 주된 색",
  "cellBg": "#RRGGBB — 날짜 칸/박스의 배경색",
  "cellBorder": "#RRGGBB — 칸 테두리나 구분선의 색",
  "accent": "#RRGGBB — 제목·강조·포인트에 쓰인 튀는 색",
  "weekdayColor": "#RRGGBB — 요일(월화수…) 글자에 어울리는 색",
  "cellRadius": 정수(px 0~28) — 칸 모서리 둥글기. 각지면 2, 살짝 둥글면 8, 둥글면 14, 아주 둥글면 24,
  "cellGap": 정수(px 0~16) — 칸과 칸 사이 간격. 칸이 딱 붙은 격자면 0~2, 여유있게 떨어져 있으면 8~14,
  "cellMinHeight": 정수(px 70~170) — 칸의 세로 크기. 큼직한 디자인이면 150~170, 촘촘하고 작으면 80~110,
  "cellBorderWidth": 정수(px 0~3) — 칸 테두리 두께. 테두리가 없으면 0, 얇으면 1, 굵고 뚜렷하면 2~3,
  "titleFontKey": "poppins" | "playfair" | "archivo" | "baloo" — 큰 제목(월/날짜)의 폰트,
  "bodyFontKey": "poppins" | "playfair" | "archivo" | "baloo" — 날짜 숫자·일정 등 본문 폰트,
  "monthStyle": "normal" | "italic",
  "monthWeight": 400~800 사이 정수,
  "decor": "pill" | "block" | "stripe" | "plain",
  "eventStyle": "solid" | "soft" | "outline" | "flat" — 일정 블록의 디자인,
  "eventRadius": 정수(px 0~20) — 일정 블록의 모서리 둥글기,
  "boardMaxWidth": 정수(px) 또는 null — 캘린더 판 전체 가로 폭. 여백을 두고 좁게 자리하면 500~780, 화면을 꽉 채우면 null,
  "boardAlign": "left" | "center" — 판을 왼쪽/가운데 정렬(좁은 판이면 보통 center),
  "cellAspect": 숫자 또는 null — 칸의 가로:세로 비율. 정사각형이면 1, 세로로 길쭉하면 0.7~0.9, 가로로 넓적하면 1.3~1.7. 특별하지 않으면 null,
  "weekdayLang": "ko" | "en" — 요일 표기 언어(레퍼런스 요일이 영어로 적혀 있으면 en, 아니면 ko),
  "weekdayFormat": "full" | "short" | "letter" — 요일 길이(일요일 / 일 / S 또는 Sunday / Sun / S),
  "weekdayAlign": "left" | "center" | "right" — 요일 글자 정렬,
  "showWeekday": true | false — 요일 줄이 있으면 true,
  "dateFontKey": "poppins" | "playfair" | "archivo" | "baloo" 또는 null(=본문폰트) — 날짜 숫자 폰트,
  "dateSize": 정수(px 10~26) — 날짜 숫자 크기(큼직하면 18~24, 작으면 11~13),
  "dateAlign": "left" | "center" | "right" — 칸 안에서 날짜 숫자의 가로 위치,
  "boardTitle": true | false — 달력 판 안/위에 큰 월 제목(예: 7월, JULY, July)이 크게 들어가 있으면 true,
  "titleLang": "ko" | "en" — 그 제목이 한글(7월)인지 영어(JULY)인지,
  "titleCase": "upper" | "title" | "lower" — 영어 제목의 대소문자(JULY / July / july),
  "titlePosition": "left" | "center" | "right" — 제목의 가로 위치,
  "stripeColors": ["#RRGGBB", "#RRGGBB"]
}

가이드:
- 폰트: 우아한 세리프/필기체 느낌이면 "playfair", 두껍고 강한 대문자 디스플레이면 "archivo",
  동글동글 친근하면 "baloo", 깔끔한 산세리프/기본이면 "poppins".
  titleFontKey는 제목의 인상, bodyFontKey는 본문 숫자·일정 글씨의 인상에 맞추세요(보통 본문은 읽기 좋은 poppins/baloo).
- decor: 제목이 알약(둥근 태그) 안에 있으면 "pill", 크고 각진 대문자 블록이면 "block",
  줄무늬(스트라이프) 장식이 보이면 "stripe", 특별한 장식이 없으면 "plain".
- eventStyle: 일정 항목이 색으로 꽉 찬 알약/바 형태면 "solid", 연한 파스텔 배경에 진한 글씨면 "soft",
  테두리만 있고 속이 비쳐 보이면 "outline", 각지고 납작한 라벨이면 "flat".
- monthStyle: 제목이 이탤릭/필기체로 기울어 보이면 "italic", 아니면 "normal".
- stripeColors: decor가 "stripe"일 때만 의미 있음(두 줄무늬 색). 아니면 accent와 cellBg를 넣어도 됨.
- 색은 반드시 이미지에서 실제로 보이는 색을 뽑아 #RRGGBB 형식으로. 배경과 칸 색이 비슷하면 살짝만 다르게.
- 칸 크기/간격/테두리/폰트/일정블록 스타일은 이미지의 실제 레이아웃 인상을 그대로 반영하세요(단순히 기본값 쓰지 말 것).
- 레이아웃도 레퍼런스를 최대한 따라가세요: 판을 꼭 가로로 꽉 채우지 말고 레퍼런스가 좁으면 boardMaxWidth로 좁게(center 정렬),
  칸이 정사각형/세로형/가로형이면 cellAspect로 반영, 요일이 영어면 weekdayLang="en", 큰 월 제목이 보이면 boardTitle=true로.
  "기본 틀 유지"보다 "레퍼런스를 얼마나 닮았는가"가 더 중요합니다. 다만 날짜 칸 격자(7열) 구조 자체는 유지하세요.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY가 설정되어 있지 않아요." }, 500);

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json({ error: "imageBase64가 필요해요." }, 400);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: mimeType || "image/png", data: imageBase64 } },
                { text: "이 캘린더/플래너 디자인을 분석해서 위 스키마대로 테마 JSON을 만들어줘." },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return json({ error: `AI 분석 실패: ${response.status} ${errText}` }, 502);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let theme;
    try {
      theme = JSON.parse(rawText);
    } catch {
      return json({ error: "AI 응답을 이해하지 못했어요. 다른 이미지로 시도해 주세요." }, 502);
    }

    return json({ theme });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
