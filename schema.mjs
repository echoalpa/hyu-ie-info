// 사이트의 모든 콘텐츠 구조를 한 곳에서 정의합니다.
// 이 파일을 고친 뒤 `npm run gen-config`를 실행하면
// 관리 사이트 설정(admin/config.yml, .pages.yml)이 같이 바뀝니다.

export const site = {
  repo: 'echoalpa/hyu-ie-info',
  branch: 'main',
  // GitHub Pages 주소. 커스텀 도메인을 붙이면 여기만 바꾸면 됩니다.
  url: 'https://echoalpa.github.io/hyu-ie-info',
  timezone: 'Asia/Seoul',
};

const CATS = ['학사', '졸업', '수강', '장학', '진로', '행사', '복지', '시설', '학생회', '기타'];

const published = {
  name: 'published', label: '공개', widget: 'boolean', default: true,
  hint: '끄면 사이트와 AI에게 보이지 않아요(임시 저장용).',
};
const summary = {
  name: 'summary', label: '한 줄 요약', widget: 'text', required: false,
  hint: 'AI 비서가 가장 먼저 읽는 문장이에요. 핵심(누가·언제·어디서·무엇을)을 한두 문장으로 적어주세요.',
};
const body = (label = '본문') => ({ name: 'body', label, widget: 'markdown', required: false });
const refs = {
  name: 'refs', label: '관련 링크', widget: 'list', required: false,
  hint: '더 자세한 정보가 있는 다른 사이트(학과 홈페이지, 포털 공지, 신청 폼 등). AI 비서가 이 링크로 넘어가서 추가로 확인해요.',
  fields: [
    { name: 'name', label: '링크 이름', widget: 'string', hint: '예: 학과 홈페이지 졸업요건 안내' },
    { name: 'url', label: '주소', widget: 'string', hint: 'https:// 로 시작하는 주소' },
    { name: 'description', label: '여기서 확인할 수 있는 것 (선택)', widget: 'string', required: false },
  ],
};
const category = { name: 'category', label: '분류', widget: 'select', options: CATS, default: '기타' };

export const collections = [
  {
    name: 'notices', label: '공지사항', singular: '공지', icon: 'campaign',
    description: '학생회·학과 공지. 마감일이 있으면 꼭 넣어주세요.',
    schemaType: 'Article',
    sort: (a, b) => (b.pinned - a.pinned) || cmp(b.date, a.date),
    columns: ['title', 'date', 'category', 'pinned'],
    fields: [
      { name: 'title', label: '제목', widget: 'string' },
      { name: 'date', label: '게시일', widget: 'date', default: '{{now}}' },
      category,
      summary,
      { name: 'deadline', label: '마감일 (있으면)', widget: 'date', required: false },
      { name: 'link', label: '원문·신청 링크', widget: 'string', required: false, hint: 'https:// 로 시작하는 주소' },
      { name: 'pinned', label: '상단 고정', widget: 'boolean', default: false },
      refs,
      published,
      body(),
    ],
  },
  {
    name: 'events', label: '행사·일정', singular: '행사', icon: 'event',
    description: '학생회·학과 자체 행사(개강총회, MT, 간식행사 등). 학교 공식 학사일정은 매일 자동으로 들어오니 넣지 않아도 돼요.',
    schemaType: 'Event',
    sort: (a, b) => cmp(a.start, b.start),
    columns: ['title', 'date', 'location'],
    fields: [
      { name: 'title', label: '행사명', widget: 'string' },
      { name: 'date', label: '날짜', widget: 'date' },
      { name: 'time', label: '시간 (선택)', widget: 'string', required: false, hint: '예: 18:00 또는 18:00~21:00. 하루 종일이면 비워두세요.' },
      { name: 'end_date', label: '끝나는 날짜 (여러 날이면)', widget: 'date', required: false },
      { name: 'location', label: '장소', widget: 'string', required: false, hint: '예: 제1공학관 과방 앞' },
      { name: 'target', label: '대상', widget: 'string', required: false, hint: '예: 산업공학과 재학생 누구나' },
      { name: 'kind', label: '종류', widget: 'select', options: ['학생회 행사', '학과 행사', '학사 일정', '복지', '진로', '기타'], default: '학생회 행사' },
      summary,
      { name: 'apply_link', label: '신청 링크', widget: 'string', required: false },
      refs,
      published,
      body('상세 안내'),
    ],
  },
  {
    name: 'guides', label: '학과 생활 가이드', singular: '가이드', icon: 'menu_book',
    description: '졸업요건, 과방 이용법처럼 길게 정리해 두는 안내문.',
    schemaType: 'Article',
    sort: (a, b) => (a.order ?? 99) - (b.order ?? 99) || cmp(a.title, b.title),
    fields: [
      { name: 'title', label: '제목', widget: 'string' },
      category,
      summary,
      { name: 'updated', label: '확인한 날짜', widget: 'date', default: '{{now}}' },
      { name: 'order', label: '정렬 순서', widget: 'number', required: false, hint: '작은 숫자가 먼저 나와요' },
      refs,
      published,
      body(),
    ],
  },
  {
    name: 'career', label: '커리어 아카이브', singular: '커리어 기록', icon: 'work',
    description: '선배들의 직무·인턴·취업·대학원 후기.',
    schemaType: 'Article',
    sort: (a, b) => (b.year ?? 0) - (a.year ?? 0) || cmp(a.title, b.title),
    fields: [
      { name: 'title', label: '제목', widget: 'string', hint: '예: SCM 직무 인턴 후기' },
      { name: 'kind', label: '종류', widget: 'select', options: ['직무 소개', '인턴 후기', '취업 후기', '대학원', '대외활동', '자격증·시험', '기타'], default: '직무 소개' },
      { name: 'field', label: '분야·직무', widget: 'string', required: false, hint: '예: SCM, 데이터 분석, 컨설팅, 생산관리' },
      { name: 'company', label: '회사·기관 (선택)', widget: 'string', required: false },
      { name: 'year', label: '연도', widget: 'number', required: false },
      { name: 'author', label: '작성자 표기', widget: 'string', required: false, hint: '실명 대신 "19학번 선배"처럼 적어도 돼요' },
      summary,
      refs,
      published,
      body(),
    ],
  },
  {
    name: 'mentors', label: '선배 멘토', singular: '멘토', icon: 'diversity_3',
    description: '후배 멘토링에 참여하는 선배 목록. 연락처는 본인 동의를 받은 방법만 적어주세요.',
    schemaType: 'Person',
    sort: (a, b) => (b.available - a.available) || cmp(a.title, b.title),
    fields: [
      { name: 'title', label: '이름 또는 닉네임', widget: 'string' },
      { name: 'cohort', label: '학번', widget: 'string', required: false, hint: '예: 18학번' },
      { name: 'field', label: '분야·직무', widget: 'string', required: false },
      { name: 'company', label: '소속 (선택)', widget: 'string', required: false },
      { name: 'topics', label: '상담 가능 주제', widget: 'list', required: false, hint: '쉼표로 구분. 예: 취업, 대학원, 교환학생' },
      { name: 'contact', label: '신청 방법', widget: 'text', required: false, hint: '본인 동의를 받은 연락 방법만 적어주세요' },
      { name: 'available', label: '현재 멘토링 가능', widget: 'boolean', default: true },
      summary,
      refs,
      published,
      body('소개'),
    ],
  },
];

// 파일 하나로 관리하는 설정형 데이터
export const files = [
  {
    name: 'site', label: '사이트 기본 정보', file: 'data/site.yml', icon: 'info',
    fields: [
      { name: 'name', label: '사이트 이름', widget: 'string' },
      { name: 'department', label: '학과', widget: 'string' },
      { name: 'intro', label: '소개', widget: 'text', required: false },
      {
        name: 'managers', label: '관리자', widget: 'list',
        fields: [
          { name: 'role', label: '직책', widget: 'string', hint: '예: 정학생회장' },
          { name: 'name', label: '이름', widget: 'string' },
          { name: 'phone', label: '연락처', widget: 'string', required: false },
        ],
      },
    ],
  },
  {
    name: 'links', label: '바로가기 사이트', file: 'data/links.yml', icon: 'link',
    fields: [
      {
        name: 'links', label: '바로가기 목록', widget: 'list',
        fields: [
          { name: 'name', label: '사이트 이름', widget: 'string' },
          { name: 'url', label: '주소', widget: 'string' },
          { name: 'description', label: '여기서 할 수 있는 일', widget: 'string', hint: 'AI가 어떤 질문에 이 링크를 줄지 판단하는 데 써요' },
          { name: 'category', label: '분류', widget: 'select', options: CATS, default: '기타' },
        ],
      },
    ],
  },
];

function cmp(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'ko');
}
