/* 정적 파일을 그대로 내보내되, XML·TXT 는 형식을 못 박는다.
 *
 * Cloudflare 는 응답을 HTML 로 판단하면 스크립트를 끼워 넣는 기능들이 있다
 * (로켓 로더, 이메일 주소 숨김, 봇 파이트 모드 등). sitemap.xml 에 <script> 가
 * 섞여 들어가 검색엔진이 사이트맵을 거부할 수 있어, 형식을 분명히 지정해 막는다.
 */
const TYPES = [
  [/\.xml$/, 'application/xml; charset=utf-8'],
  [/\.txt$/, 'text/plain; charset=utf-8'],
];

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const path = new URL(request.url).pathname;
    const hit = TYPES.find(([re]) => re.test(path));
    if (!hit) return res;

    const headers = new Headers(res.headers);
    headers.set('content-type', hit[1]);
    headers.set('x-robots-tag', 'noindex');   // 사이트맵·robots 자체는 검색 결과에 뜰 필요가 없다
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
