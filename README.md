# 산공 정보 · HOMie

한양대학교 산업공학과 학생회 **HOMie**가 운영하는 학과 정보 사이트입니다.
사람도 읽고, 피클·인스팅트·ChatGPT·Claude 같은 **AI 비서도 읽도록** 만들었습니다.

| | 주소 |
|---|---|
| 공개 사이트 | https://echoalpa.github.io/hyu-ie-info/ |
| AI 비서에게 줄 주소 | https://echoalpa.github.io/hyu-ie-info/llms.txt |
| 관리 화면 | https://echoalpa.github.io/hyu-ie-info/admin/ |
| 관리자 안내 | https://echoalpa.github.io/hyu-ie-info/admin/help.html |

## 구조

```
content/          ← 글 (관리 화면에서 쓰면 여기 저장됨)
  notices/        공지사항
  events/         행사·일정
  faq/            자주 묻는 질문
  guides/         학과 생활 가이드
  career/         IE 커리어 아카이브
  mentors/        Home-coming 선배 멘토
data/
  site.yml        학생회 기본 정보·연락 창구
  links.yml       바로가기 사이트
static/           이미지·파비콘·업로드 파일
admin/            관리 화면 (Sveltia CMS)
schema.mjs        모든 입력 칸 정의 (여기만 고치면 관리 화면도 같이 바뀜)
scripts/build.mjs 사이트 생성기
```

글을 저장하면 GitHub Actions가 1~2분 안에 사이트를 다시 만들어 GitHub Pages에 올립니다.
매일 00:05(KST)에도 다시 만들어 행사의 "예정/종료" 상태를 갱신합니다.

## AI가 읽는 파일

| 파일 | 내용 |
|---|---|
| `/llms.txt` | 사이트 안내 + 모든 글 목록 ([llmstxt.org](https://llmstxt.org) 형식) |
| `/llms-full.txt` | 모든 글 전문을 한 파일로 |
| `/api/all.json`, `/api/<분류>.json` | 구조화된 데이터 |
| `/api/upcoming.json` | 아직 끝나지 않은 행사·일정 |
| `/<분류>/<글>.md` | 각 글의 마크다운 버전 |
| `/sitemap.xml`, `/robots.txt`, `/feed.xml` | 크롤러·RSS |

각 HTML 페이지에는 schema.org JSON-LD(Event, FAQPage, Article, Person)가 들어 있습니다.
모든 시간은 한국시간(KST) 기준입니다.

## 관리 화면 쓰는 법 (학생회원)

두 가지 중 편한 걸 쓰면 됩니다. 저장되는 파일은 똑같습니다.

- **Pages CMS (추천, GitHub 계정 없어도 됨)**: 학생회장이 [app.pagescms.org](https://app.pagescms.org)에서 이 저장소를 열고 Collaborators에 이메일로 초대 → 초대받은 사람은 메일 링크로 바로 편집. 설정 파일: `.pages.yml`
- **/admin (Sveltia CMS)**: 저장소 Collaborator로 초대된 GitHub 계정 + [fine-grained 토큰](https://github.com/settings/personal-access-tokens/new)(이 저장소만, Contents: Read and write)으로 로그인.

자세한 요령은 [관리자 안내](https://echoalpa.github.io/hyu-ie-info/admin/help.html)에 있습니다.

## 개발

```bash
npm install
npm run dev          # 빌드 후 http://localhost:8080/hyu-ie-info/
npm run gen-config   # schema.mjs 수정 후 관리 화면 설정 재생성
```

입력 칸을 추가·변경하려면 `schema.mjs`를 고치고 `npm run gen-config`를 실행한 뒤,
필요하면 `scripts/build.mjs`의 `facts()`에 표시 방식을 추가하세요.

커스텀 도메인을 쓰게 되면 `schema.mjs`의 `site.url`만 바꾸면 됩니다.
