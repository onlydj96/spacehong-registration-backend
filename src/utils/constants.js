/**
 * 서버 공통 상수
 */

// CORS 허용 Origin 목록 (app.js CORS 설정 및 analytics Origin 검증에서 공용)
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

export const VENUE_LABELS = {
  performance: '공연장',
  studio: '스튜디오',
  event: '행사장',
};
