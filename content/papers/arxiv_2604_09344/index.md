---
paper_key: arxiv_2604_09344
canonical_id: "arxiv:2604.09344"
title: "DialogueSidon: Recovering Full-Duplex Dialogue Tracks from In-the-Wild Dialogue Audio"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2604.09344"
pdf_url: "https://arxiv.org/pdf/2604.09344"
status: read
rating: 4
tags:
  - speech-llm
  - speech-data
  - restoration
  - separation
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-30
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2604.09344)
- [PDF](https://arxiv.org/pdf/2604.09344)

## 一句話總結
DialogueSidon 把 noisy monaural two-speaker dialogue 轉回可用的 speaker-wise full-duplex tracks，透過 **SSL-VAE + diffusion-based latent predictor** 同時做 speech restoration 與 speaker separation。

## 這篇在解決什麼問題
這篇在解決一個很實際的資料瓶頸：**in-the-wild dialogue audio 通常只有 monaural mixture，缺少乾淨的 full-duplex dialogue tracks**，但這類 speaker-wise 兩軌資料對 spoken dialogue research、backchannel/overlap modeling、turn-taking 與 full-duplex model 訓練都很重要。

作者指出直接用這些網路音訊有幾個問題：
- 同時存在 **noise / reverberation / clipping / compression / packet loss**
- 只有 mixed recording，沒有 isolated speaker tracks
- 純 **speech separation** 對 spontaneous conversational speech 泛化不足
- 純 **speech restoration** 會把 overlap 當成 corruption，可能傷害 conversational content
- 簡單 cascade（先 restoration 再 separation 或反過來）都不穩定

所以目標不是做一般 enhancement，而是把 degraded dialogue mixture 變成可用的 **clean speaker-wise full-duplex data**。

## 核心方法
核心是把問題拆成兩階段，但在 latent space 裡統一建模：

### 1) SSL-VAE
先用 frozen SSL feature 當作 speech representation，再用 VAE 壓到較低維 latent space：
- SSL feature extractor：**w2v-BERT 2.0**
- 使用第 **8th layer** hidden feature 作為 clean speech representation
- VAE encoder 把高維 SSL feature 壓成 compact latent
- decoder 用 **Descript Audio Codec** decoder / discriminator reconstruct waveform

這個 latent space 的目的，是讓後面的生成模型不用直接在超高維 SSL feature 上 diffusion，降低計算成本。

### 2) Diffusion-based latent predictor
第二階段用 **diffusion model** 從 degraded monaural mixture 預測兩位 speaker 各自的 latent representation：
- 輸入是 degraded mixture
- conditioning representation 來自 w2v-BERT 2.0 的 **13th layer feature**
- 用 **LoRA** 微調 conditioning encoder
- 預測 speaker-wise latents：`z1, z2`
- 再交給 SSL-VAE decoder 還原成兩條 waveform

作者的關鍵設計是：
- 不直接 regression latent，因為會 **oversmooth**
- 用 diffusion 處理 mixture 中的不確定性
- 在 latent space 同時保留 restoration 與 separation 能力

## Training / Data
訓練採 **two-stage**：

### Stage 1: SSL-VAE training
- 用 clean dialogue tracks 訓練 VAE
- 目標是建立 compact、speech-relevant latent space
- loss 包含：
  - reconstruction loss
  - adversarial loss
  - KL regularization

### Stage 2: Latent predictor training
- 用 degraded monaural two-speaker dialogue mixture 訓練 diffusion latent predictor
- 目標是從 mixture 恢復 speaker-wise latents

### Degradation pipeline
作者在訓練/實驗中用人工 degradation 模擬 in-the-wild 錄音劣化，包含：
- **reverberation**
- **background noise**
- **band limitation**
- **clipping**
- **MP3 codec compression**
- **packet loss**
- 最後把兩個 degraded tracks 混成 monaural mixture

### 評估資料
從表格可看出他們在以下類型資料上驗證：
- **English**：SWB evaluation set
- **Multilingual**：CallFriend corpus，涵蓋 5 種語言
- **In-the-wild**：OpenDialog

## 主要結果
整體結果顯示 DialogueSidon 在 content preservation、separation quality、subjective quality 上都明顯優於 baseline。

### English / SWB
- `WER` 從 **GENESES 33.54%** 降到 **DialogueSidon 14.39%**
- `MOS` 也提升到 **3.895 ± 0.948**，高於 Sidon 與 GENESES
- separation 指標如 `Spk. Sim.` 與 `VAD Acc.` 也達到很強水準

### Multilingual / CallFriend
在 German、French、Japanese、Spanish、Mandarin 上，DialogueSidon 大多把 `p-CER` 壓得比 GENESES 明顯更低，且 separation metrics 也穩定較好。
一個代表性例子：
- German `p-CER`: **14.7%** vs GENESES **52.3%**

### In-the-wild / OpenDialog
- `WER`：**13.86%**，遠低於 GENESES **43.79%**
- `MOS`：**3.708 ± 1.006**，明顯高於 GENESES **3.131 ± 1.060**
- 作者也強調推論速度約 **60× faster inference** 相比 baseline

### 總結
這篇最大的訊號是：**latent-space joint restoration + separation** 比單純 restoration 或現成 unified baseline 更適合從網路對話音訊重建 full-duplex dialogue tracks。

## Project relevance
- **project-full-duplex-data**：高度相關
- **project-tts-data-pipeline**：間接相關

## Related papers in my pool
與已讀 paper **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems (2025)** 有明顯關聯，但切點不同：
- 那篇重點是 **full-duplex dialogue control / turn-taking policy**
- 這篇重點是 **full-duplex data recovery**：把 monaural dialogue audio 還原成 speaker-wise tracks

兩者共同點：
- 都在處理 **full-duplex spoken dialogue systems**
- 都關心 overlap / barge-in / turn-taking 的可用資料與系統能力
- 都屬於 speech-data / dialogue 交叉方向

差異與互補：
- 前者偏 **dialogue management**
- 這篇偏 **data construction / recovery**
- 如果要做 full-duplex model/data pipeline，這篇可作為資料前處理或資料擴增的基礎

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**建議細讀。**

如果你的重點是：
- 建 full-duplex dialogue data
- 從 noisy internet audio 產生可訓練的 speaker-wise tracks
- 做 overlap / backchannel / turn-taking 資料工程
- 設計 speech restoration + separation 的 joint model

那這篇很值得看，因為它不只是概念，而是有完整 architecture、training recipe、degradation pipeline 與多種資料集結果。  
如果你只關心 TTS cleaning pipeline，它比較不是直接的 TTS cleaning paper，但 latent restoration / separation 的想法仍可借鑑。

## 可能的弱點 / open questions
- 目前主要是 **two-speaker** 設定，對 **more speakers** 的擴展性還未知
- 依賴 SSL feature 與 VAE latent design，對不同 backbone 的泛化性需要確認
- 訓練時使用的 degradation pipeline 是合成的，和真實網路音訊的分佈差距可能仍存在
- 對極端 overlap、快速 interleaving speech、long conversational context 的表現未必穩定
- 雖然結果很好，但是否能直接支援大規模自動化 data pipeline，還需要看實作成本與失敗案例
- 這篇主要重建 waveform 與 speaker-wise tracks，沒有直接討論 transcript quality 或 alignment quality

## Tags
speech-data, full-duplex, dialogue-recovery, speech-restoration, speech-separation, latent-diffusion, SSL, VAE, in-the-wild-audio

## Concepts
- **full-duplex dialogue audio**
- **monaural mixture**
- **speech separation**
- **speech restoration**
- **SSL feature**
- **SSL-VAE**
- **latent diffusion**
- **diffusion-based latent predictor**
- **LoRA**
- **content preservation**
- **speaker-wise track recovery**
- **overlap handling**
- **turn-taking data construction**

## Citation
```bibtex
@article{nakata2026dialoguesidonrecoveringfulldup,
  title={DialogueSidon: Recovering Full-Duplex Dialogue Tracks from In-the-Wild Dialogue Audio},
  author={Nakata, Wataru and Saito, Yuki and Yamauchi, Kazuki and Tsunoo, Emiru and Saruwatari, Hiroshi},
  year={2026},
  journal={arXiv preprint},
  eprint={2604.09344}
}
```
