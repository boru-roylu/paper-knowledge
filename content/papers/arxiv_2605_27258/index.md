---
paper_key: arxiv_2605_27258
canonical_id: "arxiv:2605.27258"
title: "PilotTTS: A Disciplined Modular Recipe for Competitive Speech Synthesis"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.27258"
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

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.27258)
- [PDF](https://arxiv.org/pdf/2605.27258)

## 一句話總結
PilotTTS 以一套可重現的 open-source data pipeline 和簡潔的 autoregressive TTS 架構，在只用約 200K hours 資料下做到接近或超越更大規模系統的 zero-shot TTS、emotion / paralinguistic / dialect synthesis 表現。

## 這篇在解決什麼問題
這篇在解決 **resource-constrained team 如何用較少資料與較簡單架構，做出 competitive speech synthesis** 的問題。

作者認為現有 SOTA TTS 常有幾個門檻：
- 依賴 **millions of hours** 的 proprietary data
- data processing pipeline 不透明、難 reproducible
- architecture 太複雜，例如 multi-codebook tokenizer、多階段生成器、專門的 controllability sub-model
- controllability 常被切成多個獨立系統，導致工程成本高

PilotTTS 想證明：
1. **data engineering** 比一味堆 model size 更關鍵  
2. 透過 **disciplined modular recipe**，可以在較小資料量下仍維持強 performance  
3. zero-shot voice cloning 與多種 controllable synthesis 可以整合在同一個 framework 裡

## 核心方法
PilotTTS 是一個 **lightweight autoregressive TTS system**，核心由「資料管線 + compact model + decoupled conditioning」三部分構成。

### 1) 三階段 data processing pipeline
作者設計了一個可重現的 multi-stage pipeline，全部基於 open-source tools：

- **Quality assessment and enhancement**
  - 標準化音訊格式與 sampling rate
  - 用 SAD / SCD 找出有效 speech region 與 speaker transition
  - 用 DNSMOS、speech/non-speech classifier、SNR estimation 評估品質
  - 低品質片段會做 denoising / enhancement

- **Label annotation**
  - 用多個 ASR 系統產生 transcript，做 cross-system consistency check
  - 用 OSD 偵測 overlapping speech
  - 用 forced alignment 對齊 text 與 audio
  - 用 prosody annotation、speaker tagging、spectral rolloff analysis 補充 metadata

- **Quality filtering**
  - 移除 truncation、synthetic speech、低可靠度 transcription、overlap 不合規、speaker inconsistency 等樣本
  - 保留所有處理後的 metadata，方便之後依不同品質需求重組資料

### 2) Compact autoregressive TTS architecture
模型 backbone 使用 **Qwen3 language model**，不是自創大型 TTS backbone，而是整合現成模組：

- **speech tokenizer**：採用 CosyVoice 3 的 single-codebook FSQ tokenizer
- **Semantic Content Adapter**：以 **Q-Former** 壓縮 reference speech，得到 fixed set of condition tokens
- **speaker encoder**：用 frozen **CAMPPlus** 抽取 speaker identity embedding
- **autoregressive text-to-semantic module**：Qwen3 根據 text + reference condition 生成 semantic tokens
- **speech decoder**：用 **Conditional Flow Matching (CFM)** + **DiT** 生成 mel-spectrogram
- **vocoder**：HiFi-GAN 將 mel 轉 waveform

### 3) Decoupled speaker / style encoding
作者特別強調用 **cross-sample paired training** 與 Q-Former conditioning，把：
- **speaker identity**  
和
- **speaking style / content-related variation**

盡量解耦，讓 reference audio 的 speaker 資訊更穩定，不容易和 style 混在一起。

### 4) Controllability extensions
在同一個 framework 下，PilotTTS 支援：
- **zero-shot voice cloning**
- **emotion synthesis**（11 categories）
- **paralinguistic synthesis**（4 categories：laughter, breathing, crying, coughing）
- **Chinese dialect synthesis**（14 dialects）

這些能力主要透過 targeted post-training 取得。

## Training / Data
- **Training data**：約 **200K hours** 的 speech data
- **資料來源**：來自 public sources 的 Chinese 與 English speech
- **處理方式**：完全使用 open-source tools 建構的 multi-stage pipeline
- **標註內容**：text、temporal、speaker、prosody、quality tags 等
- **模型訓練重點**：
  - AR text-to-semantic generation
  - Q-Former-based conditioning
  - cross-sample paired training 以 disentangle speaker/style
  - targeted post-training 來學 emotion / paralinguistic / dialect control

## 主要結果
PilotTTS 在 **Seed-TTS Eval** 上表現很強：

- **test-en WER**：**1.50%**（最低）
- **test-zh CER**：**0.87%**
- **speaker similarity**：
  - test-en：**0.862**
  - test-zh：**0.815**
  - 兩個 test set 都是最高

作者強調這些結果是：
- 在 **only 200K hours** 訓練資料下達成
- 優於一些使用 **significantly larger datasets** 的系統
- 在 controllability 上也能同時支援 emotion、paralinguistic、dialect synthesis

整體訊息是：**資料管線與 conditioning 設計做對，比盲目擴大模型或資料更有效。**

## Project relevance
- **project-tts-data-pipeline**：高度相關

## Related papers in my pool
- **Seed-TTS: A Family of High-Quality Versatile Speech Generation Models**：同樣是 zero-shot TTS / controllable speech generation，但 Seed-TTS 更偏向大規模 foundation-style speech generation 與更完整的 family 設計；PilotTTS 則更強調 **open-source、可重現的 data pipeline** 與低資源下的競爭力。
- 目前 pool 裡沒有明顯直接相關的已讀 paper

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**如果你在做 TTS data pipeline、資料清洗、quality filtering、label annotation，值得細讀。**

特別值得看的是：
- 三階段 data pipeline 怎麼組
- 他們怎麼做 **quality assessment / enhancement**
- transcript consistency、OSD、forced alignment、speaker tagging 如何串起來
- Q-Former conditioning 與 cross-sample paired training 的設計
- 200K hours 下為何仍能打到很強的 zero-shot 指標

如果你的重點是 **speech synthesis 資料工程**，這篇很可能有直接可借鑑之處。

## 可能的弱點 / open questions
- **資料與 pipeline 雖然可重現，但細節依賴很多模組組合**：實際複現成本可能仍不低
- **200K hours 仍然很大**：對真正 low-resource lab 來說，門檻未必低
- **open-source tools 組裝出來的 pipeline** 是否對不同 domain、不同語言同樣穩定，還需要更多驗證
- **emotion / paralinguistic / dialect control** 的評估細節與泛化性，可能比 benchmark 數字更值得追問
- **speaker-style disentanglement** 是否真的足夠乾淨，還是只是實務上有效，仍可能有可分析空間
- 對 **synthetic speech detection**、overlap、truncation 等資料污染問題的處理，是否會造成某些真實但困難樣本被過度過濾，值得思考

## Tags
- speech synthesis
- TTS
- autoregressive
- data pipeline
- data cleaning
- quality filtering
- label annotation
- zero-shot voice cloning
- speaker conditioning
- Q-Former
- controllable speech generation
- emotion synthesis
- dialect synthesis
- paralinguistic synthesis

## Concepts
- autoregressive TTS
- speech tokenizer
- finite scalar quantization (FSQ)
- Q-Former
- cross-attention
- semantic content adapter
- speaker encoder
- speaker identity
- speaking style
- cross-sample paired training
- conditional flow matching (CFM)
- diffusion transformer (DiT)
- HiFi-GAN
- DNSMOS
- speech activity detection (SAD)
- speaker change detection (SCD)
- overlapping speech detection (OSD)
- forced alignment
- prosody annotation
- synthetic speech detection
- zero-shot voice cloning
- paralinguistic synthesis
- emotion control
- dialect synthesis

## Citation
```bibtex
@article{li2026pilotttsadisciplinedmodularrec,
  title={PilotTTS: A Disciplined Modular Recipe for Competitive Speech Synthesis},
  author={Li, Bowen and Guo, Shaotong and Wang, Zhen and Xiang, Yang and Jin, Mingli and Lin, Yihang and Zhao, Jiahui and Xiong, Weibo and Zhang, Dongrui and Chen, Keming and Gao, Yunze and Lin, Zeyang and Zhou, Yuze and Liu, Yue},
  year={2026},
  journal={arXiv preprint},
  eprint={2605.27258}
}
```
