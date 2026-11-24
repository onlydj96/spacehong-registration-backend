/**
 * 대관자 사유 취소 시 환불 기준 — 대관 계약서 제2조의 원본
 *
 * [공용 파일] 프론트엔드 src/utils/constants/refundPolicy.js 와 백엔드 src/utils/refundPolicy.js 는
 * 내용이 똑같아야 한다. 고칠 때는 한쪽을 고친 뒤 파일을 통째로 다른 쪽에 복사한다.
 *  - 프론트엔드: 계약서(예약 폼·관리자 화면), FAQ, 이용 안내 카드 — components/RefundPolicyTable
 *  - 백엔드: 계약서 PDF, 예약 확정 메일
 * 저장소마다 다른 값(성수기 월)은 같은 폴더의 rentalRules.js 가 넘겨준다.
 */
import { RENTAL_RULES } from './rentalRules.js';

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** [10, 11, 12] → '10~12월', [12, 1, 2] → '12~2월', [3, 4, 9] → '3~4월, 9월' */
export function formatMonthRange(months) {
  const set = new Set(months);
  if (set.size === 12) return '1~12월';
  const prev = (m) => (m === 1 ? 12 : m - 1);
  const next = (m) => (m === 12 ? 1 : m + 1);
  const runs = [];
  for (const start of ALL_MONTHS) {
    if (!set.has(start) || set.has(prev(start))) continue; // 구간의 첫 달만
    let end = start;
    while (set.has(next(end))) end = next(end);
    runs.push(end === start ? `${start}월` : `${start}~${end}월`);
  }
  return runs.join(', ');
}

/** 시즌 — 성수기 월은 요금·최소 대관 시간과 같은 값(RENTAL_RULES.peakMonths), 나머지 달은 일반기 */
export const REFUND_POLICY_SEASONS = [
  {
    id: 'regular',
    label: '일반기',
    period: formatMonthRange(ALL_MONTHS.filter((m) => !RENTAL_RULES.peakMonths.includes(m))),
  },
  { id: 'peak', label: '성수기', period: formatMonthRange(RENTAL_RULES.peakMonths) },
];

export const REFUND_POLICY_SEASON_BASIS = '일반기·성수기는 대관일이 속한 월을 기준으로 구분합니다.';

export const REFUND_POLICY_CAPTION = '대관자 사유 취소 시 환불 비율';
export const REFUND_POLICY_TIMING_LABEL = '취소 접수 시점';

/** 환불 비율(%) — 위에서부터 대관일에 가까워지는 순서 */
export const REFUND_POLICY_ROWS = [
  { timing: '대관일 60일 전까지', regular: 100, peak: 100 },
  { timing: '59~45일 전', regular: 80, peak: 50 },
  { timing: '44~31일 전', regular: 60, peak: 30 },
  { timing: '대관일 30일 전', regular: 60, peak: 0 },
  { timing: '29~15일 전', regular: 40, peak: 0 },
  { timing: '14~7일 전', regular: 20, peak: 0 },
  { timing: '6일 전~대관 당일', regular: 0, peak: 0 },
];

/** 글자 표 — ['취소 접수 시점', '일반기 (1~9월)', '성수기 (10~12월)'] 머리글 + 행마다 [시점, '100%', '100%'] */
export function getRefundTable() {
  return {
    caption: REFUND_POLICY_CAPTION,
    headers: [
      REFUND_POLICY_TIMING_LABEL,
      ...REFUND_POLICY_SEASONS.map((season) => `${season.label} (${season.period})`),
    ],
    rows: REFUND_POLICY_ROWS.map((row) => [
      row.timing,
      ...REFUND_POLICY_SEASONS.map((season) => `${row[season.id]}%`),
    ]),
  };
}
