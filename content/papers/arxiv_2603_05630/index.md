---
paper_key: arxiv_2603_05630
canonical_id: "arxiv:2603.05630"
title: "Making Reconstruction FID Predictive of Diffusion Generation FID"
year: 2026
venue: "arXiv preprint / ICLR 2026 submission-style source"
url: "https://arxiv.org/abs/2603.05630"
pdf_url: "https://arxiv.org/pdf/2603.05630"
status: read
rating: 7
tags:
  - diffusion
  - evaluation-metrics
  - latent-space
  - autoencoder
  - tokenizer
  - project-audio-model-evaluation
  - project-one-step-audio-generation
  - project-tts-data-pipeline
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`iclr2026_conference.tex`). This is a visual latent diffusion / VAE evaluation paper, included because the same reconstruction-vs-generation dilemma is likely to appear in audio codec / VAE / tokenizer selection.

## Links
- [Original URL](https://arxiv.org/abs/2603.05630)
- [arXiv abstract](https://arxiv.org/abs/2603.05630)
- [PDF](https://arxiv.org/pdf/2603.05630)
- [arXiv source](https://arxiv.org/src/2603.05630)
- [Project page](https://tongdaxu.github.io/pages/ifid.html)
- [Official GitHub repo](https://github.com/tongdaxu/Making-rFID-Predictive-of-Diffusion-gFID)

## 一句話總結
這篇指出 **VAE reconstruction quality 不一定預測 latent diffusion generation quality**：普通 reconstruction FID / PSNR / LPIPS 可能和 generation FID 無關甚至負相關；作者提出 **interpolated FID (iFID)**，在 latent space 找 nearest neighbor、做 latent interpolation、decode 後算 FID，結果能更強地預測 diffusion model 的 gFID，Pearson / Spearman 約 0.85。

## 這篇在解決什麼問題
Latent diffusion model 的 pipeline 通常是：

```text
image
  -> VAE encoder -> latent
  -> diffusion model in latent space
  -> VAE decoder -> image
```

直覺上，VAE reconstruction 越好，latent diffusion 生成應該越好。但近年有一個 **reconstruction-generation dilemma**：

- rFID / PSNR / SSIM / LPIPS 很好的 VAE，不一定讓 diffusion model 生成好。
- 有些 reconstruction 比較差的 VAE，反而有更好的 generation FID。
- reconstruction objective 可能把 latent space 做得太 separated / isolated，讓 diffusion 不容易在 latent space 裡 generalize。

所以這篇想找一個比 rFID 更能預測 gFID 的 VAE / tokenizer metric。

## 核心方法
### 1) iFID：不要只重建原圖，而要測 latent interpolation
對 dataset 中每個 sample：

```text
x_i
  -> encoder -> z_i
  -> find nearest neighbor z_nn in latent space
  -> interpolate z_hat = interpolate(z_i, z_nn)
  -> decoder -> x_hat
  -> compute FID between decoded interpolations and original dataset
```

這就是 **interpolated FID (iFID)**。

直覺是：diffusion model 生成新樣本時，不只是 reconstruct training images，而是會在 training samples 附近的 latent geometry 裡做 interpolation / composition。如果 VAE latent space 的 nearby points 之間不可 interpolatable，diffusion model 就容易 hallucinate 或生成差樣本。

### 2) 為什麼 rFID 會失敗
rFID 測的是：

```text
x -> encode -> decode -> reconstruction
```

它偏好的是 source image 是否可被精確重建。這會鼓勵 latent space 保留很多 sample-specific detail，甚至把不同 samples 的 latent regions 分得很開。

但 diffusion generation 需要的是另一件事：

```text
latent space should be smooth and interpolatable
```

若 latent space 太 fragmented，diffusion model 在 training points 之間走動時，decode 出來的 interpolation 可能不自然。這會讓 generation quality 變差，即使 reconstruction metric 很好。

### 3) ridge set explanation
作者把 iFID 和 diffusion generalization / hallucination 的近期理論連起來：diffusion samples 不一定落在 training points 本身，而是集中在 training samples 附近的 ridge set / interpolation manifold。iFID 剛好測 decode latent interpolations 的品質，因此比 rFID 更接近 diffusion samples 實際會落到的區域。

### 4) interpolation 設計
預設 interpolation strength 是 `alpha = 0.5`，也就是 source latent 和 nearest-neighbor latent 的中點。

作者也測：

- linear interpolation
- spherical interpolation
- random mask interpolation

spherical interpolation 最高，但 linear / mask interpolation 也有強相關，約 0.8。當 `alpha` 從 0 增加到 0.5，iFID 和 rFID 的 correlation 下降，但和 gFID 的 correlation 快速上升；`alpha >= 0.2` 後就有不錯的 gFID correlation。

## Training / Data
這篇不是訓練新生成模型，而是評估不同 VAE / latent tokenizer 對 latent diffusion generation 的影響。

實驗設定：

- Dataset：ImageNet 256x256。
- Diffusion backbone：SiT / diffusion transformer 類設定。
- Sampling：Euler SDE solver，250 steps；CFG scale 在 1.0 到 6.0 搜尋。
- 比較多種 VAE / tokenizer：
  - SD-VAE
  - EQ-VAE
  - VA-VAE
  - SOFT-VQ
  - MAE-TOK
  - DE-TOK
  - DM-VAE
  - RAE

評估 metrics：

- reconstruction metrics：PSNR、SSIM、LPIPS、rFID。
- diffusion / latent metrics：diffusion loss、GMM loss、EQ loss、VF loss。
- proposed metric：iFID。
- target metric：gFID，也就是 diffusion model 最終生成樣本的 FID。

## 主要結果
### 1) rFID 和 gFID 相關弱，甚至可能負相關
作者展示 rFID 對 gFID 不可靠：一些 reconstruction 很好的 VAE 反而讓 diffusion generation 差。PSNR / SSIM / LPIPS 也有類似問題，因為它們都偏向 single-sample reconstruction fidelity，而不是 latent space 的可生成性。

### 2) iFID 和 gFID correlation 約 0.85
iFID 是第一個在多種 VAE 上和 diffusion gFID 強相關的 metric。作者報告 Pearson 和 Spearman correlation 都約 0.85。

這表示 iFID 不只是另一個 reconstruction metric，而是更接近「diffusion model 會在這個 latent space 裡生成什麼品質」。

### 3) latent interpolability 是關鍵
作者的 visualizations 顯示：

- reconstruction-oriented VAE：nearest neighbor 可能語義不同，latent interpolation decode 出來不自然。
- diffusion-oriented VAE：nearest neighbor 語義較接近，latent interpolation decode 後更像有效樣本。

這支持一個實用原則：**好的 diffusion tokenizer / VAE 不只是 reconstruct well，而是 latent space 要 smooth、semantic、interpolatable。**

### 4) 對 foundation-model encoder 的解釋
很多新 VAE / tokenizer 使用 DINOv2、MAE、denoising autoencoder 等 vision foundation representations。作者認為這些 representations 之所以有利於 diffusion generation，是因為它們的 latent space 比 reconstruction-only latent 更 continuous / interpolatable。

## Project relevance
**project-audio-model-evaluation：高相關。**

這篇對 audio evaluation 的直接啟發是：**reconstruction metric 不等於 generation metric**。

Audio codec / VAE / tokenizer 也會有同樣問題：

- codec reconstruction PESQ / STOI / mel loss / FAD 好，不代表後面的 audio diffusion / speech generator 會好。
- 太追求 waveform reconstruction 可能讓 latent space 記很多 sample-specific detail，反而不利於 generative model interpolation。
- 對 TTS / full-duplex generator，latent space 是否可在 speaker、prosody、phoneme、overlap event 之間平滑 interpolation，可能比單純 reconstruction 更重要。

可以設計 audio 版 iFID：

```text
audio clip
  -> audio codec / VAE encoder -> latent
  -> find nearest neighbor in latent space
  -> interpolate latent
  -> decoder -> audio
  -> compute FAD / speaker-FD / ASR-embedding FD / prosody-FD
```

如果 audio-iFID 比 reconstruction FAD 更能預測 downstream generated audio quality，就能用它挑 audio tokenizer / codec。

**project-one-step-audio-generation：中度到高相關。**

one-step audio generator 很依賴 latent representation。如果 latent space 不 interpolatable，one-step model 更難一次從 noise / condition 到 clean audio latent。這篇提醒我們：在做 one-step audio generation 前，應該先評估 codec / VAE 的 **generative latent geometry**，不是只看 reconstruction quality。

**project-tts-data-pipeline：中度相關。**

如果 TTS pipeline 需要選 audio codec、semantic token、prosody token，iFID 類 metric 可用來判斷哪個 representation 更適合後續生成訓練。這比只看 reconstruction WER / mel loss 更貼近下游。

## Related papers in my pool
- [[arxiv_2604_28190|Representation Fréchet Loss]]：FD-loss 是直接把 representation FD 當 training objective；本篇 iFID 是拿 interpolation FD 當 predictor / evaluator。
- [[arxiv_2606_03972|AAD-1]]：one-step generation 路線；本篇提醒 latent tokenizer 的 geometry 會影響生成品質。
- [[arxiv_2605_28063|PlanAudio]]：若做 speech+sound composite generation，audio codec 的 interpolation quality 會影響 mixed audio generation。
- [[arxiv_2606_03116|AnyAudio-Judge]]：rubric judge 可以評估 output correctness；iFID 類 metric 評估 latent representation 是否適合 generation。
- [[arxiv_2603_25750|Sommelier]]：full-duplex data pipeline 產生的 audio representation，可用 iFID 類方法檢查 overlap / backchannel latent 是否可生成。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX source 使用 ICLR 2026 conference template，但截至 2026-06-06 未驗證正式 acceptance / proceedings metadata。

## 我該不該細讀
**建議讀，尤其如果我們要選 audio codec / VAE / tokenizer。**

這篇的核心 takeaway 對 audio 很重要：

> 不要只看 reconstruction；要測 latent space 在 nearest-neighbor interpolation 區域 decode 出來是否仍然自然，因為 generative model 會用到這些區域。

最值得讀：

- iFID 的 definition。
- rFID 為什麼可能和 gFID 負相關。
- ridge set / latent interpolation explanation。
- VAE / tokenizer comparison。

## 可能的弱點 / open questions
1. **iFID 仍是 image / FID setting**  
   audio 版要改成 FAD、speaker embedding FD、ASR embedding FD、prosody embedding FD 等 multi-representation metric，不能直接照搬 Inception FID。

2. **nearest neighbor interpolation 是否適合 speech/audio**  
   speech latent 的 nearest neighbor 可能是不同 speaker / different phoneme / different prosody。audio-iFID 需要控制 speaker、text、duration 或 event type，否則 interpolation 可能沒有語義。

3. **metric 不能直接 optimize**  
   作者明確說 iFID 沒有 straightforward direct minimization。它更像 tokenizer/codec selection metric，不是 FD-loss 那樣直接當 training loss。

4. **conditional generation correctness 沒被涵蓋**  
   即使 latent space interpolatable，也不保證 TTS prompt、transcript、speaker condition 被遵守。audio project 仍要搭配 content / speaker / rubric evaluation。

5. **gFID 本身仍是 image-level target**  
   本篇用 gFID 當 ground truth generation quality。audio 的 ground truth target 應該更複合：WER、speaker similarity、naturalness、event timing、human preference。

## Tags
- `diffusion`
- `evaluation-metrics`
- `latent-space`
- `autoencoder`
- `tokenizer`
- `project-audio-model-evaluation`
- `project-one-step-audio-generation`
- `project-tts-data-pipeline`

## Concepts
- `interpolated FID`
- `reconstruction-generation dilemma`
- `rFID vs gFID`
- `latent interpolation`
- `nearest-neighbor latent interpolation`
- `VAE diffusability`
- `ridge set`
- `latent space interpolability`
- `audio codec evaluation`
- `tokenizer selection`

## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{xu2026makingreconstructionfidpredict,
  title={Making Reconstruction FID Predictive of Diffusion Generation FID},
  author={Tongda Xu and Mingwei He and Shady Abu-Hussein and Jose Miguel Hernandez-Lobato and Chunhang Zheng and Kai Zhao and Chao Zhou and Ya-Qin Zhang and Yan Wang},
  year={2026},
  eprint={2603.05630},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2603.05630}
}
```
