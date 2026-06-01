---
paper_key: arxiv_2605_27258
canonical_id: "arxiv:2605.27258"
title: "PilotTTS: A Disciplined Modular Recipe for Competitive Speech Synthesis"
year: 2026
venue: "arXiv"
url: "https://arxiv.org/abs/2605.27258v2"
pdf_url: "https://arxiv.org/pdf/2605.27258"
status: read
rating: 4
tags:
  - speech-llm
  - tts
  - speech-data
  - project-tts-data-pipeline
created: 2026-05-31
---

<div class="paper-nav"><a href="../../">&larr; Papers</a></div>



## Links
- [arXiv abstract](https://arxiv.org/abs/2605.27258v2)
- [PDF](https://arxiv.org/pdf/2605.27258)

## 一句話總結
PilotTTS 用「可重現的 data engineering + 模組化整合」而非堆更大/更複雜模型，在約 200K hours 訓練資料下達到競爭等級的 zero-shot TTS，並能透過解耦 conditioning 做 emotion、paralinguistics、dialect 等控制。

## 這篇在解決什麼問題
- 開源社群缺乏一套能把網路音訊做成**高品質、可標註、可過濾**的資料管線（data processing pipeline）來訓練出有競爭力的 TTS。
- 既有高表現系統常因為**資料規模巨大**、**管線/工程封閉**與**架構高度複雜**導致難以落地。
- 同時要兼顧：**speaker fidelity**（零樣本聲紋相似度）、**content accuracy**（內容正確率）、以及多維控制（emotion / paralinguistics / dialect），但在資源受限下如何達成。

## 核心方法
### 1) 三階段公開資料管線（publicly available tools）
- **Quality assessment & enhancement**：統一取樣率/格式、SAD（speech activity detection）、SCD（speaker change detection）、DNSMOS、speech/non-speech classifier、SNR 估計；對低品質片段做 denoising/enhancement。
- **Label annotation**：多 ASR 系統（Paraformer、FireRedASR、Whisper 等）交叉一致；OSD（overlapping speech detection）+ forced alignment；再用 Qwen3-based forced alignment 做 prosody annotation；用 3D-Speaker-Toolkit 做 speaker tagging；並做頻寬/光譜品質檢測。
- **Quality filtering**：truncation detector（截斷檢測）、synthetic speech detector（合成語音偵測）；最後依多種 quality tags/可靠度指標整合過濾，輸出約 **200,000 hours** 的中英語訓練資料（保留被丟棄樣本的 metadata 方便未來重組）。

### 2) 模組化 TTS 架構（Integration > Architectural novelty）
- **Speech tokenizer**：直接採用 CosyVoice 3 的 single-codebook FSQ tokenizer（25Hz，每 40ms 一 token；FSQ quantization，離散 codebook）。
- **Autoregressive text-to-semantic（Qwen3 backbone）**：用 Qwen3 產生語義/音訊 semantic tokens（autoregressive）。
  - **Decoupled conditioning**：  
    - `CAMPPlus`：frozen speaker embedding（靜態 timbre / identity）  
    - `Q-Former`（BLIP2-style）：從 w2v-BERT embeddings 做 cross-attention 抽取 style condition tokens（動態 speaking style、prosody 等）  
    - **cross-sample paired training**：同一 speaker 的不同 utterance 當 reference，迫使 speaker 訊息與內容解耦，提升對 emotion/dialect 等控制的可用性。
  - **Emotion/paralinguistics/dialect**：透過 post-training 或 SFT 加強顯式控制。
- **CFM decoder（Conditional Flow Matching + DiT）**：把預測的 semantic codes + 參考 mel、speaker embedding 等條件，透過 10-step iterative denoising 生成目標 mel-spectrogram。
- **HiFi-GAN vocoder**：mel → waveform。

## Training / Data
- **Pre-training**：約 **200K hours**（中文 + 英文），資料來源為 public sources 並經由該三階段 pipeline 處理。
- **Post-training / capabilities**：
  - **Emotion**：約 **2,200 hours**（約 1,000h 高品質 + 1,200h augmented），涵蓋 7 個 primary categories + 4 個 extended categories（總計 11 類）。
  - **Paralinguistic**：約 **200 hours**（laughter / breathing / crying / coughing 等；包含 LAUGH_SPAN 與 CRY 的能力）。
  - **Dialect**：約 **16,000 hours**，覆蓋 **14 Chinese dialects**（由 dialect ASR corpora 產生）。
- **Model**：
  - AR 模塊：Qwen3-0.6B
  - CFM decoder：DiT 約 300M parameters
  - Vocoder：HiFi-GAN
  - Tokenizer：CosyVoice 3 FSQ（single-codebook）

## 主要結果
### Zero-shot speech（Seed-TTS Eval）
- **Speaker similarity (SIM)**：PilotTTS 在 test-zh/test-en 分別達 **0.862 / 0.815**，整體最佳，顯著優於多數基準（以 SIM 指標最突出）。
- **Content accuracy**：
  - test-zh **CER 0.87%**（接近最佳）
  - test-en **WER 1.50%**（最低）
- 且在資料效率上具說服力：僅約 200K hours，仍能壓過或接近使用更大量資料的系統。

### Emotion control（human eval success rate）
- primary emotions 平均：PilotTTS **88.1%**，優於 CosyVoice 3（83.8%）。
- speaker similarity 在 emotion control 前後的降幅也較小，顯示 decoupled conditioning 對 timbre preservation 有幫助。

### Paralinguistic synthesis（human eval success rate）
- overall（可比類別）：PilotTTS **85.1%**，優於 CosyVoice 3（80.4%）與 Fish-Speech S2（64.3%）。
- PilotTTS 額外能力：
  - **LAUGH_SPAN**：**94.6%**
  - **CRY**：**61.9%**（基線系統不支援）

### Dialect synthesis（subjective accuracy；失敗定義：非目標方言比例 > 10%）
- Same-Dialect：**91.80%**
- Mandarin-to-Dialect：**86.46%**
- Cross-Dialect：**85.38%**
- 結果支持其「parallel data construction」與「mixed-prompt sampling」能緩解方言資料稀缺。

### Ablation（conditioning components）
- 去掉 Q-Former condition tokens 會明顯惡化 content accuracy（例如 test-hc CER 大幅上升）。
- 去掉 speaker embedding（CAMPPlus）對 SIM 影響最大，但 content accuracy 未必更差，顯示兩路 conditioning 分工互補。

## Project relevance
- **project-full-duplex-data**：中等相關  
  - 主要貢獻在 TTS 與可控語音合成（speaker/style 解耦、overlap/OSD 與資料標註），若你要合成對話中的重疊/回應風格，它可作為語音端的能力來源與資料整理參考。
- **project-tts-data-pipeline**：高相關  
  - 文章的最大價值是「可重現、模組化、公開工具驅動」的 English/Chinese TTS data cleaning、label annotation、overlap detection（OSD）、transcription reliability、truncation/synthetic filtering 的完整 pipeline 設計，與你的資料管線方向高度一致。

## 我該不該細讀
- 建議細讀：如果你正在做 **TTS data pipeline / dataset construction**、或想把 **OSD/ASR 交叉一致/quality filtering** 這套工程化流程落地。
- 可選細讀：如果你主要關注 AR/CFM 架構創新，因本文更偏「整合與工程」，架構本身的 novelty 相對有限。

## 可能的弱點 / open questions
- **顯式 style modeling 較弱**：作者承認缺少 dedicated style encoder，風格粒度可能受限。
- **tokenizer 資訊上限**：single-codebook FSQ 的表達容量可能難以擴展到更複雜場景（例如 singing/background music）。
- **mel + separate vocoder 的間接重建**：可能引入額外失真；端到端 waveform generation 是未來方向。
- 未在摘要/節錄中看到更細的問題分析（例如 robustness 失敗案例、長提示/噪聲提示的定量曲線、overlap/backchannel 的具體品質評估等），可能需要讀原文更完整的實驗細節。

## Tags
TTS, zero-shot TTS, autoregressive, Qwen3, Conditional Flow Matching (CFM), DiT, HiFi-GAN, FSQ tokenizer, speaker embedding, Q-Former, data pipeline, quality filtering, ASR, forced alignment, OSD

## Concepts
- **zero-shot TTS / speaker similarity (SIM)**
- **content accuracy (CER/WER)**
- **decoupled conditioning**（CAMPPlus speaker embedding + Q-Former style condition tokens）
- **cross-sample paired training**（同 speaker 不同 utterance 做 reference 以解耦內容與說話風格）
- **Conditioning-based generation**：CFM + DiT 產生 mel-spectrogram
- **data engineering pipeline**：SAD/SCD、DNSMOS、SNR、ASR ensemble、OSD、forced alignment、truncation detector、synthetic speech detector
- **controllability**：emotion control、paralinguistics（LAUGH_SPAN/CRY 等）、dialect synthesis（mixed-prompt sampling）

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
paper2026260527258
