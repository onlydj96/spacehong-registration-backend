// Telegram Bot API 알림 서비스
// 이메일 발송 실패 시 관리자에게 개인 DM으로 알림 전송

// 지연 초기화 — 서버 시작 시 크래시 방지, 첫 호출 시점에 환경변수 확인
let _initialized = false;
let _botToken = null;
let _chatId = null;

function getTelegramConfig() {
  if (!_initialized) {
    _initialized = true;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.warn(
        '[Telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다. ' +
        'Telegram 알림을 건너뜁니다.'
      );
      return null;
    }

    _botToken = token;
    _chatId = chatId;
  }

  if (!_botToken || !_chatId) return null;
  return { botToken: _botToken, chatId: _chatId };
}

const VENUE_LABELS = {
  performance: '공연장',
  studio: '스튜디오',
  event: '행사장',
};

// Telegram HTML parse_mode 이스케이프 (& < > 처리)
function escapeTg(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildEmailFailureMessage(reservation, errorMessage) {
  const venueName = VENUE_LABELS[reservation.venue_type] || escapeTg(reservation.venue_type);
  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    `🚨 <b>[스페이스홍] 이메일 발송 실패</b>\n\n` +
    `<b>예약 ID:</b> <code>${escapeTg(reservation.id)}</code>\n` +
    `<b>예약자:</b> ${escapeTg(reservation.name)}\n` +
    `<b>대관 날짜:</b> ${escapeTg(reservation.rental_date)}\n` +
    `<b>공간:</b> ${venueName}\n\n` +
    `<b>오류 메시지:</b>\n<code>${escapeTg(errorMessage)}</code>\n\n` +
    `<b>발생 시각:</b> ${timestamp}`
  );
}

/**
 * 이메일 발송 실패 시 Telegram 개인 DM으로 알림 전송
 * @param {object} reservation - Supabase에서 조회한 예약 레코드
 * @param {string} errorMessage - 이메일 발송 실패 오류 메시지
 */
export async function sendEmailFailureAlert(reservation, errorMessage) {
  const config = getTelegramConfig();
  if (!config) return; // 환경변수 미설정 → 조용히 건너뜀

  const text = buildEmailFailureMessage(reservation, errorMessage);
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Telegram] 알림 발송 실패 (HTTP', response.status, '):', body);
    } else {
      console.log('[Telegram] 이메일 실패 알림 발송 완료 (예약 id:', reservation.id, ')');
    }
  } catch (err) {
    // Telegram 자체 장애가 서버에 영향을 주면 안 됨 — 로그만 남기고 종료
    console.error('[Telegram] 알림 발송 중 예외 발생:', err.message);
  }
}
