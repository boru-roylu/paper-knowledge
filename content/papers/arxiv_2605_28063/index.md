---
paper_key: arxiv_2605_28063
canonical_id: "arxiv:2605.28063"
title: "Unified Synthesis of Compositional Speech and Sound from Free-Form Text Prompts"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.28063"
pdf_url: "https://arxiv.org/pdf/2605.28063"
status: read
rating: 5
tags:
  - audio-generation
  - text-to-audio
  - tts
  - speech-llm
  - project-audio-model-evaluation
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-03
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, arXiv metadata, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2605.28063)
- [PDF](https://arxiv.org/pdf/2605.28063)
- [arXiv source](https://arxiv.org/src/2605.28063)

## 一句話總結
**PlanAudio** 把 text-to-speech 和 text-to-sound 合成統一成一個 free-form prompt -> unified audio 任務：使用者只給自然語言描述，模型要直接生成 speech、sound，或兩者自然交織的 composite audio。

## 這篇在解決什麼問題
現有 TTS 和 text-to-sound models 多半各自擅長單一任務，但真實世界 audio 常常是 speech 和 environmental sound / music / applause 等事件交織在一起。若用 pipeline 做法，通常要先把 free-form prompt 拆成 speech track 和 sound track，再分別生成、後製混合；這會造成 timing mismatch、semantic omission、聲音互動不自然。

作者提出的新任務是 **Free-Form-Text-Prompt-to-Unified-Audio Generation**：不要求 structured prompt，也不要求使用者提供 `[Speech]` / `[Sound]` 欄位，而是讓模型直接從 unconstrained natural language 合成完整 audio scene。

例子是「music starts, someone says a sentence, then applause follows」這種 prompt。重點不是單純同時有 speech 和 sound，而是要控制：

- temporal order：事件先後順序
- speech-sound interaction：speech 是否被 background music / applause 自然包住
- semantic coverage：prompt 裡的事件不要漏掉
- authenticity：不要像兩個模型輸出硬混在一起

## 核心方法
PlanAudio 是 unified autoregressive LLM-based audio generation framework，核心設計有三個：

1. **直接吃 free-form text**
   不使用外部 text encoder，也不依賴 explicit text rewriting。Prompt 由 LLM tokenizer 直接處理，模型靠 LLM 的 intrinsic reasoning ability 來理解 speech、sound、temporal relation。

2. **Semantic Latent CoT**
   這是 paper 的主要創新。模型不直接從 text 生成 acoustic tokens，而是先預測一段 continuous semantic latent sequence，作為 implicit plan。這個 latent CoT 由 Audio Flamingo 3 Encoder (AF3Encoder) 的 semantic embeddings 監督，目標是先決定高層事件結構、temporal orchestration、speech prosody orientation，再進入低層 acoustic generation。

3. **Hierarchical audio token generation**
   acoustic representation 使用 AudioCraft tokenizer，把 audio 離散成多 codebook hierarchical tokens。模型在原始 prompt + semantic plan 的條件下，自回歸生成 audio tokens，最後 decode 成 waveform。

形式上可以理解成：

```text
P(audio | text) = P(semantic_plan | text) * P(audio_tokens | text, semantic_plan)
```

作者比較了幾種 CoT：

- no CoT：直接 text -> audio
- Explicit CoT：Gemini-2.5 Pro 產生 natural language reasoning chain
- Acoustic CoT：用 codec-based acoustic vectors 當中介
- Semantic Latent CoT：PlanAudio 的方法

結果顯示 Semantic Latent CoT 最穩，因為 natural language CoT 對密集、overlapping、temporal audio interaction 的表達能力有限，而 acoustic CoT 太偏 reconstruction，semantic depth 不夠。

## Training / Data
訓練資料分三類，總共 **1.27M clips**：

- **371k composite**：由 raw AudioSet 合成/整理而來，用 Whisper 做 transcription，用 Gemini-2.5 Pro 產生 non-linguistic descriptions；再過濾 intelligible single-speaker samples。
- **451k sound**：AudioCaps / WavCaps，並用 Gemini-2.5 Pro refine sound captions。
- **354k speech**：LibriTTS，將 speech attributes 轉成 free-form text prompts。

Composite benchmark：

- 作者從 composite set 裡抽出 **4,500** 個 speech-sound interaction 強的 instances，建立 **PlanAudio-Bench**。
- speech-sound interaction strength 由 Gemini-2.5 Pro 判斷。
- 每個 clip 透過 augmentation 配五種 diverse text annotations，讓模型學會同一段 audio 可對應多種 prompt 表達。

模型初始化與訓練：

- PlanAudio initialized from **Qwen2.5-1.5B**。
- multi-stream audio prediction 使用 MusicGen 類 delayed token interleaving pattern。
- AF3Encoder 產生 750 embeddings，mean pooling downsample 到 **K=6** 個 semantic latent steps。

## 主要結果
### Composite generation
在 PlanAudio-Bench 上，PlanAudio 在 sound-related metrics 明顯優於 VoiceLDM 和 AudioLDM2 pipeline：

- FD(PANNs)：PlanAudio **8.52**，AudioLDM2 pipeline 14.3，VoiceLDM-m 22.9。
- FD(PaSST)：PlanAudio **201**，AudioLDM2 pipeline 240，VoiceLDM-m 363。
- KL(PaSST)：PlanAudio **0.91**，pipeline 1.10，VoiceLDM-m 1.32。
- CLAP：PlanAudio 0.20，略低於 pipeline 0.21，但高於 VoiceLDM-s 0.15。

Speech-related metrics 上，VoiceLDM-m 的 WER/UTMOS 較好，作者認為原因是 VoiceLDM 用 synthetic clean speech + sound composites，對 ASR 比較友善，但 authenticity 較差。PlanAudio 用 real-world AudioSet，speech recognition 稍差但 scene authenticity 較高。

Subjective composite evaluation 中，PlanAudio 在四個維度都最高：

- Quality：**3.23**
- Temporal correctness：**3.16**
- Semantic alignment：**3.36**
- Authenticity：**3.47**

### Sound / speech 單任務
PlanAudio 在 AudioCaps sound generation 上勝過 unified baseline VoiceLDM，並接近 specialist models；在 LibriTTS speech generation 上：

- PromptTTS++：WER 0.12，UTMOS **3.51**
- VoiceLDM-m：WER 0.13，UTMOS 2.99
- PlanAudio：WER **0.11**，UTMOS **3.11**

這表示它不是只會 composite，也能在單一 speech / sound 場景維持可用品質。

### Ablation
Semantic Latent CoT 在 composite、sound、speech 三類任務整體最佳。尤其在 composite 上，它的 SCF 是 **0.34**，明顯高於 w/o CoT 0.12、Explicit CoT 0.20、Acoustic CoT 0.09，說明 semantic plan 對避免事件漏生成有效。

Data curriculum ablation 顯示 constant balanced sampling 最穩。若先訓練 sound/speech，再突然切到 composite-only，會造成 catastrophic forgetting；這對 unified audio model 的訓練資料排程很有參考價值。

## Project relevance
**project-full-duplex-data：高度相關，但不是直接 full-duplex 對話模型。**

這篇處理的是 speech + sound 的 compositional audio，不是雙人對話或 overlapping conversational turns。不過它對 full-duplex data 很有啟發：Semantic Latent CoT 可以被視為一種 high-level audio event plan，未來可以改成規劃 backchannel、overlap、turn-taking、pause、laughter、environment sound 和 main speech 的時間關係。

如果你的未來目標是「給 transcript/control signals，合成自然 dual-channel conversation with backchannels and overlaps」，PlanAudio 的價值在於：

- free-form prompt 可以描述 speech 和 non-speech events 的 interaction。
- latent plan 比 explicit text CoT 更適合表達 dense temporal audio events。
- composite audio benchmark 的設計方式可借鑑到 conversation/audio event benchmark。

**project-tts-data-pipeline：中到高度相關。**

它展示了如何把 speech attributes 和 sound captions 都轉成 free-form prompts，並用多 annotation augmentation 訓練模型做 scene discrimination。對 TTS data pipeline 來說，這意味著 transcript format 不只要有文字內容，還可以加入 background sound、style、prosody、event timing、environment context。

## Related papers in my pool
- **VoxCPM / VoxCPM2**：同樣是 free-form / instruction-like TTS control，但 VoxCPM2 更偏 voice design / cloning；PlanAudio 更偏 speech+sound compositional scene generation。
- **Dia**：dialogue TTS baseline；可比較 Dia 的 transcript-to-dialogue 和 PlanAudio 的 free-form prompt-to-composite-audio。
- **Chatterbox TTS**：可比較 paralinguistic tags 與 PlanAudio 的 latent planning 是否更能控制 nonverbal / scene events。
- **Full-Duplex-Bench-v3**：FDB-v3 側重 voice agent tool-use / disfluency evaluation；PlanAudio 則提供 composite audio generation 和 event planning 的方向。
- **Miipher / Miipher-2**：若要用 real-world noisy composite audio 訓練，speech restoration / cleaning 會是 upstream pipeline。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。目前以 arXiv preprint 記錄；TeX 使用 `neurips_2026` style，但 source 是 arXiv preprint，不代表已有 NeurIPS acceptance。

## 我該不該細讀
**建議細讀。**

它不是純 TTS paper，但非常接近你想要的「speech + event + timing control」方向。最值得看的不是 WER/UTMOS，而是：

- Semantic Latent CoT 的 supervision design
- PlanAudio-Bench 的 composite data construction
- SCF metric 如何衡量 semantic omission
- data curriculum 對 unified generation 的影響
- explicit text decomposition / pipeline baseline 為什麼處理不好 fine-grained interaction

## 可能的弱點 / open questions
- Composite data 和 benchmark 很大程度依賴 Whisper / Gemini-2.5 Pro annotation 與 filtering，可能有 annotation bias。
- PlanAudio-Bench 用 Gemini 判斷 interaction strength，需確認是否會偏向容易被 LLM 描述的場景。
- Speech-related metrics 在 composite 場景仍落後 VoiceLDM-m；作者歸因於 codec ceiling 和 real-world data，但這代表內容 fidelity 還有風險。
- 沒有看到 official code / checkpoint / demo release；source 裡有 commented anonymous demo link，但不適合當正式公開連結。
- 目前主要是 mono mixed audio scene generation，不是 dual-channel conversation generation；若用於 full-duplex data，還要測 speaker separation、overlap intelligibility、turn-level controllability。
- 作者也承認 deceptive audio generation 的 misuse risk。

## Tags
- audio-generation
- text-to-audio
- tts
- speech-llm
- compositional-audio
- semantic-latent-cot
- project-audio-model-evaluation
- project-full-duplex-data
- project-tts-data-pipeline

## Concepts
- free-form text prompt to unified audio
- compositional speech and sound synthesis
- Semantic Latent CoT
- Audio Flamingo 3 Encoder
- AudioCraft tokenizer
- PlanAudio-Bench
- semantic coverage factor
- multi-scenario curriculum
- temporal orchestration
- speech-sound interaction

## Citation
```bibtex
@misc{wang2026unifiedsynthesiscompositional,
  title={Unified Synthesis of Compositional Speech and Sound from Free-Form Text Prompts},
  author={Yuyue Wang and Xihua Wang and Xin Cheng and Yijing Chen and Ruihua Song},
  year={2026},
  eprint={2605.28063},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.28063}
}
```
