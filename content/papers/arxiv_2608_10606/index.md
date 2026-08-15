---
paper_key: arxiv_2608_10606
canonical_id: "arxiv:2608.10606"
title: "ASR-Roundtrip Evaluation Can Mask Context- and Convention-Dependent Reading Errors in Chinese News TTS"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2608.10606"
pdf_url: "https://arxiv.org/pdf/2608.10606"
status: read
rating: 9
tags:
  - tts
  - asr
  - tts-evaluation
  - chinese-tts
  - text-normalization
  - reading-errors
  - evaluation-dataset
  - audio-benchmark
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-08-15
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`) and the released GitHub/Zenodo metadata pages, checked on 2026-08-15.

## Links
- [Original URL](https://arxiv.org/abs/2608.10606)
- [arXiv abstract](https://arxiv.org/abs/2608.10606)
- [PDF](https://arxiv.org/pdf/2608.10606)
- [arXiv source](https://arxiv.org/src/2608.10606)
- [Official GitHub repo](https://github.com/Jayden-X-L/cn-newstts-asr-roundtrip-masking)
- [Zenodo data archive](https://doi.org/10.5281/zenodo.21454402)

## 一句話總結
這篇指出 ASR-roundtrip evaluation 會遮蔽中文新聞 TTS 的 context- and convention-dependent reading errors：TTS 明明把 `13-11`、`F-35`、`伊尔-76`、`350Wh/kg`、`88VIP` 這類 risk spans 讀錯，但 ASR 因為語言模型、domain convention 或 normalization prior，仍可能轉寫成表面正確文字，讓 transcript-based scoring 誤以為 TTS 沒錯。

## 這篇在解決什麼問題
TTS evaluation 常用 ASR roundtrip：把合成語音丟進 ASR，再把 ASR transcript 和 reference text 比較。這很便宜、可擴展，也通常能反映 intelligibility。但作者指出，在中文新聞場景中，有一類錯誤會被 ASR 遮住。

問題集中在短而高 prior 的 written forms。它們的正確唸法不是只看字面，而要看 context 或 domain convention：

- 體育比分 `13-11` 應讀成「十三比十一」，不是 range-like 的「十三至十一」。
- 軍機 `伊尔-76` 是 aircraft model，不是「伊尔負七十六」。
- `F-35`、`640kW`、`350Wh/kg`、`88VIP` 等 mixed digit/Latin/unit/member strings 需要特定讀法。

這些錯讀對人耳很明顯，但 ASR transcript 可能回到正確表面形式。結果就是：TTS audio wrong，ASR transcript looks correct，evaluation 得到 false negative。

## 核心方法

### 1) 定義 CDRD / CDRD-adjacent risk spans
作者把核心類型稱為 Context-Dependent Reading Decisions (CDRD)：written span `x` 的正確讀法依賴 context `c`。

它們分三類：

- CDRD-entity：比分、軍機/飛機型號、financial quarters、generation labels、entity-dependent hyphenated forms。
- CDRD-polyphone：中文多音字，更接近 G2P。
- CDRD-adjacent：units、percentages、mixed-script strings、memberships、abbreviations、foreign names。

每個 case 都以 risk span 為單位標註：surface form、expected reading、known negative readings、context evidence，以及 transcript-based scoring 是否允許。

### 2) Frozen benchmark construction
來源是 108,124 條 company-produced Chinese news scripts，來自 production TTS workflow。作者先用 taxonomy-driven mining 找 high-risk written forms，包括 hyphens、scores、mixed digit/Latin strings、technical units、financial quarters、generation labels、aircraft/military models、known polyphone-prone spans。

real-news pipeline 會清 title / summary、過濾 missing/unusable rows、保留 rule-detected auditable risk spans，依 risk span 數量與多樣性打分，再用 type/domain caps 選出 500-case real-news candidate pool。

另外作者建了 5K synthetic hard-case pool，最後 freeze 一個 200-case benchmark：

- 155 real-news cases。
- 45 synthetic hard cases。
- 85 CDRD-entity。
- 35 CDRD-polyphone。
- 80 CDRD-adjacent / non-CDRD。
- domains：auto 44、general 43、finance 33、tech 31、sports 27、international 12、military 10。

重點是：candidate construction 只用 text 和 risk-span metadata，不用 TTS/ASR outcome；human listening audit 在 benchmark freeze 後才做，避免 outcome leakage。

### 3) Raw vs Structured conditions
作者比較兩種 TTS input：

- Raw：原始新聞 title + summary，不把 risk spans 改寫成 expected spoken forms。
- Structured：oracle-style diagnostic，把預先標註的 expected readings 直接替換進 source text，並保留 negative readings/context evidence 供 audit。

Structured 不是 deployable frontend，也不是 fair end-to-end baseline，而是 upper-bound diagnostic：如果把 reading decision 顯式寫出來，TTS 的 risk-span correctness 能提升多少。

### 4) Human audio-first span audit
作者強調這不是 MOS，也不是盲偏好測試，而是 targeted span-audit。

流程：

- annotator 先聽 Raw / Structured audio。
- 對 risk spans 判斷是否按 expected reading 正確讀出。
- ASR transcript 只能當 audit context，不能當 audio correctness 的證據。
- 200-case benchmark 全部由 primary annotator 標註。
- 30-case IAA subset 由兩位 additional annotators review，分層抽樣 CDRD-entity / CDRD-polyphone / CDRD-adjacent。

### 5) Targeted masked-error audit
作者另外做 110-row high-risk targeted audit。row 進入 audit pool 是 candidate，不是已知 confirmed masked。

audio-first 分類：

- confirmed masked：Raw TTS wrong，且至少一個 ASR route 寫成 expected/surface-correct form。
- exposed TTS error：Raw TTS wrong，且 ASR 保留或暴露錯讀。
- no Raw TTS error：Raw TTS correct。
- uncertain/not judgeable。

final 110 categories 由 second reviewer 全面檢查。另有 30-row label-blind relabel subset，full audit label exact agreement 23/30，kappa 0.634；confirmed-masked vs other agreement 27/30，kappa 0.800。

## Training / Data
這篇不是訓練新 TTS/ASR model，而是建立 evaluation benchmark / audit protocol。

使用系統：

- Primary TTS：MiMo-V2.5-TTS API。
- Primary ASR/audio understanding：MiMo `mimo-v2.5` API，prompted for verbatim transcription。
- Fallback / protocol ablation：`mimo-v2-omni`。
- ASR control：Whisper-small。
- Second TTS validation：CosyVoice-300M-SFT，Raw-only。
- Open-source ASR comparison：Paraformer-zh v2.0.4、Qwen3-ASR-1.7B。

Paraformer 設定：FSMN-VAD，不用 punctuation、hotwords、external language model。Qwen3-ASR 使用 local Transformers backend、empty context、automatic language detection。兩者都不拿 source text 或 target readings。

資料釋出：

- GitHub 釋出 supporting data、annotations、ASR outputs、evaluation tools。
- Zenodo archive 釋出 prompts、settings、transcripts、labels、metadata、audio、summaries、scoring code。
- Code 是 MIT。
- 500 company-authorized production scripts、5K synthetic cases、generated TTS audio、annotations、human labels、ASR transcripts、audit tables、derived metadata 是 CC BY 4.0。
- 108,124-item source export 不釋出。

## 主要結果

### 1) Targeted audit：ASR false negatives 明確存在
110-row MiMo Raw targeted audit：

- confirmed masked：46。
- exposed TTS error：9。
- no Raw TTS error：55。
- uncertain/not judgeable：0。

同一 targeted pool 的 CosyVoice Raw：

- confirmed masked：51。
- exposed TTS error：27。
- no Raw TTS error：30。
- uncertain/not judgeable：2。

作者特別強調：這是 targeted high-risk audit yield，不是 production prevalence。不能說 production 中 46/110 就是自然發生率。

### 2) Masking mechanism 不是單一 ASR prompt 偶然
MiMo 46 個 confirmed masked cases 中，conservative separator-normalized matching 找到：

- default ASR：34/46 surface-correct recovery。
- MiMo-V2-Omni strict route：27/46 surface-correct recovery。

benchmark label 分佈：

- CDRD-entity：33 confirmed masked / 6 exposed / 42 no Raw error。
- CDRD-polyphone：3 / 1 / 7。
- CDRD-adjacent：10 / 2 / 6。

錯誤類型集中在：

- sports scores：20。
- kW/kWh unit strings：10。
- military models：9。
- hyphen-range or torque forms：3。
- financial-quarter、compute-unit、membership、voltage：各 1。

### 3) Span isolation 能重新暴露部分錯讀
對 46 個 confirmed masked MiMo cases 做 target-span clip isolation：

- Original full sentence：0 exposed、46 masked。
- Rough 6s clip：16 exposed、11 masked、17 no output、2 other。
- Aligned clip：18 exposed、12 masked、13 no output、3 other。

這支持作者的機制解釋：在 full sentence context 中，ASR 的 language/context prior 可能把 transcript 拉回 expected/surface-correct form；把 span isolate 後，ASR 更可能聽出錯讀，例如「二十一至十七」「F杠三五」「伊尔負七十六」。

作者也說 isolation 不是 replacement metric，只是 mechanism evidence。

### 4) Raw vs Structured human audit
200-case Raw/Structured comparison：

- Raw case-macro risk-span audio accuracy：0.8889。
- Structured：0.9503。
- gain：+0.0614，95% CI [+0.0352, +0.0891]。

CDRD-entity gain 最大：

- Raw：0.7887。
- Structured：0.9146。
- gain：+0.1259，95% CI [+0.0728, +0.1807]。

這支持「很多錯誤是 reading-decision error，而不是一般 acoustic defect」。

### 5) ASR protocol 很敏感，不能當 ground truth
Automatic Raw/Structured scores 跨 protocol 差很多：

- default ASR：0.495 / 0.528。
- MiMo-V2-Omni strict ASR：0.728 / 0.805。
- MiMo strict-ASR 200-case matrix：Raw 0.6121、Structured 0.7826。

在 aligned 196-case subset，human labels 比 strict-ASR scores 高：

- Raw：+0.2745，95% CI [+0.2184, +0.3320]。
- Structured：+0.1667，95% CI [+0.1146, +0.2220]。

這表示 ASR score 有 calibration gap；它能做 screening，但不能做 standalone truth。

### 6) Open-source ASR comparison
在 97 個 confirmed masked TTS-specific files：

- Paraformer-zh surface-recovers 2/97。
- Qwen3-ASR-1.7B surface-recovers 40/97。

Paraformer 多數時候保留 wrong/noncanonical form；Qwen3-ASR 也會重現 masking 和 isolation effect。這代表 masking 和 ASR decoder/protocol 強相關，尤其 ASR-LLM 可能更容易用 language prior 修回 surface form。

## Project relevance

### project-audio-model-evaluation：非常高相關
這篇是我們 audio evaluation project 的核心 warning：不能只靠 ASR-roundtrip 或 transcript exact match 來判斷 TTS output。

可直接放進 evaluation design：

- 對 TTS / speech generation，要做 span-level risk audit，而不是整句 WER。
- 對高風險 written spans，要標註 expected reading、known negative readings、domain evidence。
- ASR transcript 只能當輔助 screening，不是 ground truth。
- 對 confirmed mismatch，可以用 span isolation / timestamp-localized re-transcription 做 mechanism diagnosis。

它也很適合接 AnyAudio-Judge / FlashTrace 的想法：judge 不只回答「這句讀對了嗎」，而要指出是哪個 span、哪個讀法、哪個 ASR route masking 了錯誤，最好能對應到 audio timestamp。

### project-tts-data-pipeline：非常高相關
這篇對 TTS data cleaning / transcript formatting 很有用。它指出 Chinese news TTS 的 data pipeline 需要處理：

- hyphen scores vs ranges vs model names。
- units / technical strings。
- financial quarters / generation labels。
- membership names。
- polyphones。
- mixed digit/Latin strings。

對我們 English TTS pipeline，類似問題也存在：sports scores、aircraft/product models、units、stock tickers、URLs、versions、chemical names、abbreviations 等都可能被 TTS 合理但錯誤地讀出，而 ASR 又可能 transcript-recover。這表示 data cleaning 不能只跑 ASR roundtrip，要建立 text-normalization risk-span audit。

### project-full-duplex-data：中度相關
它不是 full-duplex paper，但對 full-duplex synthetic data 很重要：如果我們用 TTS 合成雙聲道對話資料，transcript 內的 numbers / units / names / abbreviations 一旦讀錯，ASR-based validation 可能放過。

尤其 backchannel/overlap 場景中，ASR 更可能依賴 context prior；所以 dual-channel generator 的 evaluation 應該保留 per-channel expected reading 和 risk-span timestamp，不只看 mixture ASR transcript。

## Related papers in my pool
- [CosyVoice 2](../arxiv_2412_10117/)：本文用 CosyVoice-300M-SFT 做 Raw-only second-TTS validation；CosyVoice2 note 裡也討論了 ASR/SV objective metrics 可能和人類 perception 不一致。
- [AnyAudio-Judge](../arxiv_2606_03116/)：本文可補強 AnyAudio-Judge 的 limitation：rubric QA 若不 grounded 到音訊 span，也可能被 surface-correct transcript 騙過。
- [FlashTrace](../arxiv_2602_01914/)：span isolation 和 localized diagnosis 可與 token/span attribution 結合，找出 audio token span 導致 ASR masking 或 TTS wrong reading。
- [TASTE](../arxiv_2504_07053/)：TASTE 的 text-aligned speech token idea 可用來把 written risk span 對齊到 speech embedding/token span，支援更細的 reading-risk evaluation。
- [VoxCPM](../arxiv_2509_24650/)：VoxCPM / modern TTS evaluation 應加入這類 context-dependent reading risk，不只看 WER/CER/SIM/MOS。
- [FunASR](../../tools/modelscope-funasr/)：Paraformer / FunASR 類 ASR 在本文中呈現和 Qwen3-ASR 不同的 masking behavior，說明 evaluator choice 會改變結論。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。本地 `npm run paper:openreview -- arxiv_2608_10606` 沒有產生可摘要的 OpenReview notes。

## 我該不該細讀
建議細讀，尤其是做 TTS evaluation / data cleaning 的時候。

最值得讀：

- CDRD / CDRD-adjacent 的定義。
- 200-case benchmark construction。
- 110-row targeted masked-error audit。
- Raw vs Structured oracle diagnostic。
- Span-isolation diagnostic。
- Paraformer vs Qwen3-ASR 的 evaluator dependence。
- GitHub/Zenodo released data schema。

這篇的價值不在模型 SOTA，而是在指出一個 evaluation blind spot，並且把 denominator、human listening protocol、cross-ASR controls 交代得比較清楚。

## 可能的弱點 / open questions

### 1) Targeted audit 不能代表 production prevalence
110-row audit 是 high-risk candidate pool，所以 46 confirmed masked 只能證明 mechanism 和風險存在，不能估計 production 中真實發生率。

### 2) 主要是中文新聞
CDRD 在中文新聞很清楚，但 English / multilingual TTS 需要重新定義 risk taxonomy，例如 scores、units、product models、ticker symbols、acronyms、dates、URLs、versions。

### 3) Structured condition 是 oracle upper bound
Structured 使用預先標註的 expected readings 替換 source text，所以不能當 deployable frontend 的公平比較。真正可部署系統需要自動 risk-span detection + reading decision model。

### 4) Human audit 規模仍小
200-case benchmark 和 30-case IAA subset 對 mechanism 足夠，但若要做 leaderboard，需要更大的 blinded multi-annotator setup。

### 5) Span isolation 會產生 no-output / other transcripts
Aligned clip isolation re-exposes 18/46，但也有 13 no output 和 3 other。這表示 isolation 是 diagnostic，不是穩定 automated metric。

### 6) ASR model 差異很大
Qwen3-ASR surface-recovers 40/97，Paraformer 只有 2/97。這讓 evaluation protocol 很難標準化：ASR 越「聰明」，越可能用 language prior 修正錯讀，反而不適合當 TTS truth。

## Tags
- tts
- asr
- tts-evaluation
- chinese-tts
- text-normalization
- reading-errors
- asr-roundtrip
- span-audit
- evaluation-dataset
- audio-benchmark
- qwen3-asr
- paraformer
- project-audio-model-evaluation
- project-tts-data-pipeline

## Concepts
- ASR-roundtrip evaluation
- masked false negative
- Context-Dependent Reading Decisions
- CDRD
- CDRD-adjacent
- Chinese news TTS
- reading-risk benchmark
- risk-span audit
- audio-first annotation
- Raw condition
- Structured condition
- span-isolation diagnostic
- surface-correct transcript
- ASR canonicalization
- text normalization
- G2P
- polyphone disambiguation
- Paraformer-zh
- Qwen3-ASR
- MiMo TTS
- CosyVoice Raw audit

## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{luo2026asrroundtripevaluationcanmaskc,
  title={ASR-Roundtrip Evaluation Can Mask Context- and Convention-Dependent Reading Errors in Chinese News TTS},
  author={Shijun Luo and Lizhi Wan},
  year={2026},
  eprint={2608.10606},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2608.10606}
}
```
