---
paper_key: arxiv_2512_18572
canonical_id: "arxiv:2512.18572"
title: "MeanFlow-TSE: One-Step Generative Target Speaker Extraction with Mean Flow"
year: 2025
venue: "arXiv preprint / Interspeech style manuscript"
url: "https://arxiv.org/abs/2512.18572"
pdf_url: "https://arxiv.org/pdf/2512.18572"
status: read
rating: 8
tags:
  - target-speaker-extraction
  - speech-separation
  - one-step-generation
  - flow-matching
  - project-full-duplex-data
  - project-one-step-audio-generation
  - project-audio-model-evaluation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv metadata 與 arXiv TeX source `source/template.tex` 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2512.18572](https://arxiv.org/abs/2512.18572)
- arXiv: [2512.18572](https://arxiv.org/abs/2512.18572)
- PDF: [https://arxiv.org/pdf/2512.18572](https://arxiv.org/pdf/2512.18572)
- arXiv source: [https://arxiv.org/src/2512.18572](https://arxiv.org/src/2512.18572)
- Code: [https://github.com/rikishimizu/MeanFlow-TSE](https://github.com/rikishimizu/MeanFlow-TSE)

## 一句話總結

MeanFlow-TSE 把 `MeanFlow` / `alpha-Flow` 的 one-step average velocity objective 用到 `Target Speaker Extraction`，讓模型可以從 single-channel mixture 加 enrollment utterance 直接一步生成 target speaker spectrogram，在 Libri2Mix 上用 1 NFE 達到比 AD-FlowTSE 更好的 SI-SDR / PESQ / ESTOI。

## 這篇在解決什麼問題

`Target Speaker Extraction` 要從混合語音 `y = s + b` 中抽出指定 target speaker `s`，通常需要一段 enrollment utterance `e` 作為 speaker cue。這對 hearing aids、telecommunication、ASR front-end、multi-speaker conversation cleanup 都很重要。

傳統 TSE 多半是 discriminative mask estimation：在 waveform 或 spectrogram 上估 mask，直接最小化 SI-SNR / reconstruction loss。這類方法速度快，但在 unseen acoustic condition 下可能有 artifacts，也不一定能產生自然的 speech distribution。

近年的 diffusion / flow-matching TSE 把問題改成 conditional generation，perceptual quality 比較好，但 iterative sampling 會增加 latency。AD-FlowTSE 已經把 flow path 從 background 到 target speaker，並用 mixing-ratio-aware initialization 減少 sampling steps；MeanFlow-TSE 的核心問題是：能不能把這件事進一步壓到真正的 **one-step generation**。

## 核心方法

### 1. 沿用 AD-FlowTSE 的 mixture-aware path

論文把 mixture 視為 target speech `S` 和 background/interference `B` 之間的 convex combination：

```text
z_t = t S + (1 - t) B
```

雖然物理上 mixture 是 additive `y = s + b`，作者沿用 AD-FlowTSE 的 scale-invariance 假設，把 mixture 近似放在 path 上的某個時間點 `t = lambda`。這讓 inference 可以從 mixture spectrogram `Y` 出發，而不是從 Gaussian noise 或純 background 開始。

### 2. 用 MeanFlow 學 average velocity，而不是 instantaneous velocity

標準 `flow matching` 學的是某個時間點的 instantaneous velocity，因此 inference 通常要 ODE integration。`MeanFlow` 改學從 `t` 到 `r` 的 average velocity：

```text
z_r = z_t + (r - t) v_avg(z_t, t, r)
```

MeanFlow-TSE 把 velocity network 改成 speaker-conditioned：

```text
v_theta(z_t, t, r, e)
```

其中 `e` 是 enrollment utterance。

### 3. One-step inference

推論時先用 mixing ratio predictor 估 `lambda_hat`，把 mixture `Y` 當成 `z_lambda`，再一步跳到 target speaker：

```text
S_hat = Y + (1 - lambda_hat) * v_theta(Y, lambda_hat, 1, e)
```

這是這篇最重要的設計：不是「少量 Euler steps」，而是 training objective 本身就讓 1 NFE 成為主要目標。

### 4. alpha-Flow curriculum

作者使用 `alpha-Flow` style target：

```text
v_alpha = alpha * u + (1 - alpha) * v_theta(z_tau, tau, r)
```

其中 `u = S - B`。訓練早期比較像 trajectory flow matching，後期逐漸轉向 mean-flow identity。`alpha` 用 sigmoid schedule 從 1 降到 `alpha_min = 0.005`，整個 transition 到 epoch 2000。

還有 adaptive weight：

```text
w = alpha / (||Delta||^2 + c),  c = 1e-3
```

這個 loss 用 stop-gradient 權重，目標是讓 mean-flow training 比直接做 consistency 更穩。

### 5. Mixing ratio predictor

因為 inference 時不知道真實 `lambda`，作者另外訓練 `g_phi(y, e)` 預測 mixing ratio。架構是 `ECAPA-TDNN` feature extractor 加 MLP，輸入 mixture 與 enrollment 的 speaker features，輸出 `lambda_hat`，用 MSE supervised training。

## Training / Data

資料使用 Libri2Mix，設定跟 AD-FlowTSE 相同：

- training: `train-360` + `train-100`
- validation: `dev`
- test: `test`
- sampling rate: 16 kHz
- 每個 sample 是 6 秒 segment：3 秒 enrollment speech + 3 秒 mixture
- STFT hop size 128，window length 510

模型 backbone 是 U-Net style `Diffusion Transformer (UDiT)`：

- 16 transformer layers
- 16 attention heads
- hidden dimension 768
- input / output dimension 512
- positional length 500
- no positional encoding

訓練設定：

- optimizer: AdamW，weight decay 0.01
- learning rate: cosine annealing，5 epoch warmup，`1e-4 -> 1e-5`
- 2000 epochs
- batch size 32
- 8x NVIDIA L40 GPUs with DDP
- 16-bit mixed precision
- gradient clipping 0.5
- checkpoint selection: validation SI-SDR best

MeanFlow 設定：

- `t` / `r` 從 log-normal distribution 取樣，`mu=-0.4`, `sigma=1.0`
- 50% training iterations 設 `t = r`，退化成 standard rectified flow matching
- inference 預設 1 Euler step / 1 NFE

## 主要結果

在 Libri2Mix Clean：

- MeanFlow-TSE: PESQ 3.26, ESTOI 0.93, SI-SDR 18.80 dB
- AD-FlowTSE: PESQ 2.89, ESTOI 0.90, SI-SDR 17.49 dB
- MeanFlow-TSE 在 intrusive metrics 上明顯贏 AD-FlowTSE。

在 Libri2Mix Noisy：

- MeanFlow-TSE: PESQ 2.21, ESTOI 0.82, SI-SDR 12.85 dB
- AD-FlowTSE: PESQ 2.15, ESTOI 0.81, SI-SDR 12.69 dB
- 提升較小，但仍是表中最好的 PESQ / ESTOI / SI-SDR。

效率：

- SoloSpeech: 50 NFE, 589M params, RTF 0.75, peak memory 3738 MB
- AD-FlowTSE: 1 NFE, 358M params, RTF 0.017, memory 1531 MB
- MeanFlow-TSE: 1 NFE, 359M params, RTF 0.018, memory 1536 MB

也就是 MeanFlow-TSE 基本維持 AD-FlowTSE 的推論成本，但 intrusive extraction quality 更好。

重要 caveat：

- 在 Libri2Mix Noisy 的 `SIM` speaker similarity，MeanFlow-TSE 是 0.73，低於 AD-FlowTSE 的 0.87。
- 在 non-intrusive perceptual metrics 上，MeanFlow-TSE 仍落後部分 multi-step / diffusion baseline，例如 FlowTSE 的 noisy OVRL / DNSMOS 較高。
- 作者自己的 NFE analysis 顯示 MeanFlow-TSE 在 NFE=1 最好，多加 Euler steps 反而略降，推測是 discretization error 累積。

## Project relevance

### 對 `project-full-duplex-data`

這篇不是 full-duplex dialogue paper，也不是 diarization / ASR pipeline。但它對我們的 mono-channel dialogue -> dual-channel data recovery 有一個明確用途：**low-latency target speaker extraction component**。

如果我們有 speaker enrollment 或能從 dialogue 內抽出 speaker embedding，MeanFlow-TSE 這類方法可以作為：

- overlap 區域的 target speaker recovery baseline
- DialogueSidon 之外的 speaker-conditioned extraction baseline
- mono mixture 中抽出指定 speaker 的 fast front-end
- `A_pred` / `B_pred` pseudo channel 產生器的一個候選模組

但限制也很清楚：

- Libri2Mix 是 synthetic two-speaker mixture，不等於自然 dialogue。
- 它不處理 speaker diarization、turn-taking、backchannel label、event tags 或 transcript alignment。
- 它需要 enrollment / speaker cue；對 unknown speaker 或 speaker swap region 還需要上游 speaker tracking。
- speaker similarity 在 noisy setting 不一定比 AD-FlowTSE 好，這對 dual-channel data 很重要，因為 speaker leakage / identity drift 會污染 training data。

所以它比較適合放在 pipeline 的 **speaker-conditioned extraction / overlap cleanup**，而不是直接當完整 full-duplex data solution。

### 對 `project-one-step-audio-generation`

這篇是 speech side 很直接的 one-step generation reference。它證明 `MeanFlow` / `alpha-Flow` 不只在 image 或 general speech enhancement 可用，也可以用在 target speaker extraction 這種 conditioned speech generation 任務。

值得借的點：

- one-step objective 要在 training 時被明確優化，不是只把 multi-step model 硬砍成 1 step。
- mixture-aware initialization 可以把 starting point 放在更接近 target 的 trajectory position。
- 對 full-duplex generator 來說，也許可以把 observed mixture / partial channel 當成 path 上的中間點，而不是從 noise 開始生成。
- `NFE=1` 最好這件事提醒我們：如果 objective 是 one-step，額外 iterative refinement 不一定有幫助。

### 對 `project-audio-model-evaluation`

這篇的 metric set 很實用：SI-SDR / PESQ / ESTOI / DNSMOS / OVRL / SIM 同時看 signal fidelity、intelligibility、perceptual quality 和 speaker identity。對我們來說，不能只看 SI-SDR；如果 speaker similarity 或 human-perceived naturalness 掉了，dual-channel data 仍然可能不可用。

## Related papers in my pool

- [AD-FlowTSE](../arxiv_2512_18572/)：本文的直接 baseline；note 目前記在本頁內，之後若單獨加入 AD-FlowTSE 可補引用邊。
- [DialogueSidon](../arxiv_2604_09344/)：full-duplex dialogue restoration / separation 更直接命中我們的 mono-to-dual project；MeanFlow-TSE 可當 speaker-conditioned extraction baseline。
- [Sommelier](../arxiv_2603_25750/)：web-scale full-duplex audio preprocessing pipeline；MeanFlow-TSE 比較像其中 overlap disentanglement / target extraction 的候選模組。
- [SLED](../arxiv_2505_13181/)：low-latency continuous latent speech generation；同屬 one-step / few-step speech generation 路線。
- [Representation Fréchet Loss](../arxiv_2604_28190/)：one-step generator post-training objective；可和 MeanFlow-style objective 對照。
- [AnyAudio-Judge](../arxiv_2606_03116/)：可用來補充 extraction output 的 human-friendly rubric evaluation。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議細讀，尤其如果下一步要做 overlap cleanup 或 low-latency speaker-conditioned extraction。

最值得讀的部分：

1. AD-FlowTSE 的 mixture path 假設如何把 additive mixture 改寫成 convex path。
2. MeanFlow / alpha-Flow objective 如何避免 multi-step ODE integration。
3. Mixing ratio predictor 的效果與潛在 failure mode。
4. SIM 下降與 non-intrusive metric 落後代表什麼。

如果只關心 full-duplex dialogue policy、backchannel timing 或 ASR transcript format，這篇不是核心；如果關心「怎麼把 overlap mixture 中指定 speaker 低延遲抽出來」，這篇很相關。

## 可能的弱點 / open questions

- `y = lambda s + (1 - lambda)b` 是 task-level approximation，不是真實 acoustic mixing equation；在 reverberation、多 speaker、nonlinear device artifacts 下可能不穩。
- Libri2Mix synthetic benchmark 不代表自然 multi-turn dialogue，尤其 short backchannel、interruption、laughter、breath、room noise、speaker movement 都沒充分覆蓋。
- Noisy setting 的 SIM 比 AD-FlowTSE 低，可能代表 one-step objective 在 speaker identity preservation 上有 trade-off。
- Mixing ratio predictor 如果錯，one-step jump 的起點時間 `lambda_hat` 會錯；paper 沒有深入分析 lambda error 對 extraction 的敏感度。
- 沒有多 channel / reverberant setting 實驗；作者也把這列為 future work。
- 對我們的 dual-channel data pipeline，還需要測 A/B channel sum 是否能 reconstruct original mixture，否則 separation 好聽但 mixture-inconsistent 仍可能污染 generator training。

## Tags

#target-speaker-extraction #speech-separation #one-step-generation #meanflow #flow-matching #speech-enhancement #project-full-duplex-data #project-one-step-audio-generation #project-audio-model-evaluation

## Concepts

- Target Speaker Extraction
- MeanFlow
- alpha-Flow
- AD-FlowTSE
- mixing-ratio-aware initialization
- one-step generation
- flow matching
- UDiT
- ECAPA-TDNN
- Libri2Mix
- SI-SDR
- PESQ
- ESTOI
- DNSMOS
- Speaker Similarity
- Real Time Factor

## Citation

目前以 arXiv preprint 記錄；TeX 使用 Interspeech 2025/2026 style 並開啟 camera-ready flag，但 arXiv metadata 未提供正式 conference/journal reference，之後若確認 venue 再更新。

```bibtex
@misc{shimizu2025meanflowtseonestepgenerativeta,
  title={MeanFlow-TSE: One-Step Generative Target Speaker Extraction with Mean Flow},
  author={Riki Shimizu and Xilin Jiang and Nima Mesgarani},
  year={2025},
  eprint={2512.18572},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2512.18572}
}
```
