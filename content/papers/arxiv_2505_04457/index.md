---
paper_key: arxiv_2505_04457
canonical_id: "arxiv:2505.04457"
title: "Miipher-2: A Universal Speech Restoration Model for Million-Hour Scale Data Restoration"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2505.04457"
pdf_url: "https://arxiv.org/pdf/2505.04457"
status: read
rating: 5
tags:
  - speech-restoration
  - speech-data
  - multilingual-speech
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, bibliography, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2505.04457)
- [PDF](https://arxiv.org/pdf/2505.04457)
- [arXiv source](https://arxiv.org/src/2505.04457)
- [Demo / audio samples](https://google.github.io/df-conformer/miipher2)

## 一句話總結
**Miipher-2** 是 Miipher 的 multilingual、conditioning-free、million-hour scale speech restoration 版本：它用 frozen USM + parallel adapters + memory-efficient WaveFit，把 noisy speech 直接轉成較乾淨的 speech，目標是讓大規模 web speech cleaning 變成實際可跑的 TTS / speech generative model data pipeline。

## 這篇在解決什麼問題
Miipher 2023 證明 speech restoration 可以把 Web speech 轉成可用 TTS training data，但它有三個 scale-up 問題：

- **unknown languages**：低資源語言沒有足夠 studio-quality paired data 來訓練專用 SR model。
- **conditioning dependency**：Miipher-1 需要 transcript / speaker ID 類 conditioning；million-hour scale data 很難手動標，ASR 也可能不可靠。
- **computational efficiency**：如果要清理 million-hour scale speech，model 必須在 consumer-grade accelerators 上高吞吐運行。

Miipher-2 的核心目標是：**直接輸入 noisy waveform，不依賴 transcript 或 speaker ID，仍能在多語言上做高品質 restoration，且足夠快到可以清理 million-hour scale corpus。**

## 核心方法
Miipher-2 仍是 parametric re-synthesis speech restoration framework：先預測 clean acoustic representation，再用 neural vocoder resynthesize waveform。但它把 Miipher-1 的 conditioning-heavy 設計改成三個關鍵元件：

1. **Frozen Universal Speech Model (USM) feature extractor**
   使用 2B-parameter USM，該模型在 12 million hours YouTube audio、300+ languages 上 pre-trained。作者選 USM 第 13 layer 作為 feature，理由是 deeper SSL layers 可能丟失 fine-grained acoustic information，而中間層比較適合 restoration。

2. **Parallel adapters (PA) as feature cleaner**
   Miipher-1 的 Conformer cleaner 約 100M parameters；Miipher-2 的 PA 只有 20M trainable parameters，且只更新 USM 約 3% 左右參數。PA 被接到 USM layer 的 feed-forward path，用來從 noisy waveform 對應的 USM features 預測 clean waveform 對應的 USM features。相比 full USM fine-tuning，PA 收斂更快、記憶體和計算更省。

3. **Memory-efficient WaveFit**
   WaveFit 把 predicted clean USM feature 轉成 waveform。作者改掉 memory-heavy transposed convolution upsampling，改用 time-axis repeat 的 feature pre-upsampler，並調整 UBlock / FiLM 設計來降低 TPU memory pressure。

一個重要觀察是：USM 使用 BEST-RQ-style fixed-random quantizer，可能比 contrastive codebook 更保留 speaker/acoustic details，因此 Miipher-2 可以拿掉 Miipher-1 的 text conditioning 和 speaker conditioning。

## Training / Data
Miipher-2 和 Miipher-USM 都使用 simulated noisy-clean paired data：

- clean data：**3,195 hours** speech，1,642 speakers，44 languages / 54 locales。
- noise：內部收集的 cafe、kitchen、automobile 等環境聲。
- noisy mix：SNR 5 dB 到 30 dB，並加入 reverberation 和 codec artifacts。
- PA training：800k steps。
- WaveFit pre-training：200k steps，從 clean USM features 預測 clean waveforms。
- WaveFit fine-tuning：675k steps，從 noisy input 經 PA 預測的 clean features 合成 waveform。
- batch size：512。

作者也訓練 **Miipher-2-P**，使用 Miipher-2 cleaned public multilingual datasets，包括 CoVoST1、CVSS、MLS、FLEURS，用來測試「用 SR-cleaned public data 再訓練 SR model」是否可行。

## 主要結果
### Efficiency
在 TPU v4i 8GB device memory 上處理 30 秒 16 kHz speech：

- Miipher-USM batch 1 memory：5612.94 MB，RTF 0.0565；batch 2 以上 OOM。
- Miipher-2 batch 1 memory：2694.98 MB，RTF 0.0555。
- Miipher-2 batch 8 memory：6635.06 MB，RTF **0.0078**。

作者估計，RTF 0.0078 可讓 **100 個 TPU v4i 約 3 天清理 1 million hours speech**。這是本篇最關鍵的工程結果。

### English / LibriTTS restoration
在 LibriTTS test-other 500 samples 上：

- Miipher-2 DNSMOS **2.87**，高於 LibriTTS 原始 2.68、Miipher-1 2.71、Miipher-USM 2.85。
- Miipher-2 WER **0.149**，與 Miipher-1 0.150 幾乎相同。
- Miipher-2 SPK **0.744**，高於 Miipher-1 0.585，表示 USM feature 可能保留更多 speaker/acoustic details。
- Human MOS：Miipher-2 **3.46**，Miipher-1 **3.26**，LibriTTS 原始 **2.81**。

### Multilingual / unknown language
在 MLS known languages 與 FLEURS unknown languages 上，Miipher-2 普遍提升 DNSMOS 和 SQuId，WER 通常只小幅變化，SPK 約落在 0.6-0.8。作者指出部分低資源語言 WER 偏高主要受 multilingual ASR evaluator 本身限制影響，而不是 restoration 明顯破壞內容。

### Dataset distillation
Miipher-2-P 用 Miipher-2 cleaned public datasets 訓練，效果接近使用 internal studio-quality paired data 的 Miipher-2。這暗示 speech restoration model 可能可以透過 cleaned public data 做自我擴張，對低資源語言尤其有價值。

## Project relevance
**project-tts-data-pipeline：高度相關。**

Miipher-2 提供一個很實用的 scaling recipe：不靠 transcript、speaker ID 或人工標註，先用 multilingual SSL model 抽 feature，再用 adapter + vocoder restore waveform。對你的 English TTS pipeline 來說，它可以當成「大規模清理 noisy corpus」的設計上限參考：

- 用 restoration 擴大可用資料，而不只是 filtering。
- 用 DNSMOS/SQuId/WER/SPK 同時檢查 quality、content fidelity、speaker preservation。
- 用 RTF 和 memory 估算 pipeline 成本。
- 用 cleaned public data 訓練下一代 cleaner，形成 dataset distillation loop。

**project-full-duplex-data：中度相關。**

如果要把真實 full-duplex conversation audio 轉成可訓練 dual-channel data，Miipher-2 類 universal restoration 很有吸引力，因為它不需要 transcript conditioning。但要小心：這篇沒有測 overlap speech、backchannel、breath、laughs、hesitation 或 speaker change 是否會被 restoration 過度平滑。對 full-duplex data，不能只看 DNSMOS；還要評估 event preservation 和 speaker separation consistency。

## Related papers in my pool
- **Miipher**：Miipher-2 的前作，使用 w2v-BERT + PnG-BERT + speaker embedding，明確展示 restored Common Voice / LibriVox 可以訓練 TTS。
- **WhisperD / Parakeet note**：Miipher-2 是 conditioning-free；若搭配 WhisperD transcript，可進一步檢查 restoration 是否保留 event tags 對應的音訊事件。
- **Echo-TTS**：Echo-TTS / WhisperD-style prompt 是 downstream TTS format；Miipher-2 是前處理清理器。
- **Full-Duplex-Bench-v3**：FDB-v3 的 disfluency labels 可作為測試 Miipher-2 是否保留 hesitation/self-correction 的 benchmark idea。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。目前以 arXiv preprint 記錄。

## 我該不該細讀
**應該細讀。**

這篇對 TTS data pipeline 的價值很高，尤其是你想把大量 noisy English speech 清成 TTS training data 時。Miipher 2023 告訴你 restoration 可以讓 public speech 訓練 TTS；Miipher-2 告訴你如何把這件事 scale 到 multilingual / million-hour 級別。

最值得細讀：

- USM feature layer selection 的理由
- PA vs full USM fine-tuning vs Miipher-1 Conformer cleaner 的 tradeoff
- WaveFit memory optimization
- RTF / memory table
- Miipher-2-P dataset distillation 實驗

## 可能的弱點 / open questions
- Paper 明確說 code 和 checkpoints 不會釋出，理由是 potential misuse risk；因此直接復現成本高。
- 訓練資料含 internal studio-quality multilingual data 和 internal noise snippets，公開可複現性有限。
- Restoration quality 主要用 MOS/DNSMOS/SQuId/WER/SPK；沒有測 emotional prosody、nonverbal events、overlap speech、speaker turn boundary。
- Conditioning-free 是 scale 優勢，但也可能讓 transcript-level correction/control 更難，例如要保留特定 disfluency 或 event。
- Million-hour estimate 基於 zero/controlled inference benchmark；實際 pipeline 還會有 I/O、chunking、resampling、QC、metadata indexing 成本。

## Tags
- speech-restoration
- multilingual-speech
- speech-data
- data-cleaning
- USM
- parallel-adapters
- WaveFit
- project-tts-data-pipeline

## Concepts
- universal speech restoration
- conditioning-free inference
- Universal Speech Model
- BEST-RQ
- parallel adapters
- memory-efficient vocoder
- WaveFit
- real-time factor
- dataset distillation
- multilingual TTS data cleaning

## Citation
```bibtex
@misc{karita2025miipher2auniversalspeechrestor,
  title={Miipher-2: A Universal Speech Restoration Model for Million-Hour Scale Data Restoration},
  author={Shigeki Karita and Yuma Koizumi and Heiga Zen and Haruko Ishikawa and Robin Scheibler and Michiel Bacchiani},
  year={2025},
  eprint={2505.04457},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2505.04457}
}
```
