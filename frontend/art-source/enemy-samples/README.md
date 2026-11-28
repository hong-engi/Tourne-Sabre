# 시험용 적 스프라이트 4종 기록 (`stalker`, `hound`, `swordsaint`, `crab`)

ChatGPT 웹으로 생성한 시험용 적 4종을 Pixel Art Fixer(`/private/tmp/tourne-pixel-fixer-eval/python`, `mode='full'`)로 격자 복원하고 16색 이하·이진 알파로 정리한 뒤 국소 픽셀 마무리를 거쳐 `frontend/src/assets/pixel/`에 적용했다.

- `stalker`: 긴 변 64칸(`force_step=16.09`), 최종 `66×63`, 16색.
- `hound`: 긴 변 64칸(`force_step=18.52`), 최종 `21×66`, 15색. 16색 양자화에서 회색으로 묻힌 코·눈의 주황빛 10픽셀을 Fixer 결과 기준으로 복원(`cleanup.py`). 좁은 실루엣이라 `mapdraw.js`의 `SPRITE_SCALE`에 `1.45` 적용.
- `swordsaint`: 보스 스케일 긴 변 96칸(`force_step=15.20`), 최종 `98×67`, 15색. 가로로 긴 검 때문에 몸이 작아지지 않도록 `SPRITE_SCALE` `1.4` 적용. (게임 내 별도 회전 검과 겹칠 수 있어 추후 Codex 검수 대상.)
- `crab`: 보스 스케일 긴 변 96칸(`force_step=11.86`), 최종 `92×98`, 16색. (집게 위쪽·눈 아래쪽 구도라 회전 방향 검수 대상.)

재현: `cleanup.py`는 `*-quantized.png`와 `hound-fixer.png`로부터 `frontend/src/assets/pixel/*.png`를 생성한다.
