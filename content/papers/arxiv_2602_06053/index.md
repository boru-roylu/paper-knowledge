---
paper_key: arxiv_2602_06053
canonical_id: "arxiv:2602.06053"
title: "PersonaPlex: Voice and Role Control for Full Duplex Conversational Speech Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2602.06053"
pdf_url: "https://arxiv.org/pdf/2602.06053"
status: read
rating: 4
tags:
  - speech-llm
  - full-duplex
  - project-full-duplex-data
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- OpenReview summary model: `gpt-5.5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2602.06053)
- [PDF](https://arxiv.org/pdf/2602.06053)

## 一句話總結
PersonaPlex 將 full-duplex speech model 擴展到同時可控 **voice** 與 **role**，用 hybrid system prompts 做 zero-shot voice cloning 與 fine-grained role conditioning，讓模型更適合 customer service 等 structured 對話場景。

## 這篇在解決什麼問題
這篇在解決既有 full-duplex speech-to-speech models 的兩個限制：

1. **固定 voice identity**：很多 duplex 模型只能用單一 voice，難以做 personalized interaction。
2. **固定 assistant role**：多數模型只像一般 assistant，缺少可切換的 conversational role，無法直接對應 customer service、multi-character interaction 等應用。

作者認為，雖然 instruction-following LLM 和 voice-conditioned TTS 都已經成熟，但這兩種能力還沒有被很好整合進 low-latency duplex speech system。這篇的目標就是把 **role conditioning** 和 **voice cloning** 一起加到 full-duplex 架構中，而且不破壞其即時互動特性。

## 核心方法
核心方法是 **Hybrid System Prompt**，把文字 role prompt 和音訊 voice prompt 串接起來，讓同一個 duplex model 同時學會控制角色與聲音。

### 架構
PersonaPlex 採用類似 Moshi 的 duplex multimodal 架構，接收三條 input stream：

- `user audio`
- `agent text`
- `agent audio`

### Hybrid System Prompt
Hybrid System Prompt 由兩段組成：

- **text prompt segment**：在 agent text channel 放入 role description，強制模型進入特定 scenario / role
- **voice prompt segment**：在 agent audio channel 放入短語音樣本，讓後續生成保留同一 voice，實現 **zero-shot voice cloning**

作者也提到：
- system prompt 的 loss 不回傳
- 用 custom text/audio delimiters 區分 prompt 與 dialogue
- training 時對 non-semantic audio tokens 和 padded text tokens 做 loss reweighting，以處理 token imbalance

### 關鍵設計點
- **role control** 主要靠 text prompt
- **voice control** 主要靠 audio prompt
- 兩者可組合，不需要改變 underlying architecture
- 目標是維持 full-duplex 的 responsiveness、turn-taking 與 low latency

## Training / Data
### Data
訓練資料是大規模 **synthetic dialogs**，分成兩類：

1. **Service scenarios**
   - 先抽 service domain（如 restaurant、bank）
   - 再抽 scenario（如 refund、information request）
   - 由 LLM 生成完整 two-speaker transcript
   - 訓練場景與評估用的 Service-Duplex-Bench 不重疊

2. **Question-answering assistant scenarios**
   - 合成兩輪 QA dialogs
   - 使用固定角色，例如 “wise and friendly teacher”

### Voice data
- 使用 **26,296** 個 single-speaker voice samples 來做 synthetic dialog speech 與 voice prompt
- 來源包含 VoxCeleb、Libriheavy、LibriTTS、CommonAccent、Fisher
- 保留 **2,630** 個 voice samples 做 speaker similarity evaluation

### Speech generation
- service dialogs 用 **Dia** 生成 multi-speaker speech，較能保留 timing、interruptions、room tone
- QA dialogs 用 **Chatterbox TTS**
- release checkpoint 額外加入 **7,303** 句 Fisher English 實際對話，總共 **1,217 hours**，用來改善 backchannel、expression、emotion

### Training setup
- 以 **Moshi** 權重初始化
- 再用 hybrid system prompt fine-tune
- 總訓練資料：
  - **1,840 hours** customer service dialogs / **105,410 dialogs**
  - **410 hours** QA dialogs / **39,322 dialogs**
- optimizer: **Adam**
- learning rate：
  - depth transformer: **4e-6**
  - temporal transformer: **2e-6**
- training：
  - **24,576 steps**
  - batch size **32**
  - max sequence length **2048 tokens**
  - 約 **163.84 seconds**
- 訓練時間：約 **6 小時 / 8xA100 GPUs**

## 主要結果
### 主要結論
PersonaPlex 在幾個面向都優於 baseline：

- **role adherence**
- **speaker similarity**
- **dialog naturalness**
- 保留 full-duplex 的 responsiveness 與 turn-taking 能力

### Benchmark
作者評估在：

- **Full-Duplex-Bench**
- 自建的 **Service-Duplex-Bench**

### 重要觀察
- 在 **Full-Duplex-Bench** 上，PersonaPlex 有很強的 human-like interactivity 表現
- 在 **Service-Duplex-Bench** 上，PersonaPlex 在 role adherence 和 instruction following 上表現突出，只輸給 **Gemini Live**
- 人評 **DMOS** 顯示自然度提升
- 用 **WavLM-TDNN** 算 speaker similarity 時，PersonaPlex 也持續高於其他 baseline，表示 voice control 有效

### Dataset scale
作者也觀察到：
- 加入更多 synthetic data 會明顯提升 voice cloning 與 role adherence
- role adherence 隨資料量增加而持續改善

## Project relevance
- **project-full-duplex-data**: 高相關
- **project-tts-data-pipeline**: 低相關

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**建議細讀。**  
如果你關心 full-duplex speech model 如何同時做 **role conditioning** 與 **voice cloning**，這篇很值得看；它不只是提出一個新 benchmark，還把 conditioning 設計成可直接塞進現有 duplex 架構的 hybrid prompt，對實作與資料合成都很有參考價值。

## 可能的弱點 / open questions
- **大量依賴 synthetic data**：雖然規模大，但真實對話多樣性與 domain shift 仍可能有限。
- **role control 的泛化性**：Service-Duplex-Bench 主要是 customer service 類型，對其他複雜社交角色未必同樣有效。
- **voice cloning 與 naturalness 的 trade-off**：更強的 speaker similarity 不一定代表更自然或更穩定的 long-horizon conversation。
- **評估範圍偏窄**：重點在 role adherence、speaker similarity、DMOS，對 factuality、safety、long-context consistency 較少著墨。
- **real-world deployment 問題**：作者提到 future work 才會處理 post-training alignment 與 external tools，表示目前仍未完整解決可部署性。

## Tags
full-duplex, speech-llm, role conditioning, voice cloning, hybrid prompt, conversational speech model, customer service, synthetic data

## Concepts
- full-duplex speech-to-speech
- duplex multimodal architecture
- hybrid system prompt
- role conditioning
- zero-shot voice cloning
- speaker similarity
- dialog naturalness
- customer service scenario generation
- Service-Duplex-Bench
- DMOS
- WavLM-TDNN
- synthetic dialog data
- turn-taking

## Citation
```bibtex
@article{paper2026personaplexvoiceandrolecontrol,
  title={PersonaPlex: Voice and Role Control for Full Duplex Conversational Speech Models},
  author={},
  journal={arXiv preprint},
  year={2026},
  eprint={2602.06053},
  archivePrefix={arXiv}
}
```
