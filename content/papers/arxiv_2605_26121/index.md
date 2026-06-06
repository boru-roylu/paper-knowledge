---
paper_key: arxiv_2605_26121
canonical_id: "arxiv:2605.26121"
title: "GEM: Geometric Entropy Mixing for Optimal LLM Data Curation"
year: 2026
venue: "ICML 2026 accepted-style source / arXiv preprint"
url: "https://arxiv.org/abs/2605.26121"
pdf_url: "https://arxiv.org/pdf/2605.26121"
status: read
rating: 6
tags:
  - llm
  - data-curation
  - data-mixing
  - taxonomy
  - project-tts-data-pipeline
created: 2026-06-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`). This is an LLM data-curation paper, not a direct speech/audio paper.

## Links
- [Original URL](https://arxiv.org/abs/2605.26121)
- [arXiv abstract](https://arxiv.org/abs/2605.26121)
- [PDF](https://arxiv.org/pdf/2605.26121)
- [arXiv source](https://arxiv.org/src/2605.26121)

## 一句話總結
**GEM** 把 LLM pretraining corpus 的 data categorization 重新寫成 hypersphere 上的 `vMF mixture + entropy / balance regularization` 問題，用來產生更平衡、更可控的 semantic taxonomy，讓 DoReMi、RegMix、Perf 這類 data mixing strategy 有更好的 mixing coordinates。

## 這篇在解決什麼問題
這篇的核心不是「清掉髒資料」，而是 **資料已經大致 cleaned 之後，怎麼切成可用於 mixture optimization 的 latent categories**。

作者認為 LLM pretraining 越來越受 data composition 影響，而不是只靠資料總量。問題是現有 data categorization 有兩類缺陷：

1. **Human / LLM taxonomy-based methods**  
   用人工定義 taxonomy 或 LLM 標註 topic/domain。問題是 human categories 未必符合模型真正需要的 latent knowledge granularity，而且標註大規模 web corpus 成本高、不同模型標註一致性也差。

2. **Naive Euclidean clustering**  
   用 K-Means 類方法對 embeddings 分群。問題是現代 embeddings 常在 hypersphere / cosine geometry 上有意義，但 Euclidean clustering 沒處理 high-dimensional anisotropy 和 cone effect，容易 cluster collapse：少數 dominant clusters 吞掉 long-tail semantics。

所以 GEM 想做的是：**不用人工 taxonomy，也不直接用 Euclidean K-Means，而是在 embedding 的 hyperspherical geometry 上學一組平衡且語意可分的 categories，供 downstream data mixing 使用。**

## 核心方法
### 1) 把 document embeddings 放到 hypersphere
GEM 假設每個 document 有 normalized embedding：

```text
x_i in S^{d-1}, ||x_i||_2 = 1
```

目標是學出 `K` 個 semantic clusters，讓 cluster 反映 **semantic directionality**，而不是普通 Euclidean distance。

作者的假設是：text embedder 的 directional geometry 雖然不等於下游 LLM 的 training dynamics，但可以提供一個穩定的 semantic coordinate system。這點後面用 data-mixing predictability 和 downstream pretraining 結果驗證。

### 2) vMF mixture model：用方向分布，不用普通 Gaussian/K-Means
GEM 使用 **mixture of von Mises-Fisher distributions (vMFMM)**。vMF 是 hypersphere 上的 directional distribution。

每個 cluster `k` 有：

- mean direction `mu_k`
- concentration `kappa_k`

likelihood 依賴：

```text
mu_k^T x_i
```

也就是 cosine similarity。這比 Euclidean K-Means 更貼近 normalized embedding 的幾何。

### 3) 固定 generative prior，避免 rich-get-richer
標準 EM 會學 mixture weights，容易讓大 cluster 更大。GEM 反過來固定 generative prior：

```text
alpha_k = 1 / K
```

然後另外對 empirical assignment mass 加 balance regularizer。這是它避免 cluster collapse 的關鍵之一。

### 4) Mixing-balance regularizer
GEM 的 objective 是 ELBO 加上一個懲罰 cluster mass 偏離 uniform 的項：

```text
pi_k = (1/N) sum_i gamma_ik
u = uniform over K clusters
regularizer = -lambda/2 * ||pi - u||_2^2
```

直覺是：如果某些 clusters 太大、某些 clusters 幾乎空掉，就代表 taxonomy 對 data mixing 很差，因為 mixture coordinates 會被少數大類主導。balance regularizer 逼模型保留更均衡的 semantic basis。

### 5) MM-based inference
因為 balance term 會把所有 samples 的 assignments coupling 在一起，不能直接做標準 EM。作者推導 **Minorize-Maximize (MM)** surrogate：

- E-step：maximize 一個 lower-bound surrogate，保證 objective monotonic ascent。
- M-step：vMF mean directions 有 closed-form update；`kappa` 用 high-dimensional approximation。

這部分的價值是把 GEM 從 heuristic clustering 變成有明確 optimization objective 和 convergence statement 的方法。

### 6) GIS：把 unsupervised clusters 轉成可讀 taxonomy
無監督 cluster 只有 cluster ID，不方便人理解或調整資料比例。作者提出 **Geometric Influence Score (GIS)** 選每個 cluster 的 representative samples，再用 LLM 生成 topic label。

GIS 同時考慮：

- assignment confidence：這個 sample 是否確定屬於該 cluster。
- directional centrality：是否靠近 vMF mean direction。
- local density：是否在同 cluster 裡有足夠鄰居支持，避免孤立點。

這比 random / center-only / confidence-only prototype selection 更穩。附錄 GIS ablation 顯示 taxonomy labeling accuracy：

- Random Sampling：80.41%
- Confidence-only：80.83%
- Center-only：81.67%
- GIS：**84.17%**

### 7) Teacher-Student distillation：把 GEM 擴到 web-scale
直接對 trillion-token corpus 跑 iterative GEM 太貴。因此作者採 two-phase deployment：

```text
seed corpus
  -> GEM teacher learns geometric partitions
  -> GIS selects high-confidence balanced pseudo-labels
  -> train lightweight FastText student classifier
  -> student labels full corpus cheaply
```

附錄中 FastText student 用 GEM pseudo-labels 時 test accuracy **75.13%**，高於 K-Means labels 的 **72.92%**，作者解讀為 GEM partitions 邊界更清楚、label noise 更低。

## Training / Data
實驗資料不是 speech/audio，而是 raw **CommonCrawl (CC)** web data。作者先採用近似 **RefinedWeb** 的 cleaning / filtering pipeline，得到較乾淨、降噪後的 text pretraining corpus，再比較不同 categorization / mixing 方法。

模型設定：

- LLaMA-style Transformer。
- 1.1B parameters。
- fixed compute budget：25B tokens。
- evaluation：OLMES framework。
- tasks 分成：
  - Science QA：ARC-Challenge、ARC-Easy、SciQ、OpenBookQA。
  - Commonsense Reasoning：HellaSwag、PIQA、CommonsenseQA。
  - Logic & Linguistics：WinoGrande、COPA。

GEM main setting：

- `K = 24` clusters。
- `lambda = 5000`。
- seed corpus default：3B tokens。
- mixing strategies：DoReMi、Perf、RegMix。

## 主要結果
### 1) GEM + data mixing 的下游平均分數最高
在三種 data mixing frameworks 下，GEM 都是整體平均最高：

- **DoReMi**：GEM average **43.95**，高於 WebOrganizer Format 42.79。
- **Perf**：GEM average **44.79**，高於 WebOrganizer Format 44.25。
- **RegMix**：GEM average **41.45**，高於 WebOrganizer Format 40.77。

提升幅度不是巨大，但在 1.1B / 25B token 的 controlled pretraining setup 裡算是穩定。

### 2) Taxonomy quality 可以用 mixing predictability 測
作者提出一個很有用的觀念：好的 taxonomy 不只是 label 好看，而是要讓 mixture weight 改變時，下游 validation loss 的變化更可預測。

他們用 RegMix 當 probe：

```text
sample 256 mixture vectors
train proxy models
fit regression from mixture weights -> validation loss
measure Spearman rho between predicted and true loss
```

GEM 的 Spearman distribution 更高且更集中，表示 GEM-induced categories 比 K-Means / WebOrganizer 更像 well-conditioned mixing coordinates。

這對我們很有啟發：以後做 speech/TTS data mixture 時，也可以不只問「cluster label 是否可讀」，而要問「這組 categories 是否讓 downstream quality / WER / MOS / judge score 對 mixture weights 更可預測」。

### 3) Cluster granularity 有 sweet spot
作者測 `K = 12` 到 `48`。結果顯示更細的 clusters 一開始有幫助，peak 在 `K = 36`，之後到 48 會 plateau / 下降。這表示：

- 太少 categories：semantic factors 太 entangled。
- 太多 categories：over-fragmentation，引入 stochastic noise。

這個觀念可以借到 speech data：speaker/style/noise/domain categories 也不應該越細越好，需要 downstream mixture predictability 驗證。

### 4) Ablation：geometry 和 balance regularizer 都有用
作者比較：

- K-Means：average 38.5
- Spherical K-Means：40.6
- Vanilla vMF：41.3
- GEM：**42.1**

這說明兩件事：

- 從 Euclidean 換到 hyperspherical / cosine geometry 有幫助。
- vMF soft assignment + balance regularizer 進一步減少 anisotropic cluster collapse。

### 5) 對 AIGC contamination 的壓力測試
作者指出 web corpus 越來越多 AI-generated content，這些 synthetic regions 可能在 embedding space 裡過度密集，讓 Euclidean K-Means 把很多資料吸進少數 synthetic-dominated clusters。

附錄 stress test 混入 Cosmopedia 後：

- K-Means 把 37.5% synthetic data 分到兩個巨大 clusters。
- GEM 維持比較 balanced 的 semantic partitions。

這對未來資料池很重要，因為 speech/TTS corpus 也可能混入 synthetic speech、TTS-generated data、AI-transcribed artifacts。

## Project relevance
**project-tts-data-pipeline：間接但有用。**

GEM 不處理 audio cleaning、ASR alignment、speaker consistency、overlap、noise、TTS transcript formatting。它不是 PilotTTS / OWSM v4 / Sommelier 那種 cleaning pipeline。

但它適合用在「cleaning 之後」：

```text
speech / TTS candidate corpus
  -> audio/transcript cleaning
  -> extract text/audio/style/domain embeddings
  -> GEM-style taxonomy discovery
  -> choose data mixture for TTS / ASR / speech LLM training
```

我們可以借它來做：

- multilingual / accent / domain / style taxonomy。
- 避免某些 dominant domains 吞掉 long-tail styles。
- 用 `GIS` 選每個 cluster 的 representative samples，做人審或 LLM labeling。
- 用 RegMix-style predictability 測「資料分類是否真的讓 downstream TTS quality 更可控」。

**project-audio-model-evaluation：間接相關。**

它不是 audio judge paper。但它的 **mixing predictability** 觀念可以借到 evaluation：

```text
若某組 speech data taxonomy 是好的，
那 mixture weights 的變化應該能更穩定預測 downstream WER / MOS / AnyAudio-Judge rubric score / human preference。
```

這可以成為資料分群品質的 meta-evaluation，而不只是看 cluster label 好不好看。

**project-full-duplex-data：低到中度相關。**

GEM 不能做 mono -> dual-channel、diarization、overlap separation。但如果我們已經有大量 processed dialogue segments，它可以幫忙發現 latent categories：

- interruption-heavy vs smooth turn-taking。
- backchannel-rich vs monologue-like。
- noisy overlap vs clean overlap。
- domain/topic/style clusters。
- synthetic vs natural dialogue clusters。

之後可用這些 categories 來控制 full-duplex generator 的 training mix。

## Related papers in my pool
- [OWSM v4](/papers/arxiv_2506_00338/)：OWSM v4 是 speech-text data cleaning；GEM 是 cleaned text corpus 的 taxonomy / mixture optimization。兩者可串接：先清，再分群/配比。
- [Miipher-2](/papers/arxiv_2505_04457/)：Miipher-2 清 waveform quality；GEM 不清 audio，但可用在 restored corpus 的 domain/style mixture。
- [Sommelier](/papers/arxiv_2603_25750/)：Sommelier 產生 full-duplex dialogue training records；GEM 可用在 Sommelier output 後做 dialogue category discovery。
- [AnyAudio-Judge](/papers/arxiv_2606_03116/)：AnyAudio-Judge 可評估生成 audio 是否符合 rubrics；GEM 的 mixture predictability 可用 judge scores 當 downstream signal，反推資料 taxonomy 是否有用。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX source 使用 `icml2026` accepted style，但此 note 未獨立驗證正式 proceedings metadata。

## 我該不該細讀
如果你的問題是 **speech/TTS data cleaning**，這篇不是第一優先；應先讀 OWSM v4、Miipher-2、Sommelier、PilotTTS 類 paper。

如果你的問題是 **cleaned data 要怎麼分群、怎麼混、怎麼讓 mixture search 更可控**，這篇值得細讀。尤其是：

1. vMF / hyperspherical clustering formulation。
2. mixing-balance regularizer 如何避免 cluster collapse。
3. GIS 如何挑 representative samples 做 taxonomy labeling。
4. RegMix predictability 如何評估 taxonomy 是否真的有用。

## 可能的弱點 / open questions
- **不是 speech/audio 實驗。** 所有主要結果都是 text LLM pretraining，不能直接外推到 TTS / ASR / speech LLM。
- **依賴 text embedder geometry。** 作者假設 embedder 的 directional space 對 downstream LLM 有用；若換成 audio embeddings、speaker embeddings、prosody embeddings，是否仍成立要重做實驗。
- **提升幅度有限但穩定。** Average downstream gain 約 0.5-1.2 points，對大規模 training 是否仍顯著需要更大規模驗證。
- **K 和 lambda 仍需 tuning。** 雖然有 sensitivity analysis，但 speech domain 的 cluster number / balance strength 不一定相同。
- **balance regularizer 可能壓制真實長尾分布。** 它避免 cluster collapse，但若某些 long-tail categories 本來就該小，uniform pressure 可能造成 over-partitioning 或不自然的 mixture。
- **taxonomy labels 仍由 LLM 生成。** GEM 的 clusters 是 unsupervised；可讀名稱靠 GIS sample + LLM summary，label quality 仍可能影響人工理解。

## Tags
- llm
- data-curation
- data-mixing
- taxonomy
- clustering
- hyperspherical-embedding
- vMF-mixture
- RegMix
- DoReMi
- project-tts-data-pipeline

## Concepts
- Geometric Entropy Mixing
- GEM
- data mixture optimization
- hyperspherical embedding space
- embedding anisotropy
- cone effect
- cluster collapse
- von Mises-Fisher mixture model
- entropy regularization
- mixing-balance regularizer
- Minorize-Maximize inference
- Geometric Influence Score
- GIS
- teacher-student distillation
- FastText student classifier
- RegMix predictability
- taxonomy quality evaluation

## Citation
```bibtex
@misc{min2026gemgeometricentropymixingforop,
  title={GEM: Geometric Entropy Mixing for Optimal LLM Data Curation},
  author={Min, Yue and Qiao, Ziyun and Chen, Ruining and Li, Yujun},
  year={2026},
  eprint={2605.26121},
  archivePrefix={arXiv},
  primaryClass={cs.LG},
  doi={10.48550/arXiv.2605.26121}
}
```
