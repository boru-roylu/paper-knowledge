---
title: "Project: One-step audio generation"
---

## Motivation

這條 project line 的目標是探索 **one-step / few-step audio generation**：能不能把 diffusion / flow / autoregressive audio generator 壓到極少 sampling steps，同時保留 speech intelligibility、speaker identity、prosody、temporal structure，以及 full-duplex dialogue 的 overlap / backchannel timing。

對 audio 來說，one-step generation 的吸引力很直接：

- streaming TTS latency 更低。
- dialogue / full-duplex system 可以更快回應。
- long-form audio generation 的推論成本下降。
- 若能 chunk-wise causal generation，就有機會做 real-time speech agent。

但風險也同樣明顯：one-step model 很容易失去 iterative refinement，導致 pronunciation error、flat prosody、speaker drift、repeated acoustic patterns、background / room tone discontinuity，或 full-duplex overlap timing 不自然。

## Current thesis

AAD-1 雖然是 video paper，但它提供一個可借到 audio 的核心原則：

> **Inference-time generator 可以是 causal / streaming；training-time critic 不必 causal，應該看完整 sequence 來懲罰長程 drift。**

Representation Fréchet Loss 補上另一個互補原則：

> **One-step generator 不一定只能靠 teacher distillation 或 GAN；也可以直接用 frozen representation statistics 做 distribution-level post-training。**

這對 one-step audio generation 很重要，因為很多失敗不是單一 frame / codec token 能看出來，而是要跨 phrase、utterance、dialogue 才能判斷：

- speaker identity 是否慢慢漂移
- prosody 是否變平
- rhythm / speaking rate 是否累積偏移
- overlap 是否遮蔽主 speaker
- backchannel 是否在正確時間進來
- long-form dialogue 是否仍然自然

## Target

- 建立 one-step / few-step audio generation 的研究路線。
- 從 video 的 one-step autoregressive distillation 借方法，但轉成 speech / audio-specific objective。
- 探索 causal chunk-wise generator + bidirectional utterance/dialogue-level critic。
- 先在 codec-token / latent audio generation 上驗證，再考慮 waveform-level。
- 把 evaluation 和 `project-audio-model-evaluation` 接起來，用 rubric judge / attribution / human eval 檢查是否 reward-hack。

## Candidate training recipe

一個合理起點：

```text
teacher audio diffusion / flow model
  -> Stage I: causal audio generator initialization
  -> Stage II: one-step distribution matching warmup
  -> Stage III: asymmetric adversarial / reward refinement
```

其中：

- generator：causal / chunk-wise，輸入 transcript、speaker condition、past audio context，輸出下一段 audio latent / codec tokens。
- critic：training 時看完整 utterance 或完整 dialogue，可以是 discriminator、audio judge、rubric reward model，或多個 critics。
- warmup：先用 teacher distribution / flow matching / DMD-style objective，避免 one-step student 一開始離 data manifold 太遠。
- refinement：再用 sequence-level adversarial loss 或 rubric reward 修 prosody、naturalness、speaker consistency、overlap timing。

另一條更 minimal 的路線是 FD-loss：

```text
real audio dataset
  -> frozen audio encoders
  -> reference feature mean/covariance

one-step audio generator
  -> generated batch
  -> frozen audio encoders
  -> EMA / queue generated statistics
  -> representation FD-loss
```

這條路線的吸引力是：不一定需要 teacher logprobs、paired targets 或 adversarial discriminator。它比較像直接讓 generated audio 的 representation distribution 貼近 real audio。

## iFID and FD-loss as a combined route

[Making Reconstruction FID Predictive of Diffusion Generation FID](../papers/arxiv_2603_05630/) 和 [Representation Fréchet Loss](../papers/arxiv_2604_28190/) 可以接成一條很清楚的 one-step audio generation pipeline：

```text
audio-iFID / interpolation metric
  -> choose codec / VAE / semantic token / latent representation
  -> audio FD-loss post-training
  -> one-step audio generator
  -> rubric judge + human eval
```

兩篇的角色不同：

- **iFID 是 diagnostic / predictor**：它回答「這個 latent space 是否適合 diffusion / generative modeling？」普通 reconstruction FID、mel loss、PESQ、STOI、WER 或 reconstruction FAD 可能只表示 codec 很會還原 input，不代表 latent space 可被 generator 平滑取樣。
- **FD-loss 是 training objective**：它回答「怎麼把 generated samples 的 distribution 推近 real distribution？」它把 Fréchet Distance 從 evaluation metric 變成可微的 representation-space distributional loss。

因此對 audio 來說，合理策略不是直接拿 reconstruction 最好的 codec 來做 one-step generator，而是：

1. 先設計 **audio-iFID**：在 audio latent space 找 nearest neighbor / local interpolation，decode 後用 audio representation FID / FAD / FDr_audio 評估，檢查 interpolation region 是否仍保留 speech intelligibility、speaker identity、prosody、event semantics。
2. 用 audio-iFID / downstream generation score 選 codec、VAE、semantic token 或 prosody token。
3. 再用 **audio FD-loss** 做 generator-side post-training，讓 one-step generator 的 output distribution 靠近 real audio distribution。
4. 最後用 AnyAudio-Judge-style rubric、ASR/content metrics、speaker similarity 和 human eval 檢查 conditional correctness，避免 FD-loss 只改善 global distribution 卻犧牲 transcript adherence。

簡化理解：

```text
iFID: is this latent space generative?
FD-loss: how do we push generated samples toward the real distribution?
```

這也說明為什麼它們和 one-step audio 特別相關：one-step model 沒有多步 refinement，latent space 如果不好取樣，錯誤會被直接 decode 出來；而 generator 如果只靠 per-sample regression，很容易產生 over-smoothed speech 或 flat prosody。iFID 負責挑一個比較可生成的空間，FD-loss 負責讓 one-step output 的整體 distribution 更像真實資料。

## Audio-specific failure modes

AAD-1 的 motion collapse 可以類比成 audio 裡的：

- repeated acoustic token pattern
- monotone prosody
- frozen speaker timbre
- phoneme deletion / slurring
- rhythm collapse
- speaker identity drift
- room tone / background discontinuity
- backchannel timing collapse
- overlap region leakage 或 masking main speech

因此 audio critic 不應只做 frame-level realism。它至少要有：

- phonetic / content fidelity
- speaker identity consistency
- prosody / rhythm realism
- utterance-level naturalness
- dialogue-level turn-taking / overlap correctness
- mixture-level realism for full-duplex A+B audio

## Relation to existing projects

**project-full-duplex-data**

One-step full-duplex generator 必須 causal 才能 real-time，但 training 可以用完整 dual-channel dialogue 和 original mixture 做 supervision。這和 mixture-consistent multi-loss training 可以合併：

```text
causal generator predicts A/B chunks
bidirectional critic sees full A/B/mix dialogue
mixture consistency checks A_pred + B_pred
rubric judge checks overlap/backchannel timing
```

**project-audio-model-evaluation**

One-step audio generation 很容易被單一 reward / discriminator hack。需要 AnyAudio-Judge-style rubrics 和 FlashTrace-style grounding audit 來檢查 judge 的 yes/no 是否真的依賴正確 audio / transcript / event evidence。

**project-tts-data-pipeline**

Data quality 會直接影響 one-step student：如果 long-form speech、pause、speaker consistency、overlap、nonverbal events 沒清楚標好，one-step distillation 會更容易學到 shortcut。

## Reading map

- [AAD-1](../papers/arxiv_2606_03972/)：video-side core reference。重點是 asymmetric adversarial distillation、DMD warmup、causal generator + bidirectional holistic discriminator。
- [Reconstruction vs. Generation](../papers/arxiv_2501_01423/)：VA-VAE / VF Loss 顯示 tokenizer latent space 可以用 foundation model alignment 改善 generation suitability，對 audio codec / VAE 設計很重要。
- [SLED](../papers/arxiv_2505_13181/)：continuous latent speech LM；每個 autoregressive step 用 lightweight MLP + Energy Distance 做 one-forward sampling，對 low-latency / one-step-per-frame audio generation 很重要。
- [VoxCPM](../papers/arxiv_2509_24650/)：tokenizer-free TTS；用 FSQ semi-discrete skeleton + RALM residual acoustic modeling + local DiT patch decoder，提供 SLED 之外的 semi-discrete / residual hierarchy route。
- [MeanFlow-TSE](../papers/arxiv_2512_18572/)：speech-side one-step MeanFlow example。它把 mixture 當成 background-to-target flow path 上的中間點，利用 enrollment 和 estimated mixing ratio 一步抽出 target speaker；對 full-duplex overlap cleanup / low-latency speaker-conditioned generation 很有參考價值。
- [Representation Fréchet Loss](../papers/arxiv_2604_28190/)：FD-loss 把 Fréchet Distance 變成 trainable distributional objective，可改善 one-step generators，也能把 multi-step generators repurpose 成 one-step。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../papers/arxiv_2603_05630/)：iFID 顯示 reconstruction quality 不一定預測 latent diffusion generation quality；對 audio codec / VAE / tokenizer selection 是重要警告。
- [PlanAudio](../papers/arxiv_2605_28063/)：composite speech+sound generation target；未來可測 one-step composite audio。
- [AnyAudio-Judge](../papers/arxiv_2606_03116/)：可作 audio rubric critic / reward model 的起點。
- [DialogueSidon](../papers/arxiv_2604_09344/)：dual-channel dialogue recovery，可提供 full-duplex one-step generator 的 pseudo labels。
- [Sommelier](../papers/arxiv_2603_25750/)：full-duplex preprocessing pipeline，可提供 long dialogue training data。
- [Dia](../tools/nari-labs-dia/) / [VoxCPM](../tools/openbmb-voxcpm/)：可作 dialogue / expressive TTS baseline。

## First experiments

### Experiment A: one-step codec-token TTS prototype

- Teacher：現有 multi-step audio diffusion / flow / codec-token generator。
- Student：causal one-step generator。
- Data：clean single-speaker + multi-speaker dialogue clips。
- Compare：multi-step teacher、one-step distilled student、one-step + sequence critic。
- Metrics：WER、speaker similarity、prosody naturalness、speaker drift over long utterances、human preference。

### Experiment B: bidirectional critic ablation

目標：驗證 AAD-1 的核心原則是否也適用 audio。

- causal frame/chunk-level critic
- causal utterance-level critic
- bidirectional utterance-level critic
- bidirectional dialogue-level critic

觀察 one-step audio 是否出現 repeated patterns、prosody collapse、speaker drift 或 overlap timing failure。

### Experiment C: full-duplex one-step generator

- Input：speaker-wise transcript / event plan / past audio context。
- Output：dual-channel A/B audio chunks。
- Loss：A/B reconstruction + mixture consistency + bidirectional full-dialogue critic。
- Evaluation：overlap WER、speaker leakage、backchannel recall、turn-taking timing、AnyAudio-Judge rubrics。

### Experiment D: audio FD-loss post-training

目標：把 FD-loss 從 image representation space 改成 audio representation space，測它是否能改善 one-step audio generator。

候選 representation：

- speaker embedding：speaker identity distribution。
- ASR / SSL speech encoder：phonetic / linguistic distribution。
- prosody / emotion encoder：style and rhythm distribution。
- CLAP / audio-text encoder：semantic audio-event distribution。
- codec-token latent encoder：acoustic manifold。

重要 ablation：

- single representation vs multi-representation FD-loss。
- FD-loss only vs FD-loss + transcript/content loss。
- FD-loss vs asymmetric adversarial critic。
- one-step base generator vs multi-step generator repurposed into one-step。

成功標準不能只看 FAD / FDr_audio。還要看 WER、speaker similarity、prosody naturalness、prompt adherence、human preference，避免 distribution match 犧牲 conditional correctness。

## Open questions

- one-step audio generator 應該輸出 waveform latent、codec tokens，還是 mel / flow latent？
- audio critic 要看 raw waveform、codec tokens、spectrogram，還是 ASR/transcript-derived features？
- audio codec / VAE / tokenizer 要怎麼評估 generative suitability，而不是只看 reconstruction FAD / mel loss / WER？
- DMD-style warmup 在 audio 上是否足夠穩，還是需要 consistency / rectified flow objective？
- one-step model 的最大失敗會是 intelligibility、speaker identity、prosody，還是 long-horizon drift？
- reward / adversarial refinement 會不會讓模型產生 judge-friendly 但人聽不自然的 shortcut？

## Related Tags

#one-step-generation #diffusion-distillation #adversarial-training #audio-generation #tts #full-duplex #audio-evaluation
