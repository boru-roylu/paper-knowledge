---
paper_key: arxiv_2502_14145
canonical_id: "arxiv:2502.14145"
title: "LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2502.14145"
pdf_url: "https://arxiv.org/pdf/2502.14145"
status: read
rating: 4
tags:
  - speech-llm
  - full-duplex
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-31
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2502.14145)
- [PDF](https://arxiv.org/pdf/2502.14145)

## 一句話總結
這篇提出一個以 0.5B LLM 實作的 semantic VAD dialogue manager，用 control tokens 管理 full-duplex spoken dialogue system 的 turn-taking，藉由把頻繁決策從 core dialogue engine (CDE) 分離出來來兼顧互動自然度與 inference efficiency。

## 這篇在解決什麼問題
這篇在解決 full-duplex spoken dialogue system (SDS) 的核心互動控制問題：系統要在「邊聽邊說」的情境下，即時判斷何時該繼續聽、開始說、繼續說，或因為 user barge-in 而切換狀態。

作者指出幾個難點：
- **interfering speakers** 會干擾 ASR 與 turn-taking 判斷
- **pauses / hesitations** 不等於 query completion，容易造成太早回應或拖太久
- **intentional vs. unintentional interruptions** 很難只靠 acoustic VAD 分清
- 把 dialogue management 直接塞進大型 CDE 會增加 inference overhead，不利於 real-time full-duplex

所以這篇的目標不是提升 QA 能力本身，而是設計一個更聰明、更輕量的 **dialogue manager (DM)** 來管理互動流程。

## 核心方法
核心方法是把 dialogue management 做成一個 **semantic VAD**，並用一個 fine-tuned small LLM 來預測控制 token。

### 1) Semantic VAD 作為 DM
模型不是傳統只看 voice activity 的 VAD，而是結合 semantic context 來判斷互動狀態。它的任務是根據輸入 speech / ASR tokens 與歷史對話上下文，預測四種 control tokens：

- `<|Continue-Listening|>`: query incomplete，繼續聽
- `<|Start-Speaking|>`: query complete，開始回覆
- `<|Start-Listening|>`: 偵測到 **intentional interruption**，停止說話並切回聽
- `<|Continue-Speaking|>`: 偵測到 **unintentional interruption**，維持說話

### 2) Lightweight LLM fine-tuning
semantic VAD 是一個 **0.5B LLM**，透過 instruction tuning / fine-tuning 在 full-duplex conversation data 上學習這些控制規則。

重點是它學的是 **structured interaction policy**，不是一般問答生成。

### 3) Modular architecture
系統把頻繁、短週期的決策交給 DM，只有在模型判定要回覆時才啟動 CDE：
- 前段：acoustic echo cancellation (AEC) / acoustic VAD / ASR / semantic VAD
- 後段：CDE 負責 response generation
- 好處：DM 可以獨立優化，不必重新訓練 CDE

### 4) Short-interval decision making
DM 會以短時間間隔處理輸入，讓系統能即時更新 turn-taking 狀態，降低 full-duplex 中的反應延遲。

## Training / Data
### Data
這篇最大的資料貢獻之一是為 DM 構造 **full-duplex conversation data**，因為作者認為 public datasets 無法滿足帶有這些 control tokens 的標註需求。

資料生成方式：
- 用 LLM API（Yuanbao）生成多樣的 full-duplex dialogues
- prompt 會明確指定：
  - dialogue topic
  - speaking style
  - QA rounds 數量
  - real interruption / fake interruption / normal QA 的比例
  - incomplete queries 的截斷情境

資料設計包含：
- **200 個 common conversation themes**
- **10 種 user personas / speaking styles**

### Training
- 模型：**0.5B LLM**
- 訓練方式：fine-tuning / instruction tuning
- 目標：讓模型學會輸出四種 control tokens
- 重點在 dialogue management policy 的學習，而非端到端 conversation generation

## 主要結果
從摘要與 excerpt 可確認的主要結果是：

- semantic VAD 能有效做 **turn-switching / turn-keeping**
- 能區分 **intentional** 與 **unintentional barge-ins**
- 能偵測 **query completion**，處理 pauses 與 hesitations
- 透過只在需要時啟動 CDE，降低 **computational overhead**
- 實驗顯示 interaction fluidity 與 intent recognition 有改善

從 table excerpt 可見，作者在 control-token 相關任務上取得很高的分類表現；例如某些類別 recall / F1 非常高，整體 accuracy 也接近滿分，顯示這個 DM 在設計的標註空間內學得很穩。

不過目前 excerpt 沒有完整提供所有 benchmark、baseline 和 real-world latency 指標，因此這篇更像是先證明 **interaction control 可行**，而不是全面證明 large-scale product-level robustness。

## Project relevance
- **project-full-duplex-data**：高度相關
- **project-tts-data-pipeline**：低相關

## Related papers in my pool
和 pool 裡已讀的 **SoulX-Duplug** 有明顯相關，因為兩者都處理 **full-duplex speech conversation** 的 turn-taking / state control，而且都強調 modular design 與 real-time decision-making。

主要相似處：
- 都是 full-duplex / speech-LLM 系統
- 都把互動控制做成獨立模組，而不是全部塞進單一大模型
- 都重視低 latency 的 streaming / real-time control
- 都需要 full-duplex conversation data 來訓練控制模組

主要差異：
- 這篇是 **semantic VAD / dialogue manager**，重點在語意層 turn-taking 與 barge-in handling
- SoulX-Duplug 偏向 **streaming state prediction**，並整合 streaming ASR
- 這篇使用 **synthetic full-duplex conversation data** 來 fine-tune 0.5B LLM；SoulX-Duplug 更偏系統化 streaming module 設計

目前 pool 裡沒有其他明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
如果你在做 **full-duplex spoken dialogue systems、turn-taking、barge-in detection、dialogue manager design**，這篇值得細讀，因為它提供了一個清楚的 modular formulation：把互動控制抽成 semantic VAD，並用小型 LLM 做控制決策。

如果你主要關心的是：
- 端到端 speech generation
- TTS data cleaning / filtering
- 或大規模 ASR pretraining

那這篇不是第一優先，但仍可作為 full-duplex control 的 reference architecture。

## 可能的弱點 / open questions
- **synthetic data reliance**：訓練資料主要來自 LLM 生成，和真實 conversational dynamics 之間可能有 domain gap
- **control-token space 很手工**：四個 token 的設計雖然清楚，但是否足夠覆蓋更複雜的 interaction phenomena 仍不確定
- **robustness to real-world noise**：對 interference、channel mismatch、far-field speech 的穩定性還需要更多驗證
- **scalability to richer multimodal contexts**：作者也提到未來要擴展到 large multimodal models，目前方法主要是文字/語意導向
- **latency / end-to-end deployment details 不夠完整**：雖然強調 efficiency，但 excerpt 中還看不到完整延遲拆解與系統整合成本
- **evaluation realism**：若測試集與訓練資料分佈接近，control performance 可能偏樂觀

## Tags
full-duplex, spoken dialogue system, dialogue management, semantic VAD, barge-in detection, turn-taking, LLM, instruction tuning, real-time interaction, speech-LLM

## Concepts
- full-duplex spoken dialogue system (SDS)
- dialogue manager (DM)
- semantic VAD
- acoustic VAD
- turn-taking / turn-switching / turn-keeping
- intentional interruption / unintentional interruption
- barge-in
- query completion
- core dialogue engine (CDE)
- control tokens
- instruction tuning
- computational overhead
- real-time interaction management

## Citation
```bibtex
@misc{hao2025llmenhanceddialoguemanagementf,
  title={LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems},
  author={Hao and Weiwei and Rilin and Vinay and Meng and Dong},
  year={2025},
  eprint={2502.14145},
  archivePrefix={arXiv},
  primaryClass={},
  url={https://arxiv.org/abs/2502.14145}
}
```
