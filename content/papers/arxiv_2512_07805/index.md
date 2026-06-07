---
paper_key: arxiv_2512_07805
canonical_id: "arxiv:2512.07805"
title: "Group Representational Position Encoding"
year: 2025
venue: "ICLR 2026 poster / arXiv"
url: "https://arxiv.org/abs/2512.07805"
pdf_url: "https://arxiv.org/pdf/2512.07805"
status: read
rating: 5
tags:
  - positional-encoding
  - long-context
  - transformer
  - sequence-modeling
  - speech-llm
  - project-audio-model-evaluation
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`iclr2026_conference.tex`), `reference.bib`, and public OpenReview notes. This is not a speech paper; it is included as a possible sequence-modeling building block for long-context speech/audio LLMs and evaluators.

## Links
- [Original URL](https://arxiv.org/abs/2512.07805)
- [arXiv abstract](https://arxiv.org/abs/2512.07805)
- [PDF](https://arxiv.org/pdf/2512.07805)
- [arXiv source](https://arxiv.org/src/2512.07805)
- [OpenReview forum](https://openreview.net/forum?id=itoNJ3gJl2)
- [Project / GitHub](https://github.com/model-architectures/GRAPE)

## 一句話總結
**GRAPE** 把 positional encoding 寫成 group action：用 **Multiplicative GRAPE** 統一 RoPE 類的 rotation，用 **Additive / Path-Integral Additive GRAPE** 統一 ALiBi、FoX 這類 additive decay bias，並宣稱這個 formulation 能保留 exact relative law、streaming cacheability，同時給 long-context Transformer 一個更系統化的 PE design space。

## 這篇在解決什麼問題
Transformer attention 本身是 permutation-invariant，所以需要 positional encoding。現有方法各有優點：

1. **RoPE**  
   用 orthogonal rotations 讓 query/key interaction 依賴 relative offset，norm-preserving、cache-friendly，但 canonical RoPE 固定 coordinate planes 和 log-uniform spectrum，較難表示 cross-subspace coupling 或 contextual position warping。

2. **ALiBi / additive bias**  
   直接在 attention logits 加 linear distance penalty，對 length extrapolation 常有幫助，成本低，但比較像 heuristic。

3. **FoX / forgetting mechanism**  
   用 data-dependent forget gates 對 attention logits 加 path-like decay，比 static ALiBi 更有彈性，但和 RoPE 的幾何關係不清楚。

這篇的主張是：這些方法其實可以放進同一個 group-theoretic picture。這不只是重新命名，而是希望提供一個可以推出新 PE variant 的設計語言，尤其是 contextual、streaming-friendly、long-context 的 positional geometry。

## 核心方法
### 1) Multiplicative GRAPE: RoPE as group action in SO(d)
Multiplicative GRAPE 把 position `n` 映射成：

```text
G(n) = exp(n * omega * L)
L = a b^T - b a^T
```

其中 `L` 是 rank-2 skew-symmetric generator，所以 `G(n)` 落在 `SO(d)`，是 norm-preserving rotation。因為它是 one-parameter subgroup，所以有：

```text
G(n + m) = G(n) G(m)
G(t - s) = G(s)^(-1) G(t)
```

這就是 exact relative law。RoPE 是 special case：把 hidden dimension 切成固定 2D coordinate planes，每個 plane 用固定 frequency 做 planar rotation。GRAPE-M 則允許：

- learned orthogonal basis：不一定綁死 canonical coordinate pairs。
- learned / shared frequencies：不一定只用 RoPE 的 log-uniform spectrum。
- compact non-commuting mixtures：讓不同 subspaces 之間可有 controlled coupling。
- closed-form Rodrigues-type exponential：避免 dense `matrix_exp`，作者主張 per-head 成本可到 `O(d)` 或 `O(r d)`。

### 2) Additive GRAPE: ALiBi / FoX as unipotent GL action
Additive GRAPE 把 additive logit bias 寫成 lifted homogeneous space 裡的 unipotent action。直覺上，不是轉動 query/key vector，而是透過 rank-1 或 low-rank nilpotent generator 產生 additive bias：

```text
G_add(n) = exp(n * omega * A) = I + n * omega * A
```

這可以 recover：

- **ALiBi**：content-independent linear distance penalty。
- **FoX**：把 forget gate 的 cumulative log-gate 看成 path-additive bias。
- **GRAPE-A-Q / K / QK**：讓 slope 依賴 query、key 或兩者。

核心好處是 additive bias 也能保留 exact relative law 和 streaming cacheability，不只是 ad hoc logit trick。

### 3) Path-Integral Additive GRAPE
GRAPE-AP 進一步讓 additive bias 不是只依賴固定 offset，而是沿著 key `j` 到 query `t` 的 path 累積 token-dependent potential。這對 long-context 很重要，因為不同 token 或段落可能需要不同的 effective distance：

```text
far but semantically relevant span -> less decay
near but irrelevant span -> stronger decay
```

作者把它說成 endpoint-dependent / path-integral bias。實作上可用 cached probe vectors 加 prefix sum，OpenReview rebuttal 中作者強調它不改變 attention 的 asymptotic complexity，但會增加 constant-factor overhead。

### 4) 2D / 3D / multimodal extension
附錄討論 GRAPE 可以自然延伸到 2D / 3D positions，例如 image、video、multimodal tokens。這對 audio 不直接，但若未來 speech/audio LLM 同時處理：

- time axis
- channel / speaker axis
- frequency / codec group axis
- transcript token axis

這種 multi-axis positional encoding 可能比單一 1D RoPE 更合適。

## Training / Data
實驗不是在 speech/audio 上，而是在 Llama-like language model 上測 positional encoding。

訓練設定：

- codebase：nanoGPT based，Llama-like architecture。
- data：FineWeb-Edu 100B，抽 50B tokens 訓練。
- context length：4096。
- medium model：353M parameters，24 layers，8 heads，hidden size 1024。
- large model：770M parameters，36 layers，10 heads，hidden size 1280，head dimension 128。
- optimizer：AdamW，cosine LR schedule，2000 warmup iterations。
- stability：QK RMSNorm，gradient clipping 1.0。
- baseline：RoPE、ALiBi、FoX，以及 w/ KV-shift variants。

評估：

- training / validation loss curves。
- lm-evaluation-harness 0-shot tasks：ARC-E、ARC-C、HellaSwag、OBQA、PIQA、WinoGrande、SciQ。

## 主要結果
### 1) GRAPE-AP 在 average 0-shot score 上小幅領先
Medium 353M：

- RoPE avg：51.73
- ALiBi avg：52.87
- FoX avg：52.96
- GRAPE-A-QK avg：53.00
- **GRAPE-AP avg：53.25**
- w/ KV-shift 下，**GRAPE-AP avg：53.46**，略高於 FoX w/ KV-shift 53.32。

Large 770M：

- RoPE avg：55.76
- ALiBi avg：56.44
- FoX avg：56.30
- **GRAPE-AP avg：56.91**
- w/ KV-shift 下，FoX avg 57.09，GRAPE-AP avg 56.86，兩者接近。

結論比較保守地說：GRAPE-AP 有競爭力，常常小幅贏 RoPE / ALiBi / FoX，但幅度不是壓倒性。

### 2) Pure GRAPE-M 的實證價值比較不明確
Multiplicative GRAPE-M variants 在表格中通常沒有比 additive variants 強：

- medium model 上 GRAPE-M-ctx / nonctx avg 約 51.78 / 51.79，接近 RoPE 但不如 additive variants。
- large model 上 GRAPE-M-ctx / nonctx avg 約 54.73 / 54.81，低於 RoPE 55.76 和 additive variants。

這點也被 OpenReview reviewer 追問：如果 length extrapolation 更需要 monotonic decay，那 GRAPE-M 的實際用途在哪裡？作者的回答是 GRAPE-M 仍提供 cross-subspace coupling 和 learned geometry，但實驗目前主要支持 additive / path-integral side。

### 3) Training stability claim 有一定支持，但還需要更多 benchmark
作者指出 RoPE training curve 有 instability，而 GRAPE 更穩定。reviewer 早期質疑原始實驗太少，後來作者補上 standard downstream benchmarks 和 medium/large scale 結果。最後 decision 是 ICLR 2026 poster accept。

## Project relevance
**project-audio-model-evaluation：中度相關，主要是 evaluator / judge backbone 的 long-context PE。**

AnyAudio-Judge、FlashTrace 類 audio reasoning / evaluation 系統會面臨長序列：

- audio codec tokens / acoustic frames 很長。
- transcript、speaker/event tags、rubrics、judge rationale 可能跨多個 time spans。
- 如果要輸出 grounded evidence span，模型必須穩定處理 long context 和 relative positions。

GRAPE 對這條線的啟發是：audio judge 的 positional encoding 不一定只能沿用 RoPE。可以考慮 additive decay 或 path-integral bias，讓 judge 對遠距離 evidence 的 attention 有可控衰減，同時讓重要 event span 透過 contextual phase / path bias 保持可連接。

**speech-llm / long audio model：中度相關。**

Speech LLM 常同時有 text tokens、audio tokens、speaker/channel tokens。如果未來要做 long-form speech reasoning、meeting understanding、full-duplex conversation modeling，position 不只是 1D token index，還包含：

- utterance-local time。
- global conversation time。
- speaker/channel identity。
- overlap region。
- audio/text alignment offset。

GRAPE 的 2D / 3D / multimodal extension 可作為設計參考。不過這篇沒有 audio 實驗，所以只能當 architecture idea，不應當成已驗證的 speech method。

**project-full-duplex-data：低到中度相關。**

full-duplex dual-channel generator 會需要建模長時間 turn-taking、backchannel、overlap timing。若模型基於 Transformer / DiT / speech LLM，positional encoding 會影響：

- A/B channel 的相對時間對齊。
- overlap span 的表示。
- long dialogue context 的 cache 和 extrapolation。

比較直接的想法是把 dialogue position 拆成 multiple axes：

```text
global time index
speaker/channel index
utterance-local position
overlap/event span position
```

然後用 GRAPE-style multi-axis group action 或 additive decay 做 attention bias。但這只是設計假設，還需要 audio-specific ablation。

**project-tts-data-pipeline：低相關。**

它不處理 data cleaning、ASR、diarization 或 TTS dataset curation。唯一間接 relevance 是：長語音資料清理或 judge model 如果要讀很長 transcript/audio token sequence，可能受益於更好的 positional encoding。

## Related papers in my pool
- [[arxiv_2606_03116|AnyAudio-Judge]]：rubric-based audio evaluator；GRAPE 可作為未來 open judge backbone 的 long-context PE 候選。
- [[arxiv_2602_01914|FlashTrace]]：long-horizon attribution；若 attribution model 需要處理長 reasoning / token span，positional encoding 會影響 evidence localization。
- [[arxiv_2605_27140|StepOPSD]]：step-aware credit assignment；和 GRAPE 一樣關心長序列裡局部事件如何影響整體結果，但 StepOPSD 是 RL credit shaping，GRAPE 是 architecture-level PE。
- [[arxiv_2606_03972|AAD-1]]：使用 Relative RoPE 做 long rollout video generation；GRAPE 提供另一種 long rollout positional geometry 的可能。
- [[microsoft_mai_thinking_1|MAI-Thinking-1]]：long-context reasoning model context；可比較 sliding/global attention 和 PE choices。

## OpenReview / reviewer discussion
OpenReview forum 顯示決策為 **Accept (Poster)**。

Reviewer 主要肯定：

- 用 group action 統一 RoPE / ALiBi / FoX 的理論視角有價值。
- exact relative law、streaming cacheability、closed-form rank-2 exponential 是清楚的 formal contribution。
- rebuttal 後補上的 downstream benchmark 和 medium/large scale 實驗，讓 practical relevance 比初稿更可信。

主要批評：

1. **presentation 太數學，實際好處一開始不夠清楚**  
   多位 reviewer 覺得 Lie algebra formalism 容易看起來像把既有方法重新包裝。作者在 response 中強調實用價值是從 design space 推出 GRAPE-AP，並用實驗顯示 additive/path-integral variant 有小幅收益。

2. **原始實驗不足**  
   reviewer 要求不只看 training curve，也要有 downstream tasks、scale ablation、method ablation。作者補了 lm-eval harness 的 medium/large results。

3. **GRAPE-M 的 utility 仍不夠強**  
   Reviewer 明確問：如果 additive decay 對 length extrapolation 更重要，那為什麼還需要 Multiplicative GRAPE？作者的回答是 GRAPE-M 提供 learned basis、non-commuting mixture 和 cross-subspace coupling，但表格上最有說服力的仍是 GRAPE-AP。

4. **computational overhead 缺少 wall-clock / memory benchmark**  
   作者說 GRAPE-AP 只加 constant-factor overhead，因為 probe dot products 和 prefix sums 與 attention score 同階。但 reviewer 仍希望看到實際時間和 memory comparison。這點在 camera-ready note 裡仍是 open question。

## 我該不該細讀
**如果你在設計 speech/audio LLM backbone、long audio judge、或 evidence-grounded audio evaluator，值得讀 introduction、method overview、Additive GRAPE / GRAPE-AP 和 OpenReview discussion。**

不需要優先細讀所有 Lie algebra proof。對我們最有用的是三個 engineering question：

1. audio judge 是否需要比 RoPE 更好的 long-context decay / cache behavior？
2. long audio sequence 是否應該用 content-dependent effective distance，而不是單純 token offset？
3. speaker/channel/time/event 是否能用 multi-axis positional encoding 表示？

如果只是做 TTS data cleaning 或 paper summarization，這篇優先級不高。

## 可能的弱點 / open questions
1. **沒有 audio / speech 實驗**  
   不能直接推論它對 speech LLM、audio codec Transformer、TTS 或 audio judge 有幫助。

2. **GRAPE-AP 的 improvement 幅度偏小**  
   benchmark 上多是小幅提升，且有些 w/ KV-shift 設定下 FoX 仍略高。

3. **缺少真正 long-context extrapolation benchmark**  
   這篇談 length extrapolation 和 positional geometry，但主實驗 context length 是 4096，reviewer 也曾要求更直接的 extrapolation analysis。

4. **compute overhead 未完全量化**  
   理論上是 same asymptotic complexity，但實際 kernel、cache、memory bandwidth、prefill/decode latency 仍需測。

5. **Multiplicative side 的實用性仍弱**  
   理論上 GRAPE-M 很漂亮，但目前最好的 empirical story 在 additive / path-integral side。

6. **對 multi-axis audio 的套用仍是 research hypothesis**  
   speaker channel、time, event span, transcript alignment 是否能被 GRAPE-style geometry 更好表示，需要我們自己做 controlled ablation。

## Tags
- `positional-encoding`
- `long-context`
- `transformer`
- `sequence-modeling`
- `speech-llm`
- `project-audio-model-evaluation`

## Concepts
- `GRAPE`
- `Multiplicative GRAPE`
- `Additive GRAPE`
- `Path-Integral Additive GRAPE`
- `RoPE`
- `ALiBi`
- `Forgetting Transformer`
- `FoX`
- `exact relative law`
- `group action`
- `SO(d)`
- `GL(d)`
- `unipotent action`
- `streaming cacheability`
- `long-context positional encoding`

## Citation
```bibtex
@misc{zhang2025grouprepresentationalpositione,
  title={Group Representational Position Encoding},
  author={Yifan Zhang and Zixiang Chen and Yifeng Liu and Zhen Qin and Huizhuo Yuan and Kangping Xu and Yang Yuan and Quanquan Gu and Andrew Chi-Chih Yao},
  year={2025},
  eprint={2512.07805},
  archivePrefix={arXiv},
  primaryClass={cs.LG},
  doi={10.48550/arXiv.2512.07805}
}
```
