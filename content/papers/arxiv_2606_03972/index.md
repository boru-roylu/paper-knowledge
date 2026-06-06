---
paper_key: arxiv_2606_03972
canonical_id: "arxiv:2606.03972"
title: "AAD-1: Asymmetric Adversarial Distillation for One-Step Autoregressive Video Generation"
year: 2026
venue: "ICML 2026 / arXiv"
url: "https://arxiv.org/abs/2606.03972"
pdf_url: "https://arxiv.org/pdf/2606.03972"
status: read
rating: 7
tags:
  - video-generation
  - diffusion-distillation
  - adversarial-training
  - autoregressive-generation
  - one-step-generation
  - project-one-step-audio-generation
created: 2026-06-06
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex` and `sections/*.tex`) plus the official project page. This is a video generation paper, included because its one-step autoregressive distillation recipe is relevant to future one-step audio generation.

## Links
- [Original URL](https://arxiv.org/abs/2606.03972)
- [arXiv abstract](https://arxiv.org/abs/2606.03972)
- [PDF](https://arxiv.org/pdf/2606.03972)
- [arXiv source](https://arxiv.org/src/2606.03972)
- [Project page](https://aad-1.github.io/)
- [Official GitHub repo](https://github.com/AutoLab-SAI-SJTU/AAD-1)
- [Hugging Face checkpoint](https://huggingface.co/Watay/AAD-1)

## 一句話總結
**AAD-1** 把 pretrained bidirectional video diffusion model 改造成 **one-step autoregressive image-to-video generator**：generator 保持 causal 以支援 streaming rollout，但 discriminator 在 training 時看完整 video、給 video-level holistic realism score，並用 `ODE initialization -> DMD warmup -> asymmetric adversarial refinement` 三階段避免 one-step distillation 的 motion collapse 和 training instability。

## 這篇在解決什麼問題
Fast autoregressive video diffusion 的目標是把只能生成短片的 bidirectional video diffusion model，改造成可以 long-horizon / streaming rollout 的 autoregressive model。問題是：

1. **one-step generation 很容易 collapse**  
   多步 diffusion 可以逐步 refine；one-step per chunk 必須一次產生 chunk，容易變成靜態影片、模糊、motion 不足或 temporal drift。

2. **causal discriminator 看不到 future，抓不到長程錯誤**  
   如果 discriminator 也照 generator 一樣 causal，它只能根據 past context 評估當前 frame / chunk。影片早期決策造成的 long-range drift，可能要到未來 frames 才看得出來。

3. **直接 adversarial distillation 不穩**  
   one-step student 初期離 teacher / data distribution 太遠，GAN loss 容易給出不穩或破壞性的 gradient。作者觀察到沒有 warmup 時會嚴重 visual degradation。

這篇的核心診斷是：one-step autoregressive generation 的失敗不只是 sampler 太少步，而是 **generator 的 causal constraint 和 discriminator 的 supervision visibility 不應該對稱**。

## 核心方法
### 1) Asymmetric generator-discriminator design
AAD-1 的 generator 必須 causal，因為 inference 要 autoregressive streaming：

```text
previous chunks + conditioning image/text
  -> one forward pass
  -> next video chunk
```

但 discriminator 不需要 causal，因為它只在 offline training 使用。作者讓 discriminator 使用 bidirectional DiT backbone，能看完整 spatiotemporal sequence，並輸出單一 video-level realism score。

這個 asymmetric design 的重點是：

- generator：保持 causal，支援長影片 rollout。
- discriminator：bidirectional + video-level，能用 future context 懲罰 early-frame decisions 導致的 long-range drift。

### 2) 三階段 training pipeline
作者沒有直接從 pretrained model 做 one-step GAN，而是分三階段：

**Stage I: ODE initialization**

- 從 Wan 2.1 T2V 這類 pretrained bidirectional video model 出發。
- 把 bidirectional attention 改成 block-wise causal attention。
- 用 Diffusion Forcing / teacher denoising trajectories 做初始化，讓 causal student 有基本 autoregressive 能力。

**Stage II: one-step DMD warmup**

- 使用 Self-Forcing Distribution Matching Distillation。
- student 自己 autoregressive rollout，產生完整 clip。
- 用 frozen bidirectional teacher 的 real score 和 fake score model 的分布差，讓 student distribution 靠近 teacher distribution。
- 這一步的目標不是最後品質，而是把 one-step student 拉到比較 on-manifold 的區域，避免 Stage III GAN 一開始就崩。

**Stage III: asymmetric adversarial refinement**

- autoregressively rollout causal generator。
- bidirectional discriminator 看 full generated clip vs real clip。
- discriminator input 加 timestep-dependent Gaussian noise，並使用 approximate R1 / R2 regularization。
- 作者強調 sequential staging 很重要：DMD 和 GAN 同時做會互相拉扯，DMD 拉向 teacher distribution，GAN 拉向 real data distribution，容易不穩。

### 3) Long-horizon rollout mechanism
為了 streaming generation，AAD-1 使用：

- sink tokens / sink frames：保留開頭 anchor，幫助 identity consistency。
- sliding-window context：保留最近幾個 chunks，控制計算量。
- Relative RoPE：讓 positional encoding 在長 rollout 時不離開訓練分布太多。

這些細節對 audio 也有啟發：one-step streaming audio generation 也會面臨 long-horizon identity / timbre / rhythm drift。

## Training / Data
模型和訓練設定：

- Backbone：14B Wan 2.1 T2V。
- Task：image-to-video generation。
- Inference：one sampling step per autoregressive chunk；另有 2-NFE variant。
- I2V conditioning：conditioning frame 放在第一個 KV cache position，後續 chunk size 為 4。
- Context：attention sink size 1，local window size 9。
- Stage I：ODE model 訓練 2,000 steps。
- Stage II：DMD generator 只訓練 100 steps 並 early stopping，因為訓練太久會 motion collapse。
- Stage III：generator 訓練 200 steps；discriminator 用 Wan 2.1 T2V backbone + APT-style heads。
- Full training cost：約 3.5 天，64 張 NVIDIA H20 GPUs。

評估：

- VBench-I2V standard protocol。
- 5-second clips at 480p。
- 額外測 20-second rollout 和 720p zero-shot。

## 主要結果
### 1) One-step autoregressive generation 達到強 VBench-I2V 表現
在 480p / 5s / 1 NFE 下，Stage-III AAD-1 在 autoregressive methods 中很強：

- Subject Consistency：94.34
- Background Consistency：95.08
- Motion Smoothness：98.22
- Dynamic Degree：41.46
- Aesthetic Quality：60.07
- Imaging Quality：71.49
- I2V Subject：98.65
- I2V Background：97.83

它比 CausVid / Self Forcing 這類 4-NFE autoregressive baselines 更能保留 scene coherence 和 conditioning faithfulness。Stage-II 的 Dynamic Degree 較高，但 Stage-III 在 consistency / faithfulness 更好，表示 adversarial refinement 改善了視覺一致性但可能犧牲部分 motion magnitude。

### 2) DMD warmup 是必要穩定器
Ablation 顯示沒有 DMD warmup 時：

- Aesthetic Quality：53.63
- Imaging Quality：62.81

有 DMD warmup：

- Aesthetic Quality：58.64
- Imaging Quality：69.37

作者的解釋是：如果 one-step generator 一開始離 data distribution 太遠，GAN objective 不會給出穩定的 temporal realism gradient。DMD warmup 先讓 student 接近 teacher manifold，GAN refinement 才有效。

### 3) Discriminator 的 visibility 比 head granularity 更關鍵
Discriminator ablation：

- Causal DiT + frame-wise logits：Dynamic Degree 1.08，幾乎 static video。
- Causal DiT + video-wise logits：Dynamic Degree 42.07，但 Drift Score 7.10，動起來但 drift 嚴重。
- Bidirectional DiT + frame-wise logits：Drift Score 4.38。
- Bidirectional DiT + video-wise logits：Drift Score 4.02，最佳。

作者認為 frame-wise causal discriminator 有 trivial solution：generator 複製上一幀就能讓每張 frame 看起來真實，結果影片變靜態。video-wise logits 可以稍微修正 motion，但 causal backbone 仍然缺 future-anchored critique。真正有效的是 bidirectional discriminator。

## Project relevance
**project-one-step-audio-generation：高啟發，但不是 audio paper。**

這篇最值得借的是 training principle：

```text
streaming generator must be causal
training critic / discriminator does not have to be causal
```

如果我們要做 one-step audio generation，尤其是 streaming TTS、dialogue TTS、full-duplex dual-channel audio generator，可以把這個想法改成：

- generator：causal / chunk-wise，一次產生下一段 codec tokens 或 waveform latent。
- discriminator / judge：training 時看完整 utterance / full dialogue / future audio context。
- score：不要只看 frame-level realism，而要看 phrase-level、utterance-level、dialogue-level consistency。

對 audio 的直接類比：

- video 的 motion collapse 對應 audio 的 monotone prosody、repeated acoustic pattern、flat rhythm、speaker identity drift。
- video 的 long-horizon visual drift 對應 audio 的 timbre drift、speaking rate drift、room tone drift、speaker channel leakage。
- video-level discriminator 對應 utterance-level / conversation-level audio discriminator。
- DMD warmup 對應先用 teacher diffusion / flow matching / consistency objective 讓 one-step audio student on-manifold，再用 adversarial / reward refinement。

**project-full-duplex-data：中度相關。**

對 full-duplex dual-channel generator，generator 在 inference 時必須 causal，否則不能 real-time；但 training critic 可以看完整 A/B channels 和 original mixture。這和我們剛加入的 mixture-consistent multi-loss hypothesis 可以結合：

```text
causal dual-channel generator
  -> predicts A, B, and/or mixture chunks
bidirectional full-dialogue critic
  -> checks overlap, backchannel timing, speaker consistency, mixture realism
```

換句話說，AAD-1 支持一個方向：**用 non-causal teacher / critic 訓練 causal streaming generator**。

**project-tts-data-pipeline：低到中度相關。**

這篇不處理 TTS data cleaning，但它提醒我們如果要把 clean TTS / dialogue data 蒸餾成 one-step generator，資料不能只看短 clip。需要包含 long utterance、speaker consistency、pause / prosody / event continuity，否則 one-step model 會在長 horizon 上 drift。

## Related papers in my pool
- [[arxiv_2605_28063|PlanAudio]]：free-form prompt -> speech+sound generation；未來如果要 one-step composite audio，可借 AAD-1 的 staged distillation。
- [[arxiv_2606_03116|AnyAudio-Judge]]：可作 audio-level holistic critic / rubric evaluator 的起點，但 AAD-1 顯示 critic 需要能看 full sequence。
- [[arxiv_2603_25750|Sommelier]]：提供 full-duplex audio preprocessing；可為 one-step full-duplex generator 提供 long dialogue data。
- [[arxiv_2604_09344|DialogueSidon]]：mono dialogue -> speaker-wise tracks；可和 asymmetric full-dialogue critic 結合。
- [[arxiv_2605_18607|Forecasting Downstream Performance with Proxy Metrics]]：可在 expensive one-step audio training 前，預測哪個 checkpoint / data recipe 值得繼續。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。官方 project page 標示為 ICML 2026，BibTeX 寫作 `Proceedings of the 43rd International Conference on Machine Learning` 並註記 `To appear`。

## 我該不該細讀
**如果目標是 one-step audio generation，值得細讀 method 和 ablation。**

最值得抓的不是 video-specific 架構，而是三個原則：

1. one-step student 需要 warmup，不能直接 GAN。
2. streaming generator 可以 causal，但 training critic 應該看 full sequence。
3. frame-level realism 會鼓勵 trivial shortcut；需要 sequence-level holistic score。

這三點很可能直接適用到 speech / audio，尤其是長語音、dialogue TTS、full-duplex overlap generation。

## 可能的弱點 / open questions
1. **這是 video，不是 audio**  
   acoustic token / waveform latent 的錯誤型態不同。audio 的 phase、pitch、speaker identity、phoneme intelligibility 不是 video discriminator 可直接類比。

2. **training cost 很高**  
   14B backbone + 64 H20 GPUs 對 audio prototype 太重。audio project 應該先用 codec-token latent 或小模型驗證 principle。

3. **Stage-II / Stage-III trade-off 還不清楚**  
   Stage-II motion magnitude 較高，Stage-III consistency 較好。audio 裡可能也會有「prosody 活潑」和「speaker/content fidelity」之間的 tension。

4. **one-step 對 fast motion 的限制**  
   作者承認 fast motion、complex structures、long-horizon extrapolation 仍會 degrade。audio 類比是快速 turn-taking、laugh / breath / backchannel、overlap onset 可能很難 single pass 生成。

5. **critic 是否會 reward-hack**  
   若 audio 版本用 adversarial / judge refinement，需要檢查 generator 是否學會騙 holistic critic，而不是產生真正自然的 speech。

## Tags
- `video-generation`
- `diffusion-distillation`
- `adversarial-training`
- `autoregressive-generation`
- `one-step-generation`
- `project-one-step-audio-generation`

## Concepts
- `asymmetric adversarial distillation`
- `one-step autoregressive generation`
- `causal generator`
- `bidirectional discriminator`
- `video-level holistic discrimination`
- `distribution matching distillation`
- `DMD warmup`
- `self-rollout training`
- `motion collapse`
- `long-horizon drift`
- `sink tokens`
- `sliding-window context`
- `Relative RoPE`
- `VBench-I2V`

## Citation
官方 project page 提供 ICML 2026 BibTeX；arXiv metadata 以 `2606.03972` 記錄。

```bibtex
@inproceedings{li2026aad1,
  title={AAD-1: Asymmetric Adversarial Distillation for One-Step Autoregressive Video Generation},
  author={Haobo Li and Yanhong Zeng and Yunhong Lu and Jiapeng Zhu and Hao Ouyang and Qiuyu Wang and Ka Leong Cheng and Yujun Shen and Zhipeng Zhang},
  booktitle={Proceedings of the 43rd International Conference on Machine Learning},
  year={2026},
  note={To appear}
}
```
