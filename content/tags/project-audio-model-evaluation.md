---
title: "Project: Audio model evaluation"
---

## Motivation

我們需要一套能評估 speech / audio generation model 的方法，不只是看 MOS、WER、CLAP 或單一 holistic judge score。真正有用的 evaluation 應該能回答三個問題：模型輸出是否滿足 instruction、哪個細節失敗、以及 judge 的判斷是否真的 grounded in audio / transcript / event evidence。

這條 project line 目前由三個互補方向組成：

- **AnyAudio-Judge**：把複雜 audio instruction 拆成 dynamic yes/no rubrics，評估 speech、sound、music、mixed audio 是否逐項滿足要求。
- **PlanAudio**：作為 speech+sound composite generation 的代表任務與模型設計；它本身不是 evaluator，但提供了需要被評估的 free-form prompt -> unified audio 場景。
- **FlashTrace**：提供 long-horizon multi-token attribution 思路，可用來追蹤 judge 的 yes/no、evidence span、tool action 或 spoken response 是否依賴正確 input / transcript / event tokens。
- **τ-bench**：提供 tool-agent-user interaction 的 deterministic final-state evaluation 和 `pass^k` reliability metric；可借來評估 voice agent 是否在多輪 spoken interaction 後真的做對 tool/database outcome。

核心想法是：**rubric-level correctness + attribution-level grounding**。AnyAudio-Judge 告訴我們每個 rubric 是 yes/no；FlashTrace 類方法幫我們檢查這個 yes/no 是否真的由正確 evidence 支持；PlanAudio 或其他 open audio generators 則提供可被測、可被 reward、可被 debug 的生成目標。

## Target

- 建立 audio generation / TTS / dialogue TTS / full-duplex model 的 rubric-based evaluation protocol。
- 把 prompt / transcript / event tags 拆成 atomic checks，例如 speaker、emotion、speech content、background sound、event order、foreground/background hierarchy、backchannel、overlap timing。
- 用 open evaluator 取代 black-box Gemini-style judge，保留可重現的 per-rubric score 和 evidence。
- 對 judge output 做 grounding / attribution audit，檢查 yes/no 是否依賴正確 transcript span、event tag、semantic plan 或 audio-token/time span。
- 將 evaluation 結果轉成 data filtering、model selection、rejection sampling 或 RL reward signal。

## Current Hypothesis

最值得探索的系統是：

```text
free-form prompt / transcript / event controls
  -> rubric decomposition
  -> audio generator output
  -> per-rubric audio judge
  -> attribution / grounding audit
  -> filtering, reward, or debugging feedback
```

對 PlanAudio 類 composite audio generation，rubrics 可以檢查 speech content、speaker attributes、background events、temporal order 和 mixing hierarchy。對 full-duplex / dialogue audio，rubrics 可以檢查 speaker role、self-correction、pause、backchannel、overlap、interruption timing 和 final intent grounding。

FlashTrace 的第一步應該先用在 **text / transcript / event-token layer**，而不是直接解釋 raw waveform。若要做到真正的 audio span attribution，需要 open audio judge 或 speech LLM，並且能把 audio frames / codec tokens 對齊回 time spans、speaker turns 和 events。

## Grounded rubric credit assignment

StepOPSD 提供一個可以借到 audio evaluation 的 framing：不要把整段 audio clip 當成 monolithic reward object，而是把 judge 的 yes/no 重新分配到可定位的 local spans。

目前 AnyAudio-Judge 比較像：

```text
audio + prompt
  -> dynamic rubric questions
  -> yes/no answers
```

這對 scoring 有用，但對 human-friendly reasoning 還不夠。更理想的 evaluator 應該輸出：

```text
rubric answer = No
evidence = 12.3s-14.1s, speaker B backchannel starts too early
reason = temporal order / overlap timing violates the instruction
```

可行的資料構建路線：

```text
AnyAudio-Judge data / prompts
  -> generate rubric question-answer pairs
  -> use FlashTrace-style attribution to find transcript / event / audio-token spans
  -> map spans back to time ranges
  -> human verifies whether the evidence span supports the rubric decision
  -> grounded rubric dataset
```

這本身就可能是一個 contribution，因為它從普通 rubric labels 升級成：

- answer：rubric yes/no。
- evidence span：audio time span、codec-token span、transcript span 或 event span。
- rationale：人能理解的 failure reason。
- verification：人工或 cross-judge 檢查 attribution 是否真的 grounded。

更進一步，這些 grounded signals 可以回流到 training：

- train audio judge to answer with evidence span and rationale。
- train generator with span-level reward，而不是只用 clip-level reward。
- 把 bad spans 用於 data filtering / rejection sampling。
- 把普通 rubrics 改寫成 input-grounded rubrics，例如「檢查 8-12 秒內 speech 和 background event 的 temporal order」。
- 做 reward-hacking audit：如果 judge 的 attribution 不落在合理 evidence span，該 yes/no decision 應降權。

## Open Questions

- AnyAudio-Judge 的 per-rubric yes/no 在 speech+sound mixed audio 上是否足夠穩，特別是 subtle background、foreground/background hierarchy 和 temporal order？
- 如果用 AnyAudio-Judge 當 reward model，generator 會不會學到容易騙過 rubric judge、但人聽起來不自然的 shortcut？
- FlashTrace 類 attribution 能否有效延伸到 audio codec tokens / speech encoder frames？
- StepOPSD-style credit shaping 能否把 clip-level rubric reward 穩定轉成 span-level reward，而不引入新的 judge shortcut？
- 對 black-box judges，只能拿到文字 evidence；這種 evidence 和真正 attribution 之間的落差要怎麼量化？
- PlanAudio 目前未見官方開源模型；在它不可跑的情況下，應該用哪些 open generators 建立 evaluation baseline？
- τ-bench / τ-Voice 類 task-level evaluation 要如何和 audio-level rubrics 合併？例如 final database state 正確但過程中沒有取得 explicit spoken confirmation，應該如何扣分？

## Related Papers

- [AnyAudio-Judge](../papers/arxiv_2606_03116/)：dynamic rubric-based evaluator / reward model，是這條 project 的核心 evaluator pattern。
- [PlanAudio](../papers/arxiv_2605_28063/)：free-form prompt -> unified speech+sound generation，是 composite audio evaluation 的重要 target task。
- [FlashTrace](../papers/arxiv_2602_01914/)：multi-token attribution，可以補上 judge / reasoning / tool-call grounding analysis。
- [StepOPSD](../papers/arxiv_2605_27140/)：不是 audio paper，但提供 step-aware credit assignment pattern，可借來把 rubric yes/no 轉成 span-level grounded reward / training signal。
- [τ-bench](../papers/arxiv_2406_12045/)：不是 audio paper，但提供 multi-turn tool-agent-user interaction、database-state reward、`pass^k` consistency metric；很適合改成 full-duplex voice-agent task correctness benchmark。
- [Full-Duplex-Bench-v3](../papers/arxiv_2604_04847/)：可提供 voice-agent / disfluency / tool-use rubrics 的 benchmark 場景。
- [VoxCPM / VoxCPM2](../tools/openbmb-voxcpm/)：open TTS / voice design model，可作為可跑的 generation target。
- [Dia](../tools/nari-labs-dia/)：open dialogue TTS baseline，可用於 dialogue event-control evaluation。

## Related Tags

#audio-evaluation #rubric-judge #reward-model #audio-reasoning #tts #speech-llm #attribution
