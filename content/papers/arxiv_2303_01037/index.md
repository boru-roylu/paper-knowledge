---
paper_key: arxiv_2303_01037
canonical_id: "arxiv:2303.01037"
title: "Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages"
year: 2023
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2303.01037"
pdf_url: "https://arxiv.org/pdf/2303.01037"
status: read
rating: 4
tags:
  - speech-llm
  - asr
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2303.01037)
- [PDF](https://arxiv.org/pdf/2303.01037)

## 一句話總結
Google USM 提出一個以 12M 小時、300+ 語言的 unlabeled multilingual speech 做大規模 pre-training 的 2B-parameter ASR model，讓單一模型可擴展到 100+ languages，並在 multilingual ASR 與 speech translation 上達到 SOTA。

## 這篇在解決什麼問題
這篇在解決 **如何把 ASR 擴展到超過 100 種語言** 的問題，尤其是 tail languages 與跨 domain 的泛化能力。

作者關心的核心瓶頸是：

- **labeled speech 太稀缺且昂貴**：很多語言幾乎沒有足夠人工 transcript
- **multilingual ASR 擴展性不足**：傳統 supervised training 難以同時覆蓋大量語言
- **單一模型是否能統一支援多語言、多 domain**：不只要在 in-domain 表現好，也要能泛化到 out-of-domain
- **long-form speech recognition 困難**：長音訊輸入會讓 decoding 與 attention 更難穩定

簡單說，這篇想證明：**用超大規模 unlabeled multilingual speech + 少量 labeled data，可以訓練出一個真正 universal 的 ASR model。**

## 核心方法
核心方法是一個分三階段的 training pipeline，底層 backbone 是 **2B-parameter Conformer**。

### 1) BEST-RQ self-supervised pre-training
先在大規模 unlabeled multilingual speech 上做 **BEST-RQ**（BERT-based Speech pre-Training with Random-projection Quantizer）來 pre-train encoder。

重點是：
- 利用 **random-projection quantization**
- 在 unlabeled speech 上學 representation
- 適合超大規模資料與模型

### 2) MOST: Multi-Objective Supervised pre-training
接著進一步做 **MOST**，把多種訊號一起用來提升 representation quality：

- unlabeled speech 的 BEST-RQ objective
- paired speech-text 的 supervised ASR loss
- **speech-text modality matching**
- unlabeled text 的 text reconstruction / text-injection losses

這一步的目的不是直接做最後 ASR，而是讓 encoder 同時吸收 speech 與 text 的跨模態訊息。

### 3) Downstream fine-tuning
最後再把 pre-trained encoder fine-tune 到 downstream tasks，例如：

- ASR
- AST (speech-to-text translation)

作者也提到可以在 frozen encoder 上加 **lightweight residual adapters**，用很少額外參數快速適應新 domain。

### 4) Chunk-wise attention for long-form ASR
對 long-form speech，作者提出 **chunk-wise attention**，讓 model 在較長輸入上仍能穩定處理，避免只在短句上訓練、長音檔就失效。

## Training / Data
這篇的資料規模非常大，分成三類：

### Unpaired Audio
- **YT-NTL-U**：12M hours YouTube-based unlabeled multilingual audio，覆蓋 300+ languages
- **Pub-U**：429k hours unlabeled speech，51 languages

### Unpaired Text
- **Web-NTL**：28B sentences，1140+ languages

### Paired ASR Data
- **YT-SUP+**：90k hours labeled multilingual data，73 languages
- 另有 100k hours en-US pseudo-labeled data 由 **Noisy Student Training (NST)** 產生
- **Pub-S**：10k hours labeled multi-domain en-US public data + 10k hours multilingual public data，覆蓋 102 languages

### 模型與訓練
- backbone：**2B Conformer**
- pre-training：BEST-RQ
- optional multi-objective supervised pre-training：MOST
- supervised ASR heads：**CTC** / **LAS** / **RNN-T**
- 支援 **adapter tuning**
- long-form setting 使用 **chunk-wise attention**

## 主要結果
這篇的主要結果可以濃縮成幾點：

### 1) 多個 benchmark 上達到 SOTA
USM 在多個 ASR / AST benchmark 上表現很強，包括：

- **SpeechStew**
- **CORAAL**
- **FLEURS**
- YouTube long-form ASR
- **CoVoST 2** speech translation

### 2) 100+ languages 的大幅擴展
作者展示模型可支援 **100+ languages**，而且在 YouTube 評估設定中，73 languages 的 captioning 也能做到不錯的 WER。

### 3) 比 Whisper 更省 labeled data
文中強調：在 labeled training set 只有 Whisper 約 **1/7** 規模的情況下，USM 仍能在多語言 in-domain 與 out-of-domain recognition 上達到 comparable or better performance。

### 4) BEST-RQ 是可 scale 的 speech representation learner
作者觀察到 BEST-RQ 能在 2B 模型與超大資料下穩定擴展，且與 Wav2Vec 2.0、W2v-BERT 相比有競爭力。

### 5) MOST 讓 representation 更能跨 domain / 任務轉移
加入 text-injection 與 modality matching 後，FLEURS 與 CoVoST 2 的結果進一步提升，顯示多模態 pre-training 對 downstream transfer 有幫助。

### 6) Frozen encoder + adapter 可快速適應新 domain
只增加約 **2% parameters** 的 residual adapter 就能做有效 adaptation，顯示大模型 pre-training 的可重用性高。

## Project relevance
project-tts-data-pipeline

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**建議細讀。**

如果你關心的是：
- multilingual ASR 的 scaling law / training recipe
- unlabeled speech + text injection 的 pre-training pipeline
- 如何用大模型支援 100+ languages
- long-form ASR 與 domain adaptation

這篇是很值得讀的基準型工作。  
如果你主要在做的是 **full-duplex dialogue** 或 **TTS data cleaning pipeline**，它不算直接對口，但它對 **speech pretraining、multilingual robustness、data scaling** 很有參考價值。

## 可能的弱點 / open questions
- **資料與算力門檻極高**：12M hours unlabeled speech + 2B model，不容易複現
- **方法偏系統工程與 scale-up**：創新點更多在 recipe 與 training pipeline，而不是單一新架構
- **對低資源語言的細節有限**：雖然覆蓋 100+ languages，但不同語言族群的錯誤分析未必充分
- **資料品質與標註可靠性**：大規模 weakly labeled / pseudo-labeled data 可能引入噪聲
- **long-form ASR 的泛化仍可能依賴特定設計**：chunk-wise attention 是否在更多實際場景同樣穩定，值得再驗證
- **對 downstream task 的最佳化仍仰賴 in-domain data**：作者也明確指出 in-domain fine-tuning 仍最有效，表示 universal model 並未完全消除 domain gap

## Tags
- multilingual ASR
- self-supervised learning
- speech pre-training
- Conformer
- BEST-RQ
- text-injection
- modality matching
- speech translation
- long-form ASR
- adapter tuning
- data scaling

## Concepts
- **Universal Speech Model (USM)**：單一 large model 支援多語言 ASR / AST
- **Conformer**：結合 convolution 與 transformer 的 speech backbone
- **BEST-RQ**：用 random-projection quantizer 的 self-supervised speech pre-training objective
- **MOST**：multi-objective supervised pre-training，把 speech、text、paired data 一起用
- **speech-text modality matching**：對齊 speech 與 text 表徵的訓練目標
- **Noisy Student Training (NST)**：用 pseudo-label 擴增 supervised data
- **CTC**：connectionist temporal classification
- **LAS**：Listen, Attend, and Spell
- **RNN-T**：RNN transducer
- **chunk-wise attention**：長音訊處理用的分塊 attention
- **residual adapter**：凍結主幹 encoder 下的輕量適配模組

## Citation
```bibtex
@article{zhang2023googleusmscalingautomaticspeec,
  title={Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages},
  author={Zhang, Yu and Han, Wei and Qin, James and Wang, Yongqiang and Bapna, Ankur and Chen, Zhehuai and Chen, Nanxin and Li, Bo and Axelrod, Vera and Wang, Gary and Meng, Zhong and Hu, Ke and Rosenberg, Andrew and Prabhavalkar, Rohit and Park, Daniel S. and Haghani, Parisa and Riesa, Jason and Perng, Ginger and Soltau, Hagen and Strohman, Trevor and Ramabhadran, Bhuvana and Sainath, Tara and Moreno, Pedro and Chiu, Chung-Cheng and Schalkwyk, Johan and Beaufays, Françoise and Wu, Yonghui},
  year={2023},
  journal={arXiv preprint},
  eprint={2303.01037},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```
