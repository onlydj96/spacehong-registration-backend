-- 대관 예약 추가옵션: 키보드 추가 (Yamaha MODX6 1대 대여·설치, 70,000원)
-- 백엔드 배포 전에 Supabase SQL Editor 에서 먼저 실행해야 합니다.
-- (컬럼이 없는 상태로 배포하면 예약 저장·관리자 목록 조회가 실패합니다)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS opt_keyboard boolean NOT NULL DEFAULT false;
