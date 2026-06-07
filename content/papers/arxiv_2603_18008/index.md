---
paper_key: arxiv_2603_18008
canonical_id: "arxiv:2603.18008"
title: "TherapyGym: Evaluating and Aligning Clinical Fidelity and Safety in Therapy Chatbots"
year: 2026
venue: "ICLR 2026 submission / arXiv preprint"
url: "https://arxiv.org/abs/2603.18008"
pdf_url: "https://arxiv.org/pdf/2603.18008"
status: read
rating: 6
tags:
  - clinical-ai
  - chatbot-evaluation
  - llm-judge
  - safety
  - grpo
  - project-audio-model-evaluation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`draft.tex`, tables, appendix prompts), official project page, GitHub repo status, and public OpenReview notes. This is not an audio paper and not medical guidance; it is included as a high-stakes evaluator / rubric / reward-design reference.

## Links
- [Original URL](https://arxiv.org/abs/2603.18008)
- [arXiv abstract](https://arxiv.org/abs/2603.18008)
- [PDF](https://arxiv.org/pdf/2603.18008)
- [arXiv source](https://arxiv.org/src/2603.18008)
- [Project page](https://therapygym.stanford.edu/)
- [GitHub repo](https://github.com/fangruih/therapygym) currently public but empty as checked on 2026-06-07
- [OpenReview forum](https://openreview.net/forum?id=nwANzdlMKI)

## 一句話總結
**TherapyGym** 把 therapy chatbot evaluation 從 generic empathy / fluency / preference score，改成 clinically grounded 的 **CBT fidelity + safety** rubric：用 CTRS-based skill scores 和 therapy-specific safety flags 建立 `TherapyJudgeBench`，再把 LLM judge 變成 GRPO reward 訓練 Qwen therapist；它最值得借的是「高風險 multi-turn dialogue 必須用 expert-calibrated rubric + safety penalty + out-of-judge human audit」，但 OpenReview 也指出 synthetic patient realism 和 judge/reward hacking 仍是主要弱點。

## 這篇在解決什麼問題
LLM therapy chatbot 的一般評估方式常看：

- fluency / coherence。
- empathy / helpfulness。
- pairwise preference。
- generic dialogue benchmark。

但 psychotherapy 的核心不只是「聽起來溫暖」。臨床上會看 therapist 是否能：

- 設定 agenda。
- 正確理解 patient。
- collaboration。
- guided discovery。
- 聚焦關鍵 cognition / behavior。
- 使用合適 CBT techniques。
- assign homework。
- 避免 unsafe behavior，例如不該給 medication advice、不該忽略 crisis / abuse / functional impairment。

作者認為 therapy chatbot evaluation 至少要同時覆蓋兩個 clinical pillars：

1. **Fidelity**：是否 faithful to evidence-based CBT practice，也就是 therapist 是否 skillfully implements CBT。
2. **Safety**：是否避免高風險錯誤，尤其是 mental-health chatbot 特有風險。

## 核心方法
### 1) TherapyJudgeBench: expert-annotated simulated dialogues
作者建立 `TherapyJudgeBench`，目標不是直接 benchmark therapist policies，而是 validation / calibration LLM judge。

資料形式：

- 116 simulated therapist-patient dialogues。
- 每段 dialogue 是 10 turns，也就是 therapist / patient 各 5 turns。
- 對話是 CBT-style micro-session，約對應 10-15 分鐘 focused session。
- 共有 1,270 expert ratings。
- 標註者是 licensed / CBT-trained practitioners。

Patient simulator：

- 使用 Patient-Ψ / Patient-Ψ-CM cognitive model profile。
- profile 包含 core beliefs、automatic thoughts、emotions、behaviors、situations。
- patient model 使用 GPT-o3-mini。
- therapist pool 包含 GPT-o3-mini、Gemini 2.0 Flash、Claude 3.7 Sonnet、DeepSeek R1、Phi 3.5、Llama-4-Scout、Qwen3-4B-Instruct。

重要 caveat：全部 therapy dialogues 都是 synthetic，作者也明確說這是 research artifact，不是 clinical tool。

### 2) CTRS-based fidelity labels
Fidelity 使用 Beck Institute 的 **Cognitive Therapy Rating Scale (CTRS)**。原始 CTRS 是 0-6 scale，作者用 11 個 CBT skill dimensions：

- Agenda
- Feedback
- Understanding
- Interpersonal Effectiveness
- Collaboration
- Pacing and Efficient Use of Time
- Guided Discovery
- Focusing on Key Cognitions or Behaviors
- Strategy for Change
- Application of Cognitive-Behavioral Techniques
- Homework

但因為部分 CTRS dimensions 在這種 10-turn synthetic transcript 上 human-human agreement 低，reward modeling 只保留 reliability 至少 moderate 的 subset。OpenReview 中作者特別解釋 Guided Discovery / Application of CBT Techniques 的 reliability 低，因此從 reward modeling 排除。

這是值得注意的設計：**高風險 rubric 不應該直接全部拿去做 reward；要先看 human inter-rater reliability。**

### 3) Safety labels
Safety 是 session-level binary labels，主文版本列出四類：

- provide medical opinion / medication。
- fail to address crisis and imminent risk。
- fail to address abuse。
- failure to address functional impairment。

OpenReview rebuttal 中作者對 taxonomy 描述略有變化，提到 medication advice、speculating about symptoms/diagnoses、judgmental behavior、failure to address harmful thoughts/behaviors。這反映一個 reviewer 也指出的問題：safety taxonomy 在初稿中定義不夠清楚，需要更穩定的 label schema。

### 4) TherapyJudge: LLM-based evaluator
`TherapyJudge` 讀完整 10-turn dialogue，並輸出：

- 11 個 CTRS skill scores，0-6。
- 4 個 safety flags，yes/no。
- prompt 中包含 CTRS scoring rubric 和 skill examples。

作者測 Claude 3.7、GPT-o3-mini、DeepSeek-R1 等作 judge。最強配置在 CTRS scores 上對 human raters 的 session-level Spearman correlation 約 0.56，safety labels accuracy 約 99%。

但這不代表 judge 完美。OpenReview reviewers 對此很謹慎：LLM judge 和 human raters 有差距，而且如果用 judge reward 做 RL，可能會發生 Goodhart / reward hacking。

### 5) GRPO alignment loop
TherapyGym 也被用作 training harness：

```text
patient profile
  -> simulated patient-therapist dialogue
  -> TherapyJudge scores CTRS + safety
  -> composite reward
  -> GRPO update therapist policy
```

Reward：

```text
R(dialogue) =
  sum_i w_i * normalized_CTRS_i
  - sum_j lambda_j * safety_violation_j
```

Training details：

- base therapist：Qwen3-4B-Instruct，另做 Qwen3-1.7B scale study。
- simulated patient：Gemma3-4B during training setup section。
- training profiles：Patient-Ψ-CM-Augmented，從 106 擴到 13,093 profiles，使用 TreeSynth。
- RL engine：rLLM。
- dialogue：最多 10 turns，最大 16,384 tokens。
- rollouts：每 task 4 rollouts for GRPO。
- optimizer：AdamW，learning rate 1e-6，batch size 16，50 epochs。

## Training / Data
資料與訓練分成三塊：

1. **TherapyJudgeBench**
   - 116 synthetic CBT dialogues。
   - 10 turns each。
   - 1,270 expert ratings。
   - 20% double-annotated for inter-rater reliability。
   - dialogue-level labels，不是 turn-level labels。

2. **Patient profile augmentation**
   - 起點是 Patient-Ψ-CM 106 profiles。
   - 用 TreeSynth 擴成 13,093 profiles。
   - 另留 20 profiles for validation。
   - 作者做人類評估，認為 augmented profiles 在 coherence / diversity 上不低於原 profiles。

3. **RL fine-tuning**
   - Qwen3-4B / Qwen3-1.7B therapist。
   - patient simulation + frozen TherapyJudge reward。
   - GRPO broadcast dialogue-level scalar reward 到 therapist turns 的 generated tokens。

## 主要結果
### 1) Human-human reliability 是 moderate，和原始 CTRS literature 同級
作者引用原始 CTRS human conversation study 中 reliability coefficient 約 0.59。TherapyGym 的 LLM-therapist dialogues 上，human raters 的 Krippendorff alpha 平均 0.52，median 0.55，range 0.23-0.72；Spearman rho 平均 0.58，Pearson r 平均 0.60。

重點不是「非常一致」，而是：CTRS 本來就不是完全 objective 的標註；如果要用作 reward，必須承認部分 dimensions 不可靠。

### 2) LLM judge 能 recovery 一部分 clinician signal
作者報告最佳 judge configuration：

- CTRS skill scores 對 human ratings 的 Spearman 約 0.56。
- safety label accuracy 約 99%。
- In-context skill examples 比 rubric-only prompting 更好。
- Few-shot full dialogue exemplars 反而變差，作者歸因於 context-length pressure / prompt dilution。

比較強的 dimensions 包括 Strategy for Change、Collaboration；較弱包括 Feedback、Agenda。

### 3) GRPO 提升 Qwen3-4B 的 CTRS，並降低 safety violations
Qwen3-4B main table：

LLM judge：

- CTRS Avg：0.16 -> 0.59。
- Safety Avg violation：0.38 -> 0.13。

Human judge：

- CTRS Avg：0.10 -> 0.60。
- Safety Avg violation：0.38 -> 0.20。

具體 skill improvements：

- Feedback：human 0.04 -> 0.65。
- Focusing on Key Cognitions or Behaviors：human 0.04 -> 0.67。
- Homework：human 0.00 -> 0.27，仍低。

Qwen3-1.7B 也提升：

- LLM CTRS Avg：0.09 -> 0.29。
- Safety Avg violation：0.28 -> 0.15。

### 4) Safety penalty 真的必要
Safety ablation：

- Untrained base：CTRS 0.16，Safety 0.38。
- GRPO with safety penalty：CTRS 0.59，Safety 0.13。
- GRPO no safety penalty：CTRS 0.53，Safety 0.43。

也就是只 reward skillfulness 會讓 safety violations 變糟。這對任何 high-stakes judge / reward model 都很重要：**不能只優化任務分數，必須把 safety 明確放進 reward。**

### 5) Qualitative pattern：從 generic validation 變成 structured CBT
作者的 qualitative examples 顯示，untrained model 常給泛泛的 validation / reassurance；trained model 會更常：

- 問 targeted questions。
- slow down when patient distressed。
- identify automatic thoughts。
- build collaborative next steps。
- assign small homework / behavioral experiments。

這些 examples 支持分數變化，但也不應過度解讀為真實療效。

## Project relevance
**project-audio-model-evaluation：中度到高度相關，作為高風險 rubric / judge / RL reward 設計參考。**

TherapyGym 和 AnyAudio-Judge 很像，都是把一個不能只靠 holistic score 的任務拆成 structured rubrics：

```text
general score -> domain-specific skill dimensions + safety flags
```

對我們的 audio evaluator，可借的設計：

- 不要只看 MOS / preference / helpfulness，要把 task-specific dimensions 拆出來。
- high-stakes judge 必須有 expert validation set，而不是只相信 LLM judge。
- reward model 不應只含 quality / alignment，也要含 safety penalty。
- 用 human-human reliability 篩掉不可靠 rubric dimensions，避免把低一致性 label 當 reward。
- 對 judge 做 OpenReview-style failure audit：是否 over-score、是否漏掉 rare safety failures、是否能處理 long multi-turn context。

**對 full-duplex / voice-agent evaluation 的啟發。**

如果未來做 therapy-style spoken agent、healthcare voice agent 或高風險客服，audio 層會多出：

- ASR error。
- hesitation / crying / distress cues。
- interruption / barge-in。
- prosody and affect。
- crisis cues hidden in speech tone。

TherapyGym 的 text-only setup 不夠，但它提供一個 skeleton：

```text
multi-turn spoken dialogue
  -> transcript + audio cues
  -> domain-specific fidelity rubric
  -> safety flags
  -> expert-calibrated judge
  -> reward with explicit safety penalty
```

**對 TTS / data pipeline 的 relevance 低。**

它不處理 speech data cleaning、TTS synthesis 或 diarization。但若要合成 high-risk dialogue training data，必須保留安全 provenance 和明確標示 synthetic，不應把 synthetic patient dialogue 當真實臨床資料。

## Related papers in my pool
- [[arxiv_2606_03116|AnyAudio-Judge]]：dynamic rubric-based audio evaluator；TherapyGym 提供高風險 domain 裡 expert-calibrated judge + safety penalty 的更嚴格版本。
- [[arxiv_2406_12045|τ-bench]]：tool-agent-user task-level correctness；TherapyGym 是 therapy-domain process-level fidelity/safety correctness。
- [[arxiv_2605_27140|StepOPSD]]：可補 TherapyGym 的 weakness：目前 GRPO 把 dialogue-level reward broadcast 到所有 therapist tokens，StepOPSD-style step credit assignment 可定位哪一 turn / skill indicator 造成 reward。
- [[arxiv_2602_01914|FlashTrace]]：可用來檢查 TherapyJudge 的 CTRS / safety decision 是否真的依賴對話中正確 evidence span。
- [[arxiv_2605_18607|Forecasting Downstream Performance with Proxy Metrics]]：可用 expert-labeled dialogues / CTRS traces 做 cheaper model-selection proxy，減少每次都跑 full GRPO + human eval。

## OpenReview / reviewer discussion
OpenReview decision：**Reject**。

AC summary 很清楚：reviewers 認可問題重要、dataset 有價值、clinical practice grounded evaluation 方向合理，但主要疑慮包括：

1. **Synthetic conversation validity 不夠強**
   - 116 dialogues，10 turns each。
   - reviewer 質疑是否足夠 realistic / comprehensive。
   - 作者回應說真實 CBT dialogues 因 privacy / regulation 很少，simulation 是 ethical compromise，且 Patient-Ψ-CM 已做過 realism validation。

2. **Implementation / annotation details 不足**
   - reviewer 要求更清楚描述 clinicians 背景、calibration process、rating granularity、CTRS mapping、安全 label 定義、metrics。
   - 作者回應會補 licensed mental health counselor / AMFT 背景、three-round calibration，以及 reliability filtering。

3. **Judge validity 和 reward hacking**
   - reviewer 擔心 LLM judge 被 GRPO optimize 後產生 Goodhart's Law。
   - 雖然作者有 blinded clinician ratings，但 reviewers 仍希望更多 out-of-judge evaluation、adversarial tests、realistic data。

4. **Novelty 問題**
   - GRPO / RL 技術本身不是新算法。
   - TherapyGym 的主要價值更像 dataset / evaluation framework，而非 RL method。
   - AC 也提到 paper 可能應更集中在 dataset validation/documentation，而不是把 fine-tuning 實驗當主要貢獻。

5. **重要 CTRS skills 被排除**
   - Guided Discovery 和 Application of CBT Techniques 對 therapy 很重要，但因 human reliability 低被排除 reward modeling。
   - 這是合理的 measurement decision，但也限制了 claim：trained model 不等於完整 CBT competence。

我的讀法：這篇值得保留作為 high-stakes evaluator design reference，但不能把它當作「therapy chatbot 已被可靠解決」的證據。

## 我該不該細讀
**如果你在設計 rubric judge / reward model / high-risk voice-agent evaluation，值得細讀。**

優先讀：

1. CTRS label design 和 safety taxonomy。
2. Human-human reliability 與 human-LLM judge alignment。
3. reward model 中 safety penalty 的設計。
4. OpenReview reviewer 對 simulation validity / reward hacking 的批評。

如果只關心 TTS data cleaning 或 full-duplex audio generation，本篇不是核心 paper。但如果你想把 AnyAudio-Judge 類 evaluator 用於更高風險任務，這篇的教訓很有用。

## 可能的弱點 / open questions
1. **Synthetic patients 不等於真實 patients**
   作者有倫理理由使用 simulation，但 real-world therapy 裡的 resistance、ambiguity、crisis escalation、longitudinal alliance 都可能更複雜。

2. **10 turns 太短**
   CBT competence 和 therapeutic alliance 通常跨更長 session / multi-session 展現。10-turn micro-session 只能測局部 skill。

3. **CTRS dimensions 不完整**
   最重要的一些 CBT skills 反而因 low reliability 被排除 reward modeling，說明短 synthetic transcript 上很難穩定評估 deeper therapeutic technique。

4. **LLM judge 仍可能 bias**
   Spearman 約 0.56 是有用訊號，但不是 clinical-grade evaluator。Safety accuracy 也可能受 label prevalence 影響，需要看 rare severe failures。

5. **Reward hacking risk**
   GRPO 可能學會看起來像 CTRS indicator 的表面 pattern，而不是實質 clinical quality。需要 adversarial / out-of-distribution / real clinician blind eval。

6. **GitHub repo 目前是空的**
   Project page 連到 `fangruih/therapygym`，但目前 repo 顯示 empty。若要復現，還需要等待 code/data release。

7. **不是 clinical deployment evidence**
   作者自己也說這不是 clinical tool；沒有 real patient outcome、longitudinal safety、IRB clinical trial evidence。

## Tags
- `clinical-ai`
- `chatbot-evaluation`
- `llm-judge`
- `safety`
- `grpo`
- `project-audio-model-evaluation`

## Concepts
- `TherapyGym`
- `TherapyJudgeBench`
- `TherapyJudge`
- `Cognitive Therapy Rating Scale`
- `CTRS`
- `CBT fidelity`
- `therapy safety taxonomy`
- `LLM-as-judge`
- `expert annotation`
- `patient simulation`
- `Patient-Psi-CM`
- `TreeSynth`
- `GRPO`
- `reward hacking`
- `human-LLM alignment`

## Citation
```bibtex
@misc{huang2026therapygymevaluatingandalignin,
  title={TherapyGym: Evaluating and Aligning Clinical Fidelity and Safety in Therapy Chatbots},
  author={Fangrui Huang and Souhad Chbeir and Arpandeep Khatua and Sheng Wang and Sijun Tan and Kenan Ye and Lily Bailey and Merryn Daniel and Ryan Louie and Sanmi Koyejo and Ehsan Adeli},
  year={2026},
  eprint={2603.18008},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2603.18008}
}
```
