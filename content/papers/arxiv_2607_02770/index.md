---
paper_key: arxiv_2607_02770
canonical_id: "arxiv:2607.02770"
title: "Gemma 4 Technical Report"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2607.02770"
pdf_url: "https://arxiv.org/pdf/2607.02770"
status: read
rating: 7
tags:
  - speech-llm
  - audio-reasoning
  - multimodal-llm
  - open-weight-model
  - encoder-free-audio
  - audio-asr
  - speech-translation
  - long-context
  - project-audio-model-evaluation
  - project-full-duplex-data
created: 2026-07-23
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `main.bbl`), with public web checks for Google DeepMind / Google AI model card / Hugging Face availability and OpenReview status on 2026-07-23.

## Links
- [Original URL](https://arxiv.org/abs/2607.02770)
- [arXiv abstract](https://arxiv.org/abs/2607.02770)
- [PDF](https://arxiv.org/pdf/2607.02770)
- [arXiv source](https://arxiv.org/src/2607.02770)
- [Google DeepMind Gemma 4 page](https://deepmind.google/models/gemma/gemma-4/)
- [Google AI Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Hugging Face Gemma 4 collection](https://huggingface.co/collections/google/gemma-4)
- [Hugging Face paper page](https://huggingface.co/papers/2607.02770)
- [OpenReview forum](https://openreview.net/forum?id=v5QjQT0i34)

## 一句話總結
Gemma 4 是 Google DeepMind 的 open-weight multimodal LLM family，重點不是 speech generation，而是把 text / image / audio understanding、thinking mode、long-context efficiency 和 edge-friendly deployment 放在同一個 model suite；對 audio research 最值得看的部分是 E2B/E4B 的 frozen 305M USM-based continuous audio encoder，以及 12B 的 encoder-free raw audio path：直接把 16 kHz audio 切成 40 ms chunks、投影到 LLM embedding space。

## 這篇在解決什麼問題
這篇 Technical Report 主要解的是 open-weight LLM 的三個壓力：

- 要有 reasoning / coding / agentic workflow 能力。
- 要支援 multimodal input，包括 image、video frames 和 audio。
- 要能在 edge / consumer GPU / workstation 等不同硬體上部署，而不是只服務大型 cloud setting。

對我們的 speech/audio 方向，它提出的問題更具體：

- 小模型如何支援 audio input，同時降低 audio encoder memory footprint。
- 是否一定需要大型 frozen speech encoder，或可以直接用 raw audio chunks + projection 進 LLM。
- audio understanding 是否可在 open-weight model 裡達到可用的 ASR / speech translation 水準。

它不是 TTS / speech synthesis paper，也沒有 audio generation；它的 audio task 是 audio-to-text understanding，例如 ASR 和 speech-to-text translation。

## 核心方法

### 1) Model family
Gemma 4 包含多個尺寸：

- E2B：2.3B effective parameters，5B total with per-layer embeddings。
- E4B：4.5B effective parameters，8B total with per-layer embeddings。
- 12B：dense unified encoder-free model。
- 26B-A4B：MoE，26B total / 3.8B activated。
- 31B：dense model。

E2B / E4B 主打 edge / on-device；12B / 26B / 31B 主打 workstation / consumer GPU / high-end local server。

### 2) Thinking mode
Gemma 4 加入 thinking mode，讓模型先產生 reasoning trace 再回答。這主要提升 math、coding、scientific reasoning、agentic tool use 等文字任務。

對 speech reasoning 的關聯是：如果未來做 spoken reasoning model，audio input 進入 LLM 後，模型可以先在 text reasoning space 中展開 reasoning trace。但這篇沒有提出 audio-grounded chain-of-thought 或 timestamp-grounded reasoning，因此不能直接解決 AnyAudio-Judge / FlashTrace 那種「指出哪段 audio 造成判斷」的需求。

### 3) Audio encoder path: E2B / E4B
E2B 和 E4B 使用 305M audio encoder：

- 輸入是 Mel filterbank。
- 每 40 ms 一個 chunk。
- 架構基於 Google USM。
- 兩層 downsampling convolution + 12 層 Conformer。
- 相比 Gemma 3n，audio encoder 從 680M 降到 305M，參數少 55%。
- 不使用 vector quantization；LLM 直接吃 continuous audio encoder representations。
- audio encoder 在 pre-training 中 frozen。

這代表 Gemma 4 的小模型 audio route 是 continuous encoder feature，不是 discrete audio token，也不是 codec token。

### 4) Encoder-free raw audio path: 12B
Gemma 4 12B 是最有研究味道的部分。它把 USM-based Conformer audio encoder 整個拿掉：

- raw audio at 16 kHz。
- 切成 40 ms chunks。
- 每個 chunk 是 640-dimensional vector。
- 直接用 lightweight projection module 投影到 LLM embedding space。
- 因為 audio 是 temporal sequence，不另外加 positional encoding。

這個設定對 Generative Speech Representation Evaluation 很有啟發：它把「audio representation」極端簡化成 raw waveform chunk projection，等於問 LLM backbone 能不能自己學出 audio understanding。這和 codec / VAE / SSL encoder / supervised semantic tokenizer 是不同路線。

### 5) Long-context efficiency
Gemma 4 延續 local-global attention pattern：E2B 用 4:1 local/global，其餘用 5:1。global attention layers 使用 p-RoPE，並在多數模型中把 keys 重用為 values，降低 global KV cache footprint 最高 37.5%。E2B/E4B 還有 KV cache sharing ratios。

對 audio 有間接意義：audio input 是長序列，若要處理 long-form speech / meetings / dialogue，context efficiency 會成為瓶頸。不過 paper 的 audio eval 仍是 ASR / speech translation，不是長對話 full-duplex streaming。

### 6) Quantization-aware training and edge deployment
模型提供 QAT 版本。Audio encoder 也做 quantization：

- activation precision 8-bit。
- weights 用 2/4/8 bits，依 layer cluster 不同。
- audio encoder on-disk footprint 從 Gemma 3n 的 390 MB 降到 87 MB，減少 78%。

這對 edge audio assistant 有價值，因為 audio encoder footprint 可能是部署瓶頸之一。

### 7) Multi-token prediction drafter
Gemma 4 提供 MTP drafter head for speculative decoding，用一個小 autoregressive drafter head 從主模型 activations / KV cache 產生 future tokens。這主要是 text decoding speed optimization，對 audio input 的直接影響不大，但對 real-time voice assistant 的 response latency 有間接價值。

## Training / Data
Pretraining data 是 large-scale multimodal corpus，包括 web documents、code、images，以及 E2B/E4B/12B 的 audio；資料 cutoff date 是 January 2025。

公開細節有限：

- tokenizer：SentencePiece，262k vocabulary，split digits、preserved whitespace、byte-level encodings。
- data filtering：decontaminate benchmarks，降低 unwanted / unsafe utterances、recitation risk。
- hardware：TPUv5p / TPUv6e。
- sharding：
  - E2B：TPUv6e，4096 chips。
  - E4B：TPUv6e，6144 chips。
  - 12B：TPUv5p，12288 chips。
  - 26B-A4B：TPUv6e，6144 chips。
  - 31B：TPUv6e，10240 chips。

這篇沒有公開 audio training data 的來源比例、語言時長、清理規則、speaker/overlap/diarization handling，所以不適合作為 TTS data cleaning 的細節來源。

## 主要結果

### 1) Audio encoder efficiency
E2B/E4B 的 audio encoder 從 Gemma 3n 的 680M 降到 305M，量化後 on-disk footprint 從 390 MB 降到 87 MB，減少 78%。在這個前提下，audio benchmark 還比 Gemma 3n 提升。

### 2) CoVoST speech-to-text translation
CoVoST corpus BLEU average：

- Gemma 4 E2B：35.4。
- Gemma 4 E4B：38.2。
- Gemma 3n E2B：31.6。
- Gemma 3n E4B：34.7。

作者報告相對 Gemma 3n，translation E2B 提升 12%，E4B 提升 10%。

### 3) FLEURS ASR
FLEURS ASR average WER / CER：

- Gemma 4 E2B：0.090。
- Gemma 4 E4B：0.075。
- Gemma 3n E2B：0.108。
- Gemma 3n E4B：0.085。

作者報告 transcription 相對提升 E2B 17%、E4B 12%。

### 4) 12B encoder-free audio
Gemma 4 12B 在沒有 dedicated audio encoder 的情況下，仍有 competitive audio-text performance：

- FLEURS：English WER 0.063、Korean CER 0.057、Japanese CER 0.080、German WER 0.053、French WER 0.081、Spanish WER 0.038、Italian WER 0.030、Portuguese-BR WER 0.047、Russian WER 0.068、Arabic WER 0.070。
- CoVoST：ja->en 26.4、de->en 41.9、fr->en 42.5、es->en 44.6、it->en 43.3、ru->en 50.5。

這支持一個方向：raw audio patch / chunk projection 也可能學到不錯的 ASR / speech translation，而不是一定要獨立 audio encoder。

### 5) General LLM performance
雖然不是我們主軸，但 Gemma 4 31B / 26B-A4B 在 AIME、LiveCodeBench、GPQA、MMMLU、Arena text 等表現強，並且模型 release under Apache 2.0。這讓它可能成為 open-weight speech reasoning experiments 的 backbone。

## Project relevance

### project-audio-model-evaluation：高相關
這篇提供兩個很適合比較的 audio representation design：

- Frozen USM-style Conformer encoder continuous representation。
- Encoder-free raw 40 ms audio chunks + linear projection。

我們可以把它納入 audio model evaluation 的比較維度：在相同 backbone / compute 下，哪種 audio frontend 更適合 ASR、S2TT、audio QA、speech reasoning、timestamp grounding？

它也提醒 evaluation 不要只看 task score。Gemma 4 同時報告 audio accuracy 和 encoder footprint / quantized memory，這對「預測要花多少資源才能訓練出好模型」很有價值。

### project-full-duplex-data：中度相關
Gemma 4 不是 full-duplex speech model，也不輸出 audio；但 E2B/E4B/12B 的 audio input + long-context + thinking mode 可能可作為 full-duplex system 的 semantic listener / judge / planner。

可用方向：

- 用 Gemma 4-style audio encoder 作為 continuous listener representation，處理 user speech / interruptions / side-talk。
- 用 12B encoder-free raw audio path 的 idea 測試：dual-channel raw audio chunks 是否能直接進 LLM，或是否仍需要 diarization / separation / speaker-aware encoder。
- 對 mono-channel -> dual-channel project，Gemma 4 本身不解 separation，但可作為 downstream evaluator：分離後的 A/B channel 是否保留 ASR、speaker、turn-taking intent。

### project-generative-speech-representation-evaluation：中高相關
雖然它是 understanding model，不是 generator，但它是 continuous representation 和 raw audio projection 的強對照。

可設計比較：

- supervised semantic tokenizer，例如 CosyVoice2 FSQ。
- SSL/ASR encoder，例如 USM / Whisper / SenseVoice。
- codec / VAE latent，例如 ReGenVAE、VoxCPM-related representation。
- raw audio chunk projection，例如 Gemma 4 12B。

然後測：哪種 representation 最容易讓 LLM 做 speech reasoning、ASR、S2TT、audio event QA、localized error explanation。這可以接到我們「learnability」的想法：越好的 audio representation，應該在更少 steps / less compute 下達到更好的 downstream audio reasoning。

### project-tts-data-pipeline：低到中度相關
這篇沒有 TTS data cleaning recipe，也沒有 speech synthesis training data 細節；只可借鑑 data filtering 的 general principle 和 audio encoder benchmarking，不應把它當 TTS pipeline paper。

## Related papers in my pool
- [Google USM](../arxiv_2303_01037/)：Gemma 4 的 E2B/E4B audio encoder 基於 USM-style architecture，citation graph 也連到這篇。
- [AnyAudio-Judge](../arxiv_2606_03116/)：Gemma 4 可作為 open-weight audio understanding / judge backbone 候選，但它沒有 localized audio span attribution。
- [FlashTrace](../arxiv_2602_01914/)：Gemma 4 的 thinking mode 可提供 reasoning trace，但若要知道 audio 哪個 token/span 導致判斷，仍需要 attribution method 類似 FlashTrace。
- [PlanAudio](../arxiv_2605_28063/)：PlanAudio 偏 audio planning / generation；Gemma 4 偏 multimodal understanding，可作 planner/judge/reference model，但不是 generator。
- [Lychee-FD](../arxiv_2607_06540/)：Lychee-FD 是 full-duplex SLM；Gemma 4 可以當 semantic listener 或 audio evaluator，但缺少 speech output / interruption control head。
- [On The Landscape of Spoken Language Models](../arxiv_2504_08528/)：Gemma 4 屬於 multimodal SLM / audio-language model 的 open-weight family，可放進 survey taxonomy。

## OpenReview / reviewer discussion
找到 OpenReview forum `v5QjQT0i34`，但 `npm run paper:openreview -- arxiv_2607_02770` 透過 OpenReview API 讀取 forum notes 時回傳 403。因此目前沒有公開 reviewer / rebuttal / decision notes 可摘要。不要根據 forum 存在推測 review 意見。

## 我該不該細讀
如果你的目標是 TTS / audio generation，不需要全文細讀；讀 audio architecture、encoder-free 12B、audio eval 和 model card 就夠。

如果你的目標是 speech reasoning / audio judge / open-weight multimodal evaluator，建議細讀：

- Audio modality。
- Encoder-free architecture。
- Quantization-aware training 的 audio encoder footprint。
- Audio performance tables。
- Thinking mode / function calling / long-context sections。

這篇最重要的啟發是：audio understanding 不一定要走 discrete codec token；continuous encoder feature 或 raw waveform chunk projection 都是可以評估的 representation candidates。

## 可能的弱點 / open questions

### 1) Audio scope 偏 ASR / S2TT，不是 general audio reasoning
FLEURS ASR 和 CoVoST S2TT 很重要，但無法代表 full audio reasoning。它沒有系統性評估 overlapping speech、non-speech audio events、speech+environment mixed audio、speaker diarization、turn-taking intent。

### 2) 沒有 timestamp-grounded explanation
Thinking mode 只是讓模型輸出 reasoning trace，不代表 trace grounded 在 audio timeline。對 AnyAudio-Judge + FlashTrace 那種「幾秒到幾秒發生問題」的需求，Gemma 4 還需要額外 attribution / grounding 方法。

### 3) Encoder-free 12B 很有趣，但缺少 ablation 細節
作者展示 12B raw audio chunk projection 可行，但沒有充分回答：多少 audio data、多少 compute、什麼 curriculum、和 frozen encoder 在同 compute 下怎麼比較。這正好可以變成我們 representation evaluation project 的問題。

### 4) Audio training data 不透明
paper 只說 large-scale multimodal dataset，cutoff January 2025，沒有公開 audio hours、語言比例、noise filtering、overlap handling、speaker diversity。因此不能直接拿來當 data pipeline recipe。

### 5) 音訊長度限制
官方 model card 說 audio input maximum length 是 30 seconds。對 long-form meeting、full-duplex dialogue、multi-turn audio reasoning，這仍然偏短。

## Tags
- speech-llm
- audio-reasoning
- multimodal-llm
- open-weight-model
- encoder-free-audio
- continuous-audio-representation
- raw-audio-projection
- audio-asr
- speech-translation
- long-context
- thinking-mode
- quantization-aware-training
- project-audio-model-evaluation
- project-full-duplex-data

## Concepts
- Gemma 4
- open-weight multimodal LLM
- thinking mode
- audio encoder
- encoder-free architecture
- raw audio chunks
- 40 ms audio chunks
- 16 kHz audio
- continuous audio representations
- USM-based Conformer encoder
- frozen audio encoder
- no vector quantization
- CoVoST
- FLEURS ASR
- speech-to-text translation
- quantization-aware training
- audio encoder footprint
- long-context efficiency
- multi-token prediction drafter
- local-global attention
- p-RoPE

## Citation
目前以 arXiv technical report 記錄；若之後找到正式 proceedings，再更新 citation。

```bibtex
@misc{team2026gemma4technicalreport,
  title={Gemma 4 Technical Report},
  author={{Gemma Team} and Sherif El Abd and Vaibhav Aggarwal and Robin Algayres and Alek Andreev and Olivier Bachem and Ian Ballantyne and Cormac Brick and Victor C{\u{a}}rbune and Michelle Casbon and Mayank Chaturvedi and Victor Cotruta and Alice Coucke and Phil Culliton and Robert Dadashi and Lucas Dixon and Mohamed Elhawaty and Utku Evci and Cl{\'e}ment Farabet and Johan Ferret and Filippo Galgani and Sertan Girgin and Jean-Bastien Grill and Maarten Grootendorst and Jiaxian Guo and Cassidy Hardin and Yanzhang He and Steven M. Hernandez and Omri Homburger and L{\'e}onard Hussenot and Juyeong Ji and Armand Joulin and Aishwarya Kamath and Parnian Kassraie and Olivier Lacombe and Preethi Lahoti and Ga{\"e}l Liu and Gus Martins and Luciano Martins and Tatiana Matejovicova and Ramona Merhej and Nikola Momchev and Sneha Mondal and Ryan Mullins and Sindhu Raghuram Panyam and Shreya Pathak and Sarah Perrin and Andr{\'e} Susano Pinto and Etienne Pot and Ang{\'e}line Pouget and Alexandre Ram{\'e} and Sabela Ramos and Douglas Reid and David Rim and Morgane Rivi{\`e}re and Karsten Roth and Louis Rouillard and Omar Sanseviero and Pier Giuseppe Sessa and Shane Settle and Danila Sinopalnikov and Sara Smoot and Piotr Stanczyk and Andreas Steiner and Lawrence Stewart and Ilya Tolstikhin and Michael Tschannen and Anton Tsitsulin and Nino Vieillard and Renjie Wu and Pingmei Xu and Haichuan Yang and Edouard Yvinec and Li Zhang and Joe Zou and others},
  year={2026},
  eprint={2607.02770},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2607.02770}
}
```
