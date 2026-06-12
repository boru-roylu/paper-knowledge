---
paper_key: arxiv_2504_07053
canonical_id: "arxiv:2504.07053"
title: "TASTE: Text-Aligned Speech Tokenization and Embedding for Spoken Language Modeling"
year: 2025
venue: "ICLR 2026 (Poster)"
url: "https://arxiv.org/abs/2504.07053"
pdf_url: "https://arxiv.org/pdf/2504.07053"
status: read
rating: 8.4
tags:
  - speech-llm
  - speech-tokenizer
  - text-aligned-tokenization
  - spoken-language-modeling
  - tts
  - project-tts-data-pipeline
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
created: 2026-06-11
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv TeX source `source/main.tex`、OpenReview forum `6STb8DauN1`、project/code links 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2504.07053](https://arxiv.org/abs/2504.07053)
- arXiv abstract: [https://arxiv.org/abs/2504.07053](https://arxiv.org/abs/2504.07053)
- PDF: [https://arxiv.org/pdf/2504.07053](https://arxiv.org/pdf/2504.07053)
- arXiv source: [https://arxiv.org/src/2504.07053](https://arxiv.org/src/2504.07053)
- Project page: [https://mtkresearch.github.io/TASTE-SpokenLM.github.io](https://mtkresearch.github.io/TASTE-SpokenLM.github.io)
- Code / models: [https://github.com/mtkresearch/TASTE-SpokenLM](https://github.com/mtkresearch/TASTE-SpokenLM)
- OpenReview: [https://openreview.net/forum?id=6STb8DauN1](https://openreview.net/forum?id=6STb8DauN1)

## 一句話總結

TASTE 是一個 **text-aligned speech tokenizer / embedding**：它用 ASR transcript 的 text tokens 當 query，對 frozen Whisper encoder 的 speech features 做 cross-attention aggregation，產生和 text token 一對一對齊的 speech tokens；這讓 joint text-speech spoken language model 不再需要 interleaving / padding / delayed alignment heuristics，並在極低 bitrate 下保留 duration、tone、speaker 等 paralinguistic information。

## 這篇在解決什麼問題

Spoken Language Model (SLM) 要同時 listen 和 speak，通常需要 speech tokens。但傳統 speech tokens 有兩個問題：

- **長度 mismatch**：speech tokens 可能是 12.5 Hz / 25 Hz / 50 Hz，而 text tokens 只有約 3 Hz；joint modeling 時要靠 interleaving、padding、delayed generation 或額外 alignment。
- **資訊重複**：如果模型同時看到 text tokens 和 speech tokens，speech tokens 不應該再重複承載完整 lexical content，而應該更專注在 paralinguistic information，例如 duration、prosody、tone、speaker style。

TASTE 的核心觀點是：既然 joint SLM 裡 text tokens 已經負責 semantics，就應該在 tokenization 階段直接把 speech tokens 對齊到 text tokens，讓 speech token 成為「每個 word/text token 的 acoustic/prosody side channel」。

## 核心方法

### 1. TASTE speech tokenizer

輸入是一對 speech-text pair：

```text
speech waveform u
text transcript v
```

transcript 可以由 ASR 取得。TASTE tokenizer 有三個 component：

- encoder：frozen Whisper ASR encoder。
- aggregator：text-guided cross-attention，把 speech feature 壓成 text-length sequence。
- quantizer：RVQ，把 text-aligned continuous representation 離散化。

### 2. Cross-attention aggregator：用 text query 對齊 speech

Aggregator 的第一層 attention 設計很關鍵：

```text
Q = text transcription tokens v
K = Whisper last hidden states h(L)
V = Whisper shallow hidden states h(l)
```

直覺：

- Whisper last hidden states 比較接近 ASR alignment / semantic cues，適合當 key。
- shallow hidden states 保留比較多 acoustic details，適合當 value。
- query 來自 text tokens，所以 output length 自然等於 text token length。

作者最後使用 Whisper 第 6 層作為 shallow hidden state。OpenReview rebuttal / appendix 補了 CCA analysis：Whisper layers 4-8 和 S3 target embeddings 相關性最高，支持這個選擇。

### 3. RVQ quantization

Aggregator 得到 text-aligned continuous representation `z` 後，TASTE 用 residual vector quantization：

```text
q, z_hat = Quantizer(z)
q = [q(1), ..., q(R)]
z_hat = sum_r z_hat(r)
```

實驗設定：

- RVQ layers `R=4`
- codebook size `512`
- codebook dimension `256`

因此每個 text token 對應多層 RVQ code，也可用 continuous embedding `z_hat`。

### 4. Speech decoder：text + aligned speech embedding -> speech units -> vocoder

TASTE decoder 接收：

```text
text tokens v
aligned speech embedding z_hat
speaker embedding
```

然後用 Transformer unit decoder 預測 S3 speech units，再交給 unit-to-speech vocoder。vocoder 使用 CosyVoice published pretrained components，包括 flow model + HiFi-GAN，不參與 TASTE training。

### 5. Reconstruction objective

TASTE 不是靠 forced alignment supervision，而是靠 speech reconstruction 學出 text-aligned tokens：

- unit decoder cross-entropy loss：預測 target S3 units。
- RVQ commitment loss：讓 continuous representation 可被 quantized。

總 loss：

```text
L_TASTE = L_CE + L_RVQ
```

### 6. TASLM：用 TASTE 把 text LLM 變成 spoken LM

作者訓練兩種 text-aligned spoken language model：

- `TASLM_token`：同時預測下一個 text token 和對應的 `R` 層 speech token。
- `TASLM_emb`：直接預測 text-aligned speech embedding distribution，類似 continuous latent modeling。

因為 TASTE 已經 text-aligned，SLM 每一步可以同步產生 text token 和對應 speech token/embedding，不需要再設計複雜的 speech-text alignment schedule。

## Training / Data

Tokenizer / reconstruction：

- Encoder：frozen Whisper ASR encoder。
- Target unit：CosyVoice 的 S3 token。
- Vocoder：CosyVoice pretrained flow model + HiFi-GAN。
- Speaker control：額外使用 speaker embedding。
- Quantizer：4-layer RVQ，codebook size 512，dimension 256。

Datasets：

- Emilia English subset：約 40,000 hours，web-scale speech，pseudo-labeled transcripts。
- LibriTTS：約 600 hours reading-style speech。
- Evaluation：LibriSpeech `test-clean`。

Spoken LM：

- 初始化自 text LLM。
- 用 LoRA fine-tuning，rank `r=64`，alpha `128`。
- 因 ASR vocabulary 和 LLM vocabulary 不同，作者用 word-level TASTE tokenization / embedding 解決 mismatch。

## 主要結果

### 1. 極低 bitrate 下仍有可用 reconstruction

LibriSpeech `test-clean` reconstruction：

- TASTE：frequency 約 `3 Hz`，bitrate 約 `150 bps`。
- Text-only baseline：約 `50 bps`，但 duration consistency 和 MUSHRA 明顯差。
- S3 token topline：`25 Hz` / `600 bps`，reconstruction 更強但不 text-aligned。
- SpeechTokenizer / EnCodec / Mimi：bitrate 通常更高。

TASTE metrics：

- ASR-WER：`4.4%`
- UTMOS：`4.29`
- DNS-MOS：`4.10`
- ViSQOL：`3.05`
- duration consistency：`0.91`
- speaker similarity：`0.80`
- MUSHRA：`68.3`

它不是所有 reconstruction 指標都贏 codec；但重點是用極低 token rate 達到可用 reconstruction，並讓 tokens 和 text 對齊。

### 2. TASTE 明顯優於直接拿 S3 token 做 joint modeling

在 SLM speech continuation / likelihood benchmarks 中，直接用 S3 token 當 baseline 表現很差，即使 S3 token reconstruction 更好。這是本篇最重要的訊號之一：

> reconstruction quality 不是 speech tokenizer 是否適合 joint SLM 的唯一標準。

TASLM 1B results：

- `TASLM_token` continuation：GPT-4o `3.08`，UTMOS `4.07`，Human `3.93`。
- `TASLM_emb` continuation：GPT-4o `3.16`，UTMOS `4.22`，Human `4.16`。
- TWIST / Spirit LM 等 7B SLM 在 continuation human MOS 明顯較低。
- likelihood overall：`TASLM_token` `68.7`，`TASLM_emb` `67.2`，Spirit LM Expr. `67.6`。

也就是 1.3B base + LoRA 的 TASLM，在 continuation 上非常強，likelihood benchmark 也有競爭力。

### 3. Text-aligned speech editing 支持 paralinguistic interpretation

作者用兩個 transcript 相同但 prosody / duration 不同的 utterances，交換某些 word 對應的 TASTE tokens。結果只有被交換 token 的 words duration 明顯變化，其他 words 保持原本 timing。

這支持 TASTE tokens 的 interpretation：

```text
text token = lexical content
aligned speech token = word-local paralinguistic information
```

這對 TTS prompt / style control 很有啟發：我們可能可以把 phrase-level duration / tone / style 當成 text-aligned side channel，而不是整句 global style label。

### 4. ASR robustness / layer choice 有補充分析

ASR effect：

- TASTE with ASR transcript：WER `4.4%`，UTMOS `4.29`，DNS-MOS `4.10`。
- TASTE with ground-truth transcript：WER `4.6%`，UTMOS `4.24`，DNS-MOS `4.08`。

spoken QA：

- TASLM with ASR：Web-Q `27.1`，LLaMA-Q `57.6`。
- TASLM with GT：Web-Q `28.0`，LLaMA-Q `57.7`。

Whisper vs nvidia-parakeet for GPT-4o semantic evaluation also沒有改變相對排名。

Layer selection：

- Encoder-only 50 Hz S3 top-5 accuracy：`0.98`
- Encoder + aggregator 約 3 Hz：`0.88`
- Encoder + aggregator + quantizer 約 3 Hz：`0.76`
- Text-only：約 `0.65`
- 用 last hidden 當 value 會更差，支持 shallow hidden 的 acoustic information 作用。

### 5. Noisy tokenizer robustness

OpenReview rebuttal / appendix 加了 noise robustness：

- At SNR 20 dB：TASTE WER `4.8%`，SIM `0.842`。
- At SNR 10 dB：TASTE WER `6.9%`，SIM `0.815`。
- At SNR 5 dB：TASTE WER `11.1%`，SIM `0.792`，在 overall rank 最高。

作者用這回應 reviewer 對 ASR / noisy condition 的疑慮。不過這仍是 white-noise robustness，不等於真實 overlap / far-field / spontaneous dialogue robustness。

### 6. SALMON 弱點：background / room attributes

TASLM 在 StoryCloze 很強，但 SALMON acoustic consistency 裡對 background / room 類 attributes 較弱。作者解釋是 TASTE 主要學 natural speech，沒有訓練在 environmental sound / background noise；因此 speech-related attributes 如 gender / speaker 比較好，background acoustic scene 比較差。

## Project relevance

### project-generative-speech-representation-evaluation：高度相關

TASTE 是這個 project 的核心案例之一，因為它清楚顯示：

- `better reconstruction` 不等於 `better downstream SLM`。
- speech tokenizer 評估要看 downstream joint modeling 是否容易，而不是只看 codec fidelity。
- representation 可以被設計成 text-aligned side channel，讓 lexical content / paralinguistic information 分工。
- token frequency / bitrate / alignment schedule 是 representation learnability 的一部分。

如果我們要比較 codec、VAE、SSL encoder、continuous latent，TASTE 提醒我們要加一個 axis：

```text
Does this representation align with the conditioning structure used by the generator?
```

對 TTS / SLM 來說，text-conditioned generator 可能更需要 text-aligned latent，而不是 fixed-rate acoustic codec tokens。

### project-tts-data-pipeline：高度相關

TASTE 需要 speech-text pair，並依賴 ASR transcript quality。這直接牽涉 TTS data pipeline：

- transcript 必須足夠乾淨，否則 text-aligned tokenization 會錯位。
- word-level / phrase-level timing、duration、speaker embedding、style metadata 都變得重要。
- 如果我們能從 dataset 中抽出 text-aligned paralinguistic tokens，可能可用於 controllable TTS training：每個 word/phrase 都有 duration / tone / prosody side channel。

對你的 English TTS data cleaning 來說，TASTE 是一個值得追的方向：clean transcript 不只是為了 ASR WER，而是為了讓 speech representation 可以和 text token 對齊。

### project-audio-model-evaluation：中高相關

TASTE 的 evaluation design 也有參考價值：

- reconstruction：WER、UTMOS、DNS-MOS、ViSQOL、duration consistency、speaker similarity、MUSHRA。
- SLM：speech continuation 的 semantic coherence / naturalness / human MOS。
- likelihood：SALMON / StoryCloze。
- robustness：noisy SNR ablation。

但 GPT-4o over ASR transcripts 作 semantic MOS 仍是 double-black-box evaluator，需要和 human semantic judgments 或 text-only LM plausibility cross-check。

## Related papers in my pool

- [DinoSR](../arxiv_2305_10005/)：DinoSR 學 phone-like discrete units；TASTE 學 text-aligned paralinguistic side-channel tokens。兩者可作 content axis vs paralinguistic axis 的對照。
- [On The Landscape of Spoken Language Models](../arxiv_2504_08528/)：TASTE citation graph 已連到這篇 survey，可用來定位 SLM tokenization / modeling design space。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：VoxCPM 類 tokenizer-free / AudioVAE latent 可和 TASTE 的 text-aligned tokenization 比較：continuous speech latent vs word-aligned side-channel。
- [FunASR](../../tools/modelscope-funasr/)：TASTE pipeline 依賴 ASR transcript；FunASR 可作實驗用 transcript / VAD / diarization preprocessing baseline。
- [WhisperD / Parakeet](../../tools/jordandarefsky-parakeet-whisperd/)：若把 TASTE 延伸到 dialogue，可結合 speaker/event tags，例如 `[S1]`、`[S2]`、`(laughs)`，處理 non-lexical events。

## OpenReview / reviewer discussion

OpenReview forum `6STb8DauN1` decision 是 **Accept (Poster)**。Meta-review 說 reviewers 覺得 TASTE 有趣且實用，可縮短 speech sequences、改善 speech-text integration、方便把 LLM adaptation 成 SLM；但 novelty 被認為中等，evaluation 仍有不足，缺少一些比較和分析。作者 rebuttal 後多數 concerns 被處理。

主要 reviewers concerns：

- novelty：text-speech cross-attention、low-frequency speech tokens、joint SLM alignment 已有相關 work，TASTE 要更清楚界定新穎性。
- baseline：初稿缺少 DAC、DM-Codec、BigCodec、WavTokenizer 等 recent / matched-bitrate baselines。
- ASR dependence：需要測 noisy ASR、low-resource、multilingual、spontaneous speech。
- non-lexical events：laugh、cough、silence、background sound 沒有明確 text counterpart，可能被壓到鄰近 word token。
- evaluation：GPT-4o over ASR transcript 作 semantic MOS 是 double black box；SALMON background / room 表現較弱需要解釋。
- layer choice：為什麼用 Whisper last layer 當 key、shallow layer 當 value，需要 empirical support。
- streaming / latency：TASTE 目前依賴 external ASR 和 non-causal decoder，不是 real-time design。

作者 rebuttal / revision 補了：

- noisy SNR robustness，TASTE 在 5 dB noisy condition WER 最好。
- more tokenization baselines：DAC、DM-Codec、BigCodec、WavTokenizer 等。
- aggregator attention visualization。
- CCA layer analysis，支持 shallow layers 4-8 與 S3 target correlation 最高。
- Expresso out-of-domain continuation：TASLM embed GPT-4o `3.21`、UTMOS `3.65`，高於 TWIST / Spirit LM。
- ASR vs GT transcript ablation，以及 Whisper vs Parakeet evaluation ablation。

## 我該不該細讀

建議細讀。這篇和我們正在想的 **speech representation / tokenizer 是否真的適合 downstream generation** 非常相關。

最值得讀：

- text-aligned tokenizer 的 problem formulation。
- Q/K/V 設計：text query、Whisper last hidden as key、shallow hidden as value。
- reconstruction vs downstream SLM 的差異：S3 token reconstruction 更好，但 joint modeling 輸給 TASTE。
- text-aligned speech editing demo。
- OpenReview 關於 non-lexical events、noisy ASR、recent baselines、layer choice 的討論。

## 可能的弱點 / open questions

- 依賴 ASR transcript；如果 transcript 錯、code-switch、low-resource、spontaneous dialogue，alignment 可能出問題。
- 主要實驗是 English single-speaker / reading-style / natural speech；multi-speaker overlap、backchannel、laugh/cough、room/background 沒有真正解決。
- TASTE 對 background / room acoustic scene 不敏感，這對 audio event / full-duplex dialogue 可能是限制。
- text-aligned token 的假設會讓 non-lexical event 不知道掛在哪個 token 上；需要 event tags 或 explicit non-text tokens。
- 目前不是 streaming；作者自己也把 latency / streaming 列為 limitation。後續可追 [TASTE-Streaming](https://arxiv.org/abs/2603.12350)。
- 低 bitrate 的優點很強，但如果目標是 high-fidelity TTS / voice cloning，可能需要多層或 multi-source token 補 acoustic detail；後續可追 [TASLA](https://arxiv.org/abs/2510.14934)。

## Tags

- speech-llm
- speech-tokenizer
- text-aligned-tokenization
- spoken-language-modeling
- tts
- speech-representation
- paralinguistic-modeling
- project-tts-data-pipeline
- project-generative-speech-representation-evaluation
- project-audio-model-evaluation

## Concepts

- TASTE
- TASLM
- text-aligned speech tokenization
- text-aligned speech embedding
- joint text-speech modeling
- spoken language model
- Whisper encoder
- cross-attention aggregator
- residual vector quantization
- S3 token
- speech continuation
- SALMON
- StoryCloze
- paralinguistic side channel
- text-aligned speech editing
- ASR-dependent tokenization
- low-bitrate speech tokens

## Citation

```bibtex
@inproceedings{tseng2025tastetextalignedspeechtokenization,
  title={TASTE: Text-Aligned Speech Tokenization and Embedding for Spoken Language Modeling},
  author={Liang-Hsuan Tseng and Yi-Chang Chen and Kuan-Yi Lee and Da-Shan Shiu and Hung-yi Lee},
  booktitle={International Conference on Learning Representations},
  year={2026},
  url={https://openreview.net/forum?id=6STb8DauN1}
}
```
