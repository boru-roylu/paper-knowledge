---
paper_key: arxiv_2605_21008
canonical_id: "arxiv:2605.21008"
title: "A Survey of Audio Reasoning in Multimodal Foundation Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.21008"
pdf_url: "https://arxiv.org/pdf/2605.21008"
status: read
rating: 4
tags:
  - speech-llm
  - audio-reasoning
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-31
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.21008)
- [PDF](https://arxiv.org/pdf/2605.21008)

## 一句話總結
這是一篇首個專注於 **audio reasoning** 的 survey，系統整理 audio foundation models 如何結合 reasoning、grounding、interaction latency 與 evaluation，並提出從 Audio-to-Text、Audio-to-Speech、Audio-Visual 到 Agentic Audio Reasoning 的統一框架。

## 這篇在解決什麼問題
這篇在回答：**audio modality 的 reasoning 要怎麼定義、怎麼做、怎麼評估，和 text/vision reasoning 有何不同？**

作者指出 audio reasoning 的特殊難點在於：
- audio 是 **continuous**、**temporally dense**
- 同時包含 linguistic、paralinguistic、environmental information
- 需要把 acoustic signals 對齊到 LLM 的 discrete semantic space
- 但又不能丟掉 fine-grained acoustic cues
- 目前還受限於三個大瓶頸：
  - **genuinely audio-grounded reasoning data 稀缺**
  - **shortcut learning / modality hallucination**
  - **reasoning depth vs. real-time latency** 的衝突

所以這篇的目的不是提出單一模型，而是提供一個整理 field 的 roadmap。

## 核心方法
這篇是 survey，核心貢獻是 **taxonomy + unified formulation**，不是新的 model architecture。

### 1) Unified formulation
作者把 audio reasoning formalize 成 conditional generation with optional intermediate reasoning trajectory：

- input 可包含 `audio (A)`, `text (X)`, `visual (V)`
- context `C` 是多模態整合後的輸入
- output `O` 可以是 `text (Y)` 或 `speech tokens (S)`
- 可選擇顯式 reasoning trajectory `R`

也就是區分：
- **direct predictive modeling**
- **reasoning-augmented generation**

### 2) 四大 paradigm taxonomy
作者把文獻分成四類：

- **Audio-to-Text Reasoning**
  - 從 audio 推到 text answer
  - 強調 acoustic grounding
  - 討論 `Chain-of-Thought prompting`, `SFT`, `RL`
  - 也整理 reasoning dataset construction

- **Audio-to-Speech Reasoning**
  - 在 spoken interaction 中 reasoning
  - 包含 sequential 和 real-time settings
  - 特別關注 latency-aware design
  - 如 `thinking while listening` / `thinking while speaking`

- **Audio-Visual Reasoning**
  - 結合 audio 與 visual evidence
  - 重點是 temporal alignment、cross-modal grounding、disambiguation

- **Agentic Audio Reasoning**
  - 把 audio task 拆成 perception、planning、tool use、memory、reflection
  - 涵蓋 predefined workflow agents 與 dynamic tool-calling agents

### 3) Foundations and training
作者也整理了兩大基礎：
- **Large Audio Language Models (LALMs)**
  - 常見為 `encoder-projector-LLM` pipeline
- **Spoken Language Models (SLMs)**
  - 直接處理 speech / spoken tokens

訓練上則分為：
- **cross-modal alignment pre-training**
- **post-training**（如 SFT、preference optimization、RL）

## Training / Data
這篇不是實驗型 paper，但有系統整理 training 與 data 的瓶頸。

### Training aspects
作者特別提到：
- `CoT prompting`
- `supervised fine-tuning (SFT)`
- `reinforcement learning (RL)`
- `preference optimization`
- `parameter-efficient adaptation`
- `latency-aware spoken interaction`

### Data issues
作者認為 audio reasoning 的資料主要有三個問題：
- **high-quality reasoning trajectories 很少**
- 很多 dataset 是由 text-only LLM 用 transcript 或 sound tags 合成，可能不真的 grounded in audio
- 對 real-time spoken reasoning 來說，資料還要覆蓋 streaming / latency-aware settings

也就是說，這篇很強調：**audio reasoning 的資料可靠性比一般 text reasoning 更脆弱**。

## 主要結果
作為 survey，這篇的「結果」主要是綜述結論與 field-level observations：

- audio reasoning 還沒有像 text reasoning 那樣成熟
- 現有模型常出現 **modality hallucination**，即依賴 text surrogate 而非原始 audio
- `CoT` 在 audio 模態是否真的提升 grounding，仍不完全清楚
- `offline reasoning` 和 `real-time spoken interaction` 在性能/延遲上存在明顯落差
- current methods mostly work on short clips，對 `long-context audio reasoning` 還缺乏穩定解法
- 未來可能需要把 reasoning objectives 更早放進 pre-training，而不只是後訓練補強

## Project relevance
- **project-full-duplex-data**: 相關
- **project-tts-data-pipeline**: 相關

## Related papers in my pool
和 pool 裡已讀的 paper 有明顯關聯，尤其是：

- **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems**
  - 共同點：都關注 spoken interaction 中的 `latency`, `turn-taking`, `full-duplex` 控制
  - 差異：那篇是具體 DM 架構；這篇是 survey 層級，提供更廣的 reasoning taxonomy
  - 對你的啟發：可把 full-duplex control 視為 `Audio-to-Speech Reasoning` 的一部分

- **SoulX-Duplug: Plug-and-Play Streaming State Prediction Module for Realtime Full-Duplex Speech Conversation**
  - 共同點：都強調 `thinking while listening / speaking`、streaming、latency-aware interaction
  - 差異：那篇是 state prediction module；這篇把它放進整體 audio reasoning 脈絡
  - 對你的啟發：可以把 streaming state prediction 與 reasoning grounding、modality hallucination 一起看

- **DialogueSidon: Recovering Full-Duplex Dialogue Tracks from In-the-Wild Dialogue Audio**
  - 共同點：都碰到 audio dialogue 的 `overlap`、speaker-wise 互動資料問題
  - 差異：那篇偏資料重建/分離；這篇偏 reasoning 與 evaluation 的總覽
  - 對你的啟發：full-duplex data 的品質與 grounding 會直接影響 reasoning / interaction 模型

- **Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages**
  - 共同點：都提到 audio 模型的基礎訓練、alignment、以及資料稀缺問題
  - 差異：那篇是 ASR scaling；這篇是 reasoning survey
  - 對你的啟發：若要做 audio reasoning data pipeline，ASR/SSL backbone 的品質仍是前提

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**建議細讀。**
如果你在做 speech-LLM、spoken dialogue、full-duplex interaction、或 audio data pipeline，這篇很適合作為背景總覽與 taxonomy 入口。它不會直接教你一個新模型，但能幫你：
- 對齊研究問題定義
- 分辨 `reasoning`、`grounding`、`latency` 的關係
- 找到 relevant subfields 與 evaluation gaps

## 可能的弱點 / open questions
- 這是 survey，**不提供新的實證結果**，對 method selection 的指導仍偏高層次
- `audio reasoning` 的邊界定義可能還不夠硬，某些 `understanding` 任務和 `reasoning` 任務的切分會有爭議
- 對 `genuinely audio-grounded` 的判準仍不明確，容易停留在概念層
- `CoT`、`SFT`、`RL` 在 audio 場景到底各自帶來多少可重現增益，仍需要更系統的 benchmarking
- `latency-aware spoken interaction` 與高精度 reasoning 的 trade-off 目前沒有明確解法
- `long-context audio reasoning` 和 multi-hop audio inference 的 benchmark 還很缺

## Tags
- audio reasoning
- multimodal foundation models
- Chain-of-Thought
- Audio-to-Text
- Audio-to-Speech
- Audio-Visual reasoning
- Agentic Audio Reasoning
- spoken language models
- latency-aware interaction
- modality hallucination
- full-duplex

## Concepts
- `audio grounding`
- `direct predictive modeling`
- `reasoning-augmented generation`
- `Large Audio Language Models (LALMs)`
- `Spoken Language Models (SLMs)`
- `encoder-projector-LLM`
- `cross-modal alignment pre-training`
- `supervised fine-tuning (SFT)`
- `reinforcement learning (RL)`
- `preference optimization`
- `Chain-of-Thought prompting`
- `thinking while listening`
- `thinking while speaking`
- `modality hallucination`
- `shortcut learning`
- `latency-aware spoken interaction`
- `long-context audio reasoning`
- `Agentic Audio Reasoning`

## Citation
```bibtex
@article{guo2026asurveyofaudioreasoninginmulti,
  title={A Survey of Audio Reasoning in Multimodal Foundation Models},
  author={Guo, Zhihan and Cui, Wenqian and Lin, Guan-Ting and Tan, Daxin and Li, Jingyao and Zheng, Qiyong and Wang, Dingdong and Xiong, Jing and Shi, Han and Jia, Jiaya and King, Irwin},
  journal={arXiv preprint},
  year={2026}
}
```
