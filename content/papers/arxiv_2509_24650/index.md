---
paper_key: arxiv_2509_24650
canonical_id: "arxiv:2509.24650"
title: "VoxCPM: Tokenizer-Free TTS for Context-Aware Speech Generation and True-to-Life Voice Cloning"
year: 2025
venue: "arXiv technical report"
url: "https://arxiv.org/abs/2509.24650"
pdf_url: "https://arxiv.org/pdf/2509.24650"
status: read
rating: 8.6
tags:
  - tts
  - zero-shot-tts
  - tokenizer-free
  - voice-cloning
  - speech-llm
  - continuous-latent
  - project-tts-data-pipeline
  - project-one-step-audio-generation
  - project-full-duplex-data
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`) and bibliography. The arXiv metadata extraction failed to expand the `\modelname` macro, so title/authors were corrected manually from the TeX source.

## Links

- [Original arXiv abstract](https://arxiv.org/abs/2509.24650)
- [PDF](https://arxiv.org/pdf/2509.24650)
- [arXiv source](https://arxiv.org/src/2509.24650)
- [Official GitHub repo](https://github.com/OpenBMB/VoxCPM)
- [Demo page](https://openbmb.github.io/VoxCPM-demopage/)
- [Existing tool note](../../tools/openbmb-voxcpm/)

## 一句話總結

VoxCPM 是 OpenBMB 的 **tokenizer-free zero-shot TTS** 技術報告：它不用外部 speech tokenizer，而是在 end-to-end framework 裡用 **FSQ semi-discrete bottleneck** 讓 TSLM 做 semantic-prosodic planning，再用 RALM 補 acoustic residual details，最後由 local DiT / flow-matching decoder 生成高品質 speech latents，試圖同時保留 discrete token 的穩定性與 continuous latent 的聲學細節。

## 這篇在解決什麼問題

現代 TTS 面臨一個穩定性和表現力的 trade-off：

- **Discrete codec / tokenizer route**  
  例如 VALL-E / CosyVoice 類模型。離散 token 讓 autoregressive generation 穩定，但 quantization 會丟掉細微 timbre、prosody、emotion、breathiness 等 acoustic details。

- **Continuous latent route**  
  例如 MELLE、SLED、DiTAR、FELLE、VibeVoice 等。continuous latent 保留更多細節，但若一個模型同時負責 high-level semantic planning 和 low-level acoustic rendering，容易 task entanglement，導致 long-sequence error accumulation。

很多 SOTA TTS 走 multi-stage hybrid pipeline：LLM 產生 discrete token，diffusion / flow decoder 再做 acoustic refinement。這提升品質，但也帶來 semantic-acoustic divide：LLM 在抽象離散空間工作，local decoder 只做局部 refinement，整體不是真正 end-to-end。

VoxCPM 的問題設定是：**能不能在不依賴 external speech tokenizer 的情況下，用一個 end-to-end architecture 自己學出穩定的 semantic skeleton 和細緻 acoustic residual？**

## 核心方法

### 1) Overall architecture

VoxCPM 生成 continuous speech latent patches：

```text
text tokens + previous audio latents
  -> LocEnc
  -> TSLM
  -> FSQ bottleneck
  -> RALM residual acoustic modeling
  -> LocDiT local diffusion decoder
  -> AudioVAE decoder
  -> waveform
```

每個 speech patch 由以下條件生成：

```text
h_final = FSQ(TSLM(text, history)) + RALM(...)
z_i ~ LocDiT(h_final, previous_patch)
```

核心是把 semantic/prosodic planning 和 acoustic rendering 分工，但保持 end-to-end trainable。

### 2) TSLM：Text-Semantic Language Model

TSLM 是主要的 language model backbone，初始化自 **MiniCPM-4-0.5B**。它直接處理 raw text / BPE tokens，不依賴 phonemizer。作者主張這讓模型保留較好的 text understanding，能從 text context 推斷適合的 prosody / style。

TSLM 的角色是：

- high-level linguistic structure；
- semantic content；
- coarse prosodic plan；
- contextual speaking style。

### 3) FSQ semi-discrete bottleneck

VoxCPM 的核心是 **Finite Scalar Quantization (FSQ)** bottleneck。它不是 external tokenizer，也不是最終 prediction target，而是 TSLM hidden states 中間的一個 differentiable regularization：

```text
h_FSQ = round / clip / scalar quantize(h_TSLM)
```

backward 用 straight-through estimator。

作者稱它為 **semi-discrete representation**，因為它用比標準 FSQ 更高的維度，既有 discreteness 的穩定性，也保留足夠資訊容量。

它的功能像 RVQ 第一層：

- 建立 semantic-prosodic skeleton；
- 降低 continuous model 的 task entanglement；
- 讓 TSLM 不需要同時記住所有 acoustic details；
- 避免直接把 high-dimensional FSQ / VQ codebook 當 LM vocabulary 造成 vocabulary explosion。

### 4) RALM：Residual Acoustic Language Model

FSQ bottleneck 會刻意壓掉一部分 fine-grained acoustic information。RALM 的任務是把這些 residual details 補回來：

- speaker identity；
- spectral fine structure；
- micro-prosody；
- timbre details；
- acoustic history。

RALM condition 來自：

- TSLM 的 text hidden states；
- previous FSQ speech representations；
- LocEnc 得到的 historical acoustic embeddings。

最後用：

```text
h_final = h_FSQ + h_residual
```

這讓 TSLM+FSQ 負責 stable skeleton，RALM 負責 expressive acoustic details。

### 5) LocDiT：Local Diffusion Transformer decoder

LocDiT 是 local latent generator，類似 DiTAR 的 local patch decoder。它是 bidirectional Transformer，對當前 patch 內有 full receptive field；同時以上一個 patch `z_{i-1}` 作 condition，把生成任務變成 outpainting，而不是獨立生成每個 patch。

訓練用 conditional flow matching objective：

```text
L = L_FM + lambda * L_Stop
```

並在 LocDiT condition 上做 masking 以支援 inference-time CFG。

### 6) Causal Audio VAE

VoxCPM 使用 causal Audio VAE，把 16kHz mono waveform 壓到 25Hz continuous latent：

- encoder / decoder：stacked causal CNNs；
- downsampling factor：640x；
- stride sequence：[2, 5, 8, 8]；
- loss：Mel-spectrogram reconstruction + GAN loss + tiny KL loss；
- KL weight：5e-5。

這使整體系統可 streaming / low latency。

## Training / Data

資料：

- **Internal bilingual corpus**：1.8 million hours，主要 Chinese / English speech。
  - sources：audiobooks、podcasts、interviews、broadcast dramas。
  - preprocessing：16kHz mono resampling、source separation、VAD、ASR for text-audio alignment。
  - augmentation：random phoneme replacement on transcriptions，用於 robustness / pronunciation correction。
- **Emilia**：public 95K hours Chinese / English，用於 comparison / ablation。

模型：

- VoxCPM-0.5B。
- TSLM：24 layers，MiniCPM-4-0.5B initialized。
- RALM：6 layers。
- LocEnc：4 layers。
- LocDiT：4 layers。
- hidden dim 1024，FFN dim 4096。
- FSQ：256 dimensions，9 scalar levels。
- patch size：2；TSLM/RALM token rate 12.5Hz。
- AudioVAE：16kHz -> 25Hz latents。

Training：

- VoxCPM：internal 1.8M hours，500K iterations，40 H100。
- VoxCPM-Emilia：Emilia，200K iterations，24 H100。
- optimizer：AdamW，peak lr 1e-4。
- Warmup-Stable-Decay schedule；decay phase 搭配 batch size doubling。
- LocDiT condition masking ratio：0.1 for CFG。

Evaluation：

- SEED-TTS-EVAL：general TTS intelligibility / similarity，English、Chinese、Hard set。
- CV3-EVAL：CosyVoice 3 competition derived，in-the-wild expressive voice cloning。
- objective metrics：WER / CER、speaker SIM、DNSMOS。
- subjective metrics：20 native speakers，N-MOS / S-MOS。

## 主要結果

### SEED-TTS-EVAL

VoxCPM 在 open-source systems 中取得很強的結果：

- EN WER：**1.85%**
- EN SIM：**72.9%**
- ZH CER：**0.93%**
- ZH SIM：77.2%
- Hard CER：8.87%

VoxCPM-Emilia 用 public Emilia 也有競爭力：

- EN WER：2.34%
- ZH CER：1.11%

作者主張這說明 FSQ bottleneck 和 hierarchical semantic-acoustic modeling 即使在較小 public dataset 上也能穩定工作。

### CV3-EVAL

在 expressive / in-the-wild benchmark：

- CV3-EVAL ZH-CER：**3.40**
- CV3-EVAL EN-WER：**4.04**
- CV3-Hard-ZH CER：**12.9**
- CV3-Hard-EN WER：**7.89**

VoxCPM 在這些 WER/CER 指標上很強，但 speaker SIM / DNSMOS 不一定全面最佳；IndexTTS2 / CosyVoice3 在某些 speaker similarity / naturalness 指標仍有優勢。

### Subjective MOS

主觀評估顯示：

- English：
  - VoxCPM N-MOS：4.11
  - VoxCPM S-MOS：**4.18**
- Chinese：
  - VoxCPM N-MOS：4.10，低於 IndexTTS2 的 4.25。
  - VoxCPM S-MOS：**4.11**。

作者解讀是：VoxCPM 在 voice cloning consistency 很強；Chinese naturalness 上 IndexTTS2 可能更好。

### FSQ bottleneck ablation

這是最重要的 ablation。沒有 FSQ 的 purely continuous model 在 hard cases 明顯崩：

- w/o FSQ：ZH-hard CER **24.92%**
- FSQ-d256：ZH-hard CER **18.19%**

作者認為這證明：純 continuous model 把 semantic planning 和 acoustic rendering 混在一起，會造成 instability；FSQ bottleneck 能形成 summary space，幫助 division of labor。

FSQ dimension 也有 trade-off：

- 太小如 d4：過度 constrain representation，prosody capacity 不足。
- 太大如 d1024：discretization strength 不夠，task entanglement 回來。
- d128/d256 較好。

### RALM ablation

去掉 RALM 或 acoustic history 會明顯變差：

- default：EN WER 2.98 / ZH CER 1.77 / ZH-hard CER 18.19。
- w/o RALM：EN WER 4.34 或 5.35；ZH-hard CER 25.00 或 30.40。
- w/o acoustic embeddings in RALM：ZH CER 4.94 / ZH-hard CER 27.17。

這支持 RALM 負責補 acoustic details 的設計。

### Training schedule

Warmup-Stable-Decay 的 decay phase 對 zero-shot similarity 很重要：

- EN WER：2.05 -> 1.85。
- ZH CER：0.99 -> 0.93。
- ZH-hard CER：13.22 -> 8.87。
- ZH-hard SIM：68.6 -> 73.0。

### CFG

LocDiT guidance scale 有 non-monotonic trade-off：

- CFG 1.0：EN WER 16.32，ZH CER 14.47，ZH-hard CER 56.87，明顯不行。
- CFG 2.0：最佳 balance，EN WER 1.85，ZH CER 0.93，ZH-hard CER 8.87。
- CFG 5.0：又崩，EN WER 12.78，ZH CER 17.23。

## Project relevance

### 對 project-tts-data-pipeline

這篇包含很重要的 data pipeline 信息：

```text
raw bilingual speech
  -> 16kHz mono
  -> source separation
  -> VAD
  -> ASR
  -> text-audio alignment
  -> specialized augmentation such as random phoneme replacement
```

它再次說明 TTS data pipeline 不只是 transcript cleaning，而是要同時支援：

- speaker similarity；
- context-aware prosody；
- pronunciation correction / robustness；
- in-the-wild voice cloning；
- long and hard sentence stability。

但這篇內部 1.8M hours corpus 沒有公開細節，所以真正可複製的部分主要是 pipeline components 和 Emilia ablation。

### 對 project-one-step-audio-generation

VoxCPM 和 SLED 形成一個很好的對照：

- SLED：continuous latent + Energy Distance + lightweight per-frame one-forward sampling。
- VoxCPM：semi-discrete FSQ skeleton + residual acoustic model + local DiT / flow matching。

VoxCPM 不是 one-step whole-audio generator，但它提供一條 **patch-wise local generation** route：

```text
semantic-prosodic skeleton
  -> residual acoustic details
  -> local DiT patch decoder
```

對 one-step / few-step audio generator 的啟發是：不要讓單一 continuous model 同時負責 global planning 和 local rendering。可以把 representation 拆成：

- stable semantic/prosodic skeleton；
- residual acoustic detail；
- local patch decoder。

### 對 project-full-duplex-data

VoxCPM 目前是 single-channel TTS / voice cloning，不是 full-duplex dialogue synthesis。但它對未來 full-duplex generator 有幾個啟發：

- full-duplex dual-channel generator 也需要把 semantic turn plan 和 local acoustic details 拆開；
- speaker A/B 的 stable skeleton 可以和 overlap / backchannel event plan 對齊；
- RALM-style residual branch 可負責 speaker timbre、micro-prosody、overlap leakage details；
- causal AudioVAE 和 patch-wise generation 有助於 low-latency streaming。

### 對 project-audio-model-evaluation

VoxCPM 的 benchmarks 主要是 WER/CER、SIM、DNSMOS、MOS。對我們的 grounded rubric evaluation，可以補更細：

- text context 是否導致正確 prosody？
- voice cloning 是否犧牲 emotional naturalness？
- hard sentences 的 error 出現在哪些 phoneme / word spans？
- CFG 過強時失敗集中在哪些 acoustic spans？

## Related papers in my pool

- [[arxiv_2505_13181|SLED]]：continuous latent speech LM；VoxCPM 指出 pure continuous route 會 task entanglement，並用 FSQ+RALM 解。
- [[arxiv_2601_03170|TED-TTS]]：segment-level controllable TTS；VoxCPM 提供 context-aware prosody / voice cloning backbone，但 fine-grained controllability 仍不足。
- [[arxiv_2406_02430|Seed-TTS]]：VoxCPM evaluation 使用 SEED-TTS-EVAL，也引用 Seed-TTS 作為高品質 TTS reference。
- [[arxiv_2604_28190|Representation Fréchet Loss]]：VoxCPM 的 semi-discrete bottleneck 也可放進 representation suitability / distribution matching 這條線。
- [[arxiv_2603_05630|Making Reconstruction FID Predictive of Diffusion Generation FID]]：同樣提醒 latent representation 不應只看 reconstruction，要看 downstream generation stability。
- [VoxCPM tool note](../../tools/openbmb-voxcpm/)：早先加入的 repo/tool note；本頁是 technical report paper note。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀

**應該細讀。**

這篇和我們的 TTS / full-duplex / one-step audio 都有交集。最值得讀的是：

- FSQ bottleneck 為什麼不是 external tokenizer，而是 internal regularizer；
- RALM 如何補 residual acoustic details；
- LocDiT local patch decoder 和 CFG trade-off；
- 1.8M hours data pipeline；
- FSQ dimension / RALM ablations。

它也很適合拿來和 SLED 對讀：兩篇都想避開傳統 RVQ discrete hierarchy，但 SLED 偏 continuous distribution objective，VoxCPM 偏 semi-discrete bottleneck + residual hierarchy。

## 可能的弱點 / open questions

1. **1.8M hours internal data 不可複製**  
   VoxCPM-Emilia 提供 public data variant，但主模型最強結果依賴巨大 internal corpus。

2. **16kHz 限制**  
   AudioVAE 目前只支援 16kHz，對高保真商用場景可能不足。

3. **fine-grained controllability 不足**  
   作者明確承認 emotion / prosody 等 speech attributes 還缺 intuitive user guidance 和 precise adjustment。

4. **不是 full-duplex / multi-speaker dialogue generator**  
   它是 zero-shot TTS / voice cloning。要處理 overlap、backchannel、turn-taking，需要額外 control representation 和 training data。

5. **BPE raw text vs phoneme 的 trade-off**  
   作者主張 BPE + LLM text understanding 有優勢，但 pronunciation control / out-of-vocabulary / multilingual phonology 仍可能是問題。

6. **CFG 非常敏感**  
   scale 太低或太高都會崩，代表 LocDiT 對 conditioning strength 很敏感，需要更穩的 inference control。

## Tags

- `tts`
- `zero-shot-tts`
- `tokenizer-free`
- `voice-cloning`
- `speech-llm`
- `continuous-latent`
- `project-tts-data-pipeline`
- `project-one-step-audio-generation`
- `project-full-duplex-data`

## Concepts

- `VoxCPM`
- `tokenizer-free TTS`
- `Finite Scalar Quantization`
- `semi-discrete bottleneck`
- `Text-Semantic Language Model`
- `Residual Acoustic Language Model`
- `Local Diffusion Transformer`
- `causal AudioVAE`
- `context-aware prosody`
- `zero-shot voice cloning`

## Citation

```bibtex
@misc{voxcpm2025,
  title={VoxCPM: Tokenizer-Free TTS for Context-Aware Speech Generation and True-to-Life Voice Cloning},
  author={{VoxCPM Team}},
  year={2025},
  eprint={2509.24650},
  archivePrefix={arXiv},
  doi={10.48550/arXiv.2509.24650}
}
```
