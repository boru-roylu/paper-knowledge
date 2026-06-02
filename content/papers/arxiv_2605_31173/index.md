---
paper_key: arxiv_2605_31173
canonical_id: "arxiv:2605.31173"
title: "MindVoice: Reconstructing Intelligible Speech from Non-invasive Neural Signals with Pretrained Priors"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31173"
pdf_url: "https://arxiv.org/pdf/2605.31173"
status: read
rating: 3
tags:
  - speech-llm
  - tts
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.31173)
- [PDF](https://arxiv.org/pdf/2605.31173)

## 一句話總結
MindVoice 不是一般 TTS paper，而是 neuro-to-speech reconstruction：它把 EEG/MEG 中不完整的 speech evidence 拆成 semantic stream 和 acoustic stream，再用 pretrained ASR / speech codec / TTS / in-context voice cloning priors 補足資訊，合成較可懂的 speech。

## 這篇在解決什麼問題
這篇處理的是 **從非侵入式神經訊號重建連續語音**。

EEG / MEG 的優點是安全、可擴展，但問題很嚴重：
- SNR 低
- spatial resolution 粗
- neural recordings 只保留部分 speech perception evidence
- 直接從 neural signal regression 到 mel / speech latent，容易得到 spectrogram 看起來近似但人聽不懂的語音

作者認為：不能只靠 neural signal 本身重建 speech，而要借用 pretrained models 裡的 speech / language priors 來補足缺失資訊。

## 核心方法
### 1) Dual-stream reconstruction
MindVoice 把 speech reconstruction 拆成兩個互補分支：

- **Semantic-level Reconstruction Stream**：恢復高層 linguistic content
- **Acoustic-level Reconstruction Stream**：估計 pitch / timbre 等 acoustic attributes

最後再用 TTS generation branch 把兩者合成 waveform。

### 2) Semantic stream
semantic stream 目標是從 EEG/MEG 預測離散 speech semantic tokens，再接 frozen ASR model 產生 text。

流程大致是：
- neural signal embedder 把 EEG/MEG 轉成 latent
- speech VQ autoencoder 提供 discrete semantic token space
- neuro-to-semantic aligner 把 neural representation 對到 speech semantic embeddings
- frozen ASR model 利用 language modeling prior 產生 transcript

作者不 fine-tune ASR，因為 neural data 太少，fine-tune 未必有幫助。

### 3) Acoustic stream
acoustic stream 目標是恢復 timbre / pitch / speaker-like cues。作者先把 neural signals 對齊 deep speech features，再透過 pretrained codec quantization 讓 acoustic features 更可辨識，避免回歸到 average feature。

### 4) Speech reconstruction branch
最後使用 pretrained TTS / speech generation model：
- reconstructed text 作為 semantic condition
- predicted acoustic embeddings 作為 acoustic prompt
- 使用 in-context voice cloning 引導 timbre / pitch

作者明確說不對 TTS model 用 ground-truth waveform discrepancy fine-tune，因為那樣可能犧牲 intelligibility 換 spectrogram similarity。

## Training / Data
### Datasets
使用兩個 non-invasive speech perception dataset：
- **Brennan EEG**：49 participants，約 10.1 hours
- **Gwilliams MEG-MASC**：27 participants，約 49 hours

兩者都是 participants 聽 English narratives 時的 neural recordings。

### Preprocessing
- notch filtering
- band-pass filtering
- downsampling
- sentence-level segmentation
- neural-speech temporal alignment
- robust scaling
- outlier clipping
- normalization

作者使用兩種 split：
- Random split：一般 8:1:1
- Sentence split：同一 sentence identity 不跨 train/valid/test，比較嚴格

### Baselines
- Vanilla：neural recordings -> mel-spectrogram -> BigVGAN-v2
- FESDE：EEG embeddings -> VITS-style speech latents -> HiFi-GAN

## 主要結果
MindVoice 在 high-level metrics 上大幅優於 baseline：
- HuBERT semantic similarity 更高
- ASR-BERTScore 更高
- WavLM timbre similarity 更高
- MOS 明顯更高

但在 mel-MSE / MCD 這類 low-level spectral metrics 上不一定最好。作者認為這是合理的：baseline 直接 optimize spectrogram MSE，所以低階頻譜誤差較低；MindVoice 則優先恢復 semantic intelligibility 和 perceptual naturalness。

### 代表性結果
在 MEG Random：
- MindVoice HuBERT `0.829`
- ASR-BERTScore `0.441`
- WavLM `0.777`
- MOS `4.35`

在 EEG Random：
- MindVoice HuBERT `0.752`
- ASR-BERTScore `0.379`
- WavLM `0.664`
- MOS `4.26`

Sentence split 比 Random split 更難，但 MindVoice 仍保持明顯優勢，尤其 MEG 的泛化掉幅較小。

## Project relevance
- **project-tts-data-pipeline**：中等相關。它展示 pretrained TTS / voice cloning priors 如何補足不完整 speech condition，但不是 TTS training data pipeline。
- **project-full-duplex-data**：低到中等相關。它不處理 conversation / overlap / turn-taking，但 dual-stream semantic/acoustic decomposition 對「control signals -> speech synthesis」有啟發。

## Related papers in my pool
- **UniAudio-Token**：兩者都強調 semantic / acoustic factorization；UniAudio-Token 是 tokenizer，MindVoice 是 neuro-to-speech reconstruction。
- **Seed-TTS / PilotTTS**：MindVoice 的 final generation 依賴 pretrained TTS priors，與這些 TTS foundation model 方向相關。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**可選讀，不是優先。**

如果你只關心 TTS data pipeline，這篇不是最核心。但如果你關心「在不完整 control signal 下，用 pretrained priors 合成可懂 speech」，這篇有概念價值。

最值得看的部分是：
- semantic / acoustic dual-stream decomposition
- 為什麼不要只 optimize spectrogram MSE
- pretrained ASR / TTS priors 如何補全 weak signal

## 可能的弱點 / open questions
- 這不是傳統 speech synthesis benchmark，和一般 TTS 任務距離較遠
- reconstructed text 仍常只保留 salient keywords，不一定完整還原句子
- 可能出現 generic phrase / semantic drift
- MOS 很高但需要理解評估方式，避免只看單一分數
- EEG/MEG dataset 小且 domain 特定，泛化到其他 neural recording setting 未知
- 依賴大型 pretrained ASR/TTS priors，模型到底從 neural signal 學到多少、從 language prior 補了多少，需要更細分析

## Tags
- neuro-to-speech
- speech reconstruction
- TTS
- in-context voice cloning
- EEG
- MEG
- speech priors
- semantic reconstruction
- acoustic reconstruction

## Concepts
- non-invasive neural signals
- EEG
- MEG
- semantic-level stream
- acoustic-level stream
- speech VQ autoencoder
- ASR prior
- TTS prior
- in-context voice cloning
- HuBERT metric
- WavLM metric
- ASR-BERTScore
- mel-MSE
- MCD
- neural-to-speech alignment

## Citation
```bibtex
@misc{bao2026mindvoice,
  title={MindVoice: Reconstructing Intelligible Speech from Non-invasive Neural Signals with Pretrained Priors},
  author={Guangyin Bao and Taiping Zeng and Jianfeng Feng and Xiangyang Xue},
  year={2026},
  eprint={2605.31173},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.31173}
}
```
