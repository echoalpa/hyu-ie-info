# 산공 정보

한양대학교 산업공학과 정보를 **AI 비서가 매일 읽고 기억하도록** 모아 두는 사이트입니다.
사람이 보는 화면은 따로 없고, 학생회는 관리 화면에서 글만 쓰면 됩니다.

관리자: 정학생회장 정현우 (010-4694-8902)

| | 주소 |
|---|---|
| AI 비서에게 줄 주소 | https://echoalpa.github.io/hyu-ie-info/llms-full.txt |
| 관리 화면 | https://echoalpa.github.io/hyu-ie-info/admin/ |
| 관리자 안내 | https://echoalpa.github.io/hyu-ie-info/admin/help.html |

## 구조

```
content/          ← 글 (관리 화면에서 쓰면 여기 저장됨)
  notices/        공지사항
  events/         행사·일정
  guides/         학과 생활 가이드
  career/         커리어 아카이브
  mentors/        선배 멘토
data/
  site.yml        사이트 이름·관리자 연락처
  links.yml       바로가기 사이트
  academic.yml    한양대 서울캠퍼스 공식 학사일정 (매일 자동 동기화, 직접 수정 X)
static/           이미지·파비콘·업로드 파일
admin/            관리 화면 (Sveltia CMS)
schema.mjs        모든 입력 칸 정의 (여기만 고치면 관리 화면도 같이 바뀜)
scripts/build.mjs 사이트 생성기
```

글을 저장하면 GitHub Actions가 1~2분 안에 사이트를 다시 만들어 GitHub Pages에 올립니다.
매일 00:05(KST)에는 한양대 홈페이지(https://www.hanyang.ac.kr/-33)의 학사일정을 가져와 `data/academic.yml`을 갱신하고(`scripts/fetch-academic.mjs`), 행사의 "예정/종료" 상태도 다시 계산합니다. 학교 사이트에 접속하지 못한 날은 기존 학사일정을 그대로 씁니다.

## AI가 읽는 파일

| 파일 | 내용 |
|---|---|
| `/llms-full.txt` | **오늘 기준 전체 정보 한 파일** (최근 7일 변경, 다가오는 일정, 모든 글, 관련 링크) |
| `/` (index.html) | 위와 같은 내용을 HTML 한 장으로 |
| `/llms.txt` | 짧은 안내 + 글 목록 ([llmstxt.org](https://llmstxt.org) 형식) |
| `/api/all.json`, `/api/<분류>.json` | 구조화된 데이터 |
| `/api/upcoming.json` | 진행 중이거나 60일 안의 학사일정 + 학생회 행사 |
| `/api/academic.json` | 학사일정 전체 |
| `/api/recent.json` | 최근 7일 새로 생기거나 바뀐 글 |
| `/<분류>/<글>.md` | 각 글의 마크다운 버전 |
| `/sitemap.xml`, `/robots.txt` | 크롤러용 |

모든 글에는 **관련 링크**(외부 원문 사이트)를 붙일 수 있고, AI는 정보가 부족하면 그 링크로 넘어가 확인합니다.
모든 시간은 한국시간(KST) 기준입니다.

## 관리 화면 쓰는 법 (학생회원)

두 가지 중 편한 걸 쓰면 됩니다. 저장되는 파일은 똑같습니다.

- **Pages CMS (추천, GitHub 계정 없어도 됨)**: 학생회장이 [app.pagescms.org](https://app.pagescms.org)에서 이 저장소를 열고 Collaborators에 이메일로 초대 → 초대받은 사람은 메일 링크로 바로 편집. 설정 파일: `.pages.yml`
- **/admin (Sveltia CMS)**: 저장소 Collaborator로 초대된 GitHub 계정 + [fine-grained 토큰](https://github.com/settings/personal-access-tokens/new)(이 저장소만, Contents: Read and write)으로 로그인.

자세한 요령은 [관리자 안내](https://echoalpa.github.io/hyu-ie-info/admin/help.html)에 있습니다.

## 개발

```bash
npm install
npm run build        # _site/ 에 생성
npm run gen-config   # schema.mjs 수정 후 관리 화면 설정 재생성
```

입력 칸을 추가·변경하려면 `schema.mjs`를 고치고 `npm run gen-config`를 실행한 뒤,
필요하면 `scripts/build.mjs`의 `facts()`에 표시 방식을 추가하세요.

커스텀 도메인을 쓰게 되면 `schema.mjs`의 `site.url`만 바꾸면 됩니다.
