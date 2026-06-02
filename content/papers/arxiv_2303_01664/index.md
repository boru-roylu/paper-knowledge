---
paper_key: arxiv_2303_01664
canonical_id: "arxiv:2303.01664"
title: "Miipher: A Robust Speech Restoration Model Integrating Self-Supervised Speech and Text Representations"
year: 2023
venue: "IEEE WASPAA 2023 / arXiv"
url: "https://arxiv.org/abs/2303.01664"
pdf_url: "https://arxiv.org/pdf/2303.01664"
status: read
rating: 5
tags:
  - speech-restoration
  - tts
  - asr
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, bibliography, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2303.01664)
- [PDF](https://arxiv.org/pdf/2303.01664)
- [arXiv source](https://arxiv.org/src/2303.01664)
- [Demo / audio samples](https://google.github.io/df-conformer/miipher/)

## 一句話總結
**Miipher** 把 noisy / in-the-wild speech 透過 speech restoration 轉成接近 studio-quality 的語音，目標不是只做 denoising，而是讓 Common Voice、LibriVox 這類原本不適合 TTS 的資料也能拿來訓練高品質 TTS。

## 這篇在解決什麼問題
TTS training data 的瓶頸不只是資料量，而是錄音品質。Web speech / crowdsourced speech 很多，但它們通常有 noise、reverberation、codec artifacts、phoneme deletion、speaker inconsistency 等問題；這些資料對 ASR 還能用，對 TTS 則會直接污染 acoustic target，導致 vocoder 或 acoustic model 學到噪音和失真。

作者的問題設定很實際：**能不能先把 public speech corpus restore 成 studio-quality，再把它當成 TTS training data？** 如果可行，就可以把大量非 TTS 專用資料轉成可用的 speech generation corpus。

## 核心方法
Miipher 是 parametric re-synthesis speech restoration model，流程分成三段：

1. **SSL speech feature extraction**
   從 degraded input waveform 抽取 w2v-BERT feature。作者不用 log-mel spectrogram 當主要輸入，因為 w2v-BERT 在 degraded speech 上預訓練，較能保留語音內容並對 noise/reverb/codecs robust。

2. **Text + speaker conditioning**
   透過 transcript 抽取 PnG-BERT linguistic representation，幫助 restoration 保留文字內容；同時抽 speaker embedding，避免 SSL feature 丟失 speaker identity。

3. **Feature cleaner + WaveFit vocoder**
   DF-Conformer-based feature cleaner 預測 clean w2v-BERT feature，然後用改造過的 WaveFit vocoder 從 cleaned feature 合成 24 kHz waveform。WaveFit 需要處理 w2v-BERT frame rate 和 waveform/mel frame rate 不一致的問題，因此有 upsampling 設計。

這篇最值得注意的不是單純「speech enhancement」，而是它把 restoration model 的目標對準 **downstream TTS trainability**：restore 後的資料必須保留 text content、speaker identity 和自然音質，否則 TTS 仍然學不起來。

## Training / Data
Miipher 的 restoration model 訓練在 proprietary noisy-clean paired data 上：

- 目標 clean speech：670 hours studio-recorded English，涵蓋 Australia、UK、India、Nigeria、US English，24 kHz sampling rate。
- paired training data：2,680 hours，由 clean speech 混 noise/reverb/codec artifacts 形成。
- noise 來源包含 TAU Urban Audio-Visual Scenes 2021、內部收集的 cafe/kitchen/car 類環境噪音，以及 music/noise sources。
- SNR 範圍是 5 dB 到 30 dB。
- codec artifacts 隨機套用 MP3、Vorbis、A-law、AMR-WB、OPUS。

模型元件：

- w2v-BERT XL，1024-dim feature，取第 8 layer Conformer output。
- PnG-BERT，512-dim text representation，預訓練於 Wikipedia-derived 131M English sentences。
- WaveFit-5 neural vocoder。

TTS downstream 實驗用了兩個 public corpus：

- **Common Voice 5.1**：約 1,500 hours，過濾小於 2 秒或大於 15 秒的片段後剩 685 hours speech；因不允許 speaker identification，所以訓練 single-speaker TTS。
- **LibriVox**：收集超 25,000 hours，對齊文本並切成句級片段，過濾小於 2 秒或大於 15 秒的片段後得到 13,270 hours speech、約 4,000 speakers，用於 multi-speaker TTS。

## 主要結果
在合成 degraded test set 上，Miipher 的 full model 最好：

- Clean speech MOS：**4.69**
- Noisy speech MOS：**3.28**
- Miipher full w2v-BERT + transcript + speaker conditioning MOS：**4.54**，只比 .15 分低於 clean speech。
0.15 分差。
- WER：Miipher full **13.5**，clean speech **13.7**，noisy speech **15.1**，代表 restoration 沒有犧牲 content fidelity。
- 移除 transcript conditioning 會讓 WER 變差到 **16.4**，顯示 PnG-BERT 對 text preservation 很關鍵。
- 移除 speaker embedding 會讓 SPK 降低，顯示 speaker conditioning 對 speaker identity 保留很重要。

TTS downstream 結果更重要：

- 用 restored LibriVox 訓練 multi-speaker TTS，四個 speaker MOS 分別為 **4.38 / 4.15 / 4.11 / 4.05**，接近用 restored LJSpeech 訓練的 TTS MOS **4.36**。
- 用 restored Common Voice 訓練 single-speaker TTS 得到 MOS **3.63**；原始 Common Voice 因噪音導致同樣 WaveRNN vocoder training 無法收斂。

這代表 Miipher 不只是讓音訊聽起來更乾淨，而是能把 public/non-TTS speech 轉成可訓練 TTS 的 acoustic target。

## Project relevance
**project-tts-data-pipeline：高度相關。**

這篇直接回答你的核心問題之一：如何把 noisy web speech 變成可用 TTS training data。它提供一個 pipeline pattern：

- 先做 speech restoration，而不是只用 filtering 丟掉 noisy samples。
- 用 ASR/WER 確認 content fidelity。
- 用 speaker similarity 確認 speaker identity 沒被 vocoder 洗掉。
- 最後用 downstream TTS MOS 驗證資料真的能訓練。

這對你的資料管線很有價值，因為很多 TTS data cleaning 方法只做到 VAD、WER filtering、noise score filtering；Miipher 顯示「restore + downstream trainability evaluation」可能比純 filtering 更能擴大可用資料量。

**project-full-duplex-data：間接相關。**

它不是 full-duplex / multi-speaker dialogue paper，但 restoration 能成為前處理：如果要從真實對話音訊製作 dual-channel / multi-speaker training data，需要先判斷 restoration 是否會破壞 overlap、backchannel、speaker identity 或 nonverbal event。Miipher 的 speaker/content fidelity metrics 可以借用，但需要額外測 overlap preservation。

## Related papers in my pool
- **Miipher-2**：Miipher 的 multilingual、conditioning-free、million-hour scale 版本，目標變成 million-hour scale dataset cleaning。
- **WhisperD / Parakeet note**：Miipher 依賴 transcript conditioning；WhisperD-style speaker/event transcript 可作為更適合 dialogue/TTS 的 conditioning format。
- **Echo-TTS**：Echo-TTS 使用 speaker reference 和 WhisperD-style prompt；Miipher 可作為資料清理端，Echo-TTS 類模型是 downstream consumer。
- **Full-Duplex-Bench-v3**：FDB-v3 評估 disfluency/tool-use；若要建立 full-duplex speech data，Miipher 類 restoration 需要被測試是否保留 hesitation、pause、self-correction。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。此文獻可見於 arXiv，且 bibliography / proceedings 資訊顯示與 WASPAA 2023 相關。

## 我該不該細讀
**應該細讀，尤其是做 TTS data pipeline 時。**

最值得看的部分是：

- w2v-BERT vs log-mel 的 ablation
- transcript conditioning 對 WER/content fidelity 的影響
- speaker embedding 對 speaker identity 的影響
- Common Voice / LibriVox restoration 後訓練 TTS 的 downstream MOS

如果你要做 English TTS cleaning pipeline，這篇應該放在「restore noisy corpus」方法的核心參考。

## 可能的弱點 / open questions
- Restoration model 訓練用 proprietary paired data，開源可複現性有限。
- 需要 transcript conditioning 和 speaker embedding，對 million-hour-scale pipeline 會增加 ASR / speaker ID dependency。
- Common Voice 因不能識別 speaker，只能做 single-speaker TTS 實驗；這不一定適合 expressive multi-speaker TTS。
- 主要是 English；multilingual / low-resource extension 是 Miipher-2 才處理。
- 沒有明確評估 overlap speech、backchannel、laughs、breath、hesitation 等 dialogue event 是否被 restoration 保留或抹除。

## Tags
- speech-restoration
- tts
- speech-data
- data-cleaning
- w2v-BERT
- PnG-BERT
- WaveFit
- project-tts-data-pipeline

## Concepts
- speech restoration
- parametric re-synthesis
- w2v-BERT feature
- PnG-BERT conditioning
- speaker embedding
- WaveFit vocoder
- content fidelity
- speaker similarity
- TTS data cleaning
- LibriVox restoration

## Citation
```bibtex
@misc{koizumi2023miipherarobustspeechrestoratio,
  title={Miipher: A Robust Speech Restoration Model Integrating Self-Supervised Speech and Text Representations},
  author={Yuma Koizumi and Heiga Zen and Shigeki Karita and Yifan Ding and Kohei Yatabe and Nobuyuki Morioka and Yu Zhang and Wei Han and Ankur Bapna and Michiel Bacchiani},
  year={2023},
  eprint={2303.01664},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2303.01664}
}
```
