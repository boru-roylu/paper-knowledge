---
title: "Project: Generative Speech Representation Evaluation"
---

## Motivation

[Making Reconstruction FID Predictive of Diffusion Generation FID](../papers/arxiv_2603_05630/) 對 image latent diffusion 提出一個很重要的問題：

> **reconstruction metric 不等於 generation metric。**

在 speech/audio 裡，這個問題可能更嚴重。因為 speech representation 不只要重建 waveform，還要被 downstream model 使用：

- TTS / speech generation 要遵守 transcript。
- voice cloning 要保留 speaker identity。
- full-duplex generator 要保留 overlap、backchannel、pause、turn-taking timing。
- speech LLM 要能從 tokens / latents 裡讀出 semantic、phonetic、acoustic information。
- one-step audio generator 需要 latent space smooth、interpolatable、condition-friendly。

如果只看 reconstruction PESQ / STOI / ViSQOL / FAD / mel loss，很容易選到一個「還原 input 很好，但下游 generative model 很難學或難控制」的 representation。

## Project thesis

這條 project 要做的是 **Making Reconstruction FID Predictive of Diffusion Generation FID 的 speech/audio version**，但範圍不只 codec，也不只預測 final quality：

> 建立一組能預測 downstream speech/audio generation quality 的 representation evaluation，用來比較 codec、VAE、tokenizer、continuous encoder、semantic-acoustic latent，而不是只評估 reconstruction quality。

核心假設：

```text
speech representation reconstruction quality
  != downstream speech/audio generation quality

latent/token neighborhood geometry + semantic-acoustic organization
  may predict downstream generation quality better

representation learnability
  may predict how much compute is needed to train a good generator
```

更具體地說，我們要找 audio/speech 版的 `iFID-like` metric family：

```text
audio clip
  -> codec / VAE / tokenizer / continuous encoder
  -> latent or token sequence
  -> nearest neighbor / controlled neighbor retrieval
  -> interpolation / token mixing / semantic-acoustic recombination
  -> decoder or downstream generator
  -> evaluate decoded / generated distribution
```

如果這類 metric 比 reconstruction FAD 更能預測 downstream TTS / speech generation / full-duplex generation 的 WER、speaker similarity、naturalness、event timing、human preference，它就有價值。

另一個同等重要的目標是 **compute-to-quality**：好的 representation 應該讓 downstream generator 更早學好、用更少 GPU-hours / audio-hours / training tokens 達到可用品質。這點受到 [Improved Baselines with Representation Autoencoders](../papers/arxiv_2605_18324/) 的 `EP_FID@k` 啟發。

## Representation candidates

這個 project 應該明確涵蓋五類 representation：

1. **Neural audio codec / discrete tokenizer**
   - EnCodec / DAC / SoundStream
   - WavTokenizer
   - Language-Codec
   - SpeechTokenizer 類 semantic-acoustic tokenizers

2. **Speech VAE / audio VAE**
   - DAC-VAE / Semantic-VAE
   - VoxCPM 的 AudioVAE V2 類 continuous speech latent
   - 其他 diffusion TTS 使用的 acoustic latent VAE

3. **Continuous speech encoder**
   - WavLM / HuBERT / wav2vec2 / Whisper encoder
   - WavCube 類 SSL-derived compact continuous latent
   - ASR / speaker / prosody encoder representations

4. **Semantic-acoustic disentangled representation**
   - semantic tokens + acoustic tokens
   - phonetic content + speaker/prosody residual
   - style / emotion / rhythm latent

5. **End-to-end generation representation**
   - tokenizer-free TTS latent
   - diffusion autoregressive continuous representation
   - codec-free speech LLM intermediate states

## Why image iFID cannot be copied directly

Image iFID 的 target 是 gFID，也就是 diffusion generated image distribution 的 FID。但 speech/audio 的 target 不是單一 FID：

- content correctness：WER / CER / semantic transcript match
- speaker identity：speaker similarity、speaker verification EER
- acoustic quality：PESQ / STOI / UTMOS / DNSMOS / ViSQOL / FAD
- prosody：pitch/rhythm/speaking-rate/emotion consistency
- event correctness：laugh/breath/backchannel/overlap timing
- conditional adherence：prompt、text、speaker reference、style control 是否被遵守
- human preference：naturalness、similarity、expressiveness、conversation plausibility

所以這裡的 goal 不是直接照搬 Inception-FID，而是設計 **multi-view generative representation metrics**。

## Candidate metric families

### 1. Content-iFID

測 interpolation / recombination 後是否仍保留可辨識 linguistic content。

```text
decoded interpolation
  -> ASR / SSL encoder
  -> FD or embedding distance
  -> WER / semantic transcript consistency
```

候選 representation：

- Whisper / wav2vec2 / HuBERT / WavLM hidden states
- ASR posterior / CTC representation
- text embedding from decoded ASR transcript

### 2. Speaker-iFID

測 interpolation 是否破壞 speaker identity 或產生 speaker blending。

```text
decoded interpolation
  -> speaker encoder
  -> speaker embedding FD / similarity distribution
```

這對 voice cloning 和 full-duplex speaker-wise tracks 特別重要。

### 3. Prosody-iFID

測 latent space 是否平滑保留 pitch、energy、duration、rhythm。

候選 features：

- F0 / voiced-unvoiced pattern
- energy contour
- phoneme duration / syllable rhythm
- emotion / style encoder embedding

### 4. Event-iFID

針對 full-duplex dialogue：

```text
backchannel / overlap / laugh / breath / pause
  -> encode
  -> interpolate with controlled neighbor
  -> decode
  -> check event survival and timing
```

這比普通 speech codec metric 更接近我們真正關心的 full-duplex behavior。

### 5. Conditional adherence metric

測 representation 是否仍容易被 downstream conditional generator 控制。

例如：

```text
same transcript, different speaker
same speaker, different transcript
same transcript + same speaker, different prosody
overlap event present vs absent
```

這可以避免 metric 只看 distribution naturalness，卻忽略 prompt / transcript / speaker adherence。

## TASTE-aligned paired utterance benchmark

[TASTE](../papers/arxiv_2504_07053/) 提供一個很有價值的 special case：當 audio A 和 audio B 說同一句話時，TASTE 的 speech embedding / token sequence 會天然對齊到同一組 transcript tokens。

```text
Audio A: speaker A says sentence S
Audio B: speaker B says sentence S

same transcript tokens:
  [w1, w2, w3, ...]

TASTE(A):
  [w1: zA1, w2: zA2, w3: zA3, ...]

TASTE(B):
  [w1: zB1, w2: zB2, w3: zB3, ...]
```

這和固定 frame-rate codec / SSL representation 不同：普通 codec tokens 需要 DTW / forced alignment 才能比較同一句話不同 speaker/prosody 的局部差異；TASTE 因為 text-aligned，可以直接做 word-level comparison。

### Why this is useful

這個 setup 可以把 representation evaluation 拆成更乾淨的問題：

- lexical content 固定：A/B 說同一句 transcript。
- text token 固定：每個 word position 有明確對應。
- speech side-channel 變動：speaker、duration、tone、emotion、speaking rate、local emphasis。

因此可以直接問：

```text
zA_i vs zB_i
  = 同一個 word/token 下，不同 speaker/prosody 的 acoustic side-channel 差異
```

這比直接比較整段 waveform 或固定頻率 codec token 更容易做 causal / localized analysis。

### Proposed metrics

1. **Word-local controllability**

   swap 某個 word 的 TASTE embedding / token 後，decode 出來是否主要只改變該 word 的 duration、tone、emphasis，而不是整句崩掉。

2. **Paralinguistic delta predictability**

   用 `zA_i - zB_i` 預測同一 word 上的 duration delta、F0 delta、energy delta、speaking-rate delta。若可預測，表示 embedding 確實承載 word-local paralinguistic information。

3. **Speaker leakage / speaker separability**

   在 same transcript setting 下，檢查 aligned embeddings 是否主要差在 speaker/prosody，而不是重新編碼 lexical content。可以用 speaker classifier / content classifier / mutual information probing。

4. **Interpolation quality**

   對同一 word 做：

   ```text
   z_i(alpha) = (1 - alpha) * zA_i + alpha * zB_i
   ```

   decode 後檢查 speech 是否自然、content 是否不變、speaker/prosody 是否平滑過渡。

   這裡可以加入一個很直接的 **speaker similarity monotonicity test**：

   ```text
   audio_i(alpha) = decode(z_i(alpha), same text context)

   SimA(alpha) = speaker_similarity(audio_i(alpha), speaker_A_ref)
   SimB(alpha) = speaker_similarity(audio_i(alpha), speaker_B_ref)
   ```

   理論上：

   ```text
   alpha -> 0:
     SimA(alpha) should be high
     SimB(alpha) should be low

   alpha -> 1:
     SimA(alpha) should be low
     SimB(alpha) should be high
   ```

   也就是 interpolation 從 A 走到 B 時，speaker similarity to A 應該單調下降或大致下降，speaker similarity to B 應該單調上升或大致上升。可以把這變成幾個量化指標：

   - `monotonicity_A`：`SimA(alpha)` 是否隨 alpha 增加而下降。
   - `monotonicity_B`：`SimB(alpha)` 是否隨 alpha 增加而上升。
   - `crossover_alpha`：`SimA(alpha) = SimB(alpha)` 的位置是否接近 `0.5`。
   - `speaker_path_smoothness`：相鄰 alpha steps 的 speaker embedding distance 是否平滑。
   - `content_stability`：整條 interpolation path 的 ASR transcript 是否保持同一句話。

   這個 test 可以檢查 representation 的 speaker dimension 是否可控、是否平滑，以及 decoder 是否會在中間 alpha 產生 speaker collapse / speaker averaging / unstable identity jump。

5. **Localized transfer**

   把 A 的某些 word-level embeddings 放到 B 的 sentence 裡，測是否能 transfer local rhythm / tone / duration，而不破壞 B 的 speaker identity。

6. **Downstream learnability**

   用 TASTE-aligned representation 訓練 small TTS / SLM，比較它是否比 fixed-rate codec tokens 更快達到同樣 WER、speaker similarity、UTMOS、human preference。

### Datasets to try

- same-transcript multi-speaker corpora：VCTK、LibriTTS speaker variants、parallel TTS corpora。
- expressive same-content corpora：Expresso 類 emotional / style variation data。
- synthetic paired data：用 strong TTS model 生成 same transcript under different speaker / emotion / rate controls，再用 human spot-check 過濾。

### Caveats

- TASTE 依賴 transcript / ASR；transcript 錯，alignment 就錯。
- TASTE 主要對 lexical speech 友善；laugh、cough、breath、backchannel、silence、overlap 這些 non-lexical events 沒有自然 text token anchor。
- embedding 可能仍 entangle speaker、duration、prosody，不保證自動 disentangle。
- 這個 benchmark 主要評估 same-transcript paired utterances；對 full-duplex overlap separation 是間接幫助，不是直接解法。

### Why it belongs in this project

這個 benchmark 很適合 `Generative Speech Representation Evaluation`，因為它不是在問 reconstruction fidelity，而是在問：

```text
representation 是否提供一個對 downstream generation 有用、
可對齊、可比較、可插值、可局部控制的 acoustic side-channel？
```

這正是 speech 版 reconstruction-vs-generation problem 的一個可操作切入點。

## Current work that supports this project

### Directly relevant

- [Investigating Neural Audio Codecs for Speech Language Model-Based Speech Generation](https://arxiv.org/abs/2409.04016)：最直接。作者在 SLM speech generation framework 裡比較 neural audio codecs，明確指出 better speech reconstruction does not guarantee better speech generation；decoder quality 影響 naturalness，quantization mechanism 更影響 intelligibility。
- [Discrete Audio Tokens: More Than a Survey!](https://arxiv.org/abs/2506.10274)：可作 tokenizer / codec landscape 和 benchmark taxonomy。它整理 speech、music、general audio 的 discrete audio tokens，也包含 reconstruction、downstream performance、acoustic language modeling 等評估面向。
- [ESPnet-Codec](https://arxiv.org/abs/2409.15897)：提供 codec training/evaluation platform 和 VERSA toolkit，涵蓋 20+ audio metrics，也示範 codec 可接到多個 ESPnet downstream tasks。它是 benchmark infrastructure，但還不是 generative representation metric。
- [Language-Codec](https://arxiv.org/abs/2402.12208)：指出 codec 和 speech language model 的 gap：reconstruction paradigm / RVQ structure 讓第一 codebook 承載過多資訊，多 codebooks 也增加 downstream LM burden；並用 downstream SLM 驗證 codec representation。
- [TASTE](../papers/arxiv_2504_07053/)：text-aligned speech tokenization。它把 speech token 對齊到 transcript tokens，讓 lexical content 由 text 承擔、speech side channel 承擔 paralinguistic information；也清楚顯示 S3 token reconstruction 較好，不代表 downstream joint SLM 較好。
- [Semantic-VAE](https://arxiv.org/abs/2509.22167)：非常接近本 project。它指出 speech VAE 有 dimension dilemma：高維 latent reconstruction / speaker similarity 好，但 intelligibility 變差；低維 latent intelligibility 好但 reconstruction fidelity 差。Semantic alignment regularization 改善 F5-TTS downstream WER / speaker similarity。
- [On the Distillation Loss Functions of Speech VAE](https://arxiv.org/abs/2604.12383)：系統比較 speech VAE distillation/alignment loss 對 reconstruction、understanding、generation 三個軸的影響。這正是我們要避免只看 reconstruction 的原因。
- [WavCube](https://arxiv.org/abs/2605.06407)：從 SSL speech encoder 得到 compact continuous latent，同時支援 understanding、reconstruction、generation；兩階段訓練先去掉讓 diffusion 難學的 off-manifold redundancy，再補 acoustic details。這和 latent geometry framing 很一致。
- [Diffusion Transformers with Representation Autoencoders](../papers/arxiv_2510_11690/)：原始 RAE paper。它用 frozen pretrained representation encoder 加 trained decoder 取代 SD-VAE，並證明 high-dimensional semantic latent 需要配套的 generator width、dimension-aware noise schedule、noise-augmented decoder。對本 project 來說，它是「speech VAE / codec / continuous encoder 不只看 reconstruction，也要看 downstream generator learnability」的核心 image-side 參考。
- [Improved Baselines with Representation Autoencoders](../papers/arxiv_2605_18324/)：image-side but highly relevant。它提出 `EP_FID@k` 作為 training efficiency metric，明確衡量 representation / autoencoder 讓 downstream diffusion model 多快學好。這支持本 project 從 final quality evaluation 擴展到 **representation learnability / compute-to-quality evaluation**。

### Tokenizer-free / continuous encoder candidate

- [VoxCPM / VoxCPM2](../tools/openbmb-voxcpm/)：不是單純 codec paper，而是很重要的 continuous representation candidate。README 把 VoxCPM2 描述為 tokenizer-free TTS，直接生成 continuous speech representations；VoxCPM2 使用 AudioVAE V2 asymmetric encode/decode，支援 48 kHz output、voice design、controllable cloning、ultimate cloning。對本 project 來說，VoxCPM 類 model 可用來測：continuous AudioVAE latent 是否比 discrete codec tokens 更適合 generation、voice cloning、style control 和 long-form stability。

### Tokenizer geometry / semantic-acoustic structure

- [Speech Codec Probing from Semantic and Phonetic Perspectives](https://arxiv.org/abs/2603.10371)：指出 speech tokenizers 被期待同時保留 semantic/acoustic information，但目前很多 tokenizer 主要捕捉 phonetic rather than lexical-semantic structure，這種 mismatch 可能傷害 multimodal LLM。
- [XY-Tokenizer](https://arxiv.org/abs/2506.23325)：直接把問題稱為 semantic-acoustic conflict，在 low-bitrate codec 中同時追求 text alignment 和 speaker/acoustic fidelity。
- [DSA-Tokenizer](https://arxiv.org/abs/2601.09239)：把 speech 明確拆成 semantic tokens 和 acoustic tokens，並用 flow matching decoder 支援 reconstruction / voice cloning / downstream speech LLM generation。
- [WavTokenizer](https://arxiv.org/abs/2408.16532)：強調 extreme compression、semantic information、adaptability to generative models；它說明 codec/tokenizer 的價值已不只是 compression，而是作為 audio language modeling interface。

## Proposed benchmark design

### Stage 1: representation candidates

先比較幾類 representation：

- waveform VAE / DAC-VAE / Semantic-VAE 類 continuous latent
- VoxCPM AudioVAE V2 類 tokenizer-free continuous speech representation
- EnCodec / DAC / WavTokenizer / Language-Codec 類 discrete codec
- semantic-acoustic split tokenizer：SpeechTokenizer / XY-Tokenizer / DSA-Tokenizer
- SSL-derived compact latent：WavCube 類
- baseline mel / neural vocoder latent

### Stage 2: controlled neighbor retrieval

普通 nearest neighbor 在 speech 裡可能語義不穩，所以要做多種 retrieval：

- same speaker, different text
- same text / similar phoneme sequence, different speaker
- same event type：backchannel / laugh / breath / overlap
- same duration bucket
- same acoustic condition：clean/noisy/reverb
- random neighbor as stress test

### Stage 3: interpolation / recombination operators

Continuous latent / VAE:

- linear interpolation
- spherical interpolation
- masked time-span interpolation
- channel-wise semantic/acoustic interpolation
- reference-speaker latent fixed + content latent varied

Discrete tokens:

- token-span replacement
- codebook-level interpolation / swap
- semantic-token fixed + acoustic-token swapped
- acoustic-token fixed + semantic-token swapped

Tokenizer-free / end-to-end model latent:

- freeze generator and perturb latent states
- compare prompt/reference latent neighborhoods
- test whether style control survives latent interpolation

### Stage 4: decoded interpolation evaluation

Metric families:

- reconstruction baseline：PESQ / STOI / ViSQOL / UTMOS / FAD
- content：WER / CER / ASR embedding FD
- speaker：speaker similarity / speaker FD
- prosody：F0 contour distance / rhythm embedding FD
- event：event classifier / timestamp error / overlap detector
- conditional：downstream TTS WER/SIM/UTMOS under fixed transcript and speaker prompt
- human：AB preference on naturalness / speaker / transcript / event timing

### Stage 5: downstream correlation

Representation metric 只有在它能預測 downstream 才成立。要量 correlation：

```text
representation metric
  -> train or run same downstream generator with representation fixed
  -> evaluate downstream TTS / audio generation
  -> compute Pearson / Spearman with downstream score
```

除了 final quality，也要量 learning curve：

```text
quality vs GPU-hours
quality vs audio-hours seen
quality vs training tokens
quality vs optimizer steps
```

Speech 版 EP metrics：

- `EP_WER@x`：達到 WER <= x 需要多少 compute。
- `EP_SIM@y`：達到 speaker similarity >= y 需要多少 compute。
- `EP_UTMOS@z`：達到 UTMOS >= z 需要多少 compute。
- `EP_Event@r`：達到 overlap/backchannel event recall >= r 需要多少 compute。
- `AUC_learning`：整條 learning curve 的 area under curve，避免只看單一 threshold。

Downstream tasks:

- zero-shot TTS
- speech continuation
- controllable voice cloning
- voice conversion
- speech enhancement / separation in latent space
- full-duplex dual-channel generation
- one-step audio generation

## First experiment

最小可行版本：

1. 選 4-6 個 representation：
   - DAC or EnCodec
   - WavTokenizer
   - Semantic-VAE
   - WavCube
   - VoxCPM / AudioVAE V2 if accessible
   - one baseline mel / Vocos representation
2. Dataset：LibriSpeech / LibriTTS clean subset。
3. 建 controlled neighbor sets：
   - same speaker different text
   - different speaker same/similar text
   - same duration bucket
4. Decode interpolation 或 run downstream generator。
5. 算：
   - reconstruction FAD / PESQ / STOI
   - content-iFID via ASR/Whisper embeddings
   - speaker-iFID via speaker embeddings
   - prosody-iFID via F0/rhythm features
6. 用同一個 small F5-TTS / diffusion TTS backbone 訓練 downstream，或先用可跑的 VoxCPM / codec decoder 做 probing。
7. 看哪個 metric 最能預測 downstream WER / SIM / UTMOS / human preference。

## Relation to existing projects

### `project-audio-model-evaluation`

這是最直接的子 project。AnyAudio-Judge / rubric evaluation 可以評估 generated audio 是否正確；本 project 評估的是 **representation 是否適合被生成模型使用**。兩者互補。

### `project-one-step-audio-generation`

one-step model 沒有 iterative refinement，對 latent geometry 更敏感。這個 project 可以在訓練 one-step generator 前先排除不好生成的 codec / VAE / encoder。

### `project-tts-data-pipeline`

TTS data pipeline 需要決定保存 waveform、mel、codec tokens、semantic tokens、prosody tags，或 VAE latent。這個 project 可作為 representation selection metric。

### `project-full-duplex-data`

full-duplex generator 要處理 overlap、backchannel、speaker identity 和 timing。Event-iFID / speaker-iFID 可以測 representation 是否把這些 interaction evidence 壓掉。

## Open questions

- nearest neighbor 應該在 raw codec latent、SSL latent、speaker-normalized latent，還是 transcript-conditioned latent 裡找？
- interpolation 應該在 time-aligned latent space 做，還是先做 duration normalization？
- discrete tokens 沒有自然 interpolation，要用 codebook swap / span replacement / semantic-acoustic recombination 取代嗎？
- continuous VAE latent 是否真的比 discrete codec token 更適合 downstream generation，還是只是 decoder 更強？
- VoxCPM 類 tokenizer-free AudioVAE latent 是否可獨立抽出做 benchmark，還是只能做 end-to-end probing？
- 用 FAD 類 distribution metric 會不會忽略 transcript adherence？
- 這些 metrics 能否不只 predict downstream quality，也作為 training objective？如果可以，會更像 [Representation Fréchet Loss](../papers/arxiv_2604_28190/) 的 audio 版本。
- 對 full-duplex data，是否需要專門的 overlap/backchannel event representation，而不是只用 speech content encoder？

## Related Tags

#speech-representation #audio-codec #speech-tokenizer #speech-vae #continuous-encoder #latent-space #codec-evaluation #tts #one-step-generation #full-duplex #audio-evaluation
