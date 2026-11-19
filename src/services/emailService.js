import { Resend } from 'resend';
import { buildContractPdf } from './pdfService.js';
import { VENUE_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/documentHelpers.js';
import { logger } from '../middleware/logger.js';

// 발신 주소·연락처 — 환경변수로 관리
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'Space Hong <noreply@space-hong.com>';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'spacehongCS@gmail.com';

// Lazy initialization — 실제 발송 시점에 키 확인 (서버 시작 시 크래시 방지)
let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('[Email] RESEND_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(reservation) {
  const venueName = VENUE_LABELS[reservation.venue_type] || escapeHtml(reservation.venue_type);
  const name = escapeHtml(reservation.name);
  const organization = escapeHtml(reservation.organization);
  const phone = escapeHtml(reservation.phone);
  const startTime = escapeHtml(reservation.start_time);
  const endTime = escapeHtml(reservation.end_time);
  const rentalHours = escapeHtml(reservation.rental_hours);

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#111;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px;">SPACE HONG</h1>
      <p style="margin:8px 0 0;color:#aaa;font-size:13px;">대관 예약 확정 안내</p>
    </div>

    <!-- Greeting -->
    <div style="padding:32px 40px 0;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111;">안녕하세요, ${name}님</h2>
      <p style="margin:0;color:#555;font-size:14px;line-height:1.7;">
        스페이스홍 <strong>${venueName}</strong> 예약이 확정되었습니다.<br>
        아래에서 예약 정보를 확인해주세요.
      </p>
    </div>

    <!-- 예약 정보 -->
    <div style="padding:24px 40px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">예약 정보</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#fafafa;">
          <td style="padding:10px 12px;color:#888;width:40%;">예약 공간</td>
          <td style="padding:10px 12px;color:#111;font-weight:600;">${venueName}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#888;">대관 날짜</td>
          <td style="padding:10px 12px;color:#111;">${formatDate(reservation.rental_date)}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:10px 12px;color:#888;">대관 시간</td>
          <td style="padding:10px 12px;color:#111;">${startTime} ~ ${endTime} (${rentalHours}시간)</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#888;">예약자</td>
          <td style="padding:10px 12px;color:#111;">${name}${organization ? ` (${organization})` : ''}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:10px 12px;color:#888;">연락처</td>
          <td style="padding:10px 12px;color:#111;">${phone}</td>
        </tr>
      </table>
    </div>

    <!-- 계약 주요 조항 -->
    <div style="padding:24px 40px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">계약 주요 사항</h3>
      <div style="background:#fafafa;border-radius:8px;padding:16px 20px;font-size:13px;color:#555;line-height:1.8;">
        <p style="margin:0 0 8px;"><strong style="color:#111;">취소 및 환불 정책</strong></p>
        <ul style="margin:0 0 12px;padding-left:18px;">
          <li>대관일 기준 45일 전: 전액 환불</li>
          <li>대관일 기준 45일 이후: 원칙적으로 환불 불가</li>
          <li>9~12월 성수기: 예약 확정 후 취소·변경·환불 불가</li>
        </ul>
        <p style="margin:0 0 8px;"><strong style="color:#111;">청소보증금</strong></p>
        <p style="margin:0 0 12px;">청소보증금 10만원을 대관료와 함께 선입금하며, 대관 종료 후 현장 확인을 거쳐 영업일 기준 3일 이내 환급됩니다.</p>
        <p style="margin:0 0 8px;"><strong style="color:#111;">첨부 파일 안내</strong></p>
        <p style="margin:0 0 12px;">본 메일에 이용규정 계약서가 첨부되어 있습니다. 확인 후 보관해주세요.</p>
        <p style="margin:0 0 8px;"><strong style="color:#111;">테크라이더 및 큐시트 제출 안내</strong></p>
        <p style="margin:0;">
          본 메일에 첨부된 테크라이더와 큐시트는 작성에 도움을 드리기 위한 참고용 레퍼런스 파일입니다.<br>
          첨부 자료를 참고하여 행사에 맞는 테크라이더와 큐시트를 작성하신 후, <strong style="color:#111;">대관일 최소 7일 전까지</strong> 회신해 주시기 바랍니다.<br>
          원활한 사전 준비와 현장 운영을 위해 기한 내 전달 부탁드립니다.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:32px 40px;margin-top:32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">문의사항이 있으시면 아래로 연락해주세요.</p>
      <p style="margin:0;font-size:13px;color:#555;">
        <strong>SPACE HONG</strong> · 서울특별시 마포구 ·
        <a href="mailto:${CONTACT_EMAIL}" style="color:#555;">${CONTACT_EMAIL}</a>
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#bbb;">본 메일은 발신 전용입니다.</p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendReservationConfirmEmail(reservation) {
  if (!reservation.email) {
    const err = new Error(`[Email] 이메일 주소 없음 — 예약 id: ${reservation.id}`);
    err.code = 'EMAIL_MISSING';
    throw err;
  }

  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;

  const contractPdf = await buildContractPdf(reservation);

  const safeName = reservation.name.replace(/[^가-힣a-zA-Z0-9]/g, '_');

  const { data, error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: reservation.email,
    subject: `[스페이스홍] ${venueName} 예약이 확정되었습니다`,
    html: buildEmailHtml(reservation),
    attachments: [
      { filename: `이용규정_계약서_${safeName}.pdf`, content: contractPdf },
    ],
  });

  if (error) {
    logger.error({ err: error }, '[Email] 발송 실패');
    throw error;
  }

  logger.info({ emailId: data?.id, to: reservation.email }, '[Email] 발송 완료');
  return data;
}
