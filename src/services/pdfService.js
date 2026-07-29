import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'Operator.Spacehong@gmail.com';
const FONT_REGULAR = path.join(__dirname, '../assets/fonts/NotoSansKR-Regular.otf');
const FONT_BOLD    = path.join(__dirname, '../assets/fonts/NotoSansKR-Bold.otf');

const VENUE_LABELS = {
  performance: '공연장',
  studio:      '스튜디오',
  event:       '행사장',
};

const OPTION_LABELS = {
  opt_extra_capacity:   { label: '수용인원 50명 이상',          price: 100000 },
  opt_multitrack:       { label: '멀티트랙 녹음',              price: 100000 },
  opt_personal_monitor: { label: '퍼스널 모니터 / 인이어',      price: 100000 },
  opt_extra_operator:   { label: '추가 오퍼레이터',            price: null   },
  opt_drum_cleanup:     { label: '무대 드럼 정리',             price: 100000 },
  opt_bar_operation:    { label: '바 운영',                    price: 0      },
  opt_prompter:         { label: '프롬프터',                   price: 0      },
  opt_tax_invoice:      { label: '세금계산서 발행',             price: 0      },
};

function formatKRW(amount) {
  const man = amount / 10000;
  return `${man % 1 === 0 ? man : man.toFixed(1)}만원`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}요일)`;
}

function venueVars(venue) {
  const isStudio = venue === 'studio';
  const isEvent  = venue === 'event';
  return {
    isStudio,
    isEvent,
    planDoc:      isStudio ? '촬영계획서' : isEvent ? '행사계획서' : '공연계획서',
    activityWord: isStudio ? '촬영'      : isEvent ? '행사'      : '공연',
    activitySubj: isStudio ? '촬영이'    : isEvent ? '행사가'    : '공연이',
    hasBar:       !isStudio,
  };
}

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// ─── Helper writers ─────────────────────────────────────────────────────────

const ML = 60; // left margin — matches makeDoc()

function makeDoc() {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: ML, right: 60 },
    autoFirstPage: true,
  });
}

/** x 커서를 항상 좌측 마진으로 리셋 */
function resetX(doc) {
  doc.x = ML;
}

function header(doc, title, subtitle) {
  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.rect(ML, doc.page.margins.top, W, 52).fill('#111111');
  doc.fillColor('#ffffff')
    .font(FONT_BOLD).fontSize(16)
    .text('SPACE HONG', ML, doc.page.margins.top + 10, { width: W, align: 'center' });
  doc.font(FONT_REGULAR).fontSize(10).fillColor('#aaaaaa')
    .text(title, ML, doc.y, { width: W, align: 'center' });
  resetX(doc);
  doc.fillColor('#000000').moveDown(2);
  if (subtitle) {
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#555555')
      .text(subtitle, ML, doc.y, { width: W, align: 'center' });
    resetX(doc);
    doc.fillColor('#000000').moveDown(1);
  }
}

function sectionTitle(doc, text, W) {
  resetX(doc);
  doc.moveDown(0.5)
    .font(FONT_BOLD).fontSize(10).fillColor('#111111')
    .text(text, ML, doc.y, { width: W })
    .moveDown(0.2);
  resetX(doc);
}

function body(doc, text, W) {
  resetX(doc);
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#333333')
    .text(text, ML, doc.y, { width: W, lineGap: 2 })
    .moveDown(0.1);
  resetX(doc);
}

function note(doc, text, W) {
  resetX(doc);
  doc.font(FONT_REGULAR).fontSize(8.5).fillColor('#555555')
    .text(text, ML, doc.y, { width: W, lineGap: 2 })
    .moveDown(0.1);
  resetX(doc);
}

function listItem(doc, text, W, ordered, idx) {
  const bullet = ordered ? `${idx}. ` : '· ';
  doc.font(FONT_REGULAR).fontSize(9).fillColor('#333333')
    .text(`${bullet}${text}`, ML + 10, doc.y, { width: W - 10, lineGap: 2 })
    .moveDown(0.05);
  resetX(doc);
}

function divider(doc, W) {
  resetX(doc);
  doc.moveDown(0.4)
    .moveTo(ML, doc.y)
    .lineTo(ML + W, doc.y)
    .strokeColor('#eeeeee').lineWidth(0.5).stroke()
    .moveDown(0.4);
  resetX(doc);
}

// ─── 견적내역서 ──────────────────────────────────────────────────────────────

export async function buildQuotePdf(reservation) {
  const doc = makeDoc();
  const W   = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  header(doc, '견적내역서', `생성일: ${formatDate(new Date().toISOString().slice(0,10))}`);

  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;

  // ── 예약 정보 ──
  sectionTitle(doc, '예약 정보', W);
  divider(doc, W);

  const infoRows = [
    ['예약 공간',  venueName],
    ['대관 날짜',  formatDate(reservation.rental_date)],
    ['대관 시간',  `${reservation.start_time} ~ ${reservation.end_time} (${reservation.rental_hours}시간)`],
    ['예약자',    reservation.name + (reservation.organization ? ` (${reservation.organization})` : '')],
    ['연락처',    reservation.phone],
    ['이메일',    reservation.email],
  ];

  for (const [label, value] of infoRows) {
    const startY = doc.y;
    doc.font(FONT_BOLD).fontSize(9).fillColor('#888888')
      .text(label, ML, startY, { width: W * 0.3 });
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#111111')
      .text(value, ML + W * 0.32, startY, { width: W * 0.68 });
    resetX(doc);
    doc.moveDown(0.15);
  }

  divider(doc, W);

  // ── 추가 옵션 ──
  sectionTitle(doc, '추가 옵션 견적', W);
  divider(doc, W);

  let hasOptions = false;
  for (const [key, meta] of Object.entries(OPTION_LABELS)) {
    if (!reservation[key]) continue;
    hasOptions = true;

    let priceText = '포함';
    if (key === 'opt_extra_operator' && reservation.opt_extra_operator_hours) {
      const fee = 20000 * reservation.opt_extra_operator_hours;
      priceText = `+${formatKRW(fee)} (${reservation.opt_extra_operator_hours}시간)`;
    } else if (meta.price > 0) {
      priceText = `+${formatKRW(meta.price)}`;
    }

    const startY = doc.y;
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#333333')
      .text(meta.label, ML, startY, { width: W * 0.7 });
    doc.font(FONT_BOLD).fontSize(9).fillColor('#111111')
      .text(priceText, ML + W * 0.72, startY, { width: W * 0.28, align: 'right' });
    resetX(doc);
    doc.moveDown(0.2);
  }

  if (!hasOptions) {
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#888888')
      .text('선택된 추가 옵션 없음', { width: W });
    doc.moveDown(0.2);
  }

  divider(doc, W);

  if ((reservation.additional_price || 0) > 0) {
    const startY = doc.y;
    doc.font(FONT_BOLD).fontSize(11).fillColor('#111111')
      .text('추가 옵션 합계', ML, startY, { width: W * 0.7 });
    doc.font(FONT_BOLD).fontSize(11).fillColor('#111111')
      .text(formatKRW(reservation.additional_price), ML + W * 0.72, startY, { width: W * 0.28, align: 'right' });
    resetX(doc);
    doc.moveDown(0.5);
  }

  note(doc, '* 기본 대관료는 예약 일정 및 테크라이더 확인 후 최종 안내됩니다.', W);
  note(doc, '* 세금계산서 발행 또는 카드 결제 시 부가세 10%가 별도 부과됩니다.', W);

  // ── Footer ──
  doc.moveDown(2);
  divider(doc, W);
  doc.font(FONT_REGULAR).fontSize(8).fillColor('#888888')
    .text('문의: ' + CONTACT_EMAIL + '  |  SPACE HONG · 서울특별시 마포구', { width: W, align: 'center' });

  return docToBuffer(doc);
}

// ─── 이용규정 계약서 ──────────────────────────────────────────────────────────

export async function buildContractPdf(reservation) {
  const doc = makeDoc();
  const W   = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;
  const { isStudio, isEvent, planDoc, activityWord, activitySubj, hasBar } = venueVars(reservation.venue_type);

  header(doc, `${venueName} 이용규정 및 계약서`);

  // ── Preamble ──
  body(doc,
    '본 문서는 스페이스홍 대관 이용과 관련하여 대관자와 스페이스홍 사이의 이용 조건, 환불 기준, 안전관리, ' +
    '손해배상 및 책임 범위를 정하기 위한 대관 이용규정 및 안내사항입니다.', W);
  body(doc,
    '대관자는 아래에 기재된 대관자 정보, 대관 일정, 대관 시간, 대관료, 추가 신청 항목 및 기타 예약 내용을 ' +
    '확인하였으며, 본 이용규정 및 안내사항이 해당 대관계약의 일부를 구성함에 동의합니다.', W);
  divider(doc, W);

  // ─ 예약자 요약 ─
  const summaryRows = [
    ['예약자', reservation.name + (reservation.organization ? ` (${reservation.organization})` : '')],
    ['대관 공간', venueName],
    ['대관 날짜', formatDate(reservation.rental_date)],
    ['대관 시간', `${reservation.start_time} ~ ${reservation.end_time} (${reservation.rental_hours}시간)`],
  ];
  for (const [label, value] of summaryRows) {
    const sy = doc.y;
    doc.font(FONT_BOLD).fontSize(9).fillColor('#888888')
      .text(label, ML, sy, { width: W * 0.28 });
    doc.font(FONT_REGULAR).fontSize(9).fillColor('#111111')
      .text(value, ML + W * 0.30, sy, { width: W * 0.70 });
    resetX(doc);
    doc.moveDown(0.15);
  }
  divider(doc, W);

  // ═══ 제1부 ═══
  sectionTitle(doc, '제1부 대관 이용규정 및 동의사항', W);

  // 제1조
  sectionTitle(doc, '제1조 예약 확정, 결제 및 대관 시간', W);
  body(doc, '예약은 대관자가 예약서 또는 계약서를 제출한 후, 스페이스홍 운영자의 확인 안내를 거쳐 대관료 및 청소보증금 입금이 확인된 시점에 최종 확정됩니다.', W);
  note(doc, '※ 예약 확정 전에는 해당 일정이 보장되지 않으며, 동일 일정에 대한 다른 예약 또는 문의가 진행될 수 있습니다.', W);
  body(doc, '세금계산서 발행 또는 카드 결제를 요청하는 경우 부가세 10%가 별도로 부과됩니다.', W);
  if (isStudio) {
    body(doc, '촬영 준비, 장비 세팅, 리허설(필요 시), 촬영 진행, 정리 및 철수 시간은 모두 대관 시간에 포함됩니다.', W);
  } else if (isEvent) {
    body(doc, '행사 준비, 장비 세팅, 리허설(필요 시), 행사 진행, 정리 및 철수 시간은 모두 대관 시간에 포함됩니다.', W);
  } else {
    body(doc, '공연 준비, 장비 세팅, 리허설, 관객 입장 준비, 공연 진행, 정리 및 철수 시간은 모두 대관 시간에 포함됩니다.', W);
  }
  body(doc, `대관자는 ${activityWord} 진행에 필요한 시간을 충분히 고려하여 대관 시간을 예약해야 합니다. 대관 시간 부족으로 인해 발생하는 ${activityWord} 지연, 리허설 부족, 철수 지연 등은 대관자 책임입니다.`, W);
  body(doc, '대관 시간이 초과되는 경우 시간당 요금 기준에 따라 추가 요금이 발생합니다.', W);
  body(doc, '대관자는 예약 확정 및 서명 완료 시 본 이용규정 및 안내사항의 모든 내용에 동의한 것으로 봅니다.', W);

  // 제2조
  sectionTitle(doc, '제2조 취소 및 환불 규정', W);
  body(doc, '대관일 기준 45일 전까지는 전액 환불이 가능합니다.', W);
  body(doc, '대관일 기준 45일 이후에는 원칙적으로 취소 및 환불이 불가합니다.', W);
  note(doc, '※ 9월부터 12월까지의 성수기 일정은 예약 확정 후 대관자 사유로 인한 취소, 일정 변경 및 환불이 불가합니다.', W);
  body(doc, '다만 아래 사유에 해당하는 경우에는 예외적으로 환불이 가능합니다.', W);
  [
    '스페이스홍 측 사유로 대관 진행이 불가능한 경우',
    '공간 사용이 객관적으로 불가능한 수준의 시설 안전상 하자가 발생한 경우',
    '천재지변, 재난, 행정명령 등 불가항력으로 대관 진행이 불가능한 경우',
    '기타 스페이스홍이 환불 사유로 인정하는 경우',
  ].forEach((t, i) => listItem(doc, t, W, true, i + 1));
  body(doc, '다음과 같은 대관자 측 사유로 인한 취소는 환불 대상에 포함되지 않습니다.', W);
  const cancelReasons = ['단순 변심'];
  if (!isStudio) { cancelReasons.push('관객 수 감소 / 티켓 판매 부진', '출연진 변경'); }
  cancelReasons.push(`${activityWord} 준비 미흡`, '개인 사정 / 외부업체 사정', '일정 착오');
  cancelReasons.forEach((t) => listItem(doc, t, W, false));

  // 제3조
  sectionTitle(doc, '제3조 스페이스홍 측 사유로 인한 대관 불가 및 책임 범위', W);
  body(doc, '스페이스홍의 운영상 사정, 시설 문제, 설비 문제, 장비 문제, 이중예약 또는 기타 스페이스홍 측 사유로 인해 예약된 일정의 대관 이용이 불가능한 경우, 스페이스홍은 대관자가 이미 지급한 대관료 및 청소보증금을 전액 환불합니다.', W);
  body(doc, '이 경우 스페이스홍의 책임은 대관자가 실제 지급한 대관료 및 청소보증금의 전액 환불로 한정됩니다.', W);
  note(doc, '※ 스페이스홍은 위 환불을 초과하여 발생하는 어떠한 손해, 비용, 보상, 위약금, 손해배상 또는 제3자 청구에 대해서도 책임지지 않습니다.', W);
  body(doc, '이에 따라 다음 비용 또는 손해는 스페이스홍의 배상 또는 보상 대상에 포함되지 않습니다.', W);
  const liabilityExclusions = [];
  if (!isStudio) liabilityExclusions.push('티켓 환불, 관객 보상, 예매 수수료');
  liabilityExclusions.push(
    '출연자, 스태프, 촬영팀, 외부업체 비용',
    '홍보비, 광고비, 디자인비, 인쇄비, 콘텐츠 제작비',
    '장비 대여비, 운송비, 설치비, 철거비',
    '교통비, 숙박비, 식비 등 부대비용',
    '기대수익, 매출손실, 영업손실, 기회손실',
    `${activityWord} 취소 또는 변경으로 인한 평판 손상, 민원, 정신적 손해`,
    '제3자 청구 및 기타 대관료·청소보증금을 초과하는 간접손해',
  );
  liabilityExclusions.forEach((t, i) => listItem(doc, t, W, true, i + 1));
  body(doc, '스페이스홍 측 사유로 대관 이용이 불가능한 경우, 스페이스홍은 가능한 범위 내에서 대체 일정을 제안할 수 있습니다. 대체 일정을 원하지 않거나 일정 조율이 어려운 경우 대관료 및 청소보증금 전액 환불로 정산합니다.', W);

  // 제4조
  sectionTitle(doc, `제4조 공간 사용, ${planDoc}, 장비 및 운영 인력`, W);
  body(doc, `${isStudio ? '공간' : '무대'} 및 기본 장비 세팅은 사전에 제출된 ${planDoc}와 사전 협의 내용을 기준으로 당일 운영 인력이 지원합니다.`, W);
  body(doc, `대관자는 ${activityWord} 예정일 최소 7일 전까지 스페이스홍이 요청하는 ${planDoc}를 제출해야 합니다.`, W);
  body(doc, `${planDoc}의 세부 양식, 작성 방식 및 제출 안내는 스페이스홍이 별도 이메일로 안내합니다.`, W);
  note(doc, `※ ${planDoc}가 제출되지 않거나 늦게 제출되는 경우 장비 준비, 운영 인력 배정,${!isStudio ? ' 리허설 진행,' : ''} 음향·조명 운영 등에 제한이 발생할 수 있습니다.`, W);
  body(doc, `${planDoc} 미제출, 지연 제출 또는 부정확한 내용 제출로 인해 발생하는 문제 및 ${activityWord} 진행상 불이익에 대해서는 스페이스홍이 책임지지 않습니다.`, W);
  body(doc, '공간 내 기본 오브제 및 물품은 사용 가능합니다. 단, 별도 유료 항목 또는 사전 승인이 필요한 장비와 물품은 제외됩니다.', W);
  body(doc, '공간에 설치물, 구조물, 장식물, 현수막, 배너, 촬영 장비, 외부 장비 등을 반입하려는 경우 반드시 사전에 문의하고 승인을 받아야 합니다.', W);
  body(doc, `${activityWord} 성격, 장비 사용량, 운영 난이도에 따라 스페이스홍은 추가 운영 인력 또는 오퍼레이터의 배정을 요구할 수 있으며, 해당 비용은 대관자가 부담합니다.`, W);

  // 제5조
  sectionTitle(doc, '제5조 원상복구, 청소 및 보증금', W);
  body(doc, '청소보증금 10만원은 대관료와 함께 선입금합니다.', W);
  body(doc, `${activityWord} 종료 후 대관자는 쓰레기 처리, 음식물 정리, 반입물품 회수, 대기공간 정리, 기본 원상복구를 완료해야 합니다.`, W);
  if (isStudio) {
    body(doc, '사용 후에는 모든 배치, 물품, 장식, 쓰레기, 반입물품을 퇴장 전 원상복구해야 합니다.', W);
  } else {
    body(doc, '사용 후에는 무대 기본 세팅을 제외한 모든 배치, 물품, 장식, 쓰레기, 반입물품을 퇴장 전 원상복구해야 합니다.', W);
  }
  body(doc, '청소보증금은 대관 종료 후 현장 확인을 거쳐 이상이 없을 경우 영업일 기준 3일 이내 환급됩니다.', W);
  body(doc, '쓰레기 미처리, 과도한 오염, 냄새·액체·음식물·주류 등으로 인한 추가 청소, 시설·장비·소품 파손 또는 분실, 원상복구 미이행 등이 발생한 경우 청소보증금에서 해당 비용을 차감하거나 추가 비용을 청구할 수 있습니다.', W);

  // 제6조
  sectionTitle(doc, '제6조 안전사고, 금지행위 및 사고 발생 시 절차', W);
  body(doc, `대관자는 ${activityWord} 진행 중 참가자 및 외부 스태프의 안전관리에 관한 1차 책임을 부담합니다.`, W);
  body(doc, '다음 행위는 금지됩니다.', W);
  [
    '화기, 폭발성·인화성 물질 사용',
    '무단 타공, 못질, 강한 테이프 부착',
    '승인되지 않은 전력 증설 또는 고전력 장비 사용',
    '통로, 비상구, 계단, 출입구 점유',
    '시설, 장비, 가구, 소품의 무단 이동 또는 외부 반출',
    `법령에 위반되는 ${activityWord}, 판매, 촬영, 홍보 행위`,
    '과도한 소음, 진동, 냄새, 연기 발생',
    '운영자의 사전 승인 없는 주류 판매, 음식 판매, 물품 판매',
    '시설 또는 장비를 훼손할 수 있는 행위',
    '운영자의 안내 또는 중단 요청에 불응하는 행위',
  ].forEach((t) => listItem(doc, t, W, false));
  body(doc, '위반 시 스페이스홍은 즉시 시정, 이용 제한 또는 행사 중단을 요청할 수 있습니다.', W);
  body(doc, '사고, 파손, 분실, 부상, 민원, 장비 이상, 안전 문제가 발생한 경우 대관자는 즉시 스페이스홍 운영자에게 통보하고, 현장을 임의로 훼손하지 않아야 합니다.', W);
  body(doc, '스페이스홍은 시설 자체의 하자, 고정설비 결함, 전기·구조물 문제 또는 운영자의 책임 있는 사유로 인해 발생한 손해에 대해 관련 법령의 범위 내에서 책임을 부담합니다.', W);

  // 제7조
  sectionTitle(doc, '제7조 저작권, 초상권 및 법령 준수', W);
  body(doc, `대관자가 ${activityWord}, 촬영, 녹음, 녹화, 송출, 홍보물 제작, 온라인 게시 등을 진행하는 경우, 저작권·초상권·음원 사용권·공연권·상표권·인허가 등의 확인 및 책임은 대관자에게 있습니다.`, W);
  body(doc, `대관자가 배포한 홍보물, 티켓, 게시물, 영상, 사진, ${activityWord} 콘텐츠 등으로 인해 발생하는 법적 문제, 민원, 제3자 청구는 대관자가 책임집니다.`, W);
  body(doc, '스페이스홍의 상호, 로고, 공간 이미지 등을 홍보물에 사용하는 경우 사실과 다르게 표시해서는 안 됩니다.', W);
  body(doc, `대관자는 ${activityWord} 진행과 관련하여 관련 법령, 저작권 규정, 주류 관련 규정, 안전 기준, 소음 기준 등을 준수해야 합니다.`, W);

  // 제8조
  sectionTitle(doc, '제8조 계약 해지 및 이용 제한', W);
  body(doc, `대관자가 본 이용규정을 위반하거나, 허위 정보를 제공하거나, 사전 협의 없이 계약 내용과 현저히 다른 ${activityWord}를 진행하는 경우 스페이스홍은 계약을 해지하거나 이용을 제한할 수 있습니다.`, W);
  body(doc, `안전사고 우려, 법령 위반, 사전 승인 없는 판매 행위, 운영자 안내 불응, 대관 내용 상이, 심각한 민원 발생 등의 경우 ${activityWord} 전 또는 진행 중이라도 이용 제한, 중단 또는 계약 해지를 할 수 있습니다.`, W);
  body(doc, `대관자의 책임 있는 사유로 계약이 해지되거나 ${activityWord}가 중단되는 경우, 대관료 및 보증금 환불은 제한될 수 있으며, 발생한 손해는 대관자가 책임집니다.`, W);

  // 제9조
  sectionTitle(doc, '제9조 개인정보 수집 및 이용', W);
  body(doc, '대관자는 예약, 계약 이행, 대관 진행, 정산, 환불, 사고 처리 및 분쟁 대응을 위해 스페이스홍이 개인정보를 수집·이용하는 것에 동의합니다.', W);
  body(doc, '수집·이용 항목: 성명 또는 단체명, 연락처, 이메일, 대관 일정 및 대관 내용, 정산 및 환불에 필요한 정보', W);
  body(doc, `수집·이용 목적: 예약 확인 및 계약 체결, 대관 진행 및 운영 안내, 대관료 정산 및 환불, ${planDoc} 안내 및 운영 협의, 사고 처리 및 분쟁 대응`, W);
  body(doc, '개인정보는 대관 종료 및 정산 완료 후 관련 법령에 따라 필요한 기간 동안 보관될 수 있습니다. 동의를 거부할 수 있으나 이 경우 예약 및 대관 진행이 제한될 수 있습니다.', W);

  // ═══ 제2부 ═══
  divider(doc, W);
  sectionTitle(doc, '제2부 대관 안내사항', W);

  // 1. 체크리스트
  sectionTitle(doc, '1. 대관 전 준비 체크리스트', W);
  body(doc, `원활한 ${activityWord} 진행을 위해 아래 사항을 미리 확인해주시기 바랍니다.`, W);
  const checklist = [
    `${planDoc} 제출 — ${activityWord} 예정일 최소 7일 전`,
    '외부 장비 반입 여부 사전 공유',
    '음식 반입 여부 사전 문의',
  ];
  if (hasBar) checklist.push('주류 또는 바 운영 여부 사전 신청');
  checklist.push(
    '추가 운영 인력 또는 오퍼레이터 필요 여부 확인',
    isStudio ? '음향·조명 및 공간 구성 요청사항 확인' : '좌석 배치, 무대 구성, 영상·음향·조명 요청사항 확인',
    '음식물 쓰레기 발생 시 음식물 쓰레기 봉투 지참',
    `대관 시간 내 ${!isStudio ? '리허설, ' : ''}${activityWord}, 정리 및 철수 완료`,
  );
  checklist.forEach((t) => listItem(doc, t, W, false));

  // 2. 계획서 및 공간 세팅
  sectionTitle(doc, `2. ${planDoc} 및 공간 세팅 안내`, W);
  body(doc, `${planDoc}는 ${activityWord} 예정일 최소 7일 전까지 제출해주시기 바랍니다.`, W);
  body(doc, `${planDoc}의 세부 양식, 작성 방식 및 제출 안내는 스페이스홍이 이메일로 별도 안내드립니다.`, W);
  body(doc, '제출 이메일: ' + CONTACT_EMAIL, W);
  body(doc, `공간 기본 세팅은 사전에 제출된 ${planDoc}를 기준으로 준비됩니다.`, W);
  body(doc, `공간 꾸미기${isStudio ? ', 촬영 진행,' : ', 좌석 설치, 리허설, 공연 진행,'} 정리 및 철수는 모두 대관 시간 내에 진행됩니다.`, W);
  body(doc, '설치물, 장식물, 현수막, 배너, 외부 장비 등이 필요한 경우 사전에 문의해주시기 바랍니다.', W);

  // 3. 장비 및 운영
  sectionTitle(doc, '3. 장비 및 운영 안내', W);
  body(doc, `스페이스홍의 기본 장비는 ${planDoc}와 사전 협의 내용을 기준으로 준비됩니다.`, W);
  body(doc, `${activityWord} 성격, 규모, 장비 사용량, 운영 난이도에 따라 추가 운영 인력 또는 오퍼레이터가 필요할 수 있으며, 이 경우 별도 비용이 발생할 수 있습니다.`, W);
  body(doc, '외부 장비를 반입하는 경우 사전에 공유해주시기 바랍니다.', W);
  body(doc, '대관자가 별도로 신청한 유료 추가 항목이 현장 사정으로 제공되지 못하는 경우, 해당 항목에 한하여 정산이 진행될 수 있습니다.', W);

  // 4. 바 운영 (공연장/행사장)
  if (hasBar) {
    sectionTitle(doc, '4. 내부 카페 및 바 운영 안내', W);
    body(doc, '내부 카페 및 바 운영은 사전 신청 시 가능합니다.', W);
    body(doc, '20만원 이상 구매 시 바 운영 인건비 없이 운영 가능합니다.', W);
    body(doc, '운영 방식: 티켓을 통한 프리드링크 제공, 또는 관객 직접 결제 방식 모두 가능합니다.', W);
    body(doc, '판매를 원하는 물품이 있는 경우 사전에 요청해주시기 바랍니다.', W);
    body(doc, '주류 구매 및 제공 시에는 성인 확인이 필요하며, 신분증 확인이 불가한 경우 주류 구매 또는 제공이 제한됩니다.', W);
  }

  // 주차 (5 or 4)
  sectionTitle(doc, `${hasBar ? '5' : '4'}. 주차 및 음식 반입 안내`, W);
  body(doc, '대관 시 차량 1대 주차가 가능합니다. 추가 차량은 주변 도보 5분 거리의 유료주차장을 이용해주시기 바랍니다.', W);
  body(doc, '외부 음식 반입은 사전 문의가 필요합니다.', W);
  body(doc, '음식물 쓰레기가 발생할 예정인 경우 음식물 쓰레기 봉투를 직접 지참해주시기 바랍니다.', W);

  // 퇴장 (6 or 5)
  sectionTitle(doc, `${hasBar ? '6' : '5'}. 퇴장 전 정리 및 보증금 환급 안내`, W);
  body(doc, `${activityWord} 종료 후 아래 사항을 완료한 후 퇴장해주시기 바랍니다.`, W);
  const exitList = ['쓰레기 처리 및 음식물 정리', '반입물품 회수 및 원상복구'];
  if (!isStudio) exitList.push('객석 및 대기공간 정리');
  if (isStudio)  exitList.push('대기공간 정리');
  exitList.forEach((t) => listItem(doc, t, W, false));
  body(doc, '현장 확인 후 이상이 없을 경우 청소보증금은 영업일 기준 3일 이내 환급됩니다.', W);

  // 문의 (7 or 6)
  sectionTitle(doc, `${hasBar ? '7' : '6'}. 문의`, W);
  body(doc, '대관 진행과 관련하여 궁금한 사항이 있으시면 언제든 스페이스홍으로 문의해주시기 바랍니다.', W);
  body(doc, '문의 이메일: ' + CONTACT_EMAIL, W);

  body(doc, `최고의 ${activitySubj} 될 수 있도록 스페이스홍이 최선을 다해 돕겠습니다.`, W);

  // ─ 서명 ─
  divider(doc, W);
  sectionTitle(doc, '대관자 서명 및 동의', W);

  const agreedAt = reservation.terms_agreed_at
    ? formatDate(new Date(reservation.terms_agreed_at).toISOString().slice(0, 10))
    : formatDate(new Date().toISOString().slice(0, 10));

  body(doc, `위 이용규정을 모두 읽고 동의합니다.  (동의일: ${agreedAt})`, W);
  doc.moveDown(0.5);

  if (reservation.signature_data) {
    try {
      const base64 = reservation.signature_data.replace(/^data:image\/\w+;base64,/, '');
      const sigBuffer = Buffer.from(base64, 'base64');
      doc.image(sigBuffer, { width: 180 });
    } catch {
      body(doc, '[서명 이미지 변환 실패]', W);
    }
  } else {
    body(doc, '[서명 없음]', W);
  }

  doc.moveDown(0.5);
  body(doc, `서명자: ${reservation.name}`, W);

  // Footer
  doc.moveDown(2);
  divider(doc, W);
  doc.font(FONT_REGULAR).fontSize(8).fillColor('#888888')
    .text('문의: ' + CONTACT_EMAIL + '  |  SPACE HONG · 서울특별시 마포구', { width: W, align: 'center' });

  return docToBuffer(doc);
}
