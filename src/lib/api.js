// src/lib/api.js
//
// 캘린더 데이터(일정, 예외, 칸 꾸미기, 프로필)를 Supabase와 주고받는 함수들입니다.
// CalendarPage / SettingsPage 안의 로컬 setEntries() 호출 부분을
// 아래 함수 호출로 바꿔주면 실제 저장이 동작해요.
//
// 모든 함수는 { data, error } 형태를 반환합니다. (Supabase 관례)

import { supabase } from "./supabaseClient";

/* ============================================================
   1. events — 일정 CRUD
   ============================================================ */

/** 로그인한 사용자의 모든 일정 + 각 일정에 딸린 예외(overrides)를 함께 불러옵니다 */
export async function fetchEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*, event_overrides(*)")
    .order("created_at", { ascending: true });
  return { data, error };
}

/**
 * 새 일정 추가. parseClause()가 반환하는 draft 객체를 그대로 넣으면 됩니다.
 * draft: { type, daysOfWeek, date: {month, day} | null, start, end, label, text }
 * year: 특별 일정 날짜를 만들 때 쓸 연도 (draft.date에는 연도가 없어서 별도로 받아요)
 */
export async function createEvent(draft, year) {
  const eventDate =
    draft.type === "special" && draft.date
      ? `${year}-${String(draft.date.month).padStart(2, "0")}-${String(draft.date.day).padStart(2, "0")}`
      : null;

  const { data, error } = await supabase
    .from("events")
    .insert({
      type: draft.type,
      days_of_week: draft.type === "recurring" ? draft.daysOfWeek : null,
      event_date: eventDate,
      start_minutes: draft.start,
      end_minutes: draft.end,
      label: draft.label,
      raw_text: draft.text,
      color: draft.color,
    })
    .select()
    .single();
  return { data, error };
}

/** 특정 연도에 이미 저장된 공휴일 일정을 불러옵니다 (없으면 App.jsx에서 새로 채워 넣어요) */
export async function fetchHolidaysForYear(year) {
  const { data, error } = await supabase
    .from("events")
    .select("*, event_overrides(*)")
    .eq("is_holiday", true)
    .gte("event_date", `${year}-01-01`)
    .lte("event_date", `${year}-12-31`);
  return { data, error };
}

/** 공휴일 일정을 한 번에 여러 개 추가 (rows: [{ event_date, label, start, end }, ...]) */
export async function insertHolidays(rows) {
  const { data, error } = await supabase
    .from("events")
    .insert(
      rows.map((r) => ({
        type: "special",
        event_date: r.event_date,
        label: r.label,
        raw_text: r.label,
        is_holiday: true,
        start_minutes: r.start,
        end_minutes: r.end,
      }))
    )
    .select("*, event_overrides(*)");
  return { data, error };
}

/** 일정 삭제 (연결된 event_overrides도 함께 삭제됨 — 스키마에 on delete cascade 설정됨) */
export async function deleteEvent(eventId) {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  return { error };
}

/** 일정 자체(기준값)를 수정 — "모든 반복 일정에 적용"을 선택했을 때 사용 */
export async function updateEventBase(eventId, patch) {
  const { data, error } = await supabase
    .from("events")
    .update({
      start_minutes: patch.start,
      end_minutes: patch.end,
    })
    .eq("id", eventId)
    .select()
    .single();
  return { data, error };
}

/** 실행 취소용 — 지정한 id/컬럼 값 그대로 일정 행을 다시 삽입합니다(삭제 취소 복원) */
export async function insertEventWithId(row) {
  const { data, error } = await supabase
    .from("events")
    .insert(row)
    .select("*, event_overrides(*)")
    .single();
  return { data, error };
}

/** 실행 취소용 — 일정 행의 여러 컬럼을 한 번에 되돌립니다(날짜·시간·라벨 등) */
export async function updateEventFields(eventId, fields) {
  const { data, error } = await supabase
    .from("events")
    .update(fields)
    .eq("id", eventId)
    .select()
    .single();
  return { data, error };
}

/** 실행 취소용 — 특정 일정에 딸린 예외(overrides)를 전부 삭제(스냅샷대로 다시 채우기 전에 정리) */
export async function deleteOverridesForEvent(eventId) {
  const { error } = await supabase.from("event_overrides").delete().eq("event_id", eventId);
  return { error };
}

/* ============================================================
   2. event_overrides — "이 날짜만 적용" 예외 처리
   ============================================================ */

/** 특정 날짜에 대한 예외를 저장(있으면 갱신, 없으면 생성) */
export async function upsertOverride(eventId, overrideDate, patch) {
  const { data, error } = await supabase
    .from("event_overrides")
    .upsert(
      {
        event_id: eventId,
        override_date: overrideDate, // 'YYYY-MM-DD' 형식
        start_minutes: patch.start ?? null,
        end_minutes: patch.end ?? null,
        skip: patch.skip ?? false,
      },
      { onConflict: "event_id,override_date" }
    )
    .select()
    .single();
  return { data, error };
}

/* ============================================================
   3. cell_decorations — 칸 배경색 / 붙인 사진
   ============================================================ */

export async function fetchCellDecorations() {
  const { data, error } = await supabase.from("cell_decorations").select("*");
  return { data, error };
}

export async function upsertCellColor(cellDate, color) {
  const { data, error } = await supabase
    .from("cell_decorations")
    .upsert({ cell_date: cellDate, color }, { onConflict: "user_id,cell_date" })
    .select()
    .single();
  return { data, error };
}

export async function clearCellColor(cellDate) {
  const { error } = await supabase
    .from("cell_decorations")
    .update({ color: null })
    .eq("cell_date", cellDate);
  return { error };
}

/** 이미지 업로드 (Storage) 후 URL을 cell_decorations에 저장 */
export async function uploadCellImage(cellDate, file) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user.id;
  const path = `${userId}/${cellDate}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("cell-images")
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError };

  const { data: publicUrlData } = supabase.storage.from("cell-images").getPublicUrl(path);

  const { data, error } = await supabase
    .from("cell_decorations")
    .upsert(
      { cell_date: cellDate, image_url: publicUrlData.publicUrl },
      { onConflict: "user_id,cell_date" }
    )
    .select()
    .single();
  return { data, error };
}

/** 캘린더 전체 배경 이미지 업로드 → profiles.calendar_bg_image_url에 저장 */
export async function uploadCalendarBgImage(file) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user.id;
  const path = `${userId}/bg-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("calendar-backgrounds")
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: uploadError };

  const { data: publicUrlData } = supabase.storage.from("calendar-backgrounds").getPublicUrl(path);
  return updateProfile({ calendar_bg_image_url: publicUrlData.publicUrl });
}

/* ============================================================
   4. profiles — 캘린더 이름, 테마, 구독 플랜, 알림 설정
   ============================================================ */

export async function fetchProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();
  return { data, error };
}

/** patch 예: { calendar_name, point_color, bg_color, border_color, active_template_id, subscription_plan, image_format, push_enabled, push_lead_minutes } */
export async function updateProfile(patch) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userData.user.id)
    .select()
    .single();
  return { data, error };
}

/* ============================================================
   5. AI 자연어 파싱 — Edge Function 호출
   ============================================================ */

/**
 * 사용자가 입력한 자유 문장을 Edge Function(parse-schedule)으로 보내
 * AI가 분석한 뒤 DB에 직접 반영하도록 합니다. 반환값은 참고용이며,
 * 호출 측에서는 보통 fetchEvents()로 다시 불러와 최신 상태를 반영하면 됩니다.
 */
export async function parseScheduleWithAI(text, viewYear, viewMonth, targetDate = null, today = null, scope = "all") {
  const { data, error } = await supabase.functions.invoke("parse-schedule", {
    body: { text, viewYear, viewMonth, targetDate, today, scope },
  });
  return { data, error };
}

/**
 * 레퍼런스 캘린더 이미지를 analyze-theme Edge Function으로 보내
 * AI가 분석한 테마 JSON을 받아옵니다. (imageBase64: data URL 접두어 없는 순수 base64)
 */
export async function analyzeThemeFromImage(imageBase64, mimeType) {
  const { data, error } = await supabase.functions.invoke("analyze-theme", {
    body: { imageBase64, mimeType },
  });
  return { data, error };
}
