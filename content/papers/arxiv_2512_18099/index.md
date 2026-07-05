---
paper_key: arxiv_2512_18099
canonical_id: "arxiv:2512.18099"
title: "SAM Audio: Segment Anything in Audio"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2512.18099"
pdf_url: "https://arxiv.org/pdf/2512.18099"
status: read
rating: 9
tags:
  - audio-source-separation
  - promptable-audio-separation
  - flow-matching
  - audio-benchmark
  - audio-judge
  - multimodal-audio
  - project-audio-model-evaluation
  - project-tts-data-pipeline
  - project-full-duplex-data
created: 2026-07-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`paper.tex` and included section files). This is a Meta paper on general promptable audio source separation, with direct relevance to audio model evaluation, TTS data cleaning, and mono-dialogue to dual-channel recovery.

## Links

- [Original URL](https://arxiv.org/abs/2512.18099)
- [arXiv abstract](https://arxiv.org/abs/2512.18099)
- [PDF](https://arxiv.org/pdf/2512.18099)
- [arXiv source](https://arxiv.org/src/2512.18099)
- [Demo](https://aidemos.meta.com/segment-anything/editor/segment-audio)
- [Official GitHub repo](https://github.com/facebookresearch/sam-audio)
- [Website](https://ai.meta.com/samaudio/)

## 一句話總結

SAM Audio 是一個 general-purpose promptable audio source separation foundation model：同一個模型支援 text prompt、visual prompt 和 temporal span prompt，能從 speech、music、general sound mixture 中抽出 target source；作者也提出 SAMAUDIOBENCH 和 SAM Audio Judge (SAJ)，用來做 real in-the-wild multimodal separation evaluation。

## 這篇在解決什麼問題

現有 source separation 系統通常有三個限制：

- Domain-specific：speech separation、music stem separation、general sound extraction 常常是不同模型。
- Prompting limited：很多方法只支援 fixed class、text prompt、visual query 或 target speaker enrollment 其中一種。
- Evaluation 不夠貼近 real-world：常見 benchmark 依賴 synthetic mixtures 或 clean references，但真實影片/音訊裡 target source 可能 off-screen、overlap、被背景遮蔽，也很難取得乾淨 reference。

SAM Audio 想把問題改成「segment anything in audio」：給定 mixture audio，再用 language、visual mask 或 temporal interval 指定 target sound，模型輸出 target stem 和 residual stem。這對 research pipeline 很有價值，因為它同時提供 separation model、benchmark、reference-free judge 和 pseudo-label data engine。

## 核心方法

### 1. 三種 prompt modality

SAM Audio 支援三種 prompt，可以單獨使用，也可以 joint prompting：

- Text prompt：free-form noun phrase / verb phrase，例如 `woman speaking`、`dog barking`、`piano`。
- Visual prompt：由 SAM 2 / SAM3-style mask 或 positive/negative clicks 指定畫面中的 object / speaker / instrument，模型使用 masked visual frames 作為 conditioning。
- Temporal span prompt：用 `<sil>` / `+` token 表示 target source 在哪些 frame active；缺失 prompt 則用 `<null>`。

實驗裡最穩的是 text+span。Span prompt 對 short localized sound 很有用，但 span-only 對 long continuous speech/music 容易失敗，因為時間區間本身不足以描述 source identity。

### 2. Generative separation, not mask regression

模型不是直接估 spectrogram mask，而是把 target 和 residual 一起生成：

- Mixture audio 先經 DAC-VAE encoder，得到 25 Hz latent。
- Target stem 和 residual stem 也經 DAC-VAE，兩者 latent concatenation 成 `T x 2C` 作為 generation target。
- Backbone 是 DiT-style flow matching model。
- Text 用 pretrained T5-base encoder，透過 cross-attention 進 DiT。
- Visual 使用 Perception Encoder (PE) frame-level features，resample 到 audio rate 後和 audio latent concatenation。
- Span prompt 用 frame-synchronous token embedding concatenation。

這個設計的關鍵是 target/residual joint modeling。模型不是只抽 target，而是同時要解釋 mixture 中剩下的 residual，減少「target 好像抽出來了，但 mixture consistency 變差」的問題。

### 3. DAC-VAE latent

作者使用 modified DAC-VAE：

- 25 Hz latent rate。
- Channel dimension `C=128`。
- 移除 RVQ，改成 VAE bottleneck。
- 目標是得到 smoother Gaussian latent，讓 flow matching / DiT 更容易生成。

這點和我們的 Generative Speech Representation Evaluation project 有直接關係：audio codec / VAE 不只是 reconstruction tool，而會影響 downstream generative separation 是否好學、是否能穩定生成 target/residual。

### 4. Auxiliary AED representation alignment

Pretraining 時除了 flow matching loss，還加 auxiliary audio event detection (AED) representation alignment loss：

- AED model 來自 PANNs-style audio event classifier。
- 透過 3-layer MLP projection 對齊 target audio representation。
- Alignment loss 在 pretraining 開啟，fine-tuning 關閉。

作者報告這個 auxiliary loss 對 general SFX text alignment 幫助很大，對 visual prompting 也有幫助。直覺是 general sound 沒有 speech/music 那麼強的 domain prior，需要額外 event-level semantic supervision。

### 5. Longform multi-diffusion

長音訊使用 multi-diffusion：

- 把 long audio 切成 overlapping windows。
- 每個 window 生成 target/residual。
- 用 triangular soft masks 做 overlap merge。
- Longform eval 使用 20s window / 5s overlap。

這比 naive chunk-wise generation 更能減少 chunk boundary artifacts。

## Training / Data

訓練資料被整理成 `(x_mix, x_tgt, x_res, c)`，也就是 mixture、target stem、residual stem 和 prompt condition。

### Fully-real triplets

作者使用真實 multi-track / clean-stem 資料：

- Music：internal multi-track music，10,610 compositions / 536 hours；每個 instrument 形成一組 target/residual，target SNR 隨機偏移約 `+/-5 dB`。
- Speech：conversational speech corpus，21,910 hours；兩個 clean speaker stems 可形成兩組 target/residual；residual speaker SNR offset 約 `+/-15 dB`。

這類資料最乾淨，但 domain coverage 有限。

### Synthetic mixtures

為了擴大 coverage，作者合成 noisy music、noisy speech 和 general sound mixtures：

- Clean music + non-music general sound，約 20K hours，SNR 約 `+/-15 dB`。
- Two-speaker stems + non-speech noise。
- In-the-wild sound clips 和 professional sound clips 混合。

### Pseudo-labeled stems

這篇很重要的一點是把 intermediate SAM Audio checkpoint 當 data engine：

- 用 PLM-Audio 對 1M-hour in-the-wild audiovisual data 產生 captions。
- 每個 caption 變成 separation prompt。
- 用 SAM Audio checkpoint 產生 pseudo target/residual stems。
- 再用 CLAP、aesthetic score、silence ratio、ImageBind 等 filter 清掉壞 pseudo labels。

主要 filtering rules：

- `CLAP(text, target audio) > 0.35`
- `CLAP(text, residual audio) < 0.0`
- Audiobox-aesthetic PC target `< 2.5`
- target silence ratio `< 95%`
- Visual pseudo-label 還要求 mask coverage `> 0.02`
- `ImageBind(target audio, masked region) > 0.2`

最後得到 PL-Audio 約 O(1)M samples / O(1)K hours，PL-Video 約 O(0.1)M samples / O(0.1)K hours。

### Prompt generation

Text prompts 被刻意做成 concise NP/VP，而不是完整句子。作者用 PLM-Audio captioning model、metadata merge、LLM extraction、CLAP filtering 產生 prompt；speech domain 用 gender classifier 產生 `woman speaking` 這類 prompt；music domain 用 instrument label templates。

Span prompts 用 VAD/energy-based activity detection 產生，silence threshold 約 `-40 dBFS`，minimum sounding duration 250 ms。

## Benchmark / Evaluation

### SAMAUDIOBENCH

作者提出 real in-the-wild multimodal separation benchmark，來源包含 AudioSet、VGGSound、MUSIC、MUSIC-AVQA、AVSpeech、CondensedMovies。

每個 10s test item 可包含：

- Human-labeled visual SAM masklets。
- Temporal positive/negative spans。
- Language text descriptions。

Tasks 包含 speech cleaning、speaker separation、music cleaning/removal、instrument stems、general sounds。這個 benchmark 的價值是：同一個 target 可以用 text/visual/span 不同方式指定，能測模型是否真的 promptable，而不是只會固定類別分離。

### SAM Audio Judge (SAJ)

SAJ 是 reference-free evaluator。它輸入 input audio、output audio 和 text prompt，預測 human perceptual ratings。

Human annotation 有九個 perceptual dimensions：

- Performance：Recall、Precision、Faithfulness、Overall quality。
- Difficulty：Counting、Overlapping、Loudness、Confusion、Overall difficulty。

每個 sample 有三個 independent ratings，並做 loudness normalization。

SAJ data scale：

- Training：Speech 59.31 hrs / 13,149 samples；Music 133.64 hrs / 26,101 samples；Sound 117.52 hrs / 37,444 samples。
- Test：Speech 6.38 hrs / 2,311 samples；Music 9.32 hrs / 3,367 samples；Sound 31.72 hrs / 11,476 samples。

SAJ correlation with human overall rating 很強：

- PCC overall：speech 0.883、music 0.815、sound 0.815。
- SRCC overall：speech 0.817、music 0.714、sound 0.781。

Baselines 明顯較弱，例如 Gemini-2.5-pro overall PCC 約 speech 0.487、music 0.351、sound 0.462；CLAP 和 SDR estimator 也不夠穩。

對我們來說，SAJ 很值得當 AnyAudio-Judge / ELSA / MMAE 的 separation-specific comparator：AnyAudio-Judge 比較像 dynamic rubric yes/no，SAJ 則直接學 human perceptual score，且維度中包含 Overlapping、Counting、Confusion 這些對 full-duplex 很重要的因素。

## 主要結果

### Text-prompted separation

SAM Audio 在 general sound、speech、speaker、music、instrument extraction 都強於 prior general-purpose 或 specialized systems。

代表性分數：

- General SFX：SAJ 4.35、CLAP 0.31、OVR 3.59。
- Speech：SAJ 4.67、CLAP 0.35、OVR 4.29。
- Speaker：SAJ 4.51、CLAP 0.18、OVR 4.15。
- Music：SAJ 4.45、CLAP 0.26、OVR 4.05。
- Professional instrument：SAJ 4.82、CLAP 0.28、OVR 4.45。

作者報告 general sound 相對 SoloAudio 有約 36% net win rate；speaker separation 相對 AudioShake improvement 約 39%；professional instrument domain 相對 AudioShake 則是小幅提升。

### Visual prompting

SAM Audio visual prompting 優於 DAVIS 類 baseline，net win rate 約 5% 到 48%。但整體 visual prompt 表現低於 text prompt，原因可能是 visual supervision noisy、off-screen sound、同類 object ambiguity。

Visual prompt 的強項是 disambiguation：例如同一畫面有多個 speaker 或 similar instruments 時，text prompt 只能說 `man speaking`，visual mask 可以指出哪一個人。

### Span prompting

Text+span 幾乎全 domain 改善，net win rate 約 +12.9% 到 +39.0%。

Span-only 則很不穩：

- 對 short/localized sound 有幫助。
- 對 speech/music/instrument 這類 long continuous source 反而退步，因為時間段不等於 source identity。

這對我們很重要：如果要用 span-grounded evaluator 或 FlashTrace-style audio token attribution，span evidence 必須搭配 source description / speaker identity，不能只給時間段。

### Longform / latency

Longform 1-minute eval：

- One-shot：SAJ 3.48、CLAP 0.26。
- Chunk-wise：SAJ 3.57、CLAP 0.24。
- Multi-diffusion：SAJ 3.67、CLAP 0.27。

Inference 使用 16-step midpoint ODE solver、no CFG。10s input 在 single A100 約 7.3s，其中 model forward 約 6.5s，judge reranking 約 0.5s。對 production data cleaning 來說，品質有吸引力，但成本不低。

### Ablations

- Scale：3B overall strongest，specialized domains gain 最大。
- AED auxiliary alignment：general SFX pretraining 特別有幫助，text alignment relative gain 超過 20%，visual 約 5%。
- Fine-tuning：對 instrument extraction、speech extraction、speaker separation 最有幫助，也提升 cleanness。
- Pseudo-labeled data：改善 text 和 visual prompting，general sound gains 最大。

## Project relevance

### project-audio-model-evaluation

高相關。這篇的 SAMAUDIOBENCH + SAJ 是 audio separation evaluation 的完整參考：

- 不只看 reference SDR，而是評估 recall、precision、faithfulness、overall。
- 明確標 difficulty axes：counting、overlapping、loudness、confusion。
- 評估 speech/music/sound 三類，而不是單一 domain。
- 提供 text/visual/span multimodal prompt setting。

可以和 AnyAudio-Judge、ELSA、MMAE、FlashTrace 結合：

- AnyAudio-Judge：產生 rubrics / yes-no questions。
- SAJ：提供 human-correlated scalar / dimension scores。
- FlashTrace：把 SAJ 或 AnyAudio-Judge 的 failure decision grounded 到 audio token spans。
- ELSA/MMAE：補 event-level 或 edit-specific correctness。

### project-tts-data-pipeline

高相關但要小心成本。SAM Audio 可以作為 TTS data cleaning upstream：

- De-overlap：抽 target speaker，降低 overlap contamination。
- Music/background removal：清掉 audiobook/podcast/web audio 裡的 BGM 或 SFX。
- Text+span extraction：只抽指定 speaker/event 的 active region。
- SAJ QA：檢查 extraction 後 target 是否完整、residual 是否乾淨、是否 hallucinate。

限制是它是 large generative model，latency/cost 高；如果只是大規模 first-pass cleaning，可能要用 cheaper OSD/separation model 篩選後再用 SAM Audio 處理 high-value segments。

### project-full-duplex-data

高相關。對「mono-channel dialogue -> dual-channel data」來說，SAM Audio 可以作為 external baseline 或 data engine：

- Text prompt 可抽 `woman speaking` / `man speaking` / `speaker laughing` 等 source。
- Visual prompt 若有 video，可用 face/body mask 指定 speaker。
- Span prompt 可指定 overlap/backchannel active intervals。
- Target/residual joint modeling 和 mixture consistency supervision 對 full-duplex recovery 很有參考價值。

但它不是 dialogue-specific diarization system。真正要產生 dual-channel conversation training data，仍需要 speaker tracking、ASR transcript alignment、turn-taking/backchannel labels，以及人工 gold set audit。

### Generative Speech Representation Evaluation

DAC-VAE 的選擇也值得追。SAM Audio 使用 smooth Gaussian DAC-VAE latent 來做 flow matching；這支持我們的假設：codec/VAE 的 latent geometry 會影響 downstream generative learnability。未來可把 SAM Audio-style separation 作為 downstream task，測不同 codec/VAE/encoder 的 convergence speed、target recall、speaker leakage、residual consistency。

## Related papers in my pool

- [AnyAudio-Judge](../arxiv_2606_03116/)：dynamic rubric evaluator；SAJ 可作 separation-specific human-correlated judge reference。
- [ELSA](../arxiv_2606_17404/)：event-level reference-free TTA evaluation；可補 SAJ 的 event decomposition。
- [MMAE](../arxiv_2606_07229/)：audio editing benchmark；可補 extraction/edit consistency。
- [FlashTrace](../arxiv_2602_01914/)：可把 judge decision grounding 到 audio/text token spans。
- [DialogueSidon](../arxiv_2604_09344/)：mono dialogue to full-duplex track recovery；SAM Audio 可作更 general 的 promptable separation baseline。
- [Sommelier](../arxiv_2603_25750/)：full-duplex preprocessing pipeline；SAM Audio 可補更強的 promptable extraction / cleaning 模組。
- [Making Reconstruction FID Predictive of Diffusion Generation FID](../arxiv_2603_05630/)：提醒 codec/VAE reconstruction quality 不等於 downstream generation quality；SAM Audio 可作 audio-side downstream task。

## OpenReview / reviewer discussion

未取得可用 OpenReview review/rebuttal。工具曾找到疑似 forum，但 OpenReview API 回傳 403，因此目前只以 arXiv source 和 paper 內容記錄。

## 我該不該細讀

建議細讀，尤其如果要做 audio evaluation / TTS data cleaning / full-duplex data recovery。

最值得讀：

- `method.tex`：target/residual joint flow matching、DAC-VAE latent、prompt conditioning。
- `data.tex`：fully-real / synthetic / pseudo-labeled stems 的 construction 和 filtering。
- `evaluation.tex`：SAMAUDIOBENCH 和 SAJ annotation dimensions。
- `results.tex`：text/visual/span prompt 的 tradeoff，特別是 text+span 優勢與 span-only 限制。

## 可能的弱點 / open questions

- Visual prompting 仍比 text prompt 弱：可能受 off-screen source、mask ambiguity、visual supervision noise 影響。
- General sound 比 speech/music 更難：open-world sound event 的 prompt ambiguity 和 source boundaries 都更複雜。
- Reference-free judge 仍可能被 model artifacts hack：SAJ correlation 高，但如果拿來做 reward loop，仍要做 reward hacking stress test。
- Latency/cost 不低：10s audio on A100 約 7.3s；大規模 TTS cleaning 需要 cascade / triage。
- Span prompt 不能單獨代表 source identity：對 speech/music 需要 text/speaker/visual identity conditioning。
- 對 full-duplex dialogue，仍缺 speaker tracking + turn alignment：source separation 只是 pipeline 一段，不是完整 data construction。

## Tags

audio-source-separation, promptable-audio-separation, flow-matching, audio-benchmark, audio-judge, multimodal-audio, project-audio-model-evaluation, project-tts-data-pipeline, project-full-duplex-data

## Concepts

SAM Audio, SAMAUDIOBENCH, SAM Audio Judge, promptable audio separation, text prompt, visual prompt, temporal span prompt, target residual joint modeling, DAC-VAE, flow matching, DiT, PE-A-Frame, PLM-Audio, pseudo-labeled stems, reference-free evaluation, recall precision faithfulness, overlap difficulty, multi-diffusion longform separation

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{shi2025samaudiosegmentanythinginaudio,
  title={SAM Audio: Segment Anything in Audio},
  author={Bowen Shi and Andros Tjandra and John Hoffman and Helin Wang and Yi-Chiao Wu and Luya Gao and Julius Richter and Matt Le and Apoorv Vyas and Sanyuan Chen and Christoph Feichtenhofer and Piotr Dollár and Wei-Ning Hsu and Ann Lee},
  year={2025},
  eprint={2512.18099},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2512.18099}
}
```
