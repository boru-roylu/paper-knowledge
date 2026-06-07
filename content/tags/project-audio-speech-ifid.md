---
title: "Project: Audio / Speech iFID"
---

## Motivation

[Making Reconstruction FID Predictive of Diffusion Generation FID](../papers/arxiv_2603_05630/) 對 image latent diffusion 提出一個很重要的問題：

> **reconstruction metric 不等於 generation metric。**

在 audio / speech 裡，這個問題可能更嚴重。因為 audio codec / VAE / tokenizer 不只要重建 waveform，還要被 downstream model 使用：

- TTS / speech generation 要遵守 transcript。
- voice cloning 要保留 speaker identity。
- full-duplex generator 要保留 overlap、backchannel、pause、turn-taking timing。
- speech LLM 要能從 tokens 裡讀出 semantic / phonetic / acoustic information。
- one-step audio generator 需要 latent space smooth、interpolatable、condition-friendly。

如果只看 reconstruction PESQ / STOI / ViSQOL / FAD / mel loss，很容易選到一個「還原 input 很好，但下游 generative model 很難學」的 codec。

## Project thesis

這條 project 要做的是 **Making Reconstruction FID Predictive of Diffusion Generation FID 的 audio / speech version**：

> 建立一組能預測 downstream speech/audio generation quality 的 codec / VAE / tokenizer evaluation，而不是只評估 reconstruction quality。

核心假設：

```text
audio codec / VAE 的 reconstruction quality
  != downstream speech/audio generation quality

latent interpolation / neighborhood geometry / semantic-acoustic organization
  may predict downstream generation quality better
```

更具體地說，我們要找 audio 版的 `iFID`：

```text
audio clip
  -> codec / VAE / tokenizer encoder
  -> latent or token sequence
  -> nearest neighbor / controlled neighbor retrieval
  -> latent interpolation / token mixing / semantic-acoustic recombination
  -> decoder
  -> evaluate decoded interpolation distribution
```

如果這個 metric 比 reconstruction FAD 更能預測 downstream TTS / speech generation / full-duplex generation 的 WER、speaker similarity、naturalness、event timing、human preference，它就有價值。

## Why image iFID cannot be copied directly

Image iFID 的 target 是 gFID，也就是 diffusion generated image distribution 的 FID。但 speech/audio 的 target 不是單一 FID：

- content correctness：WER / CER / semantic transcript match
- speaker identity：speaker similarity、speaker verification EER
- acoustic quality：PESQ / STOI / UTMOS / DNSMOS / ViSQOL / FAD
- prosody：pitch/rhythm/speaking-rate/emotion consistency
- event correctness：laugh/breath/backchannel/overlap timing
- conditional adherence：prompt、text、speaker reference、style control 是否被遵守
- human preference：naturalness、similarity、expressiveness、conversation plausibility

所以 audio-iFID 應該是 multi-view representation FD，而不是單一 Inception-FID。

## Candidate audio-iFID metrics

### 1. Content-iFID

測 latent interpolation 後是否仍保留可辨識 linguistic content。

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

### 5. Conditional-iFID

測 latent interpolation 區域是否仍容易被 downstream conditional generator 控制。

例如：

```text
same transcript, different speaker
same speaker, different transcript
same transcript + same speaker, different prosody
overlap event present vs absent
```

這可以避免 metric 只看 distribution naturalness，卻忽略 prompt / transcript / speaker adherence。

## Current work that supports this project

### Directly relevant

- [Investigating Neural Audio Codecs for Speech Language Model-Based Speech Generation](https://arxiv.org/abs/2409.04016)：最直接。作者在 SLM speech generation framework 裡比較 neural audio codecs，明確指出 better speech reconstruction does not guarantee better speech generation；decoder quality 影響 naturalness，quantization mechanism 更影響 intelligibility。
- [ESPnet-Codec](https://arxiv.org/abs/2409.15897)：提供 codec training/evaluation platform 和 VERSA toolkit，涵蓋 20+ audio metrics，也示範 codec 可接到多個 ESPnet downstream tasks。它是 benchmark infrastructure，但還不是 audio-iFID。
- [Language-Codec](https://arxiv.org/abs/2402.12208)：指出 codec 和 speech language model 的 gap：reconstruction paradigm / RVQ structure 讓第一 codebook 承載過多資訊，多 codebooks 也增加 downstream LM burden；並用 downstream SLM 驗證 codec representation。
- [Semantic-VAE](https://arxiv.org/abs/2509.22167)：非常接近本 project。它指出 speech VAE 有 dimension dilemma：高維 latent reconstruction / speaker similarity 好，但 intelligibility 變差；低維 latent intelligibility 好但 reconstruction fidelity 差。Semantic alignment regularization 改善 F5-TTS downstream WER / speaker similarity。
- [On the Distillation Loss Functions of Speech VAE](https://arxiv.org/abs/2604.12383)：系統比較 speech VAE distillation/alignment loss 對 reconstruction、understanding、generation 三個軸的影響。這正是我們要避免只看 reconstruction 的原因。
- [WavCube](https://arxiv.org/abs/2605.06407)：從 SSL speech encoder 得到 compact continuous latent，同時支援 understanding、reconstruction、generation；兩階段訓練先去掉讓 diffusion 難學的 off-manifold redundancy，再補 acoustic details。這和 iFID 的 latent geometry framing 很一致。

### Tokenizer geometry / semantic-acoustic structure

- [Speech Codec Probing from Semantic and Phonetic Perspectives](https://arxiv.org/abs/2603.10371)：指出 speech tokenizers 被期待同時保留 semantic/acoustic information，但目前很多 tokenizer 主要捕捉 phonetic rather than lexical-semantic structure，這種 mismatch 可能傷害 multimodal LLM。
- [XY-Tokenizer](https://arxiv.org/abs/2506.23325)：直接把問題稱為 semantic-acoustic conflict，在 low-bitrate codec 中同時追求 text alignment 和 speaker/acoustic fidelity。
- [DSA-Tokenizer](https://arxiv.org/abs/2601.09239)：把 speech 明確拆成 semantic tokens 和 acoustic tokens，並用 flow matching decoder 支援 reconstruction / voice cloning / downstream speech LLM generation。
- [WavTokenizer](https://arxiv.org/abs/2408.16532)：強調 extreme compression、semantic information、adaptability to generative models；它說明 codec/tokenizer 的價值已不只是 compression，而是作為 audio language modeling interface。

## Proposed benchmark design

### Stage 1: codec / VAE candidates

先比較幾類 representation：

- waveform VAE / DAC-VAE / Semantic-VAE 類 continuous latent
- EnCodec / DAC / WavTokenizer / Language-Codec 類 discrete codec
- semantic-acoustic split tokenizer：SpeechTokenizer / XY-Tokenizer / DSA-Tokenizer
- SSL-derived compact latent：WavCube 類

### Stage 2: controlled neighbor retrieval

普通 nearest neighbor 在 speech 裡可能語義不穩，所以要做多種 retrieval：

- same speaker, different text
- same text / similar phoneme sequence, different speaker
- same event type：backchannel / laugh / breath / overlap
- same duration bucket
- same acoustic condition：clean/noisy/reverb
- random neighbor as stress test

### Stage 3: interpolation / recombination operators

Continuous latent:

- linear interpolation
- spherical interpolation
- masked time-span interpolation
- channel-wise semantic/acoustic interpolation

Discrete tokens:

- token-span replacement
- codebook-level interpolation / swap
- semantic-token fixed + acoustic-token swapped
- acoustic-token fixed + semantic-token swapped

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

Audio-iFID 只有在它能預測 downstream 才成立。要量 correlation：

```text
codec metric
  -> train same downstream generator with codec fixed
  -> evaluate downstream TTS / audio generation
  -> compute Pearson / Spearman with downstream score
```

Downstream tasks:

- zero-shot TTS
- speech continuation
- voice conversion
- speech enhancement / separation in latent space
- full-duplex dual-channel generation
- one-step audio generation

## First experiment

最小可行版本：

1. 選 3-5 個 codec / VAE：
   - DAC or EnCodec
   - WavTokenizer
   - Semantic-VAE
   - WavCube
   - one baseline mel / Vocos representation
2. Dataset：LibriSpeech / LibriTTS clean subset。
3. 建 controlled neighbor sets：
   - same speaker different text
   - different speaker same/similar text
   - same duration bucket
4. Decode interpolation。
5. 算：
   - reconstruction FAD / PESQ / STOI
   - content-iFID via ASR/Whisper embeddings
   - speaker-iFID via speaker embeddings
   - prosody-iFID via F0/rhythm features
6. 用同一個 small F5-TTS / diffusion TTS backbone 訓練 downstream。
7. 看哪個 metric 最能預測 downstream WER / SIM / UTMOS。

## Relation to existing projects

### `project-audio-model-evaluation`

這是最直接的子 project。AnyAudio-Judge / rubric evaluation 可以評估 generated audio 是否正確；audio-iFID 評估的是 **latent representation 是否適合被生成模型使用**。兩者互補。

### `project-one-step-audio-generation`

one-step model 沒有 iterative refinement，對 latent geometry 更敏感。audio-iFID 可以在訓練 one-step generator 前先排除不好生成的 codec / VAE。

### `project-tts-data-pipeline`

TTS data pipeline 需要決定保存 waveform、mel、codec tokens、semantic tokens、prosody tags，或 VAE latent。audio-iFID 可作為 representation selection metric。

### `project-full-duplex-data`

full-duplex generator 要處理 overlap、backchannel、speaker identity 和 timing。Event-iFID / speaker-iFID 可以測 codec 是否把這些 interaction evidence 壓掉。

## Open questions

- audio-iFID 的 nearest neighbor 應該在 raw codec latent、SSL latent、speaker-normalized latent，還是 transcript-conditioned latent 裡找？
- interpolation 應該在 time-aligned latent space 做，還是先做 duration normalization？
- discrete tokens 沒有自然 interpolation，要用 codebook swap / span replacement / semantic-acoustic recombination 取代嗎？
- 用 FAD 類 distribution metric 會不會忽略 transcript adherence？
- audio-iFID 能否不只 predict downstream quality，也作為 training objective？如果可以，會更像 [Representation Fréchet Loss](../papers/arxiv_2604_28190/) 的 audio 版本。
- 對 full-duplex data，是否需要專門的 overlap/backchannel event representation，而不是只用 speech content encoder？

## Related Tags

#audio-ifid #audio-codec #speech-tokenizer #speech-vae #latent-space #codec-evaluation #tts #one-step-generation #full-duplex #audio-evaluation
