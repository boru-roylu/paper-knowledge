---
paper_key: arxiv_2603_29339
canonical_id: "arxiv:2603.29339"
title: "LongCat-AudioDiT: High-Fidelity Diffusion Text-to-Speech in the Waveform Latent Space"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.29339"
pdf_url: "https://arxiv.org/pdf/2603.29339"
status: read
rating: 9.0
tags:
  - tts
  - diffusion
  - flow-matching
  - speech-vae
  - continuous-latent
  - voice-cloning
  - project-generative-speech-representation-evaluation
  - project-tts-data-pipeline
  - project-audio-model-evaluation
created: 2026-06-20
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`longcat_flash_exp.tex` and section/table files), plus the official GitHub README / model links.

## Links

- [Original URL](https://arxiv.org/abs/2603.29339)
- [arXiv abstract](https://arxiv.org/abs/2603.29339)
- [PDF](https://arxiv.org/pdf/2603.29339)
- [arXiv source](https://arxiv.org/src/2603.29339)
- [Official GitHub repo](https://github.com/meituan-longcat/LongCat-AudioDiT)
- [Hugging Face: LongCat-AudioDiT-3.5B](https://huggingface.co/meituan-longcat/LongCat-AudioDiT-3.5B)
- [Hugging Face: LongCat-AudioDiT-1B](https://huggingface.co/meituan-longcat/LongCat-AudioDiT-1B)

## 一句話總結

LongCat-AudioDiT 是一個 non-autoregressive diffusion TTS：它不預測 mel-spectrogram，也不走 discrete tokens，而是用 Wav-VAE 把 raw waveform 壓成 continuous waveform latent，再用 DiT / Conditional Flow Matching 直接生成這個 latent；最重要的研究價值是它明確顯示 **Wav-VAE reconstruction fidelity 越高，不一定 downstream TTS 越好**。

## 這篇在解決什麼問題

近年的強 TTS 系統常見幾條路：

- AR / hybrid TTS：通常很強，但 pipeline 複雜，常包含 semantic token、acoustic token、duration/alignment、vocoder、多階段 training。
- diffusion / flow matching TTS：架構簡潔、NAR、可以 implicit alignment，但很多方法仍然以 mel-spectrogram 或 Mel-VAE latent 為生成 target，最後還要靠 vocoder 還原 waveform。
- discrete speech token TTS：方便接 LLM / speech LM，但 quantization 和多 codebook 設計會引入 tokenization bottleneck。

LongCat-AudioDiT 的核心問題是：如果 diffusion TTS 直接在 **waveform latent space** 建模，能不能同時得到簡潔 pipeline、高 speaker similarity、competitive intelligibility，並避免 latent -> mel -> waveform 這種 cascading conversion error？

## 核心方法

### 1) Wav-VAE: waveform-level continuous latent

作者訓練一個 fully convolutional audio autoencoder，直接從 raw waveform 壓成 continuous latent：

```text
waveform x
  -> Wav-VAE encoder
  -> continuous latent z
  -> diffusion / flow matching generator
  -> Wav-VAE decoder
  -> waveform
```

Wav-VAE 的 encoder / decoder 都是 time-domain 1D convolution architecture，使用 Oobleck-style blocks、dilated residual units、Snake activation，以及 non-parametric shortcut path 來穩定 aggressive downsampling。

default latent 設定：

- latent dimension：64
- frame rate：11.72 Hz
- Wav-VAE parameters：157M
- audio sample rate：24 kHz

Wav-VAE loss 包含：

- multi-resolution STFT loss
- multi-scale mel-spectrogram loss
- time-domain L1 loss
- KL loss
- adversarial loss
- discriminator feature matching loss

訓練時先 warmup，不啟用 adversarial / feature matching，等 reconstruction 穩定後再加 discriminator。

### 2) Diffusion TTS backbone: CFM + DiT

生成模型採用 Conditional Flow Matching (CFM)，把 Gaussian noise `z0` deterministic transport 到 clean speech latent `z1`：

```text
z_t = (1 - t) z_0 + t z_1
```

模型預測 velocity field，並只在 masked target region 上計算 loss。audio prompt context `z_ctx` 由 clean latent 隨機 mask continuous spans 得到，這讓模型自然支援 zero-shot voice cloning。

DiT backbone 包含：

- standard Transformer blocks
- AdaLN 注入 timestep
- QK-Norm 穩定 attention
- cross-attention 學 text-to-speech alignment
- RoPE
- long-skip connection
- global AdaLN 減少參數
- REPA alignment 到 mHuBERT features，加速 convergence，但作者說不明顯提升 final generation quality

### 3) Multilingual text encoder

作者使用 `UMT5-base` 做 multilingual text encoder。關鍵不是只取 last hidden state，而是把：

```text
LayerNorm(last_hidden_state) + LayerNorm(raw_word_embedding)
```

相加。直覺是 last hidden state 偏 semantic abstraction，而 raw embedding 保留低層 lexical / phonetic cues，對 TTS intelligibility 更重要。之後再接 ConvNeXt V2 refinement module，加速 text-speech alignment convergence。

### 4) 修正 training-inference mismatch

這是 paper 的一個細節但很重要。

flow matching training 時，`z_t` 是 clean latent 和 noise 的 ground-truth interpolation。但 inference 是 iterative ODE update。因為 loss 只打在 target generation region，prompt context region `z_t^ctx` 的 velocity 沒被約束。若 inference 時讓模型自由更新 prompt region，`z_t^ctx` 會 drift away from the GT noisy trajectory。

作者的修正方式是在每個 inference step 強制覆寫 prompt context：

```text
z_t^ctx <- t z^ctx + (1 - t) z_0^ctx
```

另外，做 unconditional branch / CFG 時，不能只是 drop `z_ctx`，還要 drop noisy prompt latent `z_t^ctx`，否則 unconditional prediction 仍然 leak prompt acoustic information。

### 5) APG 取代標準 CFG

標準 CFG 在高 guidance scale 下會提升 condition adherence，但也可能引入 audible artifacts。作者把 image diffusion 裡的 Adaptive Projection Guidance (APG) 搬到 flow matching TTS：

- 把 velocity output 投影到 sample domain，也就是預測 `z1`。
- 將 guidance residual 分解成 parallel / orthogonal components。
- dampen parallel component，保留 orthogonal guidance。
- 使用 reverse momentum trick，default `beta = -0.3`。

效果是：CER / SIM 近似不變，但 UTMOS / DNSMOS 更好，說明 APG 主要改善自然度和 acoustic quality。

## Training / Data

Wav-VAE：

- 訓練資料：curated internal Chinese + English speech corpus，約 200K hours。
- audio clips 切到約 3 秒。
- 32 NVIDIA H800 GPUs。
- global batch size 384。
- Wav-VAE 157M parameters。

TTS backbone：

- baseline / ablation：curated internal Chinese + English speech corpus，100K hours。
- large-scale model：擴到 1M hours。
- transcripts 由 ASR model 產生，不是全部 high-quality human annotations。
- audio sample rate：24 kHz。
- max audio duration for TTS training：60 seconds。
- DiT variants：1B 和 3.5B。
- 1B：16 GPUs，global batch size 256。
- 3.5B：64 GPUs，global batch size 1024。
- optimizer：AdamW，`beta1=0.9`, `beta2=0.95`。
- learning rate：`1e-4` 線性 decay 到 `1e-5`，前 1K steps warmup。
- inference：Euler ODE solver，16 NFE。

Evaluation：

- Wav-VAE reconstruction：LibriTTS `test-clean`，PESQ / STOI / UTMOS。
- TTS：Seed benchmark，包含 ZH / EN / ZH-Hard。
- intelligibility：Chinese 用 Paraformer 算 CER，English 用 Whisper large-v3 算 WER。
- speaker similarity：fine-tuned WavLM speaker embeddings，等價 VoiceBox SIM-O。
- naturalness / acoustic quality：UTMOS / DNSMOS。

## 主要結果

### 1) Seed benchmark：speaker similarity 很強

LongCat-AudioDiT-3.5B 在 Seed benchmark：

- ZH：CER 1.09，SIM 0.818。
- EN：WER 1.50，SIM 0.786。
- ZH-Hard：CER 6.04，SIM 0.797。

它的 SIM 在 Seed-ZH 和 Seed-Hard 是表中最佳，Seed-EN SIM 是第二。Intelligibility 也很強，但不是所有項目第一，例如 Qwen3-TTS / CosyVoice3.5 在部分 CER/WER 更低。

作者的 claim 比較合理的解讀是：LongCat-AudioDiT 用簡潔 end-to-end diffusion pipeline，在 zero-shot voice cloning similarity 上做到很強；但不是全面壓過所有 proprietary / heavily engineered systems。

### 2) Wav-VAE 比 Mel-VAE target 更適合這個 TTS

1B ablation 中，Wav-VAE target 明顯優於 Mel-VAE target：

| TTS latent | ZH CER | ZH SIM | EN WER | EN SIM | ZH-Hard CER | ZH-Hard SIM |
|---|---:|---:|---:|---:|---:|---:|
| Mel-VAE | 1.29 | 0.706 | 2.20 | 0.714 | 7.70 | 0.696 |
| Wav-VAE | 1.18 | 0.812 | 1.78 | 0.762 | 6.33 | 0.787 |

差距最大的是 speaker similarity，支持作者的說法：fine-grained high-frequency acoustic details 在 latent -> mel -> vocoder 的 cascade 裡容易流失。

### 3) Reconstruction fidelity 不等於 downstream TTS quality

這是對我們最重要的結果。

作者訓練不同 Wav-VAE：

- latent dimension：64 / 128 / 256。
- FPS：7.81 / 11.72 / 23.44。

觀察：

- latent dimension 越高，Wav-VAE reconstruction metrics 會變好。
- 但固定 TTS backbone capacity 下，TTS generation quality 反而變差。
- 即使用 3.5B backbone 去建模 128-dim Wav-VAE，也沒有打贏 64-dim Wav-VAE 的 3.5B model。
- high-FPS latent 對 diffusion backbone 也更難，因為 temporal dynamics 更複雜、correlated，容易造成 unstable generation。

最後作者選 `64-dim / 11.72 Hz` 當 default。這和我們之前討論的 `Making Reconstruction FID Predictive of Diffusion Generation FID` 完全呼應：representation 的 reconstruction 上限不是 downstream generator 的最佳選擇；latent learnability / model burden / geometry 才是關鍵。

### 4) Training-inference mismatch 和 APG 都有用

Seed-ZH ablation：

| Setting | CER | SIM | UTMOS | DNSMOS |
|---|---:|---:|---:|---:|
| LongCat-AudioDiT-1B | 1.18 | 0.812 | 3.16 | 3.40 |
| training-inference mismatch | 1.21 | 0.769 | 2.83 | 3.34 |
| w/o APG | 1.18 | 0.812 | 3.06 | 3.38 |

修正 mismatch 主要提升整體，特別是 SIM 和 UTMOS。APG 對 CER/SIM 影響小，但改善 UTMOS / DNSMOS，表示它主要抑制 CFG artifacts。

## Project relevance

### project-generative-speech-representation-evaluation

非常高相關。這篇幾乎是我們 project 的 direct evidence：

> Wav-VAE reconstruction fidelity improves, but downstream TTS generation can get worse.

它支持我們要建立的 speech/audio 版 representation evaluation：

- 不只看 PESQ / STOI / UTMOS reconstruction。
- 要看固定 generator compute 下的 learnability。
- 要看 latent dimension / FPS / compression 對 downstream WER、SIM、UTMOS、DNSMOS 的影響。
- 要測 `representation burden`：latent 太高維、太高 FPS、太細節化，可能讓 diffusion model 更難學。

這篇可以直接成為 project 的 core reference，和 [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/) 一起構成 image-side / speech-side evidence pair。

### project-tts-data-pipeline

中高相關。它沒有公開完整 data cleaning recipe，但有幾個啟發：

- 大規模 TTS 不一定需要全部 human-annotated transcripts；作者用 ASR-generated transcriptions 訓練到很強結果。
- 但資料是 curated internal corpus，細節不透明，所以不能直接推出「ASR transcript 足夠」。
- max 60s duration 和 zero-shot prompt continuation 設計，對 long-form / voice cloning TTS 的 data formatting 有參考價值。
- Wav-VAE / latent choice 會改變 TTS data pipeline 的 target representation：要存 waveform、latent、prompt audio、ASR transcript、speaker reference，而不只是 mel。

### project-audio-model-evaluation

高度相關。它提供一組 practical TTS evaluation axes：

- intelligibility：CER/WER。
- speaker similarity：WavLM-based SIM。
- naturalness：UTMOS。
- acoustic quality：DNSMOS。
- reconstruction vs generation：同一組 metrics 可分別套在 Wav-VAE reconstruction 和 TTS output 上。

這也提醒我們：如果只用 reconstruction metrics 選 Wav-VAE，很容易選到 downstream TTS 不好學的 latent。

### project-one-step-audio-generation

中度相關。LongCat-AudioDiT 不是 one-step model，inference 用 16 NFE；但它說明 waveform latent 的 dimension / FPS 會決定 diffusion backbone 的學習難度。如果要做 one-step audio generation，應先選 learnable latent，而不是 reconstruction 最強 latent。

## Related papers in my pool

- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：image-side reconstruction-vs-generation dilemma；LongCat-AudioDiT 是 speech-side 的直接 evidence。
- [SODA](../arxiv_2602_16687/)：discrete audio foundation model scaling；LongCat-AudioDiT 則是 continuous Wav-VAE latent + diffusion TTS。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free / continuous speech representation route，可和 LongCat-AudioDiT 的 Wav-VAE 路線比較。
- [Seed-TTS](../arxiv_2406_02430/)：主要 benchmark reference；LongCat-AudioDiT 在 Seed benchmark 上和 Seed-DiT / Seed-ICL 對比。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech tokenization；和 LongCat-AudioDiT 的 continuous latent route 是兩種 representation design。
- [F5-TTS / flow matching TTS family]：LongCat-AudioDiT 同樣用 flow matching / implicit alignment，但 target 從 mel-style representation 改成 waveform latent。
- [FunASR](../../tools/modelscope-funasr/)：LongCat-AudioDiT evaluation 中文 CER 使用 Paraformer 類 ASR，data pipeline 也依賴 ASR transcriptions。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

應該細讀，尤其是為了 `Generative Speech Representation Evaluation`。

最值得讀：

1. Wav-VAE architecture 和 loss：理解 waveform latent 怎麼被壓縮。
2. training-inference mismatch：這個 prompt-region drift 對 flow matching TTS 很實用。
3. APG：如果用高 CFG scale 做 speech generation，這是避免 artifacts 的方法。
4. RQ2 ablation：latent dimension / FPS 對 reconstruction 和 downstream TTS 的反向關係。

這篇不是只因為 TTS 分數高而重要，而是它提供了可實驗化的 thesis：**speech latent 應該用 downstream generator learnability 來選，不該只用 reconstruction quality 來選。**

## 可能的弱點 / open questions

1. **data 不公開且是 internal corpus**
   1M hours curated Chinese/English speech corpus 沒有公開細節；ASR transcript quality、filtering rule、speaker distribution、noise/overlap policy 都無法完整複現。

2. **Wav-VAE vs other continuous encoders 還不夠全面**
   主要比較 Wav-VAE / Mel-VAE / codecs 的 reconstruction 和 TTS target，但沒有完整比較 VoxCPM AudioVAE、Semantic-VAE、WavCube、TASTE-aligned representations 等。

3. **latent learnability 的理論還不完整**
   作者觀察到 64-dim / 11.72 Hz 最好，但還沒有提出可在不訓練完整 TTS backbone 的情況下預測最優 latent 的 metric。這正是我們 project 可以補的缺口。

4. **evaluation 仍以 objective metrics 為主**
   UTMOS / DNSMOS / WavLM-SIM 很有用，但 speaker cloning naturalness、emotion control、long-form stability、human preference 還需要更完整 human evaluation。

5. **zero-shot voice cloning safety**
   官方開源 model weights 和 inference code，對研究有利，但也提高 voice cloning misuse 風險。實際部署需要 consent、watermarking、detection、speaker verification safeguards。

## Tags

#tts #diffusion #flow-matching #speech-vae #continuous-latent #waveform-latent #voice-cloning #representation-evaluation #audio-evaluation #project-generative-speech-representation-evaluation #project-tts-data-pipeline #project-audio-model-evaluation

## Concepts

- LongCat-AudioDiT
- Wav-VAE
- waveform latent space
- continuous speech latent
- Conditional Flow Matching
- Diffusion Transformer
- non-autoregressive TTS
- zero-shot voice cloning
- training-inference mismatch
- noisy prompt latent drift
- Adaptive Projection Guidance
- CFG oversaturation
- UMT5 text encoder
- REPA with mHuBERT
- latent dimension tradeoff
- latent FPS sweet spot
- reconstruction vs generation quality
- representation learnability

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{xin2026longcataudiodithighfidelitydif,
  title={LongCat-AudioDiT: High-Fidelity Diffusion Text-to-Speech in the Waveform Latent Space},
  author={Detai Xin and Shujie Hu and Chengzuo Yang and Chen Huang and Guoqiao Yu and Guanglu Wan and Xunliang Cai},
  year={2026},
  eprint={2603.29339},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2603.29339}
}
```
