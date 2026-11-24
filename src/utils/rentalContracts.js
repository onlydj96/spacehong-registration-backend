/**
 * 대관 계약서 본문 (공연 · 스튜디오 · 행사)
 *
 * [공용 파일] 프론트엔드 src/utils/constants/rentalContracts.js 와 백엔드 src/utils/rentalContracts.js 는
 * 내용이 똑같아야 한다. 고칠 때는 한쪽을 고친 뒤 파일을 통째로 다른 쪽에 복사한다.
 *  - 프론트엔드: 예약 폼 계약서 단계(TermsPage), 관리자 계약서 화면 — components/ContractDocument
 *  - 백엔드: 예약 확정 메일·관리자 다운로드용 계약서 PDF (pdfService.buildContractPdf)
 *
 * 시스템 규칙에서 만드는 문구
 *  - 제1조 최소 대관 시간 ← rentalRules.js RENTAL_RULES.minHours (요금표의 최소 시간과 같다)
 *  - 제2조 환불 표·시즌 구분 ← refundPolicy.js
 *
 * items: 문자열은 번호 매긴 조항, REFUND_TABLE_ITEM 은 그 자리에 들어가는 환불 기준 표(번호 없음).
 */
import { RENTAL_RULES } from './rentalRules.js';
import { REFUND_POLICY_SEASONS, REFUND_POLICY_SEASON_BASIS } from './refundPolicy.js';

export const REFUND_TABLE_ITEM = { refundTable: true };

const DAY_GROUPS = [
  { id: 'weekday', label: '월~목' },
  { id: 'weekend', label: '금~일' },
];

/** 예: '최소 5시간(성수기 10~12월 금~일은 최소 7시간)' — 일반기 월~목 시간을 기본으로 두고 다른 경우만 덧붙인다 */
export function minHoursText(venueType) {
  const hours = RENTAL_RULES.minHours[venueType];
  const base = hours.regular.weekday;
  const exceptions = [];
  for (const season of REFUND_POLICY_SEASONS) {
    const seasonHours = hours[season.id];
    const seasonName = `${season.label} ${season.period}`;
    const differs = DAY_GROUPS.filter((day) => seasonHours[day.id] !== base);
    if (differs.length === DAY_GROUPS.length && seasonHours.weekday === seasonHours.weekend) {
      exceptions.push(`${seasonName}은 최소 ${seasonHours.weekday}시간`);
    } else {
      differs.forEach((day) => exceptions.push(`${seasonName} ${day.label}은 최소 ${seasonHours[day.id]}시간`));
    }
  }
  return exceptions.length ? `최소 ${base}시간(${exceptions.join(', ')})` : `최소 ${base}시간`;
}

const INTRO = '본 계약서는 별도 예약정보에 기재된 대관 조건과 함께 적용되는 이용규정입니다.';

// ── 세 계약서에 공통인 조항 ──────────────────────────────────────────────

const CONFIRM_ITEM =
  '예약은 스페이스홍의 확인 안내 후 대관료와 청소보증금 입금이 확인되면 확정되며, 확정 전에는 일정이 보장되지 않습니다.';
const EXTENSION_ITEM =
  '시간 연장은 1시간 단위로 사전 승인 후 가능하며, 후속 예약 또는 운영 여건에 따라 제한될 수 있습니다.';

const REFUND_ARTICLE = {
  title: '제2조. 예약 취소 및 환불',
  items: [
    `대관자 사유로 취소하는 경우 다음 기준에 따라 대관료를 환불합니다. ${REFUND_POLICY_SEASON_BASIS}`,
    REFUND_TABLE_ITEM,
    '성수기 예약의 취소·변경은 원칙적으로 제한되며, 취소 시 위 환불 기준을 적용합니다.',
    '취소는 이메일·문자 등 기록 가능한 방법으로 접수하고, 의사표시가 스페이스홍에 도달한 날짜를 기준으로 환불액을 산정합니다.',
    '일정 변경은 양측 합의가 필요하며, 변경이 성립하지 않아 취소하는 경우 위 환불 기준을 적용합니다.',
    '위약금은 예약 일정 확보와 취소에 따른 예상 손해를 고려한 기준으로, 실제 손해·대체 예약 여부 및 관련 법령에 따라 조정될 수 있습니다.',
    '대관이 이루어지지 않은 경우 청소보증금은 원칙적으로 전액 반환합니다.',
    '천재지변·재난·행정명령 등 당사자의 책임 없는 사유로 대관이 불가능하면 관련 법령과 계약 이행 상황에 따라 처리합니다.',
  ],
};

const FAILURE_FIRST_ITEM =
  '시설·장비 장애 시 스페이스홍은 복구, 대체 장비 제공 또는 운영 방식 조정 등 가능한 조치를 취할 수 있습니다.';
const FAILURE_REFUND_ITEM =
  '스페이스홍의 귀책사유로 대관이 불가능하면 대관료와 청소보증금을 전액 환불하거나, 대관자 동의하에 대체 일정을 제공합니다.';

const MATERIAL_FAULT_ITEM =
  '자료의 미제출·지연·오류 또는 협의되지 않은 변경으로 발생한 문제는 대관자의 귀책 범위에서 책임집니다.';
const MATERIAL_CONFIRM_ITEM =
  '제출 자료의 요청사항은 스페이스홍의 확인과 협의를 통해 확정되며, 모든 요청의 수용이 보장되지는 않습니다.';
const SETTING_BY_MATERIAL_ITEM = '공간 세팅과 기술 운영은 제출 자료 및 사전 협의 내용을 기준으로 진행합니다.';

const EQUIPMENT_APPROVAL_ITEM =
  '무대, LED 스크린, 음향·조명 설비의 이동·변경·철거 및 외부 장비·설치물 반입은 사전 승인이 필요합니다.';
const EQUIPMENT_SCOPE_ITEM =
  '대관자는 승인된 목적과 범위 내에서 시설을 이용하고, 운영자의 정당한 안전·장비관리 안내를 준수해야 합니다.';
const EQUIPMENT_DAMAGE_ITEM =
  '대관자 또는 그 관리하에 있는 관계자의 고의·과실로 발생한 시설·장비·소품의 파손·분실은 대관자의 귀책 범위에서 실제 손해와 합리적 복구 비용을 배상합니다. 자연 마모와 시설 노후화는 제외합니다.';

const SAFETY_COMMON_ITEMS = [
  '화기·인화성 물질 사용, 무단 타공·장비 이동, 승인되지 않은 고전력 장비·판매·설치, 비상구 점유, 법령 위반 및 안전을 위협하는 소음·진동·연기 등의 행위는 금지됩니다.',
  '사고·부상·파손·장비 이상 발생 시 즉시 운영자에게 통보해야 합니다.',
  '계약 위반이나 안전상 위험이 발생하면 스페이스홍은 시정을 요구할 수 있으며, 미시정 또는 중대한 위반 시 이용을 제한할 수 있습니다. 긴급한 위험은 즉시 중단할 수 있습니다.',
  '손해와 사고의 책임은 원인, 귀책사유 및 관련 법령에 따릅니다.',
];

const DEPOSIT_ARTICLE = {
  title: '제7조. 청소 및 보증금',
  items: [
    '청소보증금은 10만원이며 대관료와 함께 선입금합니다.',
    '대관자는 퇴장 전 쓰레기·음식물 처리, 반입물품 회수, 공간 정리 및 원상복구를 완료해야 합니다.',
    '대관 종료 후 환급 신청 문자를 발송하며, 신청 폼 제출 및 현장 확인 후 이상이 없으면 제출일로부터 7일 이내 환급합니다. 폼 미제출 시에도 반환 대상 금액은 관련 법령에 따라 정산합니다.',
    '오염·파손·분실·원상복구 미이행으로 발생한 실제 손해와 합리적인 복구 비용은 보증금에서 차감할 수 있으며, 초과분은 별도로 청구할 수 있습니다.',
    '차감 또는 추가 청구 시 관련 증빙과 정산 내역을 안내합니다.',
  ],
};

const BRAND_MISUSE_ITEM = '스페이스홍의 상호·로고·공간 이미지를 허위 또는 오인 가능한 방식으로 사용할 수 없습니다.';

const TERMINATION_ARTICLE = {
  title: '제9조. 계약 변경 및 해지',
  items: [
    '대관 일정·시간·목적 등 주요 변경은 양측 합의 후 문자·이메일 등으로 확인합니다.',
    '계약 위반 시 시정을 요구할 수 있으며, 미시정 또는 중대한 위반 시 계약 해지나 이용 제한이 가능합니다.',
    '계약 해지에 따른 환불·배상은 귀책사유, 이행 내용, 실제 손해 및 관련 법령에 따릅니다.',
    '사전 동의 없는 대관 이용권의 양도 또는 제3자 재대관은 금지됩니다.',
    '법령에 위반되지 않는 개별 특약은 본 일반 이용규정보다 우선합니다.',
  ],
};

const PRIVACY_ARTICLE = {
  title: '제10조. 개인정보 및 분쟁 해결',
  items: [
    '스페이스홍은 예약·계약 이행·정산·환급·분쟁 대응에 필요한 개인정보를 관련 법령과 별도 개인정보 처리방침에 따라 처리합니다.',
    '분쟁은 상호 협의를 우선하며, 합의되지 않으면 관련 법령에 따른 분쟁조정 또는 법적 절차로 해결합니다.',
  ],
};

// ── 대관 유형별 계약서 ───────────────────────────────────────────────────

const PERFORMANCE_CONTRACT = {
  title: '공연 대관 계약서',
  intro: INTRO,
  articles: [
    {
      title: '제1조. 예약 확정 및 이용 시간',
      items: [
        CONFIRM_ITEM,
        `공연 대관은 ${minHoursText('performance')}이며, 무대·장비 세팅, 리허설, 관객 입·퇴장, 공연 진행, 정리 및 철수는 모두 대관 시간에 포함됩니다.`,
        EXTENSION_ITEM,
        '대관자의 준비 부족, 공연 지연 또는 이용 시간 미준수에 따른 문제는 대관자의 귀책 범위에서 책임집니다.',
      ],
    },
    REFUND_ARTICLE,
    {
      title: '제3조. 시설·장비 장애 및 대관 불가',
      items: [
        FAILURE_FIRST_ITEM,
        '대체 조치로 공연의 주요 목적을 달성할 수 있다면 장애만을 이유로 대관료 전액 환불 대상이 되지는 않습니다. 다만 법령상 인정되는 권리는 제한하지 않습니다.',
        FAILURE_REFUND_ITEM,
        '출연진·외부업체 비용, 티켓 판매 손실, 홍보비 및 예상수익 등은 발생 사실만으로 배상 대상이 되지 않으며, 귀책사유·인과관계·예견 가능성 및 관련 법령에 따라 판단합니다.',
        '스페이스홍은 관객 수, 티켓 판매 실적, 공연 수익 및 대관자가 계약한 외부업체의 이행 결과를 보장하지 않습니다.',
      ],
    },
    {
      title: '제4조. 공연 준비 및 운영',
      items: [
        '대관자는 공연일 최소 7일 전까지 큐시트와 테크라이더를 제출해야 합니다.',
        '제공되는 양식은 참고용이며, 무대 세팅과 기술 운영은 제출 자료 및 사전 협의에 따릅니다.',
        MATERIAL_FAULT_ITEM,
        '공연 대관에는 기본 음향·조명 오퍼레이터 2명이 포함되며, 확정된 공연계획과 기술 운영 범위에 따라 지원합니다.',
        MATERIAL_CONFIRM_ITEM,
        '사전 승인되지 않은 공연 구성 변경이나 기술 요청은 시설·인력 여건에 따라 제한할 수 있습니다.',
      ],
    },
    {
      title: '제5조. 시설 및 장비 이용',
      items: [EQUIPMENT_APPROVAL_ITEM, EQUIPMENT_SCOPE_ITEM, EQUIPMENT_DAMAGE_ITEM],
    },
    {
      title: '제6조. 수용 인원 및 안전관리',
      items: [
        '전체 이용 인원에는 관객·출연진·스태프 등 모든 공연 관계자가 포함되며, 인원 변경은 사전 협의해야 합니다.',
        '시설 허용 인원 및 안전 기준을 준수하고, 공연 관계자의 안전관리에 협력해야 합니다.',
        ...SAFETY_COMMON_ITEMS,
      ],
    },
    DEPOSIT_ARTICLE,
    {
      title: '제8조. 저작권 및 법령 준수',
      items: [
        '공연·촬영·녹음·송출·홍보에 필요한 저작권·초상권·음원 사용권 및 인허가는 대관자가 확보해야 합니다.',
        '대관자가 제작·배포한 콘텐츠 및 주관한 공연으로 발생한 법적 문제는 귀책 범위에 따라 대관자가 책임집니다.',
        BRAND_MISUSE_ITEM,
      ],
    },
    TERMINATION_ARTICLE,
    PRIVACY_ARTICLE,
  ],
};

const STUDIO_CONTRACT = {
  title: '스튜디오 대관 계약서',
  intro: INTRO,
  articles: [
    {
      title: '제1조. 예약 확정 및 이용 시간',
      items: [
        CONFIRM_ITEM,
        `스튜디오 대관은 ${minHoursText('studio')}이며, 촬영 준비, 장비 세팅, 리허설, 촬영 진행, 정리 및 철수는 모두 대관 시간에 포함됩니다.`,
        EXTENSION_ITEM,
        '대관자의 준비 부족, 촬영 지연 또는 이용 시간 미준수에 따른 문제는 대관자의 귀책 범위에서 책임집니다.',
      ],
    },
    REFUND_ARTICLE,
    {
      title: '제3조. 시설·장비 장애 및 대관 불가',
      items: [
        FAILURE_FIRST_ITEM,
        '대체 조치로 촬영의 주요 목적을 달성할 수 있다면 장애만을 이유로 대관료 전액 환불 대상이 되지는 않습니다. 다만 법령상 인정되는 권리는 제한하지 않습니다.',
        FAILURE_REFUND_ITEM,
        '출연진·촬영팀·외부업체 비용, 홍보비, 콘텐츠 제작비 및 예상수익 등은 발생 사실만으로 배상 대상이 되지 않으며, 귀책사유·인과관계·예견 가능성 및 관련 법령에 따라 판단합니다.',
        '스페이스홍은 촬영 결과물의 품질, 제작 성과, 상업적 수익 및 대관자가 계약한 외부업체의 이행 결과(단, 별도 확정한 서비스에 대한 계약상 의무는 제외)를 보장하지 않습니다.',
      ],
    },
    {
      title: '제4조. 스튜디오 준비 및 운영',
      items: [
        '대관자는 촬영일 최소 7일 전까지 촬영계획서 및 요청된 운영 자료를 제출해야 합니다.',
        SETTING_BY_MATERIAL_ITEM,
        MATERIAL_FAULT_ITEM,
        '기본 장비 및 운영 인력은 예약 시 확정된 제공 범위에 따라 지원합니다.',
        MATERIAL_CONFIRM_ITEM,
        '사전 승인되지 않은 촬영 구성 변경이나 기술 요청은 시설·인력 여건에 따라 제한할 수 있습니다.',
        '촬영 기획·진행, 출연진 및 촬영팀 관리와 촬영 장비 운용은 대관자가 담당하며, 관련 문제는 각 당사자의 귀책 범위에 따라 책임집니다.',
        '동시녹음 등 소음에 민감한 촬영은 사전에 협의해야 하며, 일반적인 건물·외부 환경에 따른 소음이 발생할 수 있습니다. 별도로 보장한 경우를 제외하고 완전한 무소음 환경은 보장하지 않습니다.',
        '대관자가 직접 운용하는 촬영·녹음 장비의 데이터 저장·백업 및 원본 관리는 대관자가 담당합니다. 스페이스홍이 별도로 제공하기로 확정한 서비스는 해당 계약 내용에 따릅니다.',
      ],
    },
    {
      title: '제5조. 시설 및 장비 이용',
      items: [
        EQUIPMENT_APPROVAL_ITEM,
        '조명·카메라·배경 구조물 등의 설치와 전력 사용은 사전 협의된 범위에서 안전하게 진행해야 합니다.',
        EQUIPMENT_SCOPE_ITEM,
        EQUIPMENT_DAMAGE_ITEM,
      ],
    },
    {
      title: '제6조. 수용 인원 및 안전관리',
      items: [
        '전체 이용 인원에는 출연진·촬영팀·진행요원·외부 스태프 등 모든 촬영 관계자가 포함되며, 인원 변경은 사전 협의해야 합니다.',
        '시설 허용 인원 및 안전 기준을 준수하고, 촬영 관계자의 안전관리에 협력해야 합니다.',
        ...SAFETY_COMMON_ITEMS,
      ],
    },
    DEPOSIT_ARTICLE,
    {
      title: '제8조. 저작권 및 법령 준수',
      items: [
        '촬영·녹음·녹화·송출·홍보에 필요한 저작권·초상권·음원 사용권 및 인허가는 대관자가 확보해야 합니다.',
        '대관자가 제작·배포한 콘텐츠 및 주관한 촬영으로 발생한 법적 문제는 귀책 범위에 따라 대관자가 책임집니다.',
        BRAND_MISUSE_ITEM,
      ],
    },
    TERMINATION_ARTICLE,
    PRIVACY_ARTICLE,
  ],
};

const EVENT_CONTRACT = {
  title: '행사 대관 계약서',
  intro: INTRO,
  articles: [
    {
      title: '제1조. 예약 확정 및 이용 시간',
      items: [
        CONFIRM_ITEM,
        `행사 대관은 ${minHoursText('event')}이며, 공간 세팅, 행사 준비, 리허설, 참가자 입·퇴장, 행사 진행, 정리 및 철수는 모두 대관 시간에 포함됩니다.`,
        EXTENSION_ITEM,
        '대관자의 준비 부족, 행사 지연 또는 이용 시간 미준수에 따른 문제는 대관자의 귀책 범위에서 책임집니다.',
      ],
    },
    REFUND_ARTICLE,
    {
      title: '제3조. 시설·장비 장애 및 대관 불가',
      items: [
        FAILURE_FIRST_ITEM,
        '대체 조치로 행사의 주요 목적을 달성할 수 있다면 장애만을 이유로 대관료 전액 환불 대상이 되지는 않습니다. 다만 법령상 인정되는 권리는 제한하지 않습니다.',
        FAILURE_REFUND_ITEM,
        '행사 준비비, 출연진·진행요원·외부업체 비용, 홍보비, 참가비·티켓 판매 손실 및 예상수익 등은 발생 사실만으로 배상 대상이 되지 않으며, 귀책사유·인과관계·예견 가능성 및 관련 법령에 따라 판단합니다.',
        '스페이스홍은 참가자 수, 행사 성과, 판매 실적, 예상수익 및 대관자가 계약한 외부업체의 이행 결과를 보장하지 않습니다.',
      ],
    },
    {
      title: '제4조. 행사 준비 및 운영',
      items: [
        '대관자는 행사일 최소 7일 전까지 행사계획서 및 요청된 운영 자료를 제출해야 합니다.',
        SETTING_BY_MATERIAL_ITEM,
        MATERIAL_FAULT_ITEM,
        '행사 대관에는 기본 음향·조명 오퍼레이터 2명이 포함되며, 확정된 행사계획과 기술 운영 범위에 따라 지원합니다.',
        MATERIAL_CONFIRM_ITEM,
        '사전 승인되지 않은 행사 구성 변경이나 기술 요청은 시설·인력 여건에 따라 제한할 수 있습니다.',
        '행사 기획·진행, 참가자 접수·안내 및 외부업체 관리는 대관자가 담당하며, 관련 문제는 각 당사자의 귀책 범위에 따라 책임집니다.',
      ],
    },
    {
      title: '제5조. 시설 및 장비 이용',
      items: [
        EQUIPMENT_APPROVAL_ITEM,
        '좌석 배치, 행사 장식, 현수막·배너·구조물 설치 및 공간 연출은 사전 협의된 범위에서 진행해야 합니다.',
        EQUIPMENT_SCOPE_ITEM,
        EQUIPMENT_DAMAGE_ITEM,
      ],
    },
    {
      title: '제6조. 수용 인원 및 안전관리',
      items: [
        '전체 이용 인원에는 참가자·주최 측 관계자·진행요원·출연진·외부 스태프 등 모든 행사 관계자가 포함되며, 인원 변경은 사전 협의해야 합니다.',
        '시설 허용 인원 및 안전 기준을 준수하고, 행사 관계자의 안전관리에 협력해야 합니다.',
        ...SAFETY_COMMON_ITEMS,
      ],
    },
    DEPOSIT_ARTICLE,
    {
      title: '제8조. 저작권 및 법령 준수',
      items: [
        '행사·촬영·녹음·송출·홍보에 필요한 저작권·초상권·음원 사용권 및 인허가는 대관자가 확보해야 합니다.',
        '대관자가 제작·배포한 콘텐츠 및 주관한 행사로 발생한 법적 문제는 귀책 범위에 따라 대관자가 책임집니다.',
        BRAND_MISUSE_ITEM,
      ],
    },
    TERMINATION_ARTICLE,
    PRIVACY_ARTICLE,
  ],
};

export const RENTAL_CONTRACTS = {
  performance: PERFORMANCE_CONTRACT,
  studio: STUDIO_CONTRACT,
  event: EVENT_CONTRACT,
};

/** 대관 유형 → 계약서 (알 수 없는 유형은 null) */
export function getRentalContract(venueType) {
  return RENTAL_CONTRACTS[venueType] || null;
}
