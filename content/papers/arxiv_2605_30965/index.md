---
paper_key: arxiv_2605_30965
canonical_id: "arxiv:2605.30965"
title: "ImmersiveTTS: Environment-Aware Text-to-Speech with Multimodal Diffusion Transformer and Domain-Specific Representation Alignment"
year: 2026
venue: "arXiv"
url: "https://arxiv.org/abs/2605.30965v1"
pdf_url: "https://arxiv.org/pdf/2605.30965"
status: read
rating: 4
tags:
  - speech-llm
  - tts
  - asr
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.30965v1)
- [PDF](https://arxiv.org/pdf/2605.30965)

## 一句話總結
ImmersiveTTS 是一個 environment-aware TTS framework，用 dual-stream MM-DiT + domain-specific REPA，讓 speech 與 environmental audio 在同一個生成過程中更自然地融合。

## 這篇在解決什麼問題
這篇在解決「如何同時生成 intelligible speech 與 matching 的 environmental audio」的問題。  
傳統 TTS 通常只專注 speech，本身不擅長把背景環境一起建模；而現有 environment-aware TTS 雖然能接收 environmental prompt，但常見問題是：

- speech 和 environment 分開建模，cross-modal interaction 不夠
- 生成結果容易有 speech-environment mismatch
- 在保留 linguistic content 的同時，難以維持 acoustic coherence
- diffusion-based 方法常需要很多 sampling steps，推理成本高

## 核心方法
ImmersiveTTS 的核心有兩個部分：

1. **Multimodal Diffusion Transformer (MM-DiT) backbone**
   - 把輸入拆成兩條 stream：
     - **speech stream**：處理 transcript-aligned speech latent
     - **environment context stream**：處理 text-conditioned environmental prompt
   - 兩條 stream 透過 **joint attention** 互相交換資訊
   - speech stream 先吸收環境資訊，再進入 single-stream blocks 做 refinement

2. **Domain-Specific Representation Alignment (REPA)**
   - 在 diffusion / flow matching 訓練之外，再加一個 representation alignment objective
   - 用兩個 specialized SSL teachers：
     - **WavLM**：對齊 speech / linguistic fidelity
     - **ATST-Frame**：對齊 environmental acoustics
   - 透過 intermediate hidden states 與 teacher representations 做 cosine alignment
   - 目標是減少 speech 與 environment 之間的 domain gap，讓訓練更穩定、semantic consistency 更好

另外還有幾個實作重點：

- 使用 **flow matching / rectified flow** 作為 generative objective
- 用 **dual classifier-free guidance (CFG)** 分別控制 content prompt 與 environment prompt
- content 端用了 alignment / duration modeling（MAS）把 text 變成 frame-level prior mel representation
- environmental conditioning 同時用了 **CLAP**（global semantics）與 **Flan-T5**（token-level detail）

## Training / Data
### Training data
作者用的是**合成 mixture training corpus**：

- **LibriTTS train-clean-360**：提供 clean speech / transcription content
- **WavCaps**：提供 environmental sounds
- 先從 WavCaps 中過濾掉含 speech 的 clip，保留 **340k non-speech clips**
- speech 與 environmental audio 以 **SNR 2–10 dB** 混合
- 有 **0.15** 的機率不混背景、直接用 clean speech，避免模型只會處理 noisy scene

### Preprocessing
- audio downsample 到 **16 kHz**
- 轉成 **64-bin mel-spectrogram**
- 再用 frozen **AudioLDM2 VAE** 壓縮到 latent space

### Training setup
- train **400k steps**
- optimizer: **AdamW**
- learning rate: **1e-4**
- batch size: **8 / GPU**
- hardware: **2 × NVIDIA RTX A6000**
- total trainable parameters 約 **450M**
- CLAP / T5 / teacher SSL encoders 都是 frozen
- inference 時用 **Euler ODE sampling** 與 dual CFG

## 主要結果
作者在 **AudioCaps test set** 與 augmented test set 上和 **VoiceLDM、VoiceDiT** 比較，結果顯示 ImmersiveTTS 明顯更好。

### AudioCaps test set
ImmersiveTTS：
- **SN-MOS 4.20**，高於 VoiceLDM 3.41、VoiceDiT 3.47
- **ON-MOS 3.47**，高於 VoiceLDM 2.55、VoiceDiT 2.63
- **WER 8.06**，低於 VoiceLDM 16.45、VoiceDiT 11.68
- **FAD 5.80**，低於 VoiceLDM 8.75、VoiceDiT 9.07
- **CLAP 0.308**，高於 VoiceLDM 0.229、VoiceDiT 0.263
- 只用 **25 NFEs**，而 baseline 用 **200 NFEs**

### Augmented test set
ImmersiveTTS 同樣表現最好或接近最好：
- **SN-MOS 4.18**
- **ON-MOS 3.23**
- **WER 4.48**
- **FAD 3.92**
- **CLAP 0.207**
- 仍然只要 **25 NFEs**

### Ablation
- 單一 teacher 時：
  - **WavLM** 偏向改善 speech intelligibility
  - **ATST** 偏向改善 environmental alignment
- 雙 teacher 時效果最好
- **WavLM + ATST** 的組合最佳，表示 domain-specific teacher pairing 比單一通用 teacher 更有效

## Project relevance
- **project-full-duplex-data**: low
- **project-tts-data-pipeline**: medium

## 我該不該細讀
**如果你在做 environment-aware TTS、audio generation、或 diffusion-based speech synthesis，值得細讀。**  
特別是想看：

- dual-stream MM-DiT 怎麼把 speech / environment 分開又融合
- REPA 怎麼設計成 domain-specific
- 如何用較少 NFEs 取得較好 quality-efficiency trade-off
- 如何把 prompt-conditioned environment control 做得更穩

如果你主要關心的是 **full-duplex dialogue** 或 **TTS data cleaning pipeline**，這篇是**間接相關**，可以先略讀摘要、方法與 ablation。

## 可能的弱點 / open questions
- 主要訓練資料是 **synthetic mixtures**，和真實場景中的自然 interaction 仍可能有差距
- 對不同 **SNR**、不同 scene complexity 的 robustness 還沒有完整分析
- 目前缺少對 **prosody / speaking style / emotion** 的明確控制
- environmental prompt 主要是 text-based，若 prompt 描述不精準，生成品質可能受影響
- FAD / CLAP / MOS 雖然改善，但對「真的像 immersed speech in the wild」的 generalization 仍需更大規模測試

## Tags
environment-aware TTS, MM-DiT, flow matching, REPA, multimodal diffusion, speech generation, environmental audio, CLAP, WavLM, ATST-Frame

## Concepts
- **Environment-aware TTS**：同時生成 speech 與背景環境聲的 TTS
- **MM-DiT**：multimodal diffusion transformer，用雙 stream 進行 modality interaction
- **joint attention**：讓 speech 與 environment token 彼此關注
- **flow matching / rectified flow**：用 ODE 形式做 generative modeling
- **REPA**：representation alignment，用 teacher SSL feature 來穩定 diffusion training
- **WavLM**：speech-focused SSL encoder
- **ATST-Frame**：audio-focused SSL encoder，擅長 environmental acoustics
- **CLAP**：text-audio embedding alignment，用來衡量或 conditioning 音訊與文字一致性
- **MAS**：monotonic alignment search，用於 text-to-speech duration alignment
- **dual CFG**：分別對 content 與 environment 做 classifier-free guidance
- **NFEs**：number of function evaluations，衡量 sampling cost
- **SN-MOS / EC-MOS / ON-MOS**：speech naturalness / environmental consistency / overall naturalness 的主觀評分
- **WER**：word error rate，評估 intelligibility / content accuracy
- **FAD**：Frechet audio distance，評估音訊分佈品質

## Citation
```bibtex
@article{yun2026immersivettsenvironmentaware,
  title={ImmersiveTTS: Environment-Aware Text-to-Speech with Multimodal Diffusion Transformer and Domain-Specific Representation Alignment},
  author={Yun, Jun-Hak and Kim, Seung-Bin and Lee, Seong-Whan},
  journal={arXiv},
  year={2026},
  doi={10.48550/arxiv.2605.30965v1}
}
```
