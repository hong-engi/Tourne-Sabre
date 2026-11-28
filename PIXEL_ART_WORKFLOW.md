# 픽셀 어셋 제작 가이드

Tourne-Sabre의 기본 제작 방식은 **Codex가 ImageGen으로 원본 생성 → Pixel Art Fixer로 픽셀 격자 복원 → 최대 16색으로 정리 → 게임에 적용**이다. 새 캐릭터, 무기, 경험치 보석, 바닥 타일도 이 과정을 따른다.

## 1. 원본 이미지 생성

- Codex가 내장 ImageGen 도구로 이미지를 만든다. 사용자가 완성된 픽셀 이미지를 준비할 필요는 없다.
- 프롬프트에는 용도, 실루엣, 팔레트 방향, 조명 방향, 투명 배경을 명시한다. 예: `top-down teal armored knight, stepped dark outline, upper-left lighting, transparent background, no text, no gradients`.
- 관련 어셋은 같은 화풍과 픽셀 밀도를 목표로 생성한다. 경험치 보석은 가치가 높을수록 크기와 실루엣이 풍성해지게 한다.
- 생성 원본과 프롬프트를 `frontend/art-source/<세트명>/`에 보존한다. 배경이 실제 투명이 아니면 ImageGen 편집으로 배경을 제거하고 확인한다.

생성 이미지에는 불균일한 픽셀 크기나 흐린 가장자리가 남을 수 있다. 생성 결과를 그대로 최종 어셋으로 사용하지 않는다.

## 2. Pixel Art Fixer로 격자 복원

이 프로젝트는 [Pixel Art Fixer](https://github.com/Retro-Diffusion/pixel-art-fixer)의 오픈소스 Python 구현을 사용한다. 검증한 커밋은 `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`이다.

- 아틀라스는 원본 해상도에서 셀 단위로 자른다. Fixer 입력 전에 임의의 작은 크기로 리사이즈하지 않는다.
- Python API의 `process(source_bytes, mode='full')`로 격자를 검출하고 재구성한다. 원본과 Fixer 결과를 모두 보관한다.
- 자동 검출 결과를 확대해서 확인한다. 격자가 지나치게 촘촘하거나 형태가 무너지면 원본을 수정하거나 근거 있는 `force_step`을 지정한다.
- 기존 바닥은 1254×1254 원본에 `force_step=1254/64`를 적용해 64×64로 복원했다. 이 값은 해당 바닥 전용이며 다른 이미지에 그대로 쓰지 않는다.

## 3. 최대 16색으로 정리

Fixer 실행과 색상 제한은 별도 단계다. Pillow로 **어셋별 보이는 RGB 색을 최대 16개**로 줄이며 디더링은 끈다. 모든 어셋이 하나의 공통 16색 팔레트를 공유하는 방식은 아니다.

투명 픽셀을 팔레트 선정에서 제외하고, 알파는 `0` 또는 `255`로 유지한다. 마지막에는 완전히 투명한 바깥 여백만 자른다. 복원된 픽셀을 임의로 축소하거나 가로세로 비율을 바꾸지 않는다.

## 4. 기존 어셋 재현

명령은 저장소 루트에서 실행한다. Fixer는 저장소 밖에 설치한다.

```sh
git clone https://github.com/Retro-Diffusion/pixel-art-fixer /tmp/tourne-pixel-fixer
git -C /tmp/tourne-pixel-fixer checkout ef376e57e1c272633ca2dbf5f29ec3fcf6596465
python3 -m venv /tmp/tourne-pixel-venv
/tmp/tourne-pixel-venv/bin/python -m pip install -r /tmp/tourne-pixel-fixer/python/requirements.txt

# 경험치 보석: 보존된 생성 원본 → Fixer → 16색 → 런타임 PNG
/tmp/tourne-pixel-venv/bin/python frontend/art-source/xp-pickups/prepare.py /tmp/tourne-pixel-fixer/python

# 기본 어셋: 보존된 Fixer 변환 결과를 설치
/tmp/tourne-pixel-venv/bin/python frontend/art-source/pixel/prepare_fixer_assets.py
```

기본 어셋 설치 명령은 `output/pixel-tool-comparison/`의 저장된 결과가 필요하며 원본을 다시 변환하는 명령은 아니다. 전체 비교 재현은 [비교 기록](output/pixel-tool-comparison/README.md)을 따른다. 보석 미리보기 생성에는 macOS Menlo 폰트가 필요하다.

## 5. 게임 적용 원칙

- 최종 PNG는 `frontend/src/assets/pixel/`에 둔다. 파일명은 `xp-crown.png`처럼 소문자와 하이픈을 사용한다.
- **픽셀 스타일은 어셋에 적용한다.** 화면 전체를 저해상도로 렌더링하거나 픽셀화 필터를 씌우지 않는다.
- 글자와 UI는 디스플레이 해상도로 표시한다. 이동·회전·찌르기·이펙트는 시간 기반으로 부드럽게 움직인다. 위치나 각도를 픽셀 격자에 강제로 맞추지 않는다.
- `mapdraw.js`처럼 스프라이트를 nearest-neighbor로 미리 확대하고, 화면에서는 부드럽게 변환한다. 칼은 동일한 이미지와 비율을 유지하며 회전시킨다.
- 이미지 크기와 게임의 충돌 반경은 별도다. 어셋 교체만으로 판정 크기를 바꾸지 않는다.

## 6. 완료 확인

색상 수 ≤16, 이진 알파, 투명 테두리, 실루엣, 관련 어셋의 픽셀 밀도를 확인한다. 실제 게임 크기에서도 캐릭터·무기·보석이 구별되어야 한다. 바닥은 반복 경계, 칼은 회전·찌르기 중 형태, 글자는 가독성을 확인한다.

원본·프롬프트·변환 설정·최종 크기·색상 수를 함께 보존한다. 기존 기록은 [기본 어셋](frontend/art-source/pixel/README.md)과 [경험치 보석](frontend/art-source/xp-pickups/README.md)에 있다. Pixel Snapper는 비교 대상으로만 남기며 기본 파이프라인은 **Fixer + 16색**이다.

QWERDF용 16종은 [스킬 아이콘 제작 기록](frontend/art-source/skill-icons/README.md)을 참고한다. HUD 가독성을 위해 원본의 긴 변을 48칸으로 복원하는 Fixer 설정을 사용하며, 아이콘은 키가 아닌 스킬 ID에 연결한다.

스킬 아이콘의 화면 표시에는 추가로 **남색 `#0b1220` 외곽선 1픽셀 + 투명 여백 2픽셀**을 적용한다. `skillIconOutline.js`가 32·40픽셀 등 실제 표시 크기에 맞춰 각각 준비하므로, 이미 외곽선이 있는 작은 이미지를 다시 축소해서 선 두께가 달라지게 하지 않는다. 원본 PNG와 Fixer 변환 결과는 보존한다.
