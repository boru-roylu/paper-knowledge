---
paper_key: arxiv_2605_19833
canonical_id: "arxiv:2605.19833"
title: "Mega-ASR: Towards In-the-wild^2 Speech Recognition via Scaling up Real-world Acoustic Simulation"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.19833"
pdf_url: "https://arxiv.org/pdf/2605.19833"
status: read
rating: 4
tags:
  - speech-llm
  - asr
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.19833)
- [PDF](https://arxiv.org/pdf/2605.19833)
- [Project page](https://xzf-thu.github.io/Mega-ASR/)
- [Official GitHub](https://github.com/xzf-thu/Mega-ASR)
- [Model weights](https://huggingface.co/zhifeixie/Mega-ASR)
- [Data: Voices-in-the-Wild-2M](https://huggingface.co/datasets/zhifeixie/Voices-in-the-Wild-2M)
- [Benchmark: Voices-in-the-Wild-Bench](https://github.com/xzf-thu/Voices-in-the-Wild-Bench)

## 一句話總結
Mega-ASR 透過大規模 real-world acoustic simulation、Acoustic-to-Semantic progressive training，以及 WER-gated RL，讓 ASR 在 severe compositional distortions 下更能保住 acoustic grounding，減少 omissions 與 hallucinations。

## 這篇在解決什麼問題
這篇在解決 **robust ASR 在真實世界複合聲學失真下的脆弱性**。作者認為現有 ASR / large audio-language models 雖然在 clean benchmark 很強，但一遇到真實環境中的多重失真，就會出現：

- acoustic grounding 失敗
- omission
- hallucination
- semantic drift
- 對單一 degradation 以外的複合情境泛化差

核心問題不是單純「加噪音後準確率掉一點」，而是 **錯誤型態會從 word-level error 進化成 sentence-level semantic failure**。  
因此作者想做的是一個能在 in-the-wild、而且是 **in-the-wild²** 的條件下仍然穩定工作的 unified ASR framework。

## 核心方法
Mega-ASR 的方法可拆成三個部分：

### 1) Voices-in-the-Wild-2M：大規模 compound acoustic simulation dataset
作者先建一個大規模合成資料集 **Voices-in-the-Wild-2M**，用 spectrogram-level / signal-level simulation 模擬真實世界的 acoustic degradation。

資料涵蓋：
- 8 個 primitive acoustic effects：`additive noise`、`echo delay`、`reverberation`、`nonlinear distortion`、`resampling`、`spectral filtering`、`loudness transformation`、`frame-level stutter`
- 7 個 atomic acoustic effects：`noise`、`far-field`、`obstructed`、`echo&reverb`、`recording coloration`、`electronic distortion`、`transmission dropout`
- 54 個 physically plausible compound scenarios

這個設計的重點是：
- 不是只做單一 degradation
- 而是把多個 effects 組合成現實可發生的 scenario
- 用 anchor/modifier decomposition 避免不合理組合：`far-field`、`echo&reverb`、`obstructed` 是 scene-defining anchor；`recording coloration`、`electronic distortion`、`noise`、`transmission dropout` 是 portable modifier
- 使用 global severity variable `m` 控制同一樣本內所有 primitive effect 的難度，避免「某個 effect 很嚴重、其他 effect 幾乎 clean」的不一致合成
- 會控制 difficulty distribution，並過濾 WER > 70% 的過難樣本，以維持 training stability

### 2) Acoustic-to-Semantic Progressive Supervised Fine-Tuning (A2S-SFT)
第二部分是分階段 supervised fine-tuning，重點在 **從 acoustic recovery 漸進過渡到 semantic recovery**。

作者的觀察是：
- 中高 WER 時，模型需要先學會從 noisy acoustic signal 中抓回可辨識的語音片段
- 更難的條件下，單靠 acoustic-level 修補不夠，必須學會 semantic reconstruction

因此 A2S-SFT 是一種 progressive curriculum：
- 先建立基礎 acoustic capability
- 再逐步提升到 semantic robustness

### 3) Dual-Granularity WER-Gated Policy Optimization (DG-WGPO)
第三部分是 RL / policy optimization。  
作者指出當 WER 很高時，單純用 WER reward 不夠，因為這時 failure mode 已經不是局部 substitution，而是：

- hallucinated guesses
- dropped sentences
- severe semantic corruption

所以他們做了 **dual-granularity reward**：
- `token-level refinement reward`：幫助局部資訊恢復
- `sentence-level reconstruction reward`：幫助整句語意保留

再用 **WER-gated mirrored fusion strategy** 動態決定兩者權重。  
換句話說，低/中難度和高難度樣本走不同 reward focus。

### 4) Environment-aware routing for inference
文中還提到 **environment-aware routing**，可做 plug-and-play inference，並在 backbone 上切換不同 adaptation 模組 / LoRA deltas，兼顧 robustness 與 backbone preservation。

## Training / Data
### 資料
- **Voices-in-the-Wild-2M**：約 2.4M synthesized clips
- 來源包含多種 clean speech 與 noise corpora
  - LibriSpeech
  - Common Voice
  - WenetSpeech
  - AISHELL-1
  - MUSAN
  - DNS Challenge
  - ESC-50
  - UrbanSound8K

### 資料設計
- 7 個 atomic acoustic effects，由 8 個 primitive acoustic effects 組合而來
- 54 個 compound scenarios，透過 anchor/modifier enumeration 組成：
  - 7 個 single-effect scenarios
  - 18 個 two-effect scenarios
  - 13 個 three-effect scenarios
  - 16 個 higher-order scenarios
- 以 controlled severity sampling 來校準難度分布
- 過濾太極端樣本（WER > 70%）
- **Voices-in-the-Wild-Bench**：5,000 clips，包含 3,500 synthetic clips 與 1,500 real-world recordings；real-world recordings 來自 internet sources 與 16 位 human participants，覆蓋同樣 7 類 atomic phenomena

### 訓練
- 先做 **A2S-SFT**
- 再做 **DG-WGPO**
- backbone 文中以 **Qwen3-ASR-1.7B** 作為重要基底
- 另有 router / LoRA delta switching 的實作來做 inference routing

更細的訓練 recipe：

- **A2S-SFT Phase I**：只更新 acoustic encoder + speech-to-LLM aligner，用 WER-graded curriculum，資料從 `WER < 30%` 擴到 `WER < 50%`，最後到 `WER < 70%`。
- **A2S-SFT Phase II**：凍結 acoustic side，只更新 LLM-side LoRA，讓 LLM 適應 noisy transcription recovery。
- **A2S-SFT Phase III**：encoder、aligner、LLM 一起 LoRA update，做 end-to-end acoustic-semantic alignment。
- **DG-WGPO**：從 A2S-SFT LoRA-merged checkpoint 初始化；每個 prompt sampling 12 個 transcriptions；主要 reward 包含 static WER reward、repetition gate、token-level refinement reward、sentence-level structural recovery reward，並用 WER gate 調整低/高 WER 樣本的 reward granularity。

公開狀態需要分開看：

- 官方 GitHub 已公開 inference / A2S-SFT training code、evaluation script、vLLM / streaming entrypoints。
- Hugging Face 已公開 Mega-ASR weights 與 Voices-in-the-Wild-2M。
- README 仍標示 **DG-WGPO RL code** 與 **完整 data process pipeline** 是 coming / future update，所以這篇對 data construction 描述很細，但目前還不是 PilotTTS 那種「完整 pipeline code 全部可復現」狀態。

## 主要結果
作者報告 Mega-ASR 在多個 robust ASR benchmark 上都有提升：

### 1) 傳統 adverse-condition benchmarks
- **VOiCES R4-B-F**：**45.69% vs. 54.01%**
- **NOIZEUS Sta-0**：**21.49% vs. 29.34%**

這代表相對於 prior SOTA，Mega-ASR 在艱難場景下 WER 顯著下降。

### 2) compositional acoustic scenarios
在複合聲學情境上，Mega-ASR 對強力 open- / closed-source baselines：
- **relative WER reduction > 30%**

### 3) additional benchmark summary
從附錄表格看：
- **CHiME-4**：Mega-ASR 平均 WER **5.23**
- **NOIZEUS**：**7.52**
- **VOiCES**：**7.35**

若加 router：
- CHiME-4 可到 **5.00**
- 但 NOIZEUS / VOiCES 有些 subset 會略變動，顯示 routing 主要是在 robustness 與 backbone preservation 間做 trade-off。

### 4) qualitative error pattern
文中附錄強調 Mega-ASR 對以下 failure mode 有幫助：
- off-audio hallucination
- empty-output collapse
- dropout-induced semantic drift
- noisy semantic drift
- entity-level recovery

## Project relevance
- **project-full-duplex-data**：低
- **project-tts-data-pipeline**：高

## Related papers in my pool
- **Google USM: Scaling Automatic Speech Recognition Beyond 100 Languages**：同樣是 ASR scaling 與 speech-data 取向，但 USM 重點是 multilingual pretraining；Mega-ASR 重點是 **robustness under compositional acoustic distortion** 與 synthetic acoustic simulation。若你在看 speech-data pipeline，兩篇都涉及大規模資料設計，但任務與失真設定不同。
- **Qwen3-ASR Technical Report**：Mega-ASR 是在 Qwen3-ASR-1.7B 上做 data-centric robust ASR adaptation；如果要復現或改造這條線，Qwen3-ASR 是必讀 backbone context。
- 目前 pool 裡沒有其他明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
**建議細讀。**  
如果你關心 robust ASR、acoustic simulation、data pipeline、或「從局部 WER 問題轉向語意級錯誤」這個趨勢，這篇值得看。尤其它同時給了：
- 一個大規模合成資料集設計
- 一個 progressive supervised training recipe
- 一個 WER-gated RL 設計

這三者對做 data-centric ASR 很有參考價值。

## 可能的弱點 / open questions
- **simulation realism**：雖然作者強調 physically plausible，但合成 acoustic scenarios 與真實世界分布是否足夠接近，仍可能有 gap。
- **benchmark dependence**：強調在特定 robust benchmarks 上的提升，泛化到更多未見環境仍需驗證。
- **WER-filtering bias**：過濾掉 WER > 70% 樣本可提升 training stability，但也可能讓模型較少接觸極端失真。
- **routing complexity**：environment-aware routing 與多 LoRA / delta switching 增加系統複雜度，實際部署成本需評估。
- **semantic vs. acoustic trade-off**：方法強調 semantic recovery，但在某些場景可能會有過度修補、或保守輸出的風險。
- **data construction cost**：2M 合成資料可擴展，但校準 simulator、驗證 physical plausibility、調整 difficulty 分布，本身仍有工程成本。
- **release gap**：官方已公開模型、資料、benchmark 與 A2S-SFT/inference code，但 RL code 與完整 data process pipeline 仍未完整公開；若要照著做資料清洗/合成 pipeline，仍需要自行補 simulator 實作細節與 orchestration。

## Tags
- ASR
- robust ASR
- acoustic simulation
- compositional distortion
- speech data
- WER
- supervised fine-tuning
- reinforcement learning
- speech-language model
- benchmark

## Concepts
- **acoustic robustness bottleneck**
- **in-the-wild² speech recognition**
- **compound acoustic scenario**
- **atomic acoustic effect**
- **spectrogram-level simulation**
- **Acoustic-to-Semantic Progressive Supervised Fine-Tuning (A2S-SFT)**
- **Dual-Granularity WER-Gated Policy Optimization (DG-WGPO)**
- **WER-gated mirrored fusion strategy**
- **semantic reconstruction**
- **hallucination / omission in ASR**
- **environment-aware routing**
- **LoRA delta switching**

## Citation
```bibtex
@article{xie2026megaasrtowardsinthewild2speech,
  title={Mega-ASR: Towards In-the-wild$^2$ Speech Recognition via Scaling up Real-world Acoustic Simulation},
  author={Xie, Zhifei and Pang, Kaiyu and Zhang, Haobin and Ye, Deheng and Hu, Xiaobin and Yan, Shuicheng and Miao, Chunyan},
  year={2026},
  journal={arXiv preprint},
  eprint={2605.19833},
  archivePrefix={arXiv}
}
```
