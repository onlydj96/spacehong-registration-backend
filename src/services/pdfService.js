import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { VENUE_LABELS } from '../utils/constants.js';
import { OPTION_LABELS, formatDate } from '../utils/documentHelpers.js';
import { getRentalContract } from '../utils/rentalContracts.js';
import { getRefundTable } from '../utils/refundPolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FONT_REGULAR = path.join(__dirname, '../assets/fonts/NotoSansKR-Regular.otf');
const FONT_BOLD    = path.join(__dirname, '../assets/fonts/NotoSansKR-Bold.otf');

// ─── 대관 계약서 PDF ─────────────────────────────────────────────────────────
// 본문은 utils/rentalContracts.js(예약 폼에서 서명한 것과 같은 공용 모듈)로 그리고,
// 끝에 '예약 정보'와 '동의 및 서명'을 붙인다. 예약 확정 메일 첨부와 관리자 다운로드가 함께 쓴다.

// 2026-11 대관 계약서 원본 PDF에서 측정한 여백·글자 크기·줄 간격·색 (A4 595.28 × 841.89pt)
const L = {
  x: 65.5,
  width: 470.5,
  top: 67.2,          // 둘째 쪽부터 본문이 시작하는 높이
  bottom: 752,        // 본문이 내려가지 않는 선 (바닥글 선은 790.87)
  indent: 11,         // 조항 번호 뒤 본문 시작 위치
  bodySize: 8.6,
  lineGap: 2.25,      // 줄 간격 14.7pt
  itemGap: 5.5,       // 조항 사이
  titleGap: 18.7,     // 조 제목 → 첫 조항
  articleGap: 5.8,    // 마지막 조항 → 다음 조 제목 (itemGap 에 더해짐)
  tableRow: 22,
  tableCols: [215.5, 127.5, 127.5],
};

const COLOR = {
  navy: '#19344a',
  title: '#162b3c',
  text: '#26333d',
  muted: '#6d7d8a',
  cellFill: '#e6edf2',
  rowFill: '#f8fafc',
  rowLine: '#e2e8ee',
  headLine: '#b0c3d1',
  footerLine: '#d8e1e9',
};

function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * 단어 단위 줄바꿈 (CSS word-break: keep-all) — pdfkit 은 한글 단어 중간에서도 줄을 바꾸므로
 * 띄어쓰기 기준으로 미리 줄을 나눈다. 한 단어가 폭보다 길 때만 글자 단위로 자른다.
 */
function wrapKeepAll(doc, text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (doc.widthOfString(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (doc.widthOfString(line) > width) {
        let cut = line.length - 1;
        while (cut > 1 && doc.widthOfString(line.slice(0, cut)) > width) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** 쪽 넘김을 관리하는 그리기 도구 — 높이를 재고, 남은 공간이 모자라면 새 쪽에서 그린다 */
function createWriter(doc) {
  const w = {
    y: 0,
    ensure(height) {
      if (w.y + height > L.bottom) {
        doc.addPage({ size: 'A4', margin: 0 });
        w.y = L.top;
      }
    },
    bodyHeight(text, width) {
      doc.font(FONT_REGULAR).fontSize(L.bodySize);
      return doc.heightOfString(wrapKeepAll(doc, text, width), { width: width + 1, lineGap: L.lineGap });
    },
    body(text, x, width, color = COLOR.text) {
      doc.font(FONT_REGULAR).fontSize(L.bodySize).fillColor(color);
      doc.text(wrapKeepAll(doc, text, width), x, w.y, { width: width + 1, lineGap: L.lineGap });
    },
    heading(text) {
      doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR.navy).text(text, L.x, w.y, { lineBreak: false });
    },
  };
  return w;
}

/** 문자열 조항은 번호를 매기고, 환불 표는 번호 없이 그 자리에 둔다 (프론트 ContractDocument 와 같은 규칙) */
function articleBlocks(items) {
  let number = 0;
  return items.map((item) =>
    typeof item === 'string' ? { type: 'item', number: ++number, text: item } : { type: 'refundTable' },
  );
}

const REFUND_TABLE_HEIGHT = L.tableRow * 8; // 머리글 + 7행

function blockHeight(w, block) {
  return block.type === 'item'
    ? w.bodyHeight(block.text, L.width - L.indent)
    : REFUND_TABLE_HEIGHT;
}

function drawRefundTable(doc, w) {
  const { headers, rows } = getRefundTable();
  const colX = L.tableCols.reduce((xs, width, i) => [...xs, xs[i] + width], [L.x]);
  const rowText = (cells, top, font) => {
    doc.font(font).fontSize(8).fillColor('#000000');
    const textTop = top + (L.tableRow - doc.currentLineHeight()) / 2;
    cells.forEach((cell, i) => {
      doc.text(cell, colX[i] + 6, textTop, { width: L.tableCols[i] - 12, lineBreak: false });
    });
  };

  let top = w.y;
  doc.rect(L.x, top, L.width, L.tableRow).fill(COLOR.cellFill);
  rowText(headers, top, FONT_REGULAR);
  doc.moveTo(L.x, top + L.tableRow).lineTo(L.x + L.width, top + L.tableRow)
    .lineWidth(0.65).strokeColor(COLOR.headLine).stroke();

  rows.forEach((cells, i) => {
    top += L.tableRow;
    if (i % 2 === 1) doc.rect(L.x, top, L.width, L.tableRow).fill(COLOR.rowFill);
    rowText(cells, top, FONT_REGULAR);
    if (i < rows.length - 1) {
      doc.moveTo(L.x, top + L.tableRow).lineTo(L.x + L.width, top + L.tableRow)
        .lineWidth(0.25).strokeColor(COLOR.rowLine).stroke();
    }
  });
  w.y = top + L.tableRow;
}

function drawArticle(doc, w, article) {
  const blocks = articleBlocks(article.items);
  // 조 제목이 쪽 끝에 홀로 남지 않도록 첫 조항과 함께 옮긴다
  w.ensure(L.titleGap + blockHeight(w, blocks[0]));
  w.heading(article.title);
  w.y += L.titleGap;

  for (const block of blocks) {
    if (block.type === 'refundTable') {
      w.y += 3.8 - L.itemGap; // 원본: 앞 조항과 표 사이 3.8pt, 표와 다음 조항 사이 7.4pt
      w.ensure(REFUND_TABLE_HEIGHT);
      drawRefundTable(doc, w);
      w.y += 7.4;
      continue;
    }
    const height = blockHeight(w, block);
    w.ensure(height);
    doc.font(FONT_REGULAR).fontSize(L.bodySize).fillColor(COLOR.text)
      .text(`${block.number}.`, L.x, w.y, { lineBreak: false });
    w.body(block.text, L.x + L.indent, L.width - L.indent);
    w.y += height + L.itemGap;
  }
  w.y += L.articleGap;
}

// ─── 예약 정보 · 서명 ───────────────────────────────────────────────────────

/** ISO 시각 → "2026년 11월 24일 (화요일) 15:30" (한국 시간) */
function formatKstDateTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '-';
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return `${formatDate(kst.slice(0, 10))} ${kst.slice(11, 16)}`;
}

function selectedOptionText(reservation) {
  const labels = Object.entries(OPTION_LABELS)
    .filter(([key]) => reservation[key])
    .map(([key, meta]) =>
      key === 'opt_extra_operator' && reservation.opt_extra_operator_hours
        ? `${meta.label} (${reservation.opt_extra_operator_hours}시간)`
        : meta.label,
    );
  // 한 줄에 하나씩 — 쉼표로 이으면 pdfkit이 한글 단어 중간에서 줄을 바꾼다
  return labels.length ? labels.join('\n') : '없음';
}

function signatureImageBuffer(signatureData) {
  if (!signatureData) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(signatureData);
  return match ? Buffer.from(match[2], 'base64') : null;
}

const INFO_LABEL_W = 110;
const INFO_PAD_X = 9;
const INFO_VALUE_W = L.width - INFO_LABEL_W - INFO_PAD_X * 2;

/** 라벨 | 값 표의 행 높이 — 값이 Buffer(서명 이미지)면 row.height */
function infoRowHeights(w, rows) {
  return rows.map((row) =>
    Buffer.isBuffer(row.value)
      ? row.height
      : Math.max(24, w.bodyHeight(row.value, INFO_VALUE_W) + 12),
  );
}

function drawInfoTable(doc, w, rows) {
  const heights = infoRowHeights(w, rows);
  doc.moveTo(L.x, w.y).lineTo(L.x + L.width, w.y).lineWidth(0.65).strokeColor(COLOR.headLine).stroke();

  rows.forEach((row, i) => {
    const rowH = heights[i];
    const valueX = L.x + INFO_LABEL_W + INFO_PAD_X;
    doc.rect(L.x, w.y, INFO_LABEL_W, rowH).fill(COLOR.cellFill);
    const labelH = doc.font(FONT_BOLD).fontSize(L.bodySize).heightOfString(row.label);
    doc.fillColor(COLOR.navy)
      .text(row.label, L.x + INFO_PAD_X, w.y + (rowH - labelH) / 2, { width: INFO_LABEL_W - INFO_PAD_X * 2, lineBreak: false });

    if (Buffer.isBuffer(row.value)) {
      try {
        doc.image(row.value, valueX, w.y + 8, { fit: [Math.min(INFO_VALUE_W, 260), rowH - 16], valign: 'center' });
      } catch {
        doc.font(FONT_REGULAR).fontSize(L.bodySize).fillColor(COLOR.text)
          .text('[서명 이미지를 표시할 수 없습니다]', valueX, w.y + rowH / 2 - 6, { width: INFO_VALUE_W });
      }
    } else {
      const textH = w.bodyHeight(row.value, INFO_VALUE_W);
      const top = w.y;
      w.y = top + (rowH - textH) / 2;
      w.body(row.value, valueX, INFO_VALUE_W);
      w.y = top;
    }

    w.y += rowH;
    doc.moveTo(L.x, w.y).lineTo(L.x + L.width, w.y).lineWidth(0.5).strokeColor(COLOR.rowLine).stroke();
  });
}

const sumHeights = (w, rows) => infoRowHeights(w, rows).reduce((a, b) => a + b, 0);

function drawReservationInfo(doc, w, reservation) {
  const venueName = VENUE_LABELS[reservation.venue_type] || reservation.venue_type;
  const rows = [
    { label: '예약번호', value: String(reservation.id || '').slice(0, 8).toUpperCase() || '-' },
    { label: '대관자', value: reservation.name + (reservation.organization ? ` (${reservation.organization})` : '') },
    { label: '연락처', value: reservation.phone || '-' },
    { label: '이메일', value: reservation.email || '-' },
    { label: '대관 공간', value: venueName },
    { label: '대관 일자', value: formatDate(reservation.rental_date) },
    { label: '대관 시간', value: `${reservation.start_time} ~ ${reservation.end_time} (${reservation.rental_hours}시간)` },
    { label: '추가 옵션', value: selectedOptionText(reservation) },
  ];
  w.ensure(21 + sumHeights(w, rows));
  w.heading('예약 정보');
  w.y += 21;
  drawInfoTable(doc, w, rows);
  w.y += L.itemGap + L.articleGap + 14.7;
}

function drawSignature(doc, w, reservation) {
  const signature = signatureImageBuffer(reservation.signature_data);
  const rows = [
    { label: '동의 일시', value: formatKstDateTime(reservation.terms_agreed_at || reservation.submitted_at) },
    { label: '서명자', value: reservation.name },
    signature
      ? { label: '대관자 서명', value: signature, height: 96 }
      : { label: '대관자 서명', value: '[서명 없음]' },
  ];
  const statement = '대관자는 위 예약 정보와 본 계약서의 내용을 모두 읽고 이해하였으며, 이에 동의하여 서명합니다.';
  const note = '본 서명은 스페이스홍 대관 예약 신청서에서 계약서 내용을 확인한 뒤 전자 서명한 것입니다.';

  w.ensure(21 + w.bodyHeight(statement, L.width) + 9 + sumHeights(w, rows) + 30);
  w.heading('동의 및 서명');
  w.y += 21;
  w.body(statement, L.x, L.width);
  w.y += w.bodyHeight(statement, L.width) + 9;
  drawInfoTable(doc, w, rows);
  w.y += 10;
  doc.font(FONT_REGULAR).fontSize(7.6).fillColor(COLOR.muted).text(note, L.x, w.y, { width: L.width });
}

/** 모든 쪽에 원본과 같은 바닥글 — 'SPACE HONG | 공연 대관 계약서' + 쪽 번호 */
function drawFooters(doc, title) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.moveTo(56.69, 790.87).lineTo(538.58, 790.87).lineWidth(1).strokeColor(COLOR.footerLine).stroke();
    doc.font(FONT_REGULAR).fontSize(7.2).fillColor(COLOR.muted)
      .text(`SPACE HONG  |  ${title}`, 59.5, 797.9, { lineBreak: false })
      .text(String(i + 1), 438.58, 797.9, { width: 100, align: 'right', lineBreak: false });
  }
}

/** 서명 포함 대관 계약서 PDF (예약 확정 메일 첨부 · 관리자 다운로드 공용) */
export async function buildContractPdf(reservation) {
  const contract = getRentalContract(reservation.venue_type);
  if (!contract) {
    throw new Error(`[PDF] 알 수 없는 대관 유형: ${reservation.venue_type}`);
  }

  // 여백 0 + 직접 쪽 넘김: 바닥글을 그려도 pdfkit이 새 쪽을 만들지 않는다
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    info: { Title: `${contract.title} - ${reservation.name}`, Author: 'SPACE HONG' },
  });
  const w = createWriter(doc);

  doc.font(FONT_BOLD).fontSize(12).fillColor(COLOR.navy).text('SPACE HONG', L.x, 67.9, { lineBreak: false });
  doc.font(FONT_BOLD).fontSize(17).fillColor(COLOR.title).text(contract.title, L.x, 91.9, { lineBreak: false });
  w.y = 123.2;
  w.body(contract.intro, L.x, L.width);
  w.y = 163.5;

  for (const article of contract.articles) {
    drawArticle(doc, w, article);
  }
  drawReservationInfo(doc, w, reservation);
  drawSignature(doc, w, reservation);
  drawFooters(doc, contract.title);

  return docToBuffer(doc);
}
