---
paper_key: arxiv_2606_17404
canonical_id: "arxiv:2606.17404"
title: "ELSA: Acoustic Event-Level Semantic Alignment for Fine-Grained Reference-Free Text-to-Audio Evaluation"
year: 2026
venue: "Interspeech 2026"
url: "https://arxiv.org/abs/2606.17404"
pdf_url: "https://arxiv.org/pdf/2606.17404"
status: read
rating: 8
tags:
  - text-to-audio
  - audio-evaluation
  - reference-free-evaluation
  - event-level-alignment
  - project-audio-model-evaluation
created: 2026-06-28
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `02_method.tex`, `03_experiments.tex`, `04_results.tex`, `05_limitations.tex`) and metadata. TeX source uses the Interspeech 2026 camera-ready template; proceedings page was not separately verified during ingest.

## Links

- [Original URL](https://arxiv.org/abs/2606.17404)
- [arXiv abstract](https://arxiv.org/abs/2606.17404)
- [PDF](https://arxiv.org/pdf/2606.17404)
- [arXiv source](https://arxiv.org/src/2606.17404)
- [Project page](https://elsa-projectpage.pages.dev/)
- Dependency: [Human-CLAP](https://github.com/sarulab-speech/Human-CLAP)
- Dependency: [SAM Audio](https://github.com/facebookresearch/sam-audio)

## 一句話總結

ELSA 是一個 reference-free Text-to-Audio evaluation metric：它不只用 CLAP 做整段 prompt-audio similarity，而是先把 text prompt 拆成多個 acoustic events，再用 Language-queried Audio Source Separation 找出每個 event 對應的 audio representation，最後用 event-level precision / recall / F1 衡量 generated audio 是否逐項滿足 prompt。

## 這篇在解決什麼問題

Text-to-Audio (TTA) generation 的 automatic evaluation 很難，因為人類評分通常在看細節：prompt 裡每個 sound event 是否出現、是否和其他事件混在一起、是否有錯誤或遺漏。傳統 reference-based metrics 需要 ground-truth reference audio，但實際 generation prompt 常常沒有唯一標準答案。

CLAPScore 類 reference-free metrics 比較實用，因為它只需要 text prompt 和 generated audio。不過 CLAP 的問題是它通常做 **global text-audio matching**：整段 prompt 和整段 audio 做 cosine similarity。這種 score 可能被 dominant event 帶走，對 prompt 裡的小事件、複合事件、漏掉一個 sound、或多事件順序/組合錯誤不夠敏感。

ELSA 的出發點是：TTA evaluation 不應只問「整段 audio 像不像整段文字」，而應該問「文字裡每個 acoustic event 有沒有被 audio 支持」。這跟我們之前討論 AnyAudio-Judge / MMAE 的方向相近：把 holistic score 拆成可檢查的 local/event-level correctness。

## 核心方法

### 1. Text query decomposition

ELSA 先用 text-only LLM 把 prompt 分解成 semantically distinct acoustic events。作者實作使用 GPT-5.2，並要求每個 event 是簡短的 noun-verb phrase，例如 `dog barking`。這個限制不是語言美觀問題，而是為了讓後面的 LASS model 更容易以 event query 方式定位相關 audio。

如果 prompt 有 `A dog barks while rain falls in the background`，ELSA 會希望拆成類似：

```text
dog barking
rain falling
```

這一步讓 evaluation 從 single global text embedding 變成 multiple event queries。

### 2. Event-conditioned audio decomposition

ELSA 使用 Language-queried Audio Source Separation (LASS) model，把每個 acoustic event query 拿去 audio 裡找 event-relevant representation。主要實作使用 SAM Audio；ablation 裡也測 AudioSep 和 SoloAudio。

關鍵不是一定要把 source separation 做到完美 waveform extraction，而是讓每個 text event 對應到比較聚焦的 audio feature，再用 text-audio embedding 估計 alignment。

### 3. Global score + fine-grained score

ELSA 保留一個 coarse global score：

```text
y_c = cosine(global text embedding, global audio embedding)
```

這部分使用 Human-CLAP feature space。

接著對每個 text event 和 event-conditioned audio representation 建立 similarity matrix，得到 event-pair similarity `f_ij`。在這個 matrix 上，ELSA 計算 event-level precision 和 recall：

- precision：audio event 是否能被某個 text event 解釋，避免 audio 裡多出不該有的事件。
- recall：text event 是否都能在 audio 裡找到支持，避免 prompt 裡的事件被漏掉。
- F1：把 precision / recall 合成 fine-grained score `y_f`。

### 4. Adaptive score mixing

最終 score 是：

```text
y = lambda^M * y_c + (1 - lambda^M) * y_f
```

其中 `M` 是 decomposed acoustic event 數量，作者設 `lambda = 0.4`。當 prompt 裡只有少數 event 時，global CLAP signal 仍然有作用；當 event 越多，fine-grained event-level alignment 權重越高。

這個設計很實用：它不是完全丟掉 CLAP，而是把 CLAP 從唯一 score 降成 coarse prior，讓複合 prompt 更依賴 event-level evidence。

## Training / Data

ELSA 本身不是新的 TTA generator，也不是新訓練一個 audio foundation model。它是一個 evaluation metric / scoring pipeline。

實驗使用四個 TTA evaluation benchmarks：

- AudioCaps
- Clotho
- MusicCaps
- RELATE

人類評分指標包括：

- `REL`：audio 和 text prompt 的 relevance / alignment。
- `OVL`：overall audio quality / overall score，AudioCaps、Clotho、MusicCaps 使用。
- RELATE 另外提供 compositional signals，例如 inclusion of sound events (`IS`) 和 order of sound events (`OS`)。
- CompA 用於 attribute / order compositional evaluation，並測 text/audio retrieval setting。

Audio preprocessing：

- resample 到 16 kHz。
- crop 或 zero-pad 到 10 秒。
- human scores 取平均並 normalize 到 `[0, 1]`。

比較 baselines：

- Reference-based：SI-SDR、KL_PaSST、FD_OpenL3、AudioBERTScore。
- Reference-free：PAM、CLAPScore_MS、CLAPScore_LAION、CLAPScore_Human。

ELSA 的主要 feature space 是 Human-CLAP；event localization / decomposition 使用 SAM Audio。作者的 module ablation 顯示，ELSA 對 text-audio embedding feature space 的敏感度高於 LASS model 選擇。

## 主要結果

### 1. ELSA 在四個 benchmark 上都比 baseline 更接近 human ratings

主表用 Spearman rho / Kendall tau correlation 報告。ELSA 在 AudioCaps、Clotho、MusicCaps、RELATE 上都超過所有 reference-based 和 reference-free baselines。

幾個重點數字：

- AudioCaps：ELSA 在 `REL` 達 46.5 / 32.7，`OVL` 達 33.9 / 23.5。相對最佳 baseline，`REL` Kendall tau 提升 13.1，`OVL` 提升 7.8。
- Clotho：ELSA 在 `REL` 達 39.8 / 27.5，`OVL` 達 41.2 / 28.7。`OVL` Kendall tau 提升 14.0。
- MusicCaps：ELSA 在 `REL` 達 36.8 / 25.2，`OVL` 達 32.1 / 22.4。
- RELATE：ELSA 在 `REL` 達 37.9 / 26.2，Kendall tau 較最佳 baseline 提升 4.5。

重要的是：ELSA 甚至超過使用同一個 Human-CLAP feature space 的 CLAPScore_Human，表示提升不只是因為換了更好的 CLAP embedding，而是因為 event-level decomposition 有額外價值。

### 2. 對 compositional tasks 特別有幫助

在 RELATE / CompA 的 compositional evaluation 裡，ELSA 對 event inclusion、order、attribute 都有明顯改善：

- RELATE `IS`：ELSA Kendall tau 26.7，CLAPScore_Human 是 20.7。
- RELATE `OS`：ELSA Kendall tau 13.9，高於 CLAPScore_LAION 的 10.2。
- CompA attribute audio retrieval：ELSA 16.2，明顯高於 baseline。
- CompA order text/audio retrieval：ELSA 分別達 28.0 / 15.5，是最佳結果。

這表示 event-level evaluation 對「多個 acoustic events 是否被正確組合」比 global CLAPScore 更敏感。

### 3. LASS 模組重要，但 embedding space 更關鍵

Clotho ablation：

- SAM Audio + Human-CLAP：`OVL` 41.2 / 28.7，`REL` 39.8 / 27.5。
- AudioSep + Human-CLAP：`OVL` 40.9 / 28.3，`REL` 43.9 / 30.6。
- SoloAudio + Human-CLAP：`OVL` 37.1 / 25.9，`REL` 36.5 / 25.2。
- SAM Audio + MS-CLAP：`OVL` 28.2 / 19.2，`REL` 26.4 / 17.9。
- SAM Audio + LAION-CLAP：`OVL` 31.5 / 21.5，`REL` 30.4 / 20.6。

這個結果的解讀是：event-conditioned decomposition 有用，但如果底層 text-audio embedding 不夠貼近人類 judgement，score 仍然會弱。對我們來說，這提醒 audio judge / grounded evaluator 不能只靠 segmentation；embedding / judge backbone 本身也很重要。

### 4. 事件數量增加時更穩

作者把 prompt 按 event count 分組，發現 ELSA 在 1、2、3+ events 條件下都比 CLAP baseline 穩。RELATE 上，ELSA across event-count 的最大變動只有 1.4 points，而 CLAPScore_MS / LAION / Human 分別可到 15.5 / 2.0 / 7.8。

這支持 ELSA 的核心 claim：當 prompt 變複雜時，global CLAP similarity 更容易不穩，event-level alignment 更可靠。

### 5. Score calibration 仍有問題

ELSA 分數和 human score 的絕對值不完全對齊。例如 AudioCaps 上，human `REL` 平均約 0.64，但 ELSA 平均約 0.41，系統性低 0.23。作者明確指出 ELSA 需要進一步 calibration。

## Project relevance

### project-audio-model-evaluation

高相關。ELSA 是 AnyAudio-Judge / MMAE 之外的另一種 audio evaluation pattern：

```text
prompt
  -> acoustic event decomposition
  -> event-conditioned audio representation
  -> event-level precision / recall / F1
```

AnyAudio-Judge 偏向 dynamic yes/no rubrics；MMAE 偏向 edit instruction correctness；ELSA 偏向 metric-style continuous score。三者可以合併成更完整的 evaluator：

- AnyAudio-Judge：產生 human-readable rubrics。
- ELSA：把 prompt 拆成 acoustic events，提供 event-level alignment score。
- FlashTrace / attribution：檢查每個 judgement 是否 grounded in correct transcript/audio span。

對 speech+sound composite audio 特別有價值。像 PlanAudio 類 prompt 會同時包含 speech、music、sound events、foreground/background hierarchy，ELSA 的 event decomposition 可以幫助檢查各個 acoustic events 是否存在。

### project-full-duplex-data

中到高相關，尤其是 evaluation 設計。Full-duplex dialogue 的 prompt / control plan 可以拆成：

- speaker A utterance。
- speaker B backchannel。
- overlap event。
- interruption。
- laughter / breath / hesitation。
- background sound。

ELSA 的 event-level alignment 可以改成 dialogue event-level alignment，用來檢查 generated dual-channel audio 是否真的包含指定 backchannel / overlap / nonverbal event。不過它目前不顯式建模 temporal order / duration，因此要評估 full-duplex timing，還需要 timestamp-aware rubrics 或 audio span attribution。

### project-tts-data-pipeline

中度相關。ELSA 不是 TTS data cleaning paper，但它可以借來做 synthetic / cleaned data 的 validation：如果 transcript 裡有 event tags 或 sound tags，可以用 event-level scoring 檢查 audio 是否真的包含這些 events，避免 data card / caption 和 audio 不一致。

## Related papers in my pool

- [AnyAudio-Judge](../arxiv_2606_03116/)：rubric-based audio judge。ELSA 可以補它的 continuous event-level metric。
- [MMAE](../arxiv_2606_07229/)：audio editing benchmark，用 IFR / CR / EMR 和大量 rubrics 評估 edit correctness。ELSA 可補 text-to-audio prompt adherence。
- [PlanAudio](../arxiv_2605_28063/)：speech+sound composite generation target；ELSA 很適合當它的 event coverage evaluator。
- [FlashTrace](../arxiv_2602_01914/)：可補 ELSA 缺少的 attribution / evidence span。
- [MAVEN](../arxiv_2605_21917/)：video-side agentic annotation pipeline；ELSA 的 event decomposition 和 MAVEN 的 structured intermediate 都指向「先拆細，再評估」。
- [Full-Duplex-Bench-v3](../arxiv_2604_04847/)：full-duplex voice agent benchmark；可借 ELSA 的 event-level scoring 來檢查 backchannel / interruption / self-correction events。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

建議讀，尤其如果我們要做 audio model evaluation 或 full-duplex generation evaluation。

最值得看的部分：

- Method：ELSA 如何從 text prompt 拆 acoustic events，再用 LASS + Human-CLAP 做 event-level scoring。
- Main quantitative table：它和 CLAPScore_Human 的差異，能證明 improvement 不是單純換 embedding。
- Module ablation：可以看 LASS model vs embedding model 哪個更影響結果。
- Limitations：它沒有 explicit temporal modeling，這正好對我們很重要，因為 full-duplex evaluation 不能只知道 event 有沒有出現，還要知道何時出現、是否 overlap、是否符合 turn-taking。

## 可能的弱點 / open questions

1. **Temporal order / duration 還不夠。**  
   作者自己也承認 ELSA 沒有 explicit modeling of temporal order、duration、sequential structure。對 music / environmental TTA 可能還可接受；對 full-duplex speech、interruption、backchannel timing 就不夠。

2. **Event decomposition 依賴 LLM。**  
   如果 prompt decomposition 錯了，後面的 scoring 會跟著錯。這也表示 evaluator 本身需要 versioning：不同 LLM 版本可能拆出不同 acoustic events。

3. **LASS model 可能找不到 subtle event。**  
   很短的 backchannel、低音量 background event、overlap 裡的 quieter speaker，都可能被 LASS miss 掉。這會影響 precision / recall。

4. **Score calibration 未解。**  
   ELSA 和 human score 的 rank correlation 好，但 absolute score 偏低。若要用作 training reward，需要 calibration 或 normalization。

5. **Speech-specific correctness 不完整。**  
   ELSA 看的是 acoustic event alignment，不直接檢查 lexical content、speaker identity、speaker role、ASR WER、emotion correctness。TTS / dialogue TTS 還需要和 speech-specific metrics 合併。

6. **Reference-free 不代表 fully grounded。**  
   ELSA 比 global CLAP 更 fine-grained，但它還沒有輸出 human-friendly evidence，例如「第 6.2-7.8 秒缺少 rain sound」。如果要作 debugging tool，需要加 time-span attribution。

## Tags

#text-to-audio #audio-evaluation #reference-free-evaluation #event-level-alignment #CLAP #LASS #project-audio-model-evaluation

## Concepts

- ELSA
- Acoustic Event-Level Semantic Alignment
- reference-free Text-to-Audio evaluation
- event-level alignment
- event-level precision / recall / F1
- Human-CLAP
- SAM Audio
- Language-queried Audio Source Separation
- CLAPScore
- compositional audio evaluation
- RELATE
- CompA
- AudioCaps
- Clotho
- MusicCaps

## Citation

目前以 arXiv / Interspeech 2026 camera-ready TeX source 記錄；若之後找到正式 proceedings metadata，再更新 citation。

```bibtex
@misc{suzuki2026elsaacousticeventlevelsemantic,
  title={ELSA: Acoustic Event-Level Semantic Alignment for Fine-Grained Reference-Free Text-to-Audio Evaluation},
  author={Shuntaro Suzuki and Kento Tokura and Daichi Yashima and Kanon Amemiya and Komei Sugiura and Shinnosuke Takamichi},
  year={2026},
  eprint={2606.17404},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2606.17404}
}
```
