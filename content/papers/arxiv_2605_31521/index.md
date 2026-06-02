---
paper_key: arxiv_2605_31521
canonical_id: "arxiv:2605.31521"
title: "UniAudio-Token: Empowering Semantic Speech Tokenizers with General Audio Perception"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31521"
pdf_url: "https://arxiv.org/pdf/2605.31521"
status: read
rating: 5
tags:
  - speech-llm
  - tts
  - audio-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.31521)
- [PDF](https://arxiv.org/pdf/2605.31521)
- [Code](https://github.com/Tencent/Universal_Audio_Tokenizer)

## 一句話總結
UniAudio-Token 想把 speech semantic tokenizer 擴展成 universal audio tokenizer：用 `Semantic-Acoustic Primitives (SAP)` 監督 linguistic content、vocal attributes、auditory scene，再用 `Semantic-Acoustic Equilibrium (SAE)` 從 shallow layers 補回 acoustic details，讓單一 codebook 同時支援 speech generation 和 general audio perception。

## 這篇在解決什麼問題
這篇的問題很直接：現有 Audio-LLM / Speech LLM 常用的 tokenizer 兩邊都不完美。

- ASR-centric semantic tokenizer：語意對齊好，適合 speech / transcript，但常有 `acoustic blindness`
- reconstruction-centric acoustic codec：保留 waveform 細節，但缺乏明確 semantic supervision，對 LLM reasoning 不一定好
- speech tokenizer 通常把 non-speech audio 當 noise，導致 sound / music / acoustic scene perception 很弱
- 如果要做 unified Audio-LLM，tokenizer 不能只會 speech，也不能只會 waveform reconstruction

作者要做的是一個 **single-codebook discrete interface**，讓 Audio-LLM 可以用同一套 tokens 處理 speech、sound、music，同時不犧牲 TTS / speech reconstruction。

## 核心方法
### 1) Semantic-Acoustic Primitives (SAP)
SAP 是一種 structured supervision protocol，用 LLM 生成 JSON-like annotation，把 audio clip 拆成三層：

- **Linguistic Content**：speech 的 verbatim transcript
- **Vocal Attributes**：Age、Gender、Emotion、Accent、Prosody、Timbre
- **Auditory Scene**：Transient Events 和 Persistent Events

這個設計的核心是：不要只用 transcript 監督 tokenizer，而是把「說了什麼」和「怎麼說 / 背景發生什麼」都結構化標出來。

### 2) SAP data curation pipeline
SAP 標註不是人工做，而是自動生成：
- 用 `Qwen3-Omni-Captioner` 產生 acoustic captions
- 用 `Qwen3-30B-A3B-Instruct-2507` 把 ASR transcript + acoustic caption 合成 structured SAP
- 用 ontology constraints、logical consistency checks、content-duration alignment 做 validation
- 再從 SAP 衍生 `SAP-Instruct`，包含 Direct QA、Multiple Choice、True/False Verification

這部分對 TTS data pipeline 特別有價值，因為它示範了如何把 raw audio 轉成可供 tokenizer / LLM 使用的 structured acoustic supervision。

### 3) Semantic-Acoustic Equilibrium (SAE)
Whisper 這類 ASR encoder 的 deep layers 偏 semantic，但 shallow layers 還保留較多 acoustic detail。SAE 做的是 content-aware fusion：

- 從 shallow layer 取 acoustic-rich features
- 從 final layer 取 semantic-rich features
- 用 learnable adapter 對齊 feature space
- 用 gating mechanism 動態決定要補多少 shallow acoustic detail

直覺上，SAE 是在避免 tokenizer 變成「只懂文字、不懂聲音」。

### 4) Vector Quantization
模型使用 single codebook：
- vocab size `8192`
- frame rate `25 Hz`
- 產生 discrete audio token sequence

訓練分兩階段：
- Stage 1：不插入 VQ，先訓練 SAE + decoder 預測 SAP
- Stage 2：插入 VQ，訓練 codebook，同時保留 SAP-aligned representation

## Training / Data
### Model initialization
模型從 `Whisper-large-v3` 初始化 encoder / decoder，保留 speech linguistic alignment，再用 SAP supervision 擴展到 vocal attributes 和 auditory scenes。

### Downstream Audio-LLM setup
作者把不同 tokenizer 接到相同 LLM backbone：
- understanding：`Qwen2.5-3B`
- generation：`Qwen2.5-0.5B`

這樣能比較 tokenizer 本身對 downstream performance 的影響。

### Evaluation
評估分三類：
- tokenizer-level：ESC-10 / ESC-50 latent clustering
- speech reconstruction：LibriSpeech、SEED-TTS，用 WER / MOS
- downstream Audio-LLM：MMAU、MMAR、MMSU，以及 TTS generation

## 主要結果
### General audio clustering
在 ESC-10 / ESC-50 上，UniAudio-Token 是唯一取得 positive Silhouette Score 的 tokenizer：
- ESC-10 Silhouette：`0.091`
- ESC-50 Silhouette：`0.023`

Cluster Purity 也比 baselines 高很多，表示 tokens 對 environmental sound categories 有更好的 separability。

### Speech reconstruction
UniAudio-Token 在 speech reconstruction 上沒有因為 general audio perception 而退步，反而平均 WER / MOS 最好：
- Average WER：`3.68`
- Average MOS：`4.19`

作者的解釋是：linguistic content 和 vocal attributes 並非完全可分；保留 accent、aspiration、phonetic transition 等 acoustic details，反而能改善 reconstruction intelligibility。

### Audio-LLM understanding
接入相同 LLM 後，UniAudio-Token 在 MMAU、MMAR、MMSU 都是最高：
- MMAU overall：`61.10`
- MMAR overall：`45.80`
- MMSU overall：`43.54`

最大提升在 sound / music 類別，說明 SAP + SAE 確實補上 semantic tokenizer 原本的 acoustic blindness。

### TTS generation
在 SEED-TTS downstream generation setup：
- English WER：UniAudio-Token `1.78`，優於 CosyVoice2 `2.57`
- Chinese WER / CER：UniAudio-Token `1.29`，優於 CosyVoice2 `1.45`
- MOS 也更高

## Project relevance
- **project-tts-data-pipeline**：高度相關。SAP 是一個可借鑑的 transcript + speaker/style/event structured annotation format。
- **project-full-duplex-data**：中等相關。SAP 的 speaker / vocal / scene decomposition 可延伸到 overlap、backchannel、turn-taking annotation，但本文沒有直接處理 full-duplex dialogue。

## Related papers in my pool
- **PilotTTS**：同樣強調 data annotation / data pipeline，但 PilotTTS 面向 TTS training data，UniAudio-Token 面向 tokenizer supervision。
- **Parakeet and WhisperD**：WhisperD 的 speaker/event tags 和 SAP 的 structured annotation 很接近，值得一起看。
- **Seed-TTS**：作為 speech generation benchmark。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀。**

這篇對你的兩個方向都很有用，尤其是 TTS data pipeline。它不是單純 TTS model paper，而是在回答：如果未來要讓 LLM 讀懂 speech/audio tokens，資料標註格式要怎麼設計，tokenizer 要怎麼避免只學 transcript。

最值得細讀的是：
- SAP schema
- SAP automatic curation / validation
- SAE 如何結合 shallow acoustic features 和 deep semantic features
- tokenizer 是否能同時支援 speech generation 和 audio understanding

## 可能的弱點 / open questions
- SAP 是 LLM-generated labels，仍可能有 hallucination / ontology bias
- non-speech waveform reconstruction fidelity 不如高 bitrate codec
- evaluation 主要 English / Chinese，multilingual coverage 有限
- SAP schema 是否足以描述 overlap、laughter、breath、turn-taking 等 conversational TTS 所需事件，還需要擴展
- 使用 Whisper initialization 可能讓 tokenizer 的 inductive bias 仍偏 speech
- downstream generation 用較小 LLM backbone，真正大模型整合後是否仍同樣提升，需要再確認

## Tags
- audio tokenizer
- semantic speech tokenizer
- Audio-LLM
- TTS
- speech generation
- audio understanding
- vector quantization
- SAP
- SAE
- structured annotation

## Concepts
- Semantic-Acoustic Primitives (SAP)
- Semantic-Acoustic Equilibrium (SAE)
- single-codebook tokenizer
- vector quantization
- Whisper-large-v3
- acoustic captioning
- vocal attributes
- auditory scene
- transient events
- persistent events
- SAP-Instruct
- codebook
- acoustic blindness
- Audio-LLM interface

## Citation
```bibtex
@misc{song2026uniaudiotokenempoweringsemanti,
  title={UniAudio-Token: Empowering Semantic Speech Tokenizers with General Audio Perception},
  author={Yuhan Song and Linhao Zhang and Aiwei Liu and Chuhan Wu and Sijun Zhang and Wei Jia and Yuan Liu and Houfeng Wang and Xiao Zhou},
  year={2026},
  eprint={2605.31521},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2605.31521}
}
```
