-- ============================================================
-- Analytics PostgreSQL Functions
-- Supabase SQL Editor (https://supabase.com/dashboard)에서 실행하세요.
-- 각 함수는 CREATE OR REPLACE이므로 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1. 기간별 방문자/페이지뷰 집계 (주간/월간/연간 공통)
--    bucket_index: weekly=0(월)~6(일), monthly=0(1일)~30(31일), yearly=0(1월)~11(12월)
CREATE OR REPLACE FUNCTION analytics_visits_by_period(
  p_start   TIMESTAMPTZ,
  p_end     TIMESTAMPTZ,
  p_period  TEXT  -- 'weekly' | 'monthly' | 'yearly'
)
RETURNS TABLE(bucket_index INT, visitors BIGINT, page_views BIGINT)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_period = 'weekly' THEN
    RETURN QUERY
    SELECT
      CASE
        WHEN EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Seoul')::INT = 0 THEN 6
        ELSE EXTRACT(DOW FROM created_at AT TIME ZONE 'Asia/Seoul')::INT - 1
      END AS bucket_index,
      COUNT(DISTINCT session_id) AS visitors,
      COUNT(*)                   AS page_views
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
    GROUP BY 1
    ORDER BY 1;

  ELSIF p_period = 'monthly' THEN
    RETURN QUERY
    SELECT
      (EXTRACT(DAY FROM created_at AT TIME ZONE 'Asia/Seoul')::INT - 1) AS bucket_index,
      COUNT(DISTINCT session_id) AS visitors,
      COUNT(*)                   AS page_views
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
    GROUP BY 1
    ORDER BY 1;

  ELSE -- yearly
    RETURN QUERY
    SELECT
      (EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Seoul')::INT - 1) AS bucket_index,
      COUNT(DISTINCT session_id) AS visitors,
      COUNT(*)                   AS page_views
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
    GROUP BY 1
    ORDER BY 1;
  END IF;
END;
$$;


-- 2. 페이지별 방문 건수 집계 (/rental 폼 중간 단계는 제외, 진입(step=0)만 포함)
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


-- 3. 대관 폼 단계별 유니크 세션 수 (퍼널 분석용)
CREATE OR REPLACE FUNCTION analytics_rental_funnel(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS TABLE(step INT, sessions BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    step::INT                  AS step,
    COUNT(DISTINCT session_id) AS sessions
  FROM page_views
  WHERE created_at >= p_start AND created_at < p_end
    AND page_path = '/rental'
    AND step IS NOT NULL
  GROUP BY step
  ORDER BY step;
$$;


-- 4. 전환율 요약 (총 방문자, 이탈률, 대관 전환율, 이전 기간 비교)
CREATE OR REPLACE FUNCTION analytics_conversion_summary(
  p_start      TIMESTAMPTZ,
  p_end        TIMESTAMPTZ,
  p_prev_start TIMESTAMPTZ,
  p_prev_end   TIMESTAMPTZ
)
RETURNS TABLE(
  total_visitors           BIGINT,
  total_page_views         BIGINT,
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
    SELECT session_id, page_path, step
    FROM page_views
    WHERE created_at >= p_start AND created_at < p_end
  ),
  session_counts AS (
    SELECT session_id, COUNT(*) AS page_count
    FROM current_views
    GROUP BY session_id
  ),
  agg AS (
    SELECT
      COUNT(DISTINCT session_id) AS total_visitors,
      COUNT(*)                   AS total_page_views
    FROM current_views
  ),
  bounce AS (
    SELECT COUNT(*) AS single_page_sessions
    FROM session_counts
    WHERE page_count = 1
  ),
  rental AS (
    SELECT
      COUNT(DISTINCT session_id) FILTER (WHERE step = 0) AS rental_starters,
      COUNT(DISTINCT session_id) FILTER (WHERE step = 6) AS rental_completers
    FROM current_views
    WHERE page_path = '/rental' AND step IS NOT NULL
  ),
  prev AS (
    SELECT COUNT(DISTINCT session_id) AS previous_period_visitors
    FROM page_views
    WHERE created_at >= p_prev_start AND created_at < p_prev_end
  )
SELECT
  agg.total_visitors,
  agg.total_page_views,
  CASE WHEN agg.total_visitors > 0
    THEN ROUND(bounce.single_page_sessions::NUMERIC / agg.total_visitors * 100)::INT
    ELSE 0
  END AS bounce_rate,
  CASE WHEN agg.total_visitors > 0
    THEN ROUND(agg.total_page_views::NUMERIC / agg.total_visitors * 10) / 10
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
FROM agg, bounce, rental, prev;
$$;
