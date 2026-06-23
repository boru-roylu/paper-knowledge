---
paper_key: arxiv_2606_14700
canonical_id: "arxiv:2606.14700"
title: "RepFusion: Leveraging Multimodal Priors for Denoising in Representation Space"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.14700"
pdf_url: "https://arxiv.org/pdf/2606.14700"
status: read
rating: 0
tags:
  - representation-autoencoder
  - multimodal-llm
  - text-to-image
  - diffusion-transformer
  - representation-space-generation
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
created: 2026-06-23
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`paper.tex`) and the official project page. This is an image / T2I paper, included because it extends the Representation Autoencoder line: once generation happens in semantic representation space, a frozen multimodal LLM can read noisy representations during denoising, not just static text.

## Links

- [Original URL](https://arxiv.org/abs/2606.14700)
- [arXiv abstract](https://arxiv.org/abs/2606.14700)
- [PDF](https://arxiv.org/pdf/2606.14700)
- [arXiv source](https://arxiv.org/src/2606.14700)
- [Project page](https://xichenpan.com/repfusion/)

## 一句話總結

RepFusion 的核心想法是：在 RAE 這種 semantically structured representation space 裡，frozen MLLM 不應只當一次性的 text encoder；它可以在每個 denoising step 讀取目前的 noisy representation，輸出 token-aligned conditioning 給 DiT，讓 pretrained multimodal perception prior 直接參與 denoising trajectory。

## 這篇在解決什麼問題

現代 text-to-image 系統常常有很大的 LLM / MLLM text encoder，但它通常只做一件事：

```text
prompt -> static text embedding -> DiT denoiser
```

也就是 LLM 很大、很有 world knowledge，卻只在 sampling 前跑一次。真正沿 denoising trajectory 做生成的是新訓練的 DiT / diffusion backbone。

RAE 改變了這個設定。傳統 VAE latent 偏 reconstruction / compression，和 MLLM 原本理解的 visual representation space 差距較大；RAE 則用 CLIP / DINO 類 pretrained visual encoder 的 semantic feature 當 generation space，讓 latent 更接近 MLLM 已經能讀的 visual tokens。

因此這篇問的是：

> 如果 generation target 已經是 semantic representation，能不能讓 frozen MLLM 直接讀 noisy representation，成為 denoising-time conditional encoder？

這和一般「把 text encoder 換大」不同，因為 RepFusion 的 conditioning 會隨著 `z_t` 變化，而不是 static prompt embedding。

## 核心方法

### 1. Representation-space flow matching

模型在 visual representation space 做 flow matching。Clean representation 是 `x`，noise 是 `epsilon`，noisy latent 是：

```text
z_t = t * x + (1 - t) * epsilon
```

模型學 conditional velocity field：

```text
v_theta(z_t, t, c_t) -> x - epsilon
```

其中 `c_t` 不是固定 text embedding，而是由 MLLM 讀 prompt + noisy visual tokens 得到。

### 2. Frozen MLLM as noisy representation encoder

RepFusion 的 MLLM input 是：

```text
[text tokens, projected noisy visual tokens]
```

具體做法：

```text
z_t + timestep embedding
  -> MLP projector P_psi
  -> append after text tokens
  -> frozen causal MLLM
  -> take last N hidden states for noisy visual tokens
  -> c_t
```

Sampling 時 `z_t` 每一步都變，所以 `c_t` 也每一步重新計算。這是 RepFusion 和 MetaQuery / static text embedding 的關鍵差異：test-time compute 不是單純重跑 encoder，而是重跑一個看到當前 denoising state 的 encoder。

### 3. Token-aligned AdaLN-Single conditioning

MLLM 輸出 `N` 個 noisy visual token hidden states，和 DiT 的 `N` 個 representation tokens 對齊。作者不用 cross-attention，而是用 PixArt-alpha / DDT 類的 AdaLN-Single：

```text
MLLM output + timestep embedding
  -> shared linear
  -> token-wise beta / gamma / alpha
  -> modulate each DiT block
```

因為 condition tokens 和 DiT tokens 一一對齊，modulation 可以是 token-wise，而不是整段序列 broadcast。

### 4. Preserve perception-pretrained MLLM prior

作者比較 language-only LLM 和 perception-pretrained MLLM，發現 perception pretraining 對 RAE denoising 明顯有幫助。更重要的是：如果 MLLM 已經有 multimodal perception prior，fine-tuning LLM backbone 反而可能傷害效果；最佳設定是 freeze MLLM，只訓練 projector 和 DiT。

直覺是：MLLM 已經學會讀 clean visual representations；RAE latent 讓 noisy representations 還保有可讀的 semantic structure，所以保留這個 prior 比重新 joint optimize 更好。

## Training / Data

模型設定：

- MLLM setup 類似 LLaVA：causal LLM backbone + CLIP-L/14 vision tower + MLP projector。
- RAE setup：input resolution 336，產生 `N=576` visual tokens。
- VAE baseline：DC-AE，512 resolution，`N=256` latent tokens。
- DiT patch size：1。
- 預設用 7B LLM backbone + 1.3B DiT 做 ablation；largest T2I config 用 7B MLLM + 3.2B DiT。

資料：

- Pretraining：BLIP-3o 31M dataset，包含 27M long-caption pairs 和 4M short-caption pairs。
- SFT：BLIP-3o 60k + ShareGPT4o-Image + Echo-4o，合計 200k synthetic dataset。
- SFT images 來源是 GPT-4o Image。

訓練：

- Pretraining：128 H200 GPUs，global batch size 2048，10 epochs / 160k steps。
- LR：`3e-4`，AdamW，`beta1=0.9`、`beta2=0.95`、weight decay 0.1，10k warmup + cosine decay。
- SFT：LR `1e-4`，64 epochs。

Decoder：

- RAE decoder：ViT-XL decoder + DINO GAN discriminator，patch size 24，output 576，ImageNet-22k 訓練 16 epochs。
- Diffusion decoder：follow Emu，從 SANA 1.6B checkpoint 開始，text condition 改成 CLIP features，output 512，ImageNet-22k 訓練 10 epochs。

## 主要結果

### 1. Noisy representation input 是關鍵，不是單純多花 compute

作者做 learnable-query / MetaQuery-style baseline：用 `N` 個 learnable queries 取代 noisy RAE latents，其他架構相同。

- Learnable query baseline：GenEval 0.55。
- RepFusion：GenEval 0.70。
- 把 learnable queries 做成 timestep-dependent、讓 inference FLOPs 接近 RepFusion：GenEval 0.54。

結論：提升不是因為重跑 conditional encoder 本身，而是因為 encoder 看到了 evolving noisy representation。

### 2. RAE latent 比 VAE latent 更能啟動 MLLM prior

從 TextEmbed baseline 出發：

- static text embedding baseline：GenEval 0.47。
- 讓 LLM 讀 noisy VAE latents：0.54。
- 換成 noisy RAE latents：0.64。
- 加 multimodal perception pretraining，且 frozen MLLM：最高到 0.70。

這支持一個重要觀點：RAE 不只是改善 decoder / reconstruction，它讓 generation latent 進入 MLLM 可理解的 representation space。

### 3. Frozen perception-pretrained MLLM 比 fine-tune 更好

Perception-pretrained MLLM 改善 Transfusion-RAE 和 RepFusion；但在 RepFusion-RAE 裡，fine-tuning 已有 perception prior 的 MLLM 可能降低效果。作者的解釋是：MLLM 的 perception prior 是有用的 denoising prior，應該保留，而不是讓它被 generation loss 重塑。

### 4. Prompt alignment / T2I benchmark

Largest config 用 7B MLLM + 3.2B DiT，在約 30M image-caption pairs 預訓練後有競爭力；SFT 後達到強結果：

- RepFusion w/ RAE Decoder：GenEval 0.73、GenEval++ 0.432、GenEval2 30.2、DPG-Bench 82.75。
- RepFusion w/ Diffusion Decoder：0.78、0.443、29.9、84.41。
- RepFusion-SFT w/ RAE Decoder：0.85、0.707、35.1、84.17。
- RepFusion-SFT w/ Diffusion Decoder：0.87、0.669、34.9、85.11。

作者也提醒 GenEval / DPG-Bench 容易受到 benchmark-specific SFT / RL 影響，因此 GenEval2 / Soft-TIFA 更能反映 robust prompt following。

### 5. Decoder 影響 texture / evaluator score，但 prompt layout 主要由 representation 決定

Appendix 比較 RAE decoder 和 diffusion decoder：同一個 CLIP representation 透過兩種 decoder 出來，layout 和 colors 類似，差異主要是 fine-grained texture。作者認為 RAE decoder 的 blurrier texture 可能讓 detector / VLM evaluator 較難評估，造成 GenEval / DPG-Bench score 差距。

這點對 audio 很有啟發：如果 generated representation 已經決定 content / layout，decoder/vocoder 主要影響 fine texture / timbre / artifact，那 evaluation 應該分開看 representation-level correctness 和 decoder-level fidelity。

### 6. Compute allocation：DiT 仍然重要，但 static text embedding 浪費了 encoder prior

RepFusion 有兩個 inference scaling axis：MLLM 和 DiT。Iso-FLOPs 結果顯示，在 RepFusion family 內，給 DiT 更多 compute 通常更有效；但 RepFusion 仍優於 TextEmbed，因為 TextEmbed 的 MLLM condition 是 static text embedding，無法隨 denoising state 改變。

代表性的約 540T FLOPs setting：

- TextEmbed baseline：7B LLM + 8B DiT，3% / 97% compute split，GenEval 0.64。
- RepFusion 1B MLLM + 7.3B DiT，13% / 87%，GenEval 0.70，GenEval++ 0.443。
- RepFusion 7B MLLM + 1.3B DiT，85% / 15%，GenEval 0.70，但 GenEval++ / GenEval2 較弱。

結論不是「MLLM 越大越好」，而是「encoder compute 只有在 condition input-dependent 時才值得花」。

## Project relevance

### project-generative-speech-representation-evaluation：高相關

這篇補強我們的核心假設：representation space 是否能被 pretrained model 理解，會影響 downstream generation。對 speech/audio 版，可以轉成：

```text
speech/audio representation
  -> WavCube / VoxCPM AudioVAE / codec / SSL latent
  -> noisy latent z_t
  -> speech/audio LLM or MLLM reads z_t + transcript/control
  -> condition audio DiT / flow model
```

如果 speech representation 夠 semantic，frozen speech LLM / audio LLM 可能不只做 transcript encoder，也能在 denoising loop 中反覆讀 noisy audio latent，提供 evolving condition。這比 static text prompt conditioning 更接近 RepFusion 的設計。

它也提醒我們 evaluation 要加一個 axis：

- representation 是否可被 pretrained encoder/LLM 讀懂？
- noisy version 是否仍可讀？
- repeated conditioning 是否真的比 static conditioning 有用？
- decoder/vocoder artifact 是否會污染 downstream evaluator？

### project-audio-model-evaluation：中到高相關

RepFusion 的 GenEval / GenEval2 討論對 audio judge 很有用：benchmark 可能被 synthetic SFT / RL overfit，所以 robust evaluator 很重要。對 audio 來說，AnyAudio-Judge 類 benchmark 若被用作 reward，也需要更穩的 held-out / Soft-TIFA-like protocol。

另外，decoder choice 會影響 evaluator score 但不一定影響 representation-level correctness。Audio 評估應分離：

- generated latent / representation 是否對。
- vocoder / decoder 是否引入 texture / timbre / artifact 問題。
- judge failure 是 semantic failure 還是 decoder artifact。

### project-one-step-audio-generation：間接相關

RepFusion 不是 one-step paper，但它和 MF-RAE / RAE line 一起說明：當 generation 在 semantic representation space 發生時，pretrained model priors 可以進入 denoising loop。對 one-step audio 而言，若每一步太貴，不能直接照搬 repeated MLLM conditioning；但可以用它來設計 teacher / critic / distillation condition。

## Related papers in my pool

- [Diffusion Transformers with Representation Autoencoders](../arxiv_2510_11690/)：RepFusion 直接建立在 RAE 方向上，重點從「RAE latent 適合 DiT」推到「RAE latent 可被 frozen MLLM 反覆讀取」。
- [MeanFlow Transformers with Representation Autoencoders](../arxiv_2511_13019/)：同樣是 RAE extension，但 MF-RAE 聚焦 one-step/few-step efficiency，RepFusion 聚焦 conditional encoder / MLLM prior。
- [WavCube](../arxiv_2605_06407/)：speech-side SSL-derived representation。RepFusion 給出一個可借鑑問題：WavCube-like noisy speech latent 能不能被 frozen speech/audio LLM 讀懂並輔助 denoising？
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：iFID 關注 latent geometry 是否預測 downstream generation；RepFusion 關注 latent space 是否 compatible with pretrained MLLM priors。
- [AnyAudio-Judge](../arxiv_2606_03116/)：RepFusion 的 benchmark-drift 討論提醒我們，audio judge 若進入 SFT/RL loop，必須防止 benchmark-specific overfitting。
- [PlanAudio](../arxiv_2605_28063/)：如果 speech+sound composite generation 要用 MLLM/AudioLLM conditioning，RepFusion 的 evolving noisy representation conditioning 是可借鑑的架構方向。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

**建議讀，但它是 image/T2I paper，不是 speech paper。**

對我們最有價值的部分：

- Method：MLLM 如何讀 `z_t + timestep embedding`，並把 last N hidden states 對齊 DiT tokens。
- Noisy representation input ablation：為什麼 repeated compute 必須 input-dependent 才有用。
- Perception pretraining / frozen LLM ablation：為什麼 pretrained prior 應保留。
- Decoder appendix：representation-level prompt following 和 decoder-level texture/fidelity 可以分開看。
- Iso-FLOPs scaling：如何比較 conditional encoder vs denoiser compute allocation。

## 可能的弱點 / open questions

1. **audio/speech 不一定有等價的 MLLM prior**
   Vision MLLM 能讀 CLIP/RAE-like representation，但 speech/audio LLM 是否能讀 noisy WavCube / codec / AudioVAE latent，還需要實驗驗證。

2. **test-time repeated MLLM conditioning 很貴**
   RepFusion 花大量 inference FLOPs 在 repeated MLLM conditioning。對 low-latency TTS / full-duplex audio，這可能不可接受，除非用小 speech LLM、cache、或只在少數 steps 使用。

3. **prompt-alignment benchmark 可能被 synthetic SFT 影響**
   作者自己也提到 GenEval / DPG-Bench 的 benchmark drift。Audio 版如果用 rubrics 做 RL，也會有同樣 reward hacking / benchmark overfitting 風險。

4. **decoder quality 會影響 evaluator**
   RAE decoder blurrier texture 可能讓 evaluator score 下降。Audio 版也會遇到：representation 正確但 vocoder artifact 讓 ASR / judge / speaker verifier 評分變差。

5. **沒有官方 code link**
   arXiv TeX 和 project page 公開，但 source 中未見官方 GitHub code URL；若之後釋出 code 應補上。

## Tags

- `representation-autoencoder`
- `multimodal-llm`
- `text-to-image`
- `diffusion-transformer`
- `representation-space-generation`
- `noisy-representation-conditioning`
- `project-generative-speech-representation-evaluation`
- `project-audio-model-evaluation`

## Concepts

- RepFusion
- Representation Autoencoder
- RAE latent
- noisy representation encoder
- frozen MLLM prior
- evolving noisy representations
- AdaLN-Single conditioning
- token-aligned conditioning
- test-time compute scaling
- representation-space diffusion
- decoder artifact
- GenEval
- GenEval2
- DPG-Bench
- WISE

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{pan2026repfusionleveragingmultimodalp,
  title={RepFusion: Leveraging Multimodal Priors for Denoising in Representation Space},
  author={Xichen Pan and Aashu Singh and Satya Narayan Shukla and Xiangjun Fan and Shlok Kumar Mishra and Saining Xie},
  year={2026},
  eprint={2606.14700},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2606.14700}
}
```
