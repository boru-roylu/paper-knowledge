---
paper_key: arxiv_2403_18257
canonical_id: "arxiv:2403.18257"
title: "Dual-path Mamba: Short and Long-term Bidirectional Selective Structured State Space Models for Speech Separation"
year: 2025
venue: "ICASSP 2025"
url: "https://arxiv.org/abs/2403.18257"
pdf_url: "https://arxiv.org/pdf/2403.18257"
status: read
rating: 7
tags:
  - speech-separation
  - source-separation
  - mamba
  - state-space-model
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv metadata、arXiv TeX source `source/Template.tex`、`Template.bbl`，以及 Crossref DOI metadata 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/pdf/2403.18257](https://arxiv.org/pdf/2403.18257)
- arXiv: [https://arxiv.org/abs/2403.18257](https://arxiv.org/abs/2403.18257)
- PDF: [https://arxiv.org/pdf/2403.18257](https://arxiv.org/pdf/2403.18257)
- arXiv source: [https://arxiv.org/src/2403.18257](https://arxiv.org/src/2403.18257)
- Code: [https://github.com/xi-j/Mamba-TasNet](https://github.com/xi-j/Mamba-TasNet)
- DOI: [10.1109/ICASSP49660.2025.10888514](https://doi.org/10.1109/ICASSP49660.2025.10888514)

## 一句話總結

Dual-path Mamba 把 `Mamba` / selective state space model 放進 time-domain dual-path speech separation architecture，用 intra-chunk / inter-chunk、forward / backward 四個方向建模 speech sequence，在 WSJ0-2mix 上用比 SepFormer 更小的模型達到相近或更好的 separation performance，且 memory 更低。

## 這篇在解決什麼問題

Single-channel speech separation 要把一條 overlapped mixture 拆成多個 speaker waveform。這對我們的 full-duplex data project 很直接，因為 mono-channel dialogue 的 overlap 區域如果不能拆乾淨，就很難形成可訓練的 speaker-wise / dual-channel data。

過去 separation backbone 大致有幾類：

- CNN：例如 Conv-TasNet，效率高但 receptive field 有限制。
- RNN：例如 DPRNN，能處理 long sequence，但 parallelism 差、訓練不夠有效率。
- Transformer：例如 SepFormer，效果強，但 self-attention 對 sequence length 是 quadratic cost。
- Hybrid：例如 MossFormer / MossFormer2，效果更好，但架構更複雜。

這篇的問題設定是：能不能用 `Mamba` 這種 linear-time selective SSM 取代 Transformer attention，保留 long-range modeling，又降低 compute / memory。

## 核心方法

### 1. Time-domain encoder-mask-decoder

DPMamba 延續 TasNet 類 time-domain separation：

```text
single-channel mixture waveform
  -> linear encoder
  -> Mamba MaskNet estimates masks for speaker 1 / speaker 2
  -> apply masks in latent space
  -> linear decoder
  -> separated waveforms
```

Encoder kernel size 是 16，stride 是 8。這個 stride 比很多高精度 separation model 更大，因此 downsampling 較強，推論和 memory 更省。

### 2. Dual-path chunking

長語音先被切成 overlapping chunks：

- chunk size `K = 250`
- adjacent chunks 50% overlap
- latent tensor 變成 `D x K x S`

這跟 DPRNN / SepFormer 的 dual-path 思路一樣：不要一次對完整 waveform 長序列做 attention，而是拆成：

- intra-chunk：短時間 local modeling
- inter-chunk：跨 chunk 的 long-term global modeling

### 3. Dual-path Bidirectional Mamba

每個 DP block 有兩層處理：

```text
intra-chunk BiMamba over K frames
inter-chunk BiMamba over S chunks
```

每個 `BiMamba` 又包含 forward SSM 和 backward SSM。也就是四種 dependency 都被建模：

- intra-chunk forward
- intra-chunk backward
- inter-chunk forward
- inter-chunk backward

這點對 speech separation 很重要，因為離線 separation 通常可以使用 future context；作者的 ablation 也顯示 bidirectional 是最大收益來源。

### 4. BiMamba unit

BiMamba 先把 input projection 到 expansion dimension `E = 2D`，forward branch 和 backward branch 各自經過 Conv1d + SiLU + selective SSM，再用 gate `sigma(z)` 控制輸出，最後把 forward output 和 flipped-back backward output 平均後做 output projection。

簡化理解：

```text
input
  -> forward selective scan
  -> backward selective scan
  -> gated fusion
  -> residual dual-path block
```

## Training / Data

資料集：

- WSJ0-2mix
- two-speaker single-channel speech separation benchmark

Training：

- objective: SI-SNR
- evaluation: SI-SNRi / SDRi
- optimizer: Adam
- peak learning rate: `1.5e-4`
- warmup: 20,000 steps / 1 epoch
- cosine decay to 0.01 of peak LR
- 200 epochs
- batch size 1
- mixed precision: bfloat16
- hardware: NVIDIA L40 GPU
- augmentation: speed perturbation 95%-100%，dynamic mixing

Model sizes in arXiv TeX：

| Model | Dimension D | Layers | Params |
|---|---:|---:|---:|
| DPMamba XS | 128 | 8 x 2 | 2.3M |
| DPMamba S | 256 | 8 x 2 | 8.1M |
| DPMamba M | 256 | 16 x 2 | 15.9M |

註：arXiv TeX table 主要報 XS/S/M；正式 ICASSP 2025 DOI metadata / abstract mentions largest model reaches SI-SNRi 23.4 dB，但 TeX source 裡對 L model 仍寫「will report soon」。本 note 的數字以 arXiv TeX tables 為主。

## 主要結果

WSJ0-2mix 上的代表結果：

- DPMamba XS: SI-SNRi 19.2 dB, SDRi 19.4 dB, 2.3M params
- DPMamba S: SI-SNRi 21.4 dB, SDRi 21.6 dB, 8.1M params
- DPMamba M: SI-SNRi 22.6 dB, SDRi 22.7 dB, 15.9M params

和 baselines 對照：

- DPRNN: SI-SNRi 18.8 dB, 2.6M params, stride 1
- SepFormer: SI-SNRi 22.3 dB, 25.7M params, stride 8
- MossFormer L: SI-SNRi 22.8 dB, 42.1M params
- MossFormer2 L: SI-SNRi 24.1 dB, 55.7M params
- QDPN: SI-SNRi 23.6 dB, 200M params

作者主張不是絕對 SOTA，而是 **parameter / memory efficiency 很好**：

- DPMamba M 用 15.9M params 達到 22.6 SI-SNRi，比 SepFormer 22.3 更高，且參數少很多。
- DPMamba XS 比 DPRNN 稍少參數、stride 更大，仍達到更高 SI-SNRi。
- forward memory benchmark 顯示 DPMamba M 在接近 SepFormer performance 的情況下降低約 30% memory；DPMamba XS 在 10 秒 speech separation 時只用 DPRNN 約 10% memory。

Ablation：

- Unidirectional DPMamba S: SI-SNRi 16.9
- Default bidirectional DPMamba S at 100 epochs: SI-SNRi 20.6
- Bidirectional SSM 帶來超過 3 dB 的提升，是最重要的 design choice。
- Dynamic mixing 帶來約 0.6 dB 提升。
- Hidden state dimension 在 8 到 32 之間、RMSNorm vs LayerNorm 的影響相對小。

## Project relevance

### 對 `project-full-duplex-data`

這篇很值得放進 full-duplex data reading map，因為它是 **single-channel speech separation backbone**，可以作為 mono dialogue -> speaker-wise tracks 的一個候選模組。

可借的點：

- dual-path local/global modeling 很適合長 conversational audio。
- bidirectional modeling 對 offline data preprocessing 合理，因為我們不是 realtime agent inference，而是在清理 training data。
- memory-efficient separation backbone 對大規模資料處理重要，尤其 Sommelier / DialogueSidon 這類 pipeline 會處理很多長音訊。
- dynamic mixing augmentation 可借到 synthetic overlap data construction。

但要小心：

- WSJ0-2mix 是 clean benchmark，不是自然 multi-turn dialogue。
- 它主要做 waveform separation，不解決 diarization、speaker label consistency、speaker swap、transcript alignment、backchannel event tagging。
- 它沒有針對 natural overlap / interruption / laughter / breath / room noise 做分析。
- full-duplex project 需要的是 stable dual-channel data；SI-SNRi 高不代表 speaker attribution、content fidelity、backchannel recall 都足夠。

### 對 `project-tts-data-pipeline`

這篇不是 TTS data cleaning paper，但可當 TTS pipeline 的 upstream cleanup tool：把 overlapped speech 拆開後，再做 ASR / transcript filtering / speaker consistency check。對多 speaker podcast、dialogue TTS data、dirty web audio，DPMamba 類 separation backbone 可以先降低 overlap 對 transcription 和 speaker labeling 的傷害。

## Related papers in my pool

- [DialogueSidon](../arxiv_2604_09344/)：更直接針對 full-duplex dialogue restoration / separation；DPMamba 可作較傳統 separation backbone baseline。
- [Sommelier](../arxiv_2603_25750/)：web-scale full-duplex preprocessing pipeline；DPMamba 類模型可放在 overlap disentanglement 或 separation module。
- [MeanFlow-TSE](../arxiv_2512_18572/)：target speaker extraction 路線，需要 enrollment；DPMamba 是 blind two-speaker separation 路線。
- [WhisperD / Parakeet](../../tools/jordandarefsky-parakeet-whisperd/)：separation 後還需要 speaker/event transcript format，不能只停在 waveform。

## OpenReview / reviewer discussion

OpenReview fetch 找到 matching forum `ddfuZ3pj4t`，但 public notes 數量為 0；未找到公開 review/rebuttal context。

## 我該不該細讀

如果目標是 full-duplex mono dialogue 拆成 dual-channel data，建議細讀 method 和 ablation，但不需要把它當主線 paper。

優先讀：

1. Section 3 的 DPMamba architecture。
2. Bidirectional Mamba 如何接到 dual-path intra/inter chunk。
3. Table 2 的 parameter/performance trade-off。
4. Ablation 中 bidirectional vs unidirectional、dynamic mixing 的效果。

它的價值是提供一個 efficient separation backbone，而不是完整 data pipeline。

## 可能的弱點 / open questions

- 只在 WSJ0-2mix 上驗證，缺少 noisy / reverberant / in-the-wild dialogue。
- two-speaker setting 明確，對 unknown number of speakers 或 frequent speaker turn-taking 沒有處理。
- offline bidirectional design 效果好，但不適合 streaming / real-time full-duplex agent。
- 沒有報告 speaker identity consistency、speaker swap rate、ASR WER after separation、overlap backchannel recall 等我們真正需要的 data-quality metrics。
- Mamba 是否比 MossFormer2 / modern hybrid separation 在真實 conversational data 上更穩，仍需實驗。
- 對 full-duplex training data，還需要 mixture consistency check：`A_pred + B_pred` 是否能重建 original mono mixture。

## Tags

#speech-separation #source-separation #mamba #state-space-model #dual-path-network #wsj0-2mix #project-full-duplex-data #project-tts-data-pipeline

## Concepts

- Dual-path Mamba
- Mamba
- selective state space model
- bidirectional SSM
- BiMamba
- time-domain speech separation
- single-channel speech separation
- WSJ0-2mix
- SI-SNRi
- SDRi
- dynamic mixing
- SepFormer
- DPRNN
- MossFormer
- full-duplex data preprocessing

## Citation

```bibtex
@inproceedings{jiang2025dualpathmamba,
  title={Dual-path Mamba: Short and Long-term Bidirectional Selective Structured State Space Models for Speech Separation},
  author={Jiang, Xilin and Han, Cong and Mesgarani, Nima},
  booktitle={ICASSP 2025 - 2025 IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)},
  pages={1--5},
  year={2025},
  doi={10.1109/ICASSP49660.2025.10888514}
}
```

```bibtex
@misc{jiang2024dualpathmambashortandlongtermb,
  title={Dual-path Mamba: Short and Long-term Bidirectional Selective Structured State Space Models for Speech Separation},
  author={Xilin Jiang and Cong Han and Nima Mesgarani},
  year={2024},
  eprint={2403.18257},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2403.18257}
}
```
