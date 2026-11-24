import { Resend } from 'resend';
import { buildContractPdf } from './pdfService.js';
import { getRentalDocs, loadDocFile } from './rentalDocuments.js';
import { VENUE_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/documentHelpers.js';
import { getRentalContract } from '../utils/rentalContracts.js';
import { getRefundTable, REFUND_POLICY_SEASON_BASIS } from '../utils/refundPolicy.js';
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

// 대관 계약서 제4조 · 안내사항 1번 — 유형별 제출 자료
const SUBMISSION_GUIDE = {
  performance: {
    deadline: '공연일 최소 7일 전까지',
    materials: '큐시트와 테크라이더',
    note: '첨부한 큐시트·테크라이더는 참고용 양식입니다. 큐시트에는 공연 순서·곡별 진행·영상 및 조명 전환 요청을, 테크라이더에는 악기·입출력·모니터·무대 배치를 실제 구성에 맞게 작성해 주세요.',
  },
  studio: {
    deadline: '촬영일 최소 7일 전까지',
    materials: '촬영계획서와 요청된 운영 자료',
    note: '첨부한 큐시트는 참고용 양식입니다. 촬영 순서와 구성, 출연 인원, 장비 배치, 외부 장비 반입 여부를 작성해 주세요.',
  },
  event: {
    deadline: '행사일 최소 7일 전까지',
    materials: '행사계획서와 요청된 운영 자료',
    note: '첨부한 큐시트는 참고용 양식입니다. 행사 진행 순서, 참가 인원, 좌석 배치, 공간 구성을 작성해 주세요.',
  },
};

const SECTION_TITLE = 'margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;';
const PANEL = 'background:#fafafa;border-radius:8px;padding:16px 20px;font-size:13px;color:#555;line-height:1.8;';

/** 계약서 제2조 환불 표 (utils/refundPolicy.js) */
function refundTableHtml() {
  const { headers, rows } = getRefundTable();
  const th = (text, i) =>
    `<th style="padding:6px 10px;color:#333;text-align:${i ? 'right' : 'left'};font-weight:600;">${text}</th>`;
  const td = (text, i) =>
    `<td style="padding:6px 10px;color:#333;${i ? 'text-align:right;' : ''}">${text}</td>`;
  const body = rows.map((cells, r) => `
          <tr${r % 2 ? ' style="background:#f3f5f7;"' : ''}>${cells.map(td).join('')}</tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin:0 0 12px;">
          <tr style="background:#e9edf1;">${headers.map(th).join('')}</tr>${body}
        </table>`;
}

function buildEmailHtml(reservation, docs, contract) {
  const venueName = VENUE_LABELS[reservation.venue_type] || escapeHtml(reservation.venue_type);
  const name = escapeHtml(reservation.name);
  const organization = escapeHtml(reservation.organization);
  const phone = escapeHtml(reservation.phone);
  const startTime = escapeHtml(reservation.start_time);
  const endTime = escapeHtml(reservation.end_time);
  const rentalHours = escapeHtml(reservation.rental_hours);
  const submission = SUBMISSION_GUIDE[reservation.venue_type];

  const attachmentItems = [
    `<li><strong style="color:#111;">${contract.title} (서명 포함)</strong> — 예약 정보와 서명이 담긴 계약서입니다. 보관해 주세요.</li>`,
    `<li><strong style="color:#111;">${docs.label} 대관 안내사항</strong> — 준비부터 퇴장·보증금 환급까지 확인할 내용입니다.</li>`,
    `<li><strong style="color:#111;">큐시트 양식</strong> (참고용)</li>`,
  ];
  if (docs.techRider) {
    attachmentItems.push(`<li><strong style="color:#111;">테크라이더 양식</strong> (참고용)</li>`);
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);word-break:keep-all;">

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
      <h3 style="${SECTION_TITLE}">예약 정보</h3>
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

    <!-- 자료 제출 안내 -->
    <div style="padding:24px 40px 0;">
      <h3 style="${SECTION_TITLE}">자료 제출 안내</h3>
      <div style="${PANEL}">
        <p style="margin:0 0 8px;">
          <strong style="color:#111;">${submission.deadline}</strong> ${submission.materials}를
          <a href="mailto:${CONTACT_EMAIL}" style="color:#111;font-weight:600;">${CONTACT_EMAIL}</a>로 보내주세요.
        </p>
        <p style="margin:0;">
          ${submission.note}
          무대·공간 세팅과 기술 운영은 제출 자료와 사전 협의 내용을 기준으로 준비됩니다.
        </p>
      </div>
    </div>

    <!-- 첨부 파일 -->
    <div style="padding:24px 40px 0;">
      <h3 style="${SECTION_TITLE}">첨부 파일</h3>
      <p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.8;">본 메일에 계약서와 안내사항과 참고하실 서류 레퍼런스 파일이 첨부되어 있습니다.</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#555;line-height:1.8;">
        ${attachmentItems.join('\n        ')}
      </ul>
    </div>

    <!-- 계약 주요 사항 -->
    <div style="padding:24px 40px 0;">
      <h3 style="${SECTION_TITLE}">계약 주요 사항</h3>
      <div style="${PANEL}">
        <p style="margin:0 0 8px;"><strong style="color:#111;">취소 및 환불</strong></p>
        <p style="margin:0 0 8px;">대관자 사유로 취소하는 경우 취소 접수 시점에 따라 아래 비율로 대관료를 환불합니다. ${REFUND_POLICY_SEASON_BASIS}</p>
        ${refundTableHtml()}
        <p style="margin:0 0 8px;"><strong style="color:#111;">청소보증금</strong></p>
        <p style="margin:0;">
          청소보증금 10만원은 대관료와 함께 선입금합니다. 대관 종료 후 문자로 안내되는 환급 신청 폼을 제출하시면,
          현장 확인 후 이상이 없는 경우 제출일로부터 7일 이내 환급됩니다.
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

/** 서명 포함 계약서 + 안내사항 + 큐시트 (+ 공연만 테크라이더) */
async function buildAttachments(reservation, docs) {
  const safeName = String(reservation.name || '대관자').replace(/[^가-힣a-zA-Z0-9]/g, '_');

  const [contractPdf, guide, cueSheet, techRider] = await Promise.all([
    buildContractPdf(reservation),
    loadDocFile(docs.guide),
    loadDocFile(docs.cueSheet),
    docs.techRider ? loadDocFile(docs.techRider) : null,
  ]);

  const attachments = [
    { filename: `SPACE_HONG_${docs.label}_계약서_${safeName}.pdf`, content: contractPdf },
    { filename: docs.guideName, content: guide },
    { filename: docs.cueSheetName, content: cueSheet },
  ];
  if (techRider) {
    attachments.push({ filename: docs.techRiderName, content: techRider });
  }
  return attachments;
}

/** 발송하지 않고 메일 내용만 만든다 (미리보기·점검용) */
export async function buildReservationConfirmEmail(reservation) {
  const docs = getRentalDocs(reservation.venue_type);
  const contract = getRentalContract(reservation.venue_type);
  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;

  return {
    from: FROM_ADDRESS,
    to: reservation.email,
    subject: `[스페이스홍] ${venueName} 예약이 확정되었습니다`,
    html: buildEmailHtml(reservation, docs, contract),
    attachments: await buildAttachments(reservation, docs),
  };
}

export async function sendReservationConfirmEmail(reservation) {
  if (!reservation.email) {
    const err = new Error(`[Email] 이메일 주소 없음 — 예약 id: ${reservation.id}`);
    err.code = 'EMAIL_MISSING';
    throw err;
  }

  const message = await buildReservationConfirmEmail(reservation);
  const { data, error } = await getResend().emails.send(message);

  if (error) {
    logger.error({ err: error }, '[Email] 발송 실패');
    throw error;
  }

  logger.info(
    { emailId: data?.id, to: reservation.email, attachments: message.attachments.length },
    '[Email] 발송 완료',
  );
  return data;
}
