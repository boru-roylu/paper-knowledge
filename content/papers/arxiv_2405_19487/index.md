---
paper_key: arxiv_2405_19487
canonical_id: "arxiv:2405.19487"
title: "A Full-duplex Speech Dialogue Scheme Based On Large Language Model"
year: 2024
venue: "arXiv preprint"
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

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- OpenReview summary model: `gpt-5.5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2405.19487)
- [PDF](https://arxiv.org/pdf/2405.19487)

## 一句話總結
這篇把 full-duplex speech dialogue system 形式化成一個由 LLM 驅動的 neural FSM，讓模型在即時串流對話中同時負責回應、等待、與 interruption 控制，以降低 latency 並提升 turn-taking 精準度。

## 這篇在解決什麼問題
作者要解決的是：傳統 LLM-based dialogue 幾乎都是 half-duplex，也就是「你講完我再講」，但真實人類對話需要同時 listening、speaking、判斷是否該插話或讓出話輪。這篇聚焦的痛點包括：

- **response latency 太高**：等完整 utterance 結束才回應，互動不自然
- **turn-taking 不夠靈活**：無法即時處理 user interruption、backchannel、noise
- **ASR/TTS pipeline 難協同**：語音輸入、生成、輸出之間有額外延遲
- **要能分辨「該打斷」與「不該打斷」**：例如 user 真正改話題 vs. 噪音或附和
- **想用現成 open-source models 做出 full-duplex 能力**：避免依賴未公開細節的商用 multimodal model

簡單說，這篇是在做一個「把對話控制變成 next-token prediction 的 full-duplex speech dialogue scheme」。

## 核心方法
核心方法是把 full-duplex dialogue 轉成一個 **neural FSM** 問題，並讓 LLM 透過控制 tokens 學會對話狀態轉移。

### 1) 三模組架構
系統由三部分組成：

- **perception module**：用 streaming ASR 接收使用者語音，將 audio chunk 轉成 token 並串流給 LLM
- **full-duplex capable LLM**：負責語意理解、生成回覆，以及決定何時切換狀態
- **motor function module**：用 TTS 把 LLM 生成的文字轉成語音

### 2) Neural FSM
LLM 被教導操作一個只有兩個 state 的 FSM：

- `SPEAK`
- `LISTEN`

並透過四個 control tokens 表示 state transition：

- `[C.SPEAK]`：`SPEAK -> SPEAK`
- `[S.LISTEN]`：`SPEAK -> LISTEN`
- `[C.LISTEN]`：`LISTEN -> LISTEN`
- `[S.SPEAK]`：`LISTEN -> SPEAK`

這個設計讓模型可以在同一個 autoregressive generation 流程中，同時學會：

- 回答內容生成
- 等待使用者講完
- 判斷有效 interruption
- 忽略 fake interruption 或第三方 noise

### 3) Serialized real-time dialogue
作者把即時對話串成 token 序列，在 streaming input 下做 next token prediction。也就是說，LLM 不只是生成回答文字，還會在序列中插入 state transition token，直接驅動 dialogue manager 行為。

### 4) 以 existing open-source models 實作
文章強調不依賴端到端專有 multimodal model，而是用現成的 ASR、TTS 與 LLM 組合出 full-duplex 行為，降低實作門檻。

## Training / Data
- 使用 **fine-tuning / SFT** 方式讓 LLM 學會 neural FSM 與 full-duplex interaction patterns
- 透過 **GPT-4 生成的 synthetic dialogue data** 建構訓練與 benchmark
- 資料中刻意加入多種情境：
  - user interruption
  - denial / dissatisfaction
  - follow-up question
  - topic shift
  - third-party noise
  - affirmation / backchannel
  - incomplete user utterance
  - obvious factual error correction
- benchmark 規模在文中提到約 **1,000** 筆單輪與多輪口語對話
- ASR 以 **640 ms chunks** 串流輸入 LLM
- 文中也提到因為只用 full-duplex conversation data 做 SFT，會影響其他能力，作者認為之後可混入其他資料緩解

## 主要結果
作者報告的重點結果是：

- **平均 conversation response latency 比 LLM-based half-duplex systems 降低超過 3 倍**
- **超過 50% 的互動中，response latency 低於 500 ms**
- 在 interruption 評估上：
  - 對 user interruption 的 proper response rate 可達 **96.7%**
  - machine proper interrupt precision 為 **54.7%**
  - 文中聲稱比 GPT-4o、GPT-3.5-turbo-0125 更好
- 以 **8B** 等級 LLM 就能達成這些控制行為，主打 small model 也能做 full-duplex control

## Project relevance
project-full-duplex-data

## Related papers in my pool
- **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems (2025)**：同樣是 speech-LLM + full-duplex + dialogue management，關心 turn-taking / interruption 控制；相較之下，這篇更偏向把 LLM 做成 dialogue manager，而本篇是用 neural FSM 把 full-duplex control 直接納入 LLM 生成流程。
- 目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
有公開 OpenReview review/rebuttal context。主要討論集中在以下幾點：

- **weakness: 依賴 ASR/TTS pipeline 而非 unified end-to-end model**
  - reviewer 擔心 ASR 與 TTS 之間的傳遞會造成 error propagation 與 information loss
  - authors 回應：當下缺乏可用的 open-source end-to-end multimodal LLM，因此先用現成模組驗證 neural FSM 可行性；他們也認為這個方法未來可移植到 unified model
- **weakness: evaluation metrics 不夠完整**
  - reviewer 指出 latency 與 interruption precision 不能充分衡量 dialogue quality，還需要看 helpfulness / relevance
  - authors 回應偏樂觀，聲稱 current LLM 的 helpfulness / relevance 可被保證，reviewer 明確不買單，認為這是需要在 final draft 中寫成 limitation 的地方
- **weakness: comparison 與 additional experiments 不夠**
  - reviewer 認為還需要更多比較與更強證據，才能宣稱 SOTA
  - authors 在 rebuttal 中強調其方法是首個公開的 LLM + full-duplex 實作，並解釋為何選擇 current setup
- **整體影響**
  - reviewer 對方向持正面態度，但對 claim 的範圍與 evaluation 充分性保持保留
  - 對細讀者來說，這篇更適合當作 **system-level proof-of-concept**，而不是完整解決 dialogue quality 評估的終局方案

## 我該不該細讀
**如果你在做 project-full-duplex-data，建議細讀。**  
特別值得看的是：

- neural FSM 的狀態設計與 control token formulation
- GPT-4 synthetic dialogue data 的建構方式
- interruption / backchannel / noise 的標註與評估設定
- 這種把 dialogue control 直接轉成 token prediction 的實作思路

但如果你的重點是高品質 speech data curation 或 transcription cleaning，這篇就不是主線，因為它更偏 **full-duplex interaction control**，不是 data pipeline。

## 可能的弱點 / open questions
- **強依賴 ASR + TTS pipeline**：端到端延遲與錯誤傳遞仍在
- **評估指標偏窄**：latency / interruption precision 不足以描述整體 dialogue usefulness
- **synthetic data 偏多**：GPT-4 生成的對話能否覆蓋真實人類互動的複雜性，仍有疑問
- **machine interrupt precision 只有 54.7%**：表示「何時該打斷」仍不算穩
- **對 open-source / commercial baseline 的公平性**：不同系統在資料、提示、模組配置上的可比性未必完全一致
- **unified multimodal model 的未來可行性**：作者說方法可遷移，但尚未實證
- **helpfulness / relevance 沒有直接量化**：這是 reviewer 明確提出的 limitation

## Tags
full-duplex, speech-llm, dialogue-management, neural-FSM, turn-taking, interruption-detection, ASR, TTS, streaming-inference, synthetic-dialogue-data

## Concepts
- **full-duplex dialogue**
- **half-duplex dialogue**
- **neural FSM**
- **SPEAK / LISTEN state**
- **control tokens**
- **turn-taking**
- **barge-in / interruption**
- **backchannel**
- **streaming ASR**
- **TTS**
- **next token prediction**
- **serialized real-time dialogue**
- **perception module**
- **motor function module**
- **latency**
- **interruption precision**
- **semantic-aware dialogue control**

## Citation
```bibtex
@article{wang2024afullduplexspeechdialogueschem,
  title={A Full-duplex Speech Dialogue Scheme Based On Large Language Model},
  author={Wang, Peng and Lu, Songshuo and Tang, Yaohua and Yan, Sijie and Xia, Wei and Xiong, Yuanjun},
  journal={arXiv preprint},
  year={2024},
  eprint={2405.19487},
  archivePrefix={arXiv}
}
```
