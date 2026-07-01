---
paper_key: arxiv_2304_09116
canonical_id: "arxiv:2304.09116"
title: "NaturalSpeech 2: Latent Diffusion Models are Natural and Zero-Shot Speech and Singing Synthesizers"
year: 2023
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2304.09116"
pdf_url: "https://arxiv.org/pdf/2304.09116"
status: read
rating: 9
tags:
  - tts
  - zero-shot-tts
  - latent-diffusion
  - speech-codec
  - speech-data
  - project-tts-data-pipeline
  - project-generative-speech-representation-evaluation
created: 2026-07-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main_arxiv.tex`) and metadata. OpenReview lookup returned an API 403 for a matching forum, so no public review text was incorporated.

## Links

- [Original URL](https://arxiv.org/abs/2304.09116)
- [arXiv abstract](https://arxiv.org/abs/2304.09116)
- [PDF](https://arxiv.org/pdf/2304.09116)
- [arXiv source](https://arxiv.org/src/2304.09116)
- [Audio samples / project page](https://speechresearch.github.io/naturalspeech2)
- [Microsoft Speech Research](https://aka.ms/speechresearch)

## 一句話總結

NaturalSpeech 2 是 Microsoft 的 large-scale zero-shot TTS / singing synthesis system：它不用 VALL-E 類 discrete codec token + autoregressive LM，而是用 RVQ audio codec 產生接近 continuous 的 latent vectors，再用 non-autoregressive latent diffusion model 在 phoneme / duration / pitch / speech prompt 條件下生成 latent，最後由 codec decoder 轉回 waveform。

## 這篇在解決什麼問題

大規模 TTS 的核心目標不只是 intelligibility，而是 speech diversity：speaker identity、accent、timbre、prosody、style，甚至 singing。傳統單 speaker studio dataset 可以做到高音質，但無法覆蓋這些多樣性。

2023 左右的 large-scale zero-shot TTS，例如 VALL-E / AudioLM 類方法，常見路線是：

```text
speech waveform
  -> neural codec
  -> discrete codec tokens
  -> autoregressive language model
  -> generated codec tokens
  -> codec decoder waveform
```

NaturalSpeech 2 認為這條路線有兩個互相牽制的問題：

1. **token sequence 太長，AR 容易 error propagation**  
   如果 codec 用 RVQ，每個 acoustic frame 會有多個 residual tokens；flatten 後序列長度暴增，AR LM 容易 word skipping、word repeating、prosody 不穩或 collapse。

2. **compression vs reconstruction dilemma**  
   單 token VQ 壓縮率高、序列短，但會丟細節；多 RVQ token reconstruction 好，但生成難度變高。

NaturalSpeech 2 的回答是：不要把 speech 變成離散 token 序列給 AR LM，而是把 codec output 當成 frame-level continuous latent vector，用 diffusion model non-autoregressively 生成。

## 核心方法

### 1. Neural audio codec with continuous latent vectors

NaturalSpeech 2 的 codec 由 encoder、RVQ、decoder 組成。Audio encoder 將 16 kHz waveform 下採樣 200 倍，也就是每個 frame 約 12.5 ms。

雖然結構裡有 RVQ，但作者不是把每個 residual codebook ID flatten 成 discrete token sequence。它把多個 residual quantizer 對應的 codebook embeddings 加總：

```text
z_i = sum_j e^i_j
```

得到每個 frame 一個 quantized latent vector `z_i`，再把 `z = {z_i}` 當作 diffusion model 的 target。

這個設計有兩個作用：

- 對 generator 來說，它看到的是短很多的 frame-level vector sequence，而不是 `frame_count * RVQ_layers` 的長 token sequence。
- 對 storage / regularization 來說，仍可保存 codebook IDs 和 embeddings，而不必直接存大量 continuous vectors；也可以加 RVQ codebook cross-entropy regularization。

### 2. Latent diffusion model

NaturalSpeech 2 用 diffusion model 預測 codec latent vector `z`。Condition 來自 prior model：

```text
text
  -> phoneme sequence
  -> phoneme encoder
  -> duration predictor
  -> length expansion
  -> pitch predictor
  -> frame-level condition c
  -> diffusion model predicts latent z
```

Diffusion backbone 是 WaveNet-style network，輸入 noisy latent `z_t`、diffusion timestep `t` 和 condition `c`。模型直接預測 clean data `z_0`，作者表示這比直接預測 score 有更好 speech quality。

Loss 包含：

- data loss：`|| z_hat_0 - z_0 ||_2^2`
- score loss：用預測 `z_hat_0` 推回 score estimate
- RVQ cross-entropy loss `L_ce-rvq`：根據 residual quantizer 的 ground-truth codebook ID 做 auxiliary classification regularization
- duration loss
- pitch loss

### 3. Speech prompting for in-context learning

Zero-shot TTS 需要模型從 reference speech prompt 抽取 speaker / prosody / style。NaturalSpeech 2 在 training 時從 target speech latent sequence 裡 random crop 一段 `z^{u:v}` 當 speech prompt，要求模型生成剩下的 segments。

Prompt latent 會進入兩個地方：

1. **Duration / pitch predictors**  
   在 convolution layers 插入 Q-K-V attention，query 是 predictor hidden states，key/value 是 prompt encoder output。這讓 duration / pitch prediction 能跟 prompt 的 rhythm / pitch style 對齊。

2. **Diffusion model**  
   作者不讓 diffusion model 直接 cross-attend prompt hidden，因為這會暴露太多細節、可能誤導 generation。它先用 `m=32` 個 learnable query tokens attend 到 prompt hidden，得到壓縮 prompt representation，再讓 WaveNet hidden states attend 這個 compressed prompt，最後經 FiLM layer 注入 diffusion network。

這個設計等於把 prompt 變成 style/speaker/prosody conditioning，而不是把 prompt audio 直接複製。

### 4. Extensions

NaturalSpeech 2 還展示：

- zero-shot singing synthesis：可用 singing prompt，也可只用 speech prompt 生成 novel singing voice。
- voice conversion：source-aware diffusion process + target-aware denoising。
- speech enhancement：用 noisy source / noisy prompt 做 source-aware diffusion，再用 clean prompt 做 target-aware denoising。

這些 extension 不是主實驗的核心，但說明 latent diffusion + prompt conditioning 可以泛化到多種 speech synthesis tasks。

## Training / Data

### Data

主訓練資料：

- English subset of Multilingual LibriSpeech (MLS)
- 44K hours transcribed speech
- 約 2,742 male speakers + 2,748 female speakers
- 16 kHz audio

Preprocessing：

- text -> phoneme sequence via grapheme-to-phoneme conversion
- internal alignment tool 取得 phoneme-level duration
- PyWorld 提取 frame-level pitch

Evaluation：

- LibriSpeech test-clean：40 speakers、5.4 hours；每 speaker sample 15 utterances，共 600。
- VCTK：108 speakers；每 speaker sample 5 utterances，共 540。
- Both are unseen speakers relative to NaturalSpeech 2 training.
- Synthesis 時從同 speaker 的另一 utterance crop `sigma` 秒 prompt，主要報 3s prompt，也測 5s / 10s。

Singing：

- 作者 crawl web singing voices + paired lyrics。
- 用 speech processing model 移除 backing vocal / accompaniment。
- 用 ASR 過濾 misalignment。
- 約 30 hours singing data，upsample 後與 speech data 混合。

### Model scale

Appendix model config：

- Audio codec：27M params，16 RVQ blocks，codebook size 1024，codebook dimension 256，hop size 200。
- Phoneme encoder：72M。
- Duration predictor：34M。
- Pitch predictor：50M。
- Speech prompt encoder：69M。
- Diffusion model：183M，40 WaveNet layers。
- Total：約 435M parameters。

Training：

- codec：8x V100 16GB，batch 200 audios/GPU，440K steps，Adam lr 2e-4。
- diffusion/prior：16x V100 32GB，batch 6K latent frames/GPU，300K steps；作者說仍 underfitting，更長訓練會更好。
- optimizer：AdamW lr 5e-4，32K warmup，inverse square root schedule。

Inference：

- Euler ODE solver。
- TTS diffusion steps：150。
- temperature `tau = 1.2^2` for initial Gaussian noise.
- singing inference 用 1000 steps for better performance。

## 主要結果

### 1. Naturalness / CMOS

LibriSpeech / VCTK 上，NaturalSpeech 2 和 Ground Truth、YourTTS 比較：

- Ground Truth vs NaturalSpeech 2：LibriSpeech `+0.04`，基本持平。
- Ground Truth vs NaturalSpeech 2：VCTK `-0.30`。
- YourTTS vs NaturalSpeech 2：LibriSpeech `-0.65`，VCTK `-0.58`。

也就是 NaturalSpeech 2 明顯優於 YourTTS，LibriSpeech 上接近 ground-truth recording。

### 2. Prompt prosody similarity

NaturalSpeech 2 在 pitch/duration statistics 上大多比 YourTTS 更接近 prompt。以 LibriSpeech 為例：

- Pitch mean difference：YourTTS 10.52，NaturalSpeech 2 10.11。
- Pitch std difference：7.62 -> 6.18。
- Duration mean difference：0.84 -> 0.65。

VCTK 上也大多改善，即使 YourTTS training 見過 VCTK 的 97/108 speakers，而 NaturalSpeech 2 沒有。

### 3. Speaker similarity / SMOS

SMOS：

- LibriSpeech：GroundTruth 3.33，YourTTS 2.03，NaturalSpeech 2 3.28。
- VCTK：GroundTruth 3.86，YourTTS 2.43，NaturalSpeech 2 3.20。

NaturalSpeech 2 對 prompt speaker/timbre 的保留遠好於 YourTTS。

### 4. WER / robustness

WER：

- LibriSpeech：Ground Truth 1.94，YourTTS 7.10，NaturalSpeech 2 2.26。
- VCTK：Ground Truth 9.49，YourTTS 14.80，NaturalSpeech 2 6.99。

NaturalSpeech 2 在 LibriSpeech 接近 ground truth，在 VCTK 甚至低於 ground truth WER。作者認為 VCTK ground truth WER 較高可能來自 noisy environment 和 ASR 沒針對 VCTK fine-tune。

50 hard sentences robustness test：

- Tacotron：24% error rate。
- Transformer TTS：34%。
- FastSpeech / NaturalSpeech / NaturalSpeech 2：0%。

這支持 non-autoregressive duration-based TTS 對 skipping/repeating 比 AR TTS 穩。

### 5. Against VALL-E

作者從 VALL-E demo page 取 16 utterances 比較：

- SMOS：VALL-E 3.53，NaturalSpeech 2 3.83。
- CMOS：VALL-E -0.31，NaturalSpeech 2 0.00。

這是論文中最直接對 discrete codec AR LM 路線的對比。

### 6. Ablation

重要 ablation：

- `w/o diff prompt`：無法收斂。
- `w/o dur/pitch prompt`：prompt prosody similarity 明顯下降，例如 pitch mean difference 10.11 -> 21.69。
- `w/o CE loss`：pitch/duration matching 變差。
- `w/o query attn`：也變差；作者說直接 cross-attend prompt hidden 會 leak details 並 mislead generation。

Prompt length：

- LibriSpeech pitch std difference：3s 6.18，5s 4.29，10s 4.03。
- VCTK pitch mean difference：3s 13.29，10s 10.28。

整體來說，長 prompt 能提供更多 prosody/timbre detail，但也不是所有 duration stats 都單調改善。

## Project relevance

### project-tts-data-pipeline

高相關。NaturalSpeech 2 的 data setup 很值得當 large-scale TTS pipeline reference：

- 44K hours MLS English。
- G2P phoneme conversion。
- phoneme-level duration alignment。
- frame-level pitch extraction。
- prompt audio crop protocol。
- unseen-speaker zero-shot evaluation。
- hard sentences robustness evaluation。
- singing data preprocessing：vocal/accompaniment removal + ASR filtering。

對我們的 pipeline，最值得借的是資料 schema：

```text
waveform
transcript
phonemes
phoneme durations
pitch contour
speaker id
prompt audio / prompt latent
codec latent cache
quality filters / ASR WER / speaker similarity
```

它也提醒我們：如果未來要訓練 expressive / zero-shot TTS，不能只存 plain transcript；duration、pitch、prompt reference 和 latent cache 都是 training-critical metadata。

### project-generative-speech-representation-evaluation

高相關。NaturalSpeech 2 是早期直接挑戰 discrete codec token + AR LM 路線的 evidence。它說明：

```text
discrete RVQ tokens:
  reconstruction good, but sequence long and AR hard

continuous / summed RVQ latent vectors:
  preserve acoustic detail, shorter sequence, diffusion-friendly
```

這非常符合我們的 project thesis：speech representation 要看 downstream generator learnability，而不是只看 codec reconstruction。NaturalSpeech 2 的 representation 可以作為 speech VAE / codec / continuous latent benchmark 的重要 baseline。

### project-one-step-audio-generation

中度相關。NaturalSpeech 2 推論需要 150 diffusion steps，singing 甚至 1000 steps。作者 future work 明確提到 consistency models / CoMoSpeech 類方法來加速 diffusion。對 one-step audio generation 來說，它是一個很好的 teacher / baseline：

```text
NaturalSpeech 2 latent diffusion teacher
  -> consistency / distillation / MeanFlow / one-step student
  -> preserve WER, speaker similarity, prosody, prompt adherence
```

### project-full-duplex-data

間接相關。NaturalSpeech 2 不是 dialogue/full-duplex model，沒有處理 overlap、backchannel、turn-taking。但它的 continuous latent + prompt conditioning + duration/pitch control，可作未來 speaker-wise dual-channel generator 的單 speaker rendering baseline。

## Related papers in my pool

- [VALL-E](https://arxiv.org/abs/2301.02111)：NaturalSpeech 2 主要對照的 discrete codec AR LM zero-shot TTS route；目前不在本 repo。
- [Seed-TTS](../arxiv_2406_02430/)：後續 large-scale TTS family；其 citation graph 會連回 NaturalSpeech 2。
- [DiTTo-TTS](../arxiv_2406_11427/)：zero-shot TTS data/model reference，和 NaturalSpeech 2 同樣關心 latent representation、prompt audio、WER/SIM/CMOS。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free / AudioVAE continuous speech latent route；可視為 NaturalSpeech 2 continuous latent 思路的後續方向之一。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：large-scale diffusion TTS；可和 NaturalSpeech 2 比較 Wav-VAE latent、prompt design、data scale、WER/SIM evaluation。
- [WavCube](../arxiv_2605_06407/)：compact continuous speech representation；和 NaturalSpeech 2 都支持「continuous latent 可以比 flattened codec tokens 更適合 downstream generation」。
- [GEAR](../arxiv_2606_32039/)：image-side opposite route：讓 AR guide tokenizer，使 discrete tokens 更 learnable。NaturalSpeech 2 則選擇 continuous latent + diffusion，兩者都在處理 representation vs generator learnability。

## OpenReview / reviewer discussion

OpenReview fetch 找到疑似 matching forum，但 API returned 403，未能取得公開 review/rebuttal text。因此此 note 未納入 review discussion。

## 我該不該細讀

建議細讀。這篇是 zero-shot TTS 和 speech latent diffusion 的重要 baseline，尤其對我們三件事很有用：

- TTS data pipeline：44K-hour MLS pipeline、phoneme duration、pitch、prompt crop、WER/SMOS/CMOS/hard-sentence evaluation。
- Generative speech representation：continuous / summed RVQ latent vs discrete codec tokens 的 early argument。
- One-step audio：可作 latent diffusion teacher，後續研究可以測 consistency / MeanFlow / distillation 是否保住 prompt similarity 和 WER。

最值得讀：

- Section 3.1 codec design。
- Section 3.2 diffusion loss + RVQ CE loss。
- Section 3.3 speech prompting。
- Ablation table，尤其 `w/o diff prompt` 和 `w/o dur/pitch prompt`。

## 可能的弱點 / open questions

1. **不是開源 model / code。**  
   論文提供 audio samples，但沒有可重現的 full training code / checkpoint。很難直接作為 baseline 跑 evaluation。

2. **150 diffusion steps latency 高。**  
   對 real-time / full-duplex TTS 不理想。作者也承認要探索 consistency models 加速。

3. **資料清理細節不足。**  
   MLS 44K hours、G2P、internal alignment、PyWorld pitch 有描述，但沒有完整公布 data filtering / noise handling / transcript cleaning / speaker quality rules。

4. **Prompt leakage tradeoff 需要更多分析。**  
   作者說 direct prompt attention 會 leak details 並 mislead generation，因此使用 learnable query compression，但沒有深入量化什麼 information 被保留或丟掉。

5. **Singing data 規模小且處理細節有限。**  
   30 hours singing data、vocal removal、ASR filtering 的細節不足，zero-shot singing 主要是展示能力。

6. **Continuous latent 是否最優仍未證明。**  
   這篇證明它比當時 discrete AR route 好，但沒有系統比較後續 WavTokenizer、semantic-acoustic tokenizer、AudioVAE、WavCube 等 representation。

7. **Evaluation 與現代 speech judge 還可補強。**  
   WER/SMOS/CMOS/prosody stats 很有用，但沒有 event-level / rubric / prompt-grounded judge。若用於 expressive TTS，還需要更細的 emotion、style、pause、prosody control evaluation。

## Tags

#tts #zero-shot-tts #latent-diffusion #speech-codec #continuous-latent #speech-prompting #voice-cloning #singing-synthesis #project-tts-data-pipeline #project-generative-speech-representation-evaluation

## Concepts

- NaturalSpeech 2
- zero-shot TTS
- latent diffusion TTS
- neural audio codec
- continuous latent vectors
- residual vector quantizer
- RVQ CE loss
- speech prompting
- in-context learning for TTS
- duration predictor
- pitch predictor
- prompt prosody similarity
- SMOS
- CMOS
- WER
- zero-shot singing synthesis
- voice conversion
- speech enhancement

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{shen2023naturalspeech2latentdiffusionm,
  title={NaturalSpeech 2: Latent Diffusion Models are Natural and Zero-Shot Speech and Singing Synthesizers},
  author={Kai Shen and Zeqian Ju and Xu Tan and Yanqing Liu and Yichong Leng and Lei He and Tao Qin and Sheng Zhao and Jiang Bian},
  year={2023},
  eprint={2304.09116},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2304.09116}
}
```
