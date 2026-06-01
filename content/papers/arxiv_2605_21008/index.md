---
paper_key: arxiv_2605_21008
canonical_id: "arxiv:2605.21008"
title: "A Survey of Audio Reasoning in Multimodal Foundation Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.21008"
pdf_url: "https://arxiv.org/pdf/2605.21008"
status: read
rating: 4
tags:
  - speech-llm
  - audio-reasoning
  - multimodal-foundation-models
  - spoken-interaction
  - latency
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-31
---

<div class="paper-nav"><a href="../../">&larr; Papers</a></div>




## Links

- [arXiv abstract](https://arxiv.org/abs/2605.21008)
- [PDF](https://arxiv.org/pdf/2605.21008)

## 一句話總結

這是一篇 audio reasoning survey，整理 multimodal foundation models 如何從 audio input 做推理、如何產生 text 或 speech response，以及為什麼 audio reasoning 不能只靠 ASR transcript 或 text-only CoT 來解決。

## 這篇在解決什麼問題

作者指出目前 foundation model 的 reasoning 主要成熟在 text 和 vision，但 audio 有自己的困難：訊號是 continuous、temporally dense，而且同時包含 linguistic、paralinguistic、speaker state、prosody、overlap、background event 等多層資訊。若模型只把 audio 轉成 transcript 再交給 LLM，很多 acoustic cues 會消失，也容易出現 `shortcut learning` 或 `modality hallucination`：模型看似在做 audio reasoning，其實只是依賴文字先驗猜答案。

這篇 survey 的目標是把 audio reasoning 的問題定義、模型架構、training 方法、evaluation 和 open challenges 系統化，讓後續研究可以更清楚地區分「真的 grounded in audio」和「只是 text-surrogate reasoning」。

## 核心分類

作者把 audio reasoning 分成四個主要 paradigms：

1. `Audio-to-Text Reasoning`: audio input，text output。重點是如何用 acoustic / paralinguistic / temporal evidence 回答問題，而不是只讀 transcript。
2. `Audio-to-Speech Reasoning`: audio input，speech output。這裡除了 reasoning accuracy，還要處理 real-time latency，尤其是 spoken interaction 裡 reasoning depth 與 response delay 的 trade-off。
3. `Audio-Visual Reasoning`: 同時使用 audio 和 visual evidence，需要 temporal alignment、cross-modal grounding 和 modality disambiguation。
4. `Agentic Audio Reasoning`: 把 audio task 拆成 perception、planning、tool use、memory、reflection 或 multi-agent collaboration，從單一生成模型擴展到 structured problem solving。

## 主要觀察

- Audio reasoning 的關鍵不是把 CoT 搬到 speech 上，而是要處理 acoustic grounding。模型必須知道哪些 inference 真的來自 waveform，哪些只是 language prior。
- 現有資料常用 text-only LLM 根據 transcript、caption 或 sound event tags 合成 reasoning chain，但這些 chain 不一定忠實於原始 audio。
- Real-time spoken reasoning 面臨 accuracy vs. latency trade-off。長 CoT 可能提高答案品質，但會破壞 conversation flow；因此近年的方向包括 `thinking while listening` 和 `thinking while speaking`。
- Long-context audio reasoning 還不成熟。meeting、podcast、continuous interaction 這類長音訊會帶來 sequence length、memory、event recall 和 multi-hop reasoning 問題。
- Evaluation 仍然不足，尤其缺少能判斷模型是否真的使用 acoustic cues，而不是依靠 transcript shortcut 的 benchmark。

## 跟現有研究的差異

這篇不是提出新模型，而是整理 field map。它的價值在於把 audio reasoning 從 broader audio LLM / spoken language model / multimodal CoT literature 裡獨立出來，並明確強調幾個以前容易混在一起的問題：

- `audio understanding` 不等於 `audio reasoning`
- `speech-to-text + LLM` 不等於 native audio reasoning
- `CoT token` 不代表 reasoning grounded in acoustic signal
- `real-time spoken interaction` 不能只看 final answer accuracy，也要看 latency、interruptibility 和 turn-level behavior

## Project relevance

對 `project-full-duplex-data`，這篇最有用的是它對 real-time `Audio-to-Speech Reasoning` 的整理。full-duplex model 不只是要生成語音，還要在 user 還沒講完時理解 partial audio、保留 acoustic cues，並決定什麼時候 backchannel、interrupt、continue listening 或 start speaking。這跟我們想合成有 overlap / backchannel 的 dual-channel conversation data 很接近：資料不應該只標 transcript，也應該保留 timing、prosody、speaker state 和 interaction policy。

對 `project-tts-data-pipeline`，這篇比較間接，但仍然提醒我們 data cleaning 不能只以 transcript correctness 為唯一目標。若 training data 要支援 spoken interaction 或 audio-grounded reasoning，就要知道哪些 acoustic cues 應該保留，哪些 overlap/noise/ASR error 會讓模型學到錯誤 shortcut。它也支持我們把 overlap detection、ASR quality、speaker contamination、latency-aware segmentation 都放進 data pipeline 的品質指標裡。

## 可以帶走的設計啟發

- 做 audio / speech model evaluation 時，要加入能測 `acoustic grounding` 的 case，例如只靠 transcript 無法回答、但靠 prosody / overlap / speaker timing 可以回答的題目。
- 若之後要做 full-duplex synthetic data，除了 transcript 和 speaker turns，也應該顯式產生 timing labels、backchannel labels、interruption labels 和 overlap labels。
- 對 long-form audio，單純把所有 acoustic tokens 丟進模型很可能不可行，需要 chunking、memory、event indexing 或 retrieval-style compression。
- 對 real-time systems，應該分開評估 offline accuracy、streaming accuracy、first response latency、interrupt handling 和 conversation naturalness。

## 限制

這是 survey paper，因此沒有新的 benchmark result 或 model ablation。它對很多方向提供 taxonomy 和 open problems，但不會直接告訴我們哪個 architecture 最適合訓練 full-duplex model，或哪種 data pipeline filter 最有效。實作上仍需要回到各個被 survey 的原始 paper。

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
```bibtex
@misc{guo2026surveyaudioreasoning,
  title={A Survey of Audio Reasoning in Multimodal Foundation Models},
  author={Guo, Zhihan and Cui, Wenqian and Lin, Guan-Ting and Tan, Daxin and Li, Jingyao and Zheng, Qiyong and Wang, Dingdong and Xiong, Jing and Shi, Han and Jia, Jiaya and King, Irwin},
  year={2026},
  eprint={2605.21008},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2605.21008}
}
```
