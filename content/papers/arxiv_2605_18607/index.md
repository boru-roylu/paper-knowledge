---
paper_key: arxiv_2605_18607
canonical_id: "arxiv:2605.18607"
title: "Forecasting Downstream Performance of LLMs With Proxy Metrics"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.18607"
pdf_url: "https://arxiv.org/pdf/2605.18607"
status: read
rating: 7
tags:
  - llm
  - evaluation
  - forecasting
  - proxy-metrics
  - reasoning
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`preprint.tex`). This is an LLM evaluation / forecasting paper, not a direct speech/audio paper.

## Links
- [Original URL](https://arxiv.org/abs/2605.18607)
- [arXiv abstract](https://arxiv.org/abs/2605.18607)
- [PDF](https://arxiv.org/pdf/2605.18607)
- [arXiv source](https://arxiv.org/src/2605.18607)
- [Official GitHub repo](https://github.com/McGill-NLP/proxy-metrics)

## 一句話總結
這篇提出一組 **proxy metrics**：不用直接跑 expensive downstream evaluation，而是讓 candidate LLM 在 expert-written reasoning trajectories 上做 single forward pass，從 next-token distribution 的 agreement、uncertainty、rank、margin 等 token-level statistics 來預測 model / data / checkpoint 的 downstream performance。

## 這篇在解決什麼問題
LLM 開發常常要做比較決策：

- 哪個 model family / post-training recipe 比較好？
- 哪個 pretraining corpus 值得放大到 target scale？
- training 還沒結束時，最後 downstream score 大概會到哪裡？

傳統訊號有兩個問題：

1. **Cross-entropy loss** 很平滑、便宜、可外插，但常常和 downstream capability 對不齊，尤其是 reasoning task。
2. **Direct downstream evaluation** 最準但貴，而且 early checkpoint 常在 chance level，分不出好壞；有些 frontier task 還需要人工 expert、external environment、tool execution 或 expensive judge。

作者的核心想法是：即使一個 candidate model 還不能自己解出題目，它在讀 expert solution trajectory 時，對關鍵 token 的機率分布仍然會暴露它「是否已經學到 task structure」。所以 evaluation signal 不一定要來自 final answer，也可以來自 **candidate model 對 expert trajectory 的 token-level predictive behavior**。

## 核心方法
### 1) Expert trajectory 作為 evaluation substrate
對每個 downstream task instance，給定：

- prompt / problem `x`
- expert-written trajectory `y`

expert 可以是 human，也可以是更強的 model。candidate model 只需要在 `x + y` 上做 teacher-forced single forward pass，取得每個 trajectory token 的 next-token distribution：

```text
p_model(. | x, y_<t)
```

這裡不需要 candidate model generate，也不需要 access downstream evaluator。和 rBridge 相比，這篇也不需要 expert model 的 token-level logprobs；只需要 expert tokens 本身。

### 2) 80 個 proxy metrics
作者先定義 10 種 core token-level metrics，再搭配 8 種 weighting schemes，得到 80 個 proxy metrics。

Core metrics 包含：

- cross-entropy：expert token 的 negative log probability
- top-k accuracy：`k = 1, 2, 3, 5`
- entropy：candidate distribution 的 normalized entropy
- expert token rank
- reciprocal rank
- margin：top prediction probability 和 expert token probability 的差
- wrong-confidence：模型很有信心但 expert token 不是 top-1 時的錯誤信心

Weighting schemes 包含：

- uniform
- probability `p(y_t)`
- expert-disagreement `1 - p(y_t)`
- entropy
- inverse entropy
- token frequency
- inverse token frequency
- Gaussian-NLL kernel

每個 instance 的 proxy score 是 trajectory token 上的 weighted average；task-level proxy 則對 instances 平均。作者實作上只用 expert trajectory 的 **last 1,000 tokens**，而且這比全 trace 更好，可能因為後段更靠近答案與關鍵推理結構。

### 3) 從 proxy metrics 到 ranking / forecasting
在 cross-family model selection 裡，80 個 proxy metrics 變成一個低維 feature vector。作者比較四種 scorer：

- univariate proxy
- 3-sparse linear combination
- linear RankSVM
- RBF RankSVM

RankSVM 由 downstream scores 產生 pairwise preference，學一個能排序 candidate models 的函數。這個設計把問題從「直接預測分數」改成「預測相對排名」，比較符合 model selection 的實際需求。

在 training-time forecasting 裡，作者選定某個 proxy metric 後，用 power law：

```text
f(t) = a - b * t^{-c}
```

去外插未來 checkpoint 的 proxy 或 downstream accuracy。

## Training / Data
這篇不是訓練新模型，而是在三個 setting 裡驗證 proxy metrics。

### Cross-family model selection
評估 18 個 reasoning-capable LLM，橫跨六個 base families 和六種 post-training recipes，模型大小從 0.6B 到 70B。benchmark 包含：

- AIME 2025
- HMMT
- GPQA
- USACO
- MMLU-Pro
- SuperGPQA

Expert trajectories 來自三個強 reasoning models：

- Kimi-K2.5
- MiniMax-M2.5
- Qwen3-Next-80B

實驗 protocol 是 leave-2-tasks-out cross validation：用 held-in tasks 學 proxy-to-ranking，再看 held-out tasks 的 Spearman correlation。

### Pretraining data selection
使用 **DataDecide** testbed：

- 25 個 candidate pretraining corpora
- 4M 到 90M proxy models
- 對應的 1B target models
- ground truth corpus ranking 由 1B target model 在 OLMES suite 的 mean downstream accuracy 定義

目標是用非常便宜的小模型 proxy，預測哪個 corpus 放大到 1B 會比較好。

### Training-time forecasting
作者使用：

- OLMo-3-7B pretraining checkpoints
- OLMo-3-7B-Think post-training checkpoints

並用 OLMES / reasoning benchmarks 檢查 proxy metric 是否可以沿 training steps smooth extrapolate，以及是否能預測更晚 checkpoint 的 downstream score。

## 主要結果
### 1) Cross-family model ranking 明顯優於 loss baseline
平均 Spearman rho：

- FineWeb cross-entropy loss：0.36
- rBridge：0.33
- univariate proxy：0.54 ± 0.08
- 3-sparse proxy：0.78 ± 0.06
- RankSVM RBF：0.81 ± 0.05
- RankSVM linear：0.81 ± 0.04

這說明 generic CE loss 對 heterogeneous reasoning models 的相對排名很弱；但 task-conditioned expert trajectory metrics 能更接近真正 downstream ranking。

一個值得記的細節是：univariate proxy 常選到 **inverse-frequency-weighted top-1 accuracy**。也就是「candidate 是否在 rare expert tokens 上跟 expert 一致」比常見 function words 更有鑑別力。

### 2) DataDecide 上用很小 compute 排 25 個 corpora
DataDecide setting 裡，最佳 proxy 是 **frequency-weighted top-5 accuracy**。它在約 `1e-5` target compute 時，corpus pair decision accuracy 就超過 0.85；要用 direct downstream performance baseline 達到類似效果，約需要 `1e-1` target compute，差距約 10,000x。

這個結果的工程含義很強：如果有一套可信 expert trajectories，就有可能在 target-scale 訓練前，先用小模型或 early model 對 data recipe 做便宜篩選。

### 3) Training-time forecasting 比 CE / compute baseline 更準
在 downstream accuracy extrapolation 中，作者只用前 80K steps fit，預測 OLMo-3-7B 在 1.4M steps 的 OLMES scores，等於約 18x compute horizon。

平均 RMSE：

- Proxy metric：0.024
- FineWeb CE loss：0.059
- Compute-only fit：0.055

代表 proxy-to-accuracy relationship 比 pure loss 或 pure step count 更穩，至少在 OLMo-3-7B 這組 checkpoints 上如此。

## Project relevance
**project-audio-model-evaluation：高相關，但需要模型 logits。**

這篇可以補上我們前面討論 AnyAudio-Judge / PlanAudio / FlashTrace 時缺的一塊：怎麼在昂貴完整 evaluation 之前，先預測 model / checkpoint / data mix 是否值得繼續。

可借用的 audio / speech 版本：

```text
audio/speech task prompt
  -> expert answer / reasoning trace / rubric rationale / plan
  -> candidate audio LLM or speech reasoning model teacher-forced over text trajectory
  -> token-level proxy metrics
  -> forecast downstream judge score or task success
```

限制是很現實的：這個方法需要 candidate model 暴露 token probabilities / logits。Gemini 這種 black-box judge 或 closed audio model 通常不能直接用。比較可行的起點是 open audio LLM、speech LLM、或 ASR/transcript 後面的 text reasoning module。

**和 AnyAudio-Judge / PlanAudio / FlashTrace 的關係：**

- AnyAudio-Judge 提供 rubric labels / scores；proxy metrics 可以用來預測哪些 model / checkpoint / data recipe 將來會拿高分，減少每次都要 full generation + judge。
- PlanAudio 的 planning trajectories 可以變成 expert trajectories；candidate 是否能在關鍵 plan token 上跟 expert 對齊，可能比 final answer 更早暴露能力。
- FlashTrace 是 attribution / localization：它問「哪段 input/token 造成 judge decision」。這篇是 forecasting：它問「不用完整 judge，能不能從 expert-token agreement 預測未來 performance」。兩者可以合併成 `predict -> judge -> localize` 的 evaluation loop。

**project-tts-data-pipeline：中度相關。**

這篇不是 speech data cleaning paper，不會告訴你怎麼做 overlap detection、diarization、ASR correction 或 TTS transcript format。但它對「data recipe selection」有用：如果我們有 TTS / speech benchmark 的 expert traces、rubric explanations 或 discrete acoustic/text tokens，就可以用 proxy metrics 便宜比較：

- 哪個 cleaning threshold 比較好
- 哪個 corpus mixture 比較好
- 哪個 speaker/style/domain balance 比較好
- 哪個 early checkpoint 值得繼續訓練

對 raw waveform TTS generation 本身，直接套用較困難，除非模型有 discrete acoustic tokens 且能輸出 token probabilities。

**project-full-duplex-data：間接相關。**

Full-duplex 目標是把 mono-channel dialogue 轉成 dual-channel data，並訓練 given transcript/control signals 的 dual-channel audio generator。這篇可以用在 evaluation infrastructure，而不是資料切分本身：

- 用 expert dual-channel transcript / event tags / overlap markers 當 trajectories。
- 看 candidate model 是否在 backchannel、turn-taking、overlap timing、speaker event tokens 上給高 probability。
- 在正式生成 waveform 前，先預測某個 data conversion recipe 是否會改善 downstream full-duplex behavior。

## Related papers in my pool
- [[arxiv_2606_03116|AnyAudio-Judge]]：可提供 speech/audio rubric score；這篇可補上 cheap pre-screen / forecasting。
- [[arxiv_2605_28063|PlanAudio]]：planning trajectories 可作為 expert trajectories 的來源。
- [[arxiv_2602_01914|FlashTrace]]：可在 judge decision 後做 token-level attribution；本篇偏向 decision 前的 proxy forecasting。
- [[arxiv_2506_00338|OWSM v4]]：data cleaning / filtering 後，可用 proxy metrics 做 data recipe selection。
- [[arxiv_2605_26121|GEM]]：同樣和 data selection / data mixing 有關；GEM 建 taxonomy，這篇評估 candidate data recipe 是否值得放大。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX source 使用 NeurIPS 2026 preprint style，但截至 2026-06-06 我沒有找到正式 acceptance / proceedings metadata。

## 我該不該細讀
**建議細讀 method 和 experiments，不必把它當 speech paper 讀。**

如果我們要做 `audio-model-evaluation`，這篇值得放進核心方法庫，因為它提出的不是另一個 benchmark，而是一種更便宜的 **forecasting layer**：在 full judge / expensive generation / large-scale training 之前，先用 expert trajectories 的 token-level behavior 做 ranking。

最值得讀的部分：

- 80 proxy metrics 的定義與 weighting schemes。
- 為什麼 rare-token agreement 和 uncertainty-aware metrics 有用。
- DataDecide setting：如何用小 compute 預測 data corpus ranking。
- Training-time forecasting：如何把 proxy metric 和 power law 結合。

## 可能的弱點 / open questions
1. **需要 logits / probabilities**  
   對 closed black-box models 不好用。這會限制它直接套到 Gemini-style audio judge 或 closed speech models。

2. **沒有 universal best proxy**  
   最佳 proxy 隨 task、model population、selection protocol 改變。實務上需要 held-in tasks 來選 proxy，而不是盲目固定一個 metric。

3. **實驗仍偏 LLM reasoning / OLMES**  
   Cross-family ranking 是 reasoning benchmarks；data selection 和 extrapolation 主要用 OLMES non-reasoning multiple-choice。沒有證明 generative tasks、long-context、agentic tasks、audio tasks 也同樣成立。

4. **Expert quality 沒有充分 ablation**  
   方法假設 expert trajectories 足夠好，但如果 expert trace 有錯、風格偏、或對 speech/audio rubric 不穩，proxy 會怎麼退化還不清楚。

5. **對 TTS / waveform generation 需要 adapter**  
   如果輸出是 waveform 而非 text tokens，必須先找到可 teacher-force 的 discrete representation，例如 acoustic tokens、codec tokens、control tags 或 planning tokens。

## Tags
- `llm`
- `evaluation`
- `forecasting`
- `proxy-metrics`
- `reasoning`
- `project-audio-model-evaluation`
- `project-tts-data-pipeline`

## Concepts
- `expert trajectory proxy metrics`
- `token-level predictive distribution`
- `top-k expert token accuracy`
- `expert token rank`
- `entropy-weighted metrics`
- `wrong-confidence`
- `RankSVM model selection`
- `DataDecide`
- `pretraining data selection`
- `training-time forecasting`
- `downstream performance extrapolation`
- `OLMo-3 checkpoints`
- `rBridge comparison`

## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{patel2026forecastingdownstreamperforman,
  title={Forecasting Downstream Performance of LLMs With Proxy Metrics},
  author={Arkil Patel and Siva Reddy and Marius Mosbach and Dzmitry Bahdanau},
  year={2026},
  eprint={2605.18607},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2605.18607}
}
```
