/**
 * 대관자 사유 취소 시 환불 기준 (2026-11 개정) — 계약서 PDF·예약 확정 메일이 쓴다.
 *
 * - 취소 접수 시점은 대관일 기준으로 센다.
 * - 일반기·성수기는 대관일이 속한 월로 구분한다. 성수기 월은 최소 대관 시간의
 *   PEAK_MONTHS(helpers.js, 10~12월)와 같다.
 * - 프론트엔드 src/utils/constants/refundPolicy.js(이용약관·FAQ 화면)와 같은 내용으로 유지한다.
 */
export const REFUND_POLICY_TIMING_LABEL = '취소 접수 시점';

export const REFUND_POLICY_SEASONS = [
  { id: 'regular', label: '일반기', period: '1~9월' },
  { id: 'peak', label: '성수기', period: '10~12월' },
];

/** 환불 비율(%) — 위에서부터 대관일에 가까워지는 순서 */
export const REFUND_POLICY_ROWS = [
  { timing: '60일 전까지', regular: 100, peak: 100 },
  { timing: '59~45일 전', regular: 80, peak: 50 },
  { timing: '44~31일 전', regular: 60, peak: 30 },
  { timing: '30일 전', regular: 60, peak: 0 },
  { timing: '29~15일 전', regular: 40, peak: 0 },
  { timing: '14~7일 전', regular: 20, peak: 0 },
  { timing: '6일 전~당일', regular: 0, peak: 0 },
];
