---
paper_key: arxiv_2605_27840
canonical_id: "arxiv:2605.27840"
title: "LoSATok: Low-dimensional Semantic-Acoustic Tokenizer for Cross-Domain Audio Understanding and Generation"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.27840"
pdf_url: "https://arxiv.org/pdf/2605.27840"
status: read
rating: 9
tags:
  - audio-tokenizer
  - continuous-audio-tokenizer
  - semantic-acoustic-representation
  - diffusion-transformer
  - audio-generation
  - speech-representation
  - project-generative-speech-representation-evaluation
  - project-audio-model-evaluation
  - project-tts-data-pipeline
  - project-one-step-audio-generation
created: 2026-07-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on the arXiv TeX source (`arxiv.tex`) and BibTeX source (`reference.bib`). Summary language is Traditional Chinese with English technical terms preserved.

## Links

- [Original URL](https://arxiv.org/abs/2605.27840)
- [PDF](https://arxiv.org/pdf/2605.27840)
- [arXiv source](https://arxiv.org/src/2605.27840)
- [Official GitHub repo](https://github.com/wxzyd123/LoSATok)

## 一句話總結

LoSATok 是一個 128-dim continuous semantic-acoustic audio tokenizer：它先用 SemBo 把 MiDashengLM 的 1280-d semantic feature 壓到 128-d，再用 dual-level semantic supervision 讓 acoustic tokenizer 同時對齊 high-dimensional semantic target 和 low-dimensional semantic target。重點不是追求最好 reconstruction，而是讓下游 DiT 在 TTS、text-to-music、text-to-audio 上更容易學、更快收斂、更小模型也能生成。

## 這篇在解決什麼問題

Audio tokenizer 要同時支援兩件衝突的需求：

- audio understanding 需要 high-level semantics。
- audio generation 需要 semantic information 加 acoustic details。

很多 unified audio tokenizer 會把 semantic 和 acoustic 都塞進 high-dimensional continuous latent，例如 1280-d。這在理解任務上強，但會增加 Diffusion Transformer (DiT) 的 modeling burden：generator 要學的 target 太高維、太細碎，可能需要更寬/更大的 DiT 才能穩定生成。

作者的核心問題是：

> 能不能做一個 low-dimensional、semantic-rich、acoustically reconstructable 的 audio representation，讓 cross-domain understanding 和 generation 都可用？

這和我們的 `Generative Speech Representation Evaluation` project 非常貼近：representation 不只要 reconstruction 好，還要讓 downstream generator 好學。

## 核心方法

### 1. SemBo：把 1280-d semantic encoder feature 壓成 128-d

作者先觀察 MiDashengLM semantic features 其實有大量 redundancy。Effective rank / PCA 分析顯示，1280-d feature 在 speech 上 effective rank 約 257，在 music / general audio 上甚至低於原維度的 50%。

他們比較兩個 training-free reduction：

- Channel merging (CM)：每 10 個 channel 平均，變成 128-d。
- PCA：用 cross-domain data 的 6000 examples fit PCA，保留 128 principal components。

這兩種都能保留部分 semantic information，但對 temporal structure 和 supervision quality 不夠穩。因此作者提出 Semantic Bottleneck (SemBo)：

```text
audio
  -> frozen MiDashengLM semantic encoder
  -> high-dimensional semantic z_s^h, 1280-d
  -> compressor C
  -> low-dimensional semantic z_s^l, 128-d
  -> restorer R
  -> restored high-dimensional semantic
```

SemBo 的 compressor / restorer 都是 lightweight 2-layer MLP，約 0.72M parameters。Loss 有兩個部分：

- `L_recon`：讓 restored high-dimensional semantic feature 對齊 frozen original semantic feature。
- `L_tr`：time-relation loss，對齊 high-d / low-d feature 的 temporal similarity Gram matrix，保留時間關係。

Final SemBo loss 是 `lambda_recon * L_recon + L_tr`，其中 `lambda_recon = 1e3`。

### 2. LoSATok：dual-level semantic supervision

LoSATok 的 unified latent 是 128-d：

```text
z_a^h = acoustic encoder high-dimensional feature, 1280-d
z_a^l = fc(z_a^h), 128-d
z_s^h = frozen semantic high-dimensional target, 1280-d
z_s^l = SemBo low-dimensional semantic target, 128-d

z_uni = z_a^l + z_s^l
```

Training 時同時加兩個 semantic supervision：

- `L_H = || z_a^h - sg(z_s^h) ||_2`
- `L_L = || z_a^l - sg(z_s^l) ||_2`

這個設計很關鍵：只做 low-dimensional compression 容易丟 semantic；只做 acoustic reconstruction 又會讓 acoustic objective dominate。Dual-level supervision 讓 128-d latent 同時保留 semantic structure 和 acoustic details。

### 3. Architecture / tokenizer 設計

LoSATok 是 continuous audio tokenizer，不是 discrete codec。

- semantic encoder：MiDashengLM audio encoder + SemBo，輸出 128-d semantic feature。
- acoustic encoder：non-overlapping patch embedding / 2D convolution，把 mel spectrogram 壓成 128-d acoustic feature。
- decoder：Vocos-based decoder。
- main frame rate：25 Hz。
- output latent：`T x 128`。

Tokenizer training loss：

```text
L = lambda_mel L_mel
  + lambda_sem (L_H + L_L)
  + lambda_KL L_KL
  + lambda_fm L_fm
  + lambda_adv L_adv
```

Weights 是 `{45, 45, 1e-2, 1, 1}`。除了 semantic supervision，也有 multi-scale Mel L1、KL、feature matching、hinge adversarial loss，discriminator 使用 MFD / Multi-Frequency Discriminator。

## Training / Data

### Tokenizer / SemBo training

作者用約 13.2K hours cross-domain audio data：

- 34.6% speech：LibriSpeech、VCTK、Common Voice-en。
- 28.6% music：MTG-Jamendo、MUSDB。
- 36.8% general audio：AudioSet。

SemBo：

- trained 100K steps。
- AdamW beta 0.8 / 0.99。
- learning rate 1e-4，cosine scheduler，1K warmup。

LoSATok：

- trained 1M steps。
- 8 H100。
- global batch size 64。
- learning rate 1e-4，AdamW。

### Downstream generation training

作者把 tokenizer freeze，接到 UniFlow-Audio-style DiT framework，比不同 tokenizer 對 downstream generation 的影響。

Single-task：

- TTA：WavCaps，100K steps，4 H100。
- TTM：LP-MusicCaps-MTT，50K steps，4 H100。
- TTS：LibriTTS，50K steps，4 H100。

Multi-task：

- WavCaps + LP-MusicCaps + LibriTTS。
- 150K steps，8 H100。

Inference：

- CFG scale 3.0。
- 20 sampling steps。

Evaluation：

- TTA / TTM：FAD、FD、KL、CLAP。
- TTS：WER、SIM、UTMOS。

## 主要結果

### 1. SemBo 128-d 保留可用 semantic ability

作者在小表中比較 128-d compression：

- MiDashengLM 1280-d：ESC 96.95，FSC 98.26，GTZAN 91.19。
- CM 128-d：ESC 92.80，FSC 86.11，GTZAN 89.39。
- PCA 128-d：ESC 94.95，FSC 78.06，GTZAN 90.49。
- SemBo 128-d：ESC 93.70，FSC 89.01，GTZAN 89.49。

SemBo 不等於保留完整 MiDashengLM 能力，但在 128-d 下比 naive compression 更穩，尤其 FSC 沒有像 PCA 那樣掉到 78.06。

### 2. LoSATok understanding 不如高維 semantic encoder，但比很多 codec / SSL baseline 強

在 XARES 15-task linear probing benchmark 上，average score：

- EnCodec 128-d：27.80。
- EzAudio 64-d：27.65。
- UniFlow-Audio 128-d：26.82。
- LoSATok 128-d：59.30。
- DAC 1024-d：33.59。
- SemantiCodec 768-d：55.22。
- Whisper 1280-d：62.43。
- WavLM 1024-d：44.33。
- Ming-UniAudio 896-d：63.27。
- DashengTokenizer 1280-d：74.67。
- MiDashengLM 1280-d：75.48。

Interpretation：LoSATok 沒有打敗 high-dimensional semantic encoder，但它在 128-d 下保留了相當強的 semantic usability，遠高於一般 acoustic codec。

### 3. LoSATok generation 明顯更好，尤其在固定小 DiT compute 下

Single-task LoSATok 使用 128-d latent、DiT dim 512、208M parameters：

- TTS：WER 3.030、SIM 0.548、UTMOS 3.367。
- TTM：FAD 4.156、FD 25.089、KL 1.788、CLAP 0.282。
- TTA：FAD 2.760、FD 25.743、KL 1.844、CLAP 0.381。

同樣 208M / DiT dim 512 的 UniFlow-Audio：

- TTS：WER 3.589、SIM 0.408、UTMOS 2.768。
- TTM：FAD 6.147、FD 36.098、CLAP 0.250。
- TTA：FAD 4.925、FD 40.017、CLAP 0.243。

DashengTokenizer 1280-d 如果只配 DiT dim 512 / 215M，TTS 幾乎崩掉：

- WER 100、SIM 0.015、UTMOS 1.251。

即使用更大的 975M DiT，DashengTokenizer 才追上部分 generation quality：

- TTS WER 3.652、SIM 0.287、UTMOS 3.144。
- TTA FAD 4.138、FD 24.605、CLAP 0.379。

這是這篇最重要的 evidence：高維 semantic-rich latent 不是免費午餐，downstream generator 可能要更大模型才學得動。

### 4. Multi-task joint generation 也支持 LoSATok

Multi-task joint training 下，LoSATok 仍然最好：

- TTS：WER 3.667、SIM 0.507、UTMOS 3.310。
- TTM：FAD 3.366、FD 20.127、KL 1.628、CLAP 0.300。
- TTA：FAD 1.987、FD 21.363、KL 1.700、CLAP 0.396。

相比 UniFlow-Audio，LoSATok 在 TTS speaker similarity、TTA/TM distribution metrics 和 CLAP 上都更強。

### 5. Convergence / compute-to-quality 很關鍵

作者報告 LoSATok 收斂更快。以 TTA CLAP 為例，LoSATok 在 21K / 28K steps 左右就達到 UniFlow-Audio / DashengTokenizer 150K steps 才有的 comparable performance，約省下 120K steps。

這直接支持我們之前的想法：

> 好的 representation 不只是 final quality 高，而是讓下游 generator 用更少 training steps / GPU-hours 就學到可用品質。

### 6. Reconstruction 不是 LoSATok 的主戰場

Reconstruction table 顯示 LoSATok RTF 很快，25 Hz 下 RTF 0.0033，接近 DashengTokenizer 0.0034，但 reconstruction fidelity 不如先進 acoustic tokenizers。

例如：

- UniFlow-Audio 在 AudioSet / MUSDB Mel-16k、STFT-16k 上最好。
- DashengTokenizer 在 SeedTTS speech PESQ/STOI 很強。
- LoSATok 的 AudioSet/MUSDB reconstruction distance 較高，SeedTTS PESQ/STOI 也較弱。

作者明確指出 reconstruction score 可能不直接對應 generation。UniFlow-Audio reconstruction 最好，但 understanding / generation 不如 LoSATok。這和 [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/) 的 thesis 完全一致。

### 7. Ablation：只靠 acoustic reconstruction 會吃掉 semantic

LoSATok ablation 很有價值：

- 移除 `L_L` 幾乎消除 understanding ability。
- 移除 `L_H` 也會讓 FSC 明顯下降。
- 用 CM 當 supervision 雖然 reconstruction 更好，但 understanding 很差。

這表示 tokenizer training 不能只靠 reconstruction 或 naive compressed semantic target；需要一個能保留 temporal semantic structure 的 low-dimensional semantic bottleneck。

## Project relevance

### project-generative-speech-representation-evaluation：非常高相關

這篇是本 project 的核心案例之一。它直接提供 audio-side evidence：

- reconstruction metric 不能代表 downstream generation quality。
- high-dimensional semantic latent 雖然理解能力強，但可能讓 DiT 很難學。
- low-dimensional semantic-acoustic latent 可以在固定 DiT size 下提升 TTS / TTA / TTM。
- representation quality 應該包含 convergence speed / compute-to-quality，而不是只看 final metric。

可以把 LoSATok 加進 benchmark candidate：

```text
representation candidates:
  - codec tokens / neural codec latent
  - speech VAE / AudioVAE latent
  - WavCube-style SSL-derived compact latent
  - LoSATok-style low-dimensional semantic-acoustic latent
  - VoxCPM/VoxCPM2 tokenizer-free continuous latent
```

對我們要做的 audio-iFID / representation evaluation，LoSATok 提醒：

- 只測 decoded interpolation naturalness 不夠。
- 還要測 downstream DiT 用多小模型、多短 steps 可以學到同等 WER/SIM/FAD/CLAP。
- 還要測 semantic ability 是否被 acoustic reconstruction objective 吃掉。

### project-audio-model-evaluation：高相關

Audio judge / rubric evaluation 可以評 final output，但 LoSATok 提醒要加一層 representation-level evaluation：

```text
same generation framework
same data
same DiT size
swap tokenizer / latent representation
measure final quality + convergence speed
```

這能避免「output judge 覺得某個 model 好」，但其實 improvement 只是來自更大 DiT 或更久訓練，而不是 representation 本身更好。

### project-tts-data-pipeline：中高相關

TTS data pipeline 不只要 clean transcript / speaker label / audio quality，也可以保存 downstream-friendly representation cache。LoSATok 對 TTS pipeline 的啟發：

- 需要記錄 tokenizer frame rate、latent dimension、semantic/acoustic supervision source。
- 需要保存 ASR/WER、speaker SIM、UTMOS 以外的 generator learnability 指標。
- 若未來訓練 dual-channel / full-duplex TTS generator，應該比較 mel、codec tokens、WavCube latent、LoSATok latent、AudioVAE latent 哪個更好學。

### project-one-step-audio-generation：中度相關

LoSATok 不是 one-step paper，但它對 one-step audio generation 很有啟發。One-step / few-step generator 對 latent geometry 更敏感，如果 target latent 太高維或 acoustic detail 太雜，模型沒有多步 refinement 幫忙修正，可能更容易 collapse 或 output flat audio。

因此 one-step audio project 可以把 LoSATok 當 target latent candidate，並比較：

- LoSATok vs WavCube vs AudioVAE vs codec tokens。
- one-step / few-step 下的 WER、SIM、UTMOS、FAD、CLAP。
- steps-to-quality / GPU-hours-to-quality。

## Related papers in my pool

- [WavCube](../arxiv_2605_06407/)：最接近的 speech-side reference。同樣把 high-dimensional SSL feature 壓成 128-d semantic-acoustic latent，並顯示 raw high-d target 讓 DiT 難學。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：image-side iFID 起點，說明 reconstruction metric 不等於 generation metric。
- [Diffusion Transformers with Representation Autoencoders](../arxiv_2510_11690/)：image-side RAE reference。高維 semantic representation 需要配套 generator architecture / training recipe。
- [Seed-TTS](../arxiv_2406_02430/)：本篇用 SeedTTS EN/ZH 作 speech reconstruction evaluation，也可作 TTS quality reference。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free continuous speech representation candidate，可和 LoSATok 一起納入 representation benchmark。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。本文目前以 arXiv preprint 記錄。

## 我該不該細讀

建議細讀，尤其是我們要做 `Generative Speech Representation Evaluation` 的 speech/audio version。

最值得讀：

1. SemBo 的 effective-rank motivation 和 time-relation loss。
2. LoSATok dual-level semantic supervision。
3. understanding vs reconstruction vs generation 的三軸結果。
4. convergence curve / training-step saving。
5. reconstruction table，因為它清楚展示 reconstruction fidelity 不是 downstream generation 的充分條件。

## 可能的弱點 / open questions

1. **LoSATok reconstruction 明顯不是 SOTA**  
   如果任務需要高保真 waveform reconstruction 或 codec replacement，LoSATok 不是直接答案。它更像 downstream generation / understanding tokenizer。

2. **128-d 是設計選擇，不一定是最優解**  
   這篇證明 128-d 很有效，但沒有完整掃 dimension / frame rate / semantic-acoustic capacity tradeoff。對我們的 benchmark 來說，應該把 dimension 和 frame rate 都當 independent variables。

3. **cross-domain data 只有 13.2K hours**  
   Speech、music、general audio 都涵蓋，但規模還不算極大。若換到更大 multilingual / noisy / conversational corpus，SemBo 和 LoSATok 是否維持優勢還要驗證。

4. **evaluation 仍依賴 fixed downstream framework**  
   本文主要用 UniFlow-Audio-style DiT。Representation ranking 可能會受 generator architecture 影響，所以我們的 project 應該跨 diffusion、flow matching、AR、one-step/few-step generator 比較。

5. **full-duplex / overlap 沒被直接測**  
   LoSATok 是 cross-domain audio tokenizer，不是 dialogue overlap tokenizer。對 full-duplex project，需要額外測 overlap、backchannel、speaker separation、dual-channel reconstruction/generation。

## Tags

audio-tokenizer, continuous-audio-tokenizer, semantic-acoustic-representation, diffusion-transformer, audio-generation, speech-representation, project-generative-speech-representation-evaluation, project-audio-model-evaluation, project-tts-data-pipeline, project-one-step-audio-generation

## Concepts

- Semantic Bottleneck (SemBo)
- low-dimensional semantic-acoustic tokenizer
- continuous audio tokenizer
- dual-level semantic supervision
- time-relation loss
- representation learnability
- compute-to-quality
- reconstruction-generation mismatch
- DiT modeling burden
- cross-domain audio understanding and generation

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{zhang2026losatoklowdimensionalsemantica,
  title={LoSATok: Low-dimensional Semantic-Acoustic Tokenizer for Cross-Domain Audio Understanding and Generation},
  author={Zhisheng Zhang and Xiang Li and Yixuan Zhou and Jing Peng and Guoyang Zeng and Zhiyong Wu},
  year={2026},
  eprint={2605.27840},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2605.27840}
}
```
