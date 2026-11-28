# 돌격수 이미지

- 내장 ImageGen 원본: `source.png` (투명 배경). 기존 돌격수의 뿔과 적갈색 실루엣을 참고했다.
- 프롬프트: "Use case: stylized-concept. Asset type: top-down arena game enemy sprite, transparent background. A single squat horned armored charging beast, warm rust brown and cream horns, clear forward direction, bold dark navy outline, simple readable 16-color pixel art silhouette for 40px display, centered full body, orthographic top-down view, no ground shadow, no text, no other objects. Match charming compact medieval fantasy arena sprites."
- Pixel Art Fixer `mode=full`, `force_step=20` 결과: `fixer.png`. 약 64칸 격자로 복원하여 실제 표시 크기에서 실루엣이 유지되도록 선택했다.
- 투명도 128 기준 이진화, 투명 여백 제거, 디더링 없이 16색 이하로 양자화 후 진행 방향에 맞춰 180도 회전했다. 수정 전 결과는 `quantized-before-cleanup.png`로 보존했다. 45×62 원본 좌표 (14, 0)의 짙은 점을 주변 발굽 강조색 RGB (220, 173, 114)로 정리했고, 투명 테두리 1픽셀을 추가했다. 재현 스크립트는 `cleanup.py`다. 최종 크기는 47×64, 가시 색상 15개, 알파는 0 또는 255다.
- `size-preview.png`에서 높이 32·40px 및 128px 확대본을 비교했다. 게임에서 바닥·기사·검·HUD와 함께 표시되고 돌진 경고가 나오는 것을 확인했다. 게임 화면 확인은 최종 1픽셀 보정 직전에 수행했다.
- 적용 파일: `frontend/src/assets/pixel/charger.png`.
