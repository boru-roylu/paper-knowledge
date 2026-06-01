---
paper_key: arxiv_2303_01037
canonical_id: "arxiv:2303.01037"
title: "Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages"
year: 2023
venue: "arXiv"
url: "https://arxiv.org/abs/2303.01037v3"
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

## Links
- [arXiv abstract](https://arxiv.org/abs/2303.01037v3)
- [PDF](https://arxiv.org/pdf/2303.01037)

## 一句話總結
USM 提出一個可擴展的 multilingual ASR framework，透過大規模 unlabeled speech 預訓練、text-injection 與 chunk-wise attention，把 ASR 與 AST 擴展到 100+ languages 並取得 SOTA。

## 這篇在解決什麼問題
這篇在解決「如何把 ASR 擴展到超過 100 種語言，而且還能在 low-resource / long-form / out-of-domain 場景維持高品質」的問題。

傳統 supervised ASR 依賴大量人工 transcription，但對 tail languages 很難取得足夠標註。作者想利用大量未標註的 multilingual speech、unpaired text，以及少量 paired speech-text data，訓練一個 single large model，同時支援：
- multilingual ASR
- speech-to-text translation (AST)
- long-form speech recognition
- 新語言 / 新 domain 的快速 adaptation

## 核心方法
USM 的核心是三段式 training pipeline，搭配兩個關鍵設計：

### 1) BEST-RQ self-supervised pre-training
- 用 **Conformer encoder** 當 backbone
- 在大量 unlabeled multilingual audio 上做 **BEST-RQ** 預訓練
- BEST-RQ 是 BERT-style 的 speech pre-training：
  - mask speech frames
  - 用 random-projection quantization 產生 discrete targets
  - 預測 masked frames 的 quantized labels
- 文章進一步用 **multi-softmax**（多個 codebooks / softmax heads）提升穩定性、收斂與效果

### 2) MOST: Multi-Objective Supervised Pre-training
- 在 BEST-RQ 之後加入 **text-injection**
- 同時訓練三種資料：
  - unlabeled speech
  - paired speech-text
  - unlabeled text
- 損失包含：
  - BEST-RQ loss
  - supervised ASR loss
  - modality matching / consistency loss
  - duration modeling / reconstruction related losses
- 目的在於把 speech representation 和 text representation 對齊，讓 unpaired text 也能幫助 speech tasks

### 3) Chunk-wise attention for long-form ASR
- 解決長音訊推論時的 train-test mismatch
- 傳統 local self-attention 在深層模型中會造成 receptive field 過度擴張，導致 long-form degradation
- 作者改成只在固定 audio chunks 內做 attention，讓 receptive field 不再隨 layer depth 不受控地擴大
- 對 minutes-hours 長音訊的 transcription 更穩定

### 4) Residual adapters for efficient adaptation
- downstream fine-tuning 時可加很小的 **residual adapter**
- 只增加約 2% 參數
- 可以 freeze 大部分 encoder，降低多語言 / 多任務 adaptation 成本

## Training / Data
### 模型
- 主力模型是 **Conformer-2B**
- 另外也使用 **Conformer-0.6B** 做 ablation / scaling analysis

### 預訓練與訓練資料
作者使用三大類資料：

#### Unpaired Audio
- **YT-NTL-U**: 12M hours 的 unlabeled YouTube audio，涵蓋 300+ languages
- **Pub-U**: 429k hours 的 public unlabeled speech，51 languages

#### Unpaired Text
- **Web-NTL**: 28B sentences，1140+ languages

#### Paired ASR Data
- **YT-SUP+**: 90k hours labeled multilingual data，外加 100k hours en-US pseudo-labeled data
- **Pub-S**: 10k hours labeled public multilingual / en-US data

### 訓練流程
1. **Unsupervised pre-training**
   - 用 BEST-RQ 在 YT-NTL-U 上訓練 encoder

2. **MOST multi-objective pre-training**
   - 進一步混合 speech / text / paired data
   - text-injection + BEST-RQ joint optimization

3. **Supervised ASR training**
   - 用 CTC、LAS、RNN-T 等 decoder 做 downstream fine-tuning
   - long-form 任務特別使用 chunk-wise attention

### 前處理
- audio 統一轉成 16 kHz
- 使用 128-dim log-mel filterbank features
- FLEURS 使用 graphemes，其它任務多用 WPM

## 主要結果
### 1) 多語言 ASR / AST 達到 strong SOTA
USM 在多個 benchmark 上表現很強，包括：
- **SpeechStew**
- **FLEURS**
- **CORAAL**
- **YouTube long-form ASR**
- **CoVoST 2 AST**

### 2) 比 Whisper 更省標註資料，但表現可比甚至更好
- 作者表示其 labeled training set 大約只有 Whisper 的 **1/7**
- 但在多個語言與 domain 上，USM 仍能達到 comparable or better performance

### 3) YouTube 73 languages long-form transcription 很強
- USM-CTC / USM-LAS 在 YouTube long-form 任務上明顯優於 Whisper
- 尤其 **USM-CTC** 在 long-form 表現最穩定

### 4) FLEURS 102 languages 有明顯提升
- 在 102 languages 的 multilingual ASR 上取得新的 state-of-the-art
- 較前作有明顯 relative improvement

### 5) MOST + adapters 可有效遷移
- frozen encoder + 2% parameter adapters，性能只比 full fine-tuning 稍弱
- 顯示 MOST learned representation 對 new domain / new tasks 具有很好的 generalization

### 6) Pseudo-labeling 對 unseen languages 有幫助
- 先用 adapter model 對 tail languages 產生 pseudo-labels
- 再回訓練可持續改善 unseen languages 的 WER

### 7) Chunk-wise attention 解決 long-form degradation
- 相較 local self-attention，chunk-wise attention 在長音訊上更穩定
- 尤其降低 deletion error 的問題

## Project relevance
- project-full-duplex-data: low
- project-tts-data-pipeline: medium

## 我該不該細讀
如果你關心 **multilingual ASR、self-supervised speech pre-training、long-form speech recognition、speech-text multimodal pre-training**，這篇值得細讀。

如果你的重點是：
- **如何從 mono-channel dialogue 建 full-duplex / overlap / backchannel data**：關聯不大
- **English TTS data cleaning / overlap detection / transcription filtering pipeline**：只有間接參考價值，主要是 ASR data scaling 與 pseudo-labeling 方法

建議細讀的部分：
- **BEST-RQ**
- **MOST / text-injection**
- **chunk-wise attention**
- **adapter-based adaptation**
- **pseudo-labeling for unseen languages**

## 可能的弱點 / open questions
- 資料與系統非常大，**可複製性成本高**
- 很多效果依賴大量 YouTube / proprietary data，**dataset bias** 可能影響泛化
- MOST 與 text-injection 的訓練流程相當複雜，**實作門檻高**
- long-form 改善來自 chunk-wise attention，但仍需看不同 decoder / inference setting 的穩定性
- 對真正的 **zero-resource / truly unseen languages**，效果仍受 pseudo-label quality 限制
- 文章重點在 ASR/AST，不是對 speech generation 或 conversational overlap modeling 的直接方法

## Tags
- multilingual ASR
- self-supervised learning
- Conformer
- BEST-RQ
- text-injection
- MOST
- chunk-wise attention
- pseudo-labeling
- speech-to-text translation
- adapters
- long-form ASR

## Concepts
- **Conformer**: 結合 convolution 與 Transformer 的 encoder architecture，適合 speech representation learning
- **BEST-RQ**: 一種 speech self-supervised pre-training 方法，透過 random-projection quantization 預測 masked speech targets
- **multi-softmax**: 用多個 codebooks / softmax heads 提升 BEST-RQ 的穩定性與收斂
- **text-injection**: 把 speech 與 text 對齊到 shared representation space，讓 unpaired text 也能參與 training
- **MOST**: Multi-Objective Supervised Pre-training，把 unlabeled speech、unlabeled text、paired speech-text 一起用來訓練
- **chunk-wise attention**: 只在固定 audio chunks 內做 attention，減少 long-form train-test mismatch
- **Noisy Student Training (NST)**: 用 teacher 產生 pseudo-label，再訓練 student
- **Residual adapters**: 冻結主模型，只訓練小型增量參數以便快速 adaptation
- **CTC / LAS / RNN-T**: 常見 ASR decoder / transducer 架構
- **WER / BLEU**: ASR 與 speech translation 的主要 evaluation metrics

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
```bibtex
@article{zhang2023googleusmscalingautomaticspe,
  title={Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages},
  author={Zhang, Yu and Han, Wei and Qin, James and Wang, Yongqiang and Bapna, Ankur and Chen, Zhehuai and Chen, Nanxin and Li, Bo and Axelrod, Vera and Wang, Gary and Meng, Zhong and Hu, Ke and Rosenberg, Andrew and Prabhavalkar, Rohit and Park, Daniel S. and Haghani, Parisa and Riesa, Jason and Perng, Ginger and Soltau, Hagen and Strohman, Trevor and Ramabhadran, Bhuvana and Sainath, Tara and Moreno, Pedro and Chiu, Chung-Cheng and Schalkwyk, Johan and Beaufays, Françoise and Wu, Yonghui},
  journal={arXiv},
  year={2023},
  doi={10.48550/arxiv.2303.01037v3}
}
```
