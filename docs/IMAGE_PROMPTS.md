# 현장 이미지 AI 생성 프롬프트 (얼음싹싹 v3)

v3 시안의 사진 자리 하나하나에 맞춘 프롬프트입니다. 영어 프롬프트를 이미지 생성 도구(ChatGPT 이미지, Midjourney, Gemini, Firefly 등)에 그대로 붙여 넣으면 됩니다.
만든 이미지는 `icelab/v3/images/`에 아래 **파일 이름**으로 넣어 주시면 자리에 맞춰 배치합니다.

## 먼저 정할 것: 정직하게 쓰기

- **전후 비교(②)는 실제 작업 사진을 권합니다.** AI로 만든 "청소 전/후"를 실제 결과처럼 보여 주면 소비자를 속이는 광고(표시·광고법상 기만 광고)가 될 수 있고, 들키면 신뢰를 크게 잃습니다. AI 이미지를 쓴다면 사진 아래에 **"이해를 돕기 위한 예시 이미지"**라고 작게 표시하세요. 실제 작업 사진이 생기는 대로 바꾸는 것을 전제로 합니다.
- 분위기용 이미지(히어로, 카드, 현장 띠)는 AI 이미지로 써도 무난합니다. 다만 특정 제조사 로고·상표는 나오지 않게 합니다.
- 사람 얼굴은 넣지 않습니다(지난 원칙 유지). **장갑 낀 손**까지만 허용합니다. 손도 빼려면 각 프롬프트의 hands 부분을 지우세요.

## 모든 이미지에 공통으로 붙일 문장

일관된 사진처럼 보이도록 끝에 이 문장을 붙입니다.

```
Photorealistic documentary photo, shot on a full-frame camera, 35mm lens, natural soft daylight mixed with cool white kitchen lighting, clean cool color palette with subtle blue tones, shallow depth of field, high detail, realistic textures, no text, no logos, no brand names, no watermark, no people's faces.
```

장갑이 나오는 컷은 **blue nitrile gloves**(로고 파랑과 맞춤)로 통일합니다.

---

## ① 히어로 배경 — 오염된 제빙기 내부
- 파일: `hero-dirty.jpg` · 비율 **16:9** (가로 2400px 이상) · 모바일용 `hero-dirty-m.jpg` **9:16**
- 가운데에 큰 흰 글씨가 올라가므로 **가운데가 너무 복잡하지 않고 전체적으로 어두운 편**이어야 합니다.

```
Close-up of the inside of a commercial ice machine in a cafe, the water distributor tube and evaporator plate covered with white limescale crust and pinkish-black slime mold, water droplets, dim moody lighting from the side, dark tones overall, the center of the frame slightly out of focus and calm to leave room for large overlay text.
```

## ② 전후 비교 — 같은 자리, 같은 각도 (실제 사진 권장)
- 파일: `before.jpg`, `after.jpg` · 비율 **16:9** (1600×900 이상)
- 두 장이 **같은 구도**여야 슬라이더가 자연스럽습니다. 먼저 before를 만들고, 같은 대화에서 "same angle, same framing"으로 after를 요청하거나 before 이미지를 넣고 편집 기능으로 깨끗하게 바꾸세요.

```
BEFORE: Straight-on close-up of a commercial ice maker's water distributor and evaporator grid, heavy white limescale deposits, yellowish stains and black mold spots along the edges, dull and cloudy surface, even lighting, camera fixed on a tripod.
```
```
AFTER: Exactly the same angle and framing as the previous image, the same water distributor and evaporator grid now spotless and shiny stainless steel, clear water droplets, no scale or mold, bright clean even lighting, camera fixed on a tripod.
```

## ④ 카드 1 — 식품용 세정제와 고온 스팀
- 파일: `card-clean.jpg` · 비율 **16:10** (1200×750)

```
Commercial kitchen counter with two plain unlabeled white spray bottles of food-safe cleaning solution, a handheld steam cleaner nozzle releasing a soft cloud of steam, disassembled ice machine parts (plastic water tray, distributor tube) laid neatly on a clean towel, cool bright light, minimal composition with empty space on the right.
```

## ④ 카드 2 — 휴대폰으로 받는 청소 기록지
- 파일: `card-record.jpg` · 비율 **16:10**
- AI는 화면 속 한글을 정확히 못 씁니다. **화면은 비워 두고** 나중에 실제 기록지 화면을 합성합니다.

```
A smartphone lying on a stainless steel counter next to a clean ice machine, the phone screen is plain blank white (to be replaced later), a few clear ice cubes beside it, soft daylight, shallow depth of field, top-down 30-degree angle.
```

## ⑥ 현장 사진 띠 — 4장 (비율 4:5, 800×1000)

**`field-swab.jpg` 오염도 검사**
```
Hands in blue nitrile gloves pressing a sterile cotton swab against the inside wall of an ice machine bin to test hygiene, a small handheld hygiene test meter visible on the edge, close-up, cool light.
```

**`field-disassembly.jpg` 분해 작업**
```
Hands in blue nitrile gloves removing the plastic water distributor tube from inside an open commercial ice machine, front panel removed, internal parts visible, practical work scene, close-up.
```

**`field-steam.jpg` 고온 스팀 세척**
```
Disassembled ice machine parts (water curtain, distributor, tray) in a stainless sink being cleaned with a handheld steam cleaner, visible white steam, water droplets, hands in blue nitrile gloves holding the steam nozzle.
```

**`field-report.jpg` 기록지 전달**
```
Hands in blue nitrile gloves holding a clipboard with a printed checklist form (text unreadable, blurred) in front of a clean shiny ice machine in a cafe, the checklist has small photo thumbnails, soft focus background.
```

## 피할 것 (부정 프롬프트를 지원하는 도구용)
```
text, letters, logo, brand name, watermark, face, person, cartoon, illustration, 3d render, oversaturated, fake looking, distorted hands, extra fingers
```

---

## 넣는 방법
1. 이미지를 위 파일 이름으로 `icelab/v3/images/`에 저장합니다(JPG 또는 WebP, 한 장 500KB 안팎 권장).
2. 알려 주시면 플레이스홀더를 `<img>`로 바꾸고, 히어로는 `--hero-photo` 변수에 연결한 뒤 글자 대비를 다시 검사합니다.
