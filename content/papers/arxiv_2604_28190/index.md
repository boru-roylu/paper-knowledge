---
paper_key: arxiv_2604_28190
canonical_id: "arxiv:2604.28190"
title: "Representation Fréchet Loss for Visual Generation"
year: 2026
venue: "arXiv preprint / NeurIPS 2026 preprint style"
url: "https://arxiv.org/abs/2604.28190"
pdf_url: "https://arxiv.org/pdf/2604.28190"
status: read
rating: 8
tags:
  - visual-generation
  - one-step-generation
  - diffusion-distillation
  - distribution-matching
  - evaluation-metrics
  - project-one-step-audio-generation
  - project-audio-model-evaluation
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`neurips_2026.tex` and `sections/*.tex`). This is a visual generation paper, included because FD-loss is directly relevant to one-step audio generation as a distribution-level post-training objective.

## Links
- [Original URL](https://arxiv.org/abs/2604.28190)
- [arXiv abstract](https://arxiv.org/abs/2604.28190)
- [PDF](https://arxiv.org/pdf/2604.28190)
- [arXiv source](https://arxiv.org/src/2604.28190)
- [Official GitHub repo](https://github.com/Jiawei-Yang/FD-loss)
- [Hugging Face checkpoints](https://huggingface.co/jjiaweiyang/FD-Loss)

## 一句話總結
這篇把 **Fréchet Distance / FID** 從 evaluation metric 變成可訓練的 **FD-loss**：用大 population 估計 generated distribution 的 mean/covariance，但只對當前 mini-batch 回傳 gradient，讓 generator 可以直接最小化 representation-space distribution mismatch；結果不只改善 one-step generators，還能把 multi-step generators 直接 post-train 成 strong one-step generators，不需要 teacher distillation、GAN 或 per-sample targets。

## 這篇在解決什麼問題
FID 長期是 image generation 的核心評估指標，但它通常只用來 evaluation，不直接當 loss。原因是 FD 是 distributional quantity：要穩定估計 generated distribution 的 mean 和 covariance，需要像 50k 這種大 population；如果每個 training step 都要對 50k samples backprop，成本不可行。

作者指出這裡有一個被混在一起的假設：

```text
population size for FD estimation
  does not need to equal
batch size for gradient computation
```

所以這篇想回答三個問題：

1. FD / FID 能不能直接當 training objective？
2. 如果可以，它能不能改善 one-step generator？
3. 如果用不同 representation space 做 FD，會不會揭露 FID 本身的盲點？

## 核心方法
### 1) FD-loss：把 population scale 和 optimization scale 解耦
FD 在 representation space 裡比較 real images 和 generated images 的 Gaussian statistics：

```text
FD = mean mismatch + covariance mismatch
```

問題是 generated statistics 需要大 population。作者提出兩種做法：

**Queue-based estimator**

- 保留一個 generated feature queue，例如 50k 或 100k samples。
- 每一步 generator 只產生 batch `B`，例如 1024。
- 新 batch 的 features 進 queue，舊 features 出 queue。
- FD 用整個 queue 的 mean/covariance 估計。
- 但 gradient 只回傳到當前 batch；queue 裡舊 features treated as constants。

**EMA-based estimator**

- 不存整個 feature queue。
- 維護 generated features 的 first moment 和 second moment EMA。
- 每個 batch 更新 EMA statistics。
- 用 EMA mean/covariance 算 FD-loss。
- gradient 仍然只回傳到當前 batch。

作者最後偏好 EMA，因為更省 memory，也更 on-policy。實驗中 `beta = 0.999` 是主要設定。

### 2) Multi-representation FD-loss
FID 只用 Inception feature space。作者認為這已經太窄，因為現代生成模型可能在 Inception FID 上很好，但人眼仍然能看出與 real images 的差距。

所以 FD-loss 可以用不同 frozen representation models：

- Inception-v3
- ConvNeXt-v2
- DINOv2
- MAE
- SigLIP2
- CLIP

多個 representation 的 FD raw scale 不同，因此作者把每個 FD term normalize 成 unit-scale，再加總。預設重要組合是 **SIM = SigLIP + Inception + MAE**。

### 3) 用 FD-loss post-train one-step generator
第一個用途是改善既有 one-step generator，例如：

- pMF：pixel-space MeanFlow
- iMF：latent-space improved MeanFlow

這裡 FD-loss 是 post-training objective：從 pretrained generator 出發，直接讓 generated distribution 靠近 real distribution 的 frozen representation statistics。

### 4) 把 multi-step generator repurpose 成 one-step generator
更有趣的是第二個用途：對 JiT / SD3.5 這類 multi-step generator，作者直接把它當 one-step model 使用：

```text
Gaussian noise
  -> run model once at terminal timestep
  -> interpret output as clean image prediction
  -> optimize FD-loss
```

naive one-step 會很差，例如 JiT-L one-step FID 約 291.59。但 FD-loss post-training 後，可以變成可用的一步生成器。這裡沒有 teacher distillation、沒有 adversarial loss、沒有 per-sample regression target，只有 distribution-level FD objective。

### 5) FDr^K：multi-representation evaluation metric
作者也提出 `FDr^K`，不是只看 raw FID，而是對每個 representation 算 normalized FD ratio：

```text
FDr_phi(generated) =
  FD_phi(generated, train)
  /
  FD_phi(validation, train)
```

validation images by definition 是 1.0。若 generated images 在某 feature space 的 FDr 是 2.0，表示它離 train distribution 是 validation set 的兩倍。`FDr^6` 則平均六個 representation spaces。

這個設計用來避免單一 Inception FID 飽和或 misrank。

## Training / Data
主要實驗是 ImageNet-1k class-conditional image generation：

- Resolution：256x256 和 512x512。
- Generators：pMF、iMF、JiT。
- 訓練方式：從 official pretrained weights 出發做 post-training。
- Batch size：1024。
- Optimizer：AdamW + cosine learning-rate schedule + 5 epochs warmup。
- Learning rate：
  - pMF / iMF：`1e-6`
  - JiT：`1e-5`
- Ablation：50 epochs。
- System-level results：100 epochs。
- Metrics：FID、IS、FDr^6。
- Evaluation：50k generated images vs ImageNet training set statistics。

Text-to-image extension：

- 用 Stable Diffusion 3.5 Medium 的 2.5B MMDiT。
- 把 multi-step latent denoiser repurpose 成 1-NFE text-to-image generator。
- 使用 SIM representation set。

## 主要結果
### 1) population size 不能太小，也不能太 stale
如果只用 current batch statistics，效果會變差：

- pMF-B base FID：3.31
- batch-only FD-loss FID：3.84
- base FDr^6：13.70
- batch-only FDr^6：17.06

queue size 提高到 50k 時效果好，FID 到 0.89；但 queue 太大例如 500k 會 stale，FID 和 FDr^6 甚至開始 disagree。EMA `beta = 0.999` 達到 FID 0.81 / FDr^6 10.81，且 memory 更省。

### 2) Inception FD-loss 可以衝低 FID，但不一定最好看
不同 representation 的 FD-loss 會優化不同 perceptual aspects：

- Inception：FID 最低。
- ConvNeXt / DINOv2 / MAE / SigLIP：可能讓 Inception FID 變差，但視覺結構和 FDr^6 更好。
- SIM：在 FID 和 broader perceptual quality 之間比較均衡。

這是重要結論：**FID 當 loss 有用，但只用 Inception space 會把模型推向 Inception 的偏好，不一定是人眼最好。**

### 3) one-step generator 可以到 0.72 FID
在 ImageNet 256x256，FD-Inception post-training 可以讓多個 generator family 達到非常低的 FID：

- pMF-H + FD-Inception：FID 0.72。
- iMF-XL + FD-Inception：FID 0.72。
- JiT-H + FD-Inception：FID 0.72。

但作者也用 FDr^6 / human preference 強調：FID 0.72 不代表 generation 已經解決。

### 4) multi-step JiT 可以被 repurpose 成 one-step
JiT-L：

- original 50-step：FID 2.59，FDr^6 10.73。
- naive 1-step：FID 291.59，FDr^6 214.75。
- FD-SIM 1-step post-training：FID 0.85，FDr^6 3.29。

這是對 one-step generation 最關鍵的結果：**不用 teacher、GAN、per-sample target，只靠 representation-space distribution matching，就能把 multi-step generator 變成 one-step generator。**

### 5) human preference 仍提醒自動指標不夠
Human preference study 顯示 FD-loss post-trained models 比 base models 更受偏好，但最強 generator 仍然輸給 real validation images。這支持作者的觀點：FID 低到超過 validation images 不代表視覺生成已經解決。

## Project relevance
**project-one-step-audio-generation：高相關。**

這篇和 AAD-1 很互補：

- AAD-1：用 DMD warmup + asymmetric adversarial full-sequence discriminator。
- FD-loss：用 representation-space distributional loss，不需要 teacher distillation 或 adversarial training。

對 one-step audio generation，FD-loss 提供另一條可能更簡單的路：

```text
real audio dataset
  -> frozen audio representation model
  -> precompute real feature mean/covariance

one-step audio generator
  -> generate batch
  -> extract frozen audio features
  -> update generated feature EMA/queue
  -> optimize audio FD-loss
```

可能的 audio representation spaces：

- speaker embedding：檢查 speaker identity distribution。
- ASR / speech encoder embedding：檢查 linguistic content / phonetic structure。
- emotion / prosody encoder：檢查 style distribution。
- CLAP / audio-text embedding：檢查 semantic audio-event distribution。
- codec-token / SSL speech representation：檢查 acoustic manifold。

對 full-duplex / dialogue audio，還可以做多層 FD-loss：

- single-speaker channel A distribution
- single-speaker channel B distribution
- mixture A+B distribution
- overlap-region distribution
- backchannel / short utterance distribution

這和我們的 mixture-consistent multi-loss idea 可以接起來：除了 waveform/latent reconstruction，也用 representation FD 約束 generated A/B/mix 的整體分布。

**project-audio-model-evaluation：高相關。**

作者的 FDr^K 很適合借到 audio evaluation。單一 FAD / CLAP score / ASR WER 都可能 misrank。audio 版本可以做：

```text
FDr_audio^K =
  average normalized FD ratio across
  speaker, content, prosody, acoustic, semantic audio representations
```

這可以作為 AnyAudio-Judge 之外的 distribution-level metric，特別適合比較 generator checkpoint / data recipe。

**project-tts-data-pipeline：中度相關。**

FD-loss 可以用來檢查或優化清理後資料和生成資料的 distribution match。例如不同 data cleaning threshold / corpus mixture 產生的 generated TTS distribution，是否更接近 high-quality real speech statistics。

## Related papers in my pool
- [[arxiv_2606_03972|AAD-1]]：另一條 one-step 路線，依靠 asymmetric adversarial distillation；FD-loss 是 non-adversarial distributional objective。
- [[arxiv_2605_28063|PlanAudio]]：若要 one-step composite audio，FD-loss 可以用 audio event / speech+sound representation 做 distribution matching。
- [[arxiv_2606_03116|AnyAudio-Judge]]：rubric-level correctness；FD-loss / FDr_audio^K 則補上 distribution-level quality。
- [[arxiv_2603_25750|Sommelier]]：可提供 long-form / full-duplex real audio statistics。
- [[arxiv_2604_09344|DialogueSidon]]：可提供 recovered dual-channel A/B/mix distribution，供 one-step full-duplex generator 做 FD-loss。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX source 使用 NeurIPS 2026 preprint style，但截至 2026-06-06 未驗證正式 acceptance / proceedings metadata。

## 我該不該細讀
**建議細讀。**

如果我們要做 one-step audio generation，這篇比一般 image generation paper 更值得讀，因為它提出一個很可實作的 principle：**不要只想 teacher distillation / GAN；也可以直接用 frozen representation statistics 做 distribution-level post-training。**

最值得讀的部分：

- FD-loss queue / EMA estimator。
- multi-representation loss normalization。
- multi-step -> one-step repurposing。
- FDr^K 的 normalized evaluation design。

## 可能的弱點 / open questions
1. **Gaussian moment matching 假設有限**  
   FD 只對 mean/covariance 建模，無法捕捉所有 multimodal structure。audio 裡 phoneme / speaker / emotion / event distribution 更複雜，單靠 Gaussian FD 可能不夠。

2. **representation choice 決定 objective bias**  
   Inception FD-loss 會優化 Inception preference；audio 也會一樣。選錯 audio encoder 可能讓模型變得分數好但聽感差。

3. **需要大量 generated samples / stable statistics**  
   雖然 EMA/queue 解決了 backprop 成本，但仍要穩定維護 generated feature statistics。audio generation 較慢時，這可能是瓶頸。

4. **distribution match 不保證 conditional correctness**  
   FD-loss 可以讓整體分布像 real data，但不一定保證 prompt / transcript / speaker condition 被遵守。audio 版本必須搭配 conditional losses、ASR/content loss、rubric judge 或 per-sample alignment。

5. **one-step audio 的 temporal errors 可能比 image 更敏感**  
   影像樣本彼此獨立；audio 是長序列。若只用 clip-level features，可能漏掉 fine timing、phoneme boundary、overlap onset、backchannel duration 等問題。

## Tags
- `visual-generation`
- `one-step-generation`
- `diffusion-distillation`
- `distribution-matching`
- `evaluation-metrics`
- `project-one-step-audio-generation`
- `project-audio-model-evaluation`

## Concepts
- `FD-loss`
- `Fréchet Distance as training loss`
- `population-batch decoupling`
- `queue-based feature statistics`
- `EMA feature statistics`
- `multi-representation distribution matching`
- `FDr^K`
- `one-step generator post-training`
- `multi-step to one-step repurposing`
- `representation-space objective`
- `FID saturation`

## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{yang2026representationfrchetlossforvis,
  title={Representation Fréchet Loss for Visual Generation},
  author={Jiawei Yang and Zhengyang Geng and Xuan Ju and Yonglong Tian and Yue Wang},
  year={2026},
  eprint={2604.28190},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2604.28190}
}
```
