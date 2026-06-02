---
paper_key: arxiv_2605_30993
canonical_id: "arxiv:2605.30993"
title: "SwanVoice: Expressive Long-Form Zero-Shot Speech Synthesis for Both Monologue and Dialogue"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.30993"
pdf_url: "https://arxiv.org/pdf/2605.30993"
status: read
rating: 5
tags:
  - speech-llm
  - tts
  - dialogue
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.30993)
- [PDF](https://arxiv.org/pdf/2605.30993)
- [Project / demos](https://swanaigc.github.io/#/swanvoice)

## 一句話總結
SwanVoice 把 long-form dialogue TTS 當成一個完整 generation problem，而不是逐 turn 合成再拼接；它用 SwanData-Speech 從 in-the-wild audio 建 monologue/dialogue corpora，再用 25 Hz VAE + flow-matching DiT + speaker-turn conditioning 合成 1-4 speakers 的 expressive zero-shot speech。

## 這篇在解決什麼問題
這篇的核心問題是：現有 zero-shot TTS 通常擅長 single-speaker narration，但 **long-form multi-speaker dialogue** 很容易失真。

常見 workaround 是：
1. 每個 turn 分別用 monologue TTS 合成
2. 再把 audio 拼接起來

但這會造成：
- room response / background ambience 不一致
- speaker intensity 和情緒連續性斷掉
- turn boundary 的 pause timing 很不自然
- speaker switching 在相近聲線下容易混淆
- 長篇 dialogue 會有 word skipping / repetition / pronunciation drift

作者認為 dialogue TTS 不能只靠 speaker labels，而需要 speaker-consistent segments、pause-aware transcripts、quality filtering、emotion filtering，以及能保住 monologue quality 的 curriculum。

## 核心方法
### 1) SwanData-Speech data pipeline
SwanData-Speech 從 raw in-the-wild audio 建構 monologue 和 dialogue training subsets。

Pipeline 包含：
- speech enhancement
- speaker diarization
- VAD / speaker embeddings / clustering
- ASR
- punctuation refinement
- quality filtering
- pause-aware word-level alignment
- emotion / expressive filtering

原始資料約 **2.59M hours**：
- Chinese 約 2.24M hours
- English 約 0.35M hours

最後會分成 monologue pool 和 dialogue pool。dialogue segment 要滿足：
- 2-4 speakers
- no single silence interval > 2 seconds
- merged segment 最長 120 seconds
- turn content 用 `<S{id}> ... </S{id}>` 標註 speaker turn

### 2) Pause-aware transcript
作者指出 conversational speech 的 punctuation 不等於實際 pause。若只用語意 punctuation，模型會學不到自然 turn boundary。

因此 Swan Forced Aligner 會做 pause-aware word-level alignment，並把 pause / speaker turn 資訊保留下來。這點對 TTS data pipeline 很重要。

### 3) SwanVoice architecture
SwanVoice 是 1-4 speakers zero-shot TTS model：
- 25 Hz VAE 壓縮 waveform latent
- raw text conditioning
- pause-aware symbols
- pinyin substitution 處理中文多音字 / rare pronunciation
- speaker-turn label sequence 對齊 text tokens
- flow-matching DiT 生成 target latent
- reference speech latent 用於 speaker / style conditioning

模型不是逐 turn 生成，而是讓 full text + speaker-turn sequence 一起 condition generation。

### 4) 三階段 curriculum
直接從 conversational data 訓練容易產生 unintelligible speech，因此作者使用 curriculum：

1. **Monologue pretraining**：先學穩定 speech-text alignment
2. **Mixed conversational training**：monologue + synthetic/concatenated 2-4 speaker dialogue，讓模型學 speaker switching
3. **Real conversational training**：monologue + real 2-4 speaker dialogue，學 environment consistency 和 emotional coherence

monologue data 會持續保留，避免 dialogue fine-tuning 傷害 monologue quality。

### 5) DiffusionNFT post-training
SFT 後仍會有難詞誤讀和 speaker drift。作者用 DiffusionNFT 做 online RL-style post-training：
- phone-level consistency reward
- speaker similarity reward

post-training data 約 3K real human conversation samples，手動修正 pause annotations。

## Training / Data
### Model scale / compute
- SwanVoice main model：約 **2B parameters**
- Monologue pretraining：64 A100，500K steps
- Mixed conversational training：32 A100，600K steps
- SFT：32 A100，300K steps
- Post-training：8 A100，50 epochs

### Data 重點
這篇最值得看的不是單一模型數字，而是它的 data pipeline：
- long recordings 切 speaker-ordered segments
- same-speaker short segments 可合併，最長 60 seconds
- dialogue segments 可 2-4 speakers，最長 120 seconds
- turn tags 明確標 speaker
- pause annotation 不是依賴 punctuation，而是 forced alignment
- emotion / quality filtering 用來保留 expressive speech

## 主要結果
### Monologue
在 SwanBench-Speech Expressive Challenge subset：
- SwanVoice richness：`3.81`
- hierarchy：`3.62`
- 高於所有 evaluated open-source baselines
- timbre consistency：`0.93`
- sound fidelity：`3.60`
- prosodic coherence：`3.56`

Content error 不是最好，這是主要限制。

### Dialogue
在 dialogue generation：
- richness / hierarchy：`3.62 / 3.71`
- 比 strongest baselines 高 `0.53 / 0.56`
- 支援 demo 中 3-4 speaker cases
- content error 低於 baseline average，但仍不是最佳

### 作者結論
SwanVoice 的優勢主要在 expressiveness、hierarchy、long-form coherence；弱點是 content accuracy 和 close-speaker switching。

## Project relevance
- **project-full-duplex-data**：高度相關。雖然它不是 full-duplex overlap model，但它直接處理 multi-speaker dialogue TTS、speaker-turn conditioning、pause-aware transcripts 和 long-form conversational data。
- **project-tts-data-pipeline**：高度相關。SwanData-Speech 是很有參考價值的 TTS data construction pipeline。

## Related papers in my pool
- **Dia**：同樣是 dialogue TTS / multi-speaker transcript-driven generation；SwanVoice 更重 long-form data pipeline 和 1-4 speaker training。
- **Parakeet and WhisperD**：WhisperD 的 speaker/event transcript format 和 SwanVoice 的 speaker-turn tags / pause annotation 可以互補。
- **DialogueSidon**：如果要從 in-the-wild dialogue audio 拆出可用 tracks，DialogueSidon 可與 SwanData-Speech pipeline 串起來。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**非常建議細讀。**

這篇幾乎正中你的 full-duplex data/model 和 TTS data pipeline 交集。雖然它還不是 overlap/backchannel synthesis，但它已經把 long-form dialogue TTS 的關鍵資料問題攤開：
- speaker diarization
- speaker-turn transcript format
- pause-aware alignment
- multi-speaker conditioning
- monologue/dialogue curriculum
- expressive filtering

如果你未來要做「given transcript/control signals synthesize natural dual-channel conversation」，這篇可以作為 dialogue TTS side 的重要 baseline。

## 可能的弱點 / open questions
- Content accuracy 仍不是最佳，長篇 dialogue 可能仍有 word skipping / substitution
- close speakers 或 prompt 太短時 speaker switching 仍會失敗
- 目前是 single waveform / turn-conditioned dialogue，不是 explicit dual-channel full-duplex generation
- overlap speech、backchannel、interrupt 沒有作為核心任務處理
- 大量 internal data 和大 compute，完整複現困難
- post-training reward 只針對 phone-level WER 和 speaker similarity，沒有直接 reward environment consistency / expressiveness

## Tags
- speech synthesis
- TTS
- dialogue TTS
- multi-speaker TTS
- zero-shot TTS
- long-form speech
- speech data pipeline
- speaker diarization
- pause-aware transcript
- flow matching

## Concepts
- SwanData-Speech
- Swan Forced Aligner
- speaker-turn conditioning
- pause-aware alignment
- raw text conditioning
- pinyin substitution
- 25 Hz VAE
- flow-matching DiT
- DiffusionNFT
- phone-level reward
- speaker similarity reward
- long-form dialogue generation
- monologue/dialogue curriculum
- expressive speech filtering

## Citation
```bibtex
@misc{li2026swanvoice,
  title={SwanVoice: Expressive Long-Form Zero-Shot Speech Synthesis for Both Monologue and Dialogue},
  author={Ruiqi Li and Yu Zhang and Changhao Pan and Ke Lei and Xiang Yin and Cheng Yang},
  year={2026},
  eprint={2605.30993},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.30993}
}
```
