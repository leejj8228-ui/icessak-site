#!/usr/bin/env python3
"""행정동을 생활권 이름으로 묶는다. 구월1~4동 -> 구월동 한 장.

사람들은 "구월1동 제빙기 청소"가 아니라 "구월동 제빙기 청소"로 검색한다.
1동·2동으로 쪼개면 서로 거의 같은 글이 되어 검색엔진이 한 장만 남긴다.

사용: python3 make_groups.py ../data/regions.json
"""
import json, re, sys, collections, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from romanize import romanize

def base(name):
    """구월1동 -> 구월동 / 화수1·화평동 -> 화수동 / 강화읍 -> 강화읍"""
    suf = name[-1] if name[-1] in '읍면동' else '동'
    n = re.sub(r'(읍|면|동)$', '', name)
    return re.sub(r'\d+$', '', n.split('·')[0]) + suf

def slug_of(name):
    n = re.sub(r'(읍|면|동)$', '', name)
    return romanize(n) + {'읍': '-eup', '면': '-myeon'}.get(name[-1], '')

def main():
    path = sys.argv[1]
    reg = json.load(open(path, encoding='utf-8'))
    for c in reg['cities']:
        for g in c['gus']:
            groups = collections.OrderedDict()
            for d in g['dongs']:
                b = base(d['name'])
                grp = groups.setdefault(b, {
                    'slug': slug_of(b), 'name': b, 'dongs': [], 'codes': [],
                    'neighbors': [], 'serviceable': False,
                    'note': None, 'qa': [],      # 사람이 채우는 칸
                })
                grp['dongs'].append(d['name'])
                grp['codes'].append(d['code'])
                grp['serviceable'] = grp['serviceable'] or d['serviceable']
                d['group'] = grp['slug']
            g['groups'] = list(groups.values())

    slug_by_code, by_slug = {}, {}
    for c in reg['cities']:
        for g in c['gus']:
            for grp in g['groups']:
                by_slug[grp['slug']] = grp
                for code in grp['codes']:
                    slug_by_code[code] = grp['slug']
    for c in reg['cities']:
        for g in c['gus']:
            for d in g['dongs']:
                me = by_slug[d['group']]
                for code in d.get('_neighborCodes', []):
                    s = slug_by_code.get(code)
                    if s and s != me['slug'] and s not in me['neighbors']:
                        me['neighbors'].append(s)
    for grp in by_slug.values():
        grp['neighbors'] = grp['neighbors'][:6]

    json.dump(reg, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    open(path, 'a', encoding='utf-8').write('\n')
    h = sum(len(g['dongs']) for c in reg['cities'] for g in c['gus'])
    print(f'행정동 {h}개 -> 묶음 {len(by_slug)}개')
    print(f'  여러 행정동을 묶은 곳 {sum(1 for g in by_slug.values() if len(g["dongs"]) > 1)}개')
    print(f'  출장 가능 묶음 {sum(1 for g in by_slug.values() if g["serviceable"])}개')

if __name__ == '__main__':
    main()
