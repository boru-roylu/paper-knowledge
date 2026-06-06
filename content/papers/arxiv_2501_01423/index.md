---
paper_key: arxiv_2501_01423
canonical_id: "arxiv:2501.01423"
title: "Reconstruction vs. Generation: Taming Optimization Dilemma in Latent Diffusion Models"
year: 2025
venue: "CVPR 2025 Oral / arXiv"
url: "https://arxiv.org/abs/2501.01423"
pdf_url: "https://arxiv.org/pdf/2501.01423"
status: read
rating: 8
tags:
  - diffusion
  - latent-space
  - autoencoder
  - tokenizer
  - visual-generation
  - project-one-step-audio-generation
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sections/*.tex`) and arXiv / CVPR metadata. This is a visual latent diffusion paper, included because its tokenizer-side reconstruction-generation dilemma is directly relevant to audio codec / VAE / tokenizer selection.

## Links
- [Original URL](https://arxiv.org/abs/2501.01423)
- [arXiv abstract](https://arxiv.org/abs/2501.01423)
- [PDF](https://arxiv.org/pdf/2501.01423)
- [arXiv source](https://arxiv.org/src/2501.01423)
- [Official GitHub repo](https://github.com/hustvl/LightningDiT)
- [CVPR 2025 openaccess PDF](https://openaccess.thecvf.com/content/CVPR2025/papers/Yao_Reconstruction_vs._Generation_Taming_Optimization_Dilemma_in_Latent_Diffusion_Models_CVPR_2025_paper.pdf)

## 一句話總結
這篇提出 **VA-VAE** 和 **LightningDiT**，核心觀點是 latent diffusion 的 visual tokenizer 不能只追 reconstruction：高維 latent 雖然讓 rFID 變好，但會讓 DiT 更難學、gFID 變差；作者用 vision foundation model alignment regularize VAE latent space，讓 tokenizer 同時有高 reconstruction 和更好的 generation suitability，最後在 ImageNet 256x256 達到 FID 1.35，並在 64 epochs 達到 FID 2.11，約 21.8x 比原始 DiT 更快收斂。

## 這篇在解決什麼問題
Latent diffusion model 是兩階段系統：

```text
image
  -> visual tokenizer / VAE
  -> latent diffusion / DiT
  -> decoder
  -> generated image
```

一般直覺是 tokenizer reconstruction 越好越好，所以會想增加 latent dimension，保留更多細節。但作者指出這會產生 **optimization dilemma**：

- per-token feature dimension 變大，reconstruction quality 變好。
- 但 high-dimensional latent space 如果沒結構，DiT 需要更大模型和更多訓練步數才能學好。
- 在固定 compute 下，高 reconstruction tokenizer 反而可能造成 worse generation。

所以問題不是「reconstruction vs generation 二選一」，而是：**如何讓 high-dimensional latent 同時保留細節，又對 diffusion model 可學、可生成、可收斂。**

## 核心方法
### 1) VA-VAE：用 vision foundation model 約束 latent space
作者的判斷是，高維 latent 難學是因為它太 unconstrained。VA-VAE 在訓練 VAE tokenizer 時，加入 **Vision Foundation model alignment Loss (VF Loss)**，讓 VAE latent space 對齊 DINOv2 / MAE 這類 pretrained vision representation。

這不是把 foundation model 塞進 DiT 訓練，而是在 tokenizer training 階段先把 latent space 變得更 structured。

### 2) VF Loss 的兩個主要部分
VF Loss 主要包含：

**Marginal Cosine Similarity Loss**

- 對齊 VAE latent feature 和 foundation model feature 的 direction / semantic similarity。
- 目標是讓 latent 不只是重建像素，也帶有 foundation model 的 semantic structure。

**Marginal Distance Matrix Similarity Loss**

- 對齊 batch 內樣本之間的 pairwise distance structure。
- 直覺是保留 foundation representation 的 relative geometry，避免 high-dimensional latent 學成過度集中或不可插值的形狀。

### 3) Adaptive weighting
VF loss 和 reconstruction loss 的 scale 差很多，直接加權不穩。作者用 adaptive weighting：比較 VF loss 和 reconstruction loss 在 encoder 最後 convolution layer 上的 gradient norm，讓兩者對 optimization 的影響接近。

這讓 VF loss 更像 plug-in regularizer，能接到不同 VAE training pipeline。

### 4) LightningDiT：把 DiT baseline 現代化
為了驗證 tokenizer 的效果，作者也做了一個更強更快的 DiT baseline，叫 **LightningDiT**。它不是單一新架構，而是整合多個訓練和架構改善：

- Rectified Flow
- logit-normal timestep sampling
- velocity direction loss
- `torch.compile`
- bfloat16 training
- larger batch
- AdamW beta2 調整
- RMSNorm
- SwiGLU
- RoPE
- patch size / tokenizer 搭配調整

作者明確說不是每個 trick 都是原創，價值在於建立一個 open-source fast-converging DiT baseline。

## Training / Data
主要實驗：

- Dataset：ImageNet 256x256 class-conditional generation。
- Tokenizers：
  - baseline LDM tokenizer。
  - VA-VAE with VF loss using MAE。
  - VA-VAE with VF loss using DINOv2。
  - 不同規格：`f16d16`, `f16d32`, `f16d64`。
- Generative model：LightningDiT-B / L / XL。
- Latents 預先抽取後再訓練 DiT。
- Sampling：250-step Euler integrator；並使用 CFG interval 和 timestep shift 等技巧。

關鍵設定：

- tokenizer global batch size：256。
- tokenizer learning rate：`1e-4`。
- VA-VAE extended training：125 epochs。
- LightningDiT-XL final training：800 epochs。
- rapid convergence comparison：64 epochs。

## 主要結果
### 1) 高維 tokenizer 有 reconstruction-generation dilemma
作者在 tokenizer 規格上觀察到：

- latent dimension 增加，rFID 通常下降，重建變好。
- 但相同 compute 下，生成 FID 變差。

這直接支持剛剛加入的 iFID 那篇：**reconstruction metric 不足以代表 diffusion generation suitability**。

### 2) VF Loss 改善高維 tokenizer 的生成性能
在 `f16d32` 和 `f16d64` 這類高維 tokenizer 上，VF loss 明顯改善 generation FID，而且對 reconstruction 損害很小。

作者報告 convergence speedup：

- `f16d32`：約 2.54x。
- `f16d64`：約 2.76x。

也就是說，vision foundation alignment 讓高維 latent 更容易被 DiT 學。

### 3) 系統級結果：FID 1.35，64 epochs 達 FID 2.11
LightningDiT + VA-VAE 在 ImageNet 256x256：

- rFID：0.28。
- 800 epochs + CFG：FID 1.35。
- 64 epochs + CFG：FID 2.11。
- 相比原始 DiT 約 1400 epochs，64 epochs 達到 FID 2.11 對應約 21.8x convergence speedup。

作者也強調這是同時達到高 reconstruction 和高 generation，而不是只犧牲其中一邊。

### 4) LightningDiT baseline 本身也很重要
用 SD-VAE 時，LightningDiT 在約 80 epochs 就能達到 FID 7.13，使用的 training samples 約是原始 DiT 的 6%。這說明 paper 的提升不是只靠 tokenizer，也包括更現代化的 DiT training recipe。

## Project relevance
**project-one-step-audio-generation：高相關。**

這篇不是 one-step paper，但對 one-step audio generation 很重要，因為 one-step generator 更依賴 latent/tokenizer geometry。如果 audio codec / VAE latent 是高重建但不可生成、不可插值、對 diffusion/flow 不友善，one-step student 會更難學。

可借到 audio 的原則：

```text
不要只選 reconstruction 最好的 audio codec / VAE
要選 latent geometry 對 generation 最友善的 codec / VAE
```

audio 版 VA-VAE 可以想像成：

- audio codec latent 對齊 speech SSL encoder。
- prosody latent 對齊 prosody / emotion encoder。
- speaker latent 對齊 speaker embedding geometry。
- speech+sound latent 對齊 CLAP / audio-text model。

這能和 FD-loss / iFID 形成三角：

- VA-VAE：訓練 tokenizer 時加入 foundation alignment。
- iFID：評估 tokenizer latent 是否 interpolatable / generative。
- FD-loss：post-train generator 時直接用 representation distribution matching。

**project-audio-model-evaluation：高相關。**

這篇再一次證明：只看 reconstruction metric 會誤導。audio evaluation 也不能只看 PESQ / STOI / mel loss / reconstruction FAD；需要 generation-oriented metrics，例如 audio-iFID、multi-representation FDr_audio、或 downstream generator score。

**project-tts-data-pipeline：中度相關。**

如果 TTS pipeline 要選 semantic token、codec token 或 acoustic latent，這篇支持使用 foundation-model-aligned tokenizer。尤其對 expressive TTS / dialogue TTS，latent 不只要 reconstruct waveform，也要保留 speaker、prosody、phonetic、event geometry。

## Related papers in my pool
- [[arxiv_2603_05630|Making Reconstruction FID Predictive of Diffusion Generation FID]]：iFID 是評估 latent tokenizer generation suitability；本篇則提出 VF loss 直接改善 tokenizer latent。
- [[arxiv_2604_28190|Representation Fréchet Loss]]：FD-loss 是 generator-side distribution matching；本篇是 tokenizer-side foundation alignment。
- [[arxiv_2606_03972|AAD-1]]：one-step autoregressive generation；本篇提醒 AAD-1 類模型也需要好的 latent/tokenizer geometry。
- [[arxiv_2605_28063|PlanAudio]]：如果做 speech+sound latent generator，foundation-aligned audio tokenizer 可能是核心基礎。
- [[arxiv_2606_03116|AnyAudio-Judge]]：可作 output rubric judge；本篇則處理 latent representation 是否對 generation 友善。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。這篇已有 CVPR 2025 openaccess PDF，截圖標示 CVPR Oral；arXiv version 為 2025 preprint。

## 我該不該細讀
**建議細讀，尤其是如果我們要做 audio codec / VAE / tokenizer。**

它和 iFID、FD-loss 放在一起，可以形成一條清楚的 audio latent research line：

1. 不要相信 reconstruction metric。
2. 用 interpolation / generation-oriented metric 評估 tokenizer。
3. 用 foundation model alignment 改善 tokenizer latent。
4. 用 distribution loss 或 sequence critic 改善 one-step generator。

## 可能的弱點 / open questions
1. **vision foundation alignment 不等於 audio foundation alignment**  
   Audio 裡的 content、speaker、prosody、room、event 混在一起，比 image semantic feature 更難拆。需要決定對齊哪個 audio foundation model。

2. **LightningDiT tricks 和 tokenizer gain 交織**  
   系統級 FID 1.35 來自 VA-VAE + LightningDiT。若只拿 tokenizer 思路到 audio，需要單獨 ablate tokenizer vs generator training recipe。

3. **高維 latent 的成本仍存在**  
   VF loss 讓高維 latent 更可學，但不代表 compute 成本消失。audio 長序列下，高維 codec latent 可能更昂貴。

4. **沒有直接處理 conditional correctness**  
   ImageNet class-conditional 比 TTS / dialogue condition 簡單。audio tokenizer alignment 仍需確保 transcript、speaker、emotion、event controls 不被壓掉。

5. **對 one-step audio 還需要額外驗證**  
   本篇是 multi-step diffusion / DiT convergence。one-step audio 是否同樣受益，需要實驗確認。

## Tags
- `diffusion`
- `latent-space`
- `autoencoder`
- `tokenizer`
- `visual-generation`
- `project-one-step-audio-generation`
- `project-audio-model-evaluation`
- `project-tts-data-pipeline`

## Concepts
- `reconstruction-generation dilemma`
- `VA-VAE`
- `Vision Foundation model alignment Loss`
- `VF Loss`
- `LightningDiT`
- `visual tokenizer`
- `latent diffusion tokenizer`
- `rFID vs gFID`
- `foundation-model-aligned latent space`
- `audio tokenizer alignment`

## Citation
```bibtex
@misc{yao2025reconstructionvsgenerationtami,
  title={Reconstruction vs. Generation: Taming Optimization Dilemma in Latent Diffusion Models},
  author={Jingfeng Yao and Bin Yang and Xinggang Wang},
  year={2025},
  eprint={2501.01423},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2501.01423}
}
```
