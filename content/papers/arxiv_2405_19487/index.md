---
paper_key: arxiv_2405_19487
canonical_id: "arxiv:2405.19487"
title: "A Full-duplex Speech Dialogue Scheme Based On Large Language Model"
year: 2024
venue: "Neural Information Processing Systems"
url: "https://arxiv.org/abs/2405.19487"
pdf_url: "https://arxiv.org/pdf/2405.19487"
status: read
rating: 4
tags:
  - speech-llm
  - full-duplex
  - turn-taking
  - dialogue
  - project-full-duplex-data
created: 2026-05-31
---

<div class="paper-nav"><a href="../../">&larr; Papers</a></div>




## Links

- [arXiv abstract](https://arxiv.org/abs/2405.19487)
- [PDF](https://arxiv.org/pdf/2405.19487)

## 一句話總結

這篇提出一個 LLM-based full-duplex speech dialogue system，用 neural FSM 和 streaming perception / motor modules 讓 LLM 能邊聽邊說，並學會在適當時機 interrupt 或讓出話輪。

## 這篇在解決什麼問題

一般 speech dialogue system 多半是 half-duplex：使用者講完、ASR 結束、LLM 回答、TTS 播放，整個流程有明顯 latency，而且很難自然處理 user interruption 或 machine interruption。作者想讓 LLM 不只是產生文字，而是同時成為 dialogue manager，直接控制什麼時候 speak、listen、continue speaking、或 concede。

## 核心方法

作者把 full-duplex dialogue 建模成一個 two-state neural finite-state machine：`SPEAK` 與 `LISTEN`。LLM 在每個 timestep 可以輸出一般文字 token，也可以輸出 control token 來表示 state transition，例如繼續說、停止聽、開始說、或繼續聽。Perception module 用 streaming ASR 以 640 ms chunk 將使用者語音轉成文字片段；motor module 用 streaming TTS 把 LLM token 即時轉成語音。這樣 conversation timeline 被序列化成一條 token tape，讓 full-duplex control 變成 next-token prediction 問題。

## Training / Data

基底模型是 Llama-3-8B-Instruct。作者用 GPT-4 生成 1500 組帶有 interruption、denial、affirmation、background noise、topic shifting 等情境的對話 transcript，並標註 neural FSM control tokens。Fine-tuning 使用 8 張 NVIDIA A100，batch size 256，learning rate 1e-5，訓練 20 steps。評估集包含約 3000 筆 duplex-dialogue-3k，其中 machine interruption 約 2000 筆，user interruption 依四種 pattern 各生成 180 筆。

## 主要結果

- Full-duplex configuration 的 average first token emission delay (FTED) 是 0.68s，baseline half-duplex 是 2.28s，約降低 3 倍以上。
- 50% interaction 可在 0.41s 內開始回應；90% latency 是 1.60s。
- Llama-3-8B-Instruct-fd 的 machine interruption precision 是 54.7%，高於 GPT-4o 的 46.6% 與 GPT-3.5-turbo-0125 的 24.7%。
- User interrupts machine 的平均 proper response rate 是 96.7%，略高於 GPT-4o 的 96.1%。
- OpenCompass regression 顯示 fine-tuning 對原本 LLM 能力有小幅影響，MMLU 從 68.4 到 67.5，HumanEval 從 55.5 到 50.6。

## Project relevance

- **Project A: Full-duplex data and model**: 高相關。這篇不是資料清理 paper，而是 full-duplex model/control paper；它提供 neural FSM、control tokens、turn-taking / interruption supervision 的設計，對「如何讓模型知道何時 backchannel、何時 overlap、何時讓出話輪」很有啟發。
- **Project B: TTS data pipeline**: 低到中相關。它不直接處理 TTS data cleaning，但它定義了 full-duplex interaction 需要的行為標籤與 evaluation metrics，可能可以反過來指導 TTS / spoken dialogue data 的標註與過濾。

短評：這篇主要歸到 `#project-full-duplex-data`；若要 deep review，應優先看 control-token schema 和 duplex-dialogue-3k 的 synthetic data construction。

這篇對 speech LLM / full-duplex agent 很直接相關。它不是把 audio token 直接丟進 multimodal LLM，而是提供一個可實作的中間路線：用 streaming ASR/TTS 加上一個被 instruction-tuned 的 LLM controller。對你的 agent 來說，最有用的是 neural FSM abstraction、control-token supervision、以及用 simulated interruption data 訓練 turn-taking / interruption behavior 的方法。

## 我該不該細讀

值得細讀。它和 Sommelier / DialogueSidon 都在 full-duplex spoken dialogue 這條線上，但這篇更偏 system control 與 dialogue policy，而不是 audio preprocessing 或 data recovery。建議之後用 `deep review` 補看：control token design、duplex-dialogue-3k construction、以及 evaluation metrics 是否能移植到你的 speech LLM benchmark。

## 可能的弱點 / open questions

- 系統仍依賴 ASR 與 TTS pipeline，還不是 end-to-end speech-to-speech multimodal LLM。
- Fine-tuning 資料主要由 GPT-4 synthetic transcript 產生，真實互動資料的 coverage 可能不足。
- 訓練只有 1500 series / 20 steps，scaling behavior 還不清楚。
- Interruption appropriateness 依賴 GPT-4-turbo 評分，human evaluation 或 cross-evaluator robustness 仍值得檢查。
- Full-duplex 行為可能強烈依賴 ASR chunking、TTS latency、VAD/endpoint policy 等工程細節。

## Tags

#speech-llm #full-duplex #turn-taking #dialogue #project-full-duplex-data

## Concepts

- full-duplex dialogue
- neural finite-state machine
- streaming ASR
- streaming TTS
- interruption handling
- first token emission delay
- duplex-dialogue-3k

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
Published at Neural Information Processing Systems 2024 according to the arXiv record.

```bibtex
@inproceedings{wang2024fullduplexspeechdialogue,
  title     = {A Full-duplex Speech Dialogue Scheme Based On Large Language Model},
  author    = {Wang, Peng and Lu, Songshuo and Tang, Yaohua and Yan, Sijie and Xia, Wei and Xiong, Yuanjun},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2024},
  doi       = {10.48550/arXiv.2405.19487},
  url       = {https://arxiv.org/abs/2405.19487},
  note      = {Accepted to Neural Information Processing Systems 2024}
}
```
