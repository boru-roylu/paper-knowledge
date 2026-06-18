---
paper_key: arxiv_2605_20755
canonical_id: "arxiv:2605.20755"
title: "DuplexSLA: A Full-Duplex Spoken Language Model with Synchronized Speech, Language, and Action"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.20755"
pdf_url: "https://arxiv.org/pdf/2605.20755"
status: read
rating: 8.6
tags:
  - speech-llm
  - full-duplex
  - speech-agent
  - tool-calling
  - turn-taking
  - project-full-duplex-data
  - project-audio-model-evaluation
created: 2026-06-18
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv TeX source `source/main.tex`、`source/content/*.tex`、`references.bib` 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2605.20755](https://arxiv.org/abs/2605.20755)
- arXiv abstract: [https://arxiv.org/abs/2605.20755](https://arxiv.org/abs/2605.20755)
- PDF: [https://arxiv.org/pdf/2605.20755](https://arxiv.org/pdf/2605.20755)
- arXiv source: [https://arxiv.org/src/2605.20755](https://arxiv.org/src/2605.20755)
- Project / code / benchmark: [https://github.com/hyzhang24/DuplexSLA](https://github.com/hyzhang24/DuplexSLA)

## 一句話總結

DuplexSLA 是一個 native full-duplex **Speech-Language-Action** model：它把 user audio、assistant audio、action/tool-calling text 放在同一個 `160 ms` chunk timeline 上，由同一個 7B speech-LM backbone 同步處理 listening、speaking、planning、tool calling；核心新意是用獨立 action channel 讓 pause / interrupt / backchannel 和 tool calls 在 assistant speech 持續播放時仍可被即時產生。

## 這篇在解決什麼問題

傳統 spoken agent 多半是 turn-based cascade：

```text
VAD -> ASR -> LLM -> TTS
```

這種架構有兩個根本問題：

- **Turn-taking 太粗**：energy VAD 很難分辨 end-of-turn、hesitation pause、backchannel、真正 interruption。外掛 semantic VAD 可以改善，但會增加 latency，而且它看不到 assistant 內部 planning state。
- **Tool calling 和 speech timeline 分離**：如果先 tool call 再說話，會增加延遲；如果等說完再 tool call，side-effect 太晚；如果把 tool JSON 混在 assistant speech channel 裡，又會破壞 speech output。

DuplexSLA 的問題設定是：一個 speech agent 應該能在同一條 conversational clock 上同時 listen、speak、think、act，而不是在 turn boundary 才能 action。

## 核心方法

### 1. Dual-stream three-channel formulation

DuplexSLA 把對話切成 `160 ms` chunks。每個 chunk 有三個 channel：

- **User Channel**：continuous user audio features，每 chunk 2 個 causal features，80 ms stride。
- **Assistant Channel**：discrete assistant speech sequence，使用 `TA4` layout，也就是 1 個 text anchor `T` + 4 個 audio tokens `A`，audio token stride 40 ms。
- **Action Channel**：textual stream，可包含 delayed transcript、planning text、turn-taking labels、structured tool calls。

這叫 dual-stream three-channel：

```text
physical streams:
  user audio
  assistant audio

semantic channels:
  user audio channel
  assistant audio channel
  action text channel
```

### 2. Per-chunk serialization

每個 chunk 被序列化成：

```text
<|user_audio_begin|> U U <|user_audio_end|>
<|assistant_audio_begin|> T A A A A <|assistant_audio_end|>
<action text> <|action_end|>
```

assistant channel 和 action channel 是模型要 autoregressively produce 的部分；user audio 是 causal input。

如果沒有 speech / action：

- `T` 會是 `<vad_silence>` 或 `<tts_pad>`。
- audio tokens 是 silence codes。
- action channel 只輸出 `<|action_end|>`。

### 3. Action channel

Action channel 是這篇的核心設計。它可以輸出：

- planning text
- turn-taking labels：`response` / `interrupt` / `backchannel`
- tool call JSON：包在 `<|toolcall_begin|>` 和 `<|toolcall_end|>` 中

範例：

```text
planning
<|toolcall_begin|>{"function":"function_name","arguments":"arguments"}<|toolcall_end|>
```

每個 action 都 anchor 到 chunk index，因此天然有 timestamp。

### 4. Real-time decoding budget

因為 chunk 是 `160 ms`，每個 chunk 的 action channel 不能太長。作者設定：

```text
action channel <= 10 text tokens per chunk
```

超過的 tokens spill into following chunks。這是 deployment budget，不是架構限制。

### 5. Native pause / interrupt / backchannel

DuplexSLA 不用 external semantic VAD，而是把 turn-taking decision 放進同一個 backbone：

- **Pause**：user 還沒講完，只是在 hesitation；assistant 保持 silence。
- **Interrupt**：user 在 assistant 講話時提出新 thought；action channel 輸出 `interrupt`，assistant TA4 切成 silence。
- **Backchannel**：user 說短 feedback，例如 "you are right"，但不搶話；action channel 輸出 `backchannel`，assistant 繼續講。

這對 full-duplex voice agent 很關鍵，因為 backchannel 和 interruption 在 acoustic form 上很像，但 conversational intent 完全不同。

### 6. In-conversation planning and tool calling

兩種重要 tool-calling pattern：

- **Backchannel-triggered tool calling**：user 在 assistant 正說話時插一句 "play some Beatles songs"，系統要 dispatch tool call，但 assistant spoken thread 不應被打斷。
- **Multi-action tool calling**：單一 user request 可能包含開空調、播放音樂、導航三個 actions；action channel 讓 tool calls 依 semantic order 分 chunk 輸出，同時 assistant speech 繼續生成。

作者用 FIFO queue 管理 action objects：同 chunk 的 actions 按 trigger-time order 串接；若 action 超過 token budget，spill 到後續 chunks，但不會 preempt earlier action，也不會切斷 open tool-call block。

### 7. Dual-side ASR alignment

一個細節很重要：action channel 不只學 user transcript，也學 assistant transcript。

原因是 assistant TA4 的 text anchor `T` 是 left-aligned，不一定代表該字實際被說出的時間。作者讓 action channel 在「字真正被說出來的 chunk」重新 emit assistant transcript，藉此把 assistant audio 和 action time 對齊。這是 sub-second tool-call latency 的 timing prior。

## Training / Data

Backbone：

- 7B speech-LM。
- initialized from **Step-Audio 2 mini**。

Training stages：

### Stage 1: Continued pretraining

目標是讓 backbone 熟悉 chunked dual-stream three-channel format。

Data mixture：

- Duplex dialogue：約 `320k hours`。
- User-channel ASR：約 `90k hours`。
- Assistant-channel ASR：約 `90k hours`。
- General text：約 `1.92M samples`。

總計約 `500k hours audio + 1.92M text samples`。

### Stage 2: Capability-oriented post-training

目標是強化 full-duplex control 和 tool calling。

Data mixture：

- interrupt + backchannel + pause：約 `36k hours`。
- tool-call data：約 `14k hours`，包含 backchannel-action、single-action、multi-action。

總計約 `50k hours`。

Loss：

- assistant TA4 stream：next-token cross-entropy。
- action channel：next-token cross-entropy。
- text-only slice：general text modeling term。
- 額外對 silence anchors、channel boundary markers、task-conditioned segments 做 full-duplex-aware masking / reweighting。

## 主要結果

### 1. DuplexSLA-Bench

作者建立 `DuplexSLA-Bench`：

- turn-taking subset：`1,200` cases。
  - normal：300
  - pause：300
  - interrupt：300
  - backchannel：300
- tool-call subset：`900` cases。
  - single-action：300
  - multi-action：300
  - backchannel-action：300

每個 scenario 都評估 accuracy 和 delay。delay 是 realized action time 和 desired semantic anchor 的距離。

### 2. Tool-call results

DuplexSLA 和 ASR+LLM cascade 比較：

- ASR+LLM average accuracy：`91.33%`，delay `2.77s`。
- DuplexSLA average accuracy：`85.56%`，delay `0.64s`。

分項：

- single-action：DuplexSLA `85.67% / 0.67s`。
- multi-action：`75.00% / 0.68s`。
- backchannel-action：`96.00% / 0.57s`。

重點：accuracy 低一些，但 latency 約 `4x` 低，且能在 assistant speech 沒停下來時發 tool call。

### 3. Context prefill full-duplex results

在 context-prefill setting，DuplexSLA：

- normal：`96.00% / 0.27s`
- pause：`93.33% / 0.27s`
- interrupt：`99.33% / 0.40s`
- backchannel：`98.33% / 0.32s`

對比：

- Gemini / GPT realtime baselines 在 normal / pause 還可以，但 backchannel accuracy 最高只有 `40%`，有的接近 0。
- DuplexSLA 是唯一能 cleanly handle backchannel label 的系統。

### 4. No-context-prefill full-duplex results

只測 normal / pause：

- DuplexSLA average：`94.34% / 0.30s`
- Gemini flash live：`93.17% / 1.17s`
- GPT realtime semantic-vad-high：`96.50% / 1.57s`
- MiniCPM-o：`82.00% / 0.61s`
- Freeze-Omni / PersonaPlex 在 pause subset collapse。

重點：DuplexSLA 是唯一 sub-second 且 accuracy competitive 的系統。

## Project relevance

### project-full-duplex-data：高度相關

這篇不是「mono dialogue -> dual-channel training data」的 separation paper，但它對 full-duplex project 有幾個直接啟發：

1. **資料格式比模型架構同樣重要**

   DuplexSLA 的核心能力來自 chunked dual-stream three-channel supervision。對我們來說，如果要訓練 dual-channel audio generator，也要設計清楚：

   ```text
   speaker A track
   speaker B track
   transcript / event / action / timing channel
   ```

   而不是只把 waveform 丟進模型。

2. **Action / event channel 可以獨立於 speech audio**

   對 full-duplex dialogue synthesis，我們也可以考慮第三個 channel：

   ```text
   [overlap], [backchannel], [interrupt], [pause], [turn-yield], [tool-call]
   ```

   這些不是普通 transcript，但對 natural full-duplex dialogue 很重要。

3. **Dual-side ASR alignment 值得借鑑**

   作者讓 user transcript 和 assistant transcript 都在 action channel 上按真實 chunk time emit。這對我們要從 mono audio 建 dual-channel data 很有用：A/B channel 的 transcript 不只要有文字，還要和 chunk-level audio timing 對齊。

4. **Benchmark design 可直接借用**

   DuplexSLA-Bench 的 normal / pause / interrupt / backchannel 四分類，剛好是 full-duplex agent / dialogue generator 必須測的能力。可以改造成：

   - overlap region 的 ASR preservation。
   - backchannel 不被刪掉。
   - interruption boundary 是否合理。
   - pause 是否被誤判成 turn end。

### project-audio-model-evaluation：高度相關

DuplexSLA 的 evaluation framing 很有用，因為它同時評估：

- accuracy：行為是否正確。
- delay：是否在正確 semantic anchor 附近發生。
- action timestamp：tool call / backchannel / interrupt 是否被時間對齊。

這比單純 judge output correctness 更接近 real-time audio agent evaluation。

### project-tts-data-pipeline：中度相關

如果要生成可訓練的 full-duplex / agentic TTS data，DuplexSLA 的 data recipe 提醒我們需要：

- chunk-level transcript。
- speaker-specific timing。
- action/event labels。
- backchannel vs interruption distinction。
- silence / pause annotations。

但它不是 TTS data cleaning paper，本身沒有詳細講如何從 messy web audio 清洗到這種 schema。

## Related papers in my pool

- [Full-Duplex-Bench-v3](../arxiv_2604_04847/)：同樣是 full-duplex evaluation，但 DuplexSLA 把 action/tool calling 加進同一個 benchmark。
- [A Full-duplex Speech Dialogue Scheme Based On LLM](../arxiv_2405_19487/)：早期 full-duplex scheme，DuplexSLA citation graph 已連到它。
- [PersonaPlex](../arxiv_2602_06053/)：voice/persona control for full-duplex conversational speech models，也是 DuplexSLA citation graph 的 known citation。
- [SoulX-Duplug](../arxiv_2603_14877/)：semantic VAD / dialogue state prediction；DuplexSLA 的立場是不要外掛 semantic VAD，而是讓 backbone native learn turn-taking labels。
- [Sommelier](../arxiv_2603_25750/)：full-duplex preprocessing pipeline；DuplexSLA 則是 model/interface/benchmark design。
- [FunASR](../../tools/modelscope-funasr/)：可作 data construction 裡 ASR / VAD / diarization baseline，但 DuplexSLA 最終目標是把 control decision 放進 backbone 而非外掛。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。arXiv source 使用一般 arXiv style，metadata 目前以 arXiv preprint 記錄。

## 我該不該細讀

建議細讀，尤其是 architecture、data construction、evaluation 三個部分。

最值得讀：

- dual-stream three-channel formulation。
- action channel 的 serialization 和 token budget。
- dual-side ASR 為什麼能維持 timing alignment。
- DuplexSLA-Bench 的 evaluation windows / delay definitions。
- backchannel-action 和 multi-action tool calling 的 benchmark setup。

對我們最重要的 takeaway：

> full-duplex 不是只有 audio overlap 問題，而是需要把 speech、language、action、event labels 全部放到同一個可訓練的 timeline 上。

## 可能的弱點 / open questions

- 這篇很像 system report；很多資料構造細節、標註品質、LLM annotation 的 error rate 沒完全展開。
- Duplex dialogue 320k hours、post-training 50k hours 的來源與可重現性有限。
- evaluation benchmark 是作者自己構建，可能和 training distribution 接近，需要外部 benchmark 驗證。
- tool-call domain 偏 cabin / smart-home schemas，open-domain agentic speech tool use 還要再測。
- action channel 目前每 chunk 10 tokens，complex planning / long JSON 可能會 spill 多 chunks，latency 和 correctness trade-off 需要更多分析。
- backchannel / interrupt labels 是 textual action labels，不代表模型真的理解所有社交語用情境；cross-lingual / noisy / multi-speaker overlap 還未知。
- 對我們的 mono-to-dual-channel data project，它不是 separation 解法；它提供的是 downstream full-duplex agent schema 和 evaluation target。

## Tags

- speech-llm
- full-duplex
- speech-agent
- tool-calling
- turn-taking
- streaming-speech
- action-channel
- project-full-duplex-data
- project-audio-model-evaluation

## Concepts

- DuplexSLA
- Speech-Language-Action model
- full-duplex spoken language model
- dual-stream three-channel formulation
- action channel
- TA4 layout
- 160 ms chunk timeline
- native interruption
- pause detection
- backchannel detection
- in-conversation tool calling
- multi-action tool calling
- backchannel-triggered tool call
- DuplexSLA-Bench
- dual-side ASR alignment
- full-duplex-aware masking

## Citation

```bibtex
@misc{zhang2026duplexslafullduplexspokenlanguage,
  title={DuplexSLA: A Full-Duplex Spoken Language Model with Synchronized Speech, Language, and Action},
  author={Haoyang Zhang and Jun Chen and Donghang Wu and Yuxin Li and Yuxin Zhang and Xiangyu Tony Zhang and Che Liu and Qingjian Lin and Yizhou Peng and Hexin Liu and Eng Siong Chng and Chao Yan and Boyong Wu and Yechang Huang and Xuerui Yang and Fei Tian},
  year={2026},
  eprint={2605.20755},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2605.20755}
}
```
