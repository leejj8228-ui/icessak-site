#!/usr/bin/env python3
"""지역 페이지 유사도 검사 (표준 라이브러리만 사용)

빌드된 HTML에서 본문(<main>)만 뽑아, 공통 블록(data-shared 표시)을 뺀 뒤
한글 글자 3-그램 집합의 자카드 유사도를 페이지 쌍마다 계산한다.
기준을 넘는 쌍과, 고유 문장이 너무 적은 페이지를 보고한다.

사용: python3 page_similarity.py 빌드폴더 [--max-sim 0.45] [--min-unique 600]
       [--list 목록파일]  검사할 페이지만 적은 파일(한 줄에 하나, 빌드폴더 기준 상대경로)
       [--warn]           위반이 있어도 종료 코드 0 (참고용 보고)
종료 코드 1 = 기준 위반 (배포 막기용)

기준값(0.45 / 600)은 SEO_PLAN 3-2 의 **동 페이지** 공개 기준입니다.
구·시·공통 페이지는 길잡이 역할이라 원래 짧고 틀이 같으므로, 같은 잣대로 재지 않습니다.
"""
import argparse, html, itertools, pathlib, re, sys
from html.parser import HTMLParser

# 닫는 태그가 없는 요소. 이걸 세어 버리면 그 뒤 본문이 통째로 날아간다.
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'}
SKIP_TAGS = ('script', 'style', 'nav')

class MainText(HTMLParser):
    """<main> 안의 글자만 모은다. data-shared 가 붙은 가지와 script/style/nav 는 건너뛴다."""
    def __init__(self):
        super().__init__()
        self.in_main = 0
        self.stack = []        # 열려 있는 태그 이름 (void 제외)
        self.skip_from = None  # 건너뛰기 시작한 깊이
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        start_skip = self.skip_from is None and (
            dict(attrs).get('data-shared') is not None or tag in SKIP_TAGS)
        self.stack.append(tag)
        if start_skip:
            self.skip_from = len(self.stack)
        if tag == 'main':
            self.in_main += 1

    def handle_startendtag(self, tag, attrs):
        pass                   # <br/> 같은 자기완결 태그는 무시

    def handle_endtag(self, tag):
        if tag in VOID or tag not in self.stack:
            return
        while self.stack:                      # 안 닫힌 태그가 있어도 복구되게
            t = self.stack.pop()
            if self.skip_from is not None and len(self.stack) < self.skip_from:
                self.skip_from = None
            if t == 'main':
                self.in_main -= 1
            if t == tag:
                break

    def handle_data(self, d):
        if self.in_main and self.skip_from is None:
            self.parts.append(d)

def text_of(path):
    p = MainText(); p.feed(path.read_text(encoding='utf-8'))
    return re.sub(r'\s+', ' ', html.unescape(' '.join(p.parts))).strip()

def shingles(t, n=3):
    t = re.sub(r'[^0-9A-Za-z가-힣]', '', t)
    return {t[i:i+n] for i in range(len(t) - n + 1)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('root'); ap.add_argument('--max-sim', type=float, default=0.45)
    ap.add_argument('--min-unique', type=int, default=60, help='다른 페이지와 겹치지 않는 3-그램 최소 개수')
    ap.add_argument('--quiet', action='store_true', help='위반만 출력')
    ap.add_argument('--list', help='검사할 페이지 목록 파일 (빌드폴더 기준 상대경로)')
    ap.add_argument('--warn', action='store_true', help='위반이 있어도 종료 코드 0')
    ap.add_argument('--label', default='페이지', help='보고에 쓸 이름')
    ap.add_argument('--top', type=int, default=5, help='참고용 보고에서 보여 줄 개수')
    ap.add_argument('--json', help='페이지별 판정을 JSON 으로 저장 (빌드가 색인 여부를 정하는 데 씀)')
    a = ap.parse_args()
    root = pathlib.Path(a.root)
    if a.list:
        want = [l.strip() for l in pathlib.Path(a.list).read_text(encoding='utf-8').splitlines() if l.strip()]
        pages = [root / w for w in want if (root / w).exists()]
    else:
        pages = sorted(root.rglob('*.html'))
    if len(pages) < 2:
        print(f'{a.label} {len(pages)}장 — 비교할 쌍이 없어 건너뜁니다.')
        return 0
    name = {p: str(p.relative_to(root).parent) + '/' for p in pages}
    sh = {p: shingles(text_of(p)) for p in pages}

    empty = [p for p in pages if not sh[p]]
    bad = len(empty)
    print(f'{a.label} {len(pages)}장 비교 (기준: 유사도 ≤ {a.max_sim}, 고유 3-그램 ≥ {a.min_unique})')
    for p in empty:
        print(f'  ✗ 본문을 못 읽음: {name[p]}')

    pairs = []
    for x, y in itertools.combinations(pages, 2):
        u = sh[x] | sh[y]
        pairs.append((len(sh[x] & sh[y]) / len(u) if u else 0, x, y))
    pairs.sort(reverse=True, key=lambda t: t[0])
    over = [t for t in pairs if t[0] > a.max_sim]
    bad += len(over)

    lows = []
    for p in pages:
        others = set().union(*(sh[q] for q in pages if q != p)) if len(pages) > 1 else set()
        uniq = len(sh[p] - others)
        if uniq < a.min_unique and sh[p]:
            lows.append((uniq, p)); bad += 1

    # 참고용(--warn)일 때는 가장 나쁜 몇 개만 보여 준다
    cap = a.top if a.warn else len(pages) ** 2
    for s_, x, y in (over if not a.quiet else over)[:cap]:
        print(f'  {s_:.2f}  {name[x]} ↔ {name[y]}  ✗ 초과')
    if len(over) > cap:
        print(f'  … 유사도 초과 {len(over)}쌍 중 위 {cap}쌍만 표시')
    lows.sort()
    for uniq, p in lows[:cap]:
        print(f'  고유 {uniq:5d}  {name[p]}  ✗ 고유 내용 부족')
    if len(lows) > cap:
        print(f'  … 고유 내용 부족 {len(lows)}장 중 위 {cap}장만 표시')

    if a.json:
        import json as _json
        worst = {str(p.relative_to(root)): 0.0 for p in pages}
        for s_, x, y in pairs:
            for q in (x, y):
                k = str(q.relative_to(root))
                if s_ > worst[k]: worst[k] = s_
        uniq_of = {}
        for p_ in pages:
            others = set().union(*(sh[q] for q in pages if q != p_)) if len(pages) > 1 else set()
            uniq_of[str(p_.relative_to(root))] = len(sh[p_] - others)
        out = {k: {'maxSim': round(worst[k], 3), 'unique': uniq_of[k],
                   'pass': worst[k] <= a.max_sim and uniq_of[k] >= a.min_unique}
               for k in worst}
        pathlib.Path(a.json).write_text(_json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'  판정 저장: {a.json}  (통과 {sum(1 for v in out.values() if v["pass"])}/{len(out)})')

    print(f'  위반 {bad}건' + ('  (참고용, 배포는 막지 않음)' if a.warn and bad else ''))
    return 1 if (bad and not a.warn) else 0

if __name__ == '__main__':
    sys.exit(main())
