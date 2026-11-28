# 일반 적 이미지 작업 기록

ImageGen 원본 → Pixel Art Fixer mode=full → 15색 양자화 → 남색 외곽선 추가. 긴 변 64칸, force_step은 metadata.json 참조. cleanup-log.json에 고립 픽셀 검사와 최종 색상 수를 기록했다. 수동 국소 마무리와 Enemy Lab 검증은 계속 진행 중이다.

- sickler: Top-down pixel art arena enemy sprite: a small lizard holding a curved sickle. Single centered whole subject facing upward, dark navy #101823 outline, simple silhouette readable at 40 pixels, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- shroom: Top-down pixel art arena enemy sprite: a squat mushroom creature with cracked purple cap. Single centered whole subject facing upward, dark navy #101823 outline, simple silhouette readable at 40 pixels, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- lantern: Top-down pixel art arena enemy sprite: a floating armored lantern jellyfish with a golden core. Single centered whole subject facing upward, dark navy #101823 outline, simple silhouette readable at 40 pixels, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- leech: Top-down pixel art arena enemy sprite: a curled purple leech with a hooked head. Single centered whole subject facing upward, dark navy #101823 outline, simple silhouette readable at 40 pixels, restrained medieval fantasy palette, transparent background, no text, no ground shadow.
- bell: Top-down pixel art arena enemy sprite: a stocky stone bell keeper with a large cracked bronze bell. Single centered whole subject facing upward, dark navy #101823 outline, simple silhouette readable at 40 pixels, restrained medieval fantasy palette, transparent background, no text, no ground shadow.

재생성: `python3 prepare.py /private/tmp/tourne-pixel-fixer-eval/python` 후 `python3 cleanup.py`.
