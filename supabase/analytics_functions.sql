-- ============================================================
-- Analytics: 스키마 마이그레이션 + PostgreSQL 집계 함수
-- Supabase SQL Editor (https://supabase.com/dashboard)에서 파일 전체를 실행하세요.
-- 모든 구문은 IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE이므로 여러 번 실행해도 안전합니다.
--
-- 지표 정의
--   순 방문자 (visitors) : 고유 visitor_id 수 (브라우저 단위, localStorage에 영구 저장)
--                          visitor_id가 없는 과거 데이터는 session_id로 대체 집계
--   방문 수   (visits)   : 고유 session_id 수 (30분 무활동 시 새 세션)
--   페이지뷰  (page_views): 페이지 진입 기록 수 (/rental은 진입 step=0만 포함, 폼 중간 단계 제외)
--   재방문자             : 기간 내 2회 이상 방문했거나, 기간 이전에 방문 이력이 있는 순 방문자
--   이탈률               : 1개 화면(페이지 또는 대관폼 단계)만 보고 나간 방문 비율
-- ============================================================


-- ------------------------------------------------------------
-- 0. 스키마 마이그레이션 (백엔드 배포 전에 먼저 실행)
-- ------------------------------------------------------------
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_id UUID;

CREATE INDEX IF NOT EXISTS idx_page_views_created_at
  ON page_views (created_at);

-- 재방문 판별(이전 방문 이력 조회)용
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created
  ON page_views (visitor_id, created_at)
  WHERE visitor_id IS NOT NULL;


-- 반환 컬럼이 바뀐 함수는 CREATE OR REPLACE가 불가하므로 먼저 제거
DROP FUNCTION IF EXISTS analytics_visits_by_period(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS analytics_rental_funnel(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS analytics_conversion_summary(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ);


-- ------------------------------------------------------------
-- 1. 기간별 순 방문자 / 방문 수 / 페이지뷰 (주간/월간/연간 공통)
--    bucket_index: weekly=0(월)~6(일), monthly=0(1일)~30(31일), yearly=0(1월)~11(12월)
--    각 bucket의 순 방문자는 해당 bucket 내 고유값이므로 합계가 기간 전체 순 방문자와 다를 수 있음
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_visits_by_period(
  p_start   TIMESTAMPTZ,
  p_end     TIMESTAMPTZ,
  p_period  TEXT  -- 'weekly' | 'monthly' | 'yearly'
)
RETURNS TABLE(bucket_index INT, visitors BIGINT, visits BIGINT, page_views BIGINT)
LANGUAGE SQL STABLE AS $$
  WITH v AS (
    SELECT
      created_at AT TIME ZONE 'Asia/Seoul'          AS kst,
      session_id,
      COALESCE(visitor_id::TEXT, session_id::TEXT)  AS visitor_key,
      page_path,
      step
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
  )
  SELECT
    (CASE p_period
       WHEN 'weekly'  THEN EXTRACT(ISODOW FROM kst)::INT - 1   -- 월=0 ... 일=6
       WHEN 'monthly' THEN EXTRACT(DAY    FROM kst)::INT - 1
       ELSE                EXTRACT(MONTH  FROM kst)::INT - 1
     END)                                                       AS bucket_index,
    COUNT(DISTINCT visitor_key)                                 AS visitors,
    COUNT(DISTINCT session_id)                                  AS visits,
    COUNT(*) FILTER (WHERE page_path <> '/rental' OR step = 0)  AS page_views
  FROM v
  GROUP BY 1
  ORDER BY 1;
$$;


-- ------------------------------------------------------------
-- 2. 페이지별 방문 건수 (/rental 폼 중간 단계는 제외, 진입(step=0)만 포함)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_page_distribution(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS TABLE(page_path TEXT, page_name TEXT, count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    page_path,
    MAX(page_name) AS page_name,
    COUNT(*)       AS count
  FROM page_views
  WHERE created_at >= p_start AND created_at < p_end
    AND (page_path <> '/rental' OR step = 0)
  GROUP BY page_path
  ORDER BY count DESC;
$$;


-- ------------------------------------------------------------
-- 3. 대관 폼 단계별 순 방문자 수 (퍼널)
--    사람 기준: 첫 방문에 시작하고 재방문해서 완료해도 1명으로 집계
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_rental_funnel(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS TABLE(step INT, visitors BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    step::INT                                                     AS step,
    COUNT(DISTINCT COALESCE(visitor_id::TEXT, session_id::TEXT))  AS visitors
  FROM page_views
  WHERE created_at >= p_start AND created_at < p_end
    AND page_path = '/rental'
    AND step IS NOT NULL
  GROUP BY step
  ORDER BY step;
$$;


-- ------------------------------------------------------------
-- 4. 요약 (순 방문자, 방문 수, 신규/재방문, 이탈률, 대관 전환율, 이전 기간 비교)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_conversion_summary(
  p_start      TIMESTAMPTZ,
  p_end        TIMESTAMPTZ,
  p_prev_start TIMESTAMPTZ,
  p_prev_end   TIMESTAMPTZ
)
RETURNS TABLE(
  total_visitors           BIGINT,
  total_visits             BIGINT,
  total_page_views         BIGINT,
  new_visitors             BIGINT,
  returning_visitors       BIGINT,
  bounce_rate              INT,
  pages_per_visit          NUMERIC,
  rental_starters          BIGINT,
  rental_completers        BIGINT,
  previous_period_visitors BIGINT,
  completion_rate          NUMERIC,
  overall_conversion_rate  NUMERIC
)
LANGUAGE SQL STABLE AS $$
WITH
  current_views AS (
    SELECT
      session_id,
      visitor_id,
      COALESCE(visitor_id::TEXT, session_id::TEXT) AS visitor_key,
      page_path,
      step
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
  ),
  agg AS (
    SELECT
      COUNT(DISTINCT visitor_key)                                 AS total_visitors,
      COUNT(DISTINCT session_id)                                  AS total_visits,
      COUNT(*) FILTER (WHERE page_path <> '/rental' OR step = 0)  AS total_page_views
    FROM current_views
  ),
  -- 이탈: 방문(세션) 동안 본 고유 화면(페이지+단계)이 1개뿐 — 새로고침은 이탈 판정에 영향 없음
  bounce AS (
    SELECT COUNT(*) AS bounced_visits
    FROM (
      SELECT session_id
      FROM current_views
      GROUP BY session_id
      HAVING COUNT(DISTINCT page_path || ':' || COALESCE(step::TEXT, '')) = 1
    ) s
  ),
  -- 기간 시작 이전에 방문 이력이 있는 visitor_id
  prior_visitors AS (
    SELECT c.visitor_id
    FROM (SELECT DISTINCT visitor_id FROM current_views WHERE visitor_id IS NOT NULL) c
    WHERE EXISTS (
      SELECT 1 FROM page_views pv
      WHERE pv.visitor_id = c.visitor_id
        AND pv.created_at < p_start
    )
  ),
  -- 방문자별 기간 내 방문 수 + 이전 방문 이력 여부
  visitor_stats AS (
    SELECT
      vc.visitor_key,
      (vc.visit_count >= 2 OR pr.visitor_id IS NOT NULL) AS is_returning
    FROM (
      SELECT visitor_key, COUNT(DISTINCT session_id) AS visit_count
      FROM current_views
      GROUP BY visitor_key
    ) vc
    LEFT JOIN prior_visitors pr ON pr.visitor_id::TEXT = vc.visitor_key
  ),
  loyalty AS (
    SELECT
      COUNT(*) FILTER (WHERE is_returning)     AS returning_visitors,
      COUNT(*) FILTER (WHERE NOT is_returning) AS new_visitors
    FROM visitor_stats
  ),
  rental AS (
    SELECT
      COUNT(DISTINCT visitor_key) FILTER (WHERE step = 0) AS rental_starters,
      COUNT(DISTINCT visitor_key) FILTER (WHERE step = 6) AS rental_completers
    FROM current_views
    WHERE page_path = '/rental' AND step IS NOT NULL
  ),
  prev AS (
    SELECT COUNT(DISTINCT COALESCE(visitor_id::TEXT, session_id::TEXT)) AS previous_period_visitors
    FROM page_views
    WHERE created_at >= p_prev_start AND created_at < p_prev_end
  )
SELECT
  agg.total_visitors,
  agg.total_visits,
  agg.total_page_views,
  loyalty.new_visitors,
  loyalty.returning_visitors,
  CASE WHEN agg.total_visits > 0
    THEN ROUND(bounce.bounced_visits::NUMERIC / agg.total_visits * 100)::INT
    ELSE 0
  END AS bounce_rate,
  CASE WHEN agg.total_visits > 0
    THEN ROUND(agg.total_page_views::NUMERIC / agg.total_visits * 10) / 10
    ELSE 0
  END AS pages_per_visit,
  rental.rental_starters,
  rental.rental_completers,
  prev.previous_period_visitors,
  CASE WHEN rental.rental_starters > 0
    THEN ROUND(rental.rental_completers::NUMERIC / rental.rental_starters * 1000) / 10
    ELSE 0
  END AS completion_rate,
  CASE WHEN agg.total_visitors > 0
    THEN ROUND(rental.rental_completers::NUMERIC / agg.total_visitors * 1000) / 10
    ELSE 0
  END AS overall_conversion_rate
FROM agg, bounce, loyalty, rental, prev;
$$;
