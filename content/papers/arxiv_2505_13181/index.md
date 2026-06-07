---
paper_key: arxiv_2505_13181
canonical_id: "arxiv:2505.13181"
title: "Efficient Speech Language Modeling via Energy Distance in Continuous Latent Space"
year: 2025
venue: "NeurIPS 2025 submission / arXiv preprint"
url: "https://arxiv.org/abs/2505.13181"
pdf_url: "https://arxiv.org/pdf/2505.13181"
status: read
rating: 8.4
tags:
  - speech-llm
  - tts
  - continuous-latent
  - autoregressive-generation
  - streaming-tts
  - energy-distance
  - project-one-step-audio-generation
  - project-tts-data-pipeline
  - project-full-duplex-data
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`neurips_2025.tex`) and bibliography. This paper is directly relevant to continuous latent speech generation and streaming TTS.

## Links

- [Original arXiv abstract](https://arxiv.org/abs/2505.13181)
- [PDF](https://arxiv.org/pdf/2505.13181)
- [arXiv source](https://arxiv.org/src/2505.13181)
- [Official GitHub repo / demos](https://github.com/ictnlp/SLED-TTS)

## 一句話總結

SLED 提出一條不同於 RVQ discrete codec token 的 speech language modeling 路線：把 speech waveform encode 成 **continuous latent vectors**，再用 autoregressive Transformer + lightweight per-token generative MLP，並用 **Energy Distance / generalized energy distance** 訓練每一步的 continuous distribution，避免 RVQ hierarchical decoding 和 per-step diffusion / flow iterative sampling。

## 這篇在解決什麼問題

Speech LM 一直想模仿 text LM 的 autoregressive modeling，但 speech 和 text 有根本差異：

- text 是 finite vocabulary discrete tokens，可以用 softmax + cross-entropy。
- speech 是高頻連續訊號，即使壓到 latent / codec space，仍然很長、資訊密度高。

主流做法是先把 speech 離散化：

- SSL / ASR supervised semantic tokens；
- reconstruction-oriented codec tokens；
- RVQ multi-codebook acoustic tokens。

但這帶來兩個問題：

1. **discretization bottleneck**  
   離散 token 會丟掉 waveform 中的細節，影響 reconstruction / prosody / speaker timbre。

2. **hierarchical architecture complexity**  
   RVQ 會產生 multi-stream discrete tokens。VALL-E 類方法通常先 AR 生成第一 codebook，再用 NAR local model 補 residual codebooks；或用 RQ-Transformer 類 nested model。這讓訓練和推論都變複雜。

SLED 問的是：**能不能直接在 continuous latent space 做 autoregressive speech LM，而且每一步 sampling 要像 softmax 一樣輕量、穩定、可 streaming？**

## 核心方法

### 1) Continuous latent speech LM

給定 waveform `x`，先用 encoder 得到 continuous latent sequence：

```text
x -> Enc(x) = h_0, h_1, ..., h_T
```

SLED 建模：

```text
p(h) = product_t p(h_t | h_<t)
```

也就是每一步不是預測 discrete token，而是預測一個 continuous vector distribution。

### 2) Lightweight per-token generative module

AR network `psi` 先讀取過去 latent vectors 和 text condition，輸出 condition vector：

```text
z_t = psi(h_<t)
```

然後用一個輕量 conditional generative module `g`：

```text
h_t = g(z_t, epsilon)
```

其中 `epsilon` 是 random noise。`g` 是 MLP / residual blocks + AdaLN，不是 diffusion / flow。這樣每個 autoregressive step 只需要一次 forward pass，不需要 per-token iterative sampling。

### 3) Energy Distance objective

關鍵是怎麼訓練 continuous distribution。SLED 用 generalized energy distance / MMD family 的 objective：

```text
L_GED = sum_t E[ 2 ||h_t - h_t*||_2 - ||h_t - h_t'||_2 ]
```

其中：

- `h_t*` 是 target latent。
- `h_t` 和 `h_t'` 是 model distribution 的兩個 independent samples。
- 第一項把 generated sample 拉近 target。
- 第二項是 **repulsive term**，避免模型 collapse 成單點 regression。

作者強調：如果移除 repulsive term，就近似 RMSE / regression loss；這不是 proper distributional objective，會導致模型失敗。

### 4) Stop prediction head

continuous latent 沒有 discrete EOS token，所以 SLED 加一個 binary classification head，根據 AR state `z_t` 判斷是否停止。

### 5) Classifier-free guidance

continuous latent generation 比 discrete generation noise 更高。作者在 inference 時用 CFG：

```text
z_cfg = z_uncond + lambda * (z_cond - z_uncond)
h_cfg = g(z_cfg, epsilon)
```

訓練時隨機 mask text prompt，讓模型學 conditional / unconditional generation。作者建議 default `lambda = 2.0`，但指出太高會傷害 timbre / quality，尤其 streaming setting。

### 6) Streaming inference

SLED 是純 autoregressive，沒有 post-AR refinement，因此天然支援 streaming：

1. 每生成一個 latent vector，就可以交給 streaming decoder 合成 waveform。
2. 文字輸入也可 incremental：用 `n:m` interleaving ratio，每收到 `n` 個 text subwords，就生成 `m` 個 speech vectors。

實驗用兩個設定：

- `5:20`：每 5 subwords 生成 20 speech vectors，約 0.27 秒 speech。
- `5:45`：每 5 subwords 生成 45 speech vectors，約 0.6 秒 speech。

## Training / Data

Dataset：

- LibriHeavy，約 **50,000 hours** speech。
- 6,736 speakers。
- text BPE vocab size：16,384。

Continuous representation：

- 使用 Encodec。
- 對每個 frame，把 8 個 codebook 的 token embeddings 相加，形成 continuous vector。
- latent sampling rate：75 Hz。
- latent dimensionality：128。
- 作者指出：plain autoencoder latent 也可行，但 quantization-regularized / KL-regularized latent space 對 downstream LM 更好。

Model：

- autoregressive network：12 LLaMA-style Transformer layers。
- hidden dim：1024。
- attention heads：16。
- FFN hidden：2752。
- conditional generative module：6 residual blocks with AdaLN，hidden dim 1024。
- default CFG lambda：2.0。
- total scale around 0.2B。

Training：

- batch size 512。
- 300k steps。
- BF16。
- AdamW，lr 5e-4，weight decay 0.01。
- warmup 32k steps，linear decay。
- gradient clip 1.0。

Evaluation：

- LibriSpeech test-clean / LibriSpeech-PC。
- 2.2-hour subset，1,234 samples / 40 speakers；LibriSpeech-PC filtered subset 1,154 samples。
- zero-shot settings：
  - 3s Prefix as Prompt：speech continuation。
  - Reference Utterance as Prompt：voice cloning / speaker transfer。
- metrics：
  - WER-C：Conformer-Transducer。
  - WER-H：HuBERT-Large CTC ASR。
  - SIM：WavLM-TDNN speaker embedding cosine similarity。
  - DNSMOS：speech quality。

## 主要結果

### Zero-shot TTS

SLED 在 0.2B scale 下達到強表現：

- 3s Prefix Prompt：
  - WER-C：**1.59**
  - WER-H：**1.99**
  - SIM：0.515
- Reference Utterance Prompt：
  - WER-C：**1.51**
  - WER-H：**1.97**
  - SIM：0.664

作者指出 WER-C 甚至低於 Ground Truth / Encodec reconstruction 的 ASR error，表示 intelligibility 很強。不過 speaker similarity 和 MegaTTS 3 / Llasa 等強 TTS model 仍有差距。

和 VALL-E 相比，兩者都用 Encodec：

- VALL-E：discrete RVQ token + hierarchical residual prediction。
- SLED：continuous latent + lightweight per-step MLP。

SLED 不需要額外約 159M 的 local NAR residual decoder，而是約 35M per-token generative module，parameter efficiency 更好。

### Streaming inference

Streaming mode 的 DNSMOS 接近 offline：

- Offline：WER-C 1.67 / DNSMOS 3.58。
- with Prompt：WER-C 1.51 / DNSMOS 3.61。
- Streaming 5:20：WER-C 2.18 / DNSMOS 3.59。
- Streaming 5:45：WER-C 2.20 / DNSMOS 3.54。

也就是 streaming 會犧牲一些 word accuracy，但 perceived quality 幾乎不掉。

### Energy Distance vs RMSE

這是 paper 最重要的 ablation：

- RMSE objective：WER-C **40.60**。
- Energy Distance：WER-C **1.59**。

作者說移除 repulsive term 後，模型幾乎不能正常生成 speech。這支持他們的主張：continuous latent AR 不能只做 regression，必須學 distribution。

### CFG

CFG 對 text-speech alignment 很重要：

- 沒 CFG 時 streaming WER-C 可高到 6.01。
- `lambda = 1.5` 後 WER-C 快速降到約 2.0。
- 但 CFG 太強會傷害 timbre cloning 和 perceived quality；streaming 下 `lambda = 2.5` 甚至比不用 CFG 品質更差。

### Efficiency vs DiTAR

SLED 和 DiTAR 都是 continuous AR speech modeling，但切入不同：

- DiTAR：semi-autoregressive patching，減少 sequential steps，但每 step 用較重的 DiT local decoder。
- SLED：保留 AR step，但每 step sampling 很輕。

10 秒 audio 推論比較：

- SLED：0.2B params，RTF 0.8，FLOPs 280G。
- DiTAR patch size 4：0.6B params，RTF 0.66，FLOPs 2750G。

SLED RTF 接近，但 FLOPs 約少一個量級，params 約三分之一。

## Project relevance

### 對 project-one-step-audio-generation

SLED 不是「整段 audio one-step」generator，但它對 one-step audio generation 很重要，因為它提供了 **per-token / per-frame one-step continuous latent sampling**：

```text
AR context z_t
  -> lightweight g(z_t, noise)
  -> one forward pass
  -> h_t
```

這和 diffusion / flow per-token iterative sampling 相比，延遲更低。對我們的 one-step audio project，它可以作為一條 candidate route：

- 不一定要 discrete codec tokens。
- 不一定要 per-frame diffusion。
- 可以用 Energy Distance / MMD-style objective 直接訓練 continuous latent distribution。
- 如果未來做 dual-channel A/B/mix generator，也可以考慮在 continuous latent space 上對每個 channel 做 distributional modeling。

### 對 project-tts-data-pipeline

這篇對資料管線的啟發是：**latent encoder / tokenizer choice 會深刻影響 downstream LM**。

作者用 Encodec 的 continuous representation，但不是直接取 waveform autoencoder latent，而是 sum multi-codebook embeddings，並指出 quantization-regularized / KL-regularized latent 對 downstream LM 有幫助。這和我們之前討論 iFID / codec suitability 一致：reconstruction 好不代表 generative modeling 好，latent space 是否適合 AR / diffusion / flow 更重要。

對 TTS data pipeline，這表示資料處理不只是 cleaning transcript，也要評估：

- continuous latent 是否穩定；
- codec frame rate 是否適合 streaming；
- latent 是否保留 speaker/prosody/content；
- latent 是否能被 generator distributionally modeled；
- data filtering 是否應在 latent space 做 outlier detection。

### 對 project-full-duplex-data

Full-duplex dual-channel generation 需要 low-latency streaming。SLED 的 interleaved text/speech streaming policy 很有參考價值：

```text
receive text/control tokens incrementally
  -> generate a short chunk of speech latents
  -> decoder streams waveform
```

如果未來要從 transcript/control signals 生成 dual-channel A/B conversation，可以考慮：

- continuous latent A channel；
- continuous latent B channel；
- mixture-consistency latent / waveform loss；
- energy-distance objective for A, B, and A+B distributions；
- streaming interleaving policy for backchannels / overlap。

## Related papers in my pool

- [[arxiv_2604_28190|Representation Fréchet Loss]]：都把 distributional distance 用作 training signal；SLED 是 per-token Energy Distance，FD-loss 是 representation-level Fréchet objective。
- [[arxiv_2603_05630|Making Reconstruction FID Predictive of Diffusion Generation FID]]：都支持「latent representation 是否適合 generation」比 reconstruction metric 更重要。
- [[arxiv_2501_01423|Reconstruction vs. Generation]]：VA-VAE / VF Loss 也是 latent design for generation suitability。
- [[arxiv_2606_03972|AAD-1]]：AAD-1 是 one-step video AR distillation；SLED 是 speech continuous latent AR one-forward sampling。
- [[arxiv_2601_03170|TED-TTS]]：TED-TTS 做 segment-level controllable TTS；SLED 提供另一條 continuous latent streaming synthesis backbone。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

**應該細讀。**

這篇對我們的 audio generation roadmap 很關鍵，因為它把「不要離散化 speech」這件事做成了可訓練、可 streaming、推論效率合理的系統。最值得讀的是：

- Energy Distance objective 和 repulsive term；
- continuous latent representation choice；
- streaming interleaving policy；
- RMSE failure ablation；
- SLED vs DiTAR efficiency comparison。

如果要設計 one-step / low-latency full-duplex audio generator，這篇可以和 FD-loss / iFID / TED-TTS 放在同一條 representation-and-objective 線上。

## 可能的弱點 / open questions

1. **目前只驗證 speech synthesis，不是 general-purpose speech LM**  
   作者也說未來才要 extension 到 broader speech LM。對 speech reasoning / full-duplex interaction 還需要更多任務驗證。

2. **speaker cloning 仍落後強 TTS systems**  
   WER 很強，但 SIM 和 MegaTTS 3 / Llasa 這類強系統仍有差距，voice cloning fidelity 還不是終點。

3. **latent encoder 不是為 SLED 專門訓練**  
   作者用 Encodec embeddings，並指出專門為 continuous LM 訓練 latent encoder 可能更好。這正是未來研究空間。

4. **Energy Distance sampling cost / variance 還需更大 scale 驗證**  
   每步需要兩個 model samples 估計 repulsive term；大模型、大 batch 或更長 sequence 下的穩定性仍要看。

5. **streaming 犧牲 word accuracy**  
   DNSMOS 接近 offline，但 WER 從 1.67 升到 2.18/2.20。對 real-time dialogue 可以接受多少，需要任務化評估。

6. **full-duplex dual-channel 尚未處理**  
   SLED 是 single-stream speech latent generation；要變成 dual-channel A/B/mix generator，還需要 multi-stream conditioning、speaker separation、overlap modeling 和 mixture consistency。

## Tags

- `speech-llm`
- `tts`
- `continuous-latent`
- `autoregressive-generation`
- `streaming-tts`
- `energy-distance`
- `project-one-step-audio-generation`
- `project-tts-data-pipeline`
- `project-full-duplex-data`

## Concepts

- `SLED`
- `continuous speech language modeling`
- `energy distance`
- `generalized energy distance`
- `MMD`
- `continuous latent space`
- `streaming inference`
- `classifier-free guidance`
- `Encodec latent`

## Citation

```bibtex
@misc{ma2025efficientspeechlanguagemodelin,
  title={Efficient Speech Language Modeling via Energy Distance in Continuous Latent Space},
  author={Zhengrui Ma and Yang Feng and Chenze Shao and Fandong Meng and Jie Zhou and Min Zhang},
  year={2025},
  eprint={2505.13181},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2505.13181}
}
```
