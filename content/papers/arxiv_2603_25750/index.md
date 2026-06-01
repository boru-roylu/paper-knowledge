---
paper_key: arxiv_2603_25750
canonical_id: "arxiv:2603.25750"
title: "Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.25750"
pdf_url: "https://arxiv.org/pdf/2603.25750.pdf"
status: read
rating: 4
tags:
  - speech-llm
  - audio-data
  - diarization
  - preprocessing
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-30
---

<div class="paper-nav"><a href="../../">&larr; Papers</a></div>




## Links

- [arXiv abstract](https://arxiv.org/abs/2603.25750)
- [PDF](https://arxiv.org/pdf/2603.25750.pdf)
- [Project page](https://kyudan1.github.io/sommelier.github.io/)

## 一句話總結

Sommelier 是一套 open-source multi-turn audio preprocessing pipeline，目標是把真實世界的多講者長音訊整理成可用於 full-duplex Speech Language Models 的訓練資料。

## 這篇在解決什麼問題

Full-duplex SLM 需要能處理 backchannel、overlap speech、interruption、turn-taking 等自然互動，但公開的高品質多講者對話資料不足。一般 preprocessing 在真實長音訊上容易遇到 diarization error、overlap 區段切錯、ASR hallucination、背景音樂干擾，以及講者跨 segment 對齊不穩定等問題。

## 核心方法

Sommelier 把長音訊切成可處理的 segment，接著串接 VAD、Sortformer diarization、overlap speech separation、speaker embedding matching、background music removal，以及 ASR ensemble。整體設計重點不是提出單一模型，而是把多個既有元件組成可擴展、可重現的 preprocessing workflow。

## Training / Data

作者用 Sommelier 處理約 83 小時資料來 fine-tune Moshi，並用多個 benchmark 評估各子模組：VoxConverse 用於 diarization，LibriSpeech synthetic mixtures 用於 overlap separation，LibriSpeech / TEDLIUM3 用於 ASR，Full-Duplex-Bench 用於 full-duplex behavior。

## 主要結果

- Sortformer 在 VoxConverse common subset 的 DER / JER 優於 Pyannote 3.1。
- Overlap separation 比直接使用 mixed audio 更能改善 WER、STOI、UTMOS。
- Whisper、Canary、Parakeet 的 ROVER ensemble 在 LibriSpeech test-other 將 WER 從 6.26% 降到 3.92%。
- 120 秒音訊的總 preprocessing time 約 20.95 秒，RTF 約 0.1746。
- 用 Sommelier 產生資料 fine-tune 的 Moshi 在 backchanneling、turn-taking、interruption handling 上表現更好。

## Project relevance

- **Project A: Full-duplex data and model**: 高相關。Sommelier 是 full-duplex SLM 的 audio preprocessing pipeline，可以幫我們把長音訊整理成可用於 training 的 multi-turn / multi-speaker data，包含 diarization、overlap handling、speaker matching。
- **Project B: TTS data pipeline**: 高相關。這篇更像 data cleaning / filtering / transcription quality pipeline paper，對英文 TTS training data 的 overlap detection、ASR ensemble、background music removal、repetition filtering 都有直接參考價值。

短評：這篇同時屬於兩個 project；對 Project B 的 pipeline 設計尤其實用。

這篇很適合放進 speech LLM / spoken dialogue agent 的資料處理路線圖。若之後要做 full-duplex conversational agent，Sommelier 可以作為建立 training corpus 的 baseline pipeline，也可以拆出 diarization、overlap handling、ASR ensemble 幾個模組做 ablation。

## 我該不該細讀

值得細讀，尤其是你關心 speech LLM、full-duplex dialogue、資料處理 pipeline，或想找 open-source preprocessing baseline。建議優先讀 method pipeline、evaluation setup、Moshi fine-tuning 的資料格式與結果。

## 可能的弱點 / open questions

- Pipeline 依賴多個外部模型，error propagation 可能仍然明顯。
- 評估重點偏 preprocessing quality 與 Moshi behavior，對更大 SLM 或不同 duplex architecture 的泛化還需要驗證。
- 83 小時 fine-tuning data 規模不大，可能不足以說明 scaling behavior。
- 真實多語言、noise-heavy、遠場錄音場景的 robustness 仍需要更多實驗。

## Tags

#speech-llm #audio-data #diarization #preprocessing #project-full-duplex-data #project-tts-data-pipeline

## Concepts

- full-duplex speech language models
- multi-turn audio preprocessing
- speaker diarization
- overlap speech separation
- ASR ensemble
- background music removal
- turn-taking behavior

## Citation Graph

<!-- citation-graph:start -->

Cites local papers:

- [A Full-duplex Speech Dialogue Scheme Based On Large Language Model](../arxiv_2405_19487/)

<!-- citation-graph:end -->

## Citation
No formal conference or journal venue was found during this ingest; use the arXiv preprint citation for now.

```bibtex
@article{jung2026sommelier,
  title={Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models},
  author={Jung, Kyudan and Kim, Jihwan and Kim, Soyoon and Kim, Jeonghoon and Choo, Jaegul and Park, Cheonbok},
  journal={arXiv preprint arXiv:2603.25750},
  year={2026},
  doi={10.48550/arXiv.2603.25750},
  url={https://arxiv.org/abs/2603.25750}
}
```
