---
paper_key: arxiv_2501_14350
canonical_id: "arxiv:2501.14350"
title: "FireRedASR: Open-Source Industrial-Grade Mandarin Speech Recognition Models from Encoder-Decoder to LLM Integration"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2501.14350"
pdf_url: "https://arxiv.org/pdf/2501.14350"
status: read
rating: 8
tags:
  - asr
  - speech-llm
  - mandarin
  - speech-recognition
  - open-source-model
  - speech-data
  - project-tts-data-pipeline
  - project-full-duplex-data
created: 2026-07-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`) and bibliography. This note focuses on FireRedASR as an open ASR / transcript-recovery component for speech data pipelines.

## Links

- [Original URL](https://arxiv.org/abs/2501.14350)
- [arXiv abstract](https://arxiv.org/abs/2501.14350)
- [PDF](https://arxiv.org/pdf/2501.14350)
- [arXiv source](https://arxiv.org/src/2501.14350)
- [Official GitHub repo](https://github.com/FireRedTeam/FireRedASR)

## 一句話總結

FireRedASR 是 Xiaohongshu 開源的 industrial-grade Mandarin ASR family，包含高精度的 FireRedASR-LLM (Encoder-Adapter-LLM, 8.3B) 和較高效率的 FireRedASR-AED (Conformer encoder + Transformer decoder, 1.1B)；核心訊息是高品質人工標註資料、合適的 AED/LLM architecture、progressive regularization training，可以在 Mandarin public benchmarks、real-world multi-source speech、singing lyrics、dialect/English generalization 上達到很強表現。

## 這篇在解決什麼問題

作者的問題設定很務實：Mandarin ASR 已經有 Whisper、Qwen-Audio、SenseVoice、Seed-ASR 等大模型，但仍有幾個缺口：

- 通用 multilingual / multitask model 不一定在 Mandarin 場景最強。
- 很多高性能 industrial ASR 或 Seed-ASR 類模型不是完整 open-source，研究和工程復現受限。
- 不同應用對 ASR 的需求不同：有些要極致 CER，有些要高 QPS / 低成本 / 可做 speech representation。
- 真實場景不只 read speech，還有 short video、live streaming、auto-captioning、voice input、intelligent assistant、singing lyrics。

所以 FireRedASR 同時提供兩條路線：

- FireRedASR-LLM：追求 SOTA accuracy 和 speech-to-text LLM integration。
- FireRedASR-AED：追求 performance/efficiency tradeoff，也可作 LLM-based speech models 的 speech representation module。

## 核心方法

### 1. FireRedASR-AED

FireRedASR-AED 是 attention-based encoder-decoder ASR：

- Input：80-dimensional log Mel Fbank，25 ms window，10 ms frame shift，global CMVN。
- Subsampling：兩層 convolution，stride 2，把 10 ms frame rate 降到 40 ms。
- Encoder：Conformer blocks，包含 Macaron-style FFN、relative positional self-attention、convolution module，depthwise conv kernel size 33。
- Decoder：Transformer decoder，fixed sinusoidal positional encoding、input/output embedding weight tying、pre-norm residual。
- Tokenization：Chinese characters + English BPE；總 vocab 7,832，包括 1,000 English BPE tokens、6,827 Chinese characters、5 special tokens。

作者做了 XS/S/M/L 四種大小：

- 140M / 413M / 732M / 1.1B。
- FireRedASR-AED 預設指 L / 1.1B。

### 2. FireRedASR-LLM

FireRedASR-LLM 是 Encoder-Adapter-LLM：

- Encoder：Conformer audio encoder，initialized from FireRedASR-AED encoder。
- Adapter：Linear-ReLU-Linear，把 encoder output 投到 LLM embedding space。
- Adapter 前有 frame splicing，把 40 ms 降到 80 ms per frame，降低 LLM sequence length。
- LLM：Qwen2-7B-Instruct。
- Training input：`(prompt, speech, transcript)`。
- Inference input：`(prompt, speech)`，由 LLM next-token prediction 產生 transcript。
- Training：encoder + adapter fully trainable；LLM 大部分 frozen，只開 LoRA。
- Loss：cross-entropy，只算 transcript 部分，不算 prompt / speech embeddings。

這個設計很像 speech encoder 接 text LLM 的常見路線，但 paper 的實用點是：用 AED encoder 作初始化、保留 speech encoder 可訓練、只用 LoRA 改 LLM，讓 speech-to-LLM alignment 不必 full fine-tune 7B。

### 3. Progressive Regularization Training

作者認為 FireRedASR 表現好有三個原因：data、training strategy、architecture。

最值得記的是 progressive regularization：

- 大模型 early training 時先關掉或減少 dropout / SpecAugment，讓模型快速收斂。
- 當模型開始 overfit，再逐步加強 regularization。
- Scale 從 140M 到 1.1B 時，learning rate 也要隨 model size 調低。

這對我們有參考價值：ASR / speech encoder scaling 不只是加資料和參數，regularization schedule 會決定大模型能不能真正收斂到好 CER。

## Training / Data

### Training data

FireRedASR 使用約 70,000 小時訓練資料，主要是高品質 Mandarin speech。作者強調大多數資料由 professional annotators 人工轉寫，而不是像 Whisper 那樣大量 weak labels。

額外還包含約 11,000 小時 English speech，用來提高 English ASR capability。

Discussion 裡有一個很重要的 data-centric claim：

> 1,000 小時 high-quality human-labeled data 比 10,000 小時 weakly-labeled data 更有效。

這不是完整 controlled experiment table，但它直接表達作者經驗：對 industrial ASR，transcript quality 可能比 raw hours 更關鍵。對 TTS data pipeline 也一樣，clean transcript / high-confidence alignment 的價值不能只用小時數衡量。

### Model scales

FireRedASR-AED：

- XS：512 width，12/12 encoder/decoder layers，140M。
- S：768 width，16/16 layers，413M。
- M：1024 width，16/16 layers，732M。
- L：1280 width，16/16 layers，1.1B。

FireRedASR-LLM：

- LLM backbone 固定為 Qwen2-7B-Instruct。
- Encoder 從 86M 到 710M。
- Adapter 約 17M 到 22M。
- Total 從 7.7B 到 8.3B。

## 主要結果

### Public Mandarin ASR benchmarks

四個 public Mandarin test sets：AISHELL-1、AISHELL-2 iOS、WenetSpeech Internet、WenetSpeech Meeting。

Average-4 CER：

- FireRedASR-LLM：3.05。
- FireRedASR-AED：3.18。
- Seed-ASR：3.33。
- SenseVoice-L：4.47。
- Paraformer-Large：4.56。
- Qwen-Audio：6.19。
- Whisper-Large-v3：9.86。

作者另註：若用 Seed-ASR paper 的 Average-6，FireRedASR-LLM 是 2.86，Seed-ASR 是 2.98。

### Scaling

Average CER 隨 model size 下降：

- FireRedASR-LLM：XS 3.29 -> S 3.23 -> M 3.19 -> L 3.05。
- FireRedASR-AED：XS 3.79 -> S 3.56 -> M 3.37 -> L 3.18。

LLM 版本主要 scale encoder；AED 版本整體 scale。兩者都呈現穩定 gain。

### Multi-source Mandarin speech / singing lyrics

Real-world Mandarin speech 包含 short videos、live streaming、auto-captioning、voice input、intelligent assistant。

Speech CER：

- FireRedASR-LLM：3.48。
- FireRedASR-AED：3.74。
- ProviderA-Large：4.56。
- ProviderA-Base：5.67。
- Paraformer-Large：5.80。

Singing lyrics CER：

- FireRedASR-LLM：7.05。
- FireRedASR-AED：7.51。
- ProviderA-Large：14.16。
- ProviderA-Base：21.37。
- Paraformer-Large：21.19。

Singing lyrics 是這篇很突出的結果，代表訓練資料裡的 singing data 和 real-world acoustic variation 有實際價值。

### Dialect and English

KeSpeech Chinese dialect CER：

- FireRedASR-LLM：3.56。
- FireRedASR-AED：4.48。
- Previous SOTA：6.70。

LibriSpeech WER：

- test-clean：FireRedASR-LLM 1.73，FireRedASR-AED 1.93，previous SOTA 1.82。
- test-other：FireRedASR-LLM 3.67，FireRedASR-AED 4.44，previous SOTA 3.50。

這表示 FireRedASR 雖然主要為 Mandarin 設計，但仍有不錯 dialect / English generalization。

## Project relevance

### project-tts-data-pipeline

中高相關。FireRedASR 不是 TTS paper，但它是 TTS data cleaning 的 strong ASR component candidate：

- Transcript quality：TTS pipeline 很需要低 hallucination / low CER ASR，尤其用於 web audio / podcast / short video data。
- Mandarin / Chinese / code-switch pipeline：FireRedASR 的 mixed Chinese character + English BPE tokenization 對中英混合 transcript 很實用。
- Data quality lesson：作者明確說 high-quality human labels 比大量 weak labels 更有效，這支持我們不要只追 raw hours，而要保存 confidence / provenance / human spot-check。
- Singing lyrics recognition：若資料中有 music/singing contamination，FireRedASR 的 singing robustness 可幫助 detect / transcribe / filter 這類 segment，而不是直接把它當普通 speech。

對 English TTS pipeline 的直接用途可能不如 Whisper / FunASR 全語種工具，但它提供兩個可借設計：

- 用 strong ASR 做 transcript QA / cross-check。
- 對每個 data source 分開評估 CER / hallucination / punctuation normalization，不把 ASR 當黑盒。

### project-full-duplex-data

中度相關。FireRedASR 不做 diarization 或 separation，但對 mono-dialogue -> dual-channel pipeline 的 transcript recovery layer 很有用：

- 可以作 robust ASR baseline，尤其 Mandarin / Chinese dialogue。
- FireRedASR-AED encoder 可作 speech representation component，接 downstream LLM / dialogue state model。
- FireRedASR-LLM 的 prompt + speech -> transcript formulation 可用於測試 LLM-ASR 是否會在 interruption / overlap / disfluency 場景 hallucinate。

限制也很明確：paper 的 evaluation 沒有專門測 overlap speech、speaker attribution、turn-taking、backchannel deletion；所以不能直接替代 WhisperD / Sommelier / diarization+OSD pipeline。

### project-audio-model-evaluation

中度相關。FireRedASR 可作 generated speech evaluator 的 ASR component，用於 content fidelity：

- TTS output -> ASR transcript -> MER/CER/WER。
- Generated dialogue -> ASR transcript -> compare control transcript。
- Audio editing / separation output -> ASR check content preservation。

但 ASR evaluator 本身會有 bias：如果 generated audio 或 accent 超出 FireRedASR domain，WER 可能反映 evaluator weakness，而不全是 generator failure。

## Related papers in my pool

- [Google USM](../arxiv_2303_01037/)：大規模 multilingual ASR scaling reference；FireRedASR citation graph 已連到它。
- [WenetSpeech-Yue](../arxiv_2509_03959/)：Cantonese ASR/TTS corpus pipeline，引用 FireRedASR 作相關 ASR system；兩者都支持 data quality / transcript quality 對 ASR/TTS 的重要性。
- [Mega-ASR](../arxiv_2605_19833/)：robust ASR in-the-wild；FireRedASR 強調 high-quality human-labeled Mandarin and industrial scenarios，Mega-ASR 強調 acoustic simulation / robustness。
- [FunASR](../../tools/modelscope-funasr/)：production ASR toolkit；FireRedASR 是更具體的 open model family。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech tokenizer 依賴 reliable ASR transcript；FireRedASR 可作中文/中英 code-switch transcript source。
- [WenetSpeech4TTS](../arxiv_2510_11690/)：Mandarin TTS corpus；FireRedASR 類 ASR 可作 transcript cleaning / validation component。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

如果你要做 Chinese/Mandarin speech data pipeline、ASR-based filtering、或要找 open ASR baseline，建議細讀。

最值得讀：

- FireRedASR-AED / FireRedASR-LLM architecture differences。
- Encoder-Adapter-LLM training setup。
- Training data quality discussion。
- Progressive Regularization Training。
- multi-source / singing / dialect / English evaluation。

如果你只關心 English TTS data pipeline，這篇不是核心 paper，但它的 high-quality transcript 和 ASR-as-QA 觀念仍值得保留。

## 可能的弱點 / open questions

- Data pipeline 細節不足：70K 小時資料來源、清理規則、annotation QA、license/consent 沒有像 dataset paper 那樣完整展開。
- 「1K 小時 human labels > 10K 小時 weak labels」很有價值，但缺少詳細 controlled experiment。
- Real-world evaluation 有 internal / ProviderA baselines，外部可重現性有限。
- LLM-ASR 的 hallucination / normalization 行為沒有深入分析，尤其在 overlap、disfluency、speaker switch、code-switch 情境。
- FireRedASR-LLM 的計算成本高；對大規模 TTS data cleaning 可能需要 AED/Whisper/FunASR cascade，而不是全量用 LLM version。
- Mandarin-focused；English 表現 competitive 但不是專門最佳化，不應直接當 English-only ASR final judge。

## Tags

asr, speech-llm, mandarin, speech-recognition, open-source-model, speech-data, project-tts-data-pipeline, project-full-duplex-data

## Concepts

FireRedASR, FireRedASR-LLM, FireRedASR-AED, Encoder-Adapter-LLM, Qwen2-7B-Instruct, LoRA, Conformer encoder, Transformer decoder, attention-based encoder-decoder, progressive regularization training, Mandarin ASR, singing lyrics recognition, CER, CERR, speech transcript QA, ASR-based TTS data cleaning

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{xu2025fireredasropensourceindustrial,
  title={FireRedASR: Open-Source Industrial-Grade Mandarin Speech Recognition Models from Encoder-Decoder to LLM Integration},
  author={Kai-Tuo Xu and Feng-Long Xie and Xu Tang and Yao Hu},
  year={2025},
  eprint={2501.14350},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2501.14350}
}
```
