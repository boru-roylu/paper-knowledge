---
title: Dia
tool_key: nari-labs-dia
url: "https://github.com/nari-labs/dia"
created: 2026-06-02
tags:
  - tts
  - speech-llm
  - dialogue
  - tool
  - project-full-duplex-data
  - project-tts-data-pipeline
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [GitHub repo: nari-labs/dia](https://github.com/nari-labs/dia)
- [Hugging Face model: Dia-1.6B-0626](https://huggingface.co/nari-labs/Dia-1.6B-0626)

## 一句話總結
**Dia** 是 Nari Labs 釋出的 1.6B open-source TTS model，主打從 transcript 一次生成 realistic dialogue audio。

## 為什麼值得放進 knowledge
Dia 和你的 full-duplex / dialogue synthesis 方向高度相關，因為它直接處理：

- transcript-to-dialogue audio generation
- multi-speaker speech generation
- laughter、coughing、throat clearing 等 nonverbal events
- dialogue-style TTS，而不是單句 narration-only TTS

## Project relevance
- **project-full-duplex-data**：可作為 transcript-to-dialogue synthesis baseline，尤其適合比較 backchannel / overlap / nonverbal event 的 controllability。
- **project-tts-data-pipeline**：可用來觀察 dialogue transcript format 對 TTS training / inference 的影響。

## 需要後續確認
- 是否支援真正的 overlapping speech，或主要是 sequential dialogue
- transcript format 對 speaker turn、event、pause 的控制能力
- license 與 generated audio 使用限制
- 是否有 paper / technical report 可以補進 citation graph

