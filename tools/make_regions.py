#!/usr/bin/env python3
"""행정동 코드 데이터(parquet) -> site/data/regions.json

원본: https://raw.githubusercontent.com/vuski/admdongkor/master/dist/data/_index_v3.parquet
      (통계청·행정안전부 행정동 코드를 시점별로 정리한 공개 데이터)
사용: python3 make_regions.py _index_v3.parquet ../data/regions.json
"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from romanize import romanize
import pyarrow.parquet as pq

VERSION = '20260701'          # 2026-07-01 인천 행정체제 개편 반영 시점
TARGET_SIDO = '인천광역시'
TARGET_SGG  = ['부천시', '김포시']        # 경기도

CITIES = {
    'incheon': {'name': '인천광역시', 'short': '인천'},
    'bucheon': {'name': '부천시',     'short': '부천'},
    'gimpo':   {'name': '김포시',     'short': '김포'},
}

# 2026-07-01 개편으로 새로 생긴 구 -> 옛 이름(검색·안내 병기용)
LEGACY = {
    '제물포구': ['중구', '동구'],
    '영종구':   ['중구'],
    '서해구':   ['서구'],
    '검단구':   ['서구'],
}

def slug_of(name, keep_suffix=False):
    """행정동 이름 -> 주소용 로마자 슬러그. 구월1동 -> guwol-1, 화수1·화평동 -> hwasu-1-hwapyeong"""
    suffix = ''
    m = re.search(r'(읍|면)$', name)
    if m:
        suffix = {'읍': 'eup', '면': 'myeon'}[m.group(1)]
        name = name[:-1]
    elif name.endswith('동'):
        name = name[:-1]
    parts = []
    # 한글 덩어리와 숫자를 분리하고, 가운뎃점은 구분자로
    for chunk in re.split(r'[·]', name):
        for tok in re.findall(r'[0-9]+|[가-힣]+', chunk):
            parts.append(tok if tok.isdigit() else romanize(tok))
    if suffix:
        parts.append(suffix)
    return '-'.join(p for p in parts if p)

def gu_slug(name):
    base = re.sub(r'^(부천시|인천광역시)', '', name)
    unit = 'gun' if base.endswith('군') else 'gu'
    return f'{romanize(base[:-1])}-{unit}'

def main():
    src, out = sys.argv[1], sys.argv[2]
    df = pq.read_table(src).to_pandas()
    d = df[(df.version_key == VERSION) & (df.level == 'emd')]
    rows = d[(d.sidonm == TARGET_SIDO) |
             (d.sggnm.str.startswith(tuple(TARGET_SGG)))]

    cities, problems = {}, []
    for _, r in rows.iterrows():
        if r.sidonm == TARGET_SIDO:
            city, gu_name = 'incheon', r.sggnm
        elif r.sggnm.startswith('부천시'):
            city, gu_name = 'bucheon', r.sggnm
        else:
            city, gu_name = 'gimpo', None          # 김포는 구가 없음

        c = cities.setdefault(city, {**CITIES[city], 'slug': city, 'gus': {}})
        key = gu_slug(gu_name) if gu_name else None
        g = c['gus'].setdefault(key, {
            'slug': key,
            'name': re.sub(r'^부천시', '', gu_name) if gu_name else None,
            'code': r.sggcd,
            'legacy': LEGACY.get(re.sub(r'^부천시', '', gu_name), []) if gu_name else [],
            'dongs': [],
        })
        g['dongs'].append({
            'slug': slug_of(r['name']), 'name': r['name'], 'code': r.code,
            # 아래는 사람이 채우는 칸 (SEO_PLAN 2장: 이게 있어야 동 페이지를 공개)
            'note': None, 'neighbors': [], 'travelMin': None, 'serviceable': True,
        })

    # 같은 상위 안에서 슬러그가 겹치는지 검사
    for c in cities.values():
        for g in c['gus'].values():
            seen = {}
            for dd in g['dongs']:
                seen.setdefault(dd['slug'], []).append(dd['name'])
            for s, names in seen.items():
                if len(names) > 1:
                    problems.append(f"{c['short']} {g['name'] or ''} 슬러그 중복 {s}: {names}")

    data = {
        '_출처': 'admdongkor _index_v3.parquet (통계청·행안부 행정동 코드)',
        '_시점': f'{VERSION[:4]}-{VERSION[4:6]}-{VERSION[6:]} (인천 행정체제 개편 반영)',
        '_주의': 'note(상권 메모)·neighbors·travelMin 은 사람이 채워야 하는 칸입니다. 비어 있으면 동 페이지를 만들지 않습니다.',
        'cities': [{**c, 'gus': list(c['gus'].values())} for c in cities.values()],
    }
    pathlib.Path(out).write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    n_gu = sum(len([g for g in c['gus'].values() if g['slug']]) for c in cities.values())
    n_dong = sum(len(g['dongs']) for c in cities.values() for g in c['gus'].values())
    print(f'시 {len(cities)} · 구/군 {n_gu} · 행정동 {n_dong} -> {out}')
    for p in problems:
        print('  ✗', p)
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main())
