---
paper_key: arxiv_2605_30965
canonical_id: "arxiv:2605.30965"
title: "ImmersiveTTS: Environment-Aware Text-to-Speech with Multimodal Diffusion Transformer and Domain-Specific Representation Alignment"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.30965"
pdf_url: "https://arxiv.org/pdf/2605.30965"
status: read
rating: 4
tags:
  - speech-llm
  - tts
  - asr
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.30965)
- [PDF](https://arxiv.org/pdf/2605.30965)

## 一句話總結
ImmersiveTTS 用 `MM-DiT` + `flow matching` + domain-specific `representation alignment`，把 `text-to-speech` 和 `environmental audio` 的 joint generation 做得更自然、語意更一致、也更像真實 scene-aware speech。

## 這篇在解決什麼問題
這篇在解決 **environment-aware TTS** 的核心難題：如何讓模型同時生成「可懂的 speech」與「符合文字描述的環境音景」，而不是把兩者各自生成後再生硬混音。

作者認為現有方法的主要瓶頸是：
- `speech` 和 `environmental audio` 的 acoustic patterns / temporal dynamics 差異很大
- 傳統 pipeline 往往把兩種模態分開處理，缺乏真正的 `cross-modal interaction`
- 只靠 generative objective，模型很容易學到 speech-environment mismatch
- 對 `linguistic fidelity`、`speaker identity`、`environment coherence` 同時兼顧仍然困難

簡單說，這篇想做的是：**讓 TTS 不只是清楚地念出來，而是像真的存在於某個聲景中。**

## 核心方法
核心是一個以 `MM-DiT` 為 backbone 的 multimodal diffusion / flow-based TTS 架構，外加一個專門為 environment-aware TTS 設計的 alignment loss。

### 1) Dual-stream `MM-DiT`
模型把兩種條件分成兩個 stream：
- **speech stream**：處理 noisy audio latent，並由 transcript-aligned content feature condition
- **environment stream**：處理 environment prompt 的 textual tokens

兩個 stream 在 `double-stream DiT` 階段透過 `joint attention` 交換資訊，之後只保留 speech stream 進入 `single-stream` blocks 精煉輸出。

### 2) Dual-granularity environment conditioning
環境描述不是只用一種 embedding，而是同時用：
- `CLAP` global embedding：提供 coarse scene conditioning，透過 `AdaLN`
- `Flan-T5` token-level embeddings：提供 fine-grained environment semantics

這樣做的目標是同時抓到 scene 的全局語意與細節。

### 3) Speaker / content conditioning
為了保住說話者身分，作者還用 `WavLM-based speaker verification model` 抽 speaker embedding 當額外 conditioning。

### 4) Domain-specific `REPA`
這是本文的關鍵貢獻之一。
作者不是只對一個 teacher 做 representation alignment，而是使用不同 `SSL teacher` 分別對齊不同目標：
- `WavLM-Large`：偏 speech / linguistic fidelity
- `ATST-Frame-Base`：偏 acoustic scene / environment
- `USAD-Base`：作為補充的 audio representation

重點是：**speech 和 environment 不共用同一個 alignment target，而是各自對齊最適合的 domain-specific teacher**，用來穩定訓練、減少 domain mismatch。

### 5) `flow matching`
生成目標採用 `flow matching` / `rectified flow`，在 latent space 中學習從 Gaussian prior 到 data distribution 的 mapping，搭配 diffusion-style sampling 產生 audio latent，再用 vocoder 還原 waveform。

## Training / Data
### Training objective
整體訓練結合：
- `Flow matching` generative loss
- `domain-specific REPA` alignment loss

### Conditioning
- content prompt = transcript
- environment prompt = background description
- speaker prompt = reference speaker embedding

### 主要使用的 frozen components
- `AudioLDM2` 的 pretrained VAE 做 audio compression
- `HiFi-GAN` 做 waveform reconstruction
- `WavLM-Large`、`ATST-Frame-Base`、`USAD-Base` 作為 alignment teacher

### Data / evaluation setup
從 excerpts 看，作者在：
- `real and augmented environment-aware TTS benchmarks`
- `AudioCaps test`
- `Seed-TTS test-en`
上做評估。

另外，`limitations` 也明講：訓練主要依賴 **synthetic mixtures of speech and environmental audio**，也就是不是完全靠大規模真實野外錄音。

## 主要結果
作者報告的結論是：`ImmersiveTTS` 在 objective metrics 和 human listening tests 都優於既有方法。

### 主要提升面向
- `speech naturalness`
- `intelligibility`
- `audio fidelity`
- `speech-environment coherence`
- `speaker similarity`

### 從 excerpt 可確認的趨勢
- `dual-teacher` 的 alignment 明顯比 single teacher 更好
- 同時用 `WavLM + ATST` 的組合通常表現最佳
- 在 `MM-DiT` 中間層注入 alignment 比太前或太後更穩定
- `domain-specific REPA` 對訓練穩定性與 semantic fidelity 有幫助

### 與 baselines 的相對觀察
- 相比 `VoiceLDM` / `VoiceDiT`，作者的方法在 `WER`、`SECS`、`FAD`、`CLAP` 等指標上有競爭力，且聽感更自然
- 在 speaker similarity 上，`ImmersiveTTS` 大致能維持與強 baseline 接近的水準

## Project relevance
- **project-tts-data-pipeline**：高度相關
- **project-full-duplex-data**：不直接相關

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀。**

如果你關心的是：
- `environment-aware TTS`
- `multimodal diffusion / flow matching`
- `cross-modal alignment`
- 如何把 `speech` 和 `background audio` 一起生成

這篇很值得看，因為它不只是換 backbone，而是明確處理了 **speech vs. environment 的 representation mismatch**，而且方法設計有清楚的 modular 分解。

如果你只關心傳統單人 TTS 或純 clean speech synthesis，則這篇可先略過。

## 可能的弱點 / open questions
- 訓練主要依賴 **synthetic mixtures**，對真實野外錄音的泛化仍可能有限
- 對不同 `SNR`、不同 scene difficulty 的 robustness 還沒有完全展開
- 目前沒有明確控制 `prosody`、`emotion`、`speaking style` 等 paralinguistic factors
- `environment prompt` 的語意品質可能高度依賴文字描述本身，對 prompt engineering 可能敏感
- `flow matching` + `MM-DiT` + 多 teacher alignment 組合較複雜，實作與推論成本可能不低
- 對「背景音景與 speech 的物理一致性」是否真能達到可驗證的 realism，仍可再深入檢查

## Tags
`TTS`, `environment-aware TTS`, `multimodal generation`, `MM-DiT`, `flow matching`, `representation alignment`, `audio generation`, `speaker conditioning`, `scene-aware speech`

## Concepts
- `environment-aware TTS`
- `text-guided audio generation`
- `cross-modal interaction`
- `dual-stream transformer`
- `joint attention`
- `AdaLN`
- `CLAP`
- `Flan-T5`
- `WavLM`
- `ATST-Frame`
- `USAD`
- `representation alignment (REPA)`
- `flow matching`
- `rectified flow`
- `audio latent`
- `speaker embedding`
- `semantic consistency`
- `speech-environment coherence`

## Citation
```bibtex
@article{yun2026immersivettsenvironmentawarete,
  title={ImmersiveTTS: Environment-Aware Text-to-Speech with Multimodal Diffusion Transformer and Domain-Specific Representation Alignment},
  author={Yun, Jun-Hak and Kim, Seung-Bin and Lee, Seong-Whan},
  year={2026},
  journal={arXiv preprint}
}
```
