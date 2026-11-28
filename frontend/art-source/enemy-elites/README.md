# 적 이미지 제작 기록

ImageGen 원본 → Pixel Art Fixer (mode=full, 검증 커밋 ef376e57e1c272633ca2dbf5f29ec3fcf6596465) → 15색 양자화 → 짙은 남색 외곽선 추가. 긴 변 약 64px 기준 force_step은 metadata.json에 기록했다. 원본, Fixer 결과, 양자화 결과를 따로 보관한다. cleanup.py와 cleanup-log.json은 투명 여백, 외곽선 및 제거한 고립 픽셀 좌표를 기록한다. 이진 알파, 16색 이하를 검사한다. 국소 픽셀 품질 점검은 계속 진행 중이다.

## ImageGen 프롬프트

- warden: Top-down pixel art arena elite enemy sprite: an armored chain jailer carrying shackles and a short iron chain. Single centered whole subject facing upward, dark navy #101823 outline, readable at small scale, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- gatekeeper: Top-down pixel art arena elite enemy sprite: a stern armored gate guardian with large half-moon shield and distinct heavy shoulder. Single centered whole subject facing upward, dark navy #101823 outline, readable at small scale, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- duelist: Top-down pixel art arena elite enemy sprite: a silver masked mirror duelist with a cracked mirror blade. Single centered whole subject facing upward, dark navy #101823 outline, readable at small scale, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- alchemist: Top-down pixel art arena elite enemy sprite: a masked alchemist in robes holding a green vial, orbiting colorful flasks. Single centered whole subject facing upward, dark navy #101823 outline, readable at small scale, restrained medieval fantasy palette, transparent background, no text, no ground shadow.

재생성: `python3 prepare.py /private/tmp/tourne-pixel-fixer-eval/python` 후 `python3 cleanup.py`.
