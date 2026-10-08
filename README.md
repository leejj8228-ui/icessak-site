# 얼음싹싹 홈페이지

인천·김포·부천 제빙기 분해 청소 — `icessak.com`

설치할 것 없이 **`node build.mjs`** 한 줄이면 `dist/` 에 사이트가 만들어집니다. (Node 18 이상)

```bash
node build.mjs          # 사이트 만들기
```

## 폴더

| 경로 | 내용 |
|---|---|
| `build.mjs` | 생성기. 데이터로 페이지를 만들고 유사도 검사까지 돌립니다 |
| `data/site.json` | 상호·전화·도메인·가격·작업 과정·로봇 설정 |
| `data/regions.json` | 인천·김포·부천 행정동 209개 → 생활권 117곳 |
| `data/qa-bank.json` | 질문답 뱅크 89개 |
| `data/cases.json` | 작업 사례 |
| `tools/` | 로마자 변환, 지역 데이터 생성, 유사도 검사 |
| `src/` | 메인 페이지 원본 (HTML·CSS·JS·이미지) |
| `brand/` | 로고 |
| `docs/` | 구조·검색 노출 설계 문서 |

## 만들어지는 페이지 (136장)

```
/                              메인
/about/                        업체 소개
/why/                          왜 청소해야 하나
/price/  /process/  /faq/      가격 · 작업 과정 · 자주 묻는 질문
/privacy/                      개인정보 안내 (수집하지 않음)
/area/                         서비스 지역
/area/<시>/                     시 (3곳)
/area/<시>/<구>/                구·군 (14곳)
/area/<시>/<구>/<동네>/          동네 (112곳)
/sitemap.xml  /robots.txt  /llms.txt
```

동네는 **생활권 단위**입니다. 구월1~4동을 `구월동` 한 장으로 묶었습니다 —
사람들이 "구월1동 제빙기 청소"가 아니라 "구월동 제빙기 청소"로 검색하고,
1동·2동으로 쪼개면 서로 거의 같은 글이 되기 때문입니다.

## 색인 판정 (자동)

빌드 끝에 동네 페이지끼리 유사도를 재고, **기준을 넘은 페이지는 지우지 않고
`noindex` 로 두고 구 페이지를 대표 주소로 지정**합니다. 주소는 살아 있어서
문자나 명함으로 보내면 그대로 열립니다. 내용이 붙어 기준을 통과하면
**다음 빌드에서 저절로 색인 대상이 됩니다.**

두 지표를 따로 봅니다.

| 지표 | 무엇을 보나 | 기준 | 막나 |
|---|---|---|---|
| **유사도** | 다른 페이지와 너무 비슷한가 (중복 판정 위험) | ≤ 0.45 | **막습니다** |
| 고유 조각 | 이 페이지에만 있는 내용이 있는가 (얇은 페이지) | ≥ 60 | 보고만 |

공용 질문답으로 만든 페이지는 같은 답이 여러 장에 쓰여 **고유 조각이 구조적으로 낮습니다.**
이 숫자는 사장님이 직접 쓰신 현장 메모가 들어가야 올라갑니다.

## 검색·AI 노출

- 모든 페이지에 같은 `LocalBusiness` 블록 (`@id` 고정) — AI가 하나의 업체로 인식
- 동네 페이지마다 `FAQPage`, `Service`, `Offer` / `/process/` 는 `HowTo`
- 페이지 맨 위 **"한 줄 답"** — 숫자가 든 직답. AI가 그대로 인용하기 좋은 형태
- `llms.txt` 에 상호·전화·지역·가격·기종·작업순서를 사실 목록으로
- `robots.txt` 에 Yeti·Googlebot·Bingbot·OAI-SearchBot·PerplexityBot·ClaudeBot 허용

**`data/site.json` 의 `identity.sameAs` 가 비어 있습니다.** 네이버 스마트플레이스·
구글 비즈니스 프로필 주소를 넣으면 AI가 같은 업체로 묶습니다. **AI 추천에 가장
크게 작용하는 부분입니다.** 업체명은 어디서나 `얼음싹싹`, 전화는 `010-8859-7950`
으로 똑같이 등록하세요.

## 공개하지 않는 것

- **사업자등록 상호** — 화면에도, 구조화 데이터에도 넣지 않습니다.
  JSON-LD 는 화면에 안 보여도 공개 데이터라 긁어가면 드러납니다.
- **주소** — 출장 업체라 공개하지 않습니다. 구조화 데이터에는 `areaServed` 만 둡니다.
- 사이트에서 **개인정보를 받지 않습니다.** 입력 폼이 없고 상담은 전화로만 받습니다.

## 지역 데이터 다시 만들기

행정동이 바뀌면 (예: 2026-07-01 인천 개편) 아래를 다시 돌립니다.

```bash
pip install pyarrow
curl -L -o /tmp/idx.parquet   https://raw.githubusercontent.com/vuski/admdongkor/master/dist/data/_index_v3.parquet
curl -L -o /tmp/bnd.geojson   https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson

python3 tools/make_regions.py   /tmp/idx.parquet data/regions.json   # 행정동 코드·이름·주소
python3 tools/make_neighbors.py /tmp/bnd.geojson data/regions.json   # 맞닿은 동
python3 tools/make_groups.py    data/regions.json                    # 생활권으로 묶기
```

출처: [vuski/admdongkor](https://github.com/vuski/admdongkor) (통계청 SGIS 행정동 경계, CC BY 4.0)

**주소(슬러그)는 한 번 공개하면 바꾸기 어렵습니다.** 검색 순위가 초기화됩니다.

## 배포

Cloudflare Pages 기준입니다.

| 항목 | 값 |
|---|---|
| 빌드 명령 | `node build.mjs` |
| 출력 디렉터리 | `dist` |

깃에 올리면 자동으로 다시 만들어 배포됩니다.
