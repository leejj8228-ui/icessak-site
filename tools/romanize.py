#!/usr/bin/env python3
"""한글 지명 -> 로마자(국어의 로마자 표기법) 변환. 표준 라이브러리만 사용.

주소(슬러그)용이라 붙임표·대문자 없이 소문자만 낸다.
자음 동화(비음화·유음화)와 연음을 반영한다.
"""
CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
# 종성 대표음(음가). 빈 문자열 = 받침 없음
JONG = ['','k','k','k','n','n','n','t','l','l','l','l','l','l','l','l','m','p','p','t','t','ng','t','t','k','t','p','t']
# 종성 글자별 '연음될 때' 실제 소리 (뒤에 모음이 오면 이 소리가 초성으로 넘어감)
JONG_LINK = ['','g','kk','gs','n','nj','nh','d','r','lg','lm','lb','ls','lt','lp','lh','m','b','bs','s','ss','ng','j','ch','k','t','p','h']

def decompose(ch):
    c = ord(ch) - 0xAC00
    if not (0 <= c < 11172):
        return None
    return c // 588, (c % 588) // 28, c % 28

def romanize(word):
    """한글 단어 하나를 로마자로. 한글 아닌 글자는 그대로 둔다."""
    syls = [decompose(c) for c in word]
    out = []
    for i, s in enumerate(syls):
        if s is None:                      # 숫자·기호 등
            out.append(word[i]); continue
        cho, jung, jong = s
        nxt = syls[i + 1] if i + 1 < len(syls) else None

        # 1) 초성
        if i == 0 or syls[i - 1] is None:
            out.append(CHO[cho])
        else:
            pj = syls[i - 1][2]            # 앞 글자 받침
            c = CHO[cho]
            if cho == 11:                  # 'ㅇ' 초성 = 앞 받침이 연음돼 이미 붙었음
                c = ''
            else:
                pc = JONG[pj]              # 앞 받침의 대표음
                # 비음화 / 유음화
                if c == 'n':
                    if pc == 'k': c = 'n'
                    elif pc == 'p': c = 'n'
                    elif pc == 't': c = 'n'
                    elif pc == 'l': c = 'l'
                elif c == 'r':             # ㄹ 초성
                    if pc in ('k', 'ng', 'm', 'p', 't'): c = 'n'
                    elif pc in ('n', 'l'): c = 'l'
                    else: c = 'r'
                elif c == 'm':
                    pass
                out.append(c); c = None
            if c is not None:
                out.append(c)

        # 2) 중성
        out.append(JUNG[jung])

        # 3) 종성
        if jong:
            if nxt is not None and nxt[0] == 11:        # 뒤가 'ㅇ' 초성 -> 연음
                out.append(JONG_LINK[jong])
            elif nxt is None or syls[i + 1] is None:    # 끝
                out.append(JONG[jong])
            else:
                pc = JONG[jong]
                nc = CHO[nxt[0]]
                # 앞 받침이 뒤 초성에 동화되는 경우
                if nc in ('n', 'm'):
                    pc = {'k': 'ng', 'p': 'm', 't': 'n'}.get(pc, pc)
                elif nc == 'r':
                    pc = {'k': 'ng', 'p': 'm', 't': 'n', 'n': 'l', 'm': 'm', 'ng': 'ng'}.get(pc, pc)
                out.append(pc)
    return ''.join(out)

if __name__ == '__main__':
    import sys
    for w in sys.argv[1:]:
        print(w, '->', romanize(w))
