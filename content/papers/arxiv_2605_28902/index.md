---
paper_key: arxiv_2605_28902
canonical_id: "arxiv:2605.28902"
title: "Orthogonal Concept Erasure for Diffusion Models"
year: 2026
venue: "ICML 2026 / arXiv preprint"
url: "https://arxiv.org/abs/2605.28902"
pdf_url: "https://arxiv.org/pdf/2605.28902"
status: read
rating: 7.2
tags:
  - diffusion
  - concept-erasure
  - model-editing
  - safety
  - text-to-image
  - orthogonal-transform
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`example_paper.tex`). This is a visual diffusion / model safety paper, not a speech paper; it is included as general generative-model editing context.

## Links

- [Original arXiv abstract](https://arxiv.org/abs/2605.28902)
- [PDF](https://arxiv.org/pdf/2605.28902)
- [arXiv source](https://arxiv.org/src/2605.28902)
- [Official GitHub repo](https://github.com/HansSunY/OCE)

## 一句話總結

OCE 把 diffusion model 的 concept erasure 從常見的 **additive weight update** 改寫成 **layer-wise orthogonal transformation**：直接旋轉 neuron directions 來抹除 target concept，同時保留 neuron magnitudes 和 inter-neuron angular geometry，以降低對 non-target concepts 和整體生成能力的破壞。

## 這篇在解決什麼問題

Text-to-image diffusion models 可能生成 unsafe、copyrighted、offensive、identity-related 或 privacy-sensitive content，因此需要 concept erasure / unlearning。

現有方法大致分三類：

- inference-time intervention：改 sampling trajectory / guidance，但容易被 bypass。
- training-based erasure：fine-tune model 以移除 target concept，效果可以好，但成本高、不易大規模 multi-concept。
- editing-based erasure：直接用 closed-form 或低成本方式改 cross-attention / projection weights，部署友善，但常在 target erasure 和 non-target preservation 之間 trade off 不好。

作者認為 editing-based 方法的核心問題是：多數方法用 **additive parameter update**：

```text
W* = W + Delta
```

這會同時改變：

- neuron direction；
- neuron magnitude；
- inter-neuron angular geometry。

但 paper 的 toy experiment 顯示，concept semantics 主要跟 **neuron direction** 有關，而整體 generation quality 很依賴 **angular geometry**。所以 additive update 會把真正有用的 direction edit 和有害的 magnitude / geometry perturbation 混在一起。

## 核心方法

### 1) Geometry observation：direction matters, magnitude mostly does not

作者在 cross-attention key/value projection matrices 上做三個 controlled transformations：

1. **Magnitude-only scaling**  
   把 weights 乘上一個 scalar，例如 `alpha = 0.5`。結果對 `cat` concept generation 幾乎沒影響。

2. **Neuron-wise orthogonal rotation**  
   每個 neuron 各自旋轉。這保留 magnitude，但破壞 inter-neuron angular geometry，結果整體 image quality 明顯變差。

3. **Layer-wise orthogonal rotation**  
   整層共用一個 orthogonal matrix。這會改變 neuron directions，但保留 magnitude 和 pairwise angles，能造成明顯 semantic shift。

因此作者提出兩個 claim：

- concept semantics more strongly associate with neuron directions than magnitudes。
- preserving inter-neuron angular geometry is critical for overall generation quality。

### 2) From additive update to orthogonal update

OCE 改用 multiplicative layer-wise orthogonal update：

```text
W* = P W
P^T P = I
```

這樣：

- 每個 neuron magnitude 不變；
- pairwise inter-neuron angles 不變；
- 但 neuron directions 可以被整體旋轉，達到 concept erasure。

### 3) Closed-form orthogonal erasure

對 vector-wise objective，作者把 erasure 和 retain constraints stack 成：

```text
A = [W C_1, W C_0]
B = [W C_*, W C_0]
min || P A - B ||_F^2
subject to P^T P = I
```

這是 classical **orthogonal Procrustes problem**。令：

```text
M = B A^T
M = U Sigma V^T
P = U V^T
```

因此可以 closed-form 求出 orthogonal transformation，不需要 iterative fine-tuning。

其中：

- `C_1`：target concepts to erase。
- `C_*`：anchor concepts，target 被 map 到的 surrogate / neighbor concept。
- `C_0`：retain concepts。
- `K_0`：global preservation prior，由 COCO-30K token embeddings 預先計算，可重複使用。

### 4) Subspace-level objective for multi-concept erasure

多 concept erasure 時，如果每個 target 都做 vector-wise exact alignment，constraints 容易彼此衝突。OCE 因此把 erasure 從 vector-wise alignment 提升到 **subspace-level suppression**：

- target concepts 形成 target subspace。
- anchor concepts 形成 anchor subspace。
- erasure 目標是讓 transformed target subspace 避開 anchor orthogonal complement。
- preservation 仍用 vector-wise constraints，因為 retain concepts 需要更細粒度保留。

作者稱這是 asymmetric design：

```text
erasure: subspace-level
preservation: vector-wise
```

ablation 顯示這個組合比 vector/vector 或 subspace/subspace 更好。

## Training / Data

這篇不是 training-heavy paper，而是 editing-based method。主要 setup：

- base model：Stable Diffusion v1.4。
- extension：FLUX.1 dev / DiT-based model，因 DiT 沒有明確 cross-attention layers，作者依 UCE 做法 edit MMDiT 的 specific embedding layers。
- baselines：CA、ESD、FMN、UCE、MACE、RECE、SPEED，以及 implicit/adversarial erasure 設定中的 CPE、AdvUnlearn、RACE、Receler、STEREO、EraseFlow 等。
- tasks：
  - object erasure：CIFAR-10 classes。
  - artistic style erasure：Van Gogh、Monet、Picasso。
  - multi-concept celebrity erasure：10 / 50 / 100 celebrities。
  - implicit concept erasure：I2P、Ring-A-Bell、MMA-Diffusion 等。
- metrics：
  - `Acc_e`：target concept detection accuracy，越低代表 erasure 越好。
  - `Acc_s` / `Acc_r`：non-target / retain accuracy，越高越好。
  - `H_o`：erasure-preservation harmonic score。
  - CLIP Score / FID：評估 style erasure 和 MSCOCO preservation。
  - time：multi-concept editing runtime。

## 主要結果

### Object erasure

在 CIFAR-10 前五個 class 的平均上，OCE 的 target accuracy `Acc_e` 降到 **4.61**，比 MACE 的 8.32 更低；同時 preservation `Acc_s` 約 **98.68**，幾乎維持原模型的 non-target generation ability。平均 `H_o` 達 **97.01**，是表中最高。

### Artistic style erasure

OCE 在 Van Gogh / Picasso / Monet style erasure 上能保持有效 erasure，同時 MSCOCO FID 和 CLIP score preservation 較穩。作者的重點是：有些方法 erase 很強但破壞整體 generation quality；OCE 的 trade-off 較平衡。

### Multi-concept celebrity erasure

OCE 在 erase 10 / 50 / 100 celebrities 上都維持高 `H_o`：

- erase 10：`H_o = 98.14`
- erase 50：`H_o = 96.62`
- erase 100：`H_o = 95.48`

在 erase 100 celebrities 時，OCE runtime 是 **4.3 s** on a single A100 GPU，且 retain accuracy 仍有 **94.42**。這是 paper 最強的賣點：multi-concept erasure scale up 時，OCE 比許多 training-based 或 complex pipeline 更實用。

### Implicit concept erasure / adversarial attacks

在 I2P、MMA-Diffusion、Ring-A-Bell 等 implicit / adversarial setup 中，OCE without adversarial training 已有不錯 trade-off；加入 adversarial editing 後，OCE w/ AT 在 MMA / Ring-A-Bell 上可降到接近 0，同時保持相對合理的 COCO preservation。

### DiT / FLUX transfer

OCE 也在 FLUX.1 dev 上展示 object erasure、style erasure、celebrity erasure、implicit concept erasure 的 qualitative results，說明不只限於 U-Net cross-attention diffusion。

### Ablations

- subspace-level erasure + vector-wise preservation 的 asymmetric design 最好。
- global preservation prior `K_0` 越完整，erasure-preservation trade-off 越好。
- `K_0` offline precompute 約 3 秒 on A100。

## Project relevance

### 對我們 speech / TTS 主線的直接相關性：低

這篇不是 speech/audio/TTS paper，也不處理 ASR、diarization、overlap、full-duplex 或 audio generation evaluation。它不應該被當成 TTS data pipeline 的核心 paper。

### 可借鑑的地方

它對 general generative model safety / controllability 有幾個可借的想法：

1. **Preserve global capability while editing local concept behavior**  
   這和 audio generator 的 safety / style control 類似：如果要移除某種 voice style、speaker identity、unsafe sound event 或 unwanted prosody，不希望破壞一般 speech quality。

2. **Direction vs magnitude / geometry 的 framing**  
   對 audio latent / codec-token generator，也可能存在類似問題：某些 semantic / speaker / emotion concept 可能主要在 representation direction，而非 activation magnitude。

3. **Subspace-level suppression for multiple concepts**  
   如果未來要從 speech model 移除多個 speaker identities、unsafe events、watermark-like artifacts 或 prompt-injection acoustic patterns，vector-wise exact removal 可能衝突；subspace-level objective 可能更穩。

4. **Evaluation 要同時看 erasure 和 preservation**  
   對 audio safety editing，不能只看 target 被抹除，也要看 WER、speaker similarity、naturalness、prosody、background event fidelity 是否保留。

## Related papers in my pool

- [[arxiv_2604_28190|Representation Fréchet Loss]]：都關心 representation-space distribution / geometry，只是 OCE 是 model editing，FD-loss 是 generator training objective。
- [[arxiv_2603_05630|Making Reconstruction FID Predictive of Diffusion Generation FID]]：都提示 latent / representation geometry 對 generation quality 很重要。
- [[arxiv_2501_01423|Reconstruction vs. Generation]]：VA-VAE / VF Loss 也是從 latent geometry 角度改善 generation suitability。
- [[arxiv_2606_03972|AAD-1]]：同屬 visual generation / diffusion line，但 AAD-1 關心 one-step generation，OCE 關心安全 concept erasure。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

**只需要選讀。**

如果當前重點是 full-duplex audio、TTS data pipeline、audio judge / FlashTrace grounding，這篇不是優先 paper。但如果你想建立「generative model editing / safety / concept suppression」的旁支，或思考未來 speech generator 如何移除 unwanted voice identity / unsafe audio concepts，這篇值得看 geometric formulation 和 evaluation protocol。

建議讀：

- Sec. 3：direction / magnitude / angular geometry toy experiment。
- Sec. 5：orthogonal Procrustes closed-form solution。
- Multi-concept erasure setup：特別是 subspace-level erasure + vector-wise preservation。

## 可能的弱點 / open questions

1. **anchor concept selection 仍然重要**  
   Paper 使用 heuristic 選 anchor concepts。若 anchor 選不好，target erasure 可能變成不自然的 intermediate semantic region。

2. **subspace erasure 可能不夠 fine-grained**  
   作者自己提到，subspace-level constraints 可能讓 output 落到 intermediate semantic regions，而不是精準 map 到 fine-grained anchor。

3. **SVD/subspace computation 對更大模型仍有 overhead**  
   雖然 100 concepts 可 4.3 秒，但更大 diffusion backbone 或更大 edited layers 可能增加成本。

4. **implicit / compositional / relational concepts 仍難**  
   作者明確說更 implicit 的 relational、compositional understanding 或 watermark erasure 還需要更多研究。

5. **安全 erasure 是否 robust to adaptive attacks 不完全解決**  
   OCE w/ adversarial editing 可以改善某些 benchmark，但 real adversarial prompt / jailbreak robustness 仍需更廣泛測試。

## Tags

- `diffusion`
- `concept-erasure`
- `model-editing`
- `safety`
- `text-to-image`
- `orthogonal-transform`

## Concepts

- `concept erasure`
- `orthogonal Procrustes`
- `layer-wise orthogonal transformation`
- `additive vs multiplicative editing`
- `angular geometry`
- `subspace-level suppression`
- `global preservation prior`
- `multi-concept erasure`

## Citation

```bibtex
@misc{sun2026orthogonalconcepterasurefordif,
  title={Orthogonal Concept Erasure for Diffusion Models},
  author={Yuhao Sun and Lingyun Yu and Haoxiang Xu and Fengyuan Miao and Zhuoer Xu and Hongtao Xie},
  year={2026},
  eprint={2605.28902},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  doi={10.48550/arXiv.2605.28902}
}
```
