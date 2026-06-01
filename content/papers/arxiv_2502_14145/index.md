---
paper_key: arxiv_2502_14145
canonical_id: "arxiv:2502.14145"
title: "LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems"
year: 2026
venue: "arXiv"
url: "https://arxiv.org/abs/2405.19487"
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



## Links
- [arXiv abstract](https://arxiv.org/abs/2405.19487)
- [PDF](https://arxiv.org/pdf/2502.14145)

## 一句話總結
提出以「semantic voice activity detection (VAD)」作為 dialogue manager (DM) 的 LLM 輕量模組，透過四個 control tokens 即時決定 full-duplex SDS 何時切換 speaking/listening、並有效區分 intentional vs unintentional barge-ins，且只在需要時啟動 core dialogue engine (CDE) 以降低推論成本。

## 這篇在解決什麼問題
full-duplex spoken dialogue system (SDS) 需要在「聽、說、思考」之間即時協調 turn-taking；但實務上常遇到：
- **Interfering speakers**：背景/同時講話導致 ASR 與 DM 誤判
- **User pauses & hesitations**：單靠 silence 無法判斷 query completion，易造成過早回覆或延遲
- **Unintentional interruptions**：backchannel/acknowledgments/對他人講話等會誤觸系統中止或改變節奏

作者的核心目標是：用語意層面的判斷（semantic VAD）來穩定管理 turn-switching/turn-keeping，讓系統同時流暢且計算有效率。

## 核心方法
### 1) 將 semantic VAD 放進 DM：用 LLM 預測控制行為
- 使用一個**fine-tuned 0.5B LLM**來實作 semantic VAD（作為 DM）
- 在短時間間隔處理輸入，輸出四個 **control tokens** 來規則化下一步行為：
  - **<|S-S|> start-speaking**：開始說話（回應生成前）
  - **<|S-L|> start-listening**：開始聆聽（停止說話、等待使用者）
  - **<|C-S|> continue-speaking**：持續說話（忽略 unintentional interruption）
  - **<|C-L|> continue-listening**：持續聆聽（使用者尚未完成 query，快取歷史直到完成）

### 2) 同時處理兩類任務：state + intention
- **User state detection（query complete vs incomplete）**  
  對應 <|C-L|>（continue listening, query incomplete）與 <|S-S|>（start speaking, query complete）
- **User intention analysis（intentional vs unintentional interruption）**  
  - **Real INT**（intentional interruption）：停止回覆、切到 <|S-L|>
  - **Fake INT**（unintentional interruption）：繼續回覆、切到 <|C-S|>

### 3) 非必要才啟動 CDE，降低計算開銷
- **CDE（core dialogue engine）只在 DM 判斷到 <|S-S|> 時才啟動**用於 response generation
- DM 負責高頻、即時決策，因此可以做到 **independent DM optimization**（不需要重訓/重建較大的 CDE），提升可擴充性。

## Training / Data
### 1) full-duplex conversation data 生成
- 因為缺乏公開符合四個 control tokens 標註需求的資料集
- 作者用 LLM API（Yuanbao）生成 full-duplex dialogues
- 透過 Algorithm 1 的 prompt 設計，讓生成資料包含：
  - 場景多樣的 conversational turns
  - interruption 類型（Real INT / Fake INT）
  - incomplete query（user query 隨機截斷）

### 2) 資料清理與結構化策略
- 初始生成約 **20,000 prompts** 後發現有部分輸出不完全符合結構/命令遵循度不足
- 進行 strict cleaning 與 filtering（retention rate 約 **60%**）
- 補充一個替代策略：先生成較易正確的 standard QA dialogues，再以 controlled post-processing 加入 full-duplex interaction patterns
- 最終訓練資料：
  - **11,990 conversations**
  - **80,338 dialogue rounds**
  - 並加入 extreme case 檢查，避免 overfitting（例如 real/fake interruption 比例過高或 incomplete queries 過度集中）
- 另加入對應的 uninterrupted dialogues，避免 base LLM 能力退化。

### 3) Fine-tuning 設定
- 使用 **0.5B-dense-8k model**（Hunyuan 小模型版本）
- 訓練時新增四個 control tokens
- 訓練步數 **1500 steps**、batch size **128**、learning rate **0.001 → 0.0001（linearly decayed）**
- 資料目前以 **Chinese** full-duplex dialogues 為主。

## 主要結果
### 1) control token 預測成效（Table 1）
- 混淆矩陣顯示四類 control token 的辨識表現非常高：
  - <|C-L|>：Recall ~ **0.926**, Precision ~ **0.987**
  - <|S-S|>：Recall ~ **0.989**, Precision ~ **0.930**
  - <|S-L|>：Recall/Precision 接近 **1.0**（Precision = **1.000**）
  - <|C-S|>：Recall **1.000**, Precision **1.000**
- 整體 **Accuracy / F1** 最高可達 **~0.9785**（以表中彙總指標呈現）

作者特別指出：**barge-in 相關判斷更穩定**，而 **query completion/state detection** 相對較難（因語意完整度受 speaking style 與語言細節影響）。

### 2) 與相關工作比較（Table 2）
- 因無法取得他們的 model checkpoints / test sets，僅能引用文中報告
- 作者主張：既有方法多把任務當作 classification、主要依 acoustic/linguistic pattern，semantic 能力不足
- semantic VAD 因引入 LLM 語意理解，能更 context-aware，因而在相對指標上表現更好。

### 3) 在真實錄音上的延伸驗證（Table 3）
- 使用內部錄音（原 half-duplex SDS 經驗資料），重點做 user state detection
- 對比 acoustic VAD（以 silence threshold 判斷 query complete）：
  - acoustic VAD 對 <|C-L|>/<|S-S|> 受 threshold 影響大
- 加上 semantic VAD refinement 後：
  - 多數情況 **F1 與 Accuracy 提升到 ~93.5% 以上**
- error analysis 顯示部分錯誤來自 **ASR errors**，不一定是 VAD 本身瓶頸。

## Project relevance
- **project-full-duplex-data**：關聯度高。作者提供了「從 mono-channel/對話文本生成到標註 control tokens 的 full-duplex conversation」資料生成與場景設計思路（含 Real INT/Fake INT、incomplete query 的合成）。
- **project-tts-data-pipeline**：關聯度中。雖然本文主體是 dialogue management，但其資料清理包含把輸入對齊 ASR/TTS 相關的文字層細節（如 punctuation 與 ASR output 風格對齊），可作為 pipeline 的參考要點。

## 我該不該細讀
- **建議細讀**：如果你關心 full-duplex SDS 的 **turn-taking policy**、以及如何用 lightweight LLM 做 **real-time DM**、同時降低 CDE 成本。
- **可略讀**：若你只在意純 ASR/VAD 基礎訊號處理，不太需要 semantic token 規則化與 LLM prompt/data 生成流程。

## 可能的弱點 / open questions
- **資料生成依賴 LLM 指令遵循與清理流程**：最終 retention rate 約 60%，且提出命令遵循能力不足需 post-processing，真實可重現性與成本未知。
- **ASR error 影響仍存在**：真實錄音結果顯示部分 misprediction 來源於 ASR errors，而不是完全解決端到端錯誤傳播。
- **系統延遲（delay）與端到端穩健性**：文中提到未來工作會處理 delay/robustness；因此目前是否符合嚴格即時性需求仍待驗證。
- **跨語言/多模態擴展**：目前以 Chinese 訓練資料為主，未來擴展到 large multimodal models 的方法論尚未落地。

## Tags
full-duplex, spoken dialogue system, voice activity detection, dialogue management, large language model, turn-taking, barge-in, real-time inference efficiency

## Concepts
semantic VAD, dialogue manager (DM), core dialogue engine (CDE), control tokens (<|S-S|>, <|S-L|>, <|C-S|>, <|C-L|>), intentional interruption (Real INT), unintentional interruption (Fake INT), query completion / incomplete query, instruction tuning, full-duplex conversation data generation, data cleaning & filtering, ASR-aware evaluation, real-time decision-making

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
```bibtex
hao2026llmenhanceddialoguemanagemen
```
