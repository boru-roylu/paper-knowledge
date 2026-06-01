---
paper_key: arxiv_2604_09344
canonical_id: arxiv:2604.09344
title: "DialogueSidon: Recovering Full-Duplex Dialogue Tracks from In-the-Wild Dialogue Audio"
year: 2026
venue: arXiv
url: https://arxiv.org/abs/2604.09344
pdf_url: https://arxiv.org/pdf/2604.09344
source_url: https://arxiv.org/src/2604.09344
status: read
rating: 4
tags:
  - speech-llm
  - speech-data
  - restoration
  - separation
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-30
---

<div class="paper-nav"><a href="../../">&larr; Papers</a></div>




## Links

- [arXiv abstract](https://arxiv.org/abs/2604.09344)
- [PDF](https://arxiv.org/pdf/2604.09344)
- [Code](https://github.com/sarulab-speech/Sidon)
- [Demo](https://hf.co/spaces/sarulab-speech/DialogueSidon-demo)
- [Audio samples](https://hf.co/spaces/Wataru/dsidonsamples)


## 一句話總結

DialogueSidon 想把網路上常見的 degraded monaural two-speaker dialogue audio，轉成比較乾淨的 speaker-wise full-duplex dialogue tracks，核心做法是用 `SSL-VAE` 建立 compact speech latent space，再用 `diffusion-based latent predictor` 從 noisy mixture 預測兩個 speaker 的 latent representations。

## 這篇在解決什麼問題

spoken dialogue model 要學會 overlap、backchannel、turn-taking timing 這些現象，最好有 full-duplex dialogue data，也就是每個 speaker 都有獨立 track。但這種資料很難大規模收集。Internet audio 很多，但通常是 monaural mixture，而且有 background noise、music、reverb、compression、clipping、packet loss 等 degradation。

這篇的問題設定是：給一段 degraded monaural two-speaker dialogue mixture，恢復成兩條 clean speaker-wise waveform。這比一般 speech enhancement 更難，因為要同時做 speech restoration 和 speaker separation，而且 conversational overlap 不能被當成 noise 移除。

## 核心方法

DialogueSidon 延伸作者之前的 Sidon speech restoration model，但加入 speaker-wise recovery。整體分成兩個主要元件：

1. `SSL-VAE`: 使用 frozen `w2v-BERT 2.0` 的 SSL features，把 clean speech 壓縮到 compact latent space。作者使用第 8 層 hidden feature，然後用 trainable encoder/decoder 和 Descript Audio Codec decoder reconstruct waveform。
2. `latent predictor`: 從 degraded mixture 抽取 conditioning representation，預測兩個 speaker 的 clean latents，再交給 SSL-VAE decoder 生成 separated clean waveforms。

latent predictor 不是單純 regression，而是 diffusion model。原因是 deterministic latent regression 會 oversmooth，容易丟失 spoken content 和 overlap speech。模型先用 auxiliary heads 做 coarse speaker-wise latent prediction，並用 `permutation-invariant training` 解 speaker order ambiguity，再用 DiT-style diffusion model 做 latent refinement。

## Training setup

訓練資料來自 Fisher 和 CALLHOME 多語電話對話資料，先用 Sidon restoration 得到 pseudo-clean speaker-wise tracks。然後作者對每個 speaker track 加 degradation，再混成 monaural dialogue mixture。degradation 包含：

- reverberation
- background noise
- band limitation
- clipping
- MP3 codec compression
- packet loss
- weighted two-speaker mixing

最後得到約 8,902 小時 paired clean/degraded dialogue data。模型輸出 24 kHz audio。SSL-VAE 和 latent predictor 各訓練 2 天，使用 8 張 NVIDIA H100。

## 主要結果

在 SWB English telephone dialogue 上，DialogueSidon 的最佳 latent size 是 `D=32`。它的 WER 是 `14.39%`，明顯低於 retrained GENESES 的 `33.54%` 和 Sidon 的 `57.47%`。這表示它更能保留 spoken content。

在人類主觀 MOS 測試中，DialogueSidon 在 SWB 上達到 `3.895 ± 0.948`，高於 GENESES 的 `3.482`、Sidon 的 `3.289`、Noisy 的 `2.815`。

在 multilingual CallFriend 上，DialogueSidon 在 German、French、Japanese、Spanish、Mandarin 都比 GENESES 有更低的 p-CER，也通常有更高的 speaker similarity 和 VAD accuracy。這代表它比較不會為了讓音質指標變好而破壞 linguistic content。

在 in-the-wild OpenDialog 上，DialogueSidon 的 WER 是 `13.86%`，GENESES 是 `43.79%`，GENESES original checkpoint 是 `74.51%`。主觀 MOS 也最高：DialogueSidon `3.708 ± 1.006`，GENESES `3.131 ± 1.060`。

效率也很重要：20 秒 input 在單張 H100 上，DialogueSidon 的 RTF 是 `0.010`，GENESES 是 `0.604`，約 `60.4x` speedup。

## 我覺得最重要的 takeaways

這篇真正有價值的點不是單純「另一個 speech separation model」，而是把 full-duplex dialogue data construction 當成核心目標。對 speech LLM 來說，這很重要，因為 future spoken dialogue model 需要大量自然 overlap、backchannel、turn-taking 的 speaker-wise training data。

另一個重要觀察是：NISQA/DNSMOS 這類 predicted quality metrics 不一定跟內容保留一致。GENESES 常常有較高 NISQA/DNSMOS，但 WER/p-CER 明顯更差。對資料建構來說，content preservation 可能比表面音質更重要。

`D=128` latent size 反而變差，也值得注意。這暗示 compact latent bottleneck 對 diffusion restoration/separation 有 regularization 作用，不是 latent 越大越好。

## Project relevance

- **Project A: Full-duplex data and model**: 高相關。這篇直接處理 mono-channel / monaural two-speaker dialogue 的 speaker-wise recovery，特別是 overlap speech 的 separation/restoration；這正好對應到從自然對話資料建立 dual-channel training data 的需求。
- **Project B: TTS data pipeline**: 中高相關。它的重點雖然不是 TTS，但對 data cleaning、overlap detection/separation、content preservation metric 的選擇很有參考價值，尤其提醒我們不能只看表面音質指標。

短評：這篇應該歸到 `#project-full-duplex-data` 和 `#project-tts-data-pipeline`，其中更核心的是 Project A。

如果目標是做 speech LLM 或 spoken dialogue agent，這篇可以視為 data pipeline paper。它不是直接提出新的 dialogue model，而是讓我們有機會從 Internet monaural dialogue 中恢復 usable full-duplex tracks。

可能的應用方向：

- 建構大量 two-speaker conversational audio corpus
- 為 spoken dialogue model 提供 overlap/backchannel/turn-taking 訓練資料
- 將 monaural podcast/interview/YouTube dialogue 轉成 speaker-wise tracks
- 幫助訓練 full-duplex voice agent 或 speech-to-speech dialogue model

如果我們之後要做 paper agent，這篇應該被歸到 `speech data construction` 和 `spoken dialogue modeling infrastructure`，而不是單純 `speech enhancement`。

## 我該不該細讀

值得細讀，特別是如果你關心 speech LLM 的 data construction。應該優先讀：

- `DialogueSidon` model section
- degradation pipeline appendix
- SWB/OpenDialog results
- latent size ablation

不需要一開始深讀所有 metric details，但要注意它的 training data 是 Sidon-restored telephone corpus，pseudo-clean target 不是完美 clean studio audio。這會影響它能否泛化到更複雜的 web audio。

## 可能的弱點 / open questions

- 目前只處理 two-speaker case，future work 才提到 more speakers。
- pseudo-clean target 來自 Sidon-restored telephone audio，不是真正 clean full-band dialogue。
- 使用 8x H100 訓練，門檻不低。
- 對 very long dialogue 或 more chaotic multi-party audio 的效果還不清楚。
- predicted quality metrics 和 human MOS / WER 之間有 tension，之後使用時要小心評估指標。

## Tags

#speech-llm #speech-data #restoration #separation #project-full-duplex-data #project-tts-data-pipeline

## Concepts

- full-duplex dialogue
- spoken dialogue modeling
- SSL-VAE
- latent diffusion
- w2v-BERT 2.0
- dialogue data construction
- turn-taking
- backchannel
- overlap speech

## Citation Graph

<!-- citation-graph:start -->

No local paper citations matched yet.

<!-- citation-graph:end -->

## Citation
目前我只找到 arXiv preprint，沒有找到正式 conference / journal proceedings 條目。arXiv 頁面沒有列出 Journal reference；如果之後出現在 ACL Anthology、Interspeech、NeurIPS、OpenReview 或其他正式 proceedings，應該把這裡改成正式 venue citation。

```bibtex
@misc{nakata2026dialoguesidon,
  title         = {DialogueSidon: Recovering Full-Duplex Dialogue Tracks from In-the-Wild Dialogue Audio},
  author        = {Nakata, Wataru and Saito, Yuki and Yamauchi, Kazuki and Tsunoo, Emiru and Saruwatari, Hiroshi},
  year          = {2026},
  eprint        = {2604.09344},
  archivePrefix = {arXiv},
  primaryClass  = {cs.SD},
  doi           = {10.48550/arXiv.2604.09344},
  url           = {https://arxiv.org/abs/2604.09344},
  note          = {arXiv preprint}
}
```
