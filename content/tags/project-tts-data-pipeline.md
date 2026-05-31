---
title: "Project: TTS data pipeline"
---

## Motivation

我們想要做更好的 English TTS model，而 TTS 的上限很大一部分取決於資料品質。真實收集到的 audio / transcript 往往有 overlap speech、speaker inconsistency、ASR errors、hallucinated transcript、background noise、music、reverb、bad segmentation、或不適合 TTS training 的自然對話現象。

所以這條 project line 的重點不是單一 TTS architecture，而是 data pipeline：如何偵測、清理、過濾、對齊、評分，最後產生穩定可訓練的 English TTS corpus。特別是 overlap detection 與 transcription quality，是目前最需要系統化處理的部分。

## Target

- 偵測 transcript/audio 中的 overlap speech 與多 speaker contamination。
- 提高 transcription quality，降低 ASR hallucination、錯字、漏字與 timing mismatch。
- 設計 English TTS training data 的 filtering rules 與 quality scoring。
- 建立從 raw audio 到 clean utterance-level training examples 的 pipeline。
- 判斷哪些資料適合 TTS、哪些資料應該排除或只用於其他任務。

## Questions

- 哪些 overlap / noise / ASR error 會真正傷害 TTS training？
- 怎樣的 diarization、VAD、ASR ensemble、text normalization 組合最穩？
- 如何衡量 transcript/audio alignment quality？
- 該用哪些 automatic metrics、人類抽查策略、或 model-based filters？
- 對 English TTS 而言，資料多樣性和資料乾淨程度應該怎麼 trade off？

## Related Tags

#audio-data #diarization #preprocessing #speech-data #tts #asr
