#!/usr/bin/env python3
"""행정동 경계에서 '맞닿은 동'을 계산해 regions.json 의 neighbors 를 채운다.

원본: https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
      (통계청 SGIS 행정동 경계, CC BY 4.0)
사용: python3 make_neighbors.py 경계.geojson ../data/regions.json
경계선을 몇 점이나 같이 쓰는지로 맞닿은 정도를 재고, 많이 닿은 순으로 최대 6곳을 남긴다.
"""
import json, sys, collections

def rings(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon':   return c
    if t == 'MultiPolygon': return [r for poly in c for r in poly]
    return []

def main():
    src, regions_path = sys.argv[1], sys.argv[2]
    gj = json.load(open(src, encoding='utf-8'))
    reg = json.load(open(regions_path, encoding='utf-8'))

    # regions.json 의 동을 행정동 코드로 찾을 수 있게 만든다
    by_code, meta = {}, {}
    for c in reg['cities']:
        for g in c['gus']:
            for d in g['dongs']:
                by_code[d['code']] = d
                meta[d['code']] = (c['slug'], g['slug'])

    # 꼭짓점 -> 그 점을 쓰는 동들
    pt = collections.defaultdict(set)
    for ft in gj['features']:
        code = ft['properties'].get('adm_cd2')
        if code not in by_code:
            continue
        for ring in rings(ft['geometry']):
            for x, y in ring:
                pt[(round(x, 6), round(y, 6))].add(code)

    shared = collections.Counter()
    for codes in pt.values():
        if len(codes) < 2: continue
        cs = sorted(codes)
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                shared[(cs[i], cs[j])] += 1

    touch = collections.defaultdict(list)
    for (a, b), n in shared.items():
        touch[a].append((n, b)); touch[b].append((n, a))

    filled = 0
    for code, d in by_code.items():
        near = sorted(touch.get(code, []), reverse=True)
        # 같은 구 안을 먼저, 그 다음 다른 구
        same = [c for _, c in near if meta[c] == meta[code]]
        other = [c for _, c in near if meta[c] != meta[code]]
        picks = (same + other)[:6]
        d['neighbors'] = [by_code[c]['slug'] for c in picks]
        d['_neighborCodes'] = picks
        if picks: filled += 1

    json.dump(reg, open(regions_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(regions_path, 'a', encoding='utf-8').write('\n')
    print(f'맞닿은 동 채움: {filled}/{len(by_code)}')
    none = [by_code[c]['name'] for c in by_code if not by_code[c]['neighbors']]
    if none: print('  맞닿은 동 없음(섬 등):', ', '.join(none))

if __name__ == '__main__':
    main()
