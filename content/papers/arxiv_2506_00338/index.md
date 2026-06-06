---
paper_key: arxiv_2506_00338
canonical_id: "arxiv:2506.00338"
title: "OWSM v4: Improving Open Whisper-Style Speech Models via Data Scaling and Cleaning"
year: 2025
venue: "Interspeech camera-ready / arXiv preprint"
url: "https://arxiv.org/abs/2506.00338"
pdf_url: "https://arxiv.org/pdf/2506.00338"
status: read
rating: 8
tags:
  - speech-llm
  - asr
  - speech-data-cleaning
  - multilingual-asr
  - project-tts-data-pipeline
created: 2026-06-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`template.tex`) with emphasis on data cleaning.

## Links
- [Original URL](https://arxiv.org/abs/2506.00338)
- [arXiv abstract](https://arxiv.org/abs/2506.00338)
- [PDF](https://arxiv.org/pdf/2506.00338)
- [arXiv source](https://arxiv.org/src/2506.00338)
- [OWSM activity page](https://www.wavlab.org/activities/2024/owsm/)

## 一句話總結
**OWSM v4** 的重點不是提出新 ASR architecture，而是展示一條可公開復現的 **YODAS web-crawled speech data cleaning pipeline**：用 `CTC segmentation` 重對齊 audio/text、用 text/audio dual LID 過濾語言標錯、再用 language-relative `CTC confidence score` 過濾 misalignment，最後得到 166k hours、75 languages 的 cleaned YODAS，讓 fully-open OWSM 系列在 multilingual ASR / LID / long-form ASR 上明顯提升。

## 這篇在解決什麼問題
OWSM v1-v3 的價值是 fully open：data、code、weights、logs 都可公開研究。但它們的訓練資料規模和品質仍限制 performance。

作者想把 **YODAS** 加進 OWSM training。YODAS 有幾個優點：

- 370k hours、149 languages，規模大。
- audio files 以 Creative Commons license 直接公開，不只是原始網站 links。
- 有 unsegmented long-form recordings，適合 Whisper-style long-form training。
- speaking styles / acoustic environments 多樣。

問題是 raw YODAS 是 web-crawled data，不能直接拿來訓練：

- language label 可能錯。
- audio-text timestamps 可能錯位。
- transcript 和實際 speech 可能 mismatch。
- 有些 utterance 其實是 music / non-speech。
- 不清理就 fine-tune，模型會出現 repetition decoding，Common Voice WER 甚至超過 100%。

所以這篇的核心問題是：**怎樣用公開工具，在 academic-scale resources 下，把 wild web speech 變成可用的 multilingual ASR training data。**

## 核心方法
### Data cleaning pipeline overview
作者的 cleaning pipeline 有三步：

```text
raw YODAS long-form audio + timestamps
  -> CTC resegmentation / realignment
  -> text LID + spoken LID filtering
  -> CTC confidence score filtering
  -> cleaned YODAS: 166k hours, 75 languages
```

這三步各自對應一種資料問題：

- `CTC resegmentation`：修正 audio-text timestamp / segmentation 錯位。
- `LID-based filtering`：修正 language label mismatch。
- `CTC-score-based filtering`：移除 alignment quality 低的 utterance。

### 1) CTC resegmentation：先把長音訊切準
YODAS 提供 long-form recordings，每個 audio 有一串 text transcripts 和 start/end timestamps。但 timestamps 可能不準，因此作者先用 **CTC segmentation algorithm** 重對齊 audio 和 text。

使用的 alignment model 是公開的 **OWSM-CTC v3.2 fine-tuned 1B**。這點很重要：它不是用 proprietary ASR，也不是人工標註，而是用公開 ASR / CTC model 做 scalable alignment。

處理後：

- long-form audio 被切成最多 **30 seconds** 的 shorter utterances。
- 只包含 non-speech elements 的 utterances，例如 music，被移除。
- 產出約 **345k hours / 83 languages**。
- 每個 short utterance 會得到一個 **CTC confidence score**，後面用來判斷 audio-text alignment quality。

對 data cleaning 來說，這一步最像「把 web timestamp 轉成可信的 training segment」。若沒有這一步，後面的 ASR model 會學到錯位 transcript。

### 2) LID-based filtering：文字和音訊都要同意語言
作者觀察到 YODAS 裡有 incorrect language labels。為了處理這件事，他們同時跑兩種 LID：

- **text-based LID**：fastText language identification。
- **spoken LID**：SpeechBrain ECAPA-TDNN model，基於 VoxLingua107。

保留條件很嚴格：

```text
original language label
  == text LID prediction
  == spoken LID prediction
```

也就是原本 label、transcript 語言、audio 語言三者都一致，才保留。

這一步後資料從 345k hours / 83 languages 變成約 **284k hours / 75 languages**。它犧牲 coverage，但換來更可信的 language labels。後面 LID benchmark 也支持這件事：OWSM v4 medium 在 FLEURS LID 達到 **95.6%**，OWSM-CTC v4 達到 **93.6%**，作者把這解讀為 LID filtering 帶來高品質 language labels。

### 3) CTC-score-based filtering：用 alignment confidence 過濾 transcript mismatch
最後一步是用 CTC segmentation 產生的 confidence score 過濾 low-quality audio-text alignments。

關鍵設計是：**CTC score 是 language-dependent**。不同語言的 score distribution 不一定可直接用同一個絕對值 threshold。因此作者不是設固定分數，而是在每個 language 內做 ranking，用相對 quantile threshold：

```text
theta_CTC = lowest-score quantile threshold per language
```

更嚴格的是，作者以 long-form utterance 為單位過濾：

```text
如果某個 long-form utterance 裡任何 short utterance 落在該語言最低 theta_CTC quantile，
就丟掉整個 long-form utterance。
```

這樣做的直覺是：一段 long-form recording 只要局部嚴重 mismatch，就可能代表這段來源整體不可靠。

### 4) Threshold 怎麼選：用 small OWSM v3.1 做 data-quality proxy
作者不是拍腦袋選 threshold，而是做了 threshold sweep：

- 用 pre-trained **OWSM v3.1 small 367M**。
- 分別在不同 `theta_CTC` 的 cleaned YODAS 上 fine-tune。
- 評估 Common Voice short-form ASR 和 web presentation long-form ASR。

測試過：

- `theta_CTC = 0.00`：不做 CTC-score filtering，保留 284k hours。
- `theta_CTC = 0.10`：保留 166.4k hours。
- `theta_CTC = 0.15`：保留 118.5k hours。
- `theta_CTC = 0.20`：保留 84.8k hours。
- `theta_CTC = 0.30`：保留 43.0k hours。

最重要的觀察：

- `theta_CTC = 0.00` 時 Common Voice 表現極不穩，很多語言 WER 超過 **100%**，decoding 會卡在少數 token 重複。
- 只要 `theta_CTC > 0`，表現大幅改善，證明 raw YODAS 仍有大量 audio-text misalignment。
- 不同語言/測試集對 threshold 的最佳點不同；更嚴格不一定更好，因為會丟掉太多資料。
- 作者最後選 `theta_CTC = 0.10`，因為它在保留大部分資料和整體 performance 之間折衷最好。

最後 cleaned YODAS 是 **166k hours / 75 languages**。語言分布仍高度不平衡，English 最大；作者本篇沒有做 resampling。

## Training / Data
### Training data 組成
OWSM v4 不是只用 cleaned YODAS。它把 cleaned YODAS 與既有 OWSM v3.2 data 合併訓練：

- ASR data 總量約 **290k hours**。
- ST data 約 **30k hours**，沒有新增 ST data，沿用 v3.2。
- model coverage 仍是 **151 languages**。

作者訓練四個模型：

- OWSM v4 base：100M AED。
- OWSM v4 small：370M AED。
- OWSM v4 medium：1.02B AED。
- OWSM-CTC v4：1.01B CTC encoder-only。

架構基本沿用 OWSM v3.1 / OWSM-CTC，主要工程差異包括：

- Mel filterbanks 從 80 增加到 128，跟 Whisper-large-v3 對齊。
- speech features subsample 8x，time shift 80 ms。
- encoder 用 E-Branchformer。
- AED decoder 用 Transformer。
- 使用 FlashAttention-2。
- AdamW、batch size 320、訓練 700k steps，約 3 epochs。

### Openness
這篇很強調 fully-open：

- cleaned YODAS data 會公開。
- data-cleaning scripts 會公開。
- training code、pretrained weights、training logs 會透過 ESPnet / OWSM release。

這點對我們特別重要，因為多數 industrial ASR / speech foundation models 沒有公開 training data 和 cleaning recipe。

## 主要結果
### 1) Data cleaning threshold 直接影響模型是否崩壞
最有 data-centric 價值的是 threshold table。沒有 CTC-score filtering 時，Common Voice 很多語言 WER > 100%，代表模型可能學到錯位 transcript 後產生 repetition failure。

這是很強的訊號：**web speech data 的 alignment noise 不是小瑕疵，而是會直接讓 ASR fine-tuning 壞掉。**

### 2) LID filtering 對 multilingual LID 有明顯收益
FLEURS LID：

- OWSM v3.1 medium：75.6%
- OWSM v4 medium：**95.6%**
- OWSM-CTC v3.2：91.1%
- OWSM-CTC v4：**93.6%**
- Whisper-large-v3：58.9%（paper 註明 Whisper 只支援 FLEURS 子集合）
- MMS-lid-4017：93.3%

作者認為這支持 cleaned YODAS 的 language labels 品質更好。

### 3) Multilingual ASR 明顯提升
MLS 平均 WER：

- OWSM v3.1 base：28.8 -> OWSM v4 base：19.2
- OWSM v3.1 small：17.8 -> OWSM v4 small：11.8
- OWSM v3.1 medium：15.5 -> OWSM v4 medium：9.4
- OWSM-CTC v3.2：15.3 -> OWSM-CTC v4：10.7

OWSM v4 medium 平均 WER **9.4%**，略低於 Whisper-medium **9.7%**，但仍不及 Whisper-large-v3 **6.4%**。

### 4) FLEURS：OWSM-CTC v4 幾乎全面勝過舊版
作者報告 OWSM-CTC v4：

- outperform v3.1 in all **102 languages**。
- outperform v3.2 in **100 languages**。
- 在表中列出的 21 個低於 20% error rate 的語言裡，OWSM-CTC v4 有 13 個語言勝過 MMS-all。

### 5) English ASR / long-form ASR
Hugging Face Open ASR Leaderboard average WER：

- OWSM-CTC v3.1：8.12
- OWSM-CTC v3.2：8.24
- OWSM-CTC v4：**7.44**
- Whisper-large-v3：7.47
- Canary：6.48
- Parakeet-CTC：7.40

Long-form English ASR web presentation WER：

- OWSM v3.1 medium：5.7
- OWSM v4 medium：4.3
- OWSM v4 medium + beam 5：3.6
- OWSM-CTC v3.2：4.8
- OWSM-CTC v4：**3.3**
- Whisper-large-v3：3.4

這支持作者的主張：cleaned YODAS 對 long-form English ASR 特別有幫助。

### 6) Speech translation 沒被新增 ASR data 傷害
OWSM-CTC v4 沒新增 ST data，只沿用 v3.2 ST data。CoVoST-2 上 X-En BLEU 從 v3.2 的 25.4 提升到 **27.3**；En-X average 則和 v3.2 接近。這表示加入 cleaned ASR data 沒有明顯破壞 ST 能力。

## Data cleaning takeaways
這篇對我們最有價值的不是 OWSM v4 本身，而是 data cleaning recipe：

1. **先 align，再 filter。**  
   如果 timestamps 不準，直接做 ASR / transcript filtering 會把錯誤歸因搞混。先用 CTC segmentation 建立更可信的 utterance boundaries。

2. **language label 要 cross-modal check。**  
   只看 transcript LID 不夠，因為 transcript 可能錯；只看 audio LID 也不夠，因為 spoken LID 在低資源語言可能不穩。這篇要求 original label、text LID、spoken LID 三者一致，簡單但很實用。

3. **alignment score threshold 應該 language-relative。**  
   多語言資料不能輕易用單一 global threshold。用 per-language quantile 比較穩，因為不同語言、script、ASR 支援程度會改變 CTC score 分布。

4. **threshold 要用 downstream proxy 選。**  
   作者用小模型 fine-tune + Common Voice / long-form ASR 來選 `theta_CTC = 0.10`。這比單純看 retained hours 更合理。

5. **不清理會造成 repetition failure。**  
   `theta_CTC = 0.00` 時 WER > 100% 的現象對我們很重要：這表示 transcript mismatch 會讓模型學到 pathological decoding，不只是 performance 小幅下降。

6. **這是 ASR data cleaning，不是 TTS-ready cleaning。**  
   它處理 language label 和 audio-text alignment，但沒有處理 speaker consistency、prosody style、noise/reverb quality、overlap speech、emotion/event tags、text normalization for TTS。因此可當 TTS pipeline 的 transcript/alignment QA 子模組，但不能直接等同 TTS data cleaning 完整方案。

## Project relevance
**project-tts-data-pipeline：高度相關，但要補 TTS-specific filters。**

這篇提供了一個可公開復現的 multilingual speech-text data cleaning baseline。對 TTS data pipeline，最直接可借的是：

- 用 CTC segmentation 修正 transcript/audio boundaries。
- 用 ASR/CTC confidence 找出 alignment mismatch。
- 用 per-language threshold，避免英文-centric filter 傷害其他語言。
- 用 small downstream model 做 threshold selection，而不是只靠 heuristic。

但 TTS training 還需要額外檢查：

- speaker identity consistency。
- background noise / music / reverb。
- overlap speech / double talk。
- clipping、distortion、loudness。
- punctuation / capitalization / text normalization。
- nonverbal events 是否要保留成 tags。
- utterance 是否自然可合成，而不是 ASR-friendly 但 TTS-unfriendly。

**project-full-duplex-data：中度相關。**

它不是 full-duplex / dialogue paper，沒有處理 diarization、overlap disentanglement、backchannel preservation。但對我們的 `mono-channel dialogue -> dual-channel training data` pipeline，它可作為 transcript fidelity layer：

```text
mono dialogue audio
  -> diarization / overlap separation
  -> ASR hypotheses
  -> OWSM-style CTC alignment + confidence filtering
  -> speaker/channel-aware training records
```

尤其在 overlap 或 noisy segment 裡，我們可以用類似 `CTC confidence score` 當 QA signal，標記哪些 transcript span 不可信，不要直接餵給 dual-channel generator。

## Related papers in my pool
- [Google USM](/papers/arxiv_2303_01037/)：同樣是 multilingual ASR scaling，但 USM 強調 12M hours unlabeled pretraining；OWSM v4 強調 fully-open supervised ASR data cleaning recipe。
- [Mega-ASR](/papers/arxiv_2605_19833/)：Mega-ASR 用 acoustic simulation 改善 robust ASR；OWSM v4 用 real web-crawled YODAS cleaning 改善 multilingual ASR。兩者可互補：一個處理 acoustic robustness，一個處理 label/alignment quality。
- [Miipher-2](/papers/arxiv_2505_04457/)：Miipher-2 是 speech restoration for training data cleaning，偏 waveform quality；OWSM v4 是 speech-text alignment / language label cleaning。TTS pipeline 需要兩者結合。
- [Sommelier](/papers/arxiv_2603_25750/)：Sommelier 處理 multi-turn / full-duplex data，包括 diarization、overlap separation、ASR ensemble；OWSM v4 則提供更乾淨的 multilingual ASR alignment/filtering 模組。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。這篇 TeX source 顯示為 Interspeech camera-ready 格式。

## 我該不該細讀
**應該細讀，尤其是 data cleaning section 和 threshold table。**

如果你在找「像 PilotTTS 那樣把 data cleaning 細節講清楚」的 speech data paper，這篇很值得放進 shortlist。它不是 TTS paper，但它具體公開了：

- raw data 主要錯在哪裡。
- 每一步 filter 的工具、邏輯和保留量。
- threshold 如何選。
- 不 filter 會造成怎樣的 downstream 崩壞。
- cleaning 後對 multilingual ASR / LID / long-form ASR 的影響。

對我們來說，它可以成為 **ASR/transcript-cleaning baseline**，之後再接 Miipher-style restoration、Sommelier-style diarization/overlap processing、WhisperD-style speaker/event tags。

## 可能的弱點 / open questions
- **沒有直接和其他 cleaning recipe 做完整 ablation。** 例如 confidence-based ASR filtering、LLM transcript repair、ROVER ensemble、multiple-ASR agreement 等方法沒有系統比較。
- **CTC model coverage 會限制 cleaning coverage。** OWSM-CTC v3.2 只支援 YODAS 語言子集合，可能讓某些語言被排除或過濾過嚴。
- **per-language quantile 很實用，但不是 per-language optimal。** 作者承認不同語言最佳 threshold 不同，但最後用單一 `theta_CTC = 0.10`。
- **只保留原始分布，沒有處理 language imbalance。** English 仍最大，tail languages 可能仍欠資料。
- **ASR data cleaning 不等於 TTS data cleaning。** 它沒有 speaker/prosody/acoustic naturalness filters；如果拿來做 TTS，還要補額外 QA。
- **long-form utterance 整段丟棄可能偏保守。** 只要任一 short utterance 低分就丟整段，可能犧牲一些可用片段；但也降低整段來源污染風險。

## Tags
- speech-llm
- ASR
- multilingual-ASR
- data-cleaning
- speech-data-cleaning
- CTC-segmentation
- language-identification
- YODAS
- OWSM
- project-tts-data-pipeline

## Concepts
- OWSM v4
- YODAS cleaning
- web-crawled speech data
- CTC segmentation
- audio-text realignment
- CTC confidence score
- language-relative thresholding
- text LID
- spoken LID
- fastText LID
- SpeechBrain ECAPA-TDNN LID
- Common Voice threshold selection
- long-form ASR
- multilingual ASR
- fully-open speech foundation model
- ESPnet

## Citation
```bibtex
@misc{peng2025owsmv4improvingopenwhisperstyle,
  title={OWSM v4: Improving Open Whisper-Style Speech Models via Data Scaling and Cleaning},
  author={Peng, Yifan and Shakeel, Muhammad and Sudo, Yui and Chen, William and Tian, Jinchuan and Lin, Chyi-Jiunn and Watanabe, Shinji},
  year={2025},
  eprint={2506.00338},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2506.00338}
}
```
