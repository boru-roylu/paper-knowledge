---
paper_key: arxiv_2602_01914
canonical_id: "arxiv:2602.01914"
title: "Towards Long-Horizon Interpretability: Efficient and Faithful Multi-Token Attribution for Reasoning LLMs"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2602.01914"
pdf_url: "https://arxiv.org/pdf/2602.01914"
status: read
rating: 3
tags:
  - llm
  - interpretability
  - attribution
  - reasoning
  - speech-reasoning
  - agentic-workflow
  - project-audio-model-evaluation
  - project-full-duplex-data
created: 2026-06-04
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, arXiv metadata, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2602.01914)
- [PDF](https://arxiv.org/pdf/2602.01914)
- [arXiv source](https://arxiv.org/src/2602.01914)
- [GitHub repo: wbopan/flashtrace](https://github.com/wbopan/flashtrace)

## 一句話總結
**FlashTrace** 是一個面向 reasoning LLM / agentic workflow 的 multi-token attribution 方法：它用 span-wise aggregation 一次解釋一整段輸出，再用 recursive attribution 把重要性從 final answer / reasoning chain 追回原始 input。

## 這篇在解決什麼問題
傳統 token attribution 多半是解釋「某一個 output token」受哪些 input tokens 影響。但現代 reasoning LLM 會產生長 Chain-of-Thought、工具調用、code diff、multi-step intermediate content；此時要解釋的不再是一個 token，而是一整段 multi-token output。

作者指出現有方法有兩個問題：

- **Efficiency bottleneck**：如果 target span 有 `M` tokens、context 有 `N` tokens，naive 做法通常要 `O(M * N)`，長 context / 長 output 時會慢到不可用。Paper 說 Integrated Gradients 可能需要超過 10 小時解釋一段 5k-token generation。
- **Faithfulness drop**：當模型有 intermediate reasoning tokens `T` 時，attribution mass 會集中在最近的 reasoning tokens，而不是回到原始 input `I`。也就是模型看起來像「答案是由上一段推理導致」，但沒有追到最初讓推理成立的 evidence。

FlashTrace 的目標就是讓 attribution 能處理 long-horizon generation：解釋一整段 output，並把 causal importance 穿過 reasoning chain 追回 source input。

## 核心方法
Paper 把生成序列拆成：

```text
Input I -> Reasoning / Intermediate T -> Output O
```

FlashTrace 的兩個核心設計：

### 1. Span-wise attribution
Instead of 對 target span 裡每個 token 分別跑 attribution，FlashTrace 把 target span 聚合成一個 span-level target。對 attention contribution，它交換 summation order：

```text
sum_i w_i * alpha_{i,j} * v_j = v_j * sum_i w_i * alpha_{i,j}
```

因為 `v_j` 只跟 source token `j` 有關，不跟 target token `i` 有關，所以可以先把 target span 對 source token 的 scalar attention weights 聚合起來，再做一次 vector operation。這把 heavy vector arithmetic 移出 target-token loop。

### 2. Recursive attribution
第一 hop 先把 final output span 歸因到 context；接著把重要的 reasoning tokens 當作新的 target，再往前歸因，讓 importance 從 `O` 經過 `T` 回到 `I`。

直覺上：

- hop 0：answer 看起來依賴 reasoning tokens
- hop 1：reasoning tokens 依賴 input evidence
- output attribution 最後能定位到原始 input 中真正支持答案的 evidence

作者發現 `K=1` recursive hop 通常已經足夠，高 hop 數收益小，且可能累積 noise。

## Training / Data
這篇不是 model training paper，而是 attribution / interpretability method paper。實驗使用公開 LLM 和 benchmarks：

- target model 主要用 **Qwen-3 8B Instruct** 生成 reasoning / outputs。
- long-context retrieval：RULER，包括 Needle-in-a-Haystack (NIAH)、Variable Tracking (VT)、HotpotQA long-context variants。
- reasoning：MATH、MoreHopQA。
- code generation：Aider dataset，133 Python programming exercises。

資料建構上，作者先用 target model 生成完整 `I/T/O` context，並過濾保留 final answer 正確的 cases，避免把錯誤 reasoning 的噪音帶進 attribution evaluation。RULER 這類有 ground-truth evidence 的任務可用 Recovery Rate；MATH / MoreHopQA 則用 RISE / MAS 類 causal perturbation metrics。

## 主要結果
### Efficiency
在 5k-token target span 上，FlashTrace 比最有效率 baseline IFR 快超過 **130x**：

- FlashTrace：under 20 seconds
- IFR：over 38 minutes

實驗硬體是 5 x NVIDIA A800 80GB，總 400GB VRAM。Paper 也指出 gradient-based methods 在較長 context 下容易 OOM。

### Faithfulness
在 MATH / MoreHopQA reasoning tasks：

- MATH：FlashTrace RISE **0.348**，MAS **0.446**，優於 Perturbation、REAGENT、IFR、AttnLRP、CLP。
- MoreHopQA：FlashTrace RISE **0.128**，MAS **0.205**，也最佳。

在 reasoning length 分析中，FlashTrace 隨 reasoning tokens 變長仍維持較穩定的 MAS，沒有像 baseline 一樣明顯退化。

### Exhaustive rollout comparison
作者用 Exhaustive Token-Level Rollout 當昂貴上界，在 MoreHopQA 比較：

- Exhaustive：11.2s，RISE 0.116，MAS 0.193。
- FlashTrace：0.72s，RISE 0.128，MAS 0.205。

也就是 FlashTrace 用 span-wise approximation 取得接近 exhaustive token-level rollout 的 faithfulness，但速度快很多。

### Code generation generalization
在 Aider code generation：

- IFR Last Line：RISE 0.710，MAS 0.782。
- IFR Token：RISE 0.707，MAS 0.773。
- FlashTrace Full Code Span：RISE **0.013**，MAS **0.173**。

這表示 multi-token attribution 不只適用自然語言 CoT，也能解釋 code snippets / code modification spans。

## 作者如何驗證 source span 真的找對
這篇不是靠人工看 heatmap 說「看起來對」，而是用三層驗證。

### 1) 有 ground-truth evidence 的任務：Recovery Rate
在 RULER 類 long-context retrieval tasks 裡，input 裡哪些 token 是答案來源是已知的，例如 Needle-in-a-Haystack、Variable Tracking、HotpotQA long-context variants。

作者流程是：

```text
target model 先生成 reasoning + final answer
只保留 final answer 正確的 cases
FlashTrace 對 final output span 做 attribution
把 generated reasoning tokens 排除
看 ground-truth evidence tokens 有沒有落在 top 10% attributed input tokens
```

這個指標叫 **Recovery Rate**。如果答案應該來自 input 裡某個 key/value、needle、entity span，好的 attribution 應該把高分放到那些 evidence tokens。

這是最接近「是否正確 locate input source span」的驗證。但它有前提：final answer 必須正確，否則 ground-truth evidence recovery 沒有明確意義，因為模型可能根本沒有用正確 evidence 產生答案。

### 2) 沒有明確 source span 的 reasoning tasks：RISE / MAS
在 MATH、MoreHopQA、Aider code generation 這些任務裡，不一定有乾淨的 ground-truth input span。因此作者用 causal perturbation 類指標：

```text
找出 attribution score 高的 input tokens
mask / perturb 這些 tokens
看模型原本 output 的 probability 是否明顯下降
```

如果移除高 attribution tokens 後，模型更難產生原本 output，代表這些 tokens 對 realized generation 確實重要。這就是 RISE / MAS 的角色。

所以 RISE / MAS 驗證的是：

> 被找出的 tokens 是否真的影響模型產生該 output。

它不是人工標準答案式的 span matching，而是測 attribution 是否對模型行為有 causal predictive power。

### 3) 和 expensive exhaustive rollout 比
作者還用 **Exhaustive Token-Level Rollout** 當昂貴近似上界：逐 token 做更細的 attribution / rollout，然後看 FlashTrace 的 span-wise approximation 是否接近它。

在 MoreHopQA：

- Exhaustive Token-Level Rollout：11.2s，RISE 0.116，MAS 0.193。
- FlashTrace：0.72s，RISE 0.128，MAS 0.205。

結論是 FlashTrace 的 span-wise approximation 接近 exhaustive rollout，但速度快很多。

### 要怎麼解讀這個驗證
比較準確的說法是：

- 在有 ground-truth evidence 的 retrieval tasks，FlashTrace 更常把 top attribution 放到正確 evidence tokens。
- 在沒有 ground-truth source span 的 reasoning tasks，FlashTrace 的高 attribution tokens 被 perturb 後會更明顯影響 output probability。
- 它解釋的是 **realized generation 的 information flow**，不是完整 mechanistic circuit，也不保證在 diffuse evidence 場景能定位到單一精準 span。

## 找出 source span 有什麼用
source span 的主要用途不是讓 heatmap 好看，而是做 grounding、debugging 和 data/eval filtering。

### 1) 檢查模型是不是 grounded
例如 voice agent 最後回答或 tool call 用了 `Boston`。可以檢查 attribution 是否真的落在使用者最後修正：

```text
actually wait, make that Boston
```

而不是前面的 false start：

```text
book me a flight to New York
```

這可以區分「真的讀懂 self-correction」和「靠 prior / shortcut 猜對」。

### 2) Debug 錯誤 reasoning
如果模型答錯，可以看高 attribution 是否集中在：

- ASR hallucination
- speaker diarization 錯分的 utterance
- stale instruction
- irrelevant retrieved document
- prompt template 裡的 spurious token

這比只看 final accuracy 更能定位錯誤來源。

### 3) Tool-call / agent action grounding
對 full-duplex voice agent，FlashTrace 可檢查 tool arguments 是否依賴正確 user evidence。例如：

```json
{"destination": "Boston", "date": "Friday"}
```

可以分別追蹤 `destination=Boston`、`date=Friday` 依賴 transcript 的哪段，分析 premature tool call、stale state、或 self-correction 沒更新的 failure。

### 4) Dataset cleaning
對 speech reasoning / agent dataset，可以保留 attribution 落在正確 evidence span 的 examples，丟掉 attribution 主要落在 boilerplate、speaker ID artifact、annotation leakage、或 hallucinated ASR fragment 的 examples。

### 5) Benchmark grounding metric
除了 Pass@1、WER、tool accuracy，也可以加一個 attribution-based grounding check：

```text
answer correct + attribution on expected evidence = grounded success
answer correct + attribution off evidence = suspicious / shortcut
answer wrong + attribution on wrong source = useful failure diagnosis
```

### 6) 對 speech / full-duplex project 的用途
第一步不應該直接做 raw audio attribution，而應該做 transcript / event-token attribution。例如：

```text
[S1] book me a flight to New York
[S1] actually wait, make that Boston
[S2:backchannel] mm-hmm
```

我們可以檢查 full-duplex agent、rubric judge、或 speech reasoning model 是否真的用到：

- self-correction 後的 span
- interruption span
- backchannel / pause / overlap tag
- 正確 speaker 的 utterance

對我們目前的 project，FlashTrace 不負責 `mono -> dual-channel` data production；它更像之後的 **reasoning / judge / tool-call grounding debugger**。

## Project relevance
**project-full-duplex-data：中度相關，尤其是 speech reasoning / voice-agent debugging。**

這篇不是 speech/audio paper，也不是 data synthesis 方法。不過如果你之後做 full-duplex voice agent 或 speech reasoning model，並且模型會產生長 reasoning / tool traces，FlashTrace 類方法可以用來分析「模型最後的 spoken answer / tool action 到底依賴 user audio/transcript 哪些部分」。它比較像 agent debugging / grounding analysis 工具。

**project-tts-data-pipeline：低直接相關。**

它不處理 TTS、ASR 或 audio data cleaning。但「multi-token attribution」的概念可轉譯到 TTS pipeline debug：例如分析長 transcript prompt 中哪些 style tags / speaker tags / event tags 影響某段 generated speech，但這需要額外 audio-side attribution 方法，不是本篇直接提供。

對目前 Telegram/Codex paper system 比較有用的點是：如果未來讓 Codex worker 做長任務，FlashTrace 類 long-horizon attribution 可作為 debugging 長 reasoning / code generation 的工具概念。

## Speech reasoning brainstorming
如果把這篇放到 speech reasoning 脈絡，它最可能的用法不是直接解釋 waveform，而是先解釋 **speech-derived token sequence**：transcript tokens、speaker/event tags、ASR hypotheses、tool traces、或 speech LLM 的 internal text reasoning。

幾個可行方向：

- **Transcript-grounded speech reasoning attribution**：給定一段 user speech transcript、diarization、pause/backchannel tags，以及模型最後的 spoken answer/tool call，用 FlashTrace 類方法追蹤 answer span 依賴哪些 transcript spans。這能檢查 voice agent 是否真的使用 self-correction 後的內容，而不是被前面 false start 誤導。
- **Hallucinated ASR / noisy transcript debugging**：如果 speech reasoning model 答錯，可以看 attribution 是否集中到 ASR hallucination、錯分 speaker、或 noise-induced transcript fragment。這比只看 final WER 更接近「哪個錯誤真的影響 reasoning」。
- **Full-duplex tool-use analysis**：在 FDB-v3 類 benchmark 中，模型可能有 intermediate reasoning 和 tool-call arguments。FlashTrace 可用來追蹤 `destination=Boston`、`cancel_action`、`update_search_filter` 這類 argument 依賴 user utterance 的哪段 evidence，尤其適合分析 premature tool call / stale state。
- **Event-tag / paralinguistic control attribution**：若 transcript 內含 `[pause]`, `[overlap]`, `[laughs]`, `[backchannel]`, `[S1]`, `[S2]`，可以測模型的 decision 是否真的利用這些 event tags。例如 interruption policy 是否依賴 pause，而不是只依賴 lexical content。
- **Speech data curation**：對 speech reasoning dataset，保留那些模型 attribution 明確落在關鍵 acoustic/transcript evidence 的樣本；淘汰 attribution 主要落在 spurious boilerplate、speaker ID artifacts、或 annotation leakage 的樣本。
- **Judge / benchmark grounding metric**：除 Pass@1 / WER / tool accuracy 外，可以加一個 attribution-based grounding check：正確答案是否依賴 expected evidence spans。這可幫助區分「真的 grounded reasoning」和「靠 prior / shortcut 猜對」。

更進一步的研究版做法，是把 FlashTrace 從 text tokens 擴到 **audio codec tokens / speech encoder frames / multimodal hidden states**。這需要三個額外條件：

- 模型必須能暴露 attention maps 或可追蹤的 intermediate activations。
- audio frames / codec tokens 要能對齊回 time spans、speaker turns、events。
- attribution target 要能定義成 spoken answer span、tool-call argument span，或 acoustic output span。

**結論：FlashTrace 對 speech reasoning 是有用的，但第一步應該用在 transcript/event-token 層，而不是 raw audio 層。** 它適合作為 voice-agent reasoning / tool-call grounding debugger；若要直接解釋 end-to-end speech LLM 的 acoustic evidence，則需要把 span-wise attribution 改造成 multimodal/audio-token attribution。

## Related papers in my pool
- **MAI-Thinking-1**：同樣關心 reasoning / agentic workflow；FlashTrace 可作為解釋 reasoning model 長輸出的工具。
- **Full-Duplex-Bench-v3**：FDB-v3 的 voice agent tool-use eval 可借用 attribution 思路分析 agent action 依賴哪些 transcript spans。
- **PlanAudio**：PlanAudio 用 latent plan 連接 prompt 和 audio generation；FlashTrace 是另一種 tracing long-horizon dependency 的方法，但 modality 不同。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX 使用 ICML 2026 style，但目前以 arXiv preprint 記錄；若之後確認正式 venue，再更新。

## 我該不該細讀
**不需要為 speech/TTS 主線優先細讀，但建議保留。**

建議細讀的情境：

- 你要做 Codex/agent worker 的 long-horizon debugging。
- 你想理解 reasoning trace 是否真的依賴原始 prompt evidence。
- 你在設計 tool-use / code-generation eval，想知道錯誤 action 的 source evidence。

對 speech synthesis / full-duplex data 來說，它是 indirect infrastructure paper，優先級低於 TTS、dialogue synthesis、ASR robustness、speech data cleaning papers。

## 可能的弱點 / open questions
- FlashTrace 需要 access attention maps；若 cache all layers attention，space 是 `O(L * N^2)`，長 context 仍可能很重。
- on-the-fly recomputation 可降 memory，但會增加 latency。
- span aggregation 會犧牲 per-token resolution；作者也承認 diffuse evidence 和 structural tokens 可能造成 attribution 分散或 spurious salience。
- 評估常保留 final answer 正確的 samples；雖然 appendix 有 unfiltered experiments，但錯誤 reasoning 的 attribution 是否穩定仍是實務問題。
- 它解釋的是 token-level information flow，不等於完整 mechanistic circuit explanation。

## Tags
- llm
- interpretability
- attribution
- reasoning
- speech-reasoning
- agentic-workflow
- long-context
- project-audio-model-evaluation
- project-full-duplex-data

## Concepts
- multi-token attribution
- span-wise aggregation
- recursive attribution
- information absorption
- reasoning chain interpretability
- RISE
- MAS
- Recovery Rate
- Exhaustive Token-Level Rollout
- Aider code generation attribution
- transcript-grounded speech reasoning
- tool-call grounding
- multimodal attribution

## Citation
```bibtex
@misc{pan2026longhorizoninterpretabilityefficientfaithful,
  title={Towards Long-Horizon Interpretability: Efficient and Faithful Multi-Token Attribution for Reasoning LLMs},
  author={Wenbo Pan and Zhichao Liu and Xianlong Wang and Haining Yu and Xiaohua Jia},
  year={2026},
  eprint={2602.01914},
  archivePrefix={arXiv},
  primaryClass={cs.LG},
  doi={10.48550/arXiv.2602.01914}
}
```
