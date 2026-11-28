# 신규 적 이미지 작업 기록

상태: **게임 적용됨, 픽셀 마무리 남음**. 네 이미지는 `mapdraw.js`에서 PNG로 불러 절차 생성 임시 스프라이트보다 우선 사용한다. 다른 신규 적은 `enemyArt.js`의 임시 16×16 스프라이트를 쓴다.

표시 크기: 가늘고 긴 그림은 몸이 작아 보이므로 `mapdraw.js`의 `SPRITE_SCALE`로 그리는 크기만 키웠다(lancer 1.9, banner 1.35, flea 1.3, shellback 1.1배). 충돌 반경은 그대로다. 플레이어 기사와 나란히 놓은 실제 크기 비교에서 네 실루엣 모두 구별된다. `shield-beetle/source.png`는 `shellback-source.png`와 같은 파일이다.

내장 ImageGen 프롬프트:

- shellback: Use case: stylized-concept. Asset type: transparent top-down pixel art game enemy sprite. One squat beetle carrying a broad rusty shield shell, obvious armored front and split rear, bold dark outlines, warm rusty bronze and teal accents, readable simple silhouette at 40 pixels, centered single subject, no text, no shadow, transparent background. Medieval fantasy arena.
- lancer: Top-down pixel art game sprite, one thin helmeted spear sentry holding a long spear pointing upwards, dark outline, muted steel and ochre, clear small silhouette, centered, transparent background, no text, medieval arena.
- flea: Top-down pixel art game sprite, one tiny flea with enormous folded hind legs, violet and ivory, dark outline, clear small silhouette, centered, transparent background, no text, medieval arena.
- banner: Top-down pixel art game sprite, one small flag bearer carrying a torn red banner, compact medieval creature, dark outline, clear small silhouette, centered, transparent background, no text, medieval arena.

`*-source.png` 원본을 알파 기준으로 자르고 Pixel Art Fixer 커밋 `ef376e57e1c272633ca2dbf5f29ec3fcf6596465`의 `mode=full`로 변환했다. 강제 격자는 긴 변을 64칸으로 복원하도록 선택했으며 각각 16.48, 17.84, 7.61, 14.69다. 변환 결과와 16색 이하 양자화 결과는 따로 보존했다. `cleanup.py`는 고립된 1~2픽셀 잡음을 찾았으나 제거할 대상은 없었다. flea는 이동 방향에 맞춰 회전했고 각 이미지에 투명 여백을 추가했다.

`prepare.py /path/to/pixel-art-fixer/python`으로 변환하고 `cleanup.py`로 현재 게임 파일을 재생성한다. 변환 스크립트는 최종 파일을 직접 덮어쓰지 않는다. 특히 lancer는 창이 매우 길어 실제 크기에서 몸이 작게 보이므로 픽셀 마무리 및 인게임 평가가 필요하다.
