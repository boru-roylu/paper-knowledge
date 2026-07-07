---
paper_key: arxiv_2606_31729
canonical_id: "arxiv:2606.31729"
title: "Is Natural Always Appropriate? Investigating Naturalness and Appropriateness Across Different Domains for TTS Evaluation"
year: 2026
venue: "Interspeech 2026 / arXiv"
url: "https://arxiv.org/abs/2606.31729"
pdf_url: "https://arxiv.org/pdf/2606.31729"
status: read
rating: 8
tags:
  - tts-evaluation
  - speech-evaluation
  - human-evaluation
  - appropriateness
  - naturalness
  - expressive-tts
  - audio-metrics
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-07-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`), arXiv metadata, and the arXiv recent-list venue comment. Summary language is Traditional Chinese with English technical terms preserved.

## Links

- [Original URL](https://arxiv.org/abs/2606.31729)
- [PDF](https://arxiv.org/pdf/2606.31729)
- [arXiv source](https://arxiv.org/src/2606.31729)
- [Study code / interface repo](https://github.com/domiwk/domain-aware-tts-eval)
- [Study demo page](https://researcht81.github.io/unconvincing-human)

## 一句話總結

這篇指出 TTS evaluation 不能只問「聽起來像不像真人」：同一段 speech 在 AI assistant、reader、actor、animated character、spontaneous speaker 等不同應用情境下，appropriateness 會大幅改變，而且 human-likeness / naturalness 不一定能預測 speech 是否適合該 domain。

## 這篇在解決什麼問題

TTS evaluation 長期以 naturalness / MOS 為主，但 modern TTS fidelity 已經很高，單一自然度分數越來越難反映實際應用差異。

作者認為 TTS 是 one-to-many problem：同一句話可以用很多合理方式說出來，而「好不好」取決於應用情境。

例如：

- audiobook reader 需要穩定、清楚、節奏可長時間聽。
- AI assistant 可能需要 neutral、controlled、低 spontaneous。
- spontaneous conversation 需要 disfluency、creakiness、自然節奏變化。
- actor / animated character 需要更強 expressivity。

因此高 human-likeness 不等於 high appropriateness。一個很像真人、很 spontaneous 的聲音，可能在 assistant 場景顯得太 casual；一個較 robotic / neutral 的聲音，反而可能被認為更適合 AI assistant。

## 核心方法

### 1. Cross-domain perceptual study

作者設計 listening test，讓 participants 同時評：

- human-likeness：把 naturalness 改寫成比較清楚的「像不像真人」。
- appropriateness / convincingness：這個 speech 是否適合指定 persona/domain。

Domain / persona 有五種：

- AI assistant
- reader
- actor
- animated character
- spontaneous speaker

研究重點不是只比較哪個 TTS overall 最好，而是看同一批 TTS system 在不同 downstream use-case 下是否有 domain-specific profile。

### 2. Stimuli and TTS systems

作者 curated 30 sentences，覆蓋四種 speech task family：

- Narration：LibriQuote narration excerpts。
- Spontaneous conversational：MSP-Podcast。
- Affect conversational：MELD 和 AnimeVox。
- Inform：用 `gemini-3-pro` 生成 informational / conversational sentences，再人工檢查；AI assistant ground truth proxy 用 `elevenlab-v3` voice `Katie X`。

他們用 Latin Square design，把 180 samples 分到 6 sessions：

```text
30 sentences x (5 TTS systems + 1 ground truth)
```

每位 participant 評 30 sentences 和所有 systems，但不重複同一 stimulus，降低 fatigue / repetition bias。

### 3. 評估的 TTS systems

作者選了 5 個 high-quality systems，並盡量選 female voices with similar timbre 以降低 voice preference bias：

- Kokoro (`af_heart`)：82M StyleTTS 2 model，品質高但 prosody consistent、low spontaneity。
- Gemini TTS (`Flash 2.5, Despina`)：highly expressive / stylized。
- Kyutai-TTS (`1.6B, p037`)：基於 Moshi audio-to-audio framework，raw conversational data，spontaneity 和 disfluency 強。
- GPT-4o-mini-tts (`Coral`)：balanced profile，medium-high spontaneity / moderate expressivity。
- ElevenLabs (`multilingual_v2, Bella`)：commercial TTS，professional delivery，medium spontaneity / moderate expressivity。

### 4. Acoustic features and automatic metrics

作者不只做 human study，也分析哪些 acoustic features / automatic metrics 跟 appropriateness 有關。

Acoustic features：

- rhythm：articulation rate sd、speech rate、nPVI。
- expressivity：f0 range、f0 percentiles、RMSE sd、arousal、valence。
- voice quality：jitter、shimmer、H1-H2、alpha ratio、CPPS。

Automatic metrics：

- quality estimation：UTMOSv2、DNSMOS、Squim、PESQ、MCD、STOI。
- prosodic distance：f0 correlation、AutoPCP、WavLM。
- style：AudioBox CE/CU/PQ。
- intelligibility：WER by `nvidia/parakeet-tdt-0.6b-v2`。
- diversity：DS-WED。

## Training / Data

這篇不是訓練新 TTS model，而是 human perception / evaluation study。

Study setup：

- 150 native English speakers。
- Prolific recruitment，95% approval rating。
- 6 sessions，每 session 25 participants。
- 30 curated sentences。
- 5 TTS systems + ground truth。
- 5-point Likert scale。
- 2 attention checks。
- Gradio interface。

Statistical notes：

- Figure 1 用 Wilcoxon paired test，Holm-Bonferroni correction，`p <= 0.05`。
- Inter-rater agreement reported as Krippendorff's alpha：
  - TTS samples：0.2。
  - Ground truth samples：0.44。

低 agreement 本身是重要結果：appropriateness judgment 很 subjective，受 listener expectation 影響很大。

## 主要結果

### 1. Appropriateness strongly depends on domain

大部分 systems 在 reader / AI assistant roles 表現較好，但 spontaneous conversation、actor、animated character 更難。

System profile：

- Kokoro：reader / assistant 適合，但 conversational tasks 差。
- Kyutai-TTS：spontaneous conversation 很強，但作為 AI assistant 或 animated character 不適合。
- ElevenLabs / Gemini / GPT-4o-mini-TTS：acting domain 較高，但 spontaneous conversation 不夠好。

這表示 TTS system 不存在單一 global ranking；一個 model 的 voice / style bias 會讓它更適合某些場景。

### 2. Human-likeness 和 appropriateness 不是同一個東西

作者報告 human-likeness 和 domain appropriateness 的 Spearman correlation：

- Spontaneous：0.4021。
- Actor：0.4705。
- Reader：0.3757。
- Animated Character：0.0821。
- Assistant：-0.4438。

最重要的是 Assistant domain 的負相關：越像真人 / 越 spontaneous 的 speech，不一定越適合作為 assistant；listener 可能期待 assistant 聲音更 neutral、clean、controlled，甚至稍微 AI-like。

Animated Character 幾乎零相關，表示「像真人」也不能代表「像動畫角色」。

### 3. Naturalness score 會懲罰 stylized speech，也會偏好 spontaneous speech

Ground-truth human samples 的 human-likeness 也會因 domain / dataset 變動。作者觀察到：

- MELD 和 MSP-Podcast conversational samples 比 LibriQuote / AnimeVox ground truth 更被認為 human-like。
- LibriQuote 的 Irish accent 或 mature reader voice 可能降低 perceived naturalness。
- AnimeVox 的 highly stylized delivery 也被 penalized。

這點很重要：不是只有 synthetic speech 會被 bias 影響，人類 speech 的 naturalness score 也受到 accent、style、speaker expectation 影響。

### 4. 不同 domain 需要不同 acoustic profile

Acoustic feature correlations 顯示：

- Animated Character：強烈偏好 articulation rate variability (`rho=0.43`) 和 nPVI (`rho=0.41`)，也就是節奏和 pacing 要有大幅波動。
- Reader：對同樣 rhythm variability 呈負相關，約 `rho=-0.30`，更偏好穩定、controlled delivery。
- Assistant：偏好 stability / neutrality；f0 range (`rho=-0.35`) 和 valence (`rho=-0.32`) 越高越不適合。
- Spontaneous：jitter (`rho=0.34`) 和 creakiness / H1-H2 (`rho=0.29`) 反而是正面訊號，因為 casual interaction 期待某些 human imperfection。

這直接支持 context-aware evaluation：同一個 acoustic feature 在不同 domain 下方向可能相反。

### 5. Automatic metrics 不是 universal proxy

Common quality estimators 的 correlation 也有 domain dependency：

- UTMOS / DNSMOS 對 Actor 和 Spontaneous appropriateness 是負相關：
  - Actor：`rho <= -0.41`
  - Spontaneous：`rho <= -0.47`
- Assistant 對 MOS predictors 是正相關，約 `rho = 0.35`。
- AudioBox / AutoPCP 對 Assistant / Reader 有效，`rho >= 0.36`。
- 但這些 embedding-based metrics 對 human-likeness nuances 可能反向，約 `rho = -0.50`。
- WavLM distance 對 Assistant 是負相關 (`rho=-0.72`)，但對 human-likeness 是正相關，暗示 WavLM embedding 更偏 neutral speech representation。
- PESQ 和 f0 correlation 對 perceived appropriateness 幾乎沒幫助。
- DS-WED 對 diversity 較 robust。

## Project relevance

### project-audio-model-evaluation：非常高相關

這篇是 audio evaluation project 的重要 paper，因為它把 evaluation target 從「單一自然度」拆成 domain-specific appropriateness。

對 AnyAudio-Judge / Audio Judge / rubric evaluation 的啟發：

- rubric 不能只問「sounds natural」。
- 應該先指定 use-case / persona / listener expectation。
- 同一 audio 在不同 context 下可以有不同正確評分。
- automatic metrics 要按 domain calibrate，不能全域使用。

這也支援我們之前的方向：更 human-friendly 的 evaluation 應該能說明「哪段 audio 在什麼場景下因為什麼 acoustic / prosodic evidence 不合適」，而不是只給 yes/no 或 global MOS。

### project-tts-data-pipeline：高相關

TTS data pipeline 不只是 clean transcript / high MOS audio，而要保留 style / context metadata。

對資料 schema 的具體建議：

- 每個 sample 應標注 intended domain：reader、assistant、spontaneous、actor、animated character、role-play 等。
- 保存 acoustic feature profile：speech rate、articulation variability、f0 range、energy dynamics、jitter/creakiness。
- 對 expressive / spontaneous data，不應用傳統 MOS / DNSMOS 過度 filtering，否則會把必要的 disfluency / stylization 濾掉。
- TTS training/eval split 應按 target use-case 分層，而不是混成單一 TTS quality score。

### project-full-duplex-data：中度相關

Full-duplex dialogue 的自然性更依賴 context。Backchannel、overlap、pause、interrupt、laugh、breath 都不是單純「越 clean 越好」。

這篇對 full-duplex project 的啟發：

- spontaneous / conversational appropriateness 要保留 disfluency 和 human imperfection。
- AI assistant-like speech 和 human-human conversation speech 的 evaluation target 不同。
- dual-channel generator 評估時要先定義 persona：assistant-agent、human partner、actor role-play、casual dialogue。
- 如果用 UTMOS/DNSMOS 類 metric 過度篩資料，可能會刪掉真正 conversational 的 prosody。

## Related papers in my pool

- [AnyAudio-Judge](../arxiv_2606_03116/)：rubric-based audio evaluation；本篇提醒 rubric 應該 domain-aware，不應只問 general naturalness。
- [PlanAudio](../arxiv_2605_28063/)：audio planning / generation evaluation；本篇補上 listener expectation / use-case framing。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech tokenization；如果 evaluation 要拆 content vs paralinguistic appropriateness，TASTE 類 representation 有幫助。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：controllable TTS / voice design tool；本篇提醒 voice design 需要按 target domain profile 評估。
- [LoSATok](../arxiv_2605_27840/)：semantic-acoustic representation；若用 tokenizer latent 做 TTS generation，也應按 domain-specific appropriateness 評估。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。arXiv recent list 註明 `Accepted at Interspeech 26'`，TeX 使用 Interspeech 2026 camera-ready class；目前以 Interspeech 2026 / arXiv 記錄。

## 我該不該細讀

建議細讀，尤其如果你在做 TTS evaluation、audio judge、speech role-play、full-duplex conversation evaluation。

最值得讀：

1. listening study design：150 participants、Latin Square、human-likeness vs convincingness。
2. 5 個 domain 的 framing。
3. human-likeness / appropriateness correlation table。
4. acoustic feature correlation：哪些 feature 在不同 domain 方向相反。
5. automatic metric correlation：UTMOS/DNSMOS/WavLM/AudioBox 何時失效。

## 可能的弱點 / open questions

1. **只有 isolated sentences**  
   作者也承認 real-world speech 有 dialogue、emotional progression、interaction history。這對 full-duplex / agent dialogue 特別重要。

2. **五個 TTS systems 和 selected female voices**  
   為了控制 voice preference，作者選了相似 timbre 的 female voices。但這也限制了對 gender、age、accent、socioeconomic background 的分析。

3. **Appropriateness agreement 很低**  
   TTS Krippendorff's alpha 只有 0.2，表示這個 task 主觀性高。這不代表結果沒價值，但未來 evaluation protocol 需要更好的 rater calibration / context framing。

4. **Automatic metrics 只做 correlation，不是 causal explanation**  
   某些 acoustic features 與 appropriateness 相關，但不表示改動該 feature 就一定提升 appropriateness。

5. **沒有直接給可訓練的 reward model / judge**  
   這篇主要是 evaluation analysis。若要用於 model training，還需要把 domain-specific appropriateness 轉成 reward model 或 structured rubric。

## Tags

tts-evaluation, speech-evaluation, human-evaluation, appropriateness, naturalness, expressive-tts, audio-metrics, project-audio-model-evaluation, project-tts-data-pipeline

## Concepts

- domain-aware TTS evaluation
- appropriateness
- human-likeness
- naturalness vs appropriateness
- MOS limitation
- contextual speech evaluation
- expressive TTS
- spontaneous speech
- AI assistant voice
- acoustic feature correlation
- automatic metric failure modes

## Citation

目前以 Interspeech 2026 / arXiv 記錄；若 ISCA proceedings metadata 更新，再補正式 proceedings URL。

```bibtex
@misc{woszczyk2026isnaturalalwaysappropriateinve,
  title={Is Natural Always Appropriate? Investigating Naturalness and Appropriateness Across Different Domains for TTS Evaluation},
  author={Dominika Woszczyk and Andreas Triantafyllopoulos and Jura Miniota and Éva Székely and Bjoern Schuller},
  year={2026},
  eprint={2606.31729},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2606.31729}
}
```
