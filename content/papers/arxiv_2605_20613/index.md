---
paper_key: arxiv_2605_20613
canonical_id: "arxiv:2605.20613"
title: "HRM-Text: Efficient Pretraining Beyond Scaling"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.20613"
pdf_url: "https://arxiv.org/pdf/2605.20613"
status: read
rating: 6
tags:
  - llm
  - efficient-pretraining
  - recurrent-model
  - reasoning
  - speech-llm
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source. This is an LLM architecture / efficient-pretraining paper, not a direct speech/audio data paper.

## Links
- [Original URL](https://arxiv.org/abs/2605.20613)
- [arXiv abstract](https://arxiv.org/abs/2605.20613)
- [PDF](https://arxiv.org/pdf/2605.20613)
- [arXiv source](https://arxiv.org/src/2605.20613)
- [Official GitHub](https://github.com/sapientinc/HRM-Text)

## 一句話總結
**HRM-Text** 主張 efficient pretraining 不一定只能靠更多 tokens / compute：用 hierarchical recurrent architecture、`MagicNorm`、warmup deep credit assignment，再搭配 instruction-response-only training、response-only loss、`PrefixLM` masking，可以讓 1B model 用 40B unique tokens / 約 1500 美元的訓練成本達到接近 2-7B open models 的 reasoning-heavy benchmark 表現。

## 這篇在解決什麼問題
現在 LLM pretraining 的主流 recipe 是：

```text
internet-scale raw text
  -> broad autoregressive pretraining
  -> mid-training / instruction tuning
  -> post-training
```

作者認為這條路雖然有效，但在 data-limited / compute-limited regime 很浪費：

- 大量 compute 花在預測 prompt-like 或 task-irrelevant text。
- 小實驗室很難從 scratch 做 foundation model research。
- Transformer 的單次 forward computation depth 可能不足以支撐 efficient reasoning。

HRM-Text 想驗證另一條路：

```text
更強的 internal recurrent computation
+ 更接近 inference usage 的 conditional objective
+ 更 focused 的 task-formatted data
= 用小很多的 token / compute budget 從 scratch train 出可用模型
```

這篇不是聲稱 HRM-Text 是最終最佳 LLM，而是給一個 existence proof：architecture 和 objective co-design 仍可能大幅改變 compute-to-performance ratio。

## 核心方法
### 1) Hierarchical Recurrent Model：slow H + fast L
HRM-Text 基於作者前作 **Hierarchical Reasoning Model (HRM)**。它把 recurrent computation 分成兩個 timescales：

- `L module`：fast-evolving execution layer，做 local iterative refinement。
- `H module`：slow-evolving strategic layer，維持較穩定的 high-level semantic context。

本篇的 forward schedule 是：

```text
2 high-level H cycles
each H cycle contains 3 fast L updates
final H state -> linear head -> token logits
```

所以 `H2L3` 共有 `2 x (3 + 1) = 8` 個 H/L module steps。由於 H/L module 各含 recurrent core 一半非 embedding parameters，表中把它算成約 `4 recursions`。

### 2) MagicNorm：讓 recurrent language model 比較穩
把 recurrence 擴到 language modeling 會遇到 gradient instability。作者比較 `PostNorm` 和 `PreNorm`：

- `PostNorm`：forward variance 穩，但 identity path 被破壞，deep optimization 容易 vanishing gradients。
- `PreNorm`：gradient path 好，但 residual accumulation 可能讓 hidden-state variance 成長，導致 representation collapse。

**MagicNorm** 的設計是：

- recurrent module 內部用多個 PreNorm blocks，保留 backward identity path。
- module exit 再加 final normalization，讓每個 recurrent step 的 output variance 被 bound。
- 搭配 truncated BPTT，forward 看起來像 PostNorm 穩定，backward horizon 短時又保留 PreNorm 的 optimization 優勢。

直覺是利用 forward horizon `N` 和 backward horizon `K` 的不對稱：

```text
forward: state passes through N module-level norms -> variance bounded
backward: gradient only through K truncated steps -> fewer norm bottlenecks
```

### 3) Warmup deep credit assignment
原始 HRM 只 backprop through 最後兩個 recurrent steps。HRM-Text 做 warmup：

```text
early training: K = 2 recurrent steps
later training: linearly warm up to K = 5
```

目的是先讓模型在短 credit-assignment path 上穩定，再逐步引入更長 recurrent computation。這也降低早期 backward-pass compute。

### 4) Task-completion objective
HRM-Text 不做標準 raw-text autoregressive pretraining，而是直接從 scratch 用 instruction-response pairs：

```text
x = (x_q, x_a)
loss = -log P(x_a | x_q)
```

也就是只對 response tokens 計算 NLL，不預測 instruction tokens。作者的觀點是：inference 時 prompt 已知，模型真正需要學的是在 prompt 條件下完成 response；因此把 loss 放在 response 上更 sample-efficient。

### 5) PrefixLM masking
因為不用預測 instruction，所以 instruction segment 不需要 causal mask。HRM-Text 用 `PrefixLM` attention：

- instruction tokens 之間 bidirectional attention。
- response tokens 仍 causal generation。

這讓 decoder-style implementation 內部有點像 encoder-decoder：

```text
instruction: fully visible context
response: autoregressive output
```

作者報告 PrefixLM 有更高 attention softmax entropy，attention 更 global / diverse；causal attention 則較 localized。

## Training / Data
HRM-Text 只用 open-source datasets。初始 corpus 約：

- **176.5B tokens**
- **593.7M documents**

實際訓練：

- sample **40B unique tokens**
- total training duration **60B tokens**
- stratified sampling，而不是把所有資料混成一池均勻抽樣

資料類型包括：

- General instructions：FLAN、Tasksource、NoRobots，138.7B tokens。
- Rewritten Wikipedia knowledge：SYNTH，21.7B tokens。
- Math and reasoning：Platypus、Principia、OpenMathInstruct2、NuminaMath、OmniMATH，6.8B tokens。
- Symbolic：DMMath、AMPS、Sudoku-Extreme，6.2B tokens。
- Reasoning data with thinking tokens removed：AceReason、OpenThoughts2，2.4B tokens。
- Textbook exercises：358M tokens。
- Extracted web instructions：NaturalReasoning、WebInstruct-verified、AMPS-khan，375M tokens。

### Condition tags
作者在 instruction 前加 condition tags 控制 response style：

- `direct`：answer-only
- `cot`：chain-of-thought
- `synth`：synthetic answer style
- `noisy`：web-crawl text with uneven formatting

這點對 speech / dialogue 也有啟發：未來可以把 response style、latency mode、backchannel mode、interruption mode 也作成 condition tags。

### 去掉 `<think>` traces
作者把所有 `<think>...</think>` 內容在 training 前移除。理由是希望 HRM-Text 依靠 internal hierarchical computation，而不是明示 long-CoT traces。

這個設計和 speech reasoning 很相關：如果未來做 spoken agent，我們也可能想要模型在內部完成 planning，而不是把 verbose CoT 全部外顯到 spoken response。

### Sampling
作者使用 SeqIO-style stratified sampling。每個 dataset/task 是獨立 stratum，避免大 dataset 過度主導，也 upsample 小資料集。例如：

- FLAN：5k docs/task cap。
- Tasksource：10k docs/task cap。
- SYNTH：10M docs cap。
- AceReason：2M docs cap。
- OpenThoughts2：500k docs cap。
- small datasets <= 50k docs：upsample 到 10x。

### Training infrastructure
HRM-Text 1B：

- 2 個 `8 x H100` nodes。
- 46 hours。
- 成本約 **USD 1,472**，假設 USD 2 / H100 hour。
- BPE tokenizer，vocab 65,536。
- context size 4,096。
- each module 16 layers，hidden size 1536，head size 128。
- Adam-atan2 optimizer。
- LR warmup 2,000 steps，constant LR `2.2e-4`。
- batch size 196,608 tokens。
- EMA decay 0.9999，final eval / release 使用 EMA checkpoint。

## 主要結果
### 1) Objective / PrefixLM / HRM 都有增益
在 FLOPs-matched ablation 裡：

**Transformer 1B**

- `P(x)` + causal：MMLU 40.55，ARC-C 51.91，DROP 38.24，GSM8K 48.37，MATH 35.44。
- `P(x_a|x_q)` + causal：MMLU 47.72，ARC-C 62.88，DROP 54.24，GSM8K 69.75，MATH 47.04。
- `P(x_a|x_q)` + PrefixLM：MMLU 53.15，ARC-C 74.32，DROP 75.30，GSM8K 75.06，MATH 48.36。

**HRM 1B**

- `P(x)` + causal：MMLU 43.68，ARC-C 60.24，DROP 42.74，GSM8K 66.19，MATH 44.32。
- `P(x_a|x_q)` + causal：MMLU 50.60，ARC-C 69.80，DROP 62.39，GSM8K 79.91，MATH 54.18。
- `P(x_a|x_q)` + PrefixLM：MMLU **60.73**，ARC-C **81.91**，DROP **82.21**，GSM8K **84.53**，MATH **56.16**。

所以貢獻不是單點：response-only conditional objective、PrefixLM、HRM architecture 三者疊加。

### 2) Recurrent architecture 在 matched compute 下有優勢
在 training FLOPs 約 `1e21` 的 matched comparison：

- HRM 1B：MMLU **60.73**，ARC-C **81.91**，DROP **82.21**，GSM8K **84.53**，MATH **56.16**。
- Looped Transformer 1B：MMLU 56.51，ARC-C 74.06，DROP 76.20，GSM8K 75.13，MATH 48.30。
- RINS 1B：MMLU 56.09，ARC-C 76.71，DROP 79.92，GSM8K 77.71，MATH 48.90。
- Transformer 3B Deep：MMLU 56.67，ARC-C 80.46，DROP 76.95，GSM8K 75.66，MATH 50.50。

作者解讀為 recurrent / looped computation 確實能提高 fixed compute 下的 benchmark yield，而 HRM 是其中強的一個設計點。

### 3) 和 open / open-weight models 比
HRM-Text 1B 在只用 0.06T training tokens、約 `1e21` FLOPs 的設定下：

- MMLU 60.7
- ARC-C 81.9
- HellaSwag 63.4
- WinoGrande 72.4
- BoolQ 86.2
- DROP 82.2
- GSM8K 84.5
- MATH 56.2

相對比較：

- Llama3.2 3B：9T tokens，MMLU 58.0，GSM8K 77.7，MATH 48.0。
- Gemma3 4B：4T tokens，MMLU 59.6，HellaSwag 77.2，但 math/reasoning 較弱。
- Qwen3.5 2B：36T tokens，MMLU 64.5，ARC-C 81.0，GSM8K 53.0，MATH 34.2。
- OLMo3 7B：6T tokens，MMLU 65.8，ARC-C 81.6，GSM8K 75.5，MATH 40.0。

HRM-Text 不一定在 factual coverage / MMLU 上贏最大模型，但在 reasoning-heavy tasks 特別強。

### 4) Dataset contamination 檢查
作者用類似 Llama family 的 n-gram contamination test：

- tokenize benchmark questions。
- 找 pretraining corpus 中的 n-gram matches。
- 按 contamination percentage 分成 Clean、Not Clean、Not Dirty、Dirty。
- 如果 contamination 真的提高 performance，Clean 應顯著低於平均，Dirty 應顯著高於平均。

HRM-Text 0.6B 在 `n=13` 和 `n=20` 沒顯著 contamination。HRM-Text 1B 在 DROP 上 `n=13` 有統計顯著，但 `n=20` 沒有；而 DROP strictly clean subset 仍有 81.1。作者結論是 benchmark performance 不太可能主要由 test contamination 驅動。

### 5) Effective depth
作者用兩種方式分析 HRM 是否真的增加 effective depth：

- adjacent recurrent blocks 的 representation difference norm / cosine similarity。
- logit lens：看不同深度 hidden states 經 output head 後，和 final distribution 的 KL divergence。

結果顯示 standard Transformer / looped Transformer 較早收斂到穩定 output distribution；HRM 在更深 recurrent steps 保持較大 KL，表示 deeper computation 仍在改變 prediction。

## Project relevance
**speech LLM / speech reasoning：中度相關，偏 architecture 和 objective。**

這篇沒有處理 audio input、ASR、TTS、full-duplex、data cleaning。但它對 speech LLM 有三個值得借的想法：

1. **compact reasoning core + external knowledge / retrieval**  
   作者討論把 factual coverage 和 reasoning computation 拆開。對 spoken agent 很自然：語音模型可以有較小的 recurrent reasoning core，知識由 retrieval / tools / memory 提供。

2. **PrefixLM for instruction / response separation**  
   在 speech dialogue 裡，user audio transcript / event tags / tool context 可以作為 prefix，assistant response 保持 causal generation。這比「把所有 token 都當同一條 causal stream」更接近實際任務。

3. **condition tags for output style**  
   HRM-Text 用 `direct` / `cot` / `synth` / `noisy` 控制 response format。對 full-duplex / TTS，可以改成：

```text
[direct] short answer
[backchannel] minimal acknowledgement
[interrupt] concise correction
[cot_hidden] internal plan, spoken response short
[style:calm] / [style:fast] / [latency:low]
```

**project-full-duplex-data：低到中度相關。**

它不能幫我們做 mono -> dual-channel data processing，但可以啟發 **dual-channel generator 或 speech agent 的 control-token objective**：

- user transcript / event tags 走 prefix bidirectional attention。
- assistant speech/text response 走 causal generation。
- recurrent core 負責多步 planning，例如 interruption handling、self-correction resolution、tool call sequencing。

**project-tts-data-pipeline：低相關。**

它不是 TTS data cleaning paper。但它的 data mixture recipe 有參考：

- instruction-response pairs 比 raw text 更高效。
- condition tags 可控制 output style。
- stripping explicit `<think>` traces 可避免模型學到不想外顯的 reasoning text。
- stratified sampling / caps 可以避免大來源壓過小但高價值資料。

## Related papers in my pool
- [GEM](/papers/arxiv_2605_26121/)：GEM 解決 cleaned corpus 如何分群與 data mixing；HRM-Text 則展示 focused instruction-response data + architecture 可以提高 pretraining efficiency。兩者可串：GEM 做 mixture taxonomy，HRM-style objective 做 efficient training。
- [Towards Long-Horizon Interpretability / FlashTrace](/papers/arxiv_2602_01914/)：HRM-Text 強調 internal computation；FlashTrace 可作未來分析 recurrent reasoning 是否真的依賴正確 source spans 的工具。
- [Full-Duplex-Bench-v3](/papers/arxiv_2604_04847/)：FDB-v3 測 self-correction / tool-use spoken agents；HRM-Text 的 PrefixLM + condition tags 可作 agent policy model 的 training objective 參考。
- [SoulX-Duplug](/papers/arxiv_2603_14877/)：SoulX-Duplug 是 streaming ASR + state prediction；HRM-Text 是 internal recurrent reasoning。若要做 low-latency speech agent，可把 streaming state control 和 recurrent reasoning core 分工。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
如果你現在重點是 **speech data cleaning / TTS corpus cleaning**，這篇不是優先。它沒有 waveform、ASR alignment、speaker、overlap、TTS quality filtering。

如果你在想 **speech reasoning model / spoken agent 的 backbone 與 training objective**，這篇值得細讀，尤其是：

1. `MagicNorm` 如何讓 recurrent depth 可訓練。
2. warmup deep credit assignment 如何避免 early instability。
3. response-only task-completion objective。
4. PrefixLM mask 對 instruction-response separation 的影響。
5. condition tags 和 `<think>` stripping 對 response style control 的啟發。

## 可能的弱點 / open questions
- **不是 raw-text pretraining 的公平替代。** 它用 instruction-response pairs 訓練，因此更像 from-scratch task-formatted pretraining；不能直接說它在所有 open-ended language modeling 上取代 internet-scale raw-text pretraining。
- **factual knowledge coverage 仍受限。** 作者也承認 reasoning-heavy tasks 表現強，但 broad factual coverage / MMLU 仍更依賴 data breadth 和 scale。
- **inference compute 可能較高。** Recurrent depth 增加 internal computation；作者討論未來可用 adaptive computation time (ACT) 讓簡單 prompt early exit，但本篇未使用。
- **PrefixLM serving 需要工程配合。** 在 vLLM 等框架可行，但 multi-turn chat 需要 custom attention mask / KV-cache logic。
- **結果主要到 1B HRM scale。** Transformer scaling 實驗到 3B，但 HRM-Text headline 是 1B；更大 scale 是否仍維持 100-900x token efficiency 需要驗證。
- **資料組成偏 instruction/reasoning。** 對 speech dialogue 或 TTS-style generation，需要重新設計 condition tags、prefix structure 和資料 mixture。

## Tags
- llm
- efficient-pretraining
- recurrent-model
- hierarchical-recurrent-model
- reasoning
- PrefixLM
- task-completion-objective
- instruction-response-training
- speech-llm

## Concepts
- HRM-Text
- Hierarchical Recurrent Model
- dual-timescale recurrence
- MagicNorm
- warmup deep credit assignment
- truncated BPTT
- task-completion objective
- response-only loss
- PrefixLM masking
- instruction-response pretraining
- condition tags
- internal reasoning
- effective depth
- logit lens analysis
- contamination test
- compact reasoning core

## Citation
```bibtex
@misc{wang2026hrmtextefficientpretrainingbey,
  title={HRM-Text: Efficient Pretraining Beyond Scaling},
  author={Wang, Guan and Liu, Changling and Wang, Chenyu and Zhou, Cai and Sun, Yuhao and Wu, Yifei and Zhen, Shuai and Scimeca, Luca and Abbasi-Yadkori, Yasin},
  year={2026},
  eprint={2605.20613},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2605.20613}
}
```
