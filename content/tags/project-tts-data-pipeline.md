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

## Structured controllable TTS prompts

[TED-TTS](../papers/arxiv_2601_03170/) 補上一個重要方向：TTS data pipeline 不應只產生 plain transcript，而應產生 **segment-level structured prompt**。

一個更有訓練價值的 expressive TTS example 可以長成：

```text
utterance text
  -> contiguous segments
  -> emotion label / natural language emotion description
  -> expected duration or speaking-rate range
  -> pause / emphasis / nonverbal tags
  -> speaker identity and style constraints
```

TED-TTS 的 MED-TTS 是 synthetic text-side dataset，不是真實 speech annotation，但它提供了可借鑑的 schema：

- GPT-4o 產生 emotion-rich English / Chinese text。
- DeepSeek-Chat 做 emotion-aligned segmentation 和 duration estimation。
- Qwen3-8B 被 fine-tune 成 automatic prompt constructor。
- 人工 verification checklist 檢查 segment order、emotion-text alignment、emotion description、duration plausibility。

對我們的 pipeline，下一步可以把這種 schema 接到真實 audio：

```text
raw audio + transcript
  -> ASR / diarization / forced alignment
  -> segment boundary detection
  -> emotion / prosody / speaking-rate tags
  -> duration from timestamps or codec-token counts
  -> verification / filtering
  -> structured TTS training example
```

這樣可以同時服務兩個目標：

- clean English TTS training：保留 content fidelity、speaker consistency、alignment quality。
- controllable expressive TTS：讓模型學會 segment-level emotion、pace、pause 和 emphasis，而不是只有整句 global style。

## Overlap cleanup / separation references

- [Dual-path Mamba](../papers/arxiv_2403_18257/)：不是 TTS paper，但可作 TTS data pipeline 的 upstream separation baseline。對 podcast / dialogue / web audio 來說，先用 efficient single-channel speech separation 把 overlap speaker contamination 降低，再進 ASR、forced alignment、speaker filtering 和 transcript validation，會比直接把 contaminated utterance 丟給 TTS training 更穩。限制是它只在 WSJ0-2mix 類 benchmark 驗證，不能替代 diarization、speaker consistency check 或 human spot-check。
- [FunASR](../tools/modelscope-funasr/)：production-oriented ASR / VAD / punctuation / speaker diarization / emotion-event tagging toolkit。適合作為 TTS data cleaning 的 first-pass transcription 和 segmentation baseline，但在 overlap speech、short backchannels、speaker swaps 上仍需要和 separation / OSD / human spot-check 搭配。

## Related Tags

#audio-data #diarization #preprocessing #speech-data #tts #asr
