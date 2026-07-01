---
paper_key: arxiv_2606_28551
canonical_id: "arxiv:2606.28551"
title: "DataComp-VLM: Improved Open Datasets for Vision-Language Models"
year: 2026
venue: "NeurIPS 2026 / arXiv"
url: "https://arxiv.org/abs/2606.28551"
pdf_url: "https://arxiv.org/pdf/2606.28551"
status: read
rating: 8
tags:
  - vision-language-models
  - data-curation
  - benchmark
  - multimodal-data
  - scaling
  - project-tts-data-pipeline
  - project-audio-model-evaluation
created: 2026-07-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`neurips_main.tex`, `sections/methodology.tex`, `sections/experiments.tex`, `sections/results.tex`, `sections/appendix.tex`) and metadata. This is a VLM data-curation paper, included mainly for data pipeline / evaluation benchmark methodology rather than speech content.

## Links

- [Original URL](https://arxiv.org/abs/2606.28551)
- [arXiv abstract](https://arxiv.org/abs/2606.28551)
- [PDF](https://arxiv.org/pdf/2606.28551)
- [arXiv source](https://arxiv.org/src/2606.28551)
- [Website](https://www.datacomp.ai/dcvlm/)
- [Official GitHub repo](https://github.com/mlfoundations/dcvlm)
- [Dataset browser](https://dcvlm-dataset-browser.streamlit.app/)

## 一句話總結

DataComp-VLM / DCVLM 是一個 controlled VLM data curation benchmark：它固定 VLM architecture、training recipe、scales 和 evaluation suite，讓研究者只改 data filtering / mixing / formatting / sampling；核心結論是，在已經上游 curated 的 VLM data pool 上，**data mixing 比 additional filtering 更重要**，且 instruction-heavy mixtures 在較大 model/token budget 下 scale 得更好。

## 這篇在解決什麼問題

現代 autoregressive Vision-Language Models 的能力很大一部分來自 data recipe，但大多數 technical reports 對資料配方只給粗略描述：

- 用哪些 image-caption / interleaved / text-only / instruction datasets？
- 每種 data type 的比例是多少？
- 什麼 filter 有用？
- 小 scale 上找到的 data mixture 是否能轉移到大 scale？
- evaluation suite 是否穩定、有 monotonic signal、沒有 train-test contamination？

作者認為 VLM 社群缺少類似 DataComp / DCLM 的 controlled benchmark。沒有固定 architecture / training recipe / eval protocol，就很難判斷提升來自 data curation，還是來自模型、訓練細節或 evaluation cherry-picking。

DCVLM 的目標是把 VLM data curation 變成可重現實驗：

```text
fixed architecture + fixed training recipe + fixed eval suite
  -> vary only data filtering / mixing / formatting / sampling
  -> compare downstream performance across scales
```

## 核心方法

### 1. Data pool

DCVLM 整合 160 個公開 datasets，總共約 3.9B samples / 6T multimodal tokens。四種 data types：

- image-caption pairs：例如 DataComp-1B、ReLAION-2B、PixMo-Cap、ShareGPT-4o。
- multimodal interleaved documents：例如 MINT-1T HTML/PDF、WanJuan、OmniCorpus、Multimodal-Textbook。
- text-only data：例如 FLAN、SlimOrca、Dolly、Numina-Math、xCoder80k。
- multimodal instruction-tuning data：再分成 knowledge、chart/table、general QA、grounding/counting、math、naive OCR、OCR-QA、science 等能力類別。

Pool 故意保持 heterogeneous，讓 benchmark 能研究 realistic aggregation regime，而不是只從 raw web crawl 做單一 filtering。

### 2. Train-test decontamination

作者對整個 pool 做 Extended eval suite decontamination：

- multimodal samples：用 ResNet-50 SSCD embedding，cosine similarity `> 0.75` 就移除。
- text-only samples：用 MinHash Jaccard similarity `> 0.55`，並搭配 substring check。

Appendix 顯示，嚴格 threshold 只移除約 0.29% pool samples，但集中移除最可能污染 benchmark 的 datasets，例如 InfoVQA、ScienceQA、TabMWP、FigureQA、ChartQA、AI2D。

這對任何 data benchmark 都是重要提醒：decontamination 應該對 benchmark-specific overlap 下手，而不是只做全域 dedup。

### 3. Fixed VLM recipe

模型架構模仿 InternVL3：

```text
InternViT-300M vision encoder
  -> 2-layer MLP projector
  -> Qwen2.5 language model backbone
```

四個 scale：

- small：1B model / 6.25B tokens / 187.5B-token pool / 約 80 H100 hours。
- medium：2B / 25B tokens / 750B-token pool / 約 640 H100 hours。
- large：4B / 100B tokens / 3T-token pool / 約 5,120 H100 hours。
- x-large：8B / 200B tokens / 6T-token pool / 約 20,480 H100 hours。

所有 scales 固定 pool-to-training token ratio 為 30x，讓 filtering / resampling 有足夠選擇空間。

### 4. Evaluation suite

作者從 65 個 candidate benchmarks 中挑出 up to 52 個，分成 9 domains：

- General Understanding
- Knowledge-Centric
- OCR & Charts
- Vision-Centric
- Multilingual
- Text-Only
- Safety
- Hallucination
- Reasoning

再依用途分成三層：

- Validation：13 benchmarks，用於快速迭代。
- Core：33 benchmarks，主結果。
- Extended：52 benchmarks，完整分析。

Benchmark selection 會過濾掉 seed variance 高、以及從 small 到 medium 不具 monotonic improvement 的 benchmarks。這點很實用：不是所有 benchmark 都適合拿來做 data curation feedback signal。

## Training / Data

主實驗比較 data filtering 和 data mixing。

### Base mixture

Filtering experiments 預設 base mixture：

```text
75% image-caption
18% text-only
4% multimodal documents
3% instruction-tuning
```

### Filtering variants

作者測超過 60 種 filter configurations，包括：

- CLIP-score filters：OpenAI CLIP ViT-L/14、DFN-CLIP、SigLIP-2-B/16@384。
- text quality classifiers：DCLM fastText、Nemotron、Mixtral educational-quality classifiers。
- multimodal filters：UniFilter Qwen2.5-1.5B / Qwen3-0.6B。
- perplexity-based filters：text-only perplexity、multimodal perplexity、Conditional Mutual Information。

也區分：

- local filtering：每個 source dataset 內部各自取 percentile，保留全域 mixture。
- global filtering：整個可被 filter 的 pool 共用 threshold，會隱式改變 mixture。

### Mixing variants

主要 sweep image-caption vs instruction-tuning ratio，固定 text-only 15%、multimodal docs 5%：

- Caption-heavy：65% image-caption / 15% instruction。
- Balanced：40% / 40%。
- Instruction-heavy：10% / 70%。

在 1B / 2B / 4B models 和 6.25B / 12.5B / 25B token budgets 上做 scaling grid。

### Other implementation details

- Formatting：使用 ChatML；multimodal documents 比較 multi-turn vs in-context formatting，multi-turn 較好。
- Within-type sampling：temperature-scaled sampling，結果 length-proportional sampling `T=1` 近似最佳，near-uniform `T=4` 掉 4.1pp。
- Recaptioning：只改 DataComp-1B captions，original alt-text 44.1%、synthetic-short 43.2%、synthetic-spatial 44.0%，沒有明顯提升。
- Online filtering：作者實作 online filtering infrastructure，結論是對 compute-bound VLM training 來說 overhead 可接受。
- Packing：streaming best-fit sequence packing，block-diagonal attention，position ids per segment reset，避免 padding waste。

## 主要結果

### 1. Filtering 幫助很小，甚至可能傷害

在已經由公開 dataset providers 上游 curated 過的 VLM data pool 裡，additional quality filtering 沒有穩定提升。最好的 SigLIP-2 global filtering 也只有約 +0.8pp。

作者的解釋是：這不是說 filtering 永遠沒用，而是 **downstream filtering on already-curated data has diminishing returns**。

他們用 raw vs pre-filtered sub-pools 驗證：

- 25% pre-filtered：downstream filtering gain +2.4pp。
- 65% pre-filtered：+1.3pp。
- 100% pre-filtered：+0.6pp。

所以如果資料來源是 raw web crawl，filtering 還是重要；但如果你是在聚合已 curated 的 public VLM datasets，mixing 可能更重要。

### 2. Data mixing 是主要槓桿

Instruction-heavy mixture 在小 scale 一開始不一定最好，但隨著 model size / token budget 變大，scaling slope 明顯更好。

作者的關鍵結論：

```text
small-scale best mixture may not transfer to larger scale
```

例如 1B x 6.25B tokens 時，caption-heavy 可能看起來更好；但 2B/4B 且更多 tokens 時，instruction-heavy 變成最佳。

這個結果非常重要：如果只用小模型/少 token 做 proxy，可能選錯大規模 data recipe。

### 3. Instruction data 可以 moderate repetition

因為 instruction data 比 image-caption 少，70% instruction-heavy mix 會有 repetition 風險。作者測 medium scale：

- instruction-heavy unique：Core Avg 51.7。
- 約 2x repetition：50.2。
- 約 4x：49.8。
- 約 8x：48.6。
- balanced unique：50.9。
- caption-heavy unique：50.3。
- base mix：48.8。

結論是：moderate repetition 的成本存在，但好 mixture 的收益可以超過 repetition penalty；到約 8x 才明顯不划算。

### 4. Pretraining curation ranking 會轉移到 SFT

作者把 27 個 pretraining checkpoints 用兩個 SFT datasets 做 54 次 SFT：

- LLaVA-665K
- Mammoth-VL-12M

結果 pretraining score 和 post-SFT score 幾乎完美相關：

- Pearson `r = 0.99`
- Spearman `rho = 0.99`

這支持用 pretraining-only evaluation 做 data curation iteration，至少在他們的 VLM setup 裡 SFT 不會洗掉 pretraining data recipe 差異。

### 5. Backbone choice 影響不大

作者用 Qwen2.5-Base 和 Qwen2.5-Instruct 做對照，mixture rankings 幾乎一致，Pearson `r = 0.97`。這表示 instruction-heavy mixture 的優勢不只是因為 base LM 未經 instruction tuning。

### 6. DCVLM-Baseline 超過 FineVision

最終 DCVLM-Baseline 使用 instruction-heavy recipe：

```text
10% image-caption
5% multimodal documents
15% text-only
70% instruction-tuning
```

Core Avg 對 FineVision：

- small：36.5 vs 36.2，+0.3pp。
- medium：51.7 vs 50.6，+1.1pp。
- large：58.9 vs 54.2，+4.7pp。
- x-large：63.6 vs 58.2，+5.4pp。

作者也指出 large scale DCVLM-Baseline 4B / 100B tokens 幾乎或直接超過 FineVision x-large 8B / 200B tokens 的一些結果，說明 data recipe 可以抵掉大量 compute。

### 7. 弱項：OCR / Safety

Appendix 裡作者指出 DCVLM-Baseline 相對 FineVision 在 Safety 明顯較弱，也在 OCR / Reasoning 上某些 extended results 落後。原因可能是 FineVision 更重視 high-resolution scanned documents / PDF-derived sources，而 DCVLM-Baseline 的 instruction-heavy mix 讓這些資料比例不足。

這是很好的提醒：單一 Core Avg 不是全部，data mix 需要按目標能力調整。

## Project relevance

### project-tts-data-pipeline

間接但重要。這不是 speech paper，但它的 data curation methodology 很適合借到 TTS pipeline：

```text
fix model + training recipe + eval suite
vary only data filtering / mixing / formatting
measure downstream TTS quality across scales
```

對我們的 English TTS data pipeline，最直接的啟發是：

- 不要只問「哪個 filter 最好」，也要問 data mixture：clean studio speech、audiobook、podcast、dialogue、expressive TTS、synthetic TTS、noise/reverb augment 各佔多少。
- 如果 source datasets 已經上游清過，additional filtering 可能 diminishing returns；mixing / formatting / metadata completeness 可能更重要。
- 小模型/少資料上選出的 data recipe 不一定 transfer 到大模型/長訓練。
- 需要固定 evaluation suite，例如 WER、speaker similarity、UTMOS、prompt adherence、long-form stability、hard sentences、overlap/backchannel retention。
- 要把 decontamination 當成 first-class pipeline：測試集 audio/text overlap 需要嚴格處理。

### project-audio-model-evaluation

中度相關。DCVLM 的 evaluation suite selection 很可借：

- 先收集很多 candidate benchmarks。
- 用 stability / seed variance 過濾。
- 用 monotonicity 過濾，確保 benchmark 能反映 scale。
- 分成 Validation / Core / Extended tiers。

Audio evaluation 也應如此：AnyAudio-Judge / ELSA / MMAE / WER / speaker similarity / FAD / human eval 不應都混成一個平均；應依目的分 tier，並測哪些 benchmark 對 model/data changes 有穩定 signal。

### project-full-duplex-data

間接相關。Full-duplex data pipeline 也會有 data mixing 問題：真實 mono dialogue、synthetic dual-channel dialogue、separated pseudo-labels、clean turn-based TTS、overlap-heavy samples、backchannel-rich samples 要怎麼配比？DCVLM 提醒我們要做 scale-aware mixture sweep，而不是只靠直覺。

## Related papers in my pool

- [SODA](../arxiv_2602_16687/)：audio-side scaling / data mixture reference。它比較 Yodas、Emilia、MLS，和 DCVLM 一樣說明 data source / formatting 會強烈影響 downstream。
- [ScholarGym](../arxiv_2601_21654/)：research-agent evaluation benchmark；和 DCVLM 一樣強調固定 evaluation protocol 和可重現 benchmark。
- [DiffusionBench](../arxiv_2606_24888/)：image-side evaluation methodology；提醒單一 metric ranking 不可靠，DCVLM 則提醒 data curation 必須 scale-aware。
- [MAVEN](../arxiv_2605_21917/)：agentic annotation pipeline；DCVLM 的 data pool / decontamination / eval tiers 可補它的 data benchmark framing。
- [NaturalSpeech 2](../arxiv_2304_09116/)：large-scale TTS data/model reference；可以用 DCVLM 的 methodology 設計 speech/TTS data curation benchmark。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：large-scale TTS / voice cloning pipeline；未來可用 DCVLM-style mixture/filtering ablation 分析其 data recipe。
- [MAI-Thinking-1](../microsoft_mai_thinking_1/)：DCVLM citation graph 連到它，因為本文引用其 scale-aware / hill-climbing machine framing。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議讀，但不是因為它是 speech paper，而是因為它是 **data pipeline experiment design paper**。

最值得讀：

- Methodology：data pool、scaling ladder、eval tier 設計。
- Filtering section：local vs global filtering、already-curated data 的 diminishing returns。
- Mixing section：instruction-heavy mixture 為何在 scale 上勝出。
- Appendix decontamination：SSCD threshold / MinHash / per-dataset removal。
- Appendix formatting / packing：ChatML、multi-turn formatting、streaming packing。

如果我們要做 TTS / audio data pipeline benchmark，這篇可以直接當 blueprint。

## 可能的弱點 / open questions

1. **VLM 結論不能直接搬到 speech。**  
   TTS data quality 和 VLM data quality不同：audio noise、speaker consistency、ASR alignment、phoneme duration、prosody、license、voice consent 都是 speech-specific。

2. **Instruction-heavy 是否對 speech 成立未知。**  
   VLM 中 instruction-heavy pretraining 有利，但 TTS 可能需要大量 clean waveform / transcript alignment；過多 synthetic instruction-style prompts 不一定提升 acoustic generation。

3. **Core Avg 可能掩蓋能力 tradeoff。**  
   DCVLM-Baseline 整體強，但 OCR / Safety 較弱。TTS 也可能出現平均 MOS/WER 好，但 expressive control、speaker similarity 或 overlap retention 變差。

4. **資料來源都已 curated，結論依賴 regime。**  
   如果我們從 raw podcast / YouTube / audiobook crawl 開始，filtering 可能仍是最大槓桿；DCVLM 的「filtering rarely helps」只適用於 already-curated pool。

5. **Compute cost 高。**  
   x-large 需要約 20,480 H100 hours。對 audio project，需要設計更便宜但仍可 transfer 的 proxy scale。

6. **公開 artifacts 依賴後續 release。**  
   論文說 artifacts 會公開；實際可用程度要看 GitHub / website released state。

## Tags

#vision-language-models #data-curation #benchmark #multimodal-data #data-mixing #filtering #scaling #evaluation-suite #decontamination #project-tts-data-pipeline #project-audio-model-evaluation

## Concepts

- DataComp-VLM
- DCVLM
- VLM data curation
- data mixing
- data filtering
- instruction-heavy mixture
- image-caption data
- multimodal interleaved documents
- text-only data
- multimodal instruction tuning
- scale-aware data curation
- benchmark stability
- monotonic evaluation
- train-test decontamination
- SSCD image decontamination
- MinHash text decontamination
- ChatML formatting
- sequence packing
- online filtering

## Citation

目前以 arXiv / NeurIPS 2026 source 記錄；若之後找到正式 proceedings metadata，再更新 citation。

```bibtex
@misc{farina2026datacompvlmimprovedopendataset,
  title={DataComp-VLM: Improved Open Datasets for Vision-Language Models},
  author={Matteo Farina and Vishaal Udandarao and Thao Nguyen and Selim Kuzucu and Maximilian Böther and Andreas Hochlehnert and Adhiraj Ghosh and Marianna Nezhurina and Karsten Roth and Joschka Struber and Yuhui Zhang and Sebastian Dziadzio and Elaine Sui and Soumya Jahagirdar and Dhruba Ghosh and Hasan Hammoud and Thomas De Min and Simone Caldarella and Jehanzeb Mirza and Sedrick Keh and Mehdi Cherti and Hilde Kuehne and Bernt Schiele and Serena Yeung-Levy and Muhammad Ferjad Naeem and Federico Tombari and Ana Klimovic and Elisa Ricci and Matthias Bethge and Sewoong Oh and Ameya Prabhu and Alessio Tonioni and Jenia Jitsev and Massimiliano Mancini and Ludwig Schmidt and Nikhil Parthasarathy},
  year={2026},
  eprint={2606.28551},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2606.28551}
}
```
