---
paper_key: arxiv_2606_24888
canonical_id: "arxiv:2606.24888"
title: "DiffusionBench: On Holistic Evaluation of Diffusion Transformers"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.24888"
pdf_url: "https://arxiv.org/pdf/2606.24888"
status: read
rating: 0
tags:
  - diffusion
  - evaluation-metrics
  - benchmark
  - text-to-image
  - representation-autoencoder
  - meanflow
  - project-audio-model-evaluation
  - project-generative-speech-representation-evaluation
  - project-one-step-audio-generation
created: 2026-06-27
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sec/*.tex`, `tables/*.tex`) and the official release links embedded in the abstract.

## Links

- [Original URL](https://arxiv.org/abs/2606.24888)
- [arXiv abstract](https://arxiv.org/abs/2606.24888)
- [PDF](https://arxiv.org/pdf/2606.24888)
- [arXiv source](https://arxiv.org/src/2606.24888)
- [Official GitHub repo](https://github.com/End2End-Diffusion/diffusion-bench)
- [Official Hugging Face models](https://huggingface.co/diffusion-bench)
- [Blog / project page](https://end2end-diffusion.github.io/diffusion-bench/)
- [Discord](https://discord.gg/jh5Bz8uHEr)

## 一句話總結

這篇指出 DiT 研究只看 class-conditional ImageNet FID 會產生錯誤結論：作者用統一框架 **NanoGen** 同時訓練 ImageNet 和 text-to-image (T2I) models，發現 ImageNet ranking 和 T2I metrics 沒有強相關，Pearson correlation 約 -0.377 到 -0.580；因此提出 **DiffusionBench**，要求未來 DiT 方法至少同時報 ImageNet + T2I，而不是只報單一 FID。

## 這篇在解決什麼問題

Image generation 的 DiT paper 很常只報 ImageNet-256 class-conditional FID。這很方便，也讓方法可比較，但問題是：

- ImageNet 是 narrow benchmark，不代表 real T2I / prompt-following capability。
- 當 FID 都擠在 1-2 之間時，小幅改善可能是 task-specific trick，不一定是 broadly better generative modeling。
- T2I 被認為工程成本高、資料 pipeline 不同、evaluation 不同，所以很多方法沒有跑。

作者想回答一個很直接的問題：

> 如果一個 DiT 方法改善 ImageNet FID，它是否也改善 T2I generation？

結論是否定的。ImageNet 的 broader category signal 還有用，例如 improved latent-space methods 整體比 pixel-space / MeanFlow 好，但在 frontier 方法之間，ImageNet ranking 不能可靠預測 T2I ranking。

## 核心方法

### 1) NanoGen：統一 DiT training / evaluation framework

NanoGen 的目標不是提出新 architecture，而是把「跑 T2I 很麻煩」這個工程門檻降下來。

它共用：

- one DiT backbone
- one optimiser
- one training loop
- one evaluation harness
- one config format

ImageNet -> T2I 主要只換兩件事：

1. data pipeline：class-labelled ImageNet -> captioned image corpus。
2. conditioning module：class embedder -> frozen text encoder。

其他 backbone、loss、optimizer、EMA、sampler 都盡量保持一致。因此作者說從 ImageNet config 到 T2I config 約 12 lines of configuration change。

### 2) 支援多種 diffusion / representation route

NanoGen 支援：

- RAE latent-space generation。
- VAE latent-space generation。
- pixel-space generation。
- REG。
- MeanFlow one-/few-step generation。

它用 DDT-style backbone：28-layer encoder width 1152 + 2-layer decoder width 2048，約 615M parameters。encoder 接 noisy visual tokens 和 conditioning tokens，decoder 預測 diffusion target。

### 3) Evaluation axes

ImageNet：

- FID
- IS
- FDr
- MIND

T2I：

- GenEval
- DPG-Bench
- GenAIBench / VQAScore

作者的主張不是「ImageNet 沒用」，而是「ImageNet 不能單獨代表 DiT progress」。DiffusionBench 把 ImageNet 和 T2I 結果放在一起，讓方法改善單一軸時不能假裝成全面進步。

## Training / Data

ImageNet setup：

- Dataset：ImageNet 256x256。
- Preprocessing：ADM-style center crop。
- Training budget：80 epochs，batch size 1024。
- LR warmup：40 epochs。
- Evaluation：50,000 generated images，50 per class。

T2I setup：

- Text encoder：Qwen3-0.6B final hidden states as conditioning tokens。
- Data：JourneyDB + BLIP-3o Long-Caption / Short-Caption splits。
- Batch size：1024。
- Training：100K iterations。
- Conditioning dropout：10% for CFG。
- CFG：scale 6.0 across the whole timestep interval。
- 作者刻意只報 pre-training stage，避免用 BLIP-3o-60K SFT 直接 overfit / hack GenEval 類 benchmark。

Reproducibility validation：

- re-train RAE、E2E-VAE / REPA-E family、PixNerd、JiT、PixelGen。
- NanoGen 結果大致 match 或優於原 paper numbers，用來證明框架足以做 cross-task comparison。

## 主要結果

### 1) ImageNet ranking 和 T2I ranking 不強相關

作者訓練 21 個 latent diffusion models，發現 ImageNet FID 和 T2I metrics 的 Pearson correlation 約在 **-0.377 到 -0.580**。也就是 ImageNet FID 變好，不代表 GenEval / DPG-Bench / GenAIBench 會變好。

這是本文最重要結論：單一 class-conditional FID 的 improvement 不足以支持「方法普遍更好」。

### 2) RAE / VAE / pixel / MeanFlow 的大方向仍有訊號

若看粗 category：

```text
improved latent-space methods (RAE, FLUX.2-VAE, REPA-E)
  > traditional latent-space methods
  > pixel-space methods
  > MeanFlow
```

這表示 ImageNet 不是完全無用；它對大類別仍有 signal。但在 frontier 方法和同類方法內，ranking 很容易翻轉。

### 3) ImageNet systematic result

ImageNet with CFG 上：

- FLUX.2-VAE 取得最好 FID，約 1.37。
- REPA-E / E2E VAE family 在 1.5-1.6 附近。
- RAE family 稍高，較好的約 1.7-1.9；DINOv3-B 在 RAE 中最好。
- traditional SD-VAE / SD3.5-VAE 明顯落後。
- pixel-space methods 在 80 epochs 通常比 latent-space FID 高。
- MeanFlow one-/two-step 在此設定仍落後 multi-step methods。

作者也指出，80 epochs 下的差距很可能有一部分是 convergence speed：well-structured latents 如 RAE / REPA-E 讓 diffusion 更快學好。

### 4) T2I systematic result

T2I 上，NanoGen 的 pre-trained-only models 不如 public frontier T2I models，這符合預期；但它們足以比較 method transfer。

例子：

- E2E-Qwen-Image-VAE 在 GenEval 達 0.691。
- FLUX.2-VAE + REG 在 GenEval 達 0.687。
- RAE LangPE-L / DINOv3 variants 約 0.63-0.64。
- MeanFlow NFE=1 / 2 在 T2I 明顯低：GenEval 0.287 / 0.341。

作者也觀察到 200K steps 的 visual quality 比 100K 好，但某些 metrics 變化不大，代表 T2I metrics 仍不夠敏感。

### 5) T2I training cost沒有想像中高

作者在 32 H200 上記錄 100K steps 的 wall-clock time。T2I training 對 latent-space methods 的成本和 ImageNet 同量級。MeanFlow 的 T2I 較慢，因為 `torch.jvp` 計算 MeanFlow objective 有額外 overhead。

## Project relevance

### project-audio-model-evaluation：高相關，但屬於 image-side methodology

這篇對 audio evaluation 的核心啟發是：**不要讓單一 benchmark / metric 變成研究方向的唯一代理目標**。

對 audio 來說，對應關係很直接：

- ImageNet FID 對 DiT，不應等同於 audio 的 FAD / CLAP / WER / MOS。
- T2I prompt-following 對 audio，類似 AnyAudio-Judge / MMAE / full-duplex rubrics。
- DiffusionBench 的 multi-axis reporting，可改成 AudioDiffusionBench / SpeechGenerationBench。

如果我們做 audio generator，應該至少同時報：

- distribution quality：FAD / FD-loss / audio representation FD。
- content correctness：ASR WER / transcript adherence。
- speaker / style：speaker similarity、emotion / prosody matching。
- instruction following：AnyAudio-Judge / MMAE-style rubrics。
- task-specific axis：full-duplex overlap/backchannel timing、TTS long-form stability、speech+sound mixed audio correctness。

### project-generative-speech-representation-evaluation：高相關

這篇和 RAE / VAE / representation route 很接近。它提供一個重要警訊：representation 在 ImageNet FID 上好，不代表在 T2I condition-following 上也好。

對 speech 版本：

- codec / VAE / continuous encoder 在 reconstruction 或 unconditional generation 上好，不代表在 TTS / voice cloning / dialogue generation / speech+sound prompt-following 上好。
- representation benchmark 不能只看 audio-iFID 或 reconstruction FAD，也要看 downstream conditional tasks。
- compute-to-quality metrics 應該跨 task 報，而不是只報單一 downstream TTS WER。

### project-one-step-audio-generation：中高相關

NanoGen 支援 MeanFlow one-/few-step generation，但結果顯示在該設定下 MeanFlow 明顯落後 multi-step models。這對 one-step audio 很有參考價值：

- one-step / few-step 應該作為獨立 evaluation axis，不應只在一個 easy benchmark 上報。
- 要同時報 quality、conditional correctness、training cost、sampling cost。
- 若 one-step audio 在 FAD 上進步，但 WER / speaker similarity / overlap timing 退步，就不應宣稱全面進步。

## Related papers in my pool

- [[arxiv_2510_11690|Diffusion Transformers with Representation Autoencoders]]：DiffusionBench 引用並納入 RAE route；對 speech VAE / codec representation evaluation 是核心 image-side reference。
- [[arxiv_2605_18324|Improved Baselines with Representation Autoencoders]]：同樣聚焦 RAE baseline 與 training efficiency；DiffusionBench 把這類 representation route 放到 ImageNet + T2I 雙軸測。
- [[arxiv_2501_01423|Reconstruction vs. Generation]]：提醒 reconstruction 和 generation metric 不等價；DiffusionBench 則提醒 single-task generation metric 和 conditional generation metric 也不等價。
- [[arxiv_2604_28190|Representation Fréchet Loss]]：FDr / representation FD 出現在 DiffusionBench 的 ImageNet metrics；可借到 audio distribution evaluation，但仍需要 conditional axis。
- [[arxiv_2511_13019|MeanFlow Transformers with Representation Autoencoders]]：one-step / few-step RAE route；DiffusionBench 的 MeanFlow 結果提醒 one-step 方法必須跨 task 報告。
- [[arxiv_2606_14700|RepFusion]]：同樣討論 representation / T2I evaluation 和 benchmark overfitting；可與 DiffusionBench 一起作為 audio evaluator 防 reward-hacking 參考。
- [[arxiv_2606_07229|MMAE]]、[[arxiv_2606_03116|AnyAudio-Judge]]：audio-side multi-axis / rubric benchmark，可視為 audio 版 DiffusionBench 的組件。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。這篇目前以 arXiv preprint 記錄。

## 我該不該細讀

建議讀，尤其如果你在設計 **audio model evaluation / generative speech representation benchmark / one-step audio generation reporting**。

最值得讀：

- NanoGen 如何把 ImageNet 和 T2I 放到同一 training/eval framework。
- ImageNet-T2I ranking correlation 的設計。
- RAE / VAE / pixel / MeanFlow 的 systematic tables。
- discussion 裡對 single-benchmark evaluation 的限制。

如果只想找 speech/TTS model architecture，這篇不是直接相關；它的價值在 evaluation philosophy 和 benchmark engineering。

## 可能的弱點 / open questions

1. **仍是 image-side evidence**

   結論不能直接推到 audio，但「single benchmark 不足」這個原則很可能成立。

2. **scale 仍有限**

   作者也承認 ImageNet-T2I correlation 是在可負擔的 scale / budget 下觀察到，其他 scale 可能不同。

3. **T2I metrics 自身仍不完美**

   GenEval、DPG-Bench、GenAIBench 彼此也會 disagree；作者甚至觀察到 200K steps 視覺上更好但 metrics 改善有限。

4. **DiffusionBench 需要持續更新**

   作者明確說它不是 permanent benchmark。這點對 audio 更重要，因為 audio rubrics / judges 會更快被 reward-hack。

5. **MeanFlow 結果不是 one-step 方法最終判決**

   NanoGen 的 MeanFlow 設定落後，但不能代表所有 one-step methods 都不行；它只是說 one-step axis 要嚴格、跨任務測。

## Tags

- `diffusion`
- `diffusion-transformer`
- `evaluation-metrics`
- `benchmark`
- `text-to-image`
- `representation-autoencoder`
- `VAE`
- `MeanFlow`
- `one-step-generation`
- `project-audio-model-evaluation`
- `project-generative-speech-representation-evaluation`
- `project-one-step-audio-generation`

## Concepts

- DiffusionBench
- NanoGen
- holistic evaluation
- ImageNet FID vs T2I metrics
- cross-task ranking correlation
- Representation Autoencoder
- VAE tokenizer
- pixel-space diffusion
- MeanFlow
- GenEval
- DPG-Bench
- GenAIBench
- FDr
- MIND
- benchmark hacking
- multi-axis reporting

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{leng2026diffusionbenchonholisticevalua,
  title={DiffusionBench: On Holistic Evaluation of Diffusion Transformers},
  author={Xingjian Leng and Jaskirat Singh and Zhanhao Liang and Ethan Smith and Martin Bell and Aninda Saha and Yuhui Yuan and Liang Zheng},
  year={2026},
  eprint={2606.24888},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2606.24888}
}
```
