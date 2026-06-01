---
paper_key: arxiv_2603_25750
canonical_id: "arxiv:2603.25750"
title: "Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.25750"
pdf_url: "https://arxiv.org/pdf/2603.25750"
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

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- OpenReview summary model: `gpt-5.5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2603.25750)
- [PDF](https://arxiv.org/pdf/2603.25750)

## 一句話總結
Sommelier 是一個可擴展、open-source 的 multi-turn conversational audio pre-processing pipeline，專門把 in-the-wild 的原始對話音訊整理成更適合 full-duplex Speech Language Models (SLMs) 訓練的高品質資料。

## 這篇在解決什麼問題
這篇在解決 full-duplex SLM 訓練資料稀缺的問題。作者指出，現有大規模 speech datasets 多半偏向 single-speaker、scripted speech，或雖然有多說話者但沒有針對 overlap、backchanneling、interruption 做好處理，因此不適合訓練能「邊聽邊說」的模型。

更具體來說，原始 conversational audio 常有幾個痛點：
- overlapping speech 很常見，但會造成 diarization 和 ASR 錯誤
- backchannels、interruption、短 utterance 很容易被切掉或誤判
- web-scale audio 內含 music、noise、long silence 等非對話片段
- ASR hallucination 會污染轉錄結果
- 現有 pipeline 多半是為單流 speech 設計，無法保留 full-duplex 所需的 multi-turn dynamics

所以這篇不是在做新的 full-duplex model，而是在做一個面向資料端的 **speech pre-processing pipeline**，讓後續 full-duplex 訓練更可靠。

## 核心方法
Sommelier 是一個 modular pipeline，依序處理 audio standardization、VAD、speaker diarization、overlap separation、background music removal、ensemble-based ASR。

### 1) Audio standardization
先把各種來源音訊統一成：
- 16 kHz
- 16-bit
- Mono
- loudness normalization 到 -20 dBFS

目的是真正讓後續模組吃到一致格式，降低資料異質性。

### 2) VAD + speaker diarization
- 先用 VAD 依 silence 切段，並把長音訊切成小於 5 分鐘的 chunk，避免 diarization OOM
- diarization 改用 **Sortformer**，因為作者認為它比常用的 **Pyannote 3.1** 更能抓到很短的 backchannel utterances

### 3) Overlapping speech handling
這是核心貢獻之一。作者把 overlap 場景整理成四種 case，最後選擇能保留資訊最完整的方式：
- 對 overlap 區間做 two-speaker separation
- 先抽取非重疊片段建立 speaker embeddings
- 將 separated candidates 與 reference embeddings 做 cosine similarity，比對 speaker identity
- 再把分離結果拼回原本的 non-overlap 部分，形成 speaker-wise single-speaker segments

重點是：它不是單純把 overlap 當噪音刪掉，而是努力保留對話中的 simultaneity。

### 4) Background music removal
- 先用 **PANNs** 判斷片段是否含 BGM
- 若超過 threshold，就用 **Demucs** 做 vocal extraction
- 只對需要的片段處理，以兼顧品質與 throughput

### 5) Ensemble-based ASR
為了減少 hallucination，作者不用單一 ASR，而是用 **ROVER** ensemble 結合三個 ASR model：
- word-level alignment
- 至少兩個模型一致才保留
- 再用 `RepetitionFilter` 去除過度 n-gram 重複的樣本
- 同時產生 word-level timestamps，支援後續 streaming SLM 對齊需求

## Training / Data
這篇是資料處理 pipeline paper，本身不是大規模 model training paper，但有做下游驗證。

### 資料來源與處理目標
- 來源是 in-the-wild conversational audio
- 目標是產出適合 full-duplex SLM 的多輪對話資料
- 特別保留 overlap、backchanneling 等自然對話現象

### 下游驗證
作者用 Sommelier 處理後的資料去 fine-tune **Moshi**：
- 使用 LoRA fine-tuning
- 評估在 **Full-Duplex-Bench** 上的表現
- 作者發現訓練資料中若出現過長 turn-taking（例如單一 speaker 持續超過一分鐘），會讓訓練不穩定、模型變得不 responsive
- 因此最後選擇每個 turn 不超過 10 秒、且至少三個 consecutive turns 的區段
- stereo training data 中只把單一 speaker 放在 left channel

## 主要結果
### 1) 對 full-duplex model 有實際幫助
用 Sommelier-processed data fine-tune Moshi 後，在 Full-Duplex-Bench 上：
- Backchanneling improved
- Smooth Turn-Taking improved
- User Interruption handling improved
- Pause Handling 則大致與 base Moshi 相近

作者把 latency 的增加解讀為正面訊號：模型更願意等待、處理 user input，而不是無視對方繼續說。

### 2) Sortformer 比 Pyannote 更適合這個 pipeline
在 diarization 評估上，作者主張 Sortformer 更能穩定抓到短 backchannel utterances，優於 Pyannote 3.1。

### 3) Overlap separation 改善音訊品質
作者在 overlap disentanglement 的實驗中指出，分離模組能提升：
- WER
- SI-SDR
- STOI
- UTMOS

而且對 secondary speaker 的改善通常更大，表示它對 recovering 被干擾的 speaker 特別有幫助。

### 4) ASR ensemble 能抑制 hallucination
ROVER + repetition filtering 可減少單一 ASR 在 silence/noise 下產生的 nonsense / repetitive transcripts，提升資料標註品質。

## Project relevance
project-full-duplex-data

## Related papers in my pool
和 **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems (2025)** 有明顯相關：那篇偏向 full-duplex dialogue control / turn-taking policy，這篇則是往前一步做 data preprocessing；兩者都在處理 full-duplex 需要的 conversational dynamics，但一個偏 model-side control，一個偏 data-side curation。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
如果你在做 **full-duplex conversation data curation、overlap handling、speaker diarization、ASR filtering**，這篇值得細讀，尤其是它的 pipeline design 和 overlap processing 規則很實用。

如果你主要在找新的 model architecture，這篇優先級較低，因為它重點是 data preprocessing 與 system-level pipeline，而不是提出新的 generation model。

## 可能的弱點 / open questions
- pipeline 幾乎只聚焦 speech，對 non-speech acoustic events 或 broader audio scene 的涵蓋有限
- overlap separation 仍是人工重建，音質不可能完全等同 oracle isolated channels，可能引入 artifacts
- 模組很多，整體依賴多個 external model，實務上維護與版本相容性可能較複雜
- 對下游 full-duplex 效果的驗證主要集中在 Moshi，一般化到其他 SLM 架構還需要更多證據
- 對資料偏差、語言/口音多樣性、domain shift 的影響沒有看到非常完整的分析
- background music removal 可能在某些情境下過度處理，傷到 speech fidelity

## Tags
- full-duplex SLM
- speech data preprocessing
- speaker diarization
- overlap handling
- ASR ensemble
- hallucination filtering
- backchanneling
- turn-taking
- open-source pipeline

## Concepts
- full-duplex
- multi-turn conversational audio
- Voice Activity Detection (VAD)
- speaker diarization
- overlap separation
- backchanneling
- interruption handling
- acoustic clutter
- ASR hallucination
- ROVER
- word-level timestamping
- Demucs
- PANNs
- Sortformer
- Moshi
- Full-Duplex-Bench

## Citation
```bibtex
@article{jung2026sommelierscalableopenmultiturn,
  title={Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models},
  author={Jung, Kyudan and Kim, Jihwan and Kim, Soyoon and Kim, Jeonghoon and Choo, Jaegul and Park, Cheonbok},
  year={2026},
  journal={arXiv preprint},
  eprint={2603.25750}
}
```
