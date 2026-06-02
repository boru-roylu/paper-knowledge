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
Sommelier 是一個可擴展、開源的 open multi-turn audio pre-processing pipeline，用來把 in-the-wild 單軌對話音訊整理成適合 full-duplex Speech Language Models (SLMs) 訓練的高品質資料。

## 這篇在解決什麼問題
這篇主要在解決 full-duplex SLM 訓練資料不足的問題。  
現有大規模 speech datasets 多半偏向 single-speaker、read speech，或是雖然有 conversational audio，卻沒有針對 overlap、backchanneling、turn-taking 做好處理。

作者指出幾個關鍵痛點：
- real-world dialogue 中常有 **overlap**、**backchannel**、短促插話
- in-the-wild audio 常伴隨 **noise**, **music**, **silence**, **clipping**
- **diarization errors** 和 **ASR hallucinations** 會嚴重污染標註
- web-scale processing 需要高 throughput，否則資料整理成本太高

因此，這篇目標不是提出新的 speech model，而是建立一條能大規模產出 full-duplex training corpus 的 preprocessing pipeline。

## 核心方法
Sommelier 是一個 modular pipeline，依序處理音訊標準化、VAD、speaker diarization、overlap disentanglement、background music removal、以及 ensemble-based ASR。

### 1) Audio standardization
先把各種來源音訊統一成：
- 16kHz
- 16-bit
- Mono

並做 loudness normalization 到 -20 dBFS。

### 2) VAD + speaker diarization
- 用 VAD 切 silence，並把長音檔分成 <5 分鐘的 chunk，避免 diarization OOM
- diarization 改用 **Sortformer**，而不是常見的 **Pyannote 3.1**
- 原因是 Sortformer 對 **short utterances** 和 **backchanneling** 更穩定

### 3) Overlap handling
作者把 overlap 情境分成四種 case，最後採用能保留雙方 overlap 資訊的方案：
- 先從 non-overlap 區段抽 speaker embeddings
- 再對 overlapped region 做 **two-speaker separation**
- 用 cosine similarity 把 separated candidates 對回正確 speaker
- 最後把分離後片段接回各 speaker stream

這樣做的重點是：**保留 conversational overlap 的真實性，但又讓資料能以 source-separated 形式供 full-duplex 訓練使用。**

### 4) Background music removal
- 用 **PANNs** 偵測是否有 BGM
- 若機率 > 0.3，則用 **Demucs** 去除音樂
- 只對被判定有 BGM 的區段做處理，以兼顧品質與效率

### 5) Ensemble-based ASR
- 用三個 SOTA ASR model 做 **ROVER** ensemble
- 具體是 **Whisper + Canary + Parakeet**
- 以 word-level voting 降低單一 ASR 的 hallucination
- 再用 **RepetitionFilter** 刪除過度重複的 n-gram hallucination
- 同時輸出 word-level timestamps，方便 streaming / alignment

## Training / Data
這篇不是訓練一個新模型，而是訓練資料處理管線。  
不過作者有用處理後的資料去 fine-tune full-duplex model 作驗證。

### 資料來源與處理策略
- 來源是 in-the-wild conversational audio，如 radio / podcast 類型資料
- 資料經過：
  - audio standardization
  - VAD
  - diarization
  - overlap separation
  - optional denoising / music removal
  - ASR ensemble transcription

### 驗證設定
- 用 **LoRA fine-tuning** 在 **Moshi** 上做驗證
- 訓練資料限制：
  - 每段 turn 最長不超過 10 秒
  - 至少 3 個連續 turns 才算有效區域
  - 若某 turn 超過 10 秒則截斷
  - stereo training data 左聲道只放單一 speaker

### 具體例子
從提供的 JSON 範例可看出：
- 2 分鐘音檔可切出 26 個 segments
- pipeline 中各步驟都有明確 RT factor
- ASR 與 alignment 使用多模態輸出做 transcript consolidation

### 效率
- 單一 A100 上 total RTF 約 **0.1746**
- 拿掉 optional FlowSE denoising 後可降到 **0.133**
- 若 1 張 GPU 跑 3 個並行 process，則約 **0.0443 / GPU**
- 作者估計 8 張 A100 可在約 55 小時處理 10,000 小時音訊

## 主要結果
### 1) Diarization
- **Sortformer** 在 VoxConverse 上優於 **Pyannote 3.1**
- 對短 utterance、rapid turn-taking、boundary quality 特別有利

### 2) Overlap separation
在模擬的兩人混音資料上：
- separation 後的 **WER**, **SI-SDR**, **STOI**, **UTMOS** 都比直接切 mixed signal 明顯更好
- overlap ratio 越高，baseline 越差；separation 模組的改善越明顯
- 特別是 **Speaker 2 / secondary speaker** 的改善最大
- 在 **UTMOS** 上，分離結果接近 Oracle upper bound，表示品質與自然度都保得不錯

### 3) ASR ensemble
- Whisper 單模型的 WER 約 **6.26%**
- ensemble 後降到約 **3.92%**
- 相對改善約 **37%**
- 在 noisy segments、low volume、BGM 區段尤其明顯
- 代價是 inference time 約變成原本的 **3 倍**

### 4) Fine-tuning Moshi
Sommelier 產生的資料拿來 fine-tune Moshi 後：
- **Backchanneling**
- **Smooth Turn-Taking**
- **User Interruption**
都有改善
- 但 **Pause Handling** 與 base Moshi 差不多
- 在 Full-Duplex-Bench 1.5 上也持續優於 base model
- 部分情境下 latency 變高，但作者認為這反而代表模型真的開始處理 user input，而不是無視對話

## Project relevance
- **project-full-duplex-data:** 高相關
- **project-tts-data-pipeline:** 中相關

## Related papers in my pool
和目前 pool 裡的 **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems (2025)** 有間接相關：  
那篇重點是 full-duplex dialogue control / turn-taking policy；這篇則是在上游建立可訓練 full-duplex model 的 data preprocessing pipeline。兩者都關注 **backchanneling、interruptions、turn-taking**，但一個偏 runtime dialogue manager，另一個偏資料管線。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
如果你的工作和以下任一項有關，建議細讀：
- full-duplex SLM / spoken dialogue data curation
- overlap / backchannel / interruption 的資料處理
- web-scale conversational audio preprocessing
- ASR hallucination filtering、diarization、speaker separation pipeline

如果你主要做的是純 TTS 或一般單人語音資料清洗，則可先略讀方法與實驗中的 overlap / ASR / diarization 部分即可。

## 可能的弱點 / open questions
- pipeline 主要聚焦 speech，對 **non-speech acoustic events** 與更一般的 audio scene 覆蓋有限
- overlap separation 後的 audio fidelity 仍會比原生 isolated-channel 資料略差，可能引入 artifact
- ASR ensemble 雖然提升 WER，但 inference cost 明顯上升，對超大規模 pipeline 是實際 trade-off
- fine-tuning 驗證主要針對 Moshi，是否能泛化到其他 full-duplex SLM 還需要更多實證
- 對資料品質的提升多是工程式整合，對「哪一種 conversational structure 最有助於 full-duplex learning」還沒有被系統性抽象成一般原則
- context captioning 有提到，但不是本文核心，後續是否能成為可用的 supervision signal 還不清楚

## Tags
full-duplex, speech-language-model, data-preprocessing, speaker-diarization, overlap-separation, backchanneling, turn-taking, ASR-ensemble, hallucination-filtering, web-scale-pipeline

## Concepts
- full-duplex SLM
- open multi-turn audio pre-processing
- Voice Activity Detection (VAD)
- speaker diarization
- overlap disentanglement
- two-speaker separation
- speaker embedding
- background music removal
- PANNs
- Demucs
- ensemble ASR
- ROVER
- ASR hallucination
- RepetitionFilter
- Real-Time Factor (RTF)
- Moshi
- LoRA fine-tuning
- Full-Duplex-Bench
- backchanneling
- smooth turn-taking
- user interruption

## Citation
```bibtex
@article{jung2026sommelierscalableopenmultiturn,
  title={Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models},
  author={Jung, Kyudan and Kim, Jihwan and Kim, Soyoon and Kim, Jeonghoon and Choo, Jaegul and Park, Cheonbok},
  journal={arXiv preprint},
  year={2026},
  arxiv={2603.25750}
}
```
