# 확장 스킬·스펠 아이콘 30종

원본은 `sources/<id>.png`, 원본 생성 프롬프트는 `remaining-prompts/<id>.txt`에 보관한다. `bloodPact`는 작업 공간에 있던 원본을 사용했다.

각 배치의 실행 명령은 `python3 frontend/art-source/skill-icons/prepare_remaining.py /private/tmp/tourne-pixel-fixer-eval/python <W|E|R|DF>`다. Pixel Art Fixer에서 `mode=full`, `force_step=max(w,h)/48`로 변환하고, `fixer/`에 보존한다. 이진 알파와 무디더링 가시 색상 15색을 적용한 정사각형 PNG는 `quantized/`에 저장한다. 남색 외곽선에 1색을 예약했다. 국소 수정 좌표와 이전·이후 색, 최종 PNG 크기와 색상 수는 배치별 메타데이터에 기록한다.

각 `remaining-*-preview.png`는 게임의 `normalizeIconOutline`을 호출해 32px·40px로 렌더링한 결과다. 최종 PNG는 `frontend/src/assets/pixel/skills/`에 저장되며 `SkillIcon.js`에서 스킬 ID에 연결한다.
