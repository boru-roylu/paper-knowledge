---
paper_key: arxiv_2601_21996
canonical_id: "arxiv:2601.21996"
title: "Mechanistic Data Attribution: Tracing the Training Origins of Interpretable LLM Units"
year: 2026
venue: "ICML 2026 Oral / arXiv"
url: "https://arxiv.org/abs/2601.21996"
pdf_url: "https://arxiv.org/pdf/2601.21996"
status: read
rating: 8
tags:
  - mechanistic-interpretability
  - data-attribution
  - influence-functions
  - training-data-curation
  - project-audio-model-evaluation
created: 2026-07-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex` and `tex/*.tex`). Venue note uses author-page metadata: ICML 2026 Oral; arXiv source itself uses ICML 2026 accepted style.

## Links

- [Original URL](https://arxiv.org/abs/2601.21996)
- [arXiv abstract](https://arxiv.org/abs/2601.21996)
- [PDF](https://arxiv.org/pdf/2601.21996)
- [arXiv source](https://arxiv.org/src/2601.21996)
- [Official GitHub repo](https://github.com/chenjianhuii/Mechanistic-Data-Attribution)
- [Author news page noting ICML 2026 Oral](https://liangmingpan.bio/news/)

## 一句話總結

這篇提出 **Mechanistic Data Attribution (MDA)**：把 traditional training data attribution 從「某筆資料影響整體 loss / output」改成「某筆資料影響某個 interpretable unit / circuit 的形成」，用 influence functions + EK-FAC 估計 training samples 對 induction heads、previous-token heads、SAE features 等 unit-level behavior 的影響；作者再用 Pythia retraining 做 causal validation，證明刪除 / 重複 top-influence samples 會延後 / 加速 induction head formation，且這些 head 的變化會同步影響 in-context learning (ICL)。

## 這篇在解決什麼問題

Mechanistic interpretability 已經能找出很多 LLM 內部單元：

- induction heads：做 in-context copying / pattern completion。
- previous-token heads：注意前一個 token。
- knowledge neurons。
- SAE mono-semantic features。

但大多數分析是 **post-hoc / static**：知道「這個 circuit 做什麼」，卻不知道「training corpus 裡哪些資料讓它長出來」。

Traditional training data attribution (TDA) 又通常問：

```text
這筆 training sample 對某個 validation loss / output prediction 有多大影響？
```

MDA 想問的是更細的問題：

```text
這筆 training sample 對某個 attention head / neuron / SAE feature 的 functional behavior 有多大影響？
```

這讓 data attribution 從 model-level behavior 移到 mechanism-level behavior，目標是能做：

- 找出形成某個 circuit 的 causal data catalysts。
- 刪除 / 加強資料來控制 circuit emergence。
- 連接 training data -> internal mechanism -> downstream capability。

## 核心方法

### 1. MDA framework: `(mu, pi, f_probe)`

作者把一個 mechanistic attribution task 寫成三個東西：

- `mu`：monitoring metric，用來找到或追蹤 target unit，例如 induction score / prefix matching score。
- `pi`：subspace projection，用來隔離 target unit 的 parameter subspace，例如某個 attention head 的 QK / VO matrices。
- `f_probe`：probe function，用來衡量 target unit 的 functional efficacy。

對 induction head：

```text
mu / f_probe = prefix matching / copy-target behavior
pi = selected head parameters
```

### 2. Unit-specific influence function

Standard influence function 估計：

```text
I(z_train, z_test)
  = - grad L(z_train)^T H^-1 grad L(z_test)
```

MDA 把 `grad L(z_test)` 換成 target mechanism probe 的 gradient，並只在 target parameter subspace 上計算：

```text
I_MDA(z_train, D_probe)
  = - grad_{theta_sub} L(z_train)^T
      H_{theta_sub}^{-1}
      grad_{theta_sub} f_probe(theta, D_probe)
```

直覺上，它在問：

```text
這筆 training sample 的 gradient
和「讓 target mechanism 更強」的 natural-gradient direction
有多對齊？
```

### 3. EK-FAC approximation

Exact inverse Hessian 對 LLM 不可行，所以作者用 EK-FAC approximation。對 attention heads，appendix 也討論為什麼要把 `W_Q` / `W_K` 做 joint subspace，以捕捉 query-key interaction；`W_V` / `W_O` 則因為角色不同而分開處理。

### 4. Causal validation by retraining

Influence score 本身只是 estimate，不等於 causality。因此作者做 counterfactual retraining：

- **Data Deletion**：在 critical formation window 中 mask high-influence samples 的 gradient。
- **Data Augmentation**：把 high-influence samples duplicated / inserted 到 training stream。
- 對照：random deletion / random augmentation。

如果 MDA 選到的 samples 真的是 causal，刪掉應該延後或削弱 target head formation；加強應該提前或增強。

## Training / Data

### models

主要 controlled retraining 實驗使用 Pythia family：

- Pythia-14M
- Pythia-31M
- Pythia-70M
- Pythia-160M

target units：

- induction heads。
- previous-token heads。
- appendix / qualitative extension：SAE features。

larger-scale tracing：

- OLMo-2-1B
- OLMo-2-7B

OLMo 實驗主要是 qualitative top-sample inspection，不做完整 retraining causal validation。

### critical formation windows

作者不是對整個 pretraining lifetime 做 dense attribution，而是先找 target mechanism 的 critical formation window。Appendix 給 induction head settings：

- Pythia-14M：steps `1000-1999`，約 `1,024,000` samples，top-k `100,000`。
- Pythia-31M：steps `0-1199`，約 `1,228,800` samples，top-k `120,000`。
- Pythia-70M：steps `0-999`，約 `1,024,000` samples，top-k `100,000`。
- Pythia-160M：steps `0-799`，約 `819,200` samples，top-k `100,000`；masking experiment 用 `80,000`。

### mechanistic data augmentation

作者提出一個 practical pipeline：

1. 用 Pythia-14M 跑 MDA，找 top `N = 2000` high-influence samples。
2. 用 LLM，例如 DeepSeek-V3，從 high-influence samples 中抽取 structural motifs，輸出 JSON schema。
3. 再讓 LLM 產生 executable Python scripts，程序化生成 synthetic training data。

synthetic insertion settings：

- 14M：insert `100,000` synthetic samples at step `900`。
- 31M：insert `20,000` at step `800`。
- 70M：insert `20,000` at step `700`。
- 160M：insert `10,000` at step `600`。

## 主要結果

### 1. MDA-selected samples 有 causal effect

在 Pythia 14M/31M/70M/160M 上，MDA-guided deletion consistently suppresses or delays induction / previous-token head emergence；MDA-guided augmentation accelerates phase transition。random deletion / random augmentation 幾乎沒有同等效果。

這是本篇最重要的證據：MDA 不是只找 high-loss samples，而是找到對 target mechanism formation 有特殊 causal density 的 samples。

### 2. high-influence samples 呈現 heavy-tailed distribution

Influence score 是 power-law / heavy-tail：少數 high-leverage samples 承擔很大一部分 cumulative influence。Figure caption 提到 top `10%` samples 可貢獻最多約 `50%` cumulative influence。

這支持「用少量 intervention 改變 circuit emergence rate」這件事。

### 3. repetitive structural data 是 induction heads 的 catalyst

Top samples 常見：

- LaTeX。
- XML / markup。
- code。
- database / list-like records。
- meaningless repeated strings。
- tabular / template-like structures。

作者的解釋是：這些資料包含 long-range repetitive structure，剛好提供 induction heads 需要學的 `AB ... A -> B` copy / pattern completion signal。

### 4. high-influence data 是 mechanism-general，不只是單一 head-specific

不同 induction heads 找到的 high-influence samples 有明顯 overlap；induction heads 和 non-induction heads 的 overlap 則低。用某一個 induction head 找出的 samples，也能影響其他 induction heads，效果比對 non-induction heads 大一個 order of magnitude。

這說明 MDA 可能抓到的是 abstract mechanism 的 data catalysts，而不是某個 head 的偶然 artifact。

### 5. induction head formation 更像 steady accumulation，不是單一神奇 batch

作者發現 high-influence samples 和 influence mass 在 training trajectory 中分布相對均勻，而 induction score 會有 sharp phase transition。把 emergence window 的 high-influence samples 換成其他 training interval 的 high-influence samples，也能維持效果；random replacement 則差很多。

解釋是：dataset 長期提供同方向 pressure，當 accumulated training tokens 到達 threshold，mechanism 才突然成形；top-influence samples 主要改變 formation rate。

### 6. induction heads 和 ICL 有 training-time causal coupling

作者用 ICL score：

```text
ICL Score = L_500 - mean(L_0:50)
```

在 WikiText-2 上測 long-context improvement。當 MDA deletion 抑制 induction head formation，ICL score 也變差；當 MDA augmentation 加速 induction head formation，ICL 也同步改善。這補上了 induction heads -> ICL 關係的 training-time causal evidence。

### 7. synthetic mechanistic data 可跨 model scale generalize

用 Pythia-14M 找出 patterns，再合成 synthetic data，能在多個 scale 提高 induction score：

- 14M：`0.432 -> 0.485`，`+12.3%`
- 31M：`0.472 -> 0.523`，`+10.8%`
- 70M：`0.304 -> 0.352`，`+15.8%`
- 160M：`0.508 -> 0.558`，`+9.84%`
- 160M using 160M-derived synthetic patterns：`0.508 -> 0.521`，`+2.56%`

作者認為這表示 structural curriculum 有 scale-invariant 成分，小模型可作 larger model 的 cheap mechanistic proxy。

## Project relevance

### project-audio-model-evaluation

中度到高相關，雖然它不是 audio paper。

我們目前在 audio evaluation 裡想做的是：

```text
rubric answer / judge decision
  -> attribution / evidence span
  -> reward / filtering / debugging
```

MDA 提供另一個更 training-time 的角度：

```text
audio judge / speech LLM 的某個 internal unit 或 behavior
  -> 哪些 training examples 讓它形成？
  -> 刪掉或加強這些 examples 是否改變 rubric / attribution / reasoning behavior？
```

可能借用方式：

- 對 AnyAudio-Judge 類 evaluator，找出某個 rubric behavior 對應的 internal units / SAE features，再做 MDA 找 training examples。
- 對 FlashTrace 類 attribution model，追蹤「能不能把 answer grounded 到正確 input span」這個 behavior 的 data origins。
- 對 speech LLM，追蹤某種 audio reasoning capability，例如 speaker counting、overlap detection、event order、backchannel timing，是由哪些 training samples / synthetic patterns 驅動。
- 對 reward hacking audit，檢查 reward model 裡某個容易被 hack 的 feature 是由哪類 training data 催化出來的。

這和 StepOPSD / FlashTrace 是互補的：

- FlashTrace：在 inference 時定位 output decision 依賴哪些 input spans。
- StepOPSD：把 trajectory / token-level reward credit 分配得更 local。
- MDA：在 training 時定位某個 internal mechanism 由哪些 training samples 催化。

### project-tts-data-pipeline

間接相關。它不是 TTS data cleaning paper，但 data pipeline 可以借 MDA 的觀念：

- 不只用 global validation loss / WER 判斷資料有沒有用。
- 可以問某類資料是否催化了特定 behavior，例如 punctuation following、speaker consistency、overlap detection、emotion tag following。
- 若未來訓練 TTS / speech LLM 出現壞習慣，例如過度插入 laugh、忽略 backchannel、speaker leakage，可嘗試用 mechanism-level data attribution 找資料來源。

目前這比較像 research direction，不是可直接落地的 TTS filtering recipe。

### project-full-duplex-data

間接相關。full-duplex generator 若要學到 overlap / backchannel / turn-taking，可能需要 specific structural data catalysts。MDA 的思想可以轉成：

```text
target behavior = correct overlap onset / backchannel timing / speaker handoff
probe = behavior-specific classifier or internal feature
MDA-like attribution = which dialogue examples drive this behavior?
```

限制是這篇只在 text LLM / attention heads 上驗證，沒有 audio tokens、codec frames、speech encoders。

## Related papers in my pool

- [FlashTrace](../arxiv_2602_01914/)：FlashTrace 解釋 inference-time reasoning token / source span；MDA 解釋 training-time mechanism origin。兩者可以合成完整鏈條：training data -> internal mechanism -> inference attribution span -> final decision。
- [StepOPSD](../arxiv_2605_27140/)：StepOPSD 是 post-rollout step-level credit assignment；MDA 是 pretraining data-level mechanism attribution。都在處理「不要把 reward / behavior 當成 monolithic object」。
- [AnyAudio-Judge](../arxiv_2606_03116/)：AnyAudio-Judge 給 audio rubric yes/no；MDA 可作未來 judge model 的 training-data audit，找出哪些 training samples 讓某類 rubric behavior 出現或偏掉。
- [ScholarGym](../arxiv_2601_21654/)：同樣不是 audio paper，但都和 agent / evaluation / data attribution 相關；ScholarGym 評估 research workflow，MDA 可分析 agent 內部能力或失敗 pattern 的 data origins。
- [DataComp-VLM](../arxiv_2606_28551/)：DataComp-VLM 是 data curation benchmark；MDA 是 mechanism-level data attribution。兩者可結合：先做 data mixture sweeps，再用 MDA 看 mixture 裡哪些 samples 催化了特定 internal mechanism。

## OpenReview / reviewer discussion

OpenReview script 找到可能 forum，但 API 回 `403`，無法讀取公開 review/rebuttal content。因此此 note 不包含 reviewer discussion。作者頁面在 2026-05 news 中標註此文為 ICML 2026 Oral。

## 我該不該細讀

建議讀，但不是因為它直接解 speech/audio，而是因為它提供了我們 evaluation project 缺的一層：

```text
training data -> internal mechanism -> observable evaluator behavior
```

最值得讀：

- MDA equation 和 EK-FAC approximation。
- induction head causal intervention setup。
- repetitive structural data / LaTeX / XML catalyst analysis。
- ICL coupling experiment。
- mechanistic data augmentation pipeline。

如果我們未來要訓練 open audio judge 或 speech reasoning model，這篇可以當成「如何追蹤某個 evaluator behavior 是由哪些資料形成」的基礎方法。

## 可能的弱點 / open questions

1. **主要 causal validation 只到 160M**

   OLMo-2-1B / 7B 只做 qualitative tracing，沒有完整 retraining causal intervention。大模型上的 causality 還是比較弱。

2. **需要先有可測的 interpretable unit**

   MDA 不是自動解釋所有 behavior；你要先定義 `mu`、`pi`、`f_probe`。對 audio judge / speech LLM，這一步可能比 text induction head 難很多。

3. **直接 vs indirect influence 還沒完全拆開**

   作者自己也說 training data 可能透過 upstream nodes 間接影響 target unit。若把整條 computational path 都算進去又會引入 noise。

4. **重複 pattern 的發現不等於所有能力都這樣形成**

   induction heads 很自然對應 repetition / copy structure；但 reasoning、tool use、audio event grounding、speaker diarization 的 data catalysts 可能複雜得多。

5. **mechanistic augmentation 有 distribution drift 風險**

   作者檢查了 Wikitext-103 / PopQA 短期沒有退化，但大規模或長期訓練是否會 overfit synthetic structural motifs 仍要小心。

6. **audio extension 不直接**

   Speech/audio model 的 target unit 可能是 cross-modal attention、codec-token feature、audio encoder neuron、SAE feature 或 temporal span detector；MDA 公式可借，但 probe design 和 retraining成本都會更高。

## Tags

mechanistic-interpretability, data-attribution, influence-functions, induction-heads, in-context-learning, training-data-curation, mechanistic-data-augmentation, project-audio-model-evaluation

## Concepts

- Mechanistic Data Attribution
- MDA
- influence functions
- EK-FAC
- interpretable units
- induction heads
- previous-token heads
- sparse autoencoder features
- critical formation window
- high-influence samples
- mechanistic data augmentation
- repetitive structural data
- LaTeX / XML catalysts
- in-context learning
- training-time causal intervention

## Citation

目前以 arXiv preprint + ICML 2026 Oral metadata 記錄；若之後找到正式 ICML proceedings BibTeX，再更新 citation。

```bibtex
@misc{chen2026mechanisticdataattribution,
  title={Mechanistic Data Attribution: Tracing the Training Origins of Interpretable LLM Units},
  author={Jianhui Chen and Yuzhang Luo and Liangming Pan},
  year={2026},
  eprint={2601.21996},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2601.21996},
  note={ICML 2026 Oral}
}
```
