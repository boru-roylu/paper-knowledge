---
paper_key: arxiv_2605_21917
canonical_id: "arxiv:2605.21917"
title: "MAVEN: A Multi-stage Agentic Annotation Pipeline for Video Reasoning Tasks"
year: 2026
venue: "CVPR 2026 VidLLMs Workshop non-archival"
url: "https://arxiv.org/abs/2605.21917"
pdf_url: "https://arxiv.org/pdf/2605.21917"
status: read
rating: 0
tags:
  - video-reasoning
  - agentic-annotation
  - data-pipeline
  - multimodal-reasoning
  - chain-of-thought
  - project-audio-model-evaluation
  - project-full-duplex-data
created: 2026-06-28
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sec/*.tex`) plus a targeted web check for official code/release links. No official code repository was found.

## Links

- [Original URL](https://arxiv.org/abs/2605.21917)
- [arXiv abstract](https://arxiv.org/abs/2605.21917)
- [PDF](https://arxiv.org/pdf/2605.21917)
- [arXiv source](https://arxiv.org/src/2605.21917)
- [OpenReview forum](https://openreview.net/forum?id=PYVXTkO3Yb)

## 一句話總結

**MAVEN** 是 NVIDIA 提出的 multi-stage agentic video annotation pipeline：它先把 raw video 轉成三層 caption，再合成一個可審核的 **Multi-Scale Spatio-Temporal Event Description (MSTED)**，最後只用 MSTED 產生 MCQ / binary verification / open-ended QA 的 CoT training data；用這些資料 fine-tune Cosmos-Reason2-8B 後，在 traffic CCTV / AccidentBench 上超過或追平 Gemini baselines，並展示 pipeline 可用 Agent Skill 自動適配到 dashcam、warehouse surveillance、public safety 等新 domain。

## 這篇在解決什麼問題

Video reasoning model 需要高品質 training annotations，不只是「畫面裡有什麼」，還要有 who、what、when、where、why 和 consequence。人工標註這種 structured CoT video reasoning data 成本太高；一般自動標註又常見兩個問題：

- **single-pass caption 會丟失細節**：長影片的一段 global description 無法同時保存全局情境、時間點、細節動作。
- **domain-specific pipeline 不好轉移**：traffic CCTV、dashcam、warehouse、public safety 的 camera view、事件類型、question style 都不同，手動改 prompt 很慢。

MAVEN 的核心想法是：先建一個可審核、可重用的 structured intermediate representation，再從它產生下游 QA，而不是直接從 raw video / flat caption 生成 training samples。

## 核心方法

### 1) Event of Focus (EoF)

MAVEN 以 **Event of Focus** 為中心組織 annotation。EoF 可以是 abnormal event，例如 accident / worker safety incident，也可以是 routine but salient event，例如 pedestrian crossing 或 workstation operation。

### 2) Stage 1：three-level video captioning

MAVEN 產生三個互補 caption 層級：

- **Global caption**：場景 layout、天氣、時間、baseline behavior。
- **Dense caption**：主要事件與 start/end timestamps，建立 temporal causal chain。
- **Chunk captions**：短片段細節，5-30 秒一段，補回小物件、短暫決定性動作、局部互動。

### 3) Stage 2：MSTED synthesis

LLM 將三層 captions 合成 **Multi-Scale Spatio-Temporal Event Description (MSTED)**，包含 holistic scene、temporal/spatial localization、Event of Focus description。MSTED 同時是 verification checkpoint，也是 Stage 3 的 sole input，降低 Q&A generator hallucinate 未被 capture 的細節。

### 4) Stage 3：multi-task CoT Q&A generation

MAVEN 從 MSTED 產生三種 task formats：

- **MCQ**：4-option multiple choice，含 timestamp / spatial reasoning trace。
- **Binary verification**：yes/no question with supporting reasoning。
- **Open-ended QA**：需要 causal / descriptive reasoning 的自由回答。

### 5) Agent-driven domain adaptation

這篇很特別的一點是把 pipeline 包成 **Agent Skill**。給 agent base pipeline、target domain description、desired question examples，它會做 backward inference：為了讓目標 questions 可回答，MSTED 必須 capture 哪些 temporal granularity、spatial relations、causal depth？然後自動重寫各 stage prompts，甚至做 structural edits。

### 6) Hierarchical pipeline refinement

當 human reviewer 發現 systematic annotation issue，agent 會三步修 pipeline：

1. **error taxonomy classification**：misinformation、hallucination、missing information、temporal error、spatial error、attribution error。
2. **root cause tracing**：從 Q&A output 回溯到 MSTED，再回溯到 captioning level，判斷是 prompt gap 還是 system limitation。
3. **prompt / pipeline edits**：prompt gap 改 prompt；system limitation 插入新 stage。

作者例子是 uniform chunking 會切斷事件，因此加入 event-centered highlight chunks：先用 LLM 找 event timestamp，再抽 variable-duration segment 做 targeted re-captioning。

## Training / Data

資料：

- CCTV corpus：3,841 open-source roadside CCTV traffic videos，包含 808 accident、3,033 normal；產生 3,841 MCQ、7,682 binary verification、3,841 open-ended QA。
- Dashcam corpus：1,500 Nexar dashcam collision videos，750 accident / 750 normal；agent-adapted pipeline 產生 11,200 AccidentBench-style MCQ samples。
- Private CCTV eval：80 traffic CCTV videos，human-labeled MSTED + verified Q&A。
- AccidentBench land split：1,630 videos，17,069 human-annotated MCQ。

模型與訓練：

- Base：Cosmos-Reason2-8B。
- SFT：3 epochs，LR 1e-5，global batch 512，8 x A100。
- Frames：sample rate 2，最多 128 frames/video。
- RL：DAPO，1000 steps，LR 1e-6。
- RL reward：format correctness 0.2 + answer accuracy 1.0。

Teacher / pipeline models：

- Gemini 3.1 Pro：three-level captioning。
- Gemini 3.1 Flash：MSTED synthesis 和 CoT Q&A generation。
- opencode CLI + Claude Opus 4.6：Agent Skill / domain adaptation workflow。

## 主要結果

### 1) Private CCTV evaluation

在 80-video private CCTV set 上：

- Gemini 2.5 Pro：MCQ 82.50、Verif 76.25、Open 15.60。
- Gemini 3.1 Flash：MCQ 80.00、Verif 70.63、Open 23.20。
- Cosmos-Reason2-8B zero-shot：MCQ 47.50、Verif 50.00、Open 15.37。
- + CCTV SFT：MCQ 86.25、Verif 85.00、Open 39.45。
- + Dashcam SFT：MCQ 86.25、Verif 83.75、Open 39.47。
- + RL：MCQ 88.75、Verif 81.25、Open 37.29。

重點是 +CCTV SFT 對 zero-shot 有大幅增益：MCQ +38.8、verification +35.0、open-ended +24.1 points，並超過 Gemini baselines。

### 2) AccidentBench generalization

AccidentBench land split 上：

- Cosmos-Reason2 zero-shot overall：29.9。
- + CCTV SFT：40.6，提升 +10.7，且沒有看過 dashcam training video。
- Gemini 2.5 Pro：40.3。
- Gemini 3.1 Flash：42.8。
- + Dashcam SFT：42.0。
- + RL：44.2，超過兩個 Gemini baselines。

### 3) Agent-adapted dashcam data 補 short-video gap

AccidentBench 的 short videos 是 pure dashcam。+CCTV SFT 在 short split 還落後 Gemini；加入 agent-adapted dashcam data 後，Short Avg 從 42.4 提升到 47.9，超過 Gemini 2.5 Pro / 3.1 Flash。

### 4) Ablation：MSTED / three-level captioning 很重要

同樣 3,841 CCTV videos，flat single-pass captioning vs MAVEN：

- Single-pass：MCQ 80.00、Verif 73.75、Open 35.95。
- MAVEN：MCQ 86.25、Verif 85.00、Open 39.45。

這個 ablation 很關鍵：同樣 teacher models，如果沒有三層 caption + MSTED intermediate，效果明顯比較差。

## Project relevance

### project-audio-model-evaluation：中高相關

MAVEN 是 video paper，但它的 evaluation / data generation pattern 很適合借到 audio：

```text
raw audio/dialogue
  -> multi-scale captions/transcripts/events
  -> structured intermediate representation
  -> rubric / QA / CoT training data
  -> SFT/RL judge or reasoning model
```

對 AnyAudio-Judge / MMAE 的下一步，MAVEN 提供了「先產生可審核 intermediate，再產生 rubrics」的設計，而不是直接從 raw audio 生成 rubrics。

### project-full-duplex-data：中高相關

我們的 full-duplex data project 也需要 structured intermediate：

- speaker turns
- overlap spans
- backchannel spans
- interruption / repair / hesitation
- speaker role / intent
- mixture vs separated channels consistency

可以把 MAVEN 的 MSTED 改成 audio 版，例如 **Multi-Scale Spatio-Temporal Dialogue Event Description**，再從這個 intermediate 產生 full-duplex rubrics、training examples、SFT/RL data。

### project-tts-data-pipeline：中度相關

MAVEN 不是 speech/TTS paper，但它對 TTS data cleaning 有方法論價值：先建立可審核的 structured intermediate，再生成 training labels 或 QA filters。對 long-form TTS / dialogue TTS，可以建立 global context、dense timestamps、chunk-level noise/overlap/prosody notes，再產生 filter decision 或 structured TTS prompt。

## Related papers in my pool

- [[arxiv_2606_07229|MMAE]]：audio editing benchmark。MAVEN 的 MSTED 可作 MMAE-style rubric generation 前的 structured intermediate。
- [[arxiv_2606_03116|AnyAudio-Judge]]：audio rubric judge。MAVEN 提醒 rubric 應 grounded in an auditable intermediate，而不是直接讓 judge hallucinate checks。
- [[arxiv_2605_27140|StepOPSD]]：step-aware credit assignment。MAVEN 的 root-cause tracing 可以和 StepOPSD 的 credit assignment pattern 結合。
- [[arxiv_2602_01914|FlashTrace]]：multi-token attribution。MAVEN 的 Q&A -> MSTED -> caption-level hierarchy 很適合做 attribution/evidence tracing。
- [[arxiv_2603_25750|Sommelier]]：audio preprocessing pipeline。MAVEN 是 video-side agentic annotation pipeline；Sommelier 是 audio-side preprocessing pipeline，兩者可合成「agentic audio data pipeline」。
- [[arxiv_2604_04847|Full-Duplex-Bench-v3]]：若要生成 full-duplex voice-agent reasoning data，MAVEN 的 event-of-focus / structured CoT data pattern 很有用。

## OpenReview / reviewer discussion

OpenReview forum 已找到：<https://openreview.net/forum?id=PYVXTkO3Yb>。截至本次處理，公開 notes 數量為 0，因此沒有可整理的 public review / rebuttal discussion。

## 我該不該細讀

如果你在做 **agentic data annotation pipeline / audio rubric generation / full-duplex data structuring**，建議細讀。

最值得讀：

- three-level captioning -> MSTED -> Q&A 的 factorization。
- Agent Skill 如何根據 domain description + target questions 反推 prompt requirements。
- hierarchical refinement：error taxonomy、root-cause tracing、prompt vs structural fix。
- ablation：single-pass captioning vs MAVEN。

如果只關心 model architecture，這篇不是重點；它的價值是 data pipeline 與 annotation workflow。

## 可能的弱點 / open questions

1. **強依賴 closed-source teachers**

   Captioning 用 Gemini 3.1 Pro，MSTED/Q&A 用 Gemini 3.1 Flash，domain adaptation 用 Claude Opus 4.6。pipeline idea 可借，但可重現性和成本要注意。

2. **Open-ended metric 不夠可靠**

   Open-ended 用 rescaled BertScore F1，作者也承認它更像 directional signal，會偏向 pipeline-generated reference style。

3. **Private CCTV eval 不公開**

   最強的 CCTV 結果來自 private 80-video eval set；外部較難驗證。

4. **資料是否會 teacher-style overfit**

   作者用 single-pass ablation 說明 pipeline structure 有額外貢獻，但仍然是 teacher-generated data。若借到 audio，需要 human verification 或 cross-judge validation。

5. **Agentic refinement 的量化 ablation 還不足**

   conclusion 提到未來會補 data-scale、component-level、cross-domain quantitative ablations。現在很多 cross-domain evidence 仍偏 qualitative。

## Tags

- `video-reasoning`
- `agentic-annotation`
- `data-pipeline`
- `chain-of-thought`
- `multimodal-reasoning`
- `agent-skill`
- `project-audio-model-evaluation`
- `project-full-duplex-data`
- `project-tts-data-pipeline`

## Concepts

- MAVEN
- Multi-stage Agentic Video Event aNnotation
- MSTED
- Multi-Scale Spatio-Temporal Event Description
- Event of Focus
- three-level video captioning
- agent-driven domain adaptation
- hierarchical pipeline refinement
- error taxonomy
- root cause tracing
- structured CoT data
- video reasoning dataset
- Cosmos-Reason2-8B
- AccidentBench
- DAPO
- Agent Skill

## Citation

目前以 arXiv preprint / CVPR 2026 VidLLMs Workshop non-archival submission 記錄；若之後找到正式 proceedings，再更新 citation。

```bibtex
@misc{zhang2026mavenmultistageagenticannotation,
  title={MAVEN: A Multi-stage Agentic Annotation Pipeline for Video Reasoning Tasks},
  author={Han Zhang and Wanting Jiang and Tomasz Kornuta and Tian Zheng and Vidya Murali},
  year={2026},
  eprint={2605.21917},
  archivePrefix={arXiv},
  primaryClass={cs.CV},
  doi={10.48550/arXiv.2605.21917}
}
```
