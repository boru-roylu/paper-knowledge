---
paper_key: arxiv_2603_10420
canonical_id: "arxiv:2603.10420"
title: "FireRedASR2S: A State-of-the-Art Industrial-Grade All-in-One Automatic Speech Recognition System"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.10420"
pdf_url: "https://arxiv.org/pdf/2603.10420"
status: read
rating: 9
tags:
  - asr
  - vad
  - language-identification
  - punctuation
  - speech-data
  - industrial-asr
  - project-tts-data-pipeline
  - project-full-duplex-data
  - project-audio-model-evaluation
created: 2026-07-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`) and bibliography. This note focuses on FireRedASR2S as an all-in-one preprocessing / transcript QA system for speech data pipelines.

## Links

- [Original URL](https://arxiv.org/abs/2603.10420)
- [arXiv abstract](https://arxiv.org/abs/2603.10420)
- [PDF](https://arxiv.org/pdf/2603.10420)
- [arXiv source](https://arxiv.org/src/2603.10420)
- [Official GitHub repo](https://github.com/FireRedTeam/FireRedASR2S)

## 一句話總結

FireRedASR2S 是 FireRedASR 的 all-in-one 後續版，把 ASR、VAD、LID、Punctuation Prediction 統一成一個 open-source industrial ASR pipeline；最值得我們借的是它把 waveform -> segmented / language-tagged / timestamped / confidence-scored / punctuated transcript 做成標準輸出，這正是 TTS data cleaning 和 full-duplex preprocessing 需要的 transcript infrastructure。

## 這篇在解決什麼問題

現實中的 ASR pipeline 不是只有「丟一段 audio 給 ASR model」：

- Long-form audio 需要 VAD segmentation。
- 多語 / code-switch / dialect audio 需要 LID routing。
- Raw ASR transcript 需要 punctuation，才適合 subtitle、TTS transcript、downstream text processing。
- UGC 裡有 silence、noise、music、singing、speech 混在一起。
- 工程上常把不同來源的 VAD/LID/ASR/Punc 拼起來，導致 interface 不一致、error propagation 難控、可重現性差。

FireRedASR2S 的目標是做一個 modular but unified 的 industrial ASR system：各模組可以單獨部署，也可以預設串成完整 pipeline，輸出 structured transcription results。

## 核心方法

### 1. 系統 pipeline

FireRedASR2S 依序處理：

```text
waveform
  -> FireRedVAD
  -> FireRedLID
  -> FireRedASR2
  -> FireRedPunc
  -> structured transcript
```

輸出包含：

- final transcription text。
- sentence-level segments：start/end timestamps、recognized text、ASR confidence、optional language labels/confidence。
- VAD segmentation results。
- 若開啟 AED timestamping，可從 token/word-level timestamps 和 punctuation 推 sentence-level timestamps。

這點對 data pipeline 很實用：它不是只輸出 plain text，而是輸出可 audit / filter / align 的 metadata。

### 2. FireRedASR2

FireRedASR2 延續 FireRedASR：

- FireRedASR2-AED：Attention-based Encoder-Decoder，Conformer encoder + Transformer decoder。
- FireRedASR2-LLM：Encoder-Adapter-LLM，Conformer audio encoder + adapter + text LLM。

主要更新不是架構大改，而是 data scale 和 coverage：

- supervised training data 從約 70k hours 擴到約 200k hours。
- 覆蓋 Mandarin、English、Chinese dialects、code-switching、speech、singing、non-speech audio。
- AED vocab 從 7,832 增加到 8,667，更適合 multilingual / dialect scenarios。

### 3. ASR confidence

FireRedASR2-AED 會輸出 utterance-level confidence：

- Beam search 得到 1-best hypothesis。
- 取每個 decoded token 的 posterior probability。
- 排除 special tokens。
- 用 valid tokens 的 geometric mean 聚合成 sequence-level confidence。
- 可再做 clipping / outlier filtering。

這對 TTS data cleaning 很重要，因為 ASR confidence 可以直接變成 transcript filtering / ranking / manual review priority。

### 4. Post-hoc CTC branch for timestamps

FireRedASR2-AED 新增 timestamp support：

- 先訓練完整 AED model。
- 再 freeze encoder/decoder，加一個 lightweight CTC projection head。
- 只訓練 CTC branch。
- Inference 時先用 AED decoder 解碼 token sequence，再用 CTC logits 對 decoded tokens 做 forced alignment。
- Chinese token 當 character/word unit；English BPE tokens 會 merge 成 words。

這個設計保留 AED recognition accuracy，同時拿到 token/word-level timestamps。對我們的 transcript alignment、TTS segmentation、full-duplex turn annotation 都很有用。

### 5. FireRedVAD

FireRedVAD 是 ultra-lightweight DFSMN VAD，三個模型：

- non-streaming VAD。
- streaming VAD。
- non-streaming multi-label VAD (mVAD)。

mVAD 是 frame-level multi-label classification，輸出：

- speech
- singing
- music

Binary VAD 則把 speech + singing 當 positive voice，把 music / silence / noise 當 non-voice。

訓練資料是 thousands of hours 的 human-annotated acoustic event data，不是從 ASR forced alignment 弱標籤硬推。作者強調這讓 VAD 在 music/singing/noise 場景更 robust。

模型很小：

- 8 個 DFSMN blocks。
- hidden size 256，projection 128。
- 約 0.6M parameters / 2.2 MB float32。
- streaming 版 look-ahead 0，靠 cache 做 causal inference。

### 6. FireRedLID

FireRedLID 是 hierarchical spoken language and dialect identification：

- Conformer encoder + Transformer decoder。
- Encoder 初始化自 FireRedASR2-AED encoder。
- 訓練資料約 200k hours multilingual speech。
- 支援 100+ languages 和 20+ Chinese dialects。
- label 是 two-level hierarchy：先預測 language token；若是 Chinese，再預測 dialect token；max decoding length 2。

這比 flat label space 更符合語言/方言層級，也降低 dialect label ambiguity。

### 7. FireRedPunc

FireRedPunc 是 BERT-style punctuation prediction：

- Encoder 初始化自 LERT。
- Token-level classification。
- Punctuation set：no-punctuation、comma、period、question mark、exclamation mark。
- Training data：約 18.57B Chinese characters + 2.20B English words，多 domain text。

這讓 raw ASR transcript 能恢復到更適合閱讀、subtitle、TTS transcript processing 的格式。

## Training / Data

資料面是這篇的重點：

- FireRedASR2：~200k hours supervised corpus，涵蓋 Mandarin、English、Chinese dialects、code-switching、speech/singing/non-speech。
- FireRedVAD：thousands of hours human-annotated acoustic event data，標 speech/singing/music boundaries。
- FireRedLID：~200k hours multilingual speech，100+ languages，20+ Chinese dialects。
- FireRedPunc：18.57B Chinese characters + 2.20B English words。

相比前作 FireRedASR，FireRedASR2 主要靠 supervised data scaling 和 coverage expansion 提升，而不是靠新模型架構。

## 主要結果

### ASR

ASR evaluation 覆蓋 24 個 public test sets：

- Avg-Mandarin-4：AISHELL-1、AISHELL-2 iOS、WenetSpeech Internet、WenetSpeech Meeting。
- Avg-Dialect-19：KeSpeech、WenetSpeech-Yue、WenetSpeech-Chuan、MagicData dialect sets。
- Sing-1：opencpop singing lyrics。

主表結果：

- Avg-All-24：FireRedASR2-LLM 9.67，AED 9.80，Doubao-ASR 12.98，Qwen3-ASR 10.12，Fun-ASR 10.92。
- Avg-Mandarin-4：LLM 2.89，AED 3.05，Doubao 3.69，Qwen3 3.76，Fun-ASR 4.16。
- Avg-Dialect-19：LLM 11.55，AED 11.67，Doubao 15.39，Qwen3 11.85，Fun-ASR 12.76。
- Sing-1：LLM 1.12，AED 1.17，Doubao 4.36，Qwen3 2.57，Fun-ASR 3.05。

FireRedASR2-AED 幾乎追上 LLM 版，顯示它是 practical deployment 的高性價比選擇。

### VAD

FLEURS-VAD-102：

- 102 languages。
- 約每個 language 100 files。
- 9,443 audio files。
- manually annotated binary VAD labels。

Frame-level VAD results：

- FireRedVAD：AUC-ROC 99.60，F1 97.57，FAR 2.69，MR 3.62。
- Silero-VAD：AUC-ROC 97.99，F1 95.95。
- TEN-VAD：AUC-ROC 97.81，F1 95.19。
- FunASR-VAD：F1 90.91，FAR 44.03，MR 0.42。
- WebRTC-VAD：F1 52.30。

作者特別指出 FunASR-VAD miss rate 很低，但 false alarm 很高，會導致 excessive segmentation 和不必要 ASR computation。這對 production pipeline 很實際。

### LID

Utterance-level LID accuracy：

- FLEURS test：FireRedLID 97.18，Whisper 79.41，SpeechBrain 92.91。
- CommonVoice test：FireRedLID 92.07，Whisper 80.81，SpeechBrain 78.75。
- Chinese dialects：FireRedLID 88.47，Dolphin 69.01。

Hierarchical LID 對 Chinese dialect identification 很有價值，尤其是粵語/四川話/吳語/閩語等資料混在一起時。

### Punctuation

Internal multi-domain punctuation test：

- Chinese：FireRedPunc P/R/F1 = 82.84 / 83.08 / 82.96；FunASR-Punc = 77.27 / 74.03 / 75.62。
- English：FireRedPunc = 78.40 / 71.57 / 74.83；FunASR-Punc = 55.79 / 45.15 / 49.91。
- Average F1：FireRedPunc 78.90；FunASR-Punc 62.77。

對 TTS transcript 來說 punctuation 不只是 readability，也會影響 prosody、pause、phrase boundary。

## Project relevance

### project-tts-data-pipeline

非常相關。FireRedASR2S 比 FireRedASR 更像我們要的 data preprocessing toolkit：

- VAD segmentation：把 long audio 切成 voice segments。
- mVAD：分 speech / singing / music，可用來濾掉 singing/music contamination，或保留為特殊 metadata。
- LID：標語言/方言，對 multilingual / code-switch data routing 很重要。
- ASR confidence：用來做 transcript filtering / manual review triage。
- token/word timestamps：可做 forced alignment、duration modeling、TTS segment boundary。
- punctuation：把 raw transcript 變成更適合 TTS prosody 的 text。

它給我們的 schema 啟發：

```text
audio_id
source_url
vad_segments[]
event_segments: speech/singing/music
language + dialect + confidence
raw_asr_text
punctuated_text
asr_confidence
token_or_word_timestamps
quality_scores
filter_decision
```

### project-full-duplex-data

高相關於 preprocessing，但不是 source separation。

對 mono dialogue -> dual-channel pipeline，FireRedASR2S 可以負責：

- long-form segmentation。
- language/dialect tagging。
- ASR transcript + confidence。
- token/word timestamps。
- punctuation boundaries。
- speech/singing/music event tags。

但它缺：

- speaker diarization。
- overlap speech detection / separation。
- speaker-wise transcript。
- backchannel / interruption labels。

所以它適合作為 Sommelier / DialogueSidon / SAM Audio 前後的 transcript infrastructure，不是 full-duplex recovery 本身。

### project-audio-model-evaluation

中高相關。FireRedASR2S 可作 generated speech/audio evaluator 的 component：

- TTS content fidelity：ASR transcript vs prompt。
- generated dialogue transcript adherence。
- LID check：語言/方言是否符合 prompt。
- punctuation / segmentation quality check。
- singing/music contamination detection via mVAD。

但要避免把 ASR output 當唯一真相。對 overlap、accent、synthetic speech artifacts，ASR confidence 可能反映 evaluator bias，而不是 generator failure。

## Related papers in my pool

- [FireRedASR](../arxiv_2501_14350/)：直接前作；FireRedASR2S 保留模型設計，主要擴資料、加 timestamp、整合 VAD/LID/Punc。
- [WenetSpeech-Yue](../arxiv_2509_03959/)：提供 Cantonese corpus / eval；FireRedASR2S 的 dialect eval 使用 WenetSpeech-Yue test sets。
- [Mega-ASR](../arxiv_2605_19833/)：robust ASR in-the-wild；現在 citation graph 也從 Mega-ASR 連到 FireRedASR2S。
- [FunASR](../../tools/modelscope-funasr/)：同樣是 ASR/VAD/Punc toolkit reference；FireRedASR2S 在多個模組表上直接和 Fun-ASR / FunASR-VAD / FunASR-Punc 比較。
- [TASTE](../arxiv_2504_07053/)：需要 reliable transcript + timestamps；FireRedASR2S 可作中文/方言 transcript source。
- [Sommelier](../arxiv_2603_25750/)：full-duplex preprocessing blueprint；FireRedASR2S 可補 VAD/LID/ASR/Punc 這層 infrastructure。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議細讀，尤其如果要做 speech data pipeline、TTS data cleaning、或 full-duplex preprocessing。

最值得讀：

- Structured output schema。
- ASR confidence estimation。
- post-hoc CTC timestamp branch。
- FireRedVAD 的 human-labeled event supervision 和 mVAD label design。
- FireRedLID hierarchical language/dialect decoding。
- VAD/LID/Punc evaluations，尤其 false alarm / miss rate tradeoff。

## 可能的弱點 / open questions

- ASR2 的 200k hours supervised corpus 細節仍不夠透明：來源、license、annotation QA、domain mixture 都沒完整展開。
- 很多 evaluation 包含 commercial API baselines，API 會隨時間更新，嚴格 reproducibility 有限制。
- Punctuation benchmark 是 internal multi-domain test set，雖然作者說會 release，但目前需要追蹤是否公開。
- FireRedVAD 不等於 overlap speech detector；voice = speech + singing，仍不區分 single-speaker vs overlapped speakers。
- 對 full-duplex dialogue 需要 diarization / OSD / source separation，FireRedASR2S 只解決 preprocessing/transcript layer。
- LLM-ASR hallucination / disfluency preservation / punctuation over-normalization 沒有深入分析。

## Tags

asr, vad, language-identification, punctuation, speech-data, industrial-asr, project-tts-data-pipeline, project-full-duplex-data, project-audio-model-evaluation

## Concepts

FireRedASR2S, FireRedASR2, FireRedVAD, FireRedLID, FireRedPunc, all-in-one ASR pipeline, VAD, multi-label VAD, speech singing music labels, language identification, dialect identification, punctuation prediction, ASR confidence, post-hoc CTC timestamp branch, token timestamps, word timestamps, DFSMN, hierarchical LID, FLEURS-VAD-102, Mandarin ASR, Chinese dialect ASR

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{xu2026fireredasr2sastateoftheartindu,
  title={FireRedASR2S: A State-of-the-Art Industrial-Grade All-in-One Automatic Speech Recognition System},
  author={Kaituo Xu and Yan Jia and Kai Huang and Junjie Chen and Wenpeng Li and Kun Liu and Feng-Long Xie and Xu Tang and Yao Hu},
  year={2026},
  eprint={2603.10420},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2603.10420}
}
```
