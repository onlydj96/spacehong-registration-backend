/**
 * 대관 규칙 — 성수기 월 · 대관 유형별 최소 대관 시간 (백엔드 연결 파일)
 *
 * 공용 모듈 refundPolicy.js · rentalContracts.js 는 저장소마다 다른 값을 이 파일의 RENTAL_RULES 로만 받는다.
 *  - 백엔드: helpers.js(getMinRentalHours 가 쓰는 PEAK_MONTHS · MIN_HOURS_BY_VENUE · PEAK_WEEKEND_MIN_HOURS) 값으로 만든다.
 *  - 프론트엔드: src/utils/constants/rentalRules.js 가 요금표(rentalPricing.js) 값으로 같은 모양을 만든다.
 *
 * minHours[유형][시즌] = { weekday: 월~목 최소 시간, weekend: 금~일 최소 시간 }
 * (getMinRentalHours 와 같은 규칙: 시즌은 대관일이 속한 월, 성수기 금~일은 PEAK_WEEKEND_MIN_HOURS 이상)
 */
import { PEAK_MONTHS, MIN_HOURS_BY_VENUE, PEAK_WEEKEND_MIN_HOURS } from './helpers.js';

export const RENTAL_RULES = {
  peakMonths: PEAK_MONTHS,
  minHours: Object.fromEntries(
    Object.entries(MIN_HOURS_BY_VENUE).map(([venueType, base]) => [
      venueType,
      {
        regular: { weekday: base, weekend: base },
        peak: { weekday: base, weekend: Math.max(base, PEAK_WEEKEND_MIN_HOURS) },
      },
    ]),
  ),
};
