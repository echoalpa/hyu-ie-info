// 한양대학교 서울캠퍼스 공식 학사일정을 읽어 data/academic.yml 로 저장합니다.
// GitHub Actions가 매일 실행합니다. 학교 사이트에 접속하지 못하면 기존 파일을 그대로 둡니다.
// 사용: node scripts/fetch-academic.mjs            (학교 사이트에서 가져오기)
//       node scripts/fetch-academic.mjs <파일.txt>  ("시작|종료|제목" 줄 목록에서 만들기)
import fs from 'node:fs';
import yaml from 'js-yaml';

const PAGE = 'https://www.hanyang.ac.kr/-33'; // 서울캠퍼스 학사일정
const P = 'kr_ac_hanyang_calendar_web_portlet_CalendarViewPortlet';
const api = (y) => `${PAGE}?p_p_id=${P}&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_${P}_cmd=get_term_events&_${P}_sYear=${y}`;
const FILE = 'data/academic.yml';
const SKIP = /\(ERICA\)/; // 산업공학과는 서울캠퍼스
const FROM = '2027-01-01'; // 이 날짜 이전에 시작하는 일정은 넣지 않음 (2026년 일정 제외)

async function fromWeb() {
  const y = Number(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4));
  const rows = [];
  for (const year of [y - 1, y, y + 1]) {
    const res = await fetch(api(year), { headers: { 'user-agent': 'Mozilla/5.0 (hyu-ie-info academic calendar sync)', accept: 'application/json' } });
    if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
    let j = await res.json();
    if (typeof j === 'string') j = JSON.parse(j);
    if (j && j.data) j = typeof j.data === 'string' ? JSON.parse(j.data) : j.data;
    if (!Array.isArray(j)) throw new Error(`${year}: 예상과 다른 응답`);
    for (const m of j) for (const e of m.events || []) rows.push([e.startDateTime.slice(0, 10), e.endDateTime.slice(0, 10), e.subject.trim()]);
  }
  return rows;
}

const rows = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => l.split('|').map((s) => s.trim()))
  : await fromWeb().catch((e) => { console.warn(`⚠ 학사일정을 가져오지 못해 기존 파일을 유지합니다: ${e.message}`); process.exit(0); });

const seen = new Set();
const items = rows
  .filter(([s, , t]) => /^\d{4}-\d\d-\d\d$/.test(s) && s >= FROM && t && !SKIP.test(t))
  .map(([start, end, title]) => ({ title: title.replace(/\s+/g, ' ').replace(/\(서울\)$/, '').trim(), start, ...(end && end !== start ? { end } : {}) }))
  .filter((i) => { const k = `${i.start}|${i.title}`; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'ko'));

if (items.length < 10) { console.warn(`⚠ 학사일정이 ${items.length}개뿐이라 저장하지 않습니다.`); process.exit(0); }

const old = fs.existsSync(FILE) ? yaml.load(fs.readFileSync(FILE, 'utf8'), { schema: yaml.CORE_SCHEMA }) : null;
if (old && JSON.stringify(old.items) === JSON.stringify(items)) { console.log('학사일정 변경 없음'); process.exit(0); }

const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
fs.writeFileSync(FILE, `# 자동 생성: 한양대학교 서울캠퍼스 공식 학사일정. 매일 자동으로 학교 홈페이지와 맞춰지니 직접 고치지 마세요.\n` +
  yaml.dump({ source: PAGE, synced_at: now, items }, { lineWidth: 200, quotingType: '"' }));
console.log(`학사일정 ${items.length}개 저장 (${FILE})`);
