---
paper_key: arxiv_2009_09761
canonical_id: "arxiv:2009.09761"
title: "DiffWave: A Versatile Diffusion Model for Audio Synthesis"
year: 2021
venue: "ICLR 2021 Oral"
url: "https://arxiv.org/abs/2009.09761"
pdf_url: "https://arxiv.org/pdf/2009.09761"
status: read
rating: 9
tags:
  - diffusion-vocoder
  - waveform-generation
  - audio-diffusion
  - neural-vocoder
  - tts
  - unconditional-audio-generation
  - project-tts-data-pipeline
  - project-audio-model-evaluation
  - project-one-step-audio-generation
created: 2026-07-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`paper.tex`), OpenReview metadata / reviews via OpenReview API, and the public demo page. Summary language is Traditional Chinese with English technical terms preserved.

## Links

- [Original URL](https://arxiv.org/abs/2009.09761)
- [PDF](https://arxiv.org/pdf/2009.09761)
- [arXiv source](https://arxiv.org/src/2009.09761)
- [OpenReview forum](https://openreview.net/forum?id=a-xFK8Ymz5J)
- [Audio demo page](https://diffwave-demo.github.io/)
- [Community implementation: lmnt-com/diffwave](https://github.com/lmnt-com/diffwave)

## 一句話總結

DiffWave 是早期把 DDPM-style diffusion 成功搬到 raw waveform synthesis 的代表作：用 non-autoregressive bidirectional dilated convolution 預測 noise，從 Gaussian noise 經過固定步數 reverse Markov chain 生成 waveform；它在 mel-conditioned neural vocoding 上達到 WaveNet 等級 MOS，同時能做 unconditional / class-conditional spoken digit waveform generation。

## 這篇在解決什麼問題

2020 年前後的 neural vocoder / waveform generator 有幾個常見路線：

- autoregressive WaveNet / WaveRNN：音質好，但 sample-by-sample generation 很慢。
- flow-based WaveGlow / WaveFlow：平行生成、likelihood training，但 architecture 受 invertibility constraint 限制，model footprint 可能大。
- GAN-based MelGAN / Parallel WaveGAN / GAN-TTS：快，但常需要 adversarial / spectrogram auxiliary losses，training stability 和 mode coverage 是問題。
- VAE-based waveform model：可能有 posterior collapse / fidelity 問題。

DiffWave 的問題設定是：能不能用 diffusion probabilistic model 做一個 raw waveform generator，既能當 mel-conditioned vocoder，也能在少 conditioning 甚至無 conditioning 時產生合理 audio？

它的早期貢獻不是發明 DDPM objective，而是證明這套 objective + WaveNet-like bidirectional convolution 可以在 audio waveform domain 成功工作，並且比 WaveNet 更快、比 GAN/VAE 更穩。

## 核心方法

### 1. Diffusion process / reverse process

Forward diffusion 把 clean waveform `x_0` 逐步加 Gaussian noise 到 `x_T`：

```text
q(x_t | x_{t-1}) = N(sqrt(1 - beta_t) x_{t-1}, beta_t I)
```

Reverse process 從 `x_T ~ N(0, I)` 開始，逐步 denoise：

```text
p_theta(x_{t-1} | x_t) = N(mu_theta(x_t, t), sigma_t^2 I)
```

模型不是直接預測 waveform，而是預測加入的 noise `epsilon_theta(x_t, t)`。Training objective 是 Ho et al. DDPM 的 unweighted noise-prediction loss：

```text
E || epsilon - epsilon_theta(sqrt(alpha_bar_t) x_0 + sqrt(1 - alpha_bar_t) epsilon, t) ||_2^2
```

### 2. Non-autoregressive bidirectional dilated convolution

DiffWave 的 denoiser 是 WaveNet-inspired stack，但因為 generation 不是 sample-by-sample autoregressive，所以不用 causal convolution。

Architecture：

- stack of residual layers。
- bidirectional dilated convolution，kernel size 3。
- dilation cycle `[1, 2, 4, ..., 512]` 或更大 cycle。
- residual / skip connections 類 WaveNet。
- diffusion-step embedding：128-d sinusoidal encoding，經過 FC layers 後加到每個 residual layer。

作者特別提到 causal dilated convolution 在 DiffWave 裡效果較差；bidirectional context 比較適合 denoising。

### 3. Conditional generation

DiffWave 支援兩種 conditioning：

- local conditioner：mel spectrogram，用於 neural vocoding。
- global conditioner：digit label / speaker label 類 discrete label，用 128-d embedding。

Mel-conditioned vocoder 裡，80-band mel spectrogram 先用 transposed 2-D convolution upsample 到 waveform length，再透過 layer-specific Conv1x1 變成 `2C` channels，當作 dilated convolution 的 bias。

### 4. Fast sampling

Training 可以用較多 diffusion steps，例如 `T = 50` 或 `T = 200`。Sampling 時作者提出 fast sampling，把 reverse process collapse 成少量 `T_infer` steps，例如 6 steps。

做法是設計新的 inference variance schedule `eta_t`，並把 inference noise level 對齊到 training noise schedule 的 diffusion step。這不需要 retraining；同一 checkpoint 可以用 fast sampling。

Paper 裡的 fast sampling schedules 例如：

- Large model：`{0.0001, 0.001, 0.01, 0.05, 0.2, 0.7}`
- Base model：`{0.0001, 0.001, 0.01, 0.05, 0.2, 0.5}`

## Training / Data

### Neural vocoding

Dataset：

- LJ Speech。
- 約 24 hours。
- 22.05 kHz。
- 13,100 utterances，single female speaker。

Mel conditioner：

- 80-band mel spectrogram。
- FFT size 1024。
- hop size 256。
- window size 1024。

DiffWave training：

- 8 Nvidia 2080Ti GPUs。
- random 16,000-sample clips。
- Adam。
- batch size 16。
- learning rate `2e-4`。
- 1M steps。

Model variants：

- Base：30 residual layers，64 residual channels，2.64M params。
- Large：30 residual layers，128 residual channels，6.91M params。
- `T` tested in `{20, 40, 50, 200}`。

### Unconditional / class-conditional generation

Dataset：

- Speech Commands digit subset，稱為 SC09。
- 31,158 training utterances。
- 約 8.7 hours。
- 2,032 speakers。
- 1 second per audio。
- 16 kHz，length `L = 16,000`。

Unconditional DiffWave：

- 36 layers。
- kernel size 3。
- dilation cycle `[1, 2, ..., 2048]`。
- `T = 200`。
- residual channels 256。
- trained 1M steps on 8 Nvidia 2080Ti GPUs。

Evaluation：

- Human MOS。
- ResNeXT classifier trained on SC09 for FID / IS / mIS / AM / NDB。
- Class-conditional setting additionally reports digit classification accuracy and FID-class。

## 主要結果

### 1. Neural vocoding：MOS 接近 WaveNet，但快很多

LJ Speech mel-conditioned vocoding：

- WaveNet：4.43 +/- 0.10 MOS，4.57M params。
- DiffWave Large `T=200`：4.44 +/- 0.07 MOS，6.91M params。
- DiffWave Base `T=50`：4.38 +/- 0.08 MOS，2.64M params。
- DiffWave Base Fast `T_infer=6`：4.37 +/- 0.07 MOS。
- DiffWave Large Fast `T_infer=6`：4.42 +/- 0.09 MOS。
- Ground truth：4.52 +/- 0.06 MOS。

Speed：

- DiffWave Base `T=20` FP32：2.1x faster than real-time on V100。
- DiffWave Base `T=40` FP32：1.1x faster than real-time。
- Base Fast / Large Fast：5.6x / 3.5x faster than real-time。
- WaveNet implementation：約 500x slower than real-time without engineered kernels。

但作者也誠實指出，DiffWave 仍慢於當時最強 flow-based vocoder，例如 WaveFlow 可大於 40x faster than real-time in FP16。

### 2. Unconditional SC09：比 WaveNet / WaveGAN 好很多

Unconditional spoken digit generation：

- WaveNet-256：FID 2.947，IS 2.84，mIS 10.0，MOS 1.43。
- WaveGAN：FID 1.349，IS 4.53，mIS 36.6，MOS 2.03。
- DiffWave：FID 1.287，IS 5.30，mIS 59.4，MOS 3.39。
- Testset MOS：3.72。

這裡的重要訊號是：raw waveform 的 unconditional generation 很難，WaveNet 容易產生 fake word-like sounds；DiffWave 的 stochastic denoising process 更適合捕捉資料主要 variation。

### 3. Class-conditional SC09：label conditioning 明顯降低難度

Class-conditional digit generation：

- WaveNet-256：accuracy 60.70%，FID-class 6.954，IS 3.46，mIS 18.9，MOS 1.58。
- DiffWave：accuracy 91.20%，FID-class 1.113，IS 6.63，mIS 117.4，MOS 3.50。
- DiffWave deep & thin：accuracy 94.00%，FID-class 0.932，IS 6.92，mIS 133.8，MOS 3.44。
- Testset MOS：3.72。

Label conditioning 讓 WaveNet 和 DiffWave 都變好，表示即使是一個 digit label，也能顯著降低 waveform generation 的 uncertainty。

### 4. Additional findings：zero-shot denoising / latent interpolation

作者展示 unconditional DiffWave 可以做 zero-shot speech denoising：把 noisy utterance 放到 reverse process 的中間 step，例如 `t = 25`，再 denoise 回 `x_0`。這不是用 denoising data 訓練出來的 task-specific model，而是 diffusion prior 的副產品。

他們也展示 class-conditioned DiffWave 可以在 noisy latent `x_t` space 做 speaker interpolation。這和我們後來討論的 representation interpolation / speaker similarity evaluation 有概念關聯，但 DiffWave 的 latent 是 diffusion noised waveform，不是 semantic-acoustic tokenizer latent。

## Project relevance

### project-tts-data-pipeline：中高相關

DiffWave 是 TTS pipeline 裡 neural vocoder 的重要基礎參考。它提醒我們：

- TTS pipeline 的 acoustic representation 不只可以接 WaveNet / GAN vocoder，也可以接 diffusion vocoder。
- mel spectrogram conditioner 的設定很具體：80-band、FFT 1024、hop 256、window 1024。
- vocoder evaluation 要同時看 MOS、real-time factor、model footprint，不只是 loss。
- 若我們要做 dual-channel / full-duplex TTS generator，waveform decoder 的速度和品質會成為 bottleneck。

### project-audio-model-evaluation：高相關

DiffWave 的 SC09 evaluation 是早期 audio generation benchmark 的好例子：用 classifier feature 做 FID / IS / mIS / NDB，再配 human MOS。這不完美，但它明確把 quality、diversity、label distribution 都拆開。

對我們的 audio judge / rubric evaluation 來說，DiffWave 提醒：

- unconditional / weakly-conditioned audio generation 需要 diversity metric，不只問單條 sample 是否自然。
- classifier-based FID/IS 會依賴 classifier domain；SC09 digit classifier 不能泛化到 general audio。
- human MOS 仍然重要，尤其 waveform artifacts 很難被單一 automatic metric 捕捉。

### project-one-step-audio-generation：中度相關

DiffWave 不是 one-step model，但 fast sampling 是從 many-step diffusion 走向 few-step audio generation 的早期證據。它顯示 50/200-step training checkpoint 可以在 `T_infer=6` 下維持接近原本 MOS。

對 one-step audio generation 的啟發：

- noise schedule / denoising step allocation 很重要，最有效步驟集中在接近 `x_0` 的區域。
- one-step / few-step audio 需要特別處理 final denoising/detail restoration，否則高頻 artifact 和 speech clarity 可能出問題。
- raw waveform one-step generation 比 latent-space one-step 更難；後續應比較 waveform diffusion vs codec/VAE latent diffusion。

### project-full-duplex-data：低到中度相關

DiffWave 不處理 multi-speaker、overlap、turn-taking，也沒有 dual-channel modeling。但它是 raw waveform generation prior，可以作為 full-duplex generator 的底層 decoder / vocoder reference。

如果未來做 dual-channel conversation generator：

- DiffWave-style waveform denoiser 可以作為 A/B channel decoder baseline。
- 需要額外 conditioning：speaker ID、transcript alignment、overlap event、backchannel timing。
- SC09 unconditional generation 只能證明短 utterance 可行，不能代表長對話 / overlap generation。

## Related papers in my pool

- [NaturalSpeech 2](../arxiv_2304_09116/)：後續 latent diffusion TTS，把 generation 放在 latent space 而不是 raw waveform；對比 DiffWave 可看出為什麼後來 TTS 常避免直接在 waveform 上長序列 diffusion。
- [DiTTo-TTS](../arxiv_2406_11427/)：diffusion TTS target representation 比較；和 DiffWave 一起說明 vocoder / representation / diffusion backbone 的 tradeoff。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：waveform latent space 的 diffusion TTS；可視為 DiffWave raw waveform diffusion 的後續演化。
- [WavCube](../arxiv_2605_06407/)：semantic-acoustic continuous latent，比 raw waveform 更適合 downstream DiT 學習。
- [LoSATok](../arxiv_2605_27840/)：low-dimensional semantic-acoustic tokenizer，進一步支持「直接生成高維 acoustic waveform/feature 很難，representation 會影響 downstream learnability」。

## OpenReview / reviewer discussion

OpenReview forum 顯示本文為 **ICLR 2021 Oral**，final decision 是 `Accept (Oral)`。

Reviewer 共識：

- 優點：把 diffusion probabilistic model 成功用到 waveform generation；conditional vocoding 結果強，unconditional / class-conditional SC09 結果明顯優於 WaveNet / WaveGAN；小 footprint、比 WaveNet 快；demo 和 MOS 有說服力。
- 主要質疑：method novelty 有限，核心 objective 直接來自 Ho et al. DDPM，architecture 是 non-causal WaveNet-like dilated convolution；需要更清楚區分自己和 concurrent WaveGrad。
- 主要 limitation：unconditional / weakly-conditioned generation 只在 spoken digit 上評估，不能證明能生成長句或長音訊；缺少較系統的 ablation。
- Decision meta-point：area chair 認為雖然 technical novelty 有限，但把 fresh generative modeling idea 做到 practical audio synthesis domain 很有價值，因此接受為 Oral。

作者回應補充：

- DiffWave 和 WaveGrad 的差異包括 task scope、architecture、model footprint、training resources；DiffWave 也展示 vocoding 以外的 unconditional / class-conditional waveform generation。
- 作者承認長句 unconditional waveform generation 很難，可能需要把 waveform 壓到 compact latent code 再生成。
- 作者後續嘗試 WaveFlow on SC09 unconditional generation，結果多數 sample 不 intelligible；作者推測 deterministic flow mapping 在沒有 strong conditioner 時不適合處理 waveform stochasticity。

## 我該不該細讀

如果你在看 TTS vocoder、diffusion audio history、few-step audio sampling，建議細讀。

最值得讀：

1. diffusion training / sampling objective 如何搬到 waveform。
2. bidirectional dilated convolution architecture。
3. fast sampling algorithm。
4. LJ Speech vocoder MOS / speed / model footprint table。
5. SC09 unconditional / class-conditional evaluation，尤其是 FID/IS/mIS/NDB + MOS 的組合。

如果目標是最新 SOTA TTS 或 full-duplex dialogue generation，這篇不是最終方案，但它是理解 audio diffusion 為什麼成立的基礎 paper。

## 可能的弱點 / open questions

1. **不是 one-step，也不是 real-time 最快方案**  
   Fast sampling 可以到 6 steps，但仍然不是 one-step；而且 flow-based vocoder 當時在速度上更快。

2. **unconditional generation 只測 SC09 digits**  
   1 秒 spoken digit 比完整句子、多人對話、music、general audio 容易很多。不能直接推論到 long-form speech。

3. **method novelty 有限**  
   OpenReview reviewer 也指出，diffusion objective 主要來自 Ho et al.，architecture 是 WaveNet-like non-causal dilated convolution。

4. **缺少系統 ablation**  
   Diffusion step embedding、depth/width、dilation cycle、noise schedule、fast sampling schedule 的 ablation 不完整。

5. **raw waveform modeling cost 高**  
   直接在 waveform 上做 diffusion 序列長度很大。後續許多工作轉向 mel / codec / VAE / semantic-acoustic latent，這也是我們 representation evaluation project 的核心原因。

## Tags

diffusion-vocoder, waveform-generation, audio-diffusion, neural-vocoder, tts, unconditional-audio-generation, project-tts-data-pipeline, project-audio-model-evaluation, project-one-step-audio-generation

## Concepts

- DiffWave
- DDPM for waveform
- neural vocoder
- bidirectional dilated convolution
- mel-conditioned waveform synthesis
- unconditional waveform generation
- class-conditional waveform generation
- fast sampling
- MOS
- audio FID / IS / mIS / NDB
- SC09
- LJ Speech

## Citation

```bibtex
@inproceedings{
kong2021diffwave,
title={DiffWave: A Versatile Diffusion Model for Audio Synthesis},
author={Zhifeng Kong and Wei Ping and Jiaji Huang and Kexin Zhao and Bryan Catanzaro},
booktitle={International Conference on Learning Representations},
year={2021},
url={https://openreview.net/forum?id=a-xFK8Ymz5J}
}
```
