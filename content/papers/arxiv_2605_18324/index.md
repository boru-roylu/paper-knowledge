---
paper_key: arxiv_2605_18324
canonical_id: "arxiv:2605.18324"
title: "Improved Baselines with Representation Autoencoders"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.18324"
pdf_url: "https://arxiv.org/pdf/2605.18324"
status: read
rating: 8.7
tags:
  - diffusion
  - representation-autoencoder
  - latent-space
  - training-efficiency
  - generative-evaluation
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
  - project-one-step-audio-generation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv TeX source `source/main.tex`、`sec/*.tex`、`tables/*.tex` 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2605.18324v1](https://arxiv.org/abs/2605.18324v1)
- arXiv abstract: [https://arxiv.org/abs/2605.18324](https://arxiv.org/abs/2605.18324)
- PDF: [https://arxiv.org/pdf/2605.18324](https://arxiv.org/pdf/2605.18324)
- arXiv source: [https://arxiv.org/src/2605.18324](https://arxiv.org/src/2605.18324)
- Project page: [https://raev2.github.io](https://raev2.github.io)
- Code: [https://github.com/nanovisionx/raev2](https://github.com/nanovisionx/raev2)
- Models: [https://huggingface.co/collections/nyu-visionx/raev2](https://huggingface.co/collections/nyu-visionx/raev2)

## 一句話總結

RAEv2 是一篇 image-side representation autoencoder baseline paper，但它對我們的 speech representation project 很重要：它不只追求 final gFID，而是明確提出 **`EP_FID@k`：達到某個 generation quality 門檻需要多少 training epochs**，把 representation / autoencoder 的好壞改成「多快能讓 downstream generator 學好」來衡量。

## 這篇在解決什麼問題

Representation Autoencoder (RAE) 用 pretrained representation encoder 取代傳統 VAE encoder，希望同一套 tokenization / latent space 同時支援 understanding 和 generation。問題是原始 RAE 還有幾個 practical adoption bottlenecks：

- reconstruction performance 不如 specialized VAE。
- RAE 和傳統 `classifier-free guidance (CFG)` 不相容，常需要額外訓練 weaker model 做 `AutoGuidance (AG)`。
- 先前大多只拿 pretrained encoder 的 final layer feature，忽略不同 layer 的 complementary information。
- 大家常用 final gFID 比較，但實際上 training convergence / compute efficiency 可能更重要。

這篇的核心不是發明完全新模型，而是把 RAE 做成一個更強、更快收斂、更實用的 baseline：**RAEv2**。

## 核心方法

### 1. Generalized Representation Encoder

原始 RAE 通常只使用 pretrained vision encoder 的 final layer feature。RAEv2 認為 pretrained encoder 的不同 layer 有不同資訊：

- later layers：global semantics
- earlier/middle layers：spatial structure / low-level details

因此它把 encoder representation 定義成最後 `K` 層 feature 的聚合，而不是只用 final layer。

兩種 aggregation：

- `MLS`：simple addition，直接把最後 `K` 層 features 相加。
- `MLR`：把最後 `K` 層 concat 後用 fixed random matrix project 回原維度。

實驗顯示 `MLS` 對 generation 更好。這個做法不需要 finetune encoder，也不增加 learned parameters。

### 2. RAE 和 REPA 不是替代關係，而是互補

很多人直覺以為：RAE 已經把 pretrained representation 當 latent encoder，應該不需要再做 `REPA`，因為 REPA 也是把 intermediate diffusion features 對齊到同一個 representation。

這篇發現相反：**RAE + REPA consistently improves generation across encoders**。

作者的解釋：

- RAE 提供 semantically rich latent space。
- REPA 主要改善 intermediate diffusion features 的 spatial self-similarity / token-token structure。
- 因此兩者是 complementary working mechanisms。

他們用 27 個 vision encoders 做 correlation analysis：

- REPA alone：generation quality 更依賴 spatial structure `LDS`，correlation 約 `r=-0.89`。
- RAE alone：更依賴 global semantics / linear probing `LP`，correlation 約 `r=-0.81`。
- RAE + REPA：單一 LP/LDS 都不夠，平均後的 composite metric correlation 最好，約 `r=-0.83`。

這對 speech 很有啟發：一個 speech representation 可能也需要同時評估 content semantics 和 local acoustic / temporal structure。

### 3. REPA head 可以當免費 guidance

原始 RAE 對 CFG 不友善，需要額外訓練 weaker model 做 AutoGuidance。RAEv2 的觀察是：

```text
在 RAE 裡，clean latent x = E(image)
REPA head 其實就是在 predict clean latent x
```

也就是 `REPA is x-prediction in RAE latent space`。

如果把主 DiT output 也 reformulate 成 x-prediction，REPA head 就可以作為 weaker baseline 做 internal guidance：

```text
x_guided = x_full + w * (x_full - x_repa)
```

好處：

- 不用額外訓練 AutoGuidance model。
- 不需要 CFG 那樣額外跑 unconditional forward pass。
- REPA head 在同一次 forward 裡就能提供 guidance。

### 4. Training efficiency metric：EP_FID@k

這是本篇對我們最重要的部分。作者認為 final gFID 的小幅提升對 practical application 訊號有限，training convergence 才更有用，因此提出：

```text
EP_FID@k = epochs needed to reach unguided gFID <= k
```

預設 `k=2`，也就是 `EP_FID@2`。

這個 framing 和我們剛討論的 speech representation project 完全對上：**好的 latent space / representation 應該讓 downstream generator 更早學好，而不是只看最終長訓練結果。**

## Training / Data

主要實驗：

- Dataset：ImageNet-256。
- Backbone：DiT/flow-matching style diffusion transformer，主要使用 DiT^DH-XL。
- Default encoder：DINOv3-L。
- Batch size：1024。
- RAEv2 主結果：80 epochs。

也做了跨任務 generalization：

- Text-to-image：JourneyDB + BLIP3o caption subsets pretraining，BLIP3o-60k finetuning。
- Navigation world model：RECON dataset，action-conditioned future-frame prediction。

重要的是：這不是 speech paper，但它是 **representation -> downstream generator training dynamics** 的強案例。

## 主要結果

### 1. RAEv2 大幅加速 convergence

ImageNet-256：

- RAEv2 `K=7`：80 epochs 達到 guided gFID 1.06。
- `EP_FID@2`：RAEv2 只要 35 epochs。
- 原始 RAE：`EP_FID@2 = 177`。
- REPA-E：`EP_FID@2 = 480`。
- 多個 800-epoch baseline 仍是 `>800`。

也就是 RAEv2 不只是 final score 好，而是 **以更少 training budget 達標**。

### 2. Alternate metric 也強

用 Representation Fréchet Distance `FD_r` 六種 feature spaces 評估：

- RAEv2 `FD_r^6 = 2.17` at 80 epochs。
- 原始 RAE `FD_r^6 = 3.26` at 800 epochs。
- REPA-E `FD_r^6 = 3.04` at 800 epochs。

這表示 RAEv2 不是只 overfit Inception FID，而是在多 representation metrics 上也好。

### 3. Reconstruction-generation trade-off 可以用 K 控制

RAEv2 generalized formulation 可以用最後 `K` 層控制 reconstruction vs generation：

- `K=7`：best generation，80 epochs gFID 1.65，rFID 0.29。
- `K=23`：best reconstruction，rFID 0.18，PSNR 27.03，但 gFID 3.02。

這點很重要：**reconstruction 最好不等於 generation 最好**，和 [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/) 的 thesis 一致。

### 4. Stronger encoders 在 RAEv2 recipe 下更有用

20 epochs gFID：

- DINOv3-L：RAE 3.30，RAEv2 2.61。
- DINOv2-B：RAE 3.75，RAEv2 2.81。
- DINOv3-B：RAE 4.25，RAEv2 2.76。

RAEv2 更能發揮 global semantics + spatial structure 都強的 encoder。

### 5. T2I 和 world model 也改善

Text-to-image：

- Pretraining GenEval：Flux-VAE 41.7，RAE 58.4，RAEv2 62.4。
- Finetuning GenEval：Flux-VAE 78.3，RAE 81.5，RAEv2 82.7。

Navigation world model on RECON：

- DIAMOND FVD 762.73。
- NWM FVD 200.97。
- RAE FVD 312.01。
- RAEv2 FVD 105.61。

RAEv2-NWM 也更快收斂：約 30K steps 到 FID 7.5 / LPIPS 0.24，而 RAE 是 FID 18.0 / LPIPS 0.29。

## Project relevance

### 對 `project-generative-speech-representation-evaluation`

這篇是高度相關，雖然它是 image paper。原因是它直接回答我們剛提出的問題：

> representation 好不好，不只看 final quality；更要看 downstream generator 要花多少 compute 才學好。

可以直接借三個概念到 speech：

1. **EP_metric@k**

把 `EP_FID@2` 改成 speech 版：

```text
EP_WER@x      = steps/GPU-hours to reach WER <= x
EP_SIM@y      = steps/GPU-hours to reach speaker similarity >= y
EP_UTMOS@z    = steps/GPU-hours to reach UTMOS >= z
EP_Event@r    = steps/GPU-hours to reach overlap/backchannel recall >= r
```

2. **Representation property -> generation speed correlation**

RAEv2 用 `LP` / `LDS` 分析 global semantics 和 spatial structure。Speech 可以改成：

- content semantics：ASR / phoneme / SSL probing
- speaker structure：speaker verification embedding
- temporal structure：duration / rhythm / F0 continuity
- event structure：backchannel / overlap / silence boundary detection

3. **reconstruction-generation trade-off control**

RAEv2 的 `K` sweep 顯示 reconstruction 最佳點和 generation 最佳點不同。Speech VAE / codec / VoxCPM AudioVAE V2 也應該測：

```text
best reconstruction setting
  vs
fastest downstream TTS setting
  vs
best final generation setting
```

這能讓 project 從 audio-iFID 擴展成 **learnability / compute-to-quality evaluation**。

### 對 `project-audio-model-evaluation`

這篇提醒我們：evaluation 不能只看 final output score。還應該把 **training efficiency curve** 當成 evaluator：

```text
quality vs epochs / tokens / GPU-hours
```

對 audio generation 來說，這可以避免選到「最後能訓練好，但前期非常難學」的 representation。

### 對 `project-one-step-audio-generation`

one-step / few-step generator 對 latent representation 更敏感。RAEv2 顯示 representation choice 和 training recipe 可以讓 diffusion model 早很多學到好 generator。對 speech one-step generator，應該把 codec/VAE 的 learnability 放在訓練前先評估。

## Related papers in my pool

- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：iFID paper；兩篇都在說 reconstruction metric 不足，但 RAEv2 更進一步把 focus 放到 training efficiency。
- [Representation Fréchet Loss](../arxiv_2604_28190/)：用 representation FD 當 training objective；RAEv2 用 FD_r 作為 alternate evaluation metric，兩者可以一起啟發 speech representation metrics。
- [Reconstruction vs. Generation](../arxiv_2501_01423/)：VA-VAE / VF Loss；同樣關心 tokenizer / VAE latent space 的 reconstruction-generation trade-off。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2 tool note](../../tools/openbmb-voxcpm/)：speech-side tokenizer-free / continuous latent candidate；可用 RAEv2 的 `EP_metric@k` 思路評估 AudioVAE V2 latent 是否更容易學。
- [SLED](../arxiv_2505_13181/)：continuous latent speech LM；可測 continuous latent 是否帶來 faster downstream convergence。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議細讀，尤其是因為它剛好支持我們新的 project framing：**Generative Speech Representation Evaluation 應該衡量 learnability / compute-to-quality，而不只是 reconstruction 或 final score。**

最值得讀：

- Generalized RAE：最後 `K` 層 aggregation。
- RAE + REPA 的 complementary mechanism。
- `EP_FID@k` training efficiency metric。
- `K` sweep 的 reconstruction vs generation trade-off。
- T2I / world model generalization，因為它證明這不只是 ImageNet trick。

## 可能的弱點 / open questions

- 這仍是 image/video-side evidence，speech/audio 的 content、speaker、prosody、event timing 需要不同 metrics。
- `EP_FID@k` 用 epochs 衡量，但不同 audio models 的 batch size、sample length、codec frame rate、decoder cost 差很多；speech 版應該用 GPU-hours / tokens seen / audio-hours seen。
- RAEv2 依賴 pretrained vision encoders 的 layer aggregation；speech encoder layers 是否能用同樣方式聚合，需要實驗。
- RAE + REPA 的 LP/LDS analysis 在 speech 裡要重新定義：什麼是 speech 的 global semantics？什麼是 local temporal/acoustic structure？
- REPA-head guidance 是否能轉到 speech latent diffusion，需要看 speech latent 的 x-prediction 是否穩定。
- `K=23` reconstruction 最好但 generation 較差，提醒我們 speech VAE 如果只追求 PESQ/STOI/FAD，也可能犧牲 downstream learnability。

## Tags

#diffusion #representation-autoencoder #latent-space #training-efficiency #generative-evaluation #reconstruction-generation-tradeoff #project-generative-speech-representation-evaluation #project-audio-model-evaluation #project-one-step-audio-generation

## Concepts

- Representation Autoencoder
- RAEv2
- REPA
- x-prediction
- internal guidance
- AutoGuidance
- classifier-free guidance
- EP_FID@k
- training efficiency
- reconstruction-generation trade-off
- generalized representation encoder
- multi-layer feature aggregation
- FD_r
- learnability
- generative speech representation evaluation

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{singh2026improvedbaselineswithrepresent,
  title={Improved Baselines with Representation Autoencoders},
  author={Jaskirat Singh and Boyang Zheng and Zongze Wu and Richard Zhang and Eli Shechtman and Saining Xie},
  year={2026},
  eprint={2605.18324},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2605.18324}
}
```
