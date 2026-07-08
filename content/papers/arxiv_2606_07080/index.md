---
paper_key: arxiv_2606_07080
canonical_id: "arxiv:2606.07080"
title: "dots.tts Technical Report"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.07080"
pdf_url: "https://arxiv.org/pdf/2606.07080"
status: read
rating: 9
tags:
  - tts
  - continuous-tts
  - autoregressive-tts
  - flow-matching
  - audio-vae
  - meanflow
  - streaming-tts
  - voice-cloning
  - project-tts-data-pipeline
  - project-generative-speech-representation-evaluation
  - project-one-step-audio-generation
  - project-full-duplex-data
  - project-audio-model-evaluation
created: 2026-07-08
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex` and section files). Summary language is Traditional Chinese with English technical terms preserved.

## Links

- [Original URL](https://arxiv.org/abs/2606.07080)
- [PDF](https://arxiv.org/pdf/2606.07080)
- [arXiv source](https://arxiv.org/src/2606.07080)
- [Official GitHub repo](https://github.com/rednote-hilab/dots.tts)
- [Hugging Face model collection](https://huggingface.co/collections/rednote-hilab/dotstts)
- [Demo](https://rednote-hilab.github.io/dots.tts-demo)

## 一句話總結

dots.tts 是一個 2B-parameter fully continuous autoregressive TTS foundation model：它不用 discrete acoustic tokens，而是用 48 kHz AudioVAE 產生 25 Hz / 128-d continuous latent，再由 Qwen2.5-1.5B LLM + autoregressive flow-matching head 逐 patch 生成；重點是把 representation learnability、long-range AR stability、reward-free post-training、MeanFlow few-step distillation 和 streaming latency 放在同一個可開源復現的 TTS stack 裡。

## 這篇在解決什麼問題

現在 TTS 的主要問題已經不只是 intelligibility，而是更廣泛的 speech generation 能力：

- long-context voice cloning
- multilingual / cross-lingual generation
- emotion / style / paralinguistics
- streaming dialogue latency
- robust zero-shot behavior
- continuous speech representation 是否能被 LLM 穩定 autoregressively 生成

傳統 discrete-token AR TTS 的優點是可以重用 text LLM stack，但 bottleneck 是 codec/tokenizer：

- discrete token vocabulary 會限制 timbre / prosody / emotion detail。
- low-bitrate codec 容易 flatten paralinguistics。
- discrete sampling error 會被 codec decoder snap back 到 valid acoustic token，但也把細節量化掉。

Continuous AR TTS 可以保留更多細節，但有另一個問題：continuous latent 沒有 discrete token 的 correction effect，AR rollout 中的小誤差會被 decoder faithful reconstruction，逐步累積成 drift / instability。

dots.tts 的目標是同時解決：

1. 連續 latent 要高保真，但也要 prediction-friendly。
2. AR rollout 要穩定，不讓 LLM 背負 raw acoustic detail。
3. Post-training 不靠 reward model，也能改善 inference-time off-trajectory error。
4. Few-step / low-latency inference 要能服務 real-time voice agent。

## 核心方法

### 1. AudioVAE：48 kHz -> 25 Hz / 128-d continuous latent

AudioVAE 把 48 kHz mono speech 壓成：

```text
25 Hz latent stream
128 dimensions per frame
1920x temporal downsampling
```

Decoder 是 causal BigVGAN-style decoder；encoder / decoder 都保持 causal，方便 streaming synthesis。

AudioVAE 訓練分兩階段：

**Stage 1: reconstruction quality**

- multi-scale mel reconstruction loss
- multi-period + multi-scale sub-band CQT adversarial loss
- feature matching loss
- KL + flow regularization

**Stage 2: learnability**

作者認為「可重建」不等於「下游 LLM 好預測」。所以 Stage 2 保留 Stage 1 losses，再加：

- frame-level WavLM teacher alignment
- multitask downstream block：ASR、emotion、speaker classification

這個 downstream block 訓練後只保留 encoder，作為 backbone 裡的 semantic encoder。這點對我們的 representation evaluation project 很重要：他們明確把 latent 設計成 reconstruction + semantic structure + downstream learnability 的折衷。

### 2. Backbone：semantic encoder -> LLM -> AR-FM head

Backbone 有三個元件：

- semantic encoder
- LLM
- autoregressive flow-matching head (AR-FM)

LLM 初始化自 Qwen2.5-1.5B Base。文字直接用 BPE，不轉 phoneme。Audio side 則不是把 raw VAE latent 丟進 LLM，而是：

```text
25 Hz VAE latent patch: 4 frames
-> semantic encoder
-> 6.25 Hz audio-semantic embedding
-> LLM next audio step
```

LLM 只看 semantic summary，不看高變異 acoustic detail。作者說這對 continuous-AR rollout stability 是必要的。

### 3. 1T1A interleaved streaming

dots.tts 有兩種 sequence layout：

- plain mode：完整 text prefix 在 audio 之前，適合 offline TTS。
- 1T1A interleaved mode：text token 和 audio step 交錯，適合 low-latency dialogue。

1T1A layout：

```text
T A T A ... T A <eot> A A ... A
```

其中 `T` 是 BPE token，`A` 是 6.25 Hz audio position。這讓 upstream conversational LLM 每吐一個 text token，TTS 就能立刻接上下一個 audio step，不用等整句 response 完成。

這對 full-duplex / voice agent 很重要：end-to-end latency 不再隨 response length 線性增加，而主要取決於 dialogue LLM first-token latency + TTS first-packet latency。

### 4. AR-FM head：full-history conditioning

AR-FM head 用 DiT 作 velocity-field predictor：

- 18 layers
- hidden dim 1024
- FFN dim 4096
- RoPE
- RMSNorm + QK-norm
- adaLN-zero modulation from diffusion timestep + speaker embedding

每個 audio position 生成 4 個 25 Hz VAE latent frames。Flow-matching context 包含：

- current LLM hidden state `H_n`
- all previous clean patches `P_<n`
- current noisy patch `Z_n`

Sequence layout：

```text
[H_0, P_0, H_1, P_1, ..., H_{n-1}, P_{n-1}, H_n, Z_n]
```

也就是 full-history conditioning。這和只看 local context 的 head 不同，目標是減少 long-range drift。

Training 用 block-causal attention mask，讓所有 patches 可以 parallel training，但每個 noisy `Z_n` 只看到 inference 時真正可見的 context：`H_<=n` 和 `P_<n`。這讓 parallel training 的 attention 規則和 per-step AR inference 對齊。

### 5. SOAR-style reward-free self-corrective post-training

Pretraining 後，作者只 post-train AR-FM head 裡的 DiT acoustic generator：

- freeze AudioVAE
- freeze speaker encoder
- freeze semantic encoder
- freeze LLM

Self-corrective alignment 的核心是：模型用自己的 CFG-guided velocity 做一小步 detached Euler rollout，產生 off-trajectory state，再學會把這個偏掉的 state 拉回 clean endpoint。

它不需要：

- reward model
- human preference model
- external acoustic teacher

這對 TTS post-training 很有意思，因為它針對的是 inference-time ODE mismatch / error accumulation，而不是用 reward 去優化 WER 或 MOS。

### 6. CFG-aware MeanFlow distillation

SOAR 後，作者凍結 corrected DiT 作 teacher，訓練 student DiT 做 MeanFlow distillation。

Teacher trajectories 用 16-step Euler solver。CFG 被融進 teacher target，因此 student inference 不需要 conditional/unconditional 兩次 forward：

```text
MeanFlow student:
  one conditional forward per step
  NFE = 2, 3, or 4
```

這讓 dots.tts 可以做 few-step / low-latency inference。

## Training / Data

### Data

Backbone training 總共 1.5M hours audio：

1. In-house Chinese/English speech pool：約 1.2M hours。
   - vocal enhancement
   - source separation
   - speaker-aware diarization
   - language-routed ASR
   - Whisper-Large-v3 for English / most languages
   - Paraformer for Mandarin
   - filtering：cross-ASR consistency、effective bandwidth、UTMOS、intra-clip x-vector variance

2. Open-source corpora：約 300K hours。
   - Emilia
   - LibriTTS-R
   - HiFi-TTS / HiFi-TTS-2
   - WenetSpeech4TTS
   - AISHELL-3
   - Magicdata
   - MLS
   - MSR-86K
   - IndicVoices-R
   - EuroSpeech
   - WaxalNLP-TTS
   - FLEURS

3. Caption-style data：約 7K hours。
   - AutoACD sample
   - open-source corpora augmented with Gemini-generated descriptions of speaker traits, emotion, delivery, acoustic environment

### AudioVAE training

- 48 kHz audio
- Stage 1：500K steps，9.6-second cropped segments
- Stage 2：200K steps
- AdamW beta `(0.8, 0.99)`
- epsilon `1e-6`
- learning rate exponential decay `1e-4 -> 1e-6`
- WavLM teacher：23rd-layer hidden representation

### Backbone pretraining

三階段：

1. **Modality alignment**
   - freeze LLM
   - train semantic encoder + AR-FM head
   - Emilia only
   - global batch about 0.5 hours audio
   - 100K steps
   - early checkpoint already produces intelligible speech but Seed-TTS-Eval WER about 42%

2. **General training**
   - unfreeze all modules
   - full data mixture
   - global batch about 8 hours audio
   - 700K steps
   - about 4 epochs over corpus

3. **Annealing**
   - high-quality filtered subset
   - 100K steps
   - WSD schedule decays LR `2e-4 -> 3e-5`

### Post-training / distillation

SOAR：

- train only DiT acoustic generator
- 50K steps
- global batch 4 hours audio
- peak LR `3e-5`
- warmup 5K
- cosine decay to `2e-6`
- auxiliary correction weight `lambda_aux=1.0`
- CFG scale for rollout `gamma_soar=1.2`
- each main sample creates 6 auxiliary correction states

MeanFlow：

- freeze SOAR DiT as teacher
- initialize student from teacher
- 16-step Euler teacher trajectories
- CFG fused into teacher target
- 50K steps
- global batch 8 hours audio
- peak LR `1e-4`
- warmup 5K
- cosine decay to `2e-6`
- inference NFE = 2 / 3 / 4

## 主要結果

### 1. AudioVAE reconstruction：低 FPS continuous latent 仍保住 WER / SIM

LibriSpeech test-other reconstruction：

- dots.tts VAE：48 kHz, 25 FPS
- PESQ NB/WB：4.09 / 3.95
- STOI：0.973
- UTMOS：3.75
- SIM：0.969
- WER：4.14%

對照：

- Ground truth WER：4.59%
- SemanticVAE WER：4.15%，SIM 0.963
- MingTok-Audio WER：4.27%，SIM 0.950
- discrete tokenizers 多數 WER / SIM 較差

作者的解讀是：AudioVAE reconstruction 本身不是 downstream bottleneck；Stage 2 的 WavLM + multitask supervision 是讓 latent 更可學。

### 2. Seed-TTS-Eval：average WER / SIM 很強

Seed-TTS-Eval zero-shot：

- dots.tts Pretrain：average WER 2.92%，SIM 78.8
- dots.tts SOAR：average WER 2.95%，SIM 79.2
- dots.tts MF NFE=4：average WER 2.94%，SIM 78.2

對照：

- CosyVoice 3：WER 3.06%，SIM 75.3
- Seed-TTS：WER 3.65%，SIM 77.8
- VoxCPM 2：WER 3.65%，SIM 76.7

SOAR 主要提升 SIM，MeanFlow NFE=4 幾乎保留 WER，但 SIM 約掉 1 point。NFE=2 / 3 也可用，但品質下降較明顯。

### 3. MiniMax multilingual：SIM 很強，低資源 WER 有弱點

MiniMax-Speech 24-language benchmark：

- dots.tts SOAR average：WER 6.8%，SIM 83.9
- VoxCPM 2 average：WER 5.7%，SIM 82.3
- MiniMax average：WER 2.8%，SIM 76.6
- Fish-Audio S2 average：WER 3.7%，SIM 78.0

dots.tts 在 speaker similarity 上很強，在 19/24 languages outright lead，另有 2 個 tie。但 WER 被低資源 / script-divergent languages 拉高，例如 Arabic、Hindi、Turkish、Vietnamese。

作者認為這和 BPE text input 有關：不用 phoneme 的代價是需要更多 multilingual text/speech coverage。

### 4. CV3-Eval：cross-lingual voice cloning SIM 領先

CV3-Eval：

- Monolingual hard-en：dots.tts MF NFE=4 WER 4.37%，best in table。
- Cross-lingual en->zh：
  - dots.tts SOAR SIM 75.0
  - CosyVoice 3 SIM 66.9
- Cross-lingual zh->en：
  - dots.tts SOAR SIM 72.8
  - CosyVoice 3 SIM 66.4

Cross-lingual WER 則落後 CosyVoice 3：

- en->zh：dots 10.75% vs CosyVoice 8.01%
- zh->en：dots 5.66% vs CosyVoice 4.32%

這顯示 dots.tts 對 timbre / speaker preservation 強，但 language/text fidelity 仍有改善空間。

### 5. EmergentTTS-Eval：open-source overall 強，但 expressiveness mixed

EmergentTTS-Eval 用 Gemini-2.5-Pro-0506 audio judge，跟 gpt-4o-mini-tts reference 做 head-to-head。

dots.tts：

- Pretrain overall win-rate：49.2%，open-source best in table。
- SOAR overall：47.6%。
- MF4 overall：47.9%。
- SOAR WER：10.45%，open-source best。
- SOAR Syntactic Complexity：65.7%，整張表最高，甚至高於 closed-source systems。
- Pretrain Emotions：72.7%，open-source best。

但 SOAR 從 Pretrain 到 post-training 有 tradeoff：

- Syntactic Complexity：58.4% -> 65.7%
- Emotions：72.7% -> 63.9%
- Paralinguistics：54.7% -> 52.7%

作者解讀：SOAR 強化 text faithfulness / robustness，但可能犧牲 expressiveness。

### 6. Efficiency：1T1A streaming 對 voice agent 很有價值

單張 H800，MeanFlow NFE=4：

- plain text-only：TTFP 85.4 ms，RTF 0.231
- 1T1A interleaved：TTFP 54.4 ms，RTF 0.245

Interleaved mode 的核心不是只省 31 ms，而是讓 TTS 不必等完整 text response。對 upstream dialogue LLM：

```text
plain mode:
  latency = full response decoding time + TTS TTFP

interleaved mode:
  latency = LLM first-token latency + TTS interleaved TTFP
```

這對 full-duplex / real-time voice assistant 是很關鍵的 architecture signal。

## Project relevance

### project-tts-data-pipeline：非常高相關

這篇公開了很完整的 large-scale TTS data recipe：

- vocal enhancement
- source separation
- speaker-aware diarization
- language-routed ASR
- cross-ASR consistency filtering
- effective-bandwidth estimation
- UTMOS filtering
- intra-clip x-vector variance filtering
- caption-style data with speaker/emotion/delivery/acoustic-environment descriptions

對我們的 TTS data pipeline，這篇最有用的不是某一個 metric，而是它把 TTS 資料分成：

- clean transcribed speech for backbone
- multilingual open-source coverage
- caption-style control data
- high-quality annealing subset

這可以直接轉成我們自己的 data schema 和 filtering pipeline。

### project-generative-speech-representation-evaluation：非常高相關

dots.tts 是 LoSATok / WavCube / SemanticVAE 那條線的強案例：AudioVAE 不只是 reconstruction tool，而是 downstream generator target。

最重要的是 Stage 2 learnability：

> A heavily compressed latent can reconstruct well but still be too acoustically variable for downstream LLM generation.

所以 representation evaluation 應該納入：

- reconstruction WER / SIM / PESQ / STOI
- downstream LLM learnability
- AR rollout stability
- cross-lingual SIM retention
- few-step MeanFlow quality drop
- whether semantic encoder can summarize generated patches for LLM feedback

這篇提供了很好的 benchmark axis：AudioVAE latent vs discrete codec vs other continuous representations。

### project-one-step-audio-generation：高相關

dots.tts 不是 one-step model，但 CFG-aware MeanFlow distillation 很接近我們 one-step/few-step audio generation 的方向。

值得借鑑：

- teacher uses 16-step Euler trajectory
- student learns interval-conditioned mean velocity
- CFG fused into distillation target
- inference only needs one conditional forward per step
- NFE=4 幾乎保留 Seed-TTS WER，但 SIM 降約 1 point

對 one-step audio project 的問題是：能不能把 NFE=4 再往 NFE=1 壓，同時避免 speaker similarity / expressiveness 掉太多？

### project-full-duplex-data：高相關

1T1A interleaved mode 是 full-duplex / real-time voice agent 的重要設計。它不是 full-duplex conversation model，但它解決了 TTS 作為 voice agent output module 的 latency bottleneck。

對我們的 full-duplex project：

- upstream dialogue LLM 可以 token-by-token 驅動 speech generator。
- TTS 不需要等完整 sentence。
- audio-semantic feedback at 6.25 Hz 可以作為 streaming state。
- 若要做 dual-channel generator，類似 1T1A 可以擴展成 text/control/audio interleaving。

### project-audio-model-evaluation：中高相關

dots.tts 同時用 Seed-TTS-Eval、MiniMax multilingual、CV3-Eval、EmergentTTS-Eval 和 efficiency metrics。這提醒 evaluation 不能只看 WER/SIM：

- WER vs SIM tradeoff
- cross-lingual cloning
- expressiveness / paralinguistics
- model-as-judge win-rate
- streaming TTFP / RTF
- NFE-quality tradeoff

尤其 SOAR 的 tradeoff 很重要：post-training 可以提升 robustness / syntax，但可能犧牲 emotion / paralinguistics。

## Related papers in my pool

- [LongCat-AudioDiT](../arxiv_2603_29339/)：waveform latent diffusion TTS；dots.tts 引用它，且同樣關心 high-fidelity continuous latent。
- [Seed-TTS](../arxiv_2406_02430/)：主要 benchmark reference；dots.tts 在 Seed-TTS-Eval 上報告 SOTA average WER/SIM。
- [VoxCPM](../arxiv_2509_24650/) / [VoxCPM2 tool note](../../tools/openbmb-voxcpm/)：同樣是 tokenizer-free / continuous TTS reference；dots.tts 在 CV3 / Seed-TTS-Eval 對 VoxCPM2 做比較。
- [LoSATok](../arxiv_2605_27840/)：low-dimensional semantic-acoustic tokenizer；和 dots.tts AudioVAE Stage 2 一樣都強調 latent learnability。
- [WavCube](../arxiv_2605_06407/)：SSL-derived compact continuous latent；可以和 dots.tts AudioVAE 一起放進 representation evaluation。
- [DiffWave](../arxiv_2009_09761/)：早期 waveform diffusion/vocoder reference；dots.tts 代表後續從 waveform diffusion 走到 continuous latent + AR-FM + streaming 的工程化路線。
- [Is Natural Always Appropriate?](../arxiv_2606_31729/)：evaluation angle；dots.tts 的 EmergentTTS-Eval 結果顯示 expressiveness / appropriateness 不能只靠 WER/SIM。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。本文目前以 arXiv technical report 記錄。

## 我該不該細讀

建議細讀，尤其如果你關心：

1. continuous speech representation / AudioVAE 是否適合 downstream generation。
2. AR continuous TTS 如何避免 rollout drift。
3. reward-free post-training 是否能替代 reward model。
4. MeanFlow distillation 在 audio/TTS 上如何做。
5. streaming voice agent 的 text-audio interleaving。
6. large-scale multilingual TTS data pipeline。

最值得細讀：

- AudioVAE Stage 2 learnability design。
- Semantic encoder -> LLM -> AR-FM 的分工。
- Block-causal AR-FM training mask。
- SOAR self-corrective alignment objective。
- MeanFlow distillation recipe。
- Data preprocessing/filtering section。

## 可能的弱點 / open questions

1. **Raw BPE 對 low-resource / script-divergent languages 有弱點**  
   作者自己指出 Arabic、Hindi、Turkish、Vietnamese，以及 foreign words / complex pronunciation 受 BPE coverage 影響。

2. **Style / instruction control 尚未完整釋放**  
   Released system 只在 canonical zero-shot conditions 下評估，沒有 explicit style / instruction tuning。Caption-paired data 目前像是下一步。

3. **SOAR 可能犧牲 expressiveness**  
   SOAR 提升 syntactic complexity / WER，但 Emotions 和 Paralinguistics 下降，表示 robustness post-training 和 expressive speech 可能有 tradeoff。

4. **Speech-heavy mixture 不等於 unified audio generation**  
   AudioVAE 原則上 modality-agnostic，但 backbone 訓練主要是 speech-heavy，因此 singing / speech+sound generation 不在此 release。

5. **Voice cloning misuse risk**  
   作者明確提醒需要 consent-aware reference audio policy、synthetic speech detection、watermarking。

6. **Full-duplex 仍是 output-side streaming，不是 overlap dialogue generator**  
   1T1A 讓 TTS 可被 upstream dialogue LLM 低延遲驅動，但還沒有解決 dual-channel overlap、backchannel timing、interrupt handling。

## Tags

tts, continuous-tts, autoregressive-tts, flow-matching, audio-vae, meanflow, streaming-tts, voice-cloning, project-tts-data-pipeline, project-generative-speech-representation-evaluation, project-one-step-audio-generation, project-full-duplex-data, project-audio-model-evaluation

## Concepts

- dots.tts
- continuous autoregressive TTS
- AudioVAE
- 25 Hz continuous latent
- semantic encoder
- AR flow-matching head
- block-causal attention mask
- self-corrective alignment
- SOAR
- CFG-aware MeanFlow distillation
- 1T1A interleaved streaming
- Seed-TTS-Eval
- cross-lingual voice cloning

## Citation

目前以 arXiv technical report 記錄；若之後有正式 venue，再更新 citation。

```bibtex
@misc{lian2026dotsttstechnicalreport,
  title={dots.tts Technical Report},
  author={Shi Lian and Changtao Li and Bohan Li and Hankun Wang and Da Zheng and Junfeng Tian and Yufeng Ma and Colin Zhang and Kai Yu},
  year={2026},
  eprint={2606.07080},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2606.07080}
}
```
