---
paper_key: arxiv_2607_09134
canonical_id: "arxiv:2607.09134"
title: "ReGen: Hierarchical Multi-Prompt Representation Generation for Efficient Waveform Diffusion Models"
year: 2026
venue: "ICML 2026"
url: "https://arxiv.org/abs/2607.09134"
pdf_url: "https://arxiv.org/pdf/2607.09134"
status: read
rating: 9
tags:
  - waveform-diffusion
  - representation-generation
  - flow-matching
  - audio-codec
  - speech-vae
  - latent-diffusion
  - tts
  - project-generative-speech-representation-evaluation
  - project-one-step-audio-generation
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-07-13
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [Original URL](https://arxiv.org/abs/2607.09134)
- [arXiv abstract](https://arxiv.org/abs/2607.09134)
- [PDF](https://arxiv.org/pdf/2607.09134)
- [arXiv source](https://arxiv.org/src/2607.09134)
- [Demo / audio samples](https://regenvoice.github.io/demo/)
- [OpenReview forum](https://openreview.net/forum?id=T8Y9elIrXa)

## 一句話總結
ReGen 把 REPA-style representation alignment 改成 representation generation：在同一個 waveform diffusion / flow-matching model 裡，同時生成 speech SSL representation、Mel-spectrogram acoustic representation 和 waveform / latent target，藉此改善低 frame-rate audio codec / Wave-VAE / LDM-TTS 的 generative capacity，並讓 ReGenVoice 能在 6.25 Hz latent diffusion 下達到強 WER / speaker similarity 與 RTF 0.08。

## 這篇在解決什麼問題
作者的核心觀察是：REPA 這類 representation alignment 可以加速 diffusion training，但在 waveform diffusion，尤其是極低 bitrate / highly compressed latent 的設定下，直接把 DiT intermediate representation 對齊 SSL 或 acoustic target，可能會把 prompt representation 和 generated latent entangle 在一起，反而限制 generative capacity。

這和我們關心的 speech representation evaluation 很相關。對 audio codec / VAE / latent tokenizer 來說，重建好不等於下游生成好；同樣地，representation alignment 也不一定等於更好的 waveform generation。ReGen 想把「拿 representation 當輔助 supervision」改成「把多層 representation 當成要被 jointly generated 的 target」，讓模型同時學語音語義、聲學細節和最終 waveform / latent。

## 核心方法

### 1) ReGen：從 representation alignment 變成 representation generation
REPA 的做法通常是：讓 DiT 的 intermediate hidden state 去 match 某個 pretrained representation。ReGen 的做法不同：它在 diffusion / flow matching 過程中，同時估計多個 vector fields，包含 data target 和 representation targets。

直覺上，這讓 model 不只是「中間層像 SSL feature」，而是要真的會生成一組有用的 hierarchical prompts / representations。作者認為這可以減少 prompt 與 generation 的 entanglement，讓低 bitrate waveform generator 更穩。

### 2) ReGen-U vs ReGen-H
作者比較兩種設計：

- ReGen-U：unified prompting / generation，同一層同時處理 prompt 和 generation。
- ReGen-H：hierarchical prompting / generation，把 prompt representation 和 generation target 分層處理。

實驗上 ReGen-H 更穩，也被當作 default。這點對 speech model 很有啟發：如果 prompt embedding、speaker condition、semantic token、acoustic latent 全部擠在同一個空間，模型可能容易學 shortcut；分層生成可能更適合低 frame-rate latent speech generation。

### 3) SSL representation + Mel-spectrogram acoustic representation
ReGen 使用兩類 prompt / representation supervision：

- SSL representation：提供 speech-level semantic guidance。
- Mel-spectrogram：提供 waveform acoustic guidance。

這個設計剛好落在「semantic representation」和「acoustic representation」之間。對我們的 Generative Speech Representation Evaluation project，它是一個很好的 case study：好的 speech latent 應該同時保留 content、speaker、prosody、acoustic detail，但這些因素最好不要互相污染。

### 4) GFM：Generalized Flow Matching
作者認為 Conditional Flow Matching (CFM) 會把不同 stochastic paths collapse 成單一 deterministic flow，導致 generalization 受限。GFM 用來改善這個問題，並在 ReGenVoice ablation 裡提升整體 WER、SIM、UTMOS。

這可以理解成：如果 waveform / latent generation 本來就有多種合理路徑，過度 deterministic 的 flow 可能會把 uncertainty 壓平；GFM 讓模型更能處理多樣性。

### 5) ReGenTokenizer / ReGenVAE / ReGenVoice
論文把 ReGen 套到三個層次：

- ReGenTokenizer：single-stage waveform diffusion neural audio codec。
- ReGenVAE：Wave-VAE，用 12.5 Hz、32-dimensional latent 做高壓縮 speech representation。
- ReGenVoice：基於 ReGenVAE latent 的 LDM-TTS，在 6.25 Hz latent diffusion 上做 zero-shot TTS。

ReGenVoice 的設計包含 causal text encoder、implicit latent aligner，以及帶 down/up-sampling 的 Wave-DiT。作者強調 6.25 Hz latent 讓訓練與推論都很快：4 張 H100 訓練 1 天，RTF 0.08。

## Training / Data
資料主要分兩種：

- LibriTTS：0.5k hours，高品質英文 speech。
- Emilia：100k hours，多語且多樣，但作者指出它是 MP3，所以有 high-frequency distortion。

ReGenTokenizer / ReGenVAE：

- 24 kHz waveform。
- Pretraining：batch size 256、1M steps、8 NVIDIA H100。
- Sliced window training：隨機取 96,000 frames，也就是約 4 秒 waveform。
- Fine-tune four-step model：batch size 128、0.5M steps、8 H100。
- Prompt / condition dropout：pretraining 約 0.3 / 0.2；adversarial post-training 只 drop prompt 0.3。

ReGenVAE 的 KL 設定：

- Pretraining：weak KL loss 1e-5。
- Adversarial post-training：KL loss 1e-2。

ReGenVoice：

- 使用 LibriTTS 與 Emilia-en subset，約 40k hours。
- 2-30 秒 latent segments。
- Batch size 256、1M steps、4 H100。
- 目標 latent 先乘 0.1，decode 前再乘 10。

## 主要結果

### 1) ReGenVAE 在 12.5 Hz compressed latent 上很強
在 Seed-en prompted reconstruction benchmark，ReGenVAE-LibriTTS 以 24 kHz、12.5 TPS 達到 WER 2.03、SIM 0.72、UTMOS 3.87。這比多個 codec / tokenizer baseline 更好，尤其是在高度壓縮 latent 下仍保留 intelligibility 和 speaker similarity。

對我們來說，這是一個重要訊號：continuous VAE latent 在 speech generation 可能比 discrete codec token 更適合做低 frame-rate latent diffusion，但需要評估它的 generative geometry，而不是只看 reconstruction metric。

### 2) ReGenVoice 的 zero-shot TTS 結果
Seed-en benchmark 上：

- ReGenVoice 0.5B + 0.5k hours：WER 1.46、SIM 0.64。
- ReGenVoice 0.5B + 40k hours：WER 1.62、SIM 0.70。
- ReGenVoice-S 0.3B + 0.5k hours：WER 2.04、SIM 0.65。
- ReGenVoice-S 0.3B + 40k hours：WER 2.21、SIM 0.68。

主觀評測中，ReGenVoice 25 NFE 的 MOS 4.029、SMOS 3.762、RTF 0.08，和 CosyVoice2 的 MOS / SMOS 接近，但速度明顯更快。

一個很有意思的細節是：作者說較大的 STFT loss 可以把 speaker similarity 拉到 0.72，但可能產生 metallic noise；較小 STFT loss 讓 objective WER / SIM 稍弱，卻改善 human perceptual quality。這對 audio evaluation 很重要，因為 objective metrics 可能鼓勵不自然的聲音。

### 3) NFE / duration control
ReGenVoice 在 Seed-en 上的 NFE 分析：

- 4 NFE：WER 4.20、SIM 0.67、UTMOS 3.05。
- 8 NFE：WER 1.93、SIM 0.69、UTMOS 3.67。
- 25 NFE：WER 1.62、SIM 0.70、UTMOS 3.81。
- 32 NFE：WER 1.67、SIM 0.70、UTMOS 3.82。

作者選 25 NFE 作為 quality / speed tradeoff。duration control 方面，使用 GT duration 時，0.8x 到 1.11x 附近還算穩，但 1.5x 或 0.67x 會明顯拉高 WER。

### 4) Ablation：ReGen、GFM、U-DiT 都有用
ReGenTTS ablation 顯示：

- 移除 GFM：WER 1.60、SIM 0.59、UTMOS 3.98，低於完整 ReGenVoice 的 SIM 0.64。
- 不用 U-DiT、直接在 12.5 Hz：WER 1.74、SIM 0.60、UTMOS 3.97。
- Text encoder 對 intelligibility 不是絕對必要，但 causal Transformer text encoder 對 speaker similarity 和 word-level streaming generation 有幫助。

論文也指出，adversarial post-training 用少量 sampling steps 就能直接從 noise 生成 waveform，並提升速度與整體表現。作者把 CFM pretraining + adversarial post-training 視為 efficient waveform generation 的自然組合。

### 5) Speed
ReGenTokenizer 在 24 kHz、25 TPS、single codebook / latent stream 下，報告 xRT 約 72.356，且支援 streaming。作者認為速度來自 Wave-DiT 的 linear-reshape transformation、低解析度 diffusion，以及 AdaLN-SOLA。

## Project relevance

### project-generative-speech-representation-evaluation：非常高相關
這篇直接提供一個 speech VAE / codec / tokenizer 評估問題：representation 不只要 reconstruct，也要讓下游 generative model 容易學。

可以把 ReGenVAE 放進我們的候選 representation pool，和 VoxCPM / VoxCPM2、continuous encoder、codec token、Wave-VAE、AudioVAE 做比較。尤其要測：

- Latent interpolation 後 decode 是否自然。
- Interpolation alpha 改變時，speaker similarity 是否單調從 speaker A 轉向 speaker B。
- Text / phoneme content 是否在 interpolation 中保持可辨識。
- Prosody / style 是否平滑變化。
- 用相同 compute 訓練小型 generator 時，哪個 latent space 最快達到低 WER / 高 SIM / 高 naturalness。

這篇也支持「learnability metric」：如果某個 latent representation 真的比較適合 generation，應該在早期 training curve 就更快下降、更快出現可懂語音，而不是只在超長訓練後略勝。

### project-one-step-audio-generation：高相關
作者在 limitation / future work 提到希望用 hierarchical multi-prompting 走向 one-step generation。這和我們的 one-step audio generation project 直接相連。

可以借鑑的點：

- 先用 CFM / diffusion 預訓練，再做 adversarial post-training。
- 用 representation generation 幫助低步數 waveform synthesis。
- 把 SSL / Mel / latent 多層 target 放進同一個模型，避免 one-step model 只學到粗糙 waveform mapping。
- 以 NFE curve 衡量從 25-step 到 4-step / 1-step 的退化。

### project-audio-model-evaluation：高相關
ReGenVoice 呈現了 objective metric 和 perceptual quality 的張力：高 STFT loss 可以提升 SIM，卻可能帶 metallic noise。這表示我們的 evaluation 不能只看 WER / SIM / FAD / UTMOS，也要加入 human-friendly rubric 或 localized artifact detection。

這也可以接到 AnyAudio-Judge / FlashTrace 的想法：judge 不只說「有 artifact / 沒 artifact」，而要指出哪一段音訊在幾秒處出現 metallic noise、speaker drift、duration mismatch 或 content deletion。

### project-tts-data-pipeline：中高相關
資料面最值得記的是 LibriTTS vs Emilia 的 tradeoff。LibriTTS 小但乾淨；Emilia 大且多樣，但 MP3 壓縮帶來 high-frequency distortion。這提醒 TTS data pipeline 要把 codec artifacts / high-frequency distortion 當作獨立 cleaning dimension，而不是只看 transcript correctness。

## 和我們現有 paper pool 的關係
- [Diffusion Transformers with Representation Autoencoders](../arxiv_2510_11690/)：ReGen source 引用 RAE，並在 future work 提到想把 DDT head 用於 waveform-level vector field estimation。這是 image latent representation 轉到 waveform latent representation 的直接橋樑。
- [VoxCPM](../arxiv_2509_24650/)：同樣是 modern TTS / speech generation 路線；ReGenVoice 提供 tokenizer / VAE / LDM alternative。
- [Miipher](../arxiv_2303_01664/)：source citation 中出現，和 SSL speech/text representation、speech restoration 有關，但不是本文主線。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：概念上高度相關。ReGenVAE 的價值不應只用 reconstruction 指標看，而要用 downstream generation / interpolation / learnability 來測。
- DiffWave / DiTTo-TTS / LongCat-AudioDiT / dots.tts：都是 waveform diffusion、latent diffusion TTS 或 continuous audio representation 的鄰近工作，可放進 one-step audio generation 與 generative speech representation evaluation 的同一張圖。

## 我該不該細讀
建議細讀，尤其是如果我們接下來要做「speech 版 rFID/iFID」或「Generative Speech Representation Evaluation」。

最值得讀：

- ReGen vs REPA 的差異。
- ReGen-H 為什麼比 ReGen-U 穩。
- GFM 對 CFM collapse 的解釋。
- ReGenVAE 12.5 Hz latent 與 ReGenVoice 6.25 Hz LDM 的設計。
- STFT loss 對 objective metric 和 human perceptual quality 的 tradeoff。

## 可能的弱點 / open questions

### 1) Code / checkpoint 尚未公開
TeX source 說會在 paper notification 後 release source code and checkpoints。以 2026-07-13 的公開搜尋結果來看，我只找到 demo / audio samples，沒有找到官方 GitHub repo。若之後 code 開源，應該再回來更新。

### 2) ReGenVAE 是否真的比其他 VAE latent 更適合 generation，還需要獨立驗證
論文展示 reconstruction、TTS 和 ablation，但如果要用在我們的 project，仍要做 controlled downstream generator experiment：固定 generator architecture / compute，只換 latent representation，觀察 training curve、WER/SIM/FAD/MOS proxy。

### 3) 低 frame-rate latent 的 content / speaker / prosody disentanglement 還要測
ReGen-H 的 idea 是分層減少 entanglement，但 paper 沒有完全回答：latent interpolation、speaker conversion、prosody transfer、overlap speech 這些場景中，representation 是否真的平滑且可控。

### 4) Objective metrics 仍可能騙人
作者自己提到 STFT loss 可能帶來 metallic noise。這代表 WER / SIM / UTMOS / MOS 都需要搭配 localized artifact analysis，不然會錯估模型。

## OpenReview / reviewer discussion
找到 OpenReview forum `T8Y9elIrXa`，但 `npm run paper:openreview -- arxiv_2607_09134` 透過 OpenReview API 讀取 notes 時回傳 403，因此目前沒有 reviewer discussion / rebuttal 可摘要。不要根據論壇存在自行推測 reviewer 意見。

## Generation note
Summary by Codex GPT-5, based primarily on the arXiv TeX source (`Regen_arXiv.tex`) and local BibTeX (`regen.bib`), with a public web check for venue/demo/code status on 2026-07-13.

## Tags
- waveform-diffusion
- representation-generation
- flow-matching
- generalized-flow-matching
- audio-codec
- speech-vae
- latent-diffusion
- tts
- project-generative-speech-representation-evaluation
- project-one-step-audio-generation
- project-audio-model-evaluation
- project-tts-data-pipeline

## Concepts
- ReGen
- representation generation
- REPA vs ReGen
- hierarchical multi-prompt representation generation
- generalized flow matching
- conditional flow matching
- ReGenTokenizer
- ReGenVAE
- ReGenVoice
- Wave-DiT
- low-bitrate waveform diffusion
- 12.5 Hz speech VAE
- 6.25 Hz latent diffusion
- adversarial post-training
- AdaLN-SOLA
- speaker similarity
- speech representation learnability

## Citation
ICML 2026 acceptance is recorded from the arXiv / ICML public listing. Use the arXiv citation until proceedings metadata is finalized.

```bibtex
@misc{lee2026regenhierarchicalmultipromptre,
  title={ReGen: Hierarchical Multi-Prompt Representation Generation for Efficient Waveform Diffusion Models},
  author={Sang-Hoon Lee and Ha-Yeong Choi},
  year={2026},
  eprint={2607.09134},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2607.09134}
}
```
