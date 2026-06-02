---
title: Chatterbox TTS
tool_key: resemble-ai-chatterbox
url: "https://github.com/resemble-ai/chatterbox"
created: 2026-06-02
tags:
  - tts
  - speech-llm
  - audio-data
  - tool
  - project-tts-data-pipeline
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [GitHub repo: resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox)
- [Demo page](https://resemble-ai.github.io/chatterbox_demopage/)

## 一句話總結
**Chatterbox TTS** 是 Resemble AI 釋出的 open-source TTS model family，包含 Turbo、multilingual、和 original English models。

## 為什麼值得放進 knowledge
Chatterbox 對 TTS data pipeline 和 deployment-oriented TTS baseline 都有參考價值：

- Chatterbox-Turbo 是較小的 low-latency architecture
- 支援 paralinguistic tags，例如 cough、laugh、chuckle
- 有 multilingual model variant
- repo README 強調 voice-agent / narration / creative workflow use cases

## Project relevance
- **project-tts-data-pipeline**：適合拿來比較 paralinguistic tag 設計、low-latency inference、以及 speech output quality control。
- **project-full-duplex-data**：中度相關。它偏 TTS model family，不一定直接處理 full-duplex overlap，但 paralinguistic tags 對自然對話合成有用。

## 需要後續確認
- Turbo / multilingual / original model 的具體訓練資料與限制
- paralinguistic tags 是否能穩定控制 event timing
- watermarking 與 license 對研究資料生成的影響
- 是否有正式 paper 或 technical report 可加入 citation graph

