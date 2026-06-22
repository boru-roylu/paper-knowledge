---
paper_key: arxiv_2511_13019
canonical_id: "arxiv:2511.13019"
title: "MeanFlow Transformers with Representation Autoencoders"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2511.13019"
pdf_url: "https://arxiv.org/pdf/2511.13019"
status: read
rating: 0
tags:
  - meanflow
  - representation-autoencoder
  - one-step-generation
  - few-step-generation
  - diffusion-transformer
  - project-one-step-audio-generation
  - project-generative-speech-representation-evaluation
created: 2026-06-22
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`) and the official GitHub repository. This is an image-generation paper, but it is included because it directly connects **MeanFlow / one-step generation** with **Representation Autoencoders (RAE)**, which is relevant to one-step audio generation and generative speech representation evaluation.

## Links

- [Original URL](https://arxiv.org/abs/2511.13019)
- [arXiv abstract](https://arxiv.org/abs/2511.13019)
- [PDF](https://arxiv.org/pdf/2511.13019)
- [arXiv source](https://arxiv.org/src/2511.13019)
- [Official GitHub repo](https://github.com/sony/mf-rae)
- [OpenReview forum](https://openreview.net/forum?id=JIzA7lK0Cv)

## 一句話總結

這篇把 **MeanFlow (MF)** 放到 **Representation Autoencoder (RAE)** latent space 裡，解決 vanilla MF 在 SD-VAE latent 上訓練昂貴、guidance hyperparameter 複雜、decoder cost 很高的問題；核心 recipe 是 **RAE latent + DiT-DH architecture + Consistency Mid-Training (CMT) initialization + MeanFlow Distillation (MFD) + optional MFT bootstrapping**，在 ImageNet 256 做到 1-step FID 2.03，同時比 vanilla MF 降低 83% total training cost、38% sampling GFLOPS。

## 這篇在解決什麼問題

MeanFlow / flow map model 的目標是直接學 PF-ODE trajectory 的 long jump，讓模型可以用 1-step 或 few-step 從 noise 生成 data。問題是實作上 vanilla MF 還是很貴：

- **training cost 高**：vanilla MF 在 ImageNet 256 需要 600+ H100 GPU-days。
- **JVP cost / instability**：MF loss 需要 Jacobian-vector product，對 modern transformer / FlashAttention 也不方便。
- **class-conditional guidance 很麻煩**：vanilla MF 需要 CFG scale、triggering interval、mixing scale 等多個 hyperparameters。
- **SD-VAE decoder 變成 inference bottleneck**：ImageNet 256 下，DiT/SiT 約 114 GFLOPS，但 SD-VAE decoder 約 310 GFLOPS，約 73% compute 花在 decoder。

RAE 的出發點是用 frozen pretrained representation encoder，例如 DINO / DINOv2 / SigLIP2，加上一個 lightweight ViT decoder，取代傳統 SD-VAE。對普通多步 diffusion 來說，RAE decoder 省下的 compute 可能被多步 ODE solve 淹沒；但對 1-step / few-step MF 來說，decoder cost 會變成主要項目，因此 RAE 的 efficient decoder 特別有價值。

## 核心方法

### 1. 在 RAE latent space 裡做 MeanFlow

RAE latent 來自 pretrained visual representation encoder，semantic-rich 且 high-dimensional。作者沿用 RAE paper 的 DiT-DH backbone，並加入額外的 `t-s` time-difference embedding：

```text
class label embedding + time t embedding + time difference (t-s) embedding
  -> DiT-DH MeanFlow transformer
```

這對 MF 很重要，因為 MF 不是只預測某個 time t 的 velocity，而是要學從 t 到 s 的 trajectory jump。

### 2. CMT initialization：先學 trajectory-aware long jumps

作者發現 naive MF training in RAE latent space 會 gradient explosion。random initialization 和直接從 flow matching teacher initialization 都不穩；XL 模型幾乎立刻 divergence，小模型也只在初期穩定，最後 loss 爆掉，best 1-step FID 還大於 20。

解法是用 **Consistency Mid-Training (CMT)** 做 trajectory-aware initialization：

```text
pretrained flow matching teacher
  -> numerical PF-ODE trajectory
  -> train MF model to match long transitions between trajectory points
```

在 RAE setting，作者說 16-step Euler trajectory 已足夠，因為 RAE diffusion teacher 本身 16 steps FID 2.32、50 steps FID 1.51。

### 3. MFD vs MFT：先低方差 distill，再可選擇一點式 refine

作者把 MF target 裡的 proxy velocity 分成兩種：

- **MFD (MeanFlow Distillation)**：使用 pretrained flow matching teacher 的 velocity。低 variance、收斂快，但會受 teacher bias 限制。
- **MFT (MeanFlow Training)**：使用 one-point velocity estimator。bias 較小，但 variance 高、訓練較不穩。

他們給出一個 bias-variance decomposition，結論是：

```text
strong teacher available:
  MFD is usually best

teacher quality limited:
  MFD first for convergence
  then short MFT bootstrapping to reduce teacher bias
```

ImageNet 256 下 teacher 很強，所以 MFD alone 已經夠；ImageNet 512 下作者用 MFD 20K iterations，再 MFT 10K iterations，把 1-step FID 從 MFD-only 3.95 改到 3.23。

### 4. Finite difference 取代 exact JVP

MF 原本需要 transport derivative / JVP。作者用 finite difference 近似：

```text
h(z_{t+dt}, t+dt, s) - h(z_{t-dt}, t-dt, s)
-------------------------------------------------
                    2 dt
```

並固定 `dt = 0.005`。這避免 exact JVP 帶來的實作與效率問題，實驗上和 exact JVP 接近。

### 5. 三階段 pipeline

整體 training pipeline：

1. **Pre-training**：在 RAE latent space 訓練 flow matching teacher。
2. **Mid-training**：用 CMT 產生 trajectory-aware MF initialization。
3. **Post-training**：從 CMT weights 開始，用 MFD + finite difference 訓練 MF；需要時再用 MFT 做短暫 bootstrapping。

## Training / Data

主要實驗是 class-conditional ImageNet 256 / 512。

ImageNet 256：

- 使用 RAE released flow matching checkpoint。
- Flow matching pretraining：800 epochs / 1M iterations，約 78 H100 GPU-days。
- CMT：27K iterations，約 2.1 H100 GPU-days。
- MFD post-training：36 epochs / 180K iterations，約 21 H100 GPU-days。
- 總成本約 100 H100 GPU-days。
- 如果 teacher 已存在，CMT + MFD 額外轉成 few-step MF 只需約 23 H100 GPU-days。

ImageNet 512：

- Flow matching pretraining 使用 RAE checkpoint。
- CMT stage 約 8 H100 GPU-days。
- MFD 20K + MFT 10K 約 9 H100 GPU-days。
- 總計約 17 H100 GPU-days for MF conversion / post-training。

GitHub repo 提供：

- `CMT_256.sh` / `CMT_512.sh`
- `MFD_256.sh` / `MFD_512.sh`
- `MFT_512.sh`
- `Sample_256.sh` / `Sample_512.sh`
- ADM FID evaluation instructions

## 主要結果

### ImageNet 256

MF-RAE 在 few-step flow map models 裡達到最好的 1-step / 2-step FID：

- vanilla MeanFlow：1-step / 2-step FID = 3.43 / 2.20。
- AlphaFlow：2.58 / 1.95。
- CMT w/ MF：1-step FID 3.34。
- **MF-RAE：1-step / 2-step FID = 2.03 / 1.89。**

Training cost：

- vanilla MF：1400 epochs、約 7M iterations、600+ H100 GPU-days。
- MF-RAE：約 100 H100 GPU-days total。
- 成本降低超過 6x；abstract 以 total training cost reduction 表示約 83%。

Sampling compute：

- vanilla MF 1-step：SD-VAE decoder 310 + transformer 114 = 424 GFLOPS。
- MF-RAE 1-step：RAE decoder 106 + transformer 157 = 263 GFLOPS。
- 1-step sampling GFLOPS 降低約 38%。
- 2-step：vanilla 538 GFLOPS；MF-RAE 420 GFLOPS。

### Latent representation / training scheme ablation

在 ImageNet 256，作者比較 SD-VAE vs RAE、MFT vs MFD、guided vs unguided：

- MFD + SD-VAE + guidance：1/2-step FID 3.15 / 1.95。
- MFD + SD-VAE without guidance：5.94 / 4.01，嚴重退化。
- MFT + RAE without guidance：2.81 / 2.56。
- **MFD + RAE without guidance：2.03 / 1.89。**

這表示 RAE representation 不只是省 decoder compute，也讓 unguided MF 更好學；MFD 在同一個 RAE latent 上也明顯比 MFT 穩。

### ImageNet 512

MF-RAE 做到 1-step FID 3.23、1051 GFLOPS、841M parameters，低於其他 512 flow map baselines 的 sampling GFLOPS：

- CMT w/ ECD：FID 3.38，2344 GFLOPS。
- sCD：FID 2.28，2344 GFLOPS，但需要 CFG teacher / guidance。
- sCT：FID 4.29，2344 GFLOPS。
- AYF：FID 3.32，1342 GFLOPS。
- **MF-RAE：FID 3.23，1051 GFLOPS，無 guidance。**

512 上 bootstrapping 有用：MFD alone 1-step FID 3.95，接 10K MFT 後變 3.23。

## Project relevance

### project-one-step-audio-generation：高相關

這篇雖然是 image paper，但對 one-step audio generation 有幾個很直接的啟發：

1. **one-step / few-step generator 的 decoder cost 會變重要**
   多步 diffusion 時 decoder cost 可能不是 bottleneck；one-step 時，decoder / vocoder / codec decoder 可能成為主要成本。Audio 版也要把 vocoder、codec decoder、AudioVAE decoder 的 compute 算進 total latency，而不是只看 generator NFE。

2. **representation 和 one-step training stability 強耦合**
   RAE latent 對 flow matching 很好，但 naive MF 在 RAE latent 會 gradient explosion，必須用 CMT。Audio 版如果用 WavCube / VoxCPM AudioVAE / codec latent 做 MeanFlow，也可能需要 trajectory-aware mid-training，而不是直接從 diffusion teacher weights 開始。

3. **MFD -> MFT bootstrapping 很適合 audio**
   Audio teacher 可能不完美，尤其是 full-duplex / overlap / backchannel。可以先用 teacher-distilled low-variance target 讓 one-step model 穩定，再用 one-point / data-derived objective 做短期 refinement，降低 teacher bias。

4. **guidance-free conditioning 是 practical win**
   對 low-latency TTS / full-duplex audio，CFG 或多次 conditional/unconditional forward 會直接傷 latency。MF-RAE 顯示好 representation + distillation 可以拿掉 guidance hyperparameters。

### project-generative-speech-representation-evaluation：高相關

這篇和 RAE / WavCube / speech representation project 的關係是：

```text
representation choice
  -> decoder compute
  -> training stability
  -> convergence cost
  -> guidance need
  -> one-step output quality
```

這補強我們的 evaluation thesis：好的 representation 不只是 reconstruction 好，也要讓 downstream generator 用更少 compute 學起來。Audio 版 benchmark 可以加入：

- decoder/vocoder GFLOPS 或 wall-clock latency。
- CMT/MFD conversion cost。
- 1-step WER / SIM / UTMOS / FAD。
- whether guidance is needed。
- whether naive MF diverges。

### project-audio-model-evaluation：中度相關

如果把 one-step audio generator 放進 evaluator，不能只看 output WER / speaker similarity；還要記錄生成成本、guidance complexity、representation conversion cost。MF-RAE 提供一個很好的 reporting template。

## Related papers in my pool

- [Diffusion Transformers with Representation Autoencoders](../arxiv_2510_11690/)：直接前置工作。MF-RAE 使用 RAE latent / DiT-DH，並把 RAE 的優勢放到 one-step / few-step MeanFlow setting。
- [Improved Baselines with Representation Autoencoders](../arxiv_2605_18324/)：同樣關注 representation 對 downstream diffusion training efficiency 的影響；MF-RAE 進一步把 training efficiency 接到 one-step flow map。
- [WavCube](../arxiv_2605_06407/)：speech-side SSL-derived compact latent。WavCube 顯示 raw high-dimensional SSL latent 對 DiT 不好學；MF-RAE 顯示 strong representation 也可能讓 naive one-step training 爆炸，需要 trajectory-aware initialization。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：iFID 問 representation 是否能預測 downstream generation；MF-RAE 加上 compute / decoder / guidance 維度。
- [MeanFlow-TSE](../arxiv_2512_18572/)：speech-side one-step MeanFlow example。MF-RAE 的 CMT/MFD/MFT training recipe 可借給 speech target extraction / full-duplex overlap cleanup。
- [Representation Fréchet Loss](../arxiv_2604_28190/)：另一條 one-step generator route，透過 representation FD-loss 做 post-training；MF-RAE 則是 MeanFlow + representation latent + trajectory distillation。
- [AAD-1](../arxiv_2606_03972/)：one-step autoregressive video generation，用 asymmetric adversarial distillation；可和 MF-RAE 比較 one-step generation 的 critic/distillation routes。

## OpenReview / reviewer discussion

找到 OpenReview forum `JIzA7lK0Cv`，但截至 2026-06-22 public notes 數量為 0，未找到公開 review/rebuttal context。

## 我該不該細讀

**建議讀，尤其如果我們要做 one-step audio generation 或 speech representation evaluation。**

最值得讀：

- Figure 1 / intro：decoder GFLOPS 在 one-step setting 變成 bottleneck。
- Section 3.1：RAE latent 為什麼適合 MF，但 naive training 又會爆炸。
- Section 3.2：CMT 如何給 trajectory-aware initialization。
- Section 3.3：MFD vs MFT bias-variance analysis。
- Table 2：SD-VAE vs RAE、MFD vs MFT、guided vs unguided ablation。

對 audio 來說，這篇最有用的不是 FID 數字，而是實驗報告格式：

```text
quality + NFE + decoder cost + total GFLOPS + total GPU-days + guidance complexity
```

這正是 one-step TTS / full-duplex generator 也應該報的。

## 可能的弱點 / open questions

1. **image result 不能直接外推到 audio**
   Audio decoder / vocoder 的 cost structure、latency、streaming constraints 和 image RAE decoder 不同。Audio 版要實測 codec decoder / vocoder 是否也會在 one-step setting 成為 bottleneck。

2. **需要 strong teacher / RAE checkpoint**
   ImageNet 256 下 MFD 很強，是因為 teacher quality 已經很好。Audio 如果 teacher 對 overlap / prosody / speaker identity 不夠好，MFD 會繼承 teacher bias。

3. **CMT 增加 pipeline complexity**
   它降低最終成本，但需要先跑 teacher trajectory。Audio long-form / full-duplex 的 trajectory storage 和 sampling cost 可能比 image 更麻煩。

4. **RAE latent high-dimensional，但 speech high-dimensional latent 可能更難**
   WavCube 顯示 raw 1024-d WavLM latent 對 DiT 會 collapse。MF-RAE 顯示 RAE latent 可行，但 naive MF 也會爆炸。Audio representation 需要更仔細地平衡 dimension、frame rate、semantic/acoustic split。

5. **FID 不涵蓋 conditional correctness**
   Image class-conditional FID 不等於 TTS 的 transcript adherence、speaker similarity、prosody、timing。Audio 版需要 WER / SIM / UTMOS / event timing / rubric judge。

## Tags

- `meanflow`
- `flow-map-model`
- `representation-autoencoder`
- `one-step-generation`
- `few-step-generation`
- `diffusion-transformer`
- `distillation`
- `consistency-mid-training`
- `project-one-step-audio-generation`
- `project-generative-speech-representation-evaluation`

## Concepts

- MeanFlow
- MF-RAE
- Representation Autoencoder
- RAE latent
- DiT-DH
- Consistency Mid-Training
- MeanFlow Distillation
- MeanFlow Training
- finite-difference JVP
- guidance-free generation
- decoder bottleneck
- training cost
- sampling GFLOPS
- representation learnability

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{hu2025meanflowtransformerswithrepres,
  title={MeanFlow Transformers with Representation Autoencoders},
  author={Zheyuan Hu and Chieh-Hsin Lai and Ge Wu and Yuki Mitsufuji and Stefano Ermon},
  year={2025},
  eprint={2511.13019},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2511.13019}
}
```
