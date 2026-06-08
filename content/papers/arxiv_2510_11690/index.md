---
paper_key: arxiv_2510_11690
canonical_id: "arxiv:2510.11690"
title: "Diffusion Transformers with Representation Autoencoders"
year: 2025
venue: "ICLR 2026 (Poster)"
url: "https://arxiv.org/abs/2510.11690"
pdf_url: "https://arxiv.org/pdf/2510.11690"
status: read
rating: 8.8
tags:
  - diffusion
  - representation-autoencoder
  - latent-space
  - tokenizer
  - training-efficiency
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
  - project-one-step-audio-generation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv TeX source `source/iclr2026_release.tex`、bibliography / bbl，以及公開 OpenReview forum `0u1LigJaab` 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2510.11690](https://arxiv.org/abs/2510.11690)
- arXiv abstract: [https://arxiv.org/abs/2510.11690](https://arxiv.org/abs/2510.11690)
- PDF: [https://arxiv.org/pdf/2510.11690](https://arxiv.org/pdf/2510.11690)
- arXiv source: [https://arxiv.org/src/2510.11690](https://arxiv.org/src/2510.11690)
- Project page: [https://rae-dit.github.io](https://rae-dit.github.io)
- OpenReview: [https://openreview.net/forum?id=0u1LigJaab](https://openreview.net/forum?id=0u1LigJaab)

## 一句話總結

這篇提出 `Representation Autoencoder (RAE)`：用 frozen pretrained representation encoder，例如 `DINOv2`、`SigLIP2`、`MAE`，取代傳統 diffusion latent model 裡的 `SD-VAE` encoder，再訓練 decoder 做 reconstruction；核心發現是 semantic / high-dimensional latent 可以讓 DiT 更快收斂、更好生成，但前提是 diffusion architecture、noise schedule、decoder robustness 都要配合高維 latent 重新設計。

## 這篇在解決什麼問題

Latent diffusion / DiT 的標準 pipeline 長期依賴 `SD-VAE` 類 autoencoder：

```text
image -> VAE encoder -> low-dimensional latent -> diffusion transformer -> VAE decoder -> image
```

作者認為這個 autoencoder component 已經變成 bottleneck：

- encoder backbone 舊，和 modern transformer / representation learning recipe 不一致。
- latent dimensionality 低，壓縮太強，information capacity 受限。
- 主要靠 reconstruction training，latent semantic structure 弱。
- generator 被迫在一個「為 reconstruction 設計、但不一定適合 generation」的 latent space 裡學。

這篇的問題意識和我們前面整理的 `reconstruction-generation dilemma` 很接近：autoencoder 不能只問「能不能重建 input」，還要問「下游 generative model 是否容易在這個 latent space 裡學好」。

## 核心方法

### 1. Representation Autoencoder

RAE 把 encoder 固定成 pretrained representation model，只訓練 decoder：

```text
image x
  -> frozen representation encoder E
  -> patch latent z
  -> trained ViT decoder D
  -> reconstructed image x_hat
```

作者測的 encoder 包含：

- `DINOv2-B`：patch size 14，latent dimension 768。
- `SigLIP2-B`：patch size 16，latent dimension 768。
- `MAE-B`：patch size 16，latent dimension 768。
- 也比較 `DINOv2-S/B/L` scale。

做法上會丟掉 `CLS/REG` tokens，只保留 patch tokens，並對每個 token 做 layer norm。decoder 用 `L1 + LPIPS + GAN` losses 訓練。

### 2. 高維 latent 不能直接套原本 DiT recipe

作者發現 standard DiT 直接放到 RAE latent 會崩得很明顯：

- `DiT-S`：RAE gFID `215.76`，SD-VAE gFID `51.74`。
- `DiT-XL`：RAE gFID `23.08`，SD-VAE gFID `7.13`。

這不是 RAE 沒用，而是舊 recipe 不適合高維 semantic token。作者歸納三個問題：

- model width 不夠，無法有效處理 token dimension 768 的 latent。
- noise schedule 沒有按照 effective latent dimension 調整。
- decoder 只看過 clean encoder latents，對 diffusion model 產生的 slightly off-manifold latents 不夠 robust。

### 3. Model width 要對齊 token dimension

作者用 single-image overfitting experiment 和 theory 說明：如果 transformer hidden width `d` 小於 latent token dimension `n`，score model 的能力會被 rank bottleneck 限制；只加 depth 不一定能解決。

實務結論很直接：

```text
high-dimensional latent
  -> generator / adapter / head width 也要跟上
```

這對 speech 很重要：如果我們拿 VoxCPM AudioVAE、SSL encoder、continuous speech latent 來訓練 TTS / full-duplex generator，不能只把 latent 換掉，generator architecture 也要配合 latent dimension 和 temporal structure。

### 4. Dimension-dependent noise schedule shift

作者把 SD3 的 schedule shift generalize 到 effective data dimension：

```text
effective dimension m = number_of_tokens * token_dimension
alpha = sqrt(m / n_base)
```

這個調整非常關鍵：在 DINOv2-B RAE 上，gFID 從 `23.075` 改善到 `4.81`。

### 5. Noise-augmented decoding

RAE decoder 如果只在 clean latent 上訓練，遇到 diffusion model output 的 latent distribution shift 會變脆弱。作者在 decoder training 時加 mild Gaussian noise，讓 decoder 看過 smoothed latent distribution。

結果：

- gFID：`4.81 -> 4.28`，generation 變好。
- rFID：`0.49 -> 0.57`，reconstruction 變差。

這是一個很重要的訊號：**更好的 reconstruction 不等於更好的 generation**。為了讓 generator output 更容易被 decoder 解碼，有時需要犧牲一點 clean reconstruction metric。

### 6. Wide DDT head

直接把整個 DiT 都加寬會太貴，所以作者提出 `DDT head`：

```text
z_t = M(x_t | t, y)       # base DiT backbone
v_t = H(x_t | z_t, t)     # shallow but wide DDT head
```

也就是用比較窄的 base model 做主要 computation，再接一個 shallow / wide head 處理高維 output。這樣能對齊 high-dimensional latent，又不讓整個 transformer quadratic cost 爆掉。

實驗顯示 `DDT` 只在高維 RAE latent 上特別有用：

- SD-VAE：`DiT-XL` gFID `7.13`，`DDT-XL` gFID `11.70`，DDT 反而差。
- DINO-B RAE：`DiT-XL` gFID `4.28`，`DDT-XL` gFID `2.16`。

## Training / Data

Autoencoder / decoder：

- Dataset：ImageNet-1K，主要 256x256；512x512 實驗直接訓練 512 decoder 或用 upsampling decoder。
- Encoder：frozen `DINOv2` / `SigLIP2` / `MAE`。
- Decoder：ViT-B/L/XL variants。
- Loss：`L1`、`LPIPS`、GAN / adversarial loss。
- Optimizer：Adam，learning rate 從 `2e-4` cosine decay 到 `2e-5`。
- Batch size：512。
- Decoder training：16 epochs；discriminator training：10 epochs。
- LPIPS 從一開始使用，discriminator 約第 6 epoch 開始，adversarial loss 約第 8 epoch 開始。

Diffusion：

- Task：ImageNet class-conditional generation。
- Backbone：DiT / flow matching style diffusion transformer with `DDT head`。
- Main latent：DINOv2-B RAE。
- Sampling / guidance：主要報告 unguided gFID，也使用 `AutoGuidance (AG)`；作者在 rebuttal 說主結果不是 CFG，而是用 under-trained model 做 AG。

## 主要結果

### 1. RAE reconstruction 本身就不差

ImageNet reconstruction：

- `DINOv2-B` RAE rFID：`0.49`。
- `SigLIP2-B` RAE rFID：`0.53`。
- `MAE-B` RAE rFID：`0.16`。
- `SD-VAE` rFID：`0.62`。

但 linear probing top-1 差異很大：

- `DINOv2-B`：`84.5`
- `SigLIP2-B`：`79.1`
- `MAE-B`：`68.0`
- `SD-VAE`：約 `8.0`

也就是 RAE latent 同時可以有不錯 reconstruction 和更強 semantic structure。

### 2. Reconstruction 最好不代表 generation 最好

`MAE-B` 有最好的 rFID，但 generation 不如 DINOv2。作者在 rebuttal 也反覆強調：

- VAE bottleneck 變大可能改善 reconstruction，卻傷害 generation。
- pixel representation 等於 perfect reconstruction，但 pixel diffusion 更難學。
- noise-augmented decoder 會讓 rFID 變差，但 gFID 變好。

這點和 [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/) 完全呼應。

### 3. DDT-XL + DINOv2-B RAE 達到很強 ImageNet 結果

ImageNet 256：

- 20 epochs unguided gFID：`3.71`
- 80 epochs unguided gFID：`2.16`
- 800 epochs unguided gFID：`1.51`
- 800 epochs guided gFID：`1.13`

ImageNet 512：

- guided gFID：`1.13`

作者也強調 convergence：DDT-XL 大約在 `5e10` training GFLOPs 就超過 REPA-XL、MDTv2-XL、SiT-XL；到 `5e11` GFLOPs 時達到最佳 FID，訓練 compute 明顯較少。

### 4. Noise schedule 和 DDT head 是必要配方

不是「換 encoder」就會好。幾個 ablation 給出的訊號很清楚：

- 沒有 dimension-dependent schedule shift：RAE gFID 可到 `23.075`，非常差。
- 加 schedule shift：`4.81`。
- 再加 noise-augmented decoding：`4.28`。
- 再用 DDT head：DINO-B 上 `2.16`。

### 5. Upsampling decoder 可降低 512 token cost

512 setting：

- Direct 512 latent：1024 tokens，gFID `1.13`，rFID `0.53`。
- 256 latent + decoder upsampling：256 tokens，gFID `1.61`，rFID `0.97`。

也就是可以用 decoder upsampling 換取 4x token efficiency，但 quality 仍有 trade-off。

## Project relevance

### project-generative-speech-representation-evaluation：高相關

這篇是我們想做 speech 版本時最核心的 image-side 原型之一。它提供幾個直接可轉譯的 research question：

- speech/audio 的 `VAE / codec / continuous encoder` 是否也能用 frozen pretrained encoder + trained decoder 取代傳統 reconstruction-only codec？
- 如果 speech latent 維度變高，TTS / audio diffusion generator 是否也需要 `wide head`、adapter、dimension-aware noise schedule？
- `decoder robustness to generated latents` 在 speech 裡可能更重要：decoder 不能只重建 clean encoded audio，也要能解碼 model predicted latent。
- downstream quality 要看 learnability / compute-to-quality：好的 speech representation 應該讓 generator 更早降低 WER、speaker error、prosody error、event timing error。

這也提醒我們：audio 版 project 不能只比較 codec reconstruction PESQ / STOI / ViSQOL / FAD，而要比較 representation 是否容易讓 downstream generator 學。

### project-audio-model-evaluation：高相關

這篇給 evaluation project 的關鍵是：要把 evaluation 分成三層：

```text
reconstruction quality
  vs latent geometry / representation quality
  vs downstream generation quality
```

在 audio/speech 裡，可能要同時測：

- content：WER / CER / semantic transcript match。
- speaker：speaker similarity / EER。
- acoustic：FAD / ViSQOL / UTMOS / DNSMOS。
- prosody：F0、duration、energy contour。
- full-duplex events：overlap、backchannel、breath、laugh、pause timing。
- training efficiency：達到某個 WER / MOS proxy / FAD 門檻需要多少 GPU-hours。

### project-one-step-audio-generation：中高相關

one-step audio generation 會更依賴 representation 的 smoothness 和 decoder robustness。RAE 的 lesson 是：如果 latent space high-dimensional but structured，一步生成不一定不可能；但要給 generator 足夠的 output width / head capacity，也要讓 decoder 能承受 predicted latent 的 distribution shift。

## Related papers in my pool

- [Improved Baselines with Representation Autoencoders](../arxiv_2605_18324/)：RAEv2 follow-up，把 RAE 做成更強 baseline，並提出 `EP_FID@k` 作為 training efficiency metric。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：直接解釋為什麼 rFID 不一定預測 gFID，提出 `iFID` 測 latent interpolation。
- [Reconstruction vs. Generation: Taming Optimization Dilemma in Latent Diffusion Models](../arxiv_2501_01423/)：RAE 引用的 reconstruction-generation dilemma 來源之一。
- [Representation Fréchet Loss for Visual Generation](../arxiv_2604_28190/)：把 representation FD 變成 training objective；和 RAE 的 representation latent / FD evaluation 可以互補。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：speech-side continuous representation / AudioVAE candidate，可用 RAE 的 framing 來評估 tokenizer-free TTS latent。

## OpenReview / reviewer discussion

OpenReview forum `0u1LigJaab` 的 decision 是 **Accept (Poster)**。可見 review scores 包含 `8/6/6/4`，meta-review 認為 reviewers 普遍承認工作價值，rebuttal 回答了大多數 concerns，但仍建議補充 generated images losing semantic details、linear skip connections、text-to-image generalizability 等討論。

主要 reviewer concerns：

- `DINOv2` / semantic encoder 可能丟失 fine details，例如文字、顏色、直線、同類物件 instance-level 區分。
- 作者雖然報告 RAE reconstruction 好，但「什麼 property beyond reconstruction makes representation diffusable?」仍不完全清楚。
- 高維 latent 需要更寬 DiT / DDT head，是否只是 high-compute setting 才有效？
- `DINOv2` 訓練資料很大，可能有 ImageNet-like data leakage / fairness 問題。
- RAE 是否能 generalize 到 text-to-image、smaller datasets、multi-object scenes。
- 是否需要 encoder-specific tuning。

作者 rebuttal 的重點：

- RAE 不只適用 DINOv2；SigLIP2、MAE 也能用，同一套 recipe 下最弱的 MAE setup 80 epochs 也可達 FID 約 `8.28`，優於一些 1400-epoch baseline。
- reconstruction defect 不一定表示 encoder 丟失資訊，也可能是 decoder training 不足；用更多 web images 訓練 decoder 後，rFID / PSNR / SSIM 和文字區域細節都有改善。
- 更好的 reconstruction 不代表更好的 generation：MAE reconstruction 最好但 generation 最弱；pixel perfect reconstruction 仍難做 diffusion；noise-augmented decoding 傷害 rFID 但改善 gFID。
- text-to-image extension 在 rebuttal 中補充：RAE 在 GenEval / DPG-Bench 上比 FLUX-VAE 更好，並有 `3.75x` convergence speedup。
- compute 方面，RAE encoder / decoder 加 diffusion 的總 GFLOPs 不一定高於 SD-VAE based methods；DINOv2-B encoder 約 `22 GFLOPs`，diffusion 額外約 `26.38 GFLOPs`，但 SD-VAE autoencoder 本身是數百 GFLOPs。
- DINOv2-L 不如 DINOv2-B 的現象在 REPA / REPA-E 也出現，可能和 spatial correlation properties 有關，不只是 model size。

## 我該不該細讀

建議細讀，尤其是如果我們真的要做 **speech/audio version of Making Reconstruction FID Predictive of Diffusion Generation FID**。

最值得讀的部分：

- RAE definition：frozen representation encoder + trained decoder。
- 為什麼 standard DiT 不能直接吃 high-dimensional representation latents。
- width / token dimension 的 overfitting experiment 和 theory。
- dimension-dependent noise schedule shift。
- noise-augmented decoder：為什麼 reconstruction 變差但 generation 變好。
- DDT head：如何用 shallow wide head 處理高維 output。
- OpenReview 中關於 reconstruction vs generation、encoder details、compute、公平性的討論。

對我們的最大 takeaway：

> speech representation 不能只用 reconstruction quality 排名；要看它讓 downstream generator 多容易學、decoder 能不能穩定解碼 generated latent、以及 latent 是否保留 content / speaker / prosody / event control 所需的 structure。

## 可能的弱點 / open questions

- 這仍是 image paper；speech/audio 的 temporal structure、duration alignment、speaker identity、linguistic correctness 比 image FID 更複雜。
- RAE 的最佳 encoder property 沒有完全解釋清楚：為什麼 DINOv2-B 比 DINOv2-L / MAE 更適合 generation，仍是 open question。
- high-dimensional latent 需要 architecture adaptation；speech 長序列本來就長，再加高維 latent 可能會很吃 compute。
- noise-augmented decoder 在 speech 上可能有副作用：可能改善 generator latent robustness，但也可能傷害 phoneme clarity、speaker timbre、transient events。
- DDT head 不是 universal trick；它在 SD-VAE low-dimensional latent 上反而變差。
- OpenReview reviewers 對 fine detail / text / multi-object semantic details 的質疑，在 speech 裡可能對應到 consonant detail、speaker boundary、overlap event、nonverbal event 是否被 latent 保留。
- AutoGuidance 需要 weaker model；雖然作者說成本很低，但 speech generator 若訓練昂貴，仍要評估是否值得。

## Tags

- diffusion
- representation-autoencoder
- latent-space
- tokenizer
- training-efficiency
- generative-evaluation
- project-generative-speech-representation-evaluation
- project-audio-model-evaluation
- project-one-step-audio-generation

## Concepts

- Representation Autoencoder
- RAE
- DDT head
- DINOv2
- SigLIP2
- MAE
- high-dimensional latent
- diffusability
- dimension-dependent noise schedule
- noise-augmented decoder
- reconstruction-generation dilemma
- AutoGuidance
- semantic representation
- decoder robustness
- representation learnability

## Citation

```bibtex
@misc{zheng2025diffusiontransformersrepresentationautoencoders,
  title={Diffusion Transformers with Representation Autoencoders},
  author={Boyang Zheng and Nanye Ma and Shengbang Tong and Saining Xie},
  year={2025},
  eprint={2510.11690},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2510.11690}
}
```
