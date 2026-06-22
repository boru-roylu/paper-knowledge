---
paper_key: arxiv_2602_19083
canonical_id: "arxiv:2602.19083"
title: "ChordEdit: One-Step Low-Energy Transport for Image Editing"
year: 2026
venue: "CVPR 2026"
url: "https://arxiv.org/abs/2602.19083"
pdf_url: "https://arxiv.org/pdf/2602.19083"
status: read
rating: 8.5
tags:
  - image-editing
  - one-step-generation
  - optimal-transport
  - diffusion
  - flow-matching
  - real-time-generation
  - project-one-step-audio-generation
created: 2026-06-22
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `supplementary.tex`), official project page, official GitHub repo, and arXiv metadata.

## Links

- [Original URL](https://arxiv.org/abs/2602.19083)
- [arXiv abstract](https://arxiv.org/abs/2602.19083)
- [PDF](https://arxiv.org/pdf/2602.19083)
- [arXiv source](https://arxiv.org/src/2602.19083)
- [Project page](https://chordedit.github.io/)
- [Official GitHub repo](https://github.com/ChordEdit/ChordEdit)
- [OpenReview forum](https://openreview.net/forum?id=upyHp7LT8N)

## 一句話總結

ChordEdit 是一篇 CVPR 2026 image editing paper：它發現把 multi-step training-free editor 強行壓成 one-step 時，naive source/target drift difference 會變成 high-energy、high-variance control field，導致背景崩壞和物體變形；作者用 dynamic optimal transport 推出一個 low-energy **Chord Control Field**，讓 one-step / two-NFE image editing 變得穩定。

## 這篇在解決什麼問題

one-step T2I models，例如 SD-Turbo、SwiftBrush-v2、InstaFlow，讓 image synthesis 可以接近 real-time。但 image editing 比 generation 更難，因為 edit 不只要跟 target prompt 對齊，還要保留 source image 中不該變的區域。

既有 training-free / inversion-free editors 常用 source prompt 和 target prompt 的 drift difference：

```text
Delta v = v(x_t, t, c_target) - v(x_t, t, c_source)
```

在 multi-step diffusion / flow 中，這種差分可以靠很多小步平滑掉。但在 one-step setting 裡，單一步長太大，naive drift difference 會變成 high-energy / erratic trajectory，直接造成：

- object distortion。
- non-edited region consistency loss。
- background corruption。
- identity failure。
- seed variance 很大。

ChordEdit 的問題設定是：不用 training、不做 inversion、不依賴 protective mask，能不能直接在 one-step fast backbone 上做高保真 editing？

## 核心方法

### 1) Editing as transport

作者把 editing 視為從 source prompt distribution 到 target prompt distribution 的 transport problem。

pretrained T2I / flow model 給出 conditional probability flow：

```text
dx_t / dt = v(x_t, t, c)
```

source prompt `c_src` 和 target prompt `c_tar` 對應兩個 conditional dynamics。理想 editing vector field `u_t` 應該把 source distribution 送到 target distribution，同時 energy 低、路徑穩。

作者借 Benamou-Brenier dynamic optimal transport formulation：

```text
min ∫ ||u_t(x)||^2 rho_t(x) dx dt
s.t. ∂_t rho_t + div(rho_t u_t) = 0
```

這裡的重點不是要完整解 OT，而是用「低 kinetic energy 的 transport field」作為 one-step editing 的穩定性準則。

### 2) Observable proxy field

真實 `u_t` 拿不到，只能 query model。作者定義一個 observable output `Q(z,t,c)`，根據 model parameterization 可以是 noise prediction、velocity prediction、score、`x0` head 或 consistency output。

為了統一不同模型，作者用 time-only linear map `B_t` 把不同 output 轉成同一個 velocity / drift comparison domain：

```text
R(x_tau, t) = E_z [ B_t ( Q(z,t,c_tar) - Q(z,t,c_src) ) ]
```

這個 `R` 就是 naive edit field 的可觀測代理，但它含 noise 且 high-energy，不能直接拿來做 one-step large integration。

### 3) Chord Control Field

核心公式是把當前 field 和前一個小時間窗的 field 做 time-weighted averaging：

```text
u_hat_t(x_tau)
  = [ t * R(x_tau, t - delta) + delta * R(x_tau, t) ] / (t + delta)
```

直覺：不要只看 `t` 當下那個 noisy / high-energy residual，而是看一小段時間窗 `[t-delta, t]` 的 chord。這相當於 causal one-sided kernel smoothing。

作者給出理論說明：

- 這種 smoothing 是 L2 contraction。
- energy 不會比 naive field 更高。
- time derivative / spatial gradient 的 supremum norms 也被 contraction。
- 因此 explicit Euler 的 local truncation error bound 和 stability margin 都改善。

這就是為什麼它能支撐 single large step。

### 4) One-step transport + optional proximal refinement

基本 transport step：

```text
x_pred = x_src + lambda * u_hat
```

再加一個 optional proximal refinement：

```text
x_tar = prox(x_pred, t_c, c_target)
```

這個 prox 是一次 target-conditioned native `predict-x0` call，用來加強 target semantics。作者把它和 transport 分開：transport 主要負責 preserve structure / background，prox 主要負責 amplify target edit semantics。

因此有兩個版本：

- ChordEdit w/o prox：1 NFE，偏 preservation。
- ChordEdit full：2 NFE，semantic alignment 更強。

## Training / Data

這篇方法是：

- training-free。
- inversion-free。
- model-agnostic。
- 不需要 dedicated inversion network。
- 不需要 protective masks。

Backbones / models：

- SD-Turbo。
- SwiftBrush-v2。
- InstaFlow。

Evaluation：

- benchmark：PIE-bench。
- 512x512 instruction-based image editing。
- 700 samples，10 edit categories。
- 每個 sample 有 source image、text prompts、ground-truth edit mask。

Metrics：

- background fidelity：PSNR、MSE、LPIPS、SSIM 等，只在 non-edited regions 上算。
- semantic alignment：CLIP-Whole、CLIP-Edited。
- efficiency：steps、NFE、runtime、VRAM。
- user study：human preference on semantic alignment and preservation quality。

Implementation：

- default full ChordEdit：`n=1`, `t=0.90`, `delta=0.15`, `lambda=1.00`, `t_c=0.30`。
- full method：2 NFE，0.38s runtime，約 6988 MiB VRAM。
- transport-only：1 NFE，0.20s runtime。
- experiments on one NVIDIA Titan 24GB GPU。

## 主要結果

### 1) one-step / two-NFE 效率很強

PIE-bench main comparison 中：

- ChordEdit (w/o prox, SD-Turbo)：1 step / 1 NFE / 0.20s。
- ChordEdit full (SD-Turbo)：1 step / 2 NFE / 0.38s。
- ChordEdit (SwiftBrush-v2)：1 step / 2 NFE / 0.38s。
- SwiftEdit：1 step / 2 NFE / 0.54s，但不是 training-free / inversion-free。
- FlowEdit：33 NFE / 7.22s。
- Direct Inversion + PnP：100 NFE / 28.03s。

作者 claim：比 FlowEdit 快 19x，比 Direct Inversion 快 208x 以上。

### 2) Chord field 解決 naive one-step collapse

ablation 顯示：

- naive `delta=0` 在 step count 趨近 1 時 energy spike。
- energy spike 對應 PSNR collapse 和 background corruption。
- Chord Control Field (`delta=0.15`) energy 維持低，PSNR 也更穩。

transport-only ablation：

| Method | PSNR | CLIP-Edited | NFE |
|---|---:|---:|---:|
| Naive w/o prox | 21.89 | 20.83 | 1 |
| Chord w/o prox | 23.89 | 21.87 | 1 |
| Naive w/ prox | 21.38 | 21.96 | 2 |
| Chord w/ prox | 22.20 | 22.96 | 2 |

解讀：Chord field 主要改善 consistency / preservation；prox step 主要提升 semantics。

### 3) single noise sample 就夠

作者分析 `n=1..4` noise samples。結果：

- ChordEdit 的 Pareto fronts 幾乎重疊。
- `n=1` 對 seed variation 很穩，CLIP CoV 0.20%，PSNR CoV 0.07%。
- naive baseline 需要多 noise samples 才比較穩，但即使 naive `n=4` 仍被 ChordEdit `n=1` dominate。

這對 real-time system 很重要：不需要昂貴 Monte Carlo averaging。

### 4) model-agnostic

不同 T2I backbone 上，ChordEdit 都優於 naive：

| T2I method | PSNR naive | PSNR ours | CLIP-Edited naive | CLIP-Edited ours |
|---|---:|---:|---:|---:|
| InstaFlow | 22.05 | 23.05 | 20.19 | 21.39 |
| SwiftBrush-v2 | 20.52 | 22.04 | 21.06 | 22.58 |
| SD-Turbo | 21.38 | 22.20 | 21.96 | 22.96 |

### 5) human preference

User study 中，ChordEdit 在：

- semantic alignment preference：42.5%。
- preservation quality preference：48.3%。

都排第一。

## Project relevance

### project-one-step-audio-generation

中高相關，雖然這篇是 image editing，不是 audio generation。

我們可以借的是方法論：

> one-step failure 不一定只是 model capacity 問題，也可能是 control field / guidance field 太 high-energy、太 noisy，單一步長 integration 直接爆掉。

對 one-step audio / speech 可能有幾個對應：

- source prompt -> target prompt 的 image edit，可類比成 audio style / speaker / emotion / acoustic scene edit。
- naive CFG / target-source residual 在 audio diffusion 中可能造成 artifact、speaker identity collapse、background discontinuity、prosody shock。
- Chord-like temporal smoothing 可以用在 speech latent flow / audio codec latent flow，把 guidance residual 平滑成 low-energy control。
- `transport step + proximal refinement` 可以改成：先做 structure-preserving audio latent transport，再用 target-condition refinement 強化 semantics / speaker / emotion。

尤其對 full-duplex / dialogue audio：

- 如果要 one-step 改 speaker A 的 emotion、保留 speaker B 和 background mixture，低能量 transport 可能比直接強 guidance 更穩。
- overlap region 很容易因 high-energy guidance 破壞，ChordEdit 的 preservation-first framing 可以借來設計 mixture-preserving edit。

### project-audio-model-evaluation

中度相關。這篇的 evaluation split 值得借：

- edited region semantic alignment vs non-edited region preservation。
- Pareto front，而不是單一分數。
- energy / field stability analysis。
- runtime / VRAM / NFE。

對 audio evaluation 可改成：

- target segment semantic/audio-event correctness。
- non-target segment WER / speaker similarity / background preservation。
- guidance energy / latent perturbation magnitude。
- real-time latency。

### project-generative-speech-representation-evaluation

中度相關。ChordEdit 不是 representation paper，但它提醒我們：one-step generator 的 latent control 是否穩定，和 latent geometry / field smoothness 有關。如果某個 audio latent representation 需要 high-energy residual 才能改 speaker/emotion/content，它可能不適合 one-step editing/generation。

## Related papers in my pool

- [AAD-1](../arxiv_2606_03972/)：one-step autoregressive video generation；ChordEdit 則是 one-step image editing，兩者都在解決 large-step stability。
- [Representation Fréchet Loss](../arxiv_2604_28190/)：把 distribution-level metric 變 training objective；ChordEdit 則在 inference-time guidance field 上做 low-energy smoothing。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：latent geometry 是否適合 generation；ChordEdit 補上 one-step control field 是否穩定。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：audio diffusion TTS；可思考 CFG/APG 和 Chord-like smoothing 是否能在 speech latent guidance 中互補。
- [DiTTo-TTS](../arxiv_2406_11427/)：latent diffusion TTS；如果未來做 text-guided speech editing，可借 ChordEdit 的 preserve/edit region trade-off。
- [PlanAudio](../arxiv_2605_28063/)：composite audio generation；ChordEdit 的 source/target prompt transport 可以啟發 audio scene edit。

## OpenReview / reviewer discussion

找到 OpenReview forum：<https://openreview.net/forum?id=upyHp7LT8N>，但 public notes 數為 0，未找到可摘要的公開 review/rebuttal context。

## 我該不該細讀

如果只關心 TTS architecture，可以先略讀；如果在做 **one-step audio generation / low-latency audio editing / guidance stability**，建議細讀。

最值得讀：

1. Chord Control Field 的 derivation。
2. naive field high-energy collapse 的分析。
3. transport vs proximal refinement 的分工。
4. noise sample / seed robustness ablation。
5. PIE-bench 的 edited-region vs non-edited-region evaluation framing。

## 可能的弱點 / open questions

1. **是 image editing，不是 audio**
   不能直接把公式照搬到 speech waveform；audio 的時間連續性、phase、speaker identity、phoneme content 都更敏感。

2. **prox refinement 會犧牲 preservation**
   full ChordEdit CLIP 更好，但 PSNR 比 transport-only 低。audio 版也可能出現：target semantics 更強，但 non-target speaker/background 被破壞。

3. **依賴 fast one-step T2I backbone**
   方法建立在 SD-Turbo / SwiftBrush-v2 / InstaFlow 這種已有 one-step backbone 上。audio 端若沒有同等 backbone，需要先解決 generator 本身。

4. **mask-free evaluation 不等於所有 real editing 都足夠**
   paper 強調不用 protective mask，但某些 precision editing 仍可能需要更明確的 region/time-span control。audio 版尤其需要 time span / speaker span / event span grounding。

5. **OpenReview public discussion unavailable**
   目前無法從 public review 中檢查 reviewer 對理論假設或 evaluation 的主要質疑。

## Tags

#image-editing #one-step-generation #optimal-transport #diffusion #flow-matching #guidance #real-time-generation #low-energy-transport #project-one-step-audio-generation

## Concepts

- ChordEdit
- Chord Control Field
- one-step image editing
- low-energy transport
- dynamic optimal transport
- Benamou-Brenier energy
- training-free editing
- inversion-free editing
- temporal smoothing
- guidance field stability
- one-step integration
- proximal refinement
- PIE-bench
- edited-region semantic alignment
- non-edited region preservation
- model-agnostic one-step control

## Citation

目前以 CVPR 2026 記錄；若正式 proceedings BibTeX 更新，再同步 citation。

```bibtex
@inproceedings{lu2026chordedit,
  title={ChordEdit: One-Step Low-Energy Transport for Image Editing},
  author={Liangsi Lu and Xuhang Chen and Minzhe Guo and Shichu Li and Jingchao Wang and Yang Shi},
  booktitle={Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition},
  year={2026},
  url={https://chordedit.github.io/}
}
```
