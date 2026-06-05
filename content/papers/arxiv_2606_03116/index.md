---
paper_key: arxiv_2606_03116
canonical_id: "arxiv:2606.03116"
title: "AnyAudio-Judge: A Dynamic Rubric-Based Benchmark and Evaluator for Audio Instruction Following"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.03116"
pdf_url: "https://arxiv.org/pdf/2606.03116"
status: read
rating: 5
tags:
  - speech-llm
  - audio-reasoning
  - audio-evaluation
  - tts
  - reward-model
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, metadata, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2606.03116)
- [PDF](https://arxiv.org/pdf/2606.03116)
- [arXiv source](https://arxiv.org/src/2606.03116)
- [GitHub repo: CuCl-2/AnyAudio-Judge](https://github.com/CuCl-2/AnyAudio-Judge)

## 一句話總結
**AnyAudio-Judge** 是一個 audio instruction-following evaluator：它不讓 judge 給單一 holistic score，而是把複雜 audio instruction 動態拆成多個可驗證的 yes/no rubric items，再逐項判斷 audio 是否滿足，最後聚合成 alignment score。

## 這篇在解決什麼問題
Instruction-guided audio generation 已經能控制 speech、sound、music、mixed audio 的語意內容、speaker attributes、emotion、prosody、background environment、event order。但 evaluation 還常停在兩種不足的做法：

- **embedding / global similarity metric**：例如 CLAPScore，容易漏掉細粒度 speaker/style/event mismatch。
- **holistic LLM/LALM judge**：讓 Gemini 或 audio LLM 直接判斷 match/mismatch，缺乏可解釋性，也容易把複雜 prompt 裡的局部錯誤平均掉。

這篇的核心主張是：audio instruction alignment 應該拆成 **dynamic, instance-specific, binary rubrics**。例如 prompt 同時描述 speaker gender、emotion、speaking rate、背景音、事件順序時，judge 應該逐項檢查，而不是打一個總分。

## 核心方法
### Dynamic rubric-based evaluation
給定 audio `a` 和 instruction `i`，系統先用 LLM 將 instruction 拆成 `n` 個 atomic rubric items：

```text
p1, p2, ..., pn
```

每個 rubric item 都是可直接聽音訊驗證的 yes/no statement。Judge model 對每個 item 比較 `"yes"` / `"no"` logits，得到 satisfaction probability：

```text
s_j = softmax(z_yes, z_no)
```

最後把所有 item-level probabilities 聚合成整體 alignment score。這種設計的好處是：

- score 可解釋，能看到是哪個 speaker/style/event item 失敗。
- instruction 越複雜，rubric items 可以越多。
- reward signal 比 binary preference 更 dense。
- hard negatives 的局部 mismatch 可以被定位。

### Benchmark / corpus / model 三件事一起做
這篇不是只提出 prompt template，而是同時做三個 artifact：

1. **AnyAudio-Judge Bench**：7,920 samples，bilingual English/Chinese，cover speech、sound、music、mixed audio。
2. **AnyAudio-Judge Corpus**：105K samples，包含 hard negatives、rubric labels、CoT rationales。
3. **AnyAudio-Judge model**：從 Qwen3-Omni-30B-A3B-Captioner 初始化，先 SFT，再 GRPO。

## Training / Data
### AnyAudio-Judge Bench
Benchmark 有 7 個 subsets：

- Speech-Real
- Speech-Gen
- Sound-Real
- Sound-Gen
- Music-Real
- Music-Gen
- Mix

每個 subset 都有 English / Chinese 對稱版本，positive / negative 維持 1:1。Mixed subset 全部是真實 movie/cinematic audio clips，因為高品質 mixed-audio synthesis 還很難。

Negative construction 有兩種主要方式：

- **Instruction Swapping**：交換不同 sample 的 instruction，製造明顯 mismatch。
- **Attribute Perturbation**：用 LLM 只改 1-2 個局部屬性，模擬細粒度 failure，例如 dialect 錯、emotion 不符、secondary sound missing、temporal sequence missing、acoustic environment mismatch、count mismatch。

Speech subsets 使用 InstructTTSEval 和 generated TTS outputs；Speech-Gen 包含 Qwen3-TTS-12Hz-1.7B-VD、MOSS-VoiceGenerator、MiMo-Audio-7B-Instruct 等生成器。

### AnyAudio-Judge Corpus
Training corpus 是 105K samples：

- 30K Speech
- 30K Sound
- 30K Music
- 15K Mixed

它和 benchmark data sources disjoint。每個 sample 有：

- decomposed rubric items
- per-rubric yes/no labels
- CoT rationale
- balanced positive-negative pairs

### Model training
AnyAudio-Judge 從 **Qwen3-Omni-30B-A3B-Captioner** 初始化。

兩階段訓練：

- **SFT**：full-parameter fine-tuning 1 epoch，學會 rubric-following 和 item-level evidence output。
- **GRPO**：從 SFT 後仍難的 8,454 samples 做 RL，LoRA rank 16 / alpha 32，1 epoch。

GRPO reward 是三項加權：

- format consistency：0.1
- global accuracy：0.2
- balanced rubric accuracy：0.7

balanced rubric accuracy 很重要，因為它避免 model 一直偏向 yes 或 no。

## 主要結果
### AnyAudio-Judge Bench
在 Chinese subset，AnyAudio-Judge 平均 ACC **85.26**，高於 Gemini-2.5-Pro holistic **80.01**、Qwen3-Omni-30B-A3B-Instruct dynamic rubric **76.82**。

在 English subset，AnyAudio-Judge 平均 ACC **84.45**，高於 Gemini-2.5-Pro holistic **77.72**、Qwen3-Omni-30B-A3B-Instruct dynamic rubric **77.34**。

一個重要現象是：**dynamic rubric prompting 幾乎讓所有 LALM baselines 比 holistic prompting 明顯更好**。例如：

- Qwen3-Omni-30B-A3B-Captioner：Chinese 65.33 -> 76.66，English 64.24 -> 76.77。
- Kimi-Audio-7B-Instruct：Chinese 50.93 -> 70.84，English 50.16 -> 70.81。

這支持 paper 的核心論點：細粒度 item-level checking 比單一 holistic decision 更適合 audio-instruction alignment。

### External PAM benchmark
在 PAM dataset 上，AnyAudio-Judge 也最好：

- LCC **0.614**
- SRCC **0.601**
- KTAU **0.435**

高於 CLAPScore 和 AQAScore variants，表示 rubric supervision 不只對自己構造的 benchmark 有效。

### Ablation
Ablation 很清楚：

- Holistic judgment：Chinese 65.33 / English 64.24
- Dynamic rubric：76.66 / 76.77
- + SFT：84.02 / 83.78
- + SFT + GRPO：**85.26 / 84.45**

最大 jump 來自 holistic -> dynamic rubric，其次是 SFT；GRPO 是小幅但穩定提升。

### InstructTTS evaluation / reward
用 AnyAudio-Judge 評 InstructTTS systems：

- Gemini 2.5-Pro：87.5
- Qwen3-TTS-12Hz-1.7B-VD：84.8
- MiMo-Audio-7B-Instruct：81.1
- MOSS-VoiceGenerator：80.6

更重要的是 reward modeling：作者用 DiTAR 作 base model，使用 AnyAudio-Judge score 做 GRPO reward。Training 中 reward steadily rises，且在 InstructTTSEval 上，人類偏好和 Gemini-based scores 都支持 judge-optimized model 比 base model 更好。

## Project relevance
**project-tts-data-pipeline：高度相關。**

這篇可以直接拿來設計 TTS data/eval pipeline：

- 把 TTS instruction 拆成 speaker、gender、age、timbre、emotion、speaking rate、volume、fluency、speech content 等 atomic checks。
- 用 hard negatives 模擬 TTS 常見錯誤：dialect 不對、emotion 弱化、speaker gender 反了、speaking rate 不符、speech content 錯。
- 用 per-rubric label 當 data cleaning / model selection / reward signal，而不是只看 MOS、WER、CLAP。
- 對 generated TTS samples，可以定位「哪個 prompt attribute 沒被 satisfy」。

**project-full-duplex-data：高度相關。**

AnyAudio-Judge 的 rubric decomposition 很適合 full-duplex / dialogue audio：

- 可把 `[S1]`, `[S2]`, backchannel、pause、overlap、turn-taking、emotion、speaker role、interrupt timing 拆成 binary checks。
- 可用於評估 synthetic dual-channel conversation 是否符合 transcript/control signals。
- 可設計 hard negatives，例如 backchannel missing、overlap timing wrong、speaker swapped、self-correction stale state、pause/interruption mismatch。
- 對 FDB-v3 類 voice agent benchmark，可補一層「response/action 是否 grounded in audible evidence」的 rubric judge。

**關鍵結論：這篇比一般 audio judge 更值得保留，因為它提供的是可轉用的 evaluation/reward construction pattern，而不是單一 benchmark 分數。**

## Related papers in my pool
- **FlashTrace**：FlashTrace 做 reasoning attribution；AnyAudio-Judge 做 rubric-level audio grounding。兩者可以組合成 speech reasoning judge：先用 rubric 判斷錯在哪，再用 attribution 追問模型依賴哪段 transcript/audio evidence。
- **Full-Duplex-Bench-v3**：FDB-v3 的 tool-use / disfluency cases 可用 AnyAudio-Judge-style rubric 強化 judge prompt，例如 self-correction 是否被遵守、工具參數是否與最後 intent 一致。
- **PlanAudio**：PlanAudio 做 speech+sound composite generation；AnyAudio-Judge 可作為 composite audio instruction following 的 evaluator/reward。
- **VoxCPM / VoxCPM2、Chatterbox、Dia**：這些 TTS/dialogue generation systems 都可以用 dynamic rubric 評估 voice design、speaker cloning、dialogue event control。
- **Miipher / Miipher-2**：Miipher 是 data cleaning/restoration；AnyAudio-Judge 可用來檢查 restored/generated audio 是否仍滿足 instruction-level attributes。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。目前以 arXiv preprint 記錄。

## 我該不該細讀
**應該細讀，而且應該優先讀。**

原因：

- 它直接對應你要做的 TTS / full-duplex data evaluation。
- hard negative construction prompt 很有實用價值。
- dynamic rubric 是可複用的 judge design，不限定於這篇模型。
- reward modeling 部分可作為未來 TTS / audio generation RL 的設計參考。

最值得讀：

- benchmark construction
- speech attribute perturbation prompt
- rubric decomposition prompt
- dynamic rubric vs holistic judge ablation
- GRPO reward design

## 可能的弱點 / open questions
- benchmark 和 corpus 很依賴 Gemini / Qwen3 生成與過濾，可能有 judge-model bias。
- per-rubric labels 由 text-only LLM 根據 original caption vs modified caption 推導，仍不等於真實音訊人工標註。
- Dynamic rubric 越細，judge 可能更保守；prompt 裡要求 ambiguous features answer `no`，可能提高 false negative。
- Mixed audio 只用 real samples，沒有完整評估 generated mixed-audio system 的多樣 failure modes。
- 作為 reward model 用於 RL 時，仍需防止 model reward hacking，例如生成容易被 rubric judge 判 yes 但人聽起來不自然的 audio。

## Tags
- speech-llm
- audio-reasoning
- audio-evaluation
- tts
- reward-model
- rubric-judge
- project-full-duplex-data
- project-tts-data-pipeline

## Concepts
- dynamic rubric-based evaluation
- audio instruction following
- audio language model judge
- hard negatives
- attribute perturbation
- item-level satisfaction probability
- AnyAudio-Judge Bench
- AnyAudio-Judge Corpus
- GRPO reward model
- InstructTTS evaluation

## Citation
```bibtex
@misc{li2026anyaudiojudgeadynamicrubricbas,
  title={AnyAudio-Judge: A Dynamic Rubric-Based Benchmark and Evaluator for Audio Instruction Following},
  author={Haitao Li and Tian Tan and Yuguang Yang and Shan Yang and Xie Chen},
  year={2026},
  eprint={2606.03116},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2606.03116}
}
```
