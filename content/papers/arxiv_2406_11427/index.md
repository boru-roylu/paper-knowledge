---
paper_key: arxiv_2406_11427
canonical_id: "arxiv:2406.11427"
title: "DiTTo-TTS: Diffusion Transformers for Scalable Text-to-Speech without Domain-Specific Factors"
year: 2025
venue: "ICLR 2025"
url: "https://arxiv.org/abs/2406.11427"
pdf_url: "https://arxiv.org/pdf/2406.11427"
status: read
rating: 8.8
tags:
  - tts
  - diffusion
  - diffusion-transformer
  - latent-diffusion
  - speech-vae
  - voice-cloning
  - project-generative-speech-representation-evaluation
  - project-tts-data-pipeline
  - project-audio-model-evaluation
created: 2026-06-20
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`iclr2025_conference.tex`, section files, tables), official demo/OpenReview pages, and public OpenReview discussion.

## Links

- [Original URL](https://arxiv.org/abs/2406.11427)
- [arXiv abstract](https://arxiv.org/abs/2406.11427)
- [PDF](https://arxiv.org/pdf/2406.11427)
- [arXiv source](https://arxiv.org/src/2406.11427)
- [Demo / project page](https://ditto-tts.github.io/)
- [OpenReview forum](https://openreview.net/forum?id=hQvX9MBowC)
- [Official demo-page GitHub repo](https://github.com/ditto-tts/ditto-tts.github.io)

## 一句話總結

DiTTo-TTS 是 ICLR 2025 的 zero-shot TTS paper：它證明 latent diffusion / DiT 可以在不依賴 phoneme、phoneme-level duration、pitch extractor 這類 TTS-specific factors 的情況下，透過 Mel-VAE latent、speech length predictor、DiT backbone、text-speech latent alignment 和 scale 到 82K hours / 790M parameters，做到接近或優於當時 strong TTS baselines 的效果。

## 這篇在解決什麼問題

傳統高品質 TTS pipeline 常依賴很多 domain-specific factors：

- phoneme conversion / G2P。
- phoneme-level duration / forced alignment。
- pitch / prosody extractor。
- 多階段 semantic/acoustic modeling。
- 手工設計的 TTS-specific alignment machinery。

這些元件能提升品質，但也讓大規模資料擴展和跨語言擴展變複雜。近年 Simple-TTS / E3 TTS 顯示可以不用這些東西做 latent diffusion TTS，但性能還不夠強。

DiTTo-TTS 問的是：

```text
能不能像 image/video LDM 那樣，
只用 pretrained text encoder + speech autoencoder + diffusion transformer，
讓 cross-attention 自己學 text-speech alignment，
而不是依賴 phoneme/duration/pitch 這些 TTS-specific factors？
```

## 核心方法

### 1) Latent diffusion TTS over Mel-VAE latent

DiTTo-TTS 不直接生成 waveform，也不是生成 EnCodec/DAC tokens，而是使用 CLaM-TTS 的 **Mel-VAE** 作為 speech latent target。pipeline 是：

```text
text
  -> pretrained text encoder
  -> DiT latent diffusion backbone
  -> Mel-VAE latent
  -> Mel-VAE decoder
  -> mel-spectrogram
  -> BigVGAN vocoder
  -> waveform
```

作者強調 Mel-VAE 的 code rate 約 10.76 Hz，比 EnCodec / DAC 的 latent sequence 短很多，這讓 diffusion backbone 的 sequence modeling burden 顯著降低。

### 2) Span masking for zero-shot audio prompting

訓練時使用 random span masking。模型看到一段 partially masked speech latent，並只在 masked region 上學 denoising。這和 Voicebox / Audiobox 類 setup 類似，使模型能在 inference 時用 3 秒 speech prompt 做 zero-shot voice cloning / continuation / cross-sentence synthesis。

### 3) Speech length predictor

作者不預測每個 phoneme 的 duration，而是預測 **總 speech latent length**。

這點很重要：它移除了 phoneme-level duration supervision，但仍讓 diffusion model 在 inference 時知道要生成多長的 latent。speech length predictor 是 encoder-decoder Transformer：

- encoder 看 text。
- decoder 接受 speech prompt token sequence。
- output 是要生成的 token count distribution。
- CE loss 訓練，inference 時可 top-k sampling。

這也帶來 speech rate control：手動調整 latent total length，可以讓同一句話變快或變慢。

### 4) DiT backbone and architecture search

作者比較 U-Net / Flat-U-Net / DiT，結論是 DiT 比 U-Net 更適合 compressed speech latent。最終架構包含：

- Transformer / DiT backbone。
- cross-attention 對 text representation。
- global AdaLN。
- RoPE。
- gated MLP。
- long skip connection。
- mean-pooled text embedding 作 global condition。

DiTTo 的設計重點不是「發明全新 backbone」，而是系統性找出 LDM-based TTS 在沒有 phoneme/duration 時該怎麼設計才會 work。

### 5) Text-speech representation alignment / Mel-VAE++

作者發現 cross-attention 的 text-speech alignment 很依賴 text encoder 和 speech latent space 的距離。

他們比較：

- ByT5：text-only pretrained encoder。
- SpeechT5：jointly trained on speech/text。
- Mel-VAE：原始 speech latent codec。
- Mel-VAE++：用 auxiliary language modeling objective 把 speech latent 對齊到 text encoder latent。

核心做法是在 neural audio codec fine-tuning 時，將 speech latent 經 linear projection 後當作 language decoder 的 condition，讓 frozen LM decoder 從 speech latent 預測 text token。這相當於把 semantic content 注入 Mel-VAE latent。

## Training / Data

Dataset：

- English-only：55K hours。
- Multilingual：82K hours，12K+ speakers，9 languages。
- 語言：English, Korean, German, Dutch, French, Spanish, Italian, Portuguese, Polish。
- 使用 publicly available speech-transcript datasets。
- data preprocessing 大致 follow CLaM-TTS，但作者說 include all samples without filtering，且 text prompts 不使用 speaker metadata。
- audio 統一到 22,050 Hz。
- speech length predictor 額外使用 LibriSpeech `train-clean-100`, `train-clean-360`, `train-other-500`。

Training：

- DiTTo-en 有 S / B / L / XL 四種 size：
  - S：41.89M。
  - B：151.58M。
  - L：507.99M。
  - XL：739.97M。
- DiTTo-multi：790.44M。
- 4 NVIDIA A100 40GB GPUs。
- diffusion steps for training：1000。
- optimizer：AdamW，LR `1e-4`，cosine schedule，1K warmup。
- DiTTo-en S/B：max token size 5120，gradient accumulation 2，1M steps。
- DiTTo-en L/XL：max token size 1280，gradient accumulation 4，1M steps。
- DiTTo-multi XL：max token size 320，gradient accumulation 4，1M steps。
- text encoder：DiTTo-en 用 SpeechT5；DiTTo-multi 用 ByT5。

Inference：

- speech length predictor 先估 total length `L`。
- diffusion backbone 生成長度為 `L` 的 speech latent。
- Mel-VAE decoder -> mel-spectrogram。
- BigVGAN `bigvgan_22khz_80band` vocoder -> waveform。

Evaluation：

- continuation：給 text + 前 3 秒對應 speech prompt，生成後續 speech。
- cross-sentence：給 target text + 不同句子的 3 秒 prompt 和 transcript，合成 target text 但保持 prompt speaker/style。
- metrics：WER / CER / SIM-o / SIM-r / SMOS / CMOS。

## 主要結果

### 1) English continuation / cross-sentence 結果很強

English continuation 上，DiTTo-en-XL：

- WER 1.78。
- CER 0.48。
- SIM-o 0.5773。
- SIM-r 0.6075。
- 生成 10 秒 speech 的 inference time 1.616s。

更長訓練 + DDIM sampling 的 DiTTo-en-XL dagger：

- SIM-o 0.6051。
- SIM-r 0.6283。

English cross-sentence 上，DiTTo-en-XL：

- WER 2.56。
- CER 0.89。
- SIM-o 0.6270。
- SIM-r 0.6554。

Voicebox 在 cross-sentence table 仍有更好的 WER/SIM，但 DiTTo 明顯優於 YourTTS / CLaM-TTS / Simple-TTS，且架構更簡化。

### 2) Human evaluation

在 40 個 LibriSpeech test-clean speakers / samples 的 cross-sentence human evaluation：

- Simple-TTS：SMOS 2.15 ± 0.19，CMOS -1.64。
- CLaM-en：SMOS 3.42 ± 0.16，CMOS -0.52。
- DiTTo-en-XL：SMOS 3.91 ± 0.16，CMOS 0.00。
- Ground Truth：SMOS 4.08 ± 0.14，CMOS +0.13。

這支持作者 claim：DiTTo-en-XL 在 speaker similarity 和自然度上接近 GT reconstruction / GT。

### 3) DiT 比 U-Net 更適合 compressed speech latent

English cross-sentence ablation：

| Model | WER | SIM-r | Inference time |
|---|---:|---:|---:|
| U-Net | 3.70 | 0.3890 | 1.328s |
| Flat-U-Net | 2.97 | 0.5471 | 1.310s |
| DiTTo-mls | 2.93 | 0.5877 | 0.903s |

這說明一旦 target latent 已經被 Mel-VAE 強烈壓縮，傳統 U-Net 的 down/up sampling 反而可能造成信息損失；flattened / Transformer-style modeling 更合適。

### 4) Variable-length modeling 很重要

Speech length predictor 明顯優於 fixed-length padding：

| Length modeling | WER | SIM-r | Inference time |
|---|---:|---:|---:|
| fixed-length-full | 8.89 | 0.4078 | 1.254s |
| fixed-length | 6.81 | 0.4385 | 1.265s |
| SLP-CE | 5.58 | 0.4961 | 0.948s |
| SLP-Regression | 5.36 | 0.4636 | 0.930s |

這是對 TTS data / modeling 很實用的結論：不需要 phoneme-level duration，但完全 fixed-length + padding 也不行；總長度 prediction 是一個很好的折衷。

### 5) Representation choice: Mel-VAE beats EnCodec / DAC for this diffusion TTS

作者比較 Mel-VAE、EnCodec、DAC：

- Mel-VAE latent sequence 短、維度低，所以 diffusion 訓練/推理更容易。
- DAC 的 PESQ / ViSQOL 更高，但 latent dimension 1024、code rate 高，對 DiTTo 來說更難學。
- EnCodec 雖然 dimension 128，但 latent sequence 仍長，codec quality 也較差。

這和我們的 representation project 高度一致：codec reconstruction quality 不是 downstream generator quality；latent length / dimension / semantic alignment / learnability 才是重點。

### 6) Semantic alignment helps

ByT5 + raw Mel-VAE 最差：

- WER 6.22，CER 3.82。

用 SpeechT5 或 Mel-VAE++ 都能大幅改善：

- SpeechT5 + Mel-VAE：WER 3.07。
- ByT5 + Mel-VAE++：WER 3.11。
- SpeechT5 + Mel-VAE++：WER 2.99。

解讀：text encoder 或 speech latent 至少其中一邊要被 joint speech/text training 拉近，cross-attention alignment 才會穩。

## Project relevance

### project-generative-speech-representation-evaluation

非常高相關。DiTTo-TTS 是這個 project 的核心 reference 之一，因為它明確比較了不同 target latent：

- Mel-VAE vs EnCodec vs DAC。
- mel-spectrogram direct target vs compressed latent。
- Mel-VAE 不同 compression ratio。
- semantic content injection / Mel-VAE++。

它支持我們的 thesis：speech representation 不只是 reconstruction；要看 downstream generator 的 learnability、sequence length、latent dimension、semantic alignment、inference cost、WER/SIM。

### project-tts-data-pipeline

高相關。DiTTo-TTS 的資料觀點是「少用 TTS-specific preprocessing，靠大規模 speech-transcript data + text encoder + latent model scale」。它刻意不使用 speaker metadata in text prompts，也不做複雜 filtering。這和我們 data pipeline 的關係是：

- 如果走 scalable TTS，要避免太依賴 phoneme/duration/pitch 這類 brittle preprocessing。
- 但它仍需要 transcripts、prompt text、speech prompt、duration/length labels、speaker similarity evaluation。
- speech length predictor 是 data formatting 的關鍵：dataset 需要保留 text length、speech latent length、prompt segment。
- 對 noisy web data，雖然 paper 說 include all samples without filtering，但我們仍不能直接照抄，因為 full-duplex / podcast data 的 overlap、ASR error、speaker swap 更嚴重。

### project-audio-model-evaluation

高相關。DiTTo-TTS 的 evaluation 很適合納入 TTS model dashboard：

- objective：WER / CER / SIM-o / SIM-r / inference time。
- subjective：SMOS / CMOS。
- tasks：continuation vs cross-sentence。
- representation ablation：codec PESQ/ViSQOL vs downstream WER/SIM。

尤其 SIM-o / SIM-r 的區分很有用：SIM-o 比較 generated speech 和 original target speech；SIM-r 比較 generated speech 和 target speech 經 autoencoder/vocoder reconstruction 後的版本，比較能扣掉 codec/vocoder reconstruction ceiling。

## Related papers in my pool

- [LongCat-AudioDiT](../arxiv_2603_29339/)：後續 waveform-latent diffusion TTS；和 DiTTo-TTS 形成 Mel-VAE latent vs Wav-VAE waveform latent 的對照。
- [SODA](../arxiv_2602_16687/)：discrete audio foundation model scaling；DiTTo-TTS 則是 latent diffusion TTS without phoneme/duration。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：image-side reconstruction-vs-generation dilemma；DiTTo-TTS 的 Mel-VAE / EnCodec / DAC ablation 是 speech-side evidence。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free / continuous speech representation route，可和 DiTTo-TTS 的 Mel-VAE route 比較。
- [Seed-TTS](../arxiv_2406_02430/)：reviewer 指出 Seed-TTS-DiT 也已展示 total duration conditioning / diffusion TTS 的強效果；DiTTo-TTS 的貢獻更偏 systematic ablation and recipe。
- [TASTE](../arxiv_2504_07053/)：text-aligned speech representation；DiTTo-TTS 的 Mel-VAE++ 也是在 speech latent 裡注入 semantic alignment。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：引用 DiTTo-TTS 並延伸到 waveform latent；它也指出 Wav-VAE reconstruction 與 downstream TTS quality 的 mismatch。

## OpenReview / reviewer discussion

OpenReview forum：<https://openreview.net/forum?id=hQvX9MBowC>。Decision：Accept (Poster)。

主要 reviewer 爭點：

1. **novelty 是否足夠**
   多位 reviewer 認為 LDM-based TTS、cross-attention alignment、移除 phoneme/duration 並非完全新，Seed-TTS-DiT、Simple-TTS、NaturalSpeech 2/3 都已有相近方向。作者回應說主貢獻不是「第一個不用 phoneme/duration」，而是系統性分析哪些 factors 讓這條路徑達到 strong performance。

2. **domain-specific factors 的定義**
   Reviewer 質疑：既然用了 SpeechT5/ByT5、neural audio codec、speech length predictor，怎麼能說不依賴 domain-specific factors？作者定義 domain-specific factors 為 phoneme / phoneme-level duration / pitch 這類傳統 TTS-specific preprocessing；pretrained encoder 和 speech length predictor 不屬於他們定義下的 domain-specific alignment。

3. **code/checkpoint release**
   Reviewer 問是否會 release code/checkpoints。作者說計畫分階段 release inference code、pre-trained weights、eventually full training implementation，但受 legal issues 限制。到目前 note 撰寫時，找到的是官方 demo page repo，未確認正式官方 training/inference code 和 checkpoints 已公開。

4. **低資料量 robustness**
   Reviewer 問低資料量下是否仍穩。作者補做約 50 hours 的 DiTTo-libritts-0.05k，結果 WER 9.25 / SIM-r 0.3336，明顯變差；作者承認 phoneme-level duration 可能在小資料場景更有 robustness。

5. **統計顯著性**
   Reviewer 要求 confidence intervals / p-values。作者補了 objective metrics 的 CI，並說 variance 很小；但 baselines 多數不報 CI，直接統計比較仍有限。

6. **Mel-VAE vs mel-spectrogram / codec**
   Reviewer 問為什麼不直接 model mel-spectrogram。作者補充 DiTTo-mel / DiTTo-encodec / DiTTo-mls 比較，主張 compression 越高 sequence length 越短，WER 越好；DiTTo-mel 雖有較高 SIM-o，但 overall intelligibility / efficiency 不如 Mel-VAE target。

整體看，OpenReview 對這篇的定位很清楚：技術 novelty 不是最大亮點，亮點是 large-scale systematic empirical recipe 和 ablation。

## 我該不該細讀

應該細讀，尤其是如果我們要設計 TTS representation / latent choice / duration-free training pipeline。

最值得讀：

1. Section 3：Mel-VAE latent diffusion、speech length predictor、Mel-VAE++ semantic alignment。
2. Section 5：DiT vs U-Net、variable length vs fixed length、text-speech alignment。
3. Section 6：Mel-VAE vs EnCodec/DAC、architecture choices。
4. Appendix A.13 / A.20 / A.21：data scaling、mel-spectrogram target、subjective validation。
5. OpenReview：novelty 和 domain-specific factor 的討論很有參考價值。

## 可能的弱點 / open questions

1. **正式 code/checkpoints 不明**
   Demo page 公開，但 paper/review 討論中的 full release plan 似乎受 legal issues 影響。若要實作，需要確認是否有官方 inference/training release。

2. **domain-specific factor claim 需要小心解讀**
   它不是完全不用 speech-specific components；它仍用 Mel-VAE、speech prompt、length predictor、speech/text pretrained encoders。比較準確的說法是：不使用 phoneme / phoneme-level duration / pitch extractor。

3. **small-data regime 較弱**
   作者自己在 OpenReview 補充 50 hours setting 表現差，暗示這條路線需要一定資料 scale；phoneme-level duration 在低資料場景可能仍有用。

4. **Mel-VAE 來自 CLaM-TTS collaboration**
   Mel-VAE 本身是關鍵，但它不是完全泛用 open codec；若我們要重現，需要確認可取得性與訓練細節。

5. **對 conversational / full-duplex data 未直接處理**
   這篇是 zero-shot TTS，不是 dialogue overlap / backchannel / dual-channel generation。對 full-duplex project 的用處主要是 latent representation 和 duration-free generation recipe。

## Tags

#tts #diffusion #diffusion-transformer #latent-diffusion #speech-vae #mel-vae #voice-cloning #zero-shot-tts #representation-evaluation #project-generative-speech-representation-evaluation #project-tts-data-pipeline #project-audio-model-evaluation

## Concepts

- DiTTo-TTS
- Diffusion Transformer
- latent diffusion TTS
- Mel-VAE
- Mel-VAE++
- speech length predictor
- zero-shot TTS
- cross-sentence TTS
- continuation TTS
- domain-specific factors
- phoneme-free TTS
- duration-free TTS
- semantic injection
- text-speech latent alignment
- SIM-o
- SIM-r
- variable-length modeling
- speech rate control
- codec learnability
- latent sequence length

## Citation

```bibtex
@inproceedings{lee2025dittotts,
  title={DiTTo-TTS: Diffusion Transformers for Scalable Text-to-Speech without Domain-Specific Factors},
  author={Keon Lee and Dong Won Kim and Jaehyeon Kim and Seungjun Chung and Jaewoong Cho},
  booktitle={International Conference on Learning Representations},
  year={2025},
  url={https://openreview.net/forum?id=hQvX9MBowC}
}
```
