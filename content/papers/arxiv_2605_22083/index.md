---
paper_key: arxiv_2605_22083
canonical_id: "arxiv:2605.22083"
title: "RobustSpeechFlow: Learning Robust Text-to-Speech Trajectories via Augmentation-based Contrastive Flow Matching"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.22083"
pdf_url: "https://arxiv.org/pdf/2605.22083"
status: read
rating: 4
tags:
  - speech-llm
  - tts
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.22083)
- [PDF](https://arxiv.org/pdf/2605.22083)

## 一句話總結
RobustSpeechFlow 透過在 contrastive flow matching 中加入 repeat / skip 的 latent augmentation hard negatives，提升 zero-shot TTS 的 alignment robustness 與 content fidelity，尤其能減少 skip / repeat 語音錯誤。

## 這篇在解決什麼問題
這篇在解決 **flow-matching TTS 容易出現 content fidelity 問題**，特別是：

- **repeat errors**：重複字詞、片語或短句
- **skip errors**：漏念字詞、片語或局部內容

作者指出，現代 zero-shot TTS 雖然在 naturalness 和 speaker similarity 上表現很好，但在 alignment 不穩時，內容正確性仍是實際部署中的主要風險。這類錯誤在：

- model capacity 較小時
- inference NFE 較低時
- 長文本或較複雜 prosody 情境下

會更明顯。

所以這篇的目標是：**在不依賴 external aligner、ASR、或 preference data 的前提下，直接把常見失敗模式納入 training signal，讓模型更懂得避開 skip/repeat。**

## 核心方法
核心方法是把 **Contrastive Flow Matching** 擴充成 **augmentation-based contrastive flow matching**。

### 1) 基本 flow matching
模型在 latent speech space 上做 conditional flow matching。給定 speech latent `x`、conditioning `c`（text + optional speaker prompt），用線性 path 把 noise `ε` 轉到 `x`，學習 vector field `u_θ`。

### 2) ContrastiveFM baseline
原始的 contrastive version 會用 random batch negatives，讓模型遠離不對的 target latent。

問題是：**random negatives 太不貼近真實 TTS 失敗型態**，對 alignment error 的訓練訊號不夠直接。

### 3) RobustSpeechFlow 的關鍵：failure-mode negatives
作者改成從 **ground-truth latent** 出發，做兩種 length-preserving corruption：

- **repeat augmentation**
  - 把某段 latent 複製到另一個位置，模擬重複
  - 同時也會造成原位置內容被覆蓋，因此自然帶有 skip-like effect

- **skip augmentation**
  - 把後續 latent 向前 shift，並在尾端用 silence latent 補齊
  - 模擬局部漏念，但保持整段長度不變

這些 negatives 的特點是：

- 與原句 speaker identity 和 acoustic texture 很接近
- 但局部 text-speech correspondence 被破壞
- 比 random negatives 更像真實 failure mode
- 不需要 external aligner 或額外 model

### 4) Objective
總 loss 是：

- positive flow matching loss
- 減去 random negative contrastive term
- 再減去 augmentation-based hard negative term

也就是把模型訓練成：**不只要生成對的 speech latent，還要明確避開 skip/repeat 這些錯誤軌跡。**

## Training / Data
### Training data
- 使用約 **10k hours**
- 約 **5M utterances**
- 每種語言約 **80k speakers**
- 語言：**English** 與 **Korean**
- transcription 混合：
  - human-annotated
  - ASR-generated

### Model / setup
- 將方法套用到 **SupertonicTTS**
- latent 來自 **Supertonic speech autoencoder**
- 比較三種 objective：
  1. **Baseline**：vanilla SupertonicTTS
  2. **ContrastiveFM**：random batch negatives
  3. **RobustSpeechFlow**：augmentation-based hard negatives

### 訓練細節
- audio resample 到 **44.1 kHz**
- 訓練 **500k steps**
- **8 NVIDIA H100 GPUs**
- optimizer: **AdamW**
  - lr = `5e-4`
  - `β=(0.9, 0.999)`
  - zero weight decay
- learning rate 每 200k steps 減半
- reference speech：同 speaker、3 到 10 秒隨機抽樣
- inference：
  - **Euler solver**
  - **classifier-free guidance weight = 3.0**
  - `NFE ∈ {12, 24}`

### Evaluation
- **Seed-TTS-eval**
- 自建 **ZERO500**
  - 50 個 reference voices / language
  - 每個 voice 配 10 個 prompts
  - 共 500 pairs / language
  - 英文與韓文
- 指標：
  - **Whisper large-v3** 轉寫
  - **CER / WER**
  - 只做輕度 normalization

## 主要結果
### Seed-TTS-eval
在 compact SupertonicTTS 設定下：

- **Baseline**：WER **1.44**
- **ContrastiveFM**：WER **1.41**
- **RobustSpeechFlow**：WER **1.38**

同時 **SIM 都是 0.60**，表示這個提升主要來自 alignment / intelligibility 改善，而不是 speaker similarity 改變。

作者也強調：這個結果是用 **0.06B parameters** 達成，而且在整個 benchmark 中拿到最低 WER。

### ZERO500
在更具挑戰性的 diverse benchmark 中，RobustSpeechFlow 整體更穩定，尤其在 low-NFE 下。

例子：
- **Korean, NFE=12**
  - CER 從 **0.93% → 0.57%**
  - WER 從 **8.46% → 7.59%**
- **English, NFE=24**
  - CER 最佳到 **0.35%**
  - WER 最佳到 **1.03%**

### 訓練穩定性
作者觀察到：
- RobustSpeechFlow 在 Korean 上的 CER 下降更穩定
- 英文上雖然 ContrastiveFM 前期有時不差，但 RobustSpeechFlow 後期更穩、最後表現更好
- 顯示 **failure-mode hard negatives** 對訓練後期的 alignment stability 特別有幫助

## Project relevance
- **project-tts-data-pipeline**：中度相關
- **project-full-duplex-data**：不相關

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

（僅有 PilotTTS、Google USM、Seed-TTS、LLM-Enhanced Dialogue Management 等 summary，但它們主題偏向 data pipeline、ASR、或 full-duplex dialogue management，和這篇的 **TTS alignment robustness / latent contrastive augmentation** 不屬於直接同題。）

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀，如果你在做 TTS 的 alignment robustness、low-NFE stability，或想找不靠 ASR / preference data 的訓練法。**

特別值得看如果你關心：
- flow matching / diffusion TTS 的 content fidelity
- skip / repeat errors
- hard negative design
- compact TTS deployment

如果你的重點是：
- TTS data cleaning pipeline
- speaker diarization / overlap detection
- full-duplex conversation generation

那這篇只有間接參考價值。

## 可能的弱點 / open questions
- **依賴 ASR metric 評估**：WER / CER 會受 recognition error 與 normalization 影響，未必完全反映 human-perceived quality。
- **speaker similarity 的 trade-off**：作者自己也提到在 public benchmark 上可能有些 speaker similarity 損失。
- **方法目前主要驗證在 compact model**：是否能穩定擴展到更大 flow-matching / hybrid autoregressive-diffusion 架構，還不確定。
- **negative augmentation taxonomy 還不夠完整**：目前只做 repeat / skip，未來可能需要涵蓋更多 realistic failure modes。
- **資料與 benchmark 範圍有限**：主要是 English / Korean，generalization 到更多語言與更複雜 prosody 還需驗證。
- **未報告 subjective evaluation**：缺少 MOS 或更完整的人評，難以確認這些 intelligibility gains 是否伴隨聽感提升。

## Tags
- text-to-speech
- zero-shot TTS
- flow matching
- contrastive learning
- alignment robustness
- latent augmentation
- skip error
- repeat error
- content fidelity
- low-NFE inference

## Concepts
- conditional flow matching
- contrastive flow matching (CFM)
- hard negatives
- latent speech sequence
- speaker prompt
- alignment robustness
- repeat augmentation
- skip augmentation
- length-preserving corruption
- Supertonic speech autoencoder
- WER
- CER
- NFE
- classifier-free guidance

## Citation
```bibtex
@article{yang2026robustspeechflowlearningrobust,
  title={RobustSpeechFlow: Learning Robust Text-to-Speech Trajectories via Augmentation-based Contrastive Flow Matching},
  author={Yang, Jinhyeok and Kim, Hyeongju and Yu, Yechan and Byun, Joon and Bous, Frederik and Lee, Juheon},
  journal={arXiv preprint},
  year={2026}
}
```
