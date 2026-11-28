# 적 이미지 제작 기록

ImageGen 원본 → Pixel Art Fixer (mode=full, 검증 커밋 ef376e57e1c272633ca2dbf5f29ec3fcf6596465) → 15색 양자화 → 짙은 남색 외곽선 추가. 긴 변 약 96px 기준 force_step은 metadata.json에 기록했다. 원본, Fixer 결과, 양자화 결과를 따로 보관한다. cleanup.py와 cleanup-log.json은 투명 여백, 외곽선 및 제거한 고립 픽셀 좌표를 기록한다. 이진 알파, 16색 이하를 검사한다. 국소 픽셀 품질 점검은 계속 진행 중이다.

## ImageGen 프롬프트

- forge: Stylized-concept: top-down 2D medieval fantasy arena boss pixel sprite. a fearsome furnace cannon monster, iron boiler body with glowing orange firebox and upward aiming cannon, compact armored wheels. One isolated centered whole subject, front toward top of image, bold dark navy #101823 outline, simple readable silhouette at small scale, muted colors, transparent background, no text, no shadow, no other objects.
- maestro: Stylized-concept: top-down 2D medieval fantasy arena boss pixel sprite. a ghostly orchestra conductor in dark tailcoat, empty glowing face and baton, gold musical ornaments. One isolated centered whole subject, front toward top of image, bold dark navy #101823 outline, simple readable silhouette at small scale, muted colors, transparent background, no text, no shadow, no other objects.
- rootcrown: Stylized-concept: top-down 2D medieval fantasy arena boss pixel sprite. a crowned tree stump monster, glowing central core, thick roots and branch crown, no background. One isolated centered whole subject, front toward top of image, bold dark navy #101823 outline, simple readable silhouette at small scale, muted colors, transparent background, no text, no shadow, no other objects.
- stormray: Stylized-concept: top-down 2D medieval fantasy arena boss pixel sprite. a broad storm manta ray, pointed front facing up, swept wings, pale blue lightning marks and trailing tail. One isolated centered whole subject, front toward top of image, bold dark navy #101823 outline, simple readable silhouette at small scale, muted colors, transparent background, no text, no shadow, no other objects.
- centipede: Stylized-concept: top-down 2D medieval fantasy arena boss pixel sprite. the head of an armored iron centipede, red eyes, mandibles facing up, short connection at rear, no long body. One isolated centered whole subject, front toward top of image, bold dark navy #101823 outline, simple readable silhouette at small scale, muted colors, transparent background, no text, no shadow, no other objects.

재생성: `python3 prepare.py /private/tmp/tourne-pixel-fixer-eval/python` 후 `python3 cleanup.py`.
