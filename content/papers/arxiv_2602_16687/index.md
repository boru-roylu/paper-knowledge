---
paper_key: arxiv_2602_16687
canonical_id: "arxiv:2602.16687"
title: "Scaling Open Discrete Audio Foundation Models with Interleaved Semantic, Acoustic, and Text Tokens"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2602.16687"
pdf_url: "https://arxiv.org/pdf/2602.16687"
status: read
rating: 8.8
tags:
  - speech-llm
  - audio-foundation-model
  - discrete-audio
  - scaling-law
  - speech-tokenizer
  - audio-codec
  - speech-data
  - project-tts-data-pipeline
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
created: 2026-06-18
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex` and section files), official project page, and released Hugging Face / GitHub links.

## Links

- [Original URL](https://arxiv.org/abs/2602.16687)
- [arXiv abstract](https://arxiv.org/abs/2602.16687)
- [PDF](https://arxiv.org/pdf/2602.16687)
- [arXiv source](https://arxiv.org/src/2602.16687)
- [Project page](https://soda-audio.github.io/)
- [Training code](https://github.com/potsawee/marin/tree/audio-release-pr/experiments/audio)
- [Models and data collection](https://huggingface.co/collections/SALT-NLP/soda-discrete-audio-models)
- [SODA 1.7B base model card](https://huggingface.co/soda-research/soda-1.7b-base)

## 一句話總結

這篇把 discrete audio foundation model 當成 text LLM 一樣做 next-token prediction scaling study：用 Mimi semantic/acoustic tokens + text tokens 做 utterance-level interleaving，系統比較 data source、text mixture、token composition，並用 64 個 IsoFLOP runs 推出 discrete audio 的 compute-optimal scaling law，最後訓練 SODA 135M 到 4B models。

## 這篇在解決什麼問題

現有 audio language model 大致有三種限制：

1. **text-first LLM extension**：把 speech/audio 包成 text LLM 的 adapter 或 side channel，容易受 semantic bottleneck 限制，acoustic detail 不夠 native。
2. **semantic-only speech token model**：只保留 content-oriented speech units，對 ASR / semantic speech tasks 有幫助，但 speaker、prosody、timbre、fine acoustic detail 會被丟掉。
3. **native audio models**：像 Moshi / Llama-Mimi 這類模型更 native，但常偏 task-specific，或沒有把 text capability 和 audio generation 放在同一個可 scale 的 framework 裡。

作者想回答一個更工程化的問題：如果把大規模 speech data 轉成 discrete audio tokens，能不能像 text LLM 一樣訓練一個 decoder-only autoregressive backbone，讓 audio continuation、TTS、ASR、text continuation 都變成同一個 next-token prediction 問題？

## 核心方法

### 1) Unified decoder-only architecture

模型是 Qwen3-style decoder-only Transformer，但不是從 Qwen3 warm-start 作為主線，而是 cold-start random initialization。原因是作者發現 warm-start 雖然保留 text knowledge，但 audio cross-modal learning 會不穩，甚至出現 loss spike。

### 2) Mimi discrete audio tokenizer

audio 用 Mimi tokenizer 離散化：

- frame rate：12.5 Hz。
- 使用前 8 個 RVQ codebooks。
- token rate：約 100 tokens/sec。
- 第一個 codebook 較偏 semantic content。
- 後面 codebooks 補 acoustic details。

這使模型可以同時看到 semantic token、acoustic token 和 text token，而不是只在 semantic speech unit 上訓練。

### 3) Utterance-level audio/text interleaving

作者沒有做 word-level alignment，而是做 utterance-level interleaving：

```text
audio utterance -> transcript -> audio utterance -> transcript ...
```

也訓練 text-first variant：

```text
transcript -> audio utterance -> transcript -> audio utterance ...
```

這個設計讓同一個 decoder-only NTP objective 同時學到四種能力：

- audio continuation
- text continuation
- audio -> text，也就是 ASR-style behavior
- text -> audio，也就是 TTS-style behavior

### 4) Scaling law via IsoFLOP

作者訓練 64 個小到中型模型，compute span 從 `3e18` 到 `3e20` FLOPs，對不同 model size / token budget 做 IsoFLOP analysis。主要 scaling law：

```text
N* ∝ C^0.367
D* ∝ C^0.579
```

結論是 optimal data grows about 1.6x faster than optimal model size。換句話說，discrete audio tokens 的 information density 可能比 text tokens 更低，所以要更 aggressive 地增加 data/tokens。

## Training / Data

### Speech data

作者比較三個 speech sources：

- **Yodas**：500K+ hours / 100+ languages；實際使用約 165K English hours，約 131B tokens。
- **Emilia**：101K hours / 6 languages；實際使用約 140K English hours，speech 更自然、spontaneous。
- **MLS**：45K English audiobook hours；最後排除，因為 transcripts uncased / unpunctuated，而且 fixed 10-20 sec chunks 讓 cross-modal task 很差。

MLS 的失敗很值得注意：在作者的設定中，MLS 帶來 ASR-WER 92.6% / TTS-WER 35.7% 這種明顯差的 cross-modal 結果。這表示「大量 clean audiobook audio」不一定適合 unified audio/text NTP；transcript formatting、segmentation、punctuation、utterance boundary 都會影響 downstream。

最終 recipe：

- 95% speech tokens。
- 5% Nemotron-CC text tokens。
- speech 內部約 51.6% Yodas English、28.8% Emilia-YODAS English、14.6% Emilia English。
- large training 用 audio-first + text-first 各 250B tokens，總共 500B tokens，約 4 epochs。

### Text mixture

加入 text-only data 能改善 text NLL 和 text tasks，但太多 text 會傷害 audio。作者 sweep 後選擇 5% Nemotron-CC：

- 0% -> 2.5% text：text knowledge 明顯變好。
- 5% 左右：audio NLL 大致穩定。
- 超過 5%：audio modeling 開始 degraded。

### Token composition ablation

作者比較三種 token composition：

- **S**：semantic-only audio tokens。
- **S+A**：semantic + acoustic audio tokens。
- **S+A+T**：semantic + acoustic + text tokens。

關鍵觀察：

- semantic-only 對 sBLIMP / sWUGGY 這類 speech linguistic probing 較強。
- 加 acoustic tokens 會改善 acoustic modeling，但會拉低一些 semantic probing score。
- 加 text tokens 後才能真正 unlock ASR / TTS / text tasks，而且不太傷 acoustic modeling。

這裡的 tradeoff 對 speech representation evaluation 很重要：semantic reconstruction / acoustic reconstruction / cross-modal controllability 不是同一件事。

## 主要結果

### 1) Validation NLL 可以預測 downstream capability

作者發現 validation NLL 和 downstream metrics 強相關，尤其 cross-modal metrics：

- ASR WER Spearman 約 0.95。
- TTS WER Spearman 約 0.96。
- TTS speaker similarity correlation 約 0.99。
- text tasks 多數也大於 0.8，HellaSwag 在 NLL 低於約 3.6 後出現 emergence。

這支持一個很實用的方向：對 audio foundation model，不一定每次都要跑昂貴 downstream eval；若 data/tokenizer/architecture 固定，validation NLL 可能可以當 early proxy。

### 2) SODA scaling

作者把 recipe 放大到 SODA-base 135M / 600M / 1.7B / 4B，全部訓練 500B tokens。4B run 約 `1.3e22` FLOPs，官方 project page 說約一週 v5p-256 TPU。

主要趨勢：

- ASR WER 從 135M 的 28.1 降到 4B 的 5.0。
- TTS WER 從 135M 的 11.2 降到 4B 的 6.1。
- TTS SIM 從 0.500 提升到 0.560 左右後開始飽和。
- HellaSwag 從 28.7 提升到 52.6，text knowledge 隨 scale 更明顯。
- acoustic Salmon score 約 70 附近，scale 後改善有限。

這表示 scale 對 ASR/TTS/text knowledge 明顯有效，但 acoustic modeling 或 speaker similarity 可能更受 tokenizer / objective / data quality 限制。

### 3) Cold-start vs warm-start

作者比較從 Qwen3 0.6B / 1.7B warm-start 和 cold-start：

- warm-start 保留較好的 text knowledge。
- 但 warm-start 在 audio training 中不穩，600M 甚至出現 loss spike，ASR 從 21% degraded 到 34%。
- cold-start 對 ASR 明顯更好，例如 1.7B final ASR 7.0% vs warm-start 17.3%。
- TTS 最後比較接近，WER 約 6.5-7.5，SIM 約 0.56。

作者的建議可以解讀為：如果目標是 general audio backbone，cold-start 更穩；如果目標很需要 text reasoning / text knowledge，warm-start 或 hybrid strategy 仍值得研究。

### 4) S2ST fine-tuning demo

作者用 SODA 做 voice-preserving speech-to-speech translation fine-tuning，格式是：

```text
source audio -> source text -> target text -> target audio
```

在 CVSS-T X->English 任務上，600M SODA 明顯勝過 scratch / Qwen3-only。SODA-P 因為有 multilingual pretraining，在 source-language ASR 上更好，因此 BLEU 更高。這證明 audio pretraining 對 S2ST 很關鍵，text-only LLM backbone 不足以替代。

## Project relevance

### project-generative-speech-representation-evaluation

高度相關。這篇提供一個非常直接的 representation / tokenizer scaling reference：

- semantic-only token 在 linguistic probing 上較好，但不能覆蓋 acoustic detail。
- semantic+acoustic token 改善 acoustic modeling，但可能傷 semantic probing。
- semantic+acoustic+text 才能同時支援 ASR/TTS/text continuation。
- validation NLL 對 downstream ASR/TTS/SIM 有強 correlation，可作為 representation learnability / compute-to-quality 的 proxy。

對我們的 `Generative Speech Representation Evaluation` 來說，SODA 提供一個 concrete benchmark idea：比較不同 codec / VAE / tokenizer / continuous encoder 時，不只看 reconstruction FAD/PESQ，也要看「固定 compute 下 NLL 降多快」以及「NLL 是否預測 downstream generation quality」。

### project-tts-data-pipeline

高度相關。這篇的 data source ablation 對 TTS pipeline 很有價值：MLS 這種看似乾淨的大量 audiobook data，因為 uncased / unpunctuated transcript 和 fixed chunking，反而造成 cross-modal ASR/TTS 表現很差。對我們來說，這支持幾個 data cleaning 原則：

- transcript punctuation / casing / normalization 不是小事。
- utterance boundary 和 chunking 會影響 TTS/ASR joint modeling。
- Yodas + Emilia 這類資料的互補性比單一 source 更重要。
- 少量 high-quality text-only data 可以補 text knowledge，但比例太高會傷 audio modeling。

### project-audio-model-evaluation

高度相關。SODA 的 evaluation split 很適合借來做 audio foundation model dashboard：

- speech linguistic probing：sBLIMP / sWUGGY。
- acoustic modeling：Salmon。
- text knowledge：tBLIMP / tWUGGY / HellaSwag。
- cross-modal：ASR WER、TTS WER、TTS speaker similarity。
- training proxy：validation NLL。

這比單看 MOS / WER 更完整，因為它把 semantic、acoustic、text、cross-modal 四個能力分開。

## Related papers in my pool

- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：image-side 起點；SODA 補上 audio discrete token 的 learnability / scaling law。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech tokenization；和 SODA 一樣關心 speech token + text 的 coupling，但 TASTE 更偏 aligned representation，SODA 更偏 large-scale NTP foundation model。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free continuous AudioVAE route；可和 SODA 的 discrete Mimi token route 比較。
- [FunASR](../../tools/modelscope-funasr/)：可作 SODA 類 model 的 ASR / punctuation / diarization / TTS data cleaning support tool。
- [PlanAudio](../arxiv_2605_28063/)：speech+sound composite generation；SODA 現階段較偏 speech/text foundation backbone，PlanAudio 提供 composite audio target task。
- [AnyAudio-Judge](../arxiv_2606_03116/)：可以用 rubric judge 評估 SODA 類 generated audio 是否符合 transcript、speaker、event、style constraints。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。TeX source 使用 ICML 2026 preprint style，但截至 2026-06-18 只以 arXiv preprint 記錄，尚未在 note 中標為正式 accepted paper。

## 我該不該細讀

建議細讀，尤其是如果我們要做 speech tokenizer / codec / VAE / continuous encoder evaluation。

最值得讀的部分：

1. Section 4：data source、text mixture、token composition ablation。
2. Section 5：IsoFLOP scaling law 和 validation NLL -> downstream correlation。
3. Section 6：SODA scaling、warm-start vs cold-start、S2ST fine-tuning。
4. Appendix：training details、full correlation plots、data recipe。

這篇對我們最重要的不是「SODA 4B 本身多強」，而是它提供了一套可重現的問題 framing：representation / data / token composition 的選擇可以用 NLL、downstream ASR/TTS/SIM 和 compute scaling 一起評估。

## 可能的弱點 / open questions

1. **Mimi tokenizer 是單一選擇**
   Scaling law 可能和 Mimi 100 tokens/sec、8 codebooks、12.5 Hz 設定強綁定。換成 EnCodec、DAC、SpeechTokenizer、TASTE、VoxCPM AudioVAE V2，optimal data/model scaling 可能不同。

2. **SODA 還不是強 general audio reasoning model**
   作者也承認 pretraining alone 的 emergent audio capabilities 有限；S2ST 是 fine-tuning demo，不代表 base model 已具備 broad instruction-following audio intelligence。

3. **Acoustic / speaker quality 有飽和**
   scale 後 ASR/text 明顯改善，但 TTS-SIM 和 Salmon acoustic metrics 改善有限。這可能表示 tokenizer、loss weighting、sampling strategy 或 data diversity 比單純 scale 更關鍵。

4. **English-centric**
   SODA-base 主要是 English speech data；SODA-P 的 S2ST 結果顯示 multilingual pretraining 對 source language ASR 很重要。若要做 multilingual TTS/full-duplex，data recipe 需要重新設計。

5. **Safety**
   官方模型支援 voice-conditioned TTS / continuation，論文本身也提到 voice cloning、deepfake、fraud risk，需要 watermarking、consent、detection 等配套。

## Tags

#speech-llm #audio-foundation-model #discrete-audio #scaling-law #speech-tokenizer #audio-codec #speech-data #tts #asr #project-tts-data-pipeline #project-generative-speech-representation-evaluation #project-audio-model-evaluation

## Concepts

- SODA
- discrete audio foundation model
- semantic-acoustic-text interleaving
- Mimi tokenizer
- RVQ codebooks
- utterance-level interleaving
- next-token prediction
- audio scaling law
- IsoFLOP analysis
- validation NLL as downstream proxy
- cold-start audio model training
- warm-start instability
- text mixture ratio
- speech data source ablation
- voice-preserving S2ST
- representation learnability

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{manakul2026scalingopendiscreteaudiofounda,
  title={Scaling Open Discrete Audio Foundation Models with Interleaved Semantic, Acoustic, and Text Tokens},
  author={Potsawee Manakul and Woody Haosheng Gan and Martijn Bartelds and Guangzhi Sun and William Held and Diyi Yang},
  year={2026},
  eprint={2602.16687},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2602.16687}
}
```
