---
paper_key: arxiv_2606_32039
canonical_id: "arxiv:2606.32039"
title: "GEAR: Guided End-to-End AutoRegression for Image Synthesis"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.32039"
pdf_url: "https://arxiv.org/pdf/2606.32039"
status: read
rating: 8
tags:
  - visual-generation
  - autoregressive-generation
  - tokenizer
  - representation-alignment
  - project-generative-speech-representation-evaluation
  - project-one-step-audio-generation
created: 2026-07-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sec/1_intro.tex`, `sec/3_method.tex`, `sec/4_experiment.tex`, `sec/discussion.tex`, `sec/6_appendix.tex`). This is an image-generation paper, included because its tokenizer/generator co-training result is directly relevant to speech/audio codec, VAE, tokenizer, and representation learnability.

## Links

- [Original URL](https://arxiv.org/abs/2606.32039)
- [arXiv abstract](https://arxiv.org/abs/2606.32039)
- [PDF](https://arxiv.org/pdf/2606.32039)
- [arXiv source](https://arxiv.org/src/2606.32039)
- [Project page](https://linb203.github.io/gear)
- [Official GitHub repo](https://github.com/Tencent-Hunyuan/GEAR)
- [HuggingFace collection](https://huggingface.co/collections/BinLin203)

## 一句話總結

GEAR 主張 visual tokenizer 不應只為 reconstruction 訓練後凍住，而應該讓 downstream autoregressive generator 反過來 guide tokenizer：它用 hard branch 訓練 AR next-token prediction，用 differentiable soft assignment branch 只把 representation-alignment loss 傳回 tokenizer，讓 tokenizer 產生更容易被 AR 學會的 discrete token distribution，ImageNet gFID convergence 最多比 LlamaGen-REPA 快 10x。

## 這篇在解決什麼問題

現代 image generation 常用兩階段流程：

```text
image
  -> tokenizer / VQ-VAE / VAE reconstruction training
  -> freeze tokenizer
  -> train generator on discrete indices or continuous latents
```

這個流程方便，但有一個核心問題：tokenizer 只知道怎麼 reconstruct image，不知道它產生的 latent / token sequence 對 downstream generator 來說是否容易 modeling。

作者指出 reconstruction 和 generation 的目標不完全一致：

- reconstruction 喜歡 detail-rich、高變異、保留 sample-specific information 的 latent。
- generation 喜歡 predictable、structured、容易用 causal model 學的 token distribution。

Diffusion 方向已經有 REPA、VA-VAE、MAETok、REPA-E 等 representation alignment 方法，讓 diffusion model 或 VAE latent 對齊 DINOv2 這類 pretrained vision encoder。但 discrete AR generation 更難，因為 VQ index 是 non-differentiable `argmax`，AR loss 無法直接回傳給 tokenizer。直接用 straight-through estimator (STE) 會 collapse。

GEAR 的問題設定就是：**如何讓 AR generator end-to-end guide discrete tokenizer，同時避免 NTP loss 把 codebook 壓成低 entropy collapse？**

## 核心方法

### 1. Conventional baseline

Baseline 是 LlamaGen / LlamaGen-REPA 類 pipeline：

```text
VQ tokenizer:
  image x -> encoder E -> latent z -> nearest codebook index q -> decoder D -> reconstruction

AR generator:
  q_1, ..., q_N
  -> causal transformer
  -> next-token prediction
```

LlamaGen-REPA 會把 AR hidden state 對齊 DINOv2 features，但 tokenizer 仍然 frozen。

### 2. GEAR 的 hard / soft dual read-out

GEAR 對每個 spatial position 算 codebook assignment score `A_i`，然後用兩種方式讀出 token embedding：

```text
hard read-out:
  argmax(A_i) -> one-hot token -> AR embedding E_q

soft read-out:
  softmax(A_i / tau) -> weighted sum of AR embeddings
```

hard branch 完全符合 inference-time discrete token，因此用來訓練 AR 的 next-token prediction (NTP)。

soft branch 是 differentiable，因為它不是 `argmax`，而是 temperature-scaled code assignment mixture。這條 branch 讓 gradient 可以從 AR representation alignment objective 回到 tokenizer encoder / codebook。

### 3. 只讓 alignment loss 回傳 tokenizer，不讓 NTP loss 回傳

這是 GEAR 最關鍵的設計。作者明確避免把 NTP loss 傳回 tokenizer，因為若讓 tokenizer 直接為了「讓下一個 token 更容易預測」而調整，最容易得到低 entropy / 少數 code collapse，犧牲 reconstruction。

GEAR 的 optimization 是 decoupled：

```text
tokenizer update:
  L_VQ + lambda * L_align_soft

AR update:
  L_NTP + lambda * L_align_hard
```

其中：

- `L_VQ`：reconstruction + LPIPS + GAN + entropy + commitment。
- `L_NTP`：causal next-token prediction。
- `L_align_hard`：hard branch AR hidden state 對齊 DINOv2，更新 AR。
- `L_align_soft`：soft branch hidden state 對齊 DINOv2，但只更新 tokenizer。

直覺上，AR 沒有直接命令 tokenizer「讓 token 更好猜」；它透過 representation alignment 給 tokenizer 一個較穩的 guidance signal，讓 tokenizer 重排 code usage，使 AR 更容易學出 DINOv2-like local structure。

### 4. 和 diffusion-side recipe 的差異

有趣的是，GEAR 的結論和 diffusion-side representation alignment 相反。

在 diffusion / RAE / REPA-E 裡，常見策略是讓 latent 本身更 semantic、更像 DINOv2。

在 GEAR 裡，tokenizer 自己的 features 反而變得 **less DINOv2-like**，尤其 patch-level similarity 明顯下降。但 AR generator 的 hidden states 變得更 DINOv2-like，且更有 local / spatially coherent structure。

作者的解讀是：discrete AR 不直接 consume tokenizer continuous feature，而是 consume code indices。tokenizer 不需要自己像 DINOv2；它需要發出一組 AR 容易預測、容易在 AR hidden state 中形成 semantic/local representation 的 tokens。

## Training / Data

### Class-conditional ImageNet

主要實驗在 ImageNet-1K 256x256 class-conditional generation。

Metrics：

- generation：gFID、sFID、Inception Score、Precision、Recall。
- reconstruction/tokenizer：rFID、PSNR、SSIM。
- representation analysis：CKNNA、CKA、Moran's I、FFT high-frequency ratio。

主要 baseline：

- LlamaGen。
- LlamaGen-REPA。
- DiT / SiT / MDT / MDTv2 / SiT-REPA / REPA-E 作為 latent diffusion references。

GEAR 的 main system result 使用一個重要 protocol：

1. 先用 400k-step joint end-to-end run 得到 GEAR-tuned tokenizer。
2. 對主結果，freeze 這個 tokenizer。
3. 用和 LlamaGen-REPA 相同 AR architecture / training budget 訓練 fresh AR。

這樣比較可以 isolate tokenizer contribution：主結果中兩者 AR recipe 相同，差別主要是 tokenizer 是否被 end-to-end guided 過。

### Text-to-image GPIC

作者也做 text-to-image generation：

- Dataset：GPIC，約 100M images。
- Text encoder：Qwen3-1.7B。
- Training：single epoch，約 390k steps，batch size 256。
- Model：strict autoregressor over concatenated text and image tokens，採 MMDiT-style hybrid stream design，但 attention 仍是 causal。
- Metrics：FDD / Precision / Recall / Coverage / MMD；也報 GenEval、DPG-Bench、CLIP Score、COCO val FID。

這裡 GEAR 和 LlamaGen-REPA 同樣共享 training recipe，只改 tokenizer。

## 主要結果

### 1. ImageNet 上 GEAR 穩定優於 LlamaGen-REPA

300 epochs、class-conditional ImageNet：

- 111M AR with CFG：gFID 從 LlamaGen-REPA 6.00 降到 GEAR 4.95。
- 343M AR with CFG：3.15 降到 2.95。
- 775M AR with CFG：2.68 降到 2.52。

800 epochs：

- 111M：5.30 -> 4.35。
- 343M：2.92 -> 2.72。
- 775M：2.57 -> 2.45。

GEAR 不是全面超過最強 latent diffusion。REPA-E 仍然更強，尤其是因為 continuous VAE reconstruction ceiling 更高。但在 AR discrete-token 路線裡，GEAR 明確改善 LlamaGen-REPA。

### 2. Convergence 明顯變快

作者 claim ImageNet gFID convergence 最多比 LlamaGen-REPA 快 10x。GPIC text-to-image training dynamics 也顯示：

- AR 用 GEAR tokenizer 時，到達 baseline final NTP loss 需要的 steps 少 2.5x。
- 到達 baseline final REPA alignment loss 少 11.1x。

這對我們很重要：representation 不只是 final quality，還影響 **compute-to-quality**。一個好的 tokenizer / VAE / codec 應該讓 downstream model 更早學好。

### 3. Text-to-image GPIC 上同 budget 更好

在 GPIC 100M image single-epoch setup，GEAR 對 LlamaGen-REPA 的 FDD with CFG：

- 50k steps：279.6 -> 256.9。
- 100k：198.6 -> 177.4。
- 200k：153.5 -> 138.0。
- 390k：127.9 -> 115.3。

在 GenEval / DPG-Bench / CLIP Score / COCO FID 上，GEAR 也多數更好。作者也提醒，這些 prompt adherence scores 絕對值仍 modest，因為 single-epoch 256-resolution model 尚未充分收斂。

### 4. STE 直接 end-to-end 會 collapse

Ablation 中，使用 STE 的 naive end-to-end variant 非常差：

- gFID 104.932。
- rFID 59.723。

這支持作者核心設計：不能把 discrete argmax 硬用 STE 接起來，也不能讓 NTP loss 直接塑形 tokenizer。需要 soft assignment + alignment-only guidance。

### 5. 對 VQVAE / LFQ / IBQ 都有效

GEAR 在三種 quantizer 都改善：

- VQVAE：gFID 14.719 -> 10.630，rFID 1.724 -> 1.640。
- LFQ：18.681 -> 14.776，rFID 2.421 -> 2.129。
- IBQ：20.246 -> 12.972，rFID 1.973 -> 1.716。

這表示方法不是只吃某個 tokenizer architecture，而是比較一般的 discrete-token guidance mechanism。

### 6. Tokenizer 變 less DINOv2-like，但 AR 變 more DINOv2-like

Representation analysis 是這篇最值得看的部分：

- tokenizer features 對 DINOv2 的 patch-level CKA 從 0.1727 降到 0.1070。
- post-quantization patch-level CKA 從 0.1609 降到 0.0997。
- 但 AR hidden states 在 patch-level CKNNA / CKA 明顯比 LlamaGen-REPA 更接近 DINOv2。
- Moran's I 和 FFT high-frequency ratio 顯示 GEAR 的 AR features 更 spatially coherent / locally causal。

這個結果給出一個重要提醒：**representation 是否好，不一定等於 representation 自己是否 semantic；要看 downstream generator 能不能從它學出 useful internal representation。**

## Project relevance

### project-generative-speech-representation-evaluation

高相關，雖然它是 image paper。

這篇正好支持我們 project thesis：

```text
reconstruction quality
  != downstream generation quality

tokenizer / VAE / codec quality
  should be evaluated by downstream learnability and compute-to-quality
```

GEAR 對 speech/audio 的直接啟發：

1. **Speech codec / tokenizer 不應只看 reconstruction。**  
   EnCodec / DAC / WavTokenizer / SpeechTokenizer / AudioVAE 如果只用 PESQ、STOI、ViSQOL、FAD、mel loss 排名，可能選到 downstream TTS / speech generator 很難學的 representation。

2. **可以設計 generator-guided tokenizer tuning。**  
   對 discrete audio codec tokens，可以類比 GEAR：hard branch 訓練 AR speech/audio LM，soft或relaxed branch 只把 representation / semantic alignment loss 回傳 tokenizer，而不是把 NTP loss 直接回傳，避免 code collapse。

3. **compute-to-quality 是 metric。**  
   GEAR 的 2.5x / 11.1x loss convergence speed 提醒我們，speech representation benchmark 應該記錄 `EP_WER@x`、`EP_SIM@y`、`AUC_learning`，而不是只看 final WER / SIM。

4. **semantic alignment 應該看 downstream hidden states。**  
   GEAR tokenizer 自己 less DINOv2-like，卻讓 AR hidden states 更 DINOv2-like。對 speech 版來說，也許 audio codec latent 不必自己最像 HuBERT / WavLM / Whisper；重點是 downstream generator hidden states 是否更快形成 phonetic / speaker / prosody structure。

### project-one-step-audio-generation

中到高相關。One-step / few-step audio generator 對 representation 更敏感，因為它沒有多步 refinement。GEAR 提醒我們：

- 先用 generator-guided objective 挑或 tune tokenizer / VAE，再做 one-step distillation，可能比直接拿 reconstruction 最好的 codec 更穩。
- 若 speech AR / codec-token generator 的 token distribution 太高 entropy 或局部結構差，one-step model 會更難學。
- one-step audio project 應該把 training speed、loss convergence、token entropy、effective codebook size、speaker/content metrics 放在同一張 dashboard。

### project-tts-data-pipeline

間接相關。TTS data pipeline 若預先存 codec tokens / VAE latents / semantic tokens，這些 tokens 會決定 downstream generator 的難度。GEAR 支持一個 pipeline 原則：保存 representation 時不能只看 reconstruction；要測固定 training budget 下 TTS model 是否更快學到低 WER、高 speaker similarity、高 naturalness。

## Related papers in my pool

- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：提出 iFID，說明 reconstruction metric 不一定預測 generation quality。GEAR 是另一個角度：直接讓 generator guide tokenizer，並用 learnability / convergence speed 證明 tokenizer 是否好。
- [Reconstruction vs. Generation](../arxiv_2501_01423/)：VA-VAE / VF loss image-side reference，說明 reconstruction 和 generation 有 tension。
- [Diffusion Transformers with Representation Autoencoders](../arxiv_2510_11690/)：RAE / continuous semantic latent route。GEAR 則是 discrete AR route，兩者對「representation alignment 應該發生在哪裡」給出不同答案。
- [Improved Baselines with Representation Autoencoders](../arxiv_2605_18324/)：提出 EP_FID@k 類 training efficiency metric；和 GEAR 的 convergence speed claim 很契合。
- [WavCube](../arxiv_2605_06407/)：speech-side最接近的 evidence。它顯示 raw WavLM features 對 diffusion target 太難學，compact semantic-acoustic latent 才讓 downstream TTS 收斂。
- [SODA](../arxiv_2602_16687/)：audio foundation model scaling / validation NLL proxy；可借 GEAR 的 learnability framing，評估 tokenizer 是否讓 audio LM 更快學。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech tokenizer。可和 GEAR 的 generator-guided tokenizer 概念結合：text alignment 讓 token 更可控，generator guidance 讓 token 更容易被 downstream model 學。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free / continuous speech representation route；可和 GEAR 的 discrete VQ-AR route 對照。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議細讀，尤其是如果我們要做 **Generative Speech Representation Evaluation**。

最值得讀：

- Method：hard/soft dual read-out 和 decoupled optimization。
- Ablation：STE collapse、alignment coefficient、temperature、VQVAE/LFQ/IBQ。
- Representation analysis：tokenizer less DINOv2-like，但 AR more DINOv2-like。
- Discussion：discrete AR 的 reconstruction ceiling，以及 tokenizer compression 和 AR sequence length 被綁在一起的問題。

對 speech/audio 最有價值的 takeaway 是：

> 好 representation 不一定是自己最 semantic 或 reconstruction 最好，而是讓 downstream generator 用更少 compute 學到更好的 hidden structure 和 output quality。

## 可能的弱點 / open questions

1. **還是 image-only evidence。**  
   Speech/audio tokenization 有 duration、speaker、prosody、phoneme、noise、overlap 等結構，不能直接假設 GEAR 在 audio VQ tokenizer 上會穩。

2. **end-to-end cost 很高。**  
   作者主結果其實是先用 400k joint run tune tokenizer，再 freeze tokenizer 重訓 fresh AR。對大規模 speech codec / TTS 來說，這個成本需要納入 benchmark。

3. **soft assignment 對 audio codec 不一定自然。**  
   VQ image tokenizer 的 codebook assignment 可以 softmax over distances；multi-codebook RVQ audio codec、FSQ、semantic-acoustic split tokenizer 的 relaxed branch 要重新設計。

4. **NTP loss 不回傳 tokenizer是保守但可能限制。**  
   作者避免 NTP collapse 是合理的，但是否可以用 entropy regularization / KL / trust region 安全地讓一部分 LM loss 回傳 tokenizer，仍是 open question。

5. **prompt adherence 仍不強。**  
   Text-to-image GenEval / DPG-Bench 的 absolute score modest，顯示 tokenizer learnability 改善不等於完整 instruction following 解決。

6. **discrete AR reconstruction ceiling。**  
   作者承認 VQ-AR 被 16x compression / 256 tokens 限制；audio 也有類似 tradeoff：低 bitrate token 對 LM 友善，但可能丟 speaker/prosody/detail。

## Tags

#visual-generation #autoregressive-generation #tokenizer #VQVAE #representation-alignment #REPA #GEAR #project-generative-speech-representation-evaluation #project-one-step-audio-generation

## Concepts

- GEAR
- guided end-to-end autoregression
- VQ tokenizer
- autoregressive image generation
- hard / soft assignment
- representation alignment
- REPA
- DINOv2 alignment
- tokenizer learnability
- codebook usage
- next-token prediction
- straight-through estimator collapse
- compute-to-quality
- reconstruction-generation tension
- generator-guided tokenizer

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{lin2026gearguidedendtoendautoregressi,
  title={GEAR: Guided End-to-End AutoRegression for Image Synthesis},
  author={Bin Lin and Zheyuan Liu and Chenguo Lin and Sixiang Chen and Yunyang Ge and Yunlong Lin and Jianwei Zhang and Miles Yang and Zhao Zhong and Liefeng Bo and Li Yuan},
  year={2026},
  eprint={2606.32039},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2606.32039}
}
```
