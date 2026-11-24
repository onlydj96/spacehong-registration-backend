/**
 * 예약 확정 메일에 그대로 첨부하는 대관 유형별 파일 (src/assets/docs)
 *
 * - 계약서는 파일이 아니라 utils/rentalContracts.js 로 만든다 (pdfService.buildContractPdf).
 * - 안내사항·큐시트·테크라이더는 원본 그대로 첨부한다. 파일을 교체할 때는 같은 이름으로 덮어쓴다.
 * - 고객이 받는 파일명은 *Name 값이다. 관리자 확정 확인 문구(프론트 AdminReservationDetail)도 이 목록과 같게 유지.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../assets/docs');

export const RENTAL_DOCS = {
  performance: {
    label: '공연',
    guide: 'guide-performance.pdf',
    guideName: 'SPACE_HONG_공연_안내사항.pdf',
    cueSheet: 'cuesheet-performance.xlsx',
    cueSheetName: '스페이스홍 공연 큐시트.xlsx',
    // 테크라이더는 공연 대관만 첨부
    techRider: 'techrider-performance.pptx',
    techRiderName: '스페이스홍 공연 테크라이더.pptx',
  },
  studio: {
    label: '스튜디오',
    guide: 'guide-studio.pdf',
    guideName: 'SPACE_HONG_스튜디오_안내사항.pdf',
    cueSheet: 'cuesheet-studio.xlsx',
    cueSheetName: '스페이스홍 촬영 큐시트.xlsx',
  },
  event: {
    label: '행사',
    guide: 'guide-event.pdf',
    guideName: 'SPACE_HONG_행사_안내사항.pdf',
    cueSheet: 'cuesheet-event.xlsx',
    cueSheetName: '스페이스홍 행사 큐시트.xlsx',
  },
};

/** 대관 유형의 첨부 묶음 — 알 수 없는 유형이면 다른 유형 서류를 보내지 않도록 에러 */
export function getRentalDocs(venueType) {
  const docs = RENTAL_DOCS[venueType];
  if (!docs) {
    throw new Error(`[Docs] 알 수 없는 대관 유형: ${venueType}`);
  }
  return docs;
}

// 파일은 배포 후 바뀌지 않으므로 처음 읽은 내용을 재사용 (전체 약 2MB)
const fileCache = new Map();

export function loadDocFile(fileName) {
  if (!fileCache.has(fileName)) {
    const pending = readFile(path.join(DOCS_DIR, fileName)).catch((err) => {
      fileCache.delete(fileName);
      throw err;
    });
    fileCache.set(fileName, pending);
  }
  return fileCache.get(fileName);
}
