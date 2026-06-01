---
paper_key: arxiv_2504_08528
canonical_id: "arxiv:2504.08528"
title: "On The Landscape of Spoken Language Models: A Comprehensive Survey"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2504.08528"
pdf_url: "https://arxiv.org/pdf/2504.08528"
status: read
rating: 4
tags:
  - speech-llm
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- OpenReview summary model: `gpt-5.5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2504.08528)
- [PDF](https://arxiv.org/pdf/2504.08528)
- OpenReview: https://openreview.net/forum?id=S4LauBhcOF

## 一句話總結
這是一篇全面整理 spoken language models (SLMs) 的 survey，重點是用統一框架整理 model architecture、training strategy、evaluation 與未來挑戰，幫讀者把零散的 speech LLM/SLM 文獻放進同一張地圖。

## 這篇在解決什麼問題
SLM 近年發展很快，但文獻中的術語、模型類型、訓練設定和 evaluation 方式非常不一致，導致：
- 很難比較不同方法的定位與能力
- 很難看出 pure speech LM、speech+text LM、speech-aware text LM 之間的關係
- 很難判斷哪些模型真的朝向「universal speech processing systems」前進

這篇 survey 的目標就是提供一個 unified definition 與 taxonomy，讓研究者能更清楚地理解 SLM landscape。

## 核心方法
這不是提出新模型，而是建立一個統一的 survey / taxonomy。作者主要從三個面向整理 SLM：

1. **Model architecture**
   - 分成三大類：
     - **pure speech LM**：建模 `p(speech)`
     - **speech+text LM**：建模 `p(text, speech)`
     - **speech-aware text LM**：建模 `p(text | speech, text)`
   - 再往下拆成 speech encoder、speech decoder、speech-text alignment、sequence model 等元件

2. **Training strategies**
   - **pre-training**：generative pre-training、conditional pre-training、aligning speech and text modalities
   - **post-training**：task-specific training、instruction tuning、chat SLM training
   - 強調許多模型雖然借鑑 LLM，但其訓練目標與資料型態差異很大

3. **Evaluation / positioning**
   - 整理代表性模型與常見 benchmark
   - 說明現有評估很不統一，造成 cross-paper comparison 困難

另外，文章也明確提出一個 functional definition：真正的 universal speech processing system 應該能接受 natural language instruction，且理想上可處理任意 spoken language task。

## Training / Data
這篇是 survey，本身**沒有訓練模型**，但總結了 SLM 常見的 training/data 型態：

- **Unlabeled tokenized speech data**：用於 pure speech LM 的 next-token prediction
- **Paired speech-text data**：用於 speech+text LM 或 conditional pre-training
- **Instruction / preference data**：用於 post-training、instruction tuning、chat SLM
- **Task-specific supervised data**：例如 ASR、ST、SLU、SID 等傳統語音任務
- 也提到 speech encoder 常來自 self-supervised pre-trained models，再接 task head 或 alignment module

## 主要結果
這篇沒有實驗數值結果，而是以 survey 的方式總結幾個重要結論：

- SLM 正在從 task-specific speech models 走向可泛化的 universal speech processing systems
- 現有 SLM 可以合理分成三個主要類型，這個分類有助於釐清不同工作之間的關係
- **cascade approach**（ASR + text LLM + TTS）仍是強 baseline，但 end-to-end SLM 在處理 prosody、speaker traits、emotion 等非文字資訊時更有潛力
- 現階段最大的瓶頸之一是 **evaluation fragmentation**：不同論文用不同資料與設定，難以直接比較
- 未來方向包含更一致的 benchmark、自然語言指令式互動、以及更完整地處理 speech 與 text 的雙向生成

## Project relevance
- **project-full-duplex-data**：高度相關
- **project-tts-data-pipeline**：低度相關

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀，若你在做 speech LLM / SLM 方向。**

原因：
- 這篇提供很實用的 taxonomy，適合拿來定位新方法
- 對 understanding architecture/training/evaluation choices 很有幫助
- 對想做 full-duplex speech system 或 speech-text hybrid model 的人，能快速建立整體視角

如果你目標是做純 data pipeline 或純 TTS cleaning，這篇不算最直接，但仍可作為背景 survey。

## 可能的弱點 / open questions
- 這是 survey，**沒有新方法與新實驗**，主要價值在整理而非證明
- SLM 定義雖然統一，但仍偏 functional definition，實務上不同模型邊界可能仍模糊
- 各類 benchmark 與 evaluation setting 仍然高度分散，survey 本身也無法完全解決可比性問題
- 對於 **universal speech processing system** 的真正能力，目前多數模型仍停留在有限任務與有限模態，離完整目標還有距離
- 對 non-textual speech cues（prosody, emotion, speaker identity）的建模與評估，仍是重要但尚未充分標準化的 open question

## Tags
- spoken language models
- SLM
- speech LLM
- survey
- speech-text alignment
- instruction tuning
- chat SLM
- speech LM
- universal speech processing
- evaluation benchmark

## Concepts
- **pure speech LM**：建模 `p(speech)`，通常以 tokenized speech 做 next-token prediction
- **speech+text LM**：聯合建模 speech 與 text，例如 `p(text, speech)`
- **speech-aware text LM**：把 speech encoder 接到 text LLM，建模 `p(text | speech, text)`
- **instruction tuning**：讓模型依照 natural language instruction 回應 speech-related tasks
- **post-training**：包含 instruction tuning、preference optimization、chat alignment 等
- **speech-text alignment**：讓 speech representation 與 text representation 對齊
- **cascade approach**：ASR + text LLM + TTS 的串接式系統
- **universal speech processing system**：能以自然語言指令處理多種 spoken language tasks 的系統
- **tokenized speech sequences**：將 speech 轉為離散 token 後進行 LM 建模
- **hybrid generation**：speech 與 text 共同生成或交錯生成

## Citation
```bibtex
@article{arora2025onthelandscapeofspokenlanguage,
  title={On The Landscape of Spoken Language Models: A Comprehensive Survey},
  author={Arora, Siddhant and Chang, Kai-Wei and Chien, Chung-Ming and Peng, Yifan and Wu, Haibin and Adi, Yossi and Dupoux, Emmanuel and Lee, Hung-Yi and Livescu, Karen and Watanabe, Shinji},
  year={2025},
  journal={arXiv preprint},
  eprint={2504.08528},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```
