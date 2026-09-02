/**
 * 문서 공통 유틸리티 (이메일 / PDF 공유)
 * emailService.js, pdfService.js 에서 중복으로 정의되던 상수·함수 통합
 */

export const OPTION_LABELS = {
  opt_extra_capacity:   { label: '수용인원 50명 이상',        price: 100000 },
  opt_multitrack:       { label: '멀티트랙 녹음',            price: 100000 },
  opt_personal_monitor: { label: '퍼스널 모니터 / 인이어',   price: 100000 },
  opt_extra_operator:   { label: '추가 오퍼레이터',          price: null   },  // 시간당
  opt_drum_cleanup:     { label: '무대 드럼 정리',           price: 100000 },
  opt_bar_operation:    { label: '바 운영',                  price: 0      },
  opt_prompter:         { label: '프롬프터',                 price: 0      },
  opt_tax_invoice:      { label: '세금계산서 발행',          price: 0      },
};

/**
 * 금액을 "N만원" 형식으로 포맷
 * @param {number} amount - 원 단위 금액
 * @returns {string}
 */
export function formatKRW(amount) {
  const man = amount / 10000;
  return `${man % 1 === 0 ? man : man.toFixed(1)}만원`;
}

/**
 * 날짜 문자열을 "YYYY년 M월 D일 (요일)" 형식으로 포맷
 * @param {string} dateStr - YYYY-MM-DD 형식
 * @returns {string}
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}요일)`;
}
