import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const VENUE_LABELS = {
  performance: '공연장',
  studio: '스튜디오',
  event: '행사장',
};

const OPTION_LABELS = {
  opt_extra_capacity:    { label: '수용인원 50명 이상', price: 100000 },
  opt_multitrack:        { label: '멀티트랙 녹음',      price: 100000 },
  opt_personal_monitor:  { label: '퍼스널 모니터 / 인이어', price: 100000 },
  opt_extra_operator:    { label: '추가 오퍼레이터',    price: null },  // 시간당
  opt_bar_operation:     { label: '바 운영',            price: 0 },
  opt_prompter:          { label: '프롬프터',           price: 0 },
  opt_tax_invoice:       { label: '세금계산서 발행',    price: 0 },
};

function formatKRW(amount) {
  return `${(amount / 10000).toLocaleString('ko-KR')}만원`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}요일)`;
}

function buildOptionsHtml(reservation) {
  const rows = [];

  for (const [key, meta] of Object.entries(OPTION_LABELS)) {
    if (!reservation[key]) continue;

    let priceText = '';
    if (key === 'opt_extra_operator' && reservation.opt_extra_operator_hours) {
      const fee = 20000 * reservation.opt_extra_operator_hours;
      priceText = `+${formatKRW(fee)} (${reservation.opt_extra_operator_hours}시간)`;
    } else if (meta.price > 0) {
      priceText = `+${formatKRW(meta.price)}`;
    } else {
      priceText = '포함';
    }

    rows.push(`
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#444;">${meta.label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#222;font-weight:500;">${priceText}</td>
      </tr>`);
  }

  if (rows.length === 0) return '<tr><td colspan="2" style="padding:8px 12px;color:#888;">선택된 추가 옵션 없음</td></tr>';
  return rows.join('');
}

function buildEmailHtml(reservation) {
  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;
  const additionalPrice = reservation.additional_price || 0;

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
      <h2 style="margin:0 0 8px;font-size:18px;color:#111;">안녕하세요, ${reservation.name}님</h2>
      <p style="margin:0;color:#555;font-size:14px;line-height:1.7;">
        스페이스홍 <strong>${venueName}</strong> 예약이 확정되었습니다.<br>
        아래에서 예약 정보 및 견적 내역을 확인해주세요.
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
          <td style="padding:10px 12px;color:#111;">${reservation.start_time} ~ ${reservation.end_time} (${reservation.rental_hours}시간)</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#888;">예약자</td>
          <td style="padding:10px 12px;color:#111;">${reservation.name}${reservation.organization ? ` (${reservation.organization})` : ''}</td>
        </tr>
        <tr style="background:#fafafa;">
          <td style="padding:10px 12px;color:#888;">연락처</td>
          <td style="padding:10px 12px;color:#111;">${reservation.phone}</td>
        </tr>
      </table>
    </div>

    <!-- 견적 내역 -->
    <div style="padding:24px 40px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">견적 내역</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${buildOptionsHtml(reservation)}
        <tr style="background:#f9f9f9;">
          <td style="padding:12px;color:#888;font-size:12px;" colspan="2">
            * 기본 대관료는 예약 일정 및 테크라이더 확인 후 최종 안내됩니다.
          </td>
        </tr>
        ${additionalPrice > 0 ? `
        <tr style="border-top:2px solid #111;">
          <td style="padding:12px;font-weight:700;font-size:15px;color:#111;">추가 옵션 합계</td>
          <td style="padding:12px;font-weight:700;font-size:15px;color:#111;text-align:right;">${formatKRW(additionalPrice)}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- 계약 주요 조항 -->
    <div style="padding:24px 40px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">계약 주요 사항</h3>
      <div style="background:#fafafa;border-radius:8px;padding:16px 20px;font-size:13px;color:#555;line-height:1.8;">
        <p style="margin:0 0 8px;"><strong style="color:#111;">취소 및 환불 정책</strong></p>
        <ul style="margin:0 0 12px;padding-left:18px;">
          <li>대관일 45일 전: 전액 환불</li>
          <li>대관일 30일 전: 50% 환불</li>
          <li>대관일 14일 전 이후: 환불 불가</li>
        </ul>
        <p style="margin:0 0 8px;"><strong style="color:#111;">입금 안내</strong></p>
        <p style="margin:0 0 12px;">예약 확정 후 3일 이내 입금이 완료되어야 예약이 최종 확정됩니다.</p>
        <p style="margin:0 0 8px;"><strong style="color:#111;">보증금</strong></p>
        <p style="margin:0;">입장 시 보증금 100,000원을 납부하며, 퇴장 시 공간 상태 확인 후 환불됩니다.</p>
      </div>
    </div>

    <!-- 서명 -->
    ${reservation.signature_data ? `
    <div style="padding:24px 40px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#888;text-transform:uppercase;letter-spacing:1px;">서명</h3>
      <div style="border:1px solid #eee;border-radius:8px;padding:12px;display:inline-block;">
        <img src="${reservation.signature_data}" alt="서명" style="max-width:200px;height:auto;display:block;">
      </div>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:32px 40px;margin-top:32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">문의사항이 있으시면 아래로 연락해주세요.</p>
      <p style="margin:0;font-size:13px;color:#555;">
        <strong>SPACE HONG</strong> · 서울특별시 마포구 ·
        <a href="mailto:Operator.Spacehong@gmail.com" style="color:#555;">Operator.Spacehong@gmail.com</a>
      </p>
      <p style="margin:12px 0 0;font-size:11px;color:#bbb;">본 메일은 발신 전용입니다.</p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendReservationConfirmEmail(reservation) {
  if (!reservation.email) {
    console.warn('[Email] 이메일 주소 없음, 발송 건너뜀 id:', reservation.id);
    return;
  }

  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;

  const { data, error } = await resend.emails.send({
    from: 'Space Hong <noreply@space-hong.com>',
    to: reservation.email,
    subject: `[스페이스홍] ${venueName} 예약이 확정되었습니다`,
    html: buildEmailHtml(reservation),
  });

  if (error) {
    console.error('[Email] 발송 실패:', error);
    throw error;
  }

  console.log('[Email] 발송 완료:', data?.id, '→', reservation.email);
  return data;
}
