// content/ + data/ → _site/ (사람용 HTML + AI용 llms.txt·JSON·마크다운)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { marked } from 'marked';
import { site, collections } from '../schema.mjs';

const OUT = '_site';
const BASE = new URL(site.url).pathname.replace(/\/$/, ''); // "/hyu-ie-info"
const ORIGIN = site.url.replace(/\/$/, '');
const warnings = [];
const warn = (m) => { warnings.push(m); console.warn('⚠ ' + m); };

// ---------- 시간 (KST 기준) ----------
const kstNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
const NOW = kstNow();
const TODAY = NOW.slice(0, 10);
function normTime(v) {
  // 값을 KST 벽시계 문자열로. 'Z'·오프셋이 붙은 값은 KST로 변환.
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date) v = v.toISOString();
  let s = String(v).trim();
  if (/([zZ]|[+-]\d\d:?\d\d)$/.test(s) && s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d)) return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
  }
  s = s.replace(' ', 'T');
  if (/^\d{4}-\d\d-\d\d(T\d\d:\d\d)?/.test(s)) return s.slice(0, s.includes('T') ? 16 : 10);
  return s;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmtKo(s) {
  if (!s) return '';
  const [d, t] = s.split('T');
  const dt = new Date(d + 'T00:00:00Z');
  if (isNaN(dt)) return s;
  const out = `${dt.getUTCFullYear()}년 ${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일 (${WD[dt.getUTCDay()]})`;
  if (!t) return out;
  const [h, m] = t.split(':').map(Number);
  return `${out} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
}
function statusOf(start, end) {
  const e = end || start;
  const endCmp = e.length === 10 ? e + 'T23:59' : e;
  return NOW < start ? '예정' : NOW <= endCmp ? '진행 중' : '종료';
}
// 기간 표시: 같은 날이면 끝 시간만
function fmtRange(start, end) {
  if (!end || end === start) return fmtKo(start);
  if (end.slice(0, 10) === start.slice(0, 10) && end.includes('T')) {
    const [h, m] = end.slice(11).split(':').map(Number);
    return `${fmtKo(start)} ~ ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
  }
  return `${fmtKo(start)} ~ ${fmtKo(end)}`;
}
const iso = (s) => (s ? (s.length === 10 ? s : `${s}:00+09:00`) : undefined);

// ---------- 유틸 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = (p = '') => `${BASE}/${p}`.replace(/\/+/g, '/');
const abs = (p = '') => ORIGIN + '/' + String(p).replace(/^\//, '');
const write = (p, data) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const fixMedia = (s) => String(s || '').replace(/(\]\(|src=["'])\/uploads\//g, `$1${BASE}/uploads/`);
// 마크다운 안의 상대 링크(../../events/ 등)를 절대 주소로 바꿔 .md·JSON에서도 열리게 함
const absLinks = (md, base) => String(md || '').replace(/(\]\(|src=["'])([^)"'\s]+)/g, (m, pre, href) => {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return m;
  try { return pre + new URL(href, base).href; } catch { return m; }
});
const isUrl = (s) => /^https?:\/\//.test(String(s || ''));
const readYaml = (f, fallback) => { try { return yaml.load(fs.readFileSync(f, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? fallback; } catch (e) { warn(`${f} 읽기 실패: ${e.message}`); return fallback; } };

// git 마지막 수정 시각 (파일별)
const gitTimes = {};
try {
  const log = execSync('git log --name-only --format=@@%cI -- content data', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let cur;
  for (const line of log.split('\n')) {
    if (line.startsWith('@@')) cur = line.slice(2);
    else if (line && !gitTimes[line]) gitTimes[line] = normTime(cur);
  }
} catch { /* git 없음 */ }

// ---------- 데이터 읽기 ----------
const siteInfo = readYaml('data/site.yml', {});
const links = (readYaml('data/links.yml', {}).links || []).filter((l) => l && l.name && l.url);

const db = {};
for (const c of collections) {
  const dir = `content/${c.name}`;
  const items = [];
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : []) {
    const rel = `${dir}/${file}`;
    let parsed;
    try {
      parsed = matter(fs.readFileSync(rel, 'utf8'), { engines: { yaml: (s) => yaml.load(s, { schema: yaml.CORE_SCHEMA }) || {} } });
    } catch (e) { warn(`${rel}: 형식 오류로 건너뜀 (${e.message})`); continue; }
    const d = parsed.data;
    if (d.published === false || d.published === 'false') continue;
    if (!d.title) { warn(`${rel}: 제목(title)이 없어 건너뜀`); continue; }
    const it = { ...d, collection: c.name, slug: file.replace(/\.md$/, ''), file: rel };
    for (const f of c.fields) {
      if (['date', 'datetime'].includes(f.widget)) it[f.name] = normTime(d[f.name]);
      if (f.widget === 'boolean') it[f.name] = d[f.name] === true || d[f.name] === 'true';
      if (f.widget === 'number' && d[f.name] !== undefined && d[f.name] !== '') it[f.name] = Number(d[f.name]);
      if (f.widget === 'list' && typeof d[f.name] === 'string') it[f.name] = d[f.name].split(',').map((x) => x.trim()).filter(Boolean);
    }
    delete it.published;
    it.body = fixMedia(parsed.content.trim());
    it.html = marked.parse(it.body);
    it.modified = gitTimes[rel] || it.updated || it.date || TODAY;
    it.path = `${c.name}/${it.slug}/`;
    it.url = abs(it.path);
    it.md_url = abs(`${c.name}/${it.slug}.md`);
    if (c.name === 'events') {
      // 날짜 + 시간(선택, "18:00" 또는 "18:00~21:00") + 끝나는 날짜(선택) → start/end
      const day = it.date || normTime(d.start)?.slice(0, 10);
      if (!day) { warn(`${rel}: 날짜가 없어 건너뜀`); continue; }
      const t = String(d.time ?? '').match(/(\d{1,2}):(\d\d)(?:\s*[~\-–]\s*(\d{1,2}):(\d\d))?/);
      const hm = (h, m) => `${String(h).padStart(2, '0')}:${m}`;
      it.start = d.start && !it.date ? normTime(d.start) : t ? `${day}T${hm(t[1], t[2])}` : day;
      const endDay = it.end_date || (d.end ? normTime(d.end).slice(0, 10) : day);
      it.end = d.end && !it.date ? normTime(d.end) : t && t[3] ? `${endDay}T${hm(t[3], t[4])}` : endDay !== day ? endDay : undefined;
      it.status = statusOf(it.start, it.end);
    }
    if (c.name === 'notices' && it.deadline) it.deadline_passed = it.deadline < TODAY;
    items.push(it);
  }
  items.sort(c.sort);
  db[c.name] = items;
}
const upcoming = db.events.filter((e) => e.status !== '종료');

// 학교 공식 학사일정 (scripts/fetch-academic.mjs가 매일 갱신)
const academicFile = readYaml('data/academic.yml', {});
const academic = (academicFile.items || []).filter((a) => a && a.title && a.start).map((a) => {
  const start = normTime(a.start), end = normTime(a.end);
  return { title: String(a.title), start, end, status: statusOf(start, end) };
});
const AHEAD_DAYS = 60;
const aheadCut = new Date(Date.parse(TODAY + 'T00:00:00Z') + AHEAD_DAYS * 864e5).toISOString().slice(0, 10);
const academicSoon = academic.filter((a) => a.status !== '종료' && a.start.slice(0, 10) <= aheadCut);
// 학생회 행사 + 학사일정을 합친 "다가오는 일정"
const agenda = [
  ...upcoming.map((e) => ({ kind: '학생회·학과 행사', title: e.title, start: e.start, end: e.end, status: e.status, location: e.location, md_url: e.md_url })),
  ...academicSoon.map((a) => ({ kind: '학사일정', ...a })),
].sort((a, b) => a.start.localeCompare(b.start));
const all = collections.flatMap((c) => db[c.name]);

// ---------- 사실(메타) 항목: HTML·마크다운·JSON 공통 ----------
// [확인 필요] 표시: 비어 있으면 이 값을 넣고, 관리자용 확인 목록에 모은다
const TBD = '[확인 필요]';
const todo = [];
const dayKo = (d) => { const x = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); return isNaN(x) ? '' : WD[x.getUTCDay()]; };
const ymdW = (d) => (d ? `${String(d).slice(0, 10)}(${dayKo(d)})` : '');
function facts(it) {
  const F = [];
  const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && !(Array.isArray(v) && !v.length);
  const add = (k, v) => has(v) && F.push([k, String(v).trim()]);
  // 꼭 있어야 하는 칸: 비어 있으면 [확인 필요]로 표시하고 목록에 추가
  const need = (k, v) => {
    const val = has(v) ? String(v).trim() : TBD;
    if (val.includes(TBD)) todo.push(`[${colOf(it.collection).label}] ${it.title} → ${k}`);
    F.push([k, val]);
  };
  const checkedOf = it.checked || it.updated;
  switch (it.collection) {
    case 'notices': {
      need('1. 대상', it.target);
      need('2. 해야 할 행동', it.action);
      let dl = '';
      if (it.deadline) dl = `${ymdW(it.deadline)} ${it.deadline_time ? String(it.deadline_time).trim() : '(시각 [확인 필요])'}${it.deadline_passed ? ' · 마감 지남' : ''}`;
      if (it.deadline_note) dl = dl ? `${dl} · ${oneLine(it.deadline_note)}` : oneLine(it.deadline_note);
      need('3. 정확한 마감', dl);
      need('4. 제출 경로', it.submit_via);
      need('5. 이미 처리한 사람 예외', it.exceptions);
      need('6. 출처', it.source);
      need('6. 작성일', it.date && ymdW(it.date));
      need('최종확인일', it.checked);
      break;
    }
    case 'events': add('상태', it.status); add('일시', fmtRange(it.start, it.end)); add('장소', it.location); add('대상', it.target); add('종류', it.kind); add('신청', it.apply_link); need('출처', it.source); need('최종확인일', it.checked); break;
    case 'faq': need('적용 입학연도', it.cohort); add('주제', it.topic); need('출처', it.source); need('최종확인일', it.checked); break;
    case 'life':
      add('종류', it.kind);
      if (['학과사무실', '과방', '건물', '사물함'].includes(it.kind) || it.location) need('위치 (건물 > 층 > 호실)', it.location);
      add('별칭·설명', it.aliases); add('건물 코드', it.building_code); add('지도', it.map_link);
      if (['학과사무실', '과방'].includes(it.kind)) need('운영·이용 시간', it.hours); else add('운영·이용 시간', it.hours);
      if (it.kind === '학과사무실') need('문의처', it.contact); else add('문의처', it.contact);
      need('출처', it.source); need('최종확인일', it.checked);
      break;
    case 'guides': add('분류', it.category); need('출처', it.source); need('최종확인일', checkedOf); break;
    case 'career': add('종류', it.kind); add('분야', it.field); add('회사·기관', it.company); add('연도', it.year); add('작성', it.author); add('출처', it.source); add('최종확인일', it.checked); break;
    case 'mentors': add('학번', it.cohort); add('분야', it.field); add('소속', it.company); add('상담 주제', (it.topics || []).join(', ')); add('멘토링', it.available ? '가능' : '현재 불가'); add('신청 방법', it.contact); add('출처', it.source); add('최종확인일', it.checked); break;
  }
  // 본문·요약 안의 [확인 필요]도 목록에 추가
  if (`${it.summary || ''}\n${it.body || ''}`.includes(TBD)) todo.push(`[${colOf(it.collection).label}] ${it.title} → 요약/본문 안의 [확인 필요]`);
  return F;
}
const colOf = (name) => collections.find((c) => c.name === name);

// ---------- 공통 ----------
const ORG_NAME = `${siteInfo.department || '한양대학교 산업공학과'} 학생회`;
const SITE_NAME = siteInfo.name || '산공 정보';
const managersLine = (siteInfo.managers || []).map((m) => `관리자 ${m.role} ${m.name}${m.phone ? ` (${m.phone})` : ''}`).join(', ');
const RECENT_DAYS = 7;
const recentCut = new Date(Date.parse(TODAY + 'T00:00:00Z') - RECENT_DAYS * 864e5).toISOString().slice(0, 10);
const recent = all.filter((i) => String(i.modified).slice(0, 10) >= recentCut).sort((a, b) => String(b.modified).localeCompare(String(a.modified)));
const refLines = (it) => (it.refs || []).filter((r) => r && r.url).map((r) => `- [${r.name || r.url}](${r.url})${r.description ? `: ${r.description}` : ''}`);
const oneLine = (s) => String(s || '').replace(/\s*\n+\s*/g, ' ').trim();

// 글 하나 → 마크다운 (AI가 읽는 기본 단위)
function entryMd(it, level = '##') {
  const c = colOf(it.collection);
  let s = `${level} ${it.title}\n\n`;
  s += `- 게시판: ${c.label}\n`;
  if (it.summary) s += `- 요약: ${oneLine(it.summary)}\n`;
  for (const [k, v] of facts(it)) s += `- ${k}: ${v}\n`;
  s += `- 마지막 수정: ${fmtKo(it.modified)}\n- 주소: ${it.md_url}\n`;
  const refs = refLines(it);
  if (refs.length) s += `- 관련 링크 (더 자세한 정보는 여기로 이동해서 확인):\n${refs.map((r) => '  ' + r).join('\n')}\n`;
  if (it.body) s += `\n${absLinks(it.body, ORIGIN + '/')}\n`;
  return s;
}

function toJson(it) {
  const { html, file, body, path: p, url: u, ...rest } = it;
  return { ...rest, collection_label: colOf(it.collection).label, refs: (it.refs || []).filter((r) => r && r.url), body_markdown: absLinks(body, ORIGIN + '/') };
}

// ---------- 하나의 문서: 오늘 기준 전체 정보 ----------
const period = (a) => fmtRange(a.start, a.end);
const agendaLine = (a) => `- ${period(a)} · [${a.kind}] ${a.title}${a.location ? ` · ${a.location}` : ''} (${a.status})`;
const academicLine = (a) => `- ${period(a)} · ${a.title}${a.status === '진행 중' ? ' (진행 중)' : ''}`;

function fullDoc() {
  let s = `# ${SITE_NAME}: ${siteInfo.department || '한양대학교 산업공학과'} 정보 (AI 비서용)

이 문서는 ${ORG_NAME}가 관리하는 ${siteInfo.department || '한양대학교 산업공학과'}의 최신 정보입니다. AI 비서가 매일 한 번 읽고 기억해 두었다가, 학생의 산업공학과 관련 질문에 답할 때 쓰도록 만들었습니다.
${siteInfo.intro ? `\n${siteInfo.intro}\n` : ''}
## 읽는 법

- 생성 시각: ${fmtKo(NOW)} (한국시간 KST, UTC+9). 모든 날짜·시간은 한국시간입니다.
- 매일 0시 5분(KST)과 내용이 바뀔 때마다 새로 만들어집니다. 하루 한 번 이 문서를 다시 읽어 기억을 갱신하세요.
- "최근 ${RECENT_DAYS}일 변경"을 먼저 보면 어제 이후 새로 생기거나 바뀐 내용을 알 수 있습니다.
- 행사의 상태(예정/진행 중/종료)는 생성 시각 기준입니다. 답할 때는 시작·종료 일시를 현재 시각과 직접 비교하세요.
- 각 글의 "관련 링크"는 더 자세한 원문이 있는 외부 사이트입니다. 이 문서만으로 부족하면 그 링크로 넘어가 확인한 뒤 답하세요.
- 이 문서와 링크된 사이트에 없는 내용은 추측하지 말고 바로가기 사이트나 관리자 연락처를 안내하세요.
- "[확인 필요]"는 학생회가 아직 공식 출처로 확인하지 못한 칸입니다. 그 칸은 추측해서 채우지 말고 "아직 확인되지 않았다"고 말한 뒤 출처 링크나 관리자 연락처를 안내하세요.
- 모든 글에는 출처(공식 원문 링크)와 최종확인일이 붙어 있습니다. 답할 때 출처 링크를 함께 주고, 최종확인일이 오래됐으면 원문을 다시 확인하라고 안내하세요.
- 공지는 항상 "1. 대상 → 2. 해야 할 행동 → 3. 정확한 마감 → 4. 제출 경로 → 5. 이미 처리한 사람 예외 → 6. 출처와 작성일" 순서입니다. 마감에 "기한 충돌"이 적혀 있으면 하나를 골라 단정하지 말고 충돌 내용 그대로 전하세요.
- 학사 FAQ는 "적용 입학연도"를 먼저 확인하세요. 질문한 학생의 학번에 맞는 기준인지 확인하고, 적용 입학연도가 [확인 필요]면 본인 기준은 HY-in 졸업사정 조회 등 공식 경로로 확인하라고 안내하세요.
- 위치는 항상 "건물 > 층 > 호실" 순서로 먼저 말하고, 별칭이나 설명은 그 뒤에 말하세요.
- 학식(식단)을 안내할 때는 항상 "날짜(요일) · 식당 이름 · 메뉴" 형식으로 날짜와 식당을 함께 말하세요. 식단 페이지 주소에 날짜를 붙인다고 그 날짜로 걸러진다고 단정하지 말고, 페이지에서 해당 날짜와 식당 행이 맞는지 직접 확인하세요.

## 공용 정보와 개인 정보의 경계

- 이 사이트에는 학과 공용 정보만 있습니다. 개인 성적, 개인 LMS 제출 현황, 개인 학적·장학 결과 같은 개인 정보는 이 사이트에 없고 앞으로도 넣지 않습니다.
- 학생 본인 권한으로 LMS·HY-in 등에 연결된 AI 비서라면 그 인증된 영역에서 본인 정보를 확인할 수 있습니다. 연결되어 있지 않다면 추측하지 말고 "연결이 필요하거나 본인이 직접 확인해야 한다"고 안내하세요.
- 종이로 제출하는 과제나 서류가 있을 수 있으므로, LMS에 미제출로 표시된다는 것만으로 미제출이라고 단정하지 마세요. 종이 제출 여부는 담당 교수·조교·행정팀에 확인하라고 함께 안내하세요.

## 기타
- 같은 내용의 JSON: ${abs('api/all.json')} · 다가오는 일정만: ${abs('api/upcoming.json')} · 최근 변경만: ${abs('api/recent.json')}
${managersLine ? `- ${managersLine}\n` : ''}
## 최근 ${RECENT_DAYS}일 변경 (${fmtKo(recentCut)} 이후)

${recent.length ? recent.map((i) => `- ${fmtKo(i.modified)} · [${colOf(i.collection).label}] ${i.title}${i.summary ? `: ${oneLine(i.summary)}` : ''}`).join('\n') : '(없음)'}

## 다가오는 일정 (진행 중 + 앞으로 ${AHEAD_DAYS}일, 학사일정 + 학생회·학과 행사)

${agenda.length ? agenda.map(agendaLine).join('\n') : '(없음)'}
`;
  for (const c of collections) {
    const items = db[c.name];
    s += `\n---\n\n# ${c.label}\n\n${c.description}\n\n`;
    s += items.length ? items.map((it) => entryMd(it, '##')).join('\n') : '(아직 없음)\n';
  }
  s += `\n---\n\n# 학사일정 (한양대학교 서울캠퍼스 공식)\n\n출처: ${academicFile.source || ''} (매일 자동 동기화, 마지막 변경 반영 ${fmtKo(normTime(academicFile.synced_at))}). 산업공학과는 서울캠퍼스입니다. 학사일정은 사정에 따라 바뀔 수 있으니 중요한 마감은 원문도 확인하라고 안내하세요.\n\n`;
  const acNow = academic.filter((a) => a.status !== '종료');
  const acPast = academic.filter((a) => a.status === '종료');
  s += `## 진행 중이거나 앞으로 있을 학사일정\n\n${acNow.map(academicLine).join('\n') || '(없음)'}\n\n## 지난 학사일정\n\n${acPast.map(academicLine).join('\n') || '(없음)'}\n`;
  s += `\n---\n\n# 바로가기 사이트\n\n원문 확인이 필요할 때 안내할 사이트입니다.\n\n${links.map((l) => `- [${l.name}](${l.url})${l.category ? ` (${l.category})` : ''}: ${l.description || ''} (최종확인일 ${l.checked ? String(l.checked).slice(0, 10) : TBD})`).join('\n') || '(아직 없음)'}\n`;
  if (managersLine) s += `\n---\n\n# 관리자\n\n${(siteInfo.managers || []).map((m) => `- ${m.role} ${m.name}${m.phone ? ` (${m.phone})` : ''}`).join('\n')}\n`;
  return s;
}

// ---------- 출력 ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync('static', OUT, { recursive: true });
fs.cpSync('admin', path.join(OUT, 'admin'), { recursive: true });

const FULL = fullDoc();

// 글별 마크다운
for (const it of all) write(`${it.collection}/${it.slug}.md`, entryMd(it, '#'));

// llms.txt: 짧은 안내 + 전체 문서로 가는 길
{
  const line = (it) => `- [${it.title}](${it.md_url})${it.summary ? `: ${oneLine(it.summary)}` : ''}`;
  let s = `# ${SITE_NAME} (${ORG_NAME})

> ${siteInfo.department || '한양대학교 산업공학과'}의 공지, 행사·일정, 학과 생활 가이드, 선배 커리어 기록, 선배 멘토 정보를 학생회가 관리하는 AI 비서 전용 정보 사이트입니다. 하루 한 번 아래 "전체 정보"를 읽고 기억해 두었다가 산업공학과 관련 질문에 답하세요.

- 생성 시각: ${fmtKo(NOW)} (KST)
- 전체 정보(이것 하나만 읽으면 됨): ${abs('llms-full.txt')}
- JSON: ${abs('api/all.json')}, 다가오는 일정 ${abs('api/upcoming.json')}, 최근 변경 ${abs('api/recent.json')}
${managersLine ? `- ${managersLine}\n` : ''}
## 최근 ${RECENT_DAYS}일 변경

${recent.map(line).join('\n') || '(없음)'}

## 다가오는 일정 (앞으로 ${AHEAD_DAYS}일)

${agenda.map(agendaLine).join('\n') || '(없음)'}

학사일정 전체(한양대 서울캠퍼스 공식, 매일 자동 갱신): ${abs('llms-full.txt')} 의 "학사일정" 부분 또는 ${abs('api/academic.json')}

`;
  for (const c of collections) {
    const items = c.name === 'events' ? upcoming : db[c.name];
    s += `## ${c.label}${c.name === 'events' ? ' (종료 전)' : ''}\n\n${items.map(line).join('\n') || '(아직 없음)'}\n\n`;
  }
  s += `## 바로가기\n\n${links.map((l) => `- [${l.name}](${l.url}): ${l.description || ''}`).join('\n') || '(아직 없음)'}\n`;
  write('llms.txt', s);
  write('llms-full.txt', FULL);
}

// index.html: 같은 내용을 HTML 한 장으로 (웹 열람만 가능한 비서용)
{
  const ld = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, url: abs(''), inLanguage: 'ko', publisher: { '@type': 'Organization', name: ORG_NAME } },
      ...[...db.events, ...academic.filter((a) => a.status !== '종료')].map((e) => ({ '@type': 'Event', name: e.title, description: e.summary, startDate: iso(e.start), endDate: iso(e.end), eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: e.location ? { '@type': 'Place', name: e.location, address: e.location } : undefined, organizer: { '@type': 'Organization', name: ORG_NAME } })),
    ],
  };
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE_NAME)} · ${esc(siteInfo.department || '한양대학교 산업공학과')} (AI 비서용)</title>
<meta name="description" content="${esc(`${siteInfo.department || '한양대학교 산업공학과'} 공지·행사·가이드·커리어 정보. AI 비서가 매일 읽는 정보 사이트. 생성 ${fmtKo(NOW)}`)}">
<link rel="icon" href="${url('favicon.png')}">
<link rel="alternate" type="text/markdown" href="${url('llms-full.txt')}">
<link rel="alternate" type="application/json" href="${url('api/all.json')}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>body{max-width:820px;margin:0 auto;padding:16px;font:15px/1.6 system-ui,-apple-system,"Malgun Gothic",sans-serif;color:#111;background:#fff}h1{font-size:22px}h1,h2{color:#0E4A84}hr{border:0;border-top:1px solid #ddd;margin:28px 0}a{color:#0E4A84}@media(prefers-color-scheme:dark){body{background:#111;color:#e6e6e6}h1,h2,a{color:#8dbbf0}hr{border-color:#333}}</style>
</head>
<body>
<main>
${marked.parse(FULL)}
</main>
</body>
</html>`;
  write('index.html', html);
  write('404.html', `<!doctype html><meta charset="utf-8"><title>없음</title><p>페이지가 없습니다. <a href="${url('')}">전체 정보</a></p>`);
}

// JSON
const meta = { site: SITE_NAME, department: siteInfo.department, publisher: ORG_NAME, managers: siteInfo.managers || [], generated_at: `${NOW}:00+09:00`, timezone: 'Asia/Seoul (KST, UTC+9)', source: abs('') };
write('api/all.json', JSON.stringify({ ...meta, academic_calendar: academic, recent_days: RECENT_DAYS, recent: recent.map((i) => ({ collection: i.collection, title: i.title, modified: i.modified, md_url: i.md_url })), items: all.map(toJson), links }, null, 1));
for (const c of collections) write(`api/${c.name}.json`, JSON.stringify({ ...meta, collection: c.name, label: c.label, items: db[c.name].map(toJson) }, null, 1));
write('api/upcoming.json', JSON.stringify({ ...meta, note: `진행 중이거나 앞으로 ${AHEAD_DAYS}일 안의 학사일정 + 학생회·학과 행사. 상태는 generated_at 기준.`, items: agenda }, null, 1));
write('api/academic.json', JSON.stringify({ ...meta, source: academicFile.source, synced_at: academicFile.synced_at, note: '한양대학교 서울캠퍼스 공식 학사일정', items: academic }, null, 1));
write('api/recent.json', JSON.stringify({ ...meta, note: `최근 ${RECENT_DAYS}일 안에 새로 생기거나 수정된 글`, items: recent.map(toJson) }, null, 1));
write('api/links.json', JSON.stringify({ ...meta, items: links }, null, 1));

// sitemap, robots
{
  const pages = ['', 'llms.txt', 'llms-full.txt', ...all.map((i) => `${i.collection}/${i.slug}.md`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${abs(p)}</loc><lastmod>${TODAY}</lastmod><changefreq>daily</changefreq></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `# AI 비서·크롤러 모두 환영합니다. 하루 한 번 ${abs('llms-full.txt')} 를 읽어주세요.\nUser-agent: *\nAllow: /\nDisallow: ${BASE}/admin/\n\nSitemap: ${abs('sitemap.xml')}\n`);
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// 관리자용 [확인 필요] 목록
for (const l of links) if (!l.checked) todo.push(`[바로가기] ${l.name} → 최종확인일`);
const todoList = [...new Set(todo)];
write('admin/check-needed.md', `# [확인 필요] 목록 (${fmtKo(NOW)} 기준, ${todoList.length}개)\n\n관리 화면에서 해당 글의 빈 칸을 공식 출처로 확인해 채우면 이 목록에서 사라집니다.\n\n${todoList.map((t) => `- ${t}`).join('\n')}\n`);
console.log(`[확인 필요] ${todoList.length}개 → ${OUT}/admin/check-needed.md`);

console.log(`완료: ${all.length}개 글 → ${OUT}/ (경고 ${warnings.length}개)`);
