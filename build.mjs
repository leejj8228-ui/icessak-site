#!/usr/bin/env node
/* 얼음싹싹 지역형 사이트 생성기 — 의존성 없음 (node 18+)
 *
 *   node build.mjs [--out dist]
 *
 * data/regions.json + data/cases.json + data/site.json 으로
 * 메인(v3 복사) · 서비스 지역 · 시 · 구 · 동 · 공통 페이지 · sitemap · robots 를 만든다.
 * 동 페이지는 SEO_PLAN.md 3-2 공개 기준(A/B/C)을 통과한 것만 만든다.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = join(HERE, process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1] : 'dist');

const read = (p) => JSON.parse(readFileSync(join(HERE, p), 'utf8'));
const SITE = read('data/site.json');
const REGIONS = read('data/regions.json');
const CASES = read('data/cases.json');
const QA = read('data/qa-bank.json').items;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const write = (rel, body) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
};

/* ---------------------------------------------------------------- 공개 등급
 * A = 작업 사례 1건 이상 + 상권 메모      -> 색인, 사이트맵 포함
 * B = 메모나 출장 정보만                  -> noindex, 구 페이지로 canonical
 * C = 이름뿐                              -> 페이지를 만들지 않음
 */
const casesOf = (dongSlug) =>
  (CASES.cases ?? []).filter((c) => c.dong === dongSlug);

// --all : 출장 가능한 동은 사례·메모가 없어도 페이지를 만든다 (실험·측정용)
const ALL_DONGS = process.argv.includes('--all');

function grade(dong) {
  if (!dong.serviceable) return 'C';          // 배로만 가는 섬 — 페이지 없음
  return 'B';   // 출장 가는 곳은 전부 페이지를 만든다. 색인 여부는 유사도 검사가 정한다.
}

/* 광고용 전후 사진 — 사장님이 직접 찍은 실제 청소 전후 사진.
 * 특정 매장·동을 지목하지 않고 "이렇게 청소합니다"로 공통으로 쓴다. */
const AD_PHOTOS = [
  ['/images/cases/b-parts-before.jpg', '/images/cases/b-parts-after.jpg', '분배관·호스'],
  ['/images/cases/d-pump-before.jpg', '/images/cases/d-pump-after.jpg', '순환 펌프'],
  ['/images/cases/d-tray-before.jpg', '/images/cases/d-tray-after.jpg', '물받이 트레이'],
];
const adBand = () => `
<section class="lsec" data-shared><div class="wrap">
  <h2>분해 세척 전후</h2>
  <div class="cases">${AD_PHOTOS.map(([b, a, t]) => `<div class="case">
    <div class="case__img"><img src="${b}" alt="청소 전 ${t}" loading="lazy"><img src="${a}" alt="청소 후 ${t}" loading="lazy"></div>
    <div class="case__body"><h3>${t}</h3></div></div>`).join('')}</div>
  <p class="muted">얼음싹싹이 직접 작업하고 찍은 사진입니다. 매장 정보는 담지 않았습니다.</p>
</div></section>`;


/* ---------------------------------------------------------------- 쪽마다 다르게
 * 같은 글이 112장 반복되면 검색엔진이 한 장만 남기고 버린다.
 * 그래서 쪽마다 (1) 들어가는 질문답 묶음 (2) 문단 순서 (3) 첫 문장을 다르게 한다.
 * 슬러그에서 뽑은 값으로 정하므로 빌드할 때마다 같은 결과가 나온다.
 */
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shuffled = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
/* 질문답 n개 고르기.
 * 쪽마다 고르게 흩어지도록 전체를 섞어 앞에서 가져오되, 한 갈래에서 2개를 넘지 않게 해
 * 주제가 한쪽으로 쏠리지 않게 한다. */
function pickQA(key, n) {
  const rnd = seedOf(key + ':qa');
  const out = [], used = {};
  for (const x of shuffled(QA, rnd)) {
    if ((used[x.tag] ?? 0) >= 2) continue;
    used[x.tag] = (used[x.tag] ?? 0) + 1;
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

const TITLE_TAIL = ['분해 세척', '출장 청소', '수조·배관 세척', '방문 분해 청소', '얼음 위생 관리'];
const LEAD = [
  (n) => `${n} 어디든 찾아갑니다. 분해 세척 <em>50kg 이하 10만원</em>부터, 약 2시간.`,
  (n) => `${n} 출장합니다. 수조·배관·분배기까지 <em>전부 분해</em>해서 씻습니다.`,
  (n) => `${n} 제빙기, 전화 한 통이면 <em>견적부터</em> 나옵니다. 50kg 이하 10만원부터.`,
  (n) => `${n}에서 영업하신다면, 제빙기 안쪽은 <em>6개월이면</em> 눈에 띄게 달라집니다.`,
  (n) => `${n} 방문 작업. 분해부터 시운전까지 <em>약 2시간</em>, 기록지를 드립니다.`,
];

/* ---------------------------------------------------------------- 공통 틀 */
const TEL_HREF = `tel:${SITE.tel}`;

function layout({ url, title, desc, crumb = [], body, noindex = false, canonical, jsonld = [] }) {
  const abs = SITE.origin + url;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<link rel="canonical" href="${esc(canonical ?? abs)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/assets/region.css">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(abs)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${SITE.origin}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE.origin}/assets/og.png">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="top" data-shared>
  <div class="wrap top__inner">
    <a class="logo" href="/" aria-label="${esc(SITE.name)} 처음으로"><img src="/assets/logo.svg" alt="${esc(SITE.name)}" width="129" height="32"></a>
    <nav class="nav" aria-label="주요 메뉴">
      <a href="/area/">서비스 지역</a>
      <a href="/why/">왜 청소하나</a>
      <a href="/price/">가격</a>
      <a href="/faq/">자주 묻는 질문</a>
    </nav>
    <a class="top__tel" href="${TEL_HREF}">${esc(SITE.tel)}</a>
    <a class="btn btn--blue top__cta" href="${TEL_HREF}">전화 견적</a>
  </div>
</header>
${crumb.length ? `<nav class="wrap crumb" aria-label="이동 경로" data-shared>${crumb
    .map((c, i) => (i === crumb.length - 1
      ? `<b>${esc(c.name)}</b>`
      : `<a href="${c.url}">${esc(c.name)}</a><span>›</span>`)).join('')}</nav>` : ''}
<main id="main">
${body}
</main>
<footer class="foot" data-shared>
  <div class="wrap">
    <p><strong>${esc(SITE.name)}</strong> · ${esc(SITE.tagline)}</p>
    <p><a href="${TEL_HREF}">${esc(SITE.tel)}</a></p>
    <nav><a href="/about/">업체 소개</a> · <a href="/area/">서비스 지역</a> · <a href="/why/">왜 청소하나</a> · <a href="/price/">가격</a> · <a href="/process/">작업 과정</a> · <a href="/faq/">자주 묻는 질문</a> · <a href="/privacy/">개인정보 안내</a></nav>
  </div>
</footer>
</body>
</html>
`;
}

/* 상담 유도 띠 (공통) */
const ctaBand = (headline) => `
<section class="cta-band" data-shared><div class="wrap row">
  <div><h2>${esc(headline)}</h2><p>브랜드와 용량만 말씀해 주세요. 모르시면 제빙기 사진 한 장만 찍어 보내 주셔도 됩니다.</p></div>
  <a class="tel" href="${TEL_HREF}">${esc(SITE.tel)}</a>
</div></section>`;


/* 첫 화면에 쓸 전후 사진 한 쌍과, 아래에 더 보여 줄 나머지 */
function photoSet(key) {
  const i = Math.floor(seedOf(key + ':pic')() * AD_PHOTOS.length);
  return { head: AD_PHOTOS[i], rest: AD_PHOTOS.filter((_, j) => j !== i) };
}

/* 손님이 처음 보는 쪽이라 사진과 전문성을 맨 위에 둔다.
 * 문구는 모든 쪽이 같으므로 data-shared 로 표시해 비교에서 뺀다. */
const leadShot = ({ kicker, title, pics, extra = '' }) => `
<section class="lhero lead-shot"><div class="wrap lead-shot__grid">
  <div>
    <p class="kicker">${esc(kicker)}</p>
    <h1>${title}</h1>
    <div data-shared>
      <p class="pitch">겉만 닦지 않습니다. <em>수조·급수관·분배관·제빙판·순환 펌프까지</em> 전부 떼어 내 씻습니다.</p>
      <p class="sub">제빙기만 다룹니다. 분해부터 시운전까지 약 2시간, 50kg 이하 10만원부터.</p>
    </div>
    ${extra}
    <div class="acts" data-shared>
      <a class="btn btn--blue btn--lg" href="${TEL_HREF}">${esc(SITE.tel)} 전화 견적</a>
      <a class="btn btn--ghostb" href="/process/">작업 과정 보기 →</a>
    </div>
  </div>
  <div class="lead-shot__pics">
    <figure><img src="${pics.head[0]}" alt="청소 전 ${esc(pics.head[2])}"><figcaption>청소 전</figcaption></figure>
    <figure><img src="${pics.head[1]}" alt="청소 후 ${esc(pics.head[2])}"><figcaption>청소 후</figcaption></figure>
  </div>
</div></section>`;

/* 말 대신 사실로 적은 근거 4칸 */
const trustRow = () => `
<section class="lsec" data-shared style="padding:36px 0"><div class="wrap"><div class="trust">
  <div><b>분해 범위</b><p>5개 부위 전부<small>수조·급수관·분배관·제빙판·펌프</small></p></div>
  <div><b>세척 방식</b><p>고온 스팀 + 식품용 세정제<small>헹군 뒤 첫 얼음은 버립니다</small></p></div>
  <div><b>작업 시간</b><p>약 2시간<small>제빙기만 멈추고 영업은 그대로</small></p></div>
  <div><b>남는 것</b><p>전후 사진과 기록지<small>작업 당일 문자로 전달</small></p></div>
</div></div></section>`;

/* 아래쪽에 전후 사진 더 */
const morePhotos = (rest) => `
<section class="lsec" data-shared><div class="wrap">
  <h2>이렇게 달라집니다</h2>
  <div class="cases">${rest.map(([b, a, t]) => `<div class="case">
    <div class="case__img"><img src="${b}" alt="청소 전 ${t}" loading="lazy"><img src="${a}" alt="청소 후 ${t}" loading="lazy"></div>
    <div class="case__body"><h3>${t}</h3></div></div>`).join('')}</div>
  <p class="muted">얼음싹싹이 직접 작업하고 찍은 사진입니다. 매장 정보는 담지 않았습니다.</p>
</div></section>`;

/* ---------------------------------------------------------------- 지역 훑기 */
const cityOf = (slug) => REGIONS.cities.find((c) => c.slug === slug);
const allGus = REGIONS.cities.flatMap((c) =>
  c.gus.filter((g) => g.slug).map((g) => ({ city: c, gu: g })));
// 생활권 묶음(구월1~4동 = 구월동)이 페이지 단위다
const allDongs = REGIONS.cities.flatMap((c) =>
  c.gus.flatMap((g) => (g.groups ?? []).map((d) => ({ city: c, gu: g, dong: d, grade: grade(d) }))));

const dongUrl = ({ city, gu, dong }) =>
  gu.slug ? `/area/${city.slug}/${gu.slug}/${dong.slug}/` : `/area/${city.slug}/${dong.slug}/`;
const guUrl = (city, gu) => (gu.slug ? `/area/${city.slug}/${gu.slug}/` : `/area/${city.slug}/`);

/* ---------------------------------------------------------------- 공통 조각 */
const priceTable = () => `
<table class="price-mini">
  <thead><tr>${SITE.price.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>
    ${SITE.price.rows.map((r) =>
      `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((v) => `<td><b>${esc(v)}</b></td>`).join('')}</tr>`).join('')}
    <tr><th scope="row">${esc(SITE.price.callRow)}</th><td colspan="${SITE.price.head.length - 1}"><a href="${TEL_HREF}">전화로 견적 안내 →</a></td></tr>
  </tbody>
</table>
<p class="muted">${esc(SITE.price.warn)}</p>`;

/* AI가 "얼음싹싹"을 하나의 업체로 인식하게 하는 핵심 블록.
 * 이름·전화·지역을 사이트·스마트플레이스·구글 프로필에서 똑같이 쓰고,
 * sameAs 로 그 출처들을 묶어 줘야 AI가 같은 업체로 본다. */
const ID = SITE.identity ?? {};
const localBusiness = (areaNames) => {
  const o = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE.origin}/#business`,
    name: SITE.name,
    telephone: SITE.tel,
    url: SITE.origin,
    description: `${SITE.name}은 상업용 제빙기를 분해해 수조·급수관·분배관·제빙판·순환 펌프를 고온 스팀과 식품용 세정제로 세척하는 방문 서비스입니다. 인천·김포·부천 출장, 50kg 이하 10만원부터, 작업 약 2시간.`,
    knowsAbout: ['제빙기 청소', '제빙기 분해 세척', '카이저 제빙기', '호시자키 제빙기', '아이스트로 제빙기', '매니토웍 제빙기', '얼음 위생'],
    areaServed: areaNames.map((n) => ({ '@type': 'AdministrativeArea', name: n })),
    makesOffer: {
      '@type': 'Offer', priceCurrency: 'KRW',
      itemOffered: { '@type': 'Service', name: '제빙기 분해 청소' },
      priceSpecification: { '@type': 'PriceSpecification', minPrice: '100000', priceCurrency: 'KRW' },
    },
  };
  if (ID.legalName) o.legalName = ID.legalName;
  if (ID.founded) o.foundingDate = ID.founded;
  if ((ID.sameAs ?? []).length) o.sameAs = ID.sameAs;
  return o;
};

/* AI 검색(ChatGPT·Perplexity·네이버 AI 브리핑)이 인용하기 쉽게:
 * 질문형 소제목 + 첫 문장에 숫자가 든 직답 + FAQPage 구조화 데이터 */
const faqPage = (items) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map((x) => ({
    '@type': 'Question', name: x.q,
    acceptedAnswer: { '@type': 'Answer', text: x.a },
  })),
});

/* 페이지 맨 위 '한 줄 답' — AI가 그대로 따 가기 좋은 형태 */
const answerBox = (q, a) => `
<section class="lsec answerbox"><div class="wrap">
  <h2>${esc(q)}</h2>
  <p class="memo"><b>${esc(a)}</b></p>
</div></section>`;

const breadcrumb = (crumb) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumb.map((c, i) => ({
    '@type': 'ListItem', position: i + 1, name: c.name,
    item: SITE.origin + (c.url ?? ''),
  })),
});

/* ---------------------------------------------------------------- 페이지들 */
const pages = [];          // {url, lastmod, index}

function page(url, html, { index = true, kind = 'hub', canonicalTo = null } = {}) {
  write(join(url, 'index.html'), html);
  pages.push({ url, index, kind, canonicalTo });
}

/* /area/ — 서비스 지역 전체 */
function buildArea() {
  const crumb = [{ name: '홈', url: '/' }, { name: '서비스 지역' }];
  const openDongs = allDongs.filter((x) => x.grade !== 'C').length;
  const body = `
<section class="lhero"><div class="wrap">
  <p class="kicker">서비스 지역</p>
  <h1>인천 · 김포 · 부천</h1>
  <p class="answer">인천·김포·부천, <em>어느 동네든</em> 찾아갑니다.</p>
  <div class="stats">
    <div><b>${REGIONS.cities.length}</b>개 시</div>
    <div><b>${allGus.length}</b>개 구·군</div>
    <div><b>${allDongs.length}</b>개 동</div>
  </div>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>시를 고르세요</h2>
  <div class="cities">
  ${REGIONS.cities.map((c) => {
    const n = c.gus.reduce((s, g) => s + g.dongs.length, 0);
    const gus = c.gus.filter((g) => g.slug);
    return `<div class="city">
      <h3><a href="/area/${c.slug}/">${esc(c.short)}</a></h3>
      <p>${gus.length ? `${gus.length}개 구·군 · ` : ''}${n}개 동</p>
      <div class="chips">${(gus.length ? gus : [{ slug: null, name: '전체 동' }])
        .map((g) => `<a class="chip" href="${guUrl(c, g)}">${esc(g.name ?? c.short)}</a>`).join('')}</div>
    </div>`;
  }).join('')}
  </div>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>동네마다 찾아갑니다</h2>
  <p class="memo">위에서 시 → 구 → 동네 순으로 들어가면 <b>동네별 안내</b>가 나옵니다.
  목록에 없는 동네도 <a href="${TEL_HREF}">전화</a> 한 통이면 바로 일정을 잡아 드립니다.</p>
</div></section>
${ctaBand('우리 지역도 오시나요? 전화 한 통이면 됩니다')}`;
  page('/area/', layout({
    url: '/area/', title: `서비스 지역 — 인천·김포·부천 제빙기 청소 | ${SITE.name}`,
    desc: `${SITE.name}이 찾아가는 인천·김포·부천 ${allDongs.length}개 동. 출장 가능 지역과 실제 작업 사례를 지역별로 확인하세요.`,
    crumb, body,
    jsonld: [localBusiness(REGIONS.cities.map((c) => c.name)), breadcrumb([{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' }])],
  }));
}

/* /area/<city>/ */
function buildCity(c) {
  const crumb = [{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' }, { name: c.short }];
  const gus = c.gus.filter((g) => g.slug);
  const n = c.gus.reduce((s, g) => s + g.dongs.length, 0);
  const body = `
<section class="lhero"><div class="wrap">
  <p class="kicker">서비스 지역</p>
  <h1>${esc(c.short)} 제빙기 청소</h1>
  <p class="answer">${esc(c.short)} <em>${n}개 동</em> 출장. 50kg 이하 10만원부터.</p>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>${esc(gus.length ? '구·군을 고르세요' : '동을 고르세요')}</h2>
  ${gus.length ? `<div class="cities">${gus.map((g) => `
    <div class="city">
      <h3><a href="${guUrl(c, g)}">${esc(g.name)}</a></h3>
      <p>${g.dongs.length}개 동${g.legacy.length ? ` · <span class="legacy">옛 ${g.legacy.join('·')}</span>` : ''}</p>
    </div>`).join('')}</div>`
    : `<div class="dong-grid">${(c.gus[0].groups ?? []).map((d) => dongCell(c, c.gus[0], d)).join('')}</div>`}
</div></section>
${c.slug === 'incheon' ? `
<section class="lsec"><div class="wrap">
  <h2>2026년 7월, 인천의 구가 바뀌었습니다</h2>
  <p class="memo">중구·동구가 <b>제물포구·영종구</b>로, 서구가 <b>서해구·검단구</b>로 나뉘었습니다.
  옛 이름으로 찾으셔도 됩니다 — 같은 지역으로 그대로 출장 갑니다.</p>
</div></section>` : ''}
${ctaBand(`${c.short} 제빙기 청소, 전화 한 통이면 견적이 나옵니다`)}`;
  page(`/area/${c.slug}/`, layout({
    url: `/area/${c.slug}/`, title: `${c.short} 제빙기 청소 · ${n}개 동 출장 | ${SITE.name}`,
    desc: `${c.short} 제빙기 분해 청소. ${gus.length ? `${gus.length}개 구·군 ` : ''}${n}개 동 출장, 전후 사진과 기록지를 드립니다.`,
    crumb, body,
    jsonld: [localBusiness([c.name]), breadcrumb([{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' }, { name: c.short, url: `/area/${c.slug}/` }])],
  }));
}

/* 동 목록의 칸 하나 (등급에 따라 링크/비링크) */
function dongCell(c, g, d) {
  const gr = grade(d);
  const label = { A: '작업 사례', B: '출장 정보', C: '' }[gr];
  if (gr === 'C') return `<span class="dong dong--c">${esc(d.name)}</span>`;
  return `<a class="dong${gr === 'B' ? ' dong--b' : ''}" href="${dongUrl({ city: c, gu: g, dong: d })}">${esc(d.name)}<small>${label}</small></a>`;
}

/* /area/<city>/<gu>/ */
function buildGu(c, g) {
  const crumb = [{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' },
    { name: c.short, url: `/area/${c.slug}/` }, { name: g.name }];
  const open = (g.groups ?? []).filter((d) => grade(d) !== 'C').length;
  const guCases = (g.groups ?? []).flatMap((d) => casesOf(d.slug));
  const pics = photoSet(guUrl(c, g));
  const guQA = pickQA(guUrl(c, g) + ":gu", 9);
  const body = `
${leadShot({ kicker: c.short, title: `${esc(g.name)} 제빙기<br>분해 청소`, pics,
   extra: g.legacy.length
     ? `<p class="sub">2026년 7월 개편 전 이름: ${esc(g.legacy.join(' · '))}</p>` : '' })}
${trustRow()}
<section class="lsec"><div class="wrap">
  <h2>${esc(g.name)}의 동네</h2>
  <div class="dong-grid">${(g.groups ?? []).map((d) => dongCell(c, g, d)).join('')}</div>
  <p class="muted">행정동으로는 ${g.dongs.length}개 동입니다: ${g.dongs.map((d) => d.name).join(' · ')}</p>
  ${g.note ? `<p class="memo">${esc(g.note)}</p>` : ''}
  ${g.water ? `<p class="memo">수돗물 경도는 ${esc(g.water)}입니다. 경도가 높을수록 물때가 빨리 쌓여 청소 주기를 짧게 잡는 것이 좋습니다.</p>` : ''}
  ${g.rounds ? `<p class="memo">${esc(g.name)}는 보통 ${esc(g.rounds)}에 순회합니다.</p>` : ''}
</div></section>
${morePhotos(pics.rest)}
<section class="lsec"><div class="wrap">
  <h2>${esc(g.name)}에서 많이 묻는 것</h2>
  <div class="faq__list">${guQA.map((x) =>
    `<details open><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}</div>
</div></section>
<section class="lsec" data-shared><div class="wrap">
  <p class="price-line">50kg 이하 10만원~ · 100kg 이하 12만원~
    <a href="/price/">가격 →</a> <a href="/why/">왜 청소하나 →</a> <a href="/faq/">자주 묻는 질문 →</a></p>
</div></section>
${ctaBand(`${g.name} 견적, 사진 한 장이면 됩니다`)}`;
  page(guUrl(c, g), layout({
    url: guUrl(c, g),
    title: `${g.name} 제빙기 청소 · ${g.dongs.length}개 동 출장 | ${SITE.name}`,
    desc: `${c.short} ${g.name} 제빙기 분해 청소. ${g.dongs.length}개 동 출장, 50kg 이하 10만원부터. 전후 사진과 기록지를 드립니다.`,
    crumb, body,
    jsonld: [
      localBusiness([`${c.name} ${g.name}`]),
      faqPage(guQA),
      breadcrumb([{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' },
        { name: c.short, url: `/area/${c.slug}/` }, { name: g.name, url: guUrl(c, g) }]),
    ],
  }));
}

function caseCard(cs) {
  return `<div class="case">
    ${cs.before && cs.after ? `<div class="case__img">
      <img src="${esc(cs.before)}" alt="청소 전 ${esc(cs.part ?? '')}" loading="lazy">
      <img src="${esc(cs.after)}" alt="청소 후 ${esc(cs.part ?? '')}" loading="lazy"></div>` : ''}
    <div class="case__body">
      <p class="case__meta">${[cs.date, cs.placeType, cs.brand].filter(Boolean).map(esc).join(' · ')}</p>
      <h3>${esc(cs.part ?? '작업 사례')}</h3>
      ${cs.comment ? `<p class="muted">${esc(cs.comment)}</p>` : ''}
    </div>
  </div>`;
}

/* /area/<city>/<gu>/<생활권>/ — 출장 가는 곳 전부. 색인 여부는 유사도 검사가 정한다 */
function buildDong({ city: c, gu: g, dong: d, grade: gr }) {
  const url = dongUrl({ city: c, gu: g, dong: d });
  const cs = casesOf(d.slug);
  const crumb = [{ name: '홈', url: '/' }, { name: '서비스 지역', url: '/area/' },
    { name: c.short, url: `/area/${c.slug}/` },
    ...(g.slug ? [{ name: g.name, url: guUrl(c, g) }] : []), { name: d.name }];
  const neighbors = (d.neighbors ?? [])
    .map((s) => allDongs.find((x) => x.dong.slug === s))
    .filter(Boolean).filter((x) => x.grade !== 'C');
  const key = url;                                   // 주소 전체를 씨앗으로 (동 이름이 겹쳐도 달라지게)
  const rnd = seedOf(key + ':layout');
  const qa = pickQA(key, 8 + Math.floor(rnd() * 4));         // 8~11개
  const pics = photoSet(key);
  const covers = (d.dongs ?? []).length > 1
    ? `<p class="sub">행정동으로는 ${d.dongs.join(' · ')}입니다.</p>` : '';

  const secQA = qa.length ? `<section class="lsec"><div class="wrap">
  <h2>${esc(d.name)}에서 많이 묻는 것</h2>
  <div class="faq__list">${qa.map((x) =>
    `<details open><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}</div>
</div></section>` : '';
  const secNear = neighbors.length ? `<section class="lsec"><div class="wrap">
  <h2>가까운 동네</h2>
  <div class="chips">${neighbors.map((x) =>
    `<a class="chip" href="${dongUrl(x)}">${esc(x.dong.name)}</a>`).join('')}
    <a class="chip chip--on" href="${guUrl(c, g)}">${esc(g.name ?? c.short)} 전체 →</a></div>
</div></section>` : '';
  const secLinks = `<section class="lsec" data-shared><div class="wrap">
  <p class="price-line">50kg 이하 10만원~ · 100kg 이하 12만원~
    <a href="/price/">가격 →</a> <a href="/why/">왜 청소하나 →</a> <a href="/faq/">자주 묻는 질문 →</a></p>
</div></section>`;

  const body = `
${leadShot({ kicker: `${c.short}${g.slug ? ` ${g.name}` : ''}`,
            title: `${esc(d.name)} 제빙기<br>분해 청소`, pics, extra: covers })}
${trustRow()}
${morePhotos(pics.rest)}
${secQA}
${secNear}
${secLinks}
${ctaBand(`${d.name} 견적, 전화 한 통이면 됩니다`)}`;

  page(url, layout({
    url,
    title: `${d.name} 제빙기 청소 · ${TITLE_TAIL[Math.floor(seedOf(key + 't')() * TITLE_TAIL.length)]} | ${SITE.name}`,
    desc: `${d.name} 제빙기 분해 청소는 50kg 이하 10만원부터, 작업 약 2시간입니다. `
      + `${c.short} ${g.name ?? ''} ${d.name} 출장. 수조·배관·분배기까지 분해해 고온 스팀으로 세척하고 기록지를 드립니다.`.replace(/\s+/g, ' '),
    crumb, body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Service',
        name: `${d.name} 제빙기 청소`,
        serviceType: '제빙기 분해 청소',
        provider: { '@type': 'LocalBusiness', name: SITE.name, telephone: SITE.tel, url: SITE.origin },
        areaServed: { '@type': 'AdministrativeArea', name: `${c.name} ${g.name ?? ''} ${d.name}`.replace(/\s+/g, ' ').trim() },
        offers: { '@type': 'Offer', priceCurrency: 'KRW', price: '100000',
          priceSpecification: { '@type': 'PriceSpecification', minPrice: '100000', priceCurrency: 'KRW',
            description: '일 생산량 50kg 이하 기준 최저가. 기종·용량·오염 정도에 따라 달라집니다.' } },
        availableChannel: { '@type': 'ServiceChannel', servicePhone: { '@type': 'ContactPoint', telephone: SITE.tel } } },
      faqPage(qa),
      breadcrumb(crumb.map((x, i) => ({ name: x.name, url: x.url ?? (i === crumb.length - 1 ? url : '') }))),
    ],
  }), { index: true, kind: 'dong', canonicalTo: guUrl(c, g) });
}

/* ---------------------------------------------------------------- 공통 페이지 */
function buildCommon() {
  const c0 = [{ name: '홈', url: '/' }];

  /* /about/ — AI가 "이 업체 믿을 만한가"를 판단할 때 보는 곳.
   * 경력·약품·장비·보험 같은 근거를 한곳에 모아 둔다. */
  const cr = ID.credentials ?? {};
  page('/about/', layout({
    url: '/about/', title: `얼음싹싹 소개 — 제빙기 청소 전문 | ${SITE.name}`,
    desc: '얼음싹싹은 인천·김포·부천에서 상업용 제빙기를 분해 청소하는 방문 서비스입니다. 50kg 이하 10만원부터, 작업 약 2시간, 전후 사진과 기록지를 드립니다.',
    crumb: [...c0, { name: '업체 소개' }],
    body: `
<section class="lhero"><div class="wrap">
  <h1>얼음싹싹은 어떤 곳인가요?</h1>
  <p class="answer">인천·김포·부천에서 <em>상업용 제빙기만</em> 전문으로 분해 청소하는 방문 서비스입니다.</p>
</div></section>
${answerBox('얼음싹싹 한눈에 보기',
  '얼음싹싹은 인천광역시·부천시·김포시에서 상업용 제빙기 분해 청소를 하는 방문 서비스입니다. '
  + '카이저·호시자키·아이스트로·매니토웍을 작업하며, 일 생산량 50kg 이하 기준 10만원부터, 작업 시간은 약 2시간입니다. '
  + `작업 중에는 제빙기만 멈추고 영업은 계속할 수 있습니다. 문의는 전화 ${SITE.tel}.`)}
<section class="lsec"><div class="wrap">
  <h2>무엇을 하나요?</h2>
  <p class="memo">겉만 닦는 청소가 아니라 <b>분해 청소</b>입니다. 수조, 급수관, 분배관, 제빙판, 순환 펌프를 떼어 내
  물때를 녹여 없애고 고온 스팀으로 씻은 뒤 식품용 세정제로 살균하고 여러 번 헹굽니다.
  다시 조립해 시운전까지 하고, 처음 나온 얼음은 전부 버립니다.</p>
  <ol class="mini-steps">${SITE.process.map(([n], i) => `<li><span>0${i + 1}</span>${esc(n)}</li>`).join('')}</ol>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>믿고 맡기셔도 되는 근거</h2>
  <div class="info"><dl>
    <dt>사용 약품</dt><dd>${esc(cr.chemicals ?? '식품용 세정제')}</dd>
    <dt>사용 장비</dt><dd>${esc(cr.equipment ?? '고온 스팀 세척기')}</dd>
    <dt>작업 기록</dt><dd>작업 전후 사진과 청소 기록지를 휴대폰으로 전달</dd>
    ${cr.experienceYears ? `<dt>경력</dt><dd>${esc(cr.experienceYears)}년</dd>` : ''}
    ${cr.jobsDone ? `<dt>작업 건수</dt><dd>${esc(cr.jobsDone)}건</dd>` : ''}
    ${cr.insurance ? `<dt>보험</dt><dd>${esc(cr.insurance)}</dd>` : ''}
  </dl></div>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>어디까지 가나요?</h2>
  <p class="memo"><b>인천광역시 전역</b>(제물포구·영종구·미추홀구·연수구·남동구·부평구·계양구·서해구·검단구·강화군·옹진군),
  <b>경기도 부천시</b>(원미구·소사구·오정구), <b>경기도 김포시</b>로 찾아갑니다.
  어느 동네든 전화 주시면 바로 일정을 잡아 드립니다. <a href="/area/">서비스 지역 전체 보기 →</a></p>
</div></section>
${adBand()}
${ctaBand('제빙기 상태가 궁금하면 전화 주세요')}`,
    jsonld: [localBusiness(REGIONS.cities.map((c) => c.name)),
      breadcrumb([{ name: '홈', url: '/' }, { name: '업체 소개', url: '/about/' }])],
  }));

  /* /why/ — "왜 청소해야 하나". 공통 내용은 여기 한 장에만 둔다. */
  const whyQA = QA.filter((x) => ['증상', '위생', '주기'].includes(x.tag));
  page('/why/', layout({
    url: '/why/', title: `제빙기 청소를 꼭 해야 하는 이유 | ${SITE.name}`,
    desc: '제빙기 안쪽에는 물때와 세균막이 쌓입니다. 얼음 냄새, 생산량 저하, 뿌연 얼음의 원인과 권장 청소 주기를 설명합니다.',
    crumb: [...c0, { name: '왜 청소해야 하나' }],
    body: `
<section class="lhero"><div class="wrap">
  <h1>제빙기, 왜 청소해야 하나요?</h1>
  <p class="answer">얼음은 <em>그대로 입에 들어가는 식품</em>인데, 제빙기 안쪽은 늘 젖어 있고 빛이 들지 않습니다.</p>
</div></section>
${answerBox('제빙기를 청소하지 않으면 어떻게 되나요?',
  '급수관과 분배관 안쪽에 미끈한 세균막(바이오필름)이 생기고 제빙판에 물때가 쌓입니다. '
  + '그러면 얼음에서 냄새가 나고, 뿌옇게 나오고, 생산량이 떨어지며 전기요금도 올라갑니다. '
  + '매일 쓰는 영업장은 3개월, 일반적으로는 6개월에 한 번 분해 청소를 권합니다.')}
<section class="lsec"><div class="wrap">
  <h2>안쪽에서 생기는 세 가지</h2>
  <div class="cases">
    <div class="case"><div class="case__body"><h3>물때(스케일)</h3>
      <p class="muted">수돗물의 칼슘·마그네슘이 제빙판과 배관에 하얗게 굳습니다. 열이 안 빠져 얼음 어는 시간이 길어집니다.</p></div></div>
    <div class="case"><div class="case__body"><h3>세균막(바이오필름)</h3>
      <p class="muted">늘 젖어 있는 급수관·분배관 안쪽에 미끈한 막이 생깁니다. 얼음 냄새의 가장 흔한 원인입니다.</p></div></div>
    <div class="case"><div class="case__body"><h3>곰팡이</h3>
      <p class="muted">빛이 들지 않는 수조와 틈새에 검은 점으로 나타납니다. 겉만 닦아서는 없어지지 않습니다.</p></div></div>
  </div>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>자주 묻는 것</h2>
  <div class="faq__list">${whyQA.map((x) =>
    `<details open><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}</div>
</div></section>
${adBand()}
${ctaBand('우리 가게 제빙기는 어떤 상태일까요?')}`,
    jsonld: [faqPage(whyQA), breadcrumb([{ name: '홈', url: '/' }, { name: '왜 청소해야 하나', url: '/why/' }])],
  }));

  page('/price/', layout({
    url: '/price/', title: `가격 — 제빙기 청소 비용 | ${SITE.name}`,
    desc: '제빙기 분해 청소 비용. 50kg 이하 10만원부터, 용량과 기종으로 정해집니다. 대형·모듈형은 전화 견적.',
    crumb: [...c0, { name: '가격' }],
    body: `
<section class="lhero"><div class="wrap">
  <h1>제빙기 청소 비용은?</h1>
  <p class="answer"><em>50kg 이하 10만원</em>부터입니다. 용량과 기종으로 정해집니다.</p>
  ${SITE.price.note ? `<p class="legacy">${esc(SITE.price.note)}</p>` : ''}
</div></section>
<section class="lsec"><div class="wrap">${priceTable()}
  <div class="chips">${SITE.price.plans.map(([a, b]) =>
    `<span class="chip"><b>${esc(a)}</b> ${esc(b)}</span>`).join('')}</div>
  <p class="muted">${esc(SITE.price.tail)}</p>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>작업 가능 기종</h2>
  <div class="chips">${SITE.brands.map(([k, e, m]) =>
    `<span class="chip"><b>${esc(k)}</b> ${esc(e)} · ${esc(m)}</span>`).join('')}</div>
</div></section>
${ctaBand('우리 제빙기는 얼마일까요?')}`,
    jsonld: [breadcrumb([{ name: '홈', url: '/' }, { name: '가격', url: '/price/' }])],
  }));

  page('/process/', layout({
    url: '/process/', title: `작업 과정 — 분해부터 시운전까지 5단계 | ${SITE.name}`,
    desc: '제빙기 분해 청소 5단계: 분해 → 물때 제거 → 고온 스팀 → 살균·헹굼 → 조립·시운전. 약 2시간, 기록지를 드립니다.',
    crumb: [...c0, { name: '작업 과정' }],
    body: `
<section class="lhero"><div class="wrap">
  <h1>어떻게 청소하나요?</h1>
  <p class="answer">분해부터 시운전까지 <em>5단계</em>, 약 2시간 걸립니다.</p>
</div></section>
<section class="lsec"><div class="wrap">
  ${SITE.process.map(([n, t], i) => `<div class="case"><div class="case__body">
    <p class="case__meta">0${i + 1}</p><h3>${esc(n)}</h3><p class="muted">${esc(t)}</p></div></div>`).join('')}
</div></section>
${ctaBand('작업 일정 잡아 드립니다')}`,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'HowTo',
        name: '제빙기 분해 청소 과정',
        totalTime: 'PT2H',
        estimatedCost: { '@type': 'MonetaryAmount', currency: 'KRW', value: '100000' },
        step: SITE.process.map(([n, t], i) => ({
          '@type': 'HowToStep', position: i + 1, name: n, text: t })) },
      breadcrumb([{ name: '홈', url: '/' }, { name: '작업 과정', url: '/process/' }])],
  }));

  page('/faq/', layout({
    url: '/faq/', title: `자주 묻는 질문 | ${SITE.name}`,
    desc: '제빙기 청소 중 영업, 청소 주기, 약품 잔류, 기계 용량 확인 등 자주 묻는 질문에 답합니다.',
    crumb: [...c0, { name: '자주 묻는 질문' }],
    body: `
<section class="lhero"><div class="wrap"><h1>자주 묻는 질문</h1></div></section>
<section class="lsec"><div class="wrap"><div class="faq__list">
  ${SITE.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</div></div></section>
${ctaBand('더 궁금한 건 전화로 물어보세요')}`,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: SITE.faq.map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      breadcrumb([{ name: '홈', url: '/' }, { name: '자주 묻는 질문', url: '/faq/' }]),
    ],
  }));

  /* 사이트에서 개인정보를 받지 않습니다(전화 상담만). 그래도 안 받는다는 사실을
   * 밝혀 두면 손님도 AI도 판단하기 쉽습니다. */
  page('/privacy/', layout({
    url: '/privacy/', title: `개인정보 안내 | ${SITE.name}`,
    desc: '얼음싹싹 홈페이지는 개인정보를 수집하지 않습니다. 상담은 전화로만 받습니다.',
    crumb: [...c0, { name: '개인정보 안내' }],
    body: `
<section class="lhero"><div class="wrap">
  <h1>개인정보를 수집하지 않습니다</h1>
  <p class="answer">이 홈페이지에는 <em>입력 폼이 없습니다</em>. 상담은 전화로만 받습니다.</p>
</div></section>
<section class="lsec"><div class="wrap">
  <h2>어떤 정보도 받지 않습니다</h2>
  <ul>
    <li>이름·연락처를 입력받는 양식이 없습니다.</li>
    <li>회원가입, 로그인, 댓글 기능이 없습니다.</li>
    <li>온라인 주문이나 결제를 받지 않습니다.</li>
    <li>전화로 주신 연락처는 상담과 작업 일정에만 쓰고 따로 보관하지 않습니다.</li>
  </ul>
  <p class="muted">앞으로 상담 양식이나 예약 기능을 넣게 되면 이 문서를 정식 개인정보처리방침으로 바꾸고
  수집 항목·보유 기간·책임자를 밝히겠습니다.</p>
</div></section>
${ctaBand('문의는 전화로 주세요')}`,
  }), { index: false });
}

/* ---------------------------------------------------------------- 산출물 */
function buildSitemap() {
  const urls = pages.filter((p) => p.index);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `  <url><loc>${SITE.origin}${p.url}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);

  const r = SITE.robots;
  write('robots.txt', `# ${SITE.name} — ${SITE.tagline}
# 검색 로봇과 AI 검색 로봇을 모두 받습니다.

User-agent: *
Allow: /

${r.allow.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n')}

${r.trainingBots.map((b) => `User-agent: ${b}\n${r.allowTraining === false ? 'Disallow' : 'Allow'}: /`).join('\n\n')}

Sitemap: ${SITE.origin}/sitemap.xml
`);

  const hub = pages.filter((p) => p.index && p.kind === 'hub');
  const dong = pages.filter((p) => p.index && p.kind === 'dong');
  write('llms.txt', `# ${SITE.name}

> ${SITE.tagline} 전문 업체. 인천·김포·부천 방문 작업. 전화 ${SITE.tel}.

## 한 줄 요약
${SITE.name}은 상업용 제빙기를 분해해 수조·급수관·분배관·제빙판·순환 펌프를
고온 스팀과 식품용 세정제로 세척하는 방문 서비스입니다.

## 사실 정보
- 상호: ${SITE.name}
- 전화: ${SITE.tel}
- 서비스 지역: 인천광역시 전역, 경기도 부천시, 경기도 김포시
- 비용: 일 생산량 50kg 이하 10만원부터, 100kg 이하 12만원부터. 호시자키는 2만원 높음.
  대형·모듈형은 전화 견적. 3개월·6개월 정기 계약은 매회 할인.
- 작업 시간: 약 2시간. 작업 중 제빙기만 정지하고 영업은 계속 가능.
- 작업 가능 기종: 카이저(IMK), 호시자키(IM-NE), 아이스트로(ICI·JETICE·IM·ID), 매니토웍(NEO·Indigo NXT)
- 작업 순서: 분해 → 물때 제거 → 고온 스팀 → 살균·헹굼 → 조립·시운전
- 권장 주기: 매일 쓰는 영업장 3개월, 일반 6개월
- 제공물: 작업 전후 사진과 청소 기록지

## 자주 묻는 질문
${QA.slice(0, 12).map((x) => `- **${x.q}** ${x.a}`).join('\n')}

## 지역 페이지
${hub.map((p) => `- ${SITE.origin}${p.url}`).join('\n')}

## 동네별 페이지 (${dong.length}곳)
${dong.map((p) => `- ${SITE.origin}${p.url}`).join('\n')}
`);
}

/* 없는 주소로 들어왔을 때 보여 줄 쪽 */
function build404() {
  write('404.html', layout({
    url: '/404.html', title: `페이지를 찾을 수 없습니다 | ${SITE.name}`,
    desc: '주소가 잘못되었거나 없어진 페이지입니다.',
    body: `
<section class="lhero"><div class="wrap">
  <h1>페이지를 찾을 수 없습니다</h1>
  <p class="answer">주소가 잘못되었거나 없어진 쪽입니다.</p>
</div></section>
<section class="lsec"><div class="wrap">
  <div class="chips">
    <a class="chip chip--on" href="/">처음으로</a>
    <a class="chip" href="/area/">서비스 지역</a>
    <a class="chip" href="/price/">가격</a>
    <a class="chip" href="/faq/">자주 묻는 질문</a>
  </div>
</div></section>
${ctaBand('찾으시는 게 있으면 전화 주세요')}`,
    noindex: true,
  }));
}

/* 메인 페이지(src/index.html)를 사이트에 맞게 손본다.
 * 원본은 홀로 쓰던 한 장짜리라 지역 페이지와 끊겨 있어서, 복사한 뒤
 * 메뉴·푸터·지역 섹션을 붙이고 "시안" 표시를 뗀다. */
function wireMainPage() {
  const f = join(OUT, 'index.html');
  let h = readFileSync(f, 'utf8');

  // 상단 메뉴에 서비스 지역
  h = h.replace('<a href="#machines">작업 기종</a>',
    '<a href="#machines">작업 기종</a>\n      <a href="/area/">서비스 지역</a>');

  // 푸터 메뉴를 실제 페이지로
  h = h.replace(/<nav class="foot__nav"[^>]*>[\s\S]*?<\/nav>/,
    `<nav class="foot__nav" aria-label="하단 메뉴">
      <a href="/about/">업체 소개</a>
      <a href="/area/">서비스 지역</a>
      <a href="/why/">왜 청소하나</a>
      <a href="/price/">가격</a>
      <a href="/process/">작업 과정</a>
      <a href="/faq/">자주 묻는 질문</a>
      <a href="/privacy/">개인정보 안내</a>
    </nav>`);

  // "시안" 표시 걷어내기 — 실제로 운영하는 사이트다
  h = h.replace('<p class="foot__note">이 페이지는 시안입니다. 가격과 사진은 확정 전 예시입니다.</p>', '');
  h = h.replace('<p class="badge">시안용 예시 가격</p>', '');
  h = h.replace('<br><small>시안: QR 이미지는 나중에 넣습니다.</small>', '');

  // 가격·문의 사이에 서비스 지역 섹션
  const guChips = REGIONS.cities.map((c) => {
    const gus = c.gus.filter((g) => g.slug);
    return `<div class="area-city">
      <h3><a href="/area/${c.slug}/">${esc(c.short)}</a></h3>
      <div class="chips">${(gus.length ? gus : [{ slug: null, name: '전체 동네' }])
        .map((g) => `<a class="chip" href="${guUrl(c, g)}">${esc(g.name ?? c.short)}</a>`).join('')}</div>
    </div>`;
  }).join('');

  const section = `
<section class="section" id="area">
  <div class="wrap">
    <header class="head center">
      <p class="kicker">서비스 지역</p>
      <h2>인천 · 김포 · 부천, 어느 동네든 찾아갑니다</h2>
    </header>
    <div class="area-cities">${guChips}</div>
    <p class="center" style="margin-top:28px">
      <a class="btn btn--ghostb" href="/area/">우리 동네 보기 →</a>
    </p>
  </div>
</section>
`;
  h = h.replace('<!-- 상담 신청 + 견적 폼 -->', section + '<!-- 상담 신청 -->');
  h = h.replace('</head>', `<link rel="canonical" href="${SITE.origin}/">
<link rel="stylesheet" href="/assets/region.css">
<meta property="og:title" content="${esc(SITE.name)}">
<meta property="og:description" content="인천·김포·부천 제빙기 분해 청소. 50kg 이하 10만원부터, 약 2시간. 전화 ${esc(SITE.tel)}">
<meta property="og:url" content="${SITE.origin}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${SITE.origin}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE.origin}/assets/og.png">
</head>`);
  writeFileSync(f, h);
}

function copyStatic() {
  // 메인 페이지와 디자인 자산은 v3 를 그대로 쓴다
  // 메인 페이지와 디자인 자산만 가져온다. 내부 문서(README·프롬프트)와 미리보기는 빼고.
  cpSync(join(HERE, 'src'), OUT, { recursive: true,
    filter: (s) => !/\/(preview|data)(\/|$)/.test(s) && !/\.md$/i.test(s) });
  
}

/* ---------------------------------------------------------------- 실행 */
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
copyStatic();
wireMainPage();
buildArea();
for (const c of REGIONS.cities) {
  buildCity(c);
  for (const g of c.gus) if (g.slug) buildGu(c, g);
}
const byGrade = { A: 0, B: 0, C: 0 };
for (const x of allDongs) {
  byGrade[x.grade]++;
  if (x.grade !== 'C') buildDong(x);
}
buildCommon();
build404();

/* 유사도 검사 (SEO_PLAN 3-1) -> 페이지마다 색인 여부 결정
 * 기준을 넘은 동네 페이지는 지우지 않고 noindex 로 두고 구 페이지를 대표 주소로 삼는다.
 * 내용이 붙어 기준을 통과하면 다음 빌드에서 저절로 색인 대상이 된다. */
function checkAndGate(kind, label, gating) {
  const mine = pages.filter((p) => p.kind === kind);
  if (mine.length < 2) { console.log(`  ${label} ${mine.length}장 — 비교할 쌍이 없어 건너뜁니다.`); return; }
  const listFile = join(HERE, `.build-${kind}.txt`);
  const jsonFile = join(HERE, `.build-${kind}.json`);
  writeFileSync(listFile, mine.map((p) => join(p.url, 'index.html').replace(/^\//, '')).join('\n'));
  const r = spawnSync('python3', ['-I', join(HERE, 'tools/page_similarity.py'), OUT,
    '--list', listFile, '--label', label, '--quiet', '--warn', '--json', jsonFile], { encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  if (r.stderr) process.stderr.write(r.stderr);
  if (!gating || !existsSync(jsonFile)) return;

  const verdict = JSON.parse(readFileSync(jsonFile, 'utf8'));
  let blocked = 0;
  for (const p of mine) {
    const v = verdict[join(p.url, 'index.html').replace(/^\//, '')];
    if (!v || v.pass) continue;
    p.index = false; blocked++;
    const f = join(OUT, p.url, 'index.html');
    let html = readFileSync(f, 'utf8');
    html = html.replace('<link rel="canonical"',
      '<meta name="robots" content="noindex, follow">\n<link rel="canonical"');
    if (p.canonicalTo) {
      html = html.replace(/<link rel="canonical" href="[^"]*">/,
        `<link rel="canonical" href="${SITE.origin}${p.canonicalTo}">`);
    }
    writeFileSync(f, html);
  }
  if (blocked) {
    console.log(`  -> ${blocked}장을 noindex 로 두고 상위 페이지를 대표 주소로 지정했습니다.`);
    console.log('     (페이지는 살아 있습니다. 내용이 붙으면 다음 빌드에서 색인 대상이 됩니다.)');
  }
}

console.log(`페이지 ${pages.length}장 -> ${OUT}`);
console.log(`  허브(지역·시·구) ${1 + REGIONS.cities.length + allGus.length}장`);
console.log(`  동네 ${allDongs.length}곳 중 페이지 ${allDongs.filter((x) => x.grade !== 'C').length}장 ` +
            `(배로만 가는 섬 ${allDongs.filter((x) => x.grade === 'C').length}곳 제외)`);

console.log('\n유사도 검사');
checkAndGate('dong', '  동네 페이지', true);
checkAndGate('hub', '  지역 페이지', false);

buildSitemap();        // 색인 판정이 끝난 뒤에 사이트맵을 쓴다
const indexed = pages.filter((p) => p.index).length;
console.log(`\n사이트맵에 넣은 주소 ${indexed}개 / 전체 ${pages.length}장`);
console.log('빌드 완료.');
