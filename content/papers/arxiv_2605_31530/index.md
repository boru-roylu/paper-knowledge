---
paper_key: arxiv_2605_31530
canonical_id: "arxiv:2605.31530"
title: "UNISON: A Unified Sound Generation and Editing Framework via Deep LLM Fusion"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31530"
pdf_url: "https://arxiv.org/pdf/2605.31530"
status: read
rating: 4
tags:
  - speech-llm
  - tts
  - audio-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.31530)
- [PDF](https://arxiv.org/pdf/2605.31530)
- [Project / demos](https://lizhaoqing.github.io/UNISON-demo/)

## 一句話總結
UNISON 用 single VAE + MM-DiT + layer-wise deep LLM fusion，把 text-to-audio、TTS、zero-shot speaker cloning、speech+sound joint generation、audio editing、speech-in-scene editing 和 timed composition 統一到同一個 flow-matching model 裡。

## 這篇在解決什麼問題
現有 audio generation 系統通常是任務專用：
- T2A 一套模型
- TTS 一套模型
- speaker cloning 一套 conditioning
- audio editing 又一套 inversion / mel encoder / task head

這會造成：
- latent spaces 不一致
- conditioning pipeline fragmented
- generation / editing 無法共享能力
- deployment 複雜
- cross-task transfer 弱

UNISON 想做的是：**所有 speech / sound generation 與 editing 任務都走同一個 VAE latent、同一個 DiT backbone、同一個 forward pass，只用 task mask 和 source latent 表示任務差異。**

## 核心方法
### 1) Unified channel-concatenation architecture
每個任務都被轉成同一種 latent input：

`[noisy target latent | source/reference latent | task mask]`

- target audio 用 frozen VAE 編碼
- source / reference audio 也用同一個 frozen VAE 編碼
- task identity 用 channel-wise mask 表示
- MM-DiT 預測 flow-matching velocity

這讓 generation 和 editing 都像 conditional generation，而不是為 editing 另外做 inversion 或專門 encoder。

### 2) Layer-wise deep LLM fusion
UNISON 使用 frozen `Qwen2.5-Omni-7B` text backbone，但不是只拿 final hidden state。

作者把不同 LLM layers 的 hidden states 均勻抽樣，投影到對應的 MM-DiT double-stream blocks：
- early DiT blocks 接收較 shallow 的 lexical / phonetic representation
- later DiT blocks 接收較 abstract semantic representation

這個 depth-matched conditioning 用來提升 complex audio prompt 的 instruction following。

### 3) Plain-text TTS without phoneme pipeline
UNISON 不使用 G2P / phoneme front-end。TTS instruction 直接是 plain text，speaker cloning 則透過 VAE-encoded reference audio，而不是額外 speaker encoder 或 mel side-channel。

### 4) Online multi-task data synthesis
訓練時不為每個任務預先建立 static dataset，而是在 GPU data-loading time 動態合成 task tuples：
- T2A
- TTS
- zero-shot TTS
- T2AS speech+sound mixed generation
- audio add/remove/replace
- speech-in-scene insert/delete/rewrite
- timed composition

這部分包括 RMS normalization、SNR-controlled mixing、boundary fade-in/out、random temporal offsets 和 instruction templates。

### 5) Two-stage curriculum
為了避免 generation / editing gradient conflicts：
- Stage 1：前 150K steps 只訓練 generation tasks
- Stage 2：加入 editing tasks，整體約 70% generation / 30% editing

## Training / Data
- 約 **36M clips**
- 約 **57K hours**
- audio：2.3M clips
- speech：33.7M clips
- 使用 WavCaps、AudioSet、VGGSound、LibriTTS、WenetSpeech、Emilia 等
- speech-heavy captions 會在 audio side filtering
- speech clips 短於 3 秒不拿來做 zero-shot TTS sampling

Model variants：
- D24：732M params，16 kHz
- D20：621M params，44.1 kHz

Training：
- 8 x H800
- AdamW
- LR `1e-4`
- BF16
- EMA
- CFG dropout `0.1`
- base models max duration 10 s，long speech fine-tune 到 22 s

## 主要結果
### Text-to-Audio
在 AudioCaps：
- D24 FAD `1.558`，CLAP `0.503`
- D20 FD `15.82`，IS `12.04`

UNISON 比 Audio-Omni / MMAudio-L 更小，但 FAD 更好。

### TTS / zero-shot TTS
在 Seed-TTS：
- D24 English pure WER `1.27%`
- D24 English zero-shot WER `1.50%`
- D24 Chinese pure CER `0.92%`
- D24 Chinese zero-shot CER `0.89%`

作者強調：UNISON 沒有 phoneme encoder，卻能匹配或超過很多 explicit G2P / TTS-specialist models。

### Gender-controlled TTS
只靠文字 instruction，例如 "A male voice saying..."，兩個 variants 都達到 300/300 gender accuracy，而且 WER/CER 沒有明顯惡化。

### T2AS speech + sound joint generation
D24 在 mixed speech+sound generation：
- CLAP `0.444`
- WER `2.04%`
- CER `3.64%`

這點對 environment-aware / scene-aware speech synthesis 很有用，因為它不是先合成 speech 再外部混音，而是同一模型輸出 speech + soundscape。

### Audio editing / speech-in-scene editing
Audio editing：
- D24 overall FD `12.38`
- CLAP `0.364`

Speech-in-scene editing：
- Delete speech removal rate `99.16%`
- Insert / Rewrite WER <= `1.35%`

這表示模型可以在保留 background soundscape 的同時插入、刪除或改寫 speech。

### Ablation
- deep LLM fusion 比 single-layer conditioning 更好
- redundant text tokens 會提高 TTS WER
- double-stream MM-DiT 對 text/audio modality separation 很重要
- 7B LLM 比 3B LLM conditioning 更好

## Project relevance
- **project-tts-data-pipeline**：中高相關。它的 online multi-task synthesis pipeline、speech+sound mixing、speech-in-scene editing data construction 值得參考。
- **project-full-duplex-data**：中等相關。它支援 speech+sound / scene editing / timed composition，但尚未處理真正 multi-speaker overlap 或 full-duplex turn-taking。

## Related papers in my pool
- **ImmersiveTTS**：兩者都處理 speech + environmental audio；ImmersiveTTS 更專注 environment-aware TTS，UNISON 更通用且包含 editing。
- **SwanVoice**：SwanVoice 專注 multi-speaker dialogue TTS；UNISON 專注 unified audio generation/editing。
- **UniAudio-Token**：UniAudio-Token 做 universal audio tokenizer；UNISON 做 universal audio generator/editor。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀，但優先看與 speech-in-scene / T2AS 相關章節。**

如果你的目標是 clean English TTS data pipeline，這篇不是最直接；如果你的目標是未來生成「speech + acoustic scene」或做 speech-in-background editing，它很值得看。

最值得看的部分：
- channel-concatenation unified task formulation
- online multi-task data synthesis
- T2AS construction
- speech-in-scene insert/delete/rewrite
- layer-wise deep LLM fusion ablation

## 可能的弱點 / open questions
- editing / T2AS data 主要是 synthetic mixing，和真實場景的 room acoustics / occlusion / Lombard effect 有差距
- VAE 原本偏 environmental sound，對細緻 speech timbre / whispered / breathy voice 有上限
- 目前支援 English / Chinese，其他語言需要更多資料
- 不處理 music generation
- multi-speaker dialogue、overlap、backchannel、interrupt 不是核心任務
- unified architecture 雖簡潔，但不同任務的最佳 sampling / CFG / duration control 可能仍要分別調

## Tags
- audio generation
- TTS
- zero-shot TTS
- text-to-audio
- speech-in-scene editing
- audio editing
- MM-DiT
- flow matching
- deep LLM fusion
- unified audio model

## Concepts
- layer-wise deep LLM fusion
- Qwen2.5-Omni
- MM-DiT
- flow matching
- frozen VAE
- channel concatenation
- task mask
- source latent
- T2AS
- speech-in-scene editing
- timed composition
- zero-shot speaker cloning
- online multi-task data synthesis
- homogeneous batching
- two-stage curriculum
- classifier-free guidance

## Citation
```bibtex
@misc{li2026unison,
  title={UNISON: A Unified Sound Generation and Editing Framework via Deep LLM Fusion},
  author={Zhaoqing Li and Haoning Xu and Jingran Su and Yaofang Liu and Zhefan Rao and Huimeng Wang and Jiajun Deng and Tianzi Wang and Zengrui Jin and Rui Liu and Haoxuan Che and Xunying Liu},
  year={2026},
  eprint={2605.31530},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.31530}
}
```
