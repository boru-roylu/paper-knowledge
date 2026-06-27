---
paper_key: arxiv_2510_08425
canonical_id: "arxiv:2510.08425"
title: "Reinforcing Diffusion Models by Direct Group Preference Optimization"
year: 2026
venue: "ICLR 2026"
url: "https://arxiv.org/abs/2510.08425"
pdf_url: "https://arxiv.org/pdf/2510.08425"
status: read
rating: 0
tags:
  - diffusion-rl
  - preference-optimization
  - reward-modeling
  - text-to-image
  - project-audio-model-evaluation
created: 2026-06-27
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`), OpenReview notes, and the official GitHub README. The arXiv TeX describes the core DGPO method; the GitHub README includes post-review implementation details such as PPO-style clipping and CFG-free recipes.

## Links

- [Original URL](https://arxiv.org/abs/2510.08425)
- [arXiv abstract](https://arxiv.org/abs/2510.08425)
- [PDF](https://arxiv.org/pdf/2510.08425)
- [arXiv source](https://arxiv.org/src/2510.08425)
- [Official GitHub repo](https://github.com/Luo-Yihong/DGPO)
- [OpenReview forum](https://openreview.net/forum?id=jymuXl8GYi)

## 一句話總結

DGPO 是 diffusion model 的 online RL / preference optimization 方法：它保留 GRPO 的 group-relative preference information，但不要 policy-gradient / stochastic SDE sampler，改用 deterministic ODE rollout 產生 samples，直接做 group-level DPO-style preference learning，因此比 Flow-GRPO 快約 20x，在 GenEval、OCR text rendering、PickScore alignment 上都更強，且 out-of-domain reward metrics 沒明顯崩壞。

## 這篇在解決什麼問題

LLM 的 GRPO / RLHF 很成功，因為 LLM 自然是 stochastic policy：每一步輸出 token distribution，可以做 policy gradient。

Diffusion model 不一樣。高品質 / 低成本 inference 通常使用 deterministic ODE sampler，但 policy-gradient RL 需要 stochastic policy。近期 Flow-GRPO / DanceGRPO 類方法為了套 GRPO，只好改用 stochastic SDE sampler，把 diffusion reverse process 包成 conditional Gaussian policy。

作者認為這有三個問題：

- SDE rollout 比 ODE rollout 慢，固定 compute 下 sample quality 更差。
- stochasticity 來自 model-agnostic Gaussian noise，探索訊號弱，收斂慢。
- policy-gradient 需要沿整條 sampling trajectory 訓練，單 iteration 很貴。

這篇的核心觀點是：

> GRPO 真正有用的不一定是 policy gradient，而是同一個 prompt 下多個 samples 的 group-relative information。

所以 DGPO 試圖保留 group preference，移除 stochastic policy。

## 核心方法

### 1. Online group generation

每個 training iteration：

```text
sample prompt c
current / EMA model p_theta_minus generates G samples with deterministic ODE rollout
reward model scores each sample
normalize rewards within group -> advantages A_i
split samples into positive group G+ and negative group G-
```

主實驗 group size `G=24`。OpenReview response 補充：`G=24` 比 12 / 6 更穩、更快、更高 final score，說明 group information 很重要。

### 2. Group-level Bradley-Terry objective

DGPO 不是比較 single winning sample vs losing sample，而是比較兩組 samples：

```text
P(G+ preferred over G-) = sigmoid(R_theta(G+) - R_theta(G-))
```

Group reward 是 sample-level reward 的 weighted sum：

```text
R_theta(G | c) = sum_{x in G} w(x) * r_theta(c, x)
```

### 3. Advantage-based weights 消掉 partition function

DPO-style derivation裡有 intractable partition function `Z(c)`。DGPO 選擇：

```text
A_i = (r_i - mean(group rewards)) / std(group rewards)
w_i = |A_i|
G+ = samples with A_i > 0
G- = samples with A_i <= 0
```

因為 normalized advantages 的總和為 0，所以 positive group 的 weights 和 negative group 的 weights 會平衡，讓 `Z(c)` 項抵消。

直覺上：

- 比平均好很多的 sample 在 positive group 權重大。
- 比平均差很多的 sample 在 negative group 權重大。
- 接近平均的 sample 權重小。

### 4. Diffusion-DPO-style DSM loss ratio

作者把 sample-level log density ratio 轉成 diffusion path / denoising score matching loss 的差：

```text
L_DGPO ~ -log sigmoid(
  - beta * lambda_t *
  sum_i A_i * (DSM_loss_theta(x_i, x_t, c) - DSM_loss_ref(x_i, x_t, c))
)
```

OpenReview 裡 reviewer 要求更完整 derivation；作者回覆說 revision 已補 Appendix C，並指出 loss 可重寫成 single summation：

```text
sum_{x in G} A(x) * (L_theta - L_ref)
```

### 5. Timestep Clip Strategy

DGPO 為了省 rollout cost，只用少步數 sampler，例如 10-step Flow-DPM-Solver 生成 training samples。但少步數生成可能有 blur / artifacts，如果直接在所有 timestep 訓練，模型可能 overfit 這些 artifacts。

解法：training timestep 只從 `[t_min, T]` sample，不訓練靠近 clean image 的低噪聲區域。這會破壞少步樣本的低頻 artifact，同時保留 enough denoising signal。

Reviewer 問 `t_min` 敏感度；作者回覆通常用 `0.3` 或 `0.4`，在 `[0.3, 0.6]` 表現穩。

### 6. CFG handling / repo version

arXiv TeX 寫到 training 時 drop text 5%，sampling 可用 CFG。OpenReview / GitHub README 補充更明確：

- DGPO training 不直接對 CFG model 做標準 diffusion loss。
- Default mode：rollout / inference with CFG，training without CFG。
- Fully CFG-free mode 也可行，但 out-of-domain metrics 通常較差。
- GitHub README 說 review 後加入 PPO-style clipping，能提升 stability。

## Training / Data

Base model：

- SD3.5-M。
- LoRA fine-tuning，rank 32。
- Resolution 512。
- Group size 24。
- Rollout：Flow-DPM-Solver，10 steps。
- `beta=100` default。
- Training prompt text drop probability 0.05。
- Hardware：A100；reported GPU hours are A100 hours。

Reward tasks：

1. **Compositional image generation**：GenEval，測 object counting、spatial relation、attribute binding。
2. **Visual text rendering**：prompt template `A sign that says "text"`，用 OCR edit-distance-derived text fidelity reward。
3. **Human preference alignment**：PickScore。

Out-of-domain metrics for reward hacking audit：

- Aesthetic Score。
- DeQA。
- ImageReward。
- UnifiedReward。
- DrawBench prompts。

## 主要結果

### 1. GenEval 從 0.63 提到 0.97

在 SD3.5-M 上：

- SD3.5-M base：0.63。
- Flow-GRPO：0.95。
- **DGPO：0.97。**

細項：

- single object：1.00。
- two objects：0.99。
- counting：0.97。
- colors：0.95。
- position：0.99。
- attribute binding：0.91。

DGPO 也超過表中 GPT-4o 的 GenEval 0.84 和 SANA-1.5 4.8B 的 0.81，但這類比較要注意不同 model family / data / system setting。

### 2. OCR / preference alignment 也提升

Visual text rendering：

- SD3.5-M OCR Acc：0.59。
- Flow-GRPO：0.92。
- **DGPO：0.96。**

Human preference alignment：

- SD3.5-M PickScore：21.72。
- Flow-GRPO：23.31。
- **DGPO：23.89。**

同時 out-of-domain metrics 也維持或提升：

- DGPO compositional task：Aesthetic 5.31、DeQA 4.03、ImageReward 1.08、UnifiedReward 3.60。
- DGPO preference task：Aesthetic 6.08、DeQA 4.40、ImageReward 1.32、PickScore 23.91、UnifiedReward 3.74。

### 3. 約 20x training speedup

作者主文說 DGPO 一般比 Flow-GRPO 快約 20x；在 GenEval teaser 裡接近 30x。原因是：

- 用 ODE rollout 而不是 SDE rollout。
- 不訓練整條 sampling trajectory。
- group preference 直接給 training signal，不靠 model-agnostic Gaussian exploration。

OpenReview decision summary 也把 20-30x faster training 和 strong benchmark performance 列為主要優點。

### 4. Ablation：ODE > SDE，online > offline，DGPO > Diffusion-DPO

作者的 ablation 結論：

- ODE rollout 比 SDE rollout 在 convergence speed 和 final metrics 上更好。
- Offline DGPO 用 reference model 先產生 dataset 也能提升，但明顯弱於 online DGPO。
- Diffusion-DPO 避免 stochastic policy，但只能用 pairwise preferences；DGPO 用 group relative info，表現更好。
- 沒有 timestep clip 時，OCR reward 可能只小幅下降，但 visual quality 嚴重退化。

## Project relevance

### project-audio-model-evaluation：非常高相關

這篇對我們的 audio judge / reward / RL 討論很直接：

```text
AnyAudio-Judge / audio reward model
  -> for each prompt, sample G audio outputs
  -> score each output with rubrics / reward
  -> convert group-relative scores into positive/negative groups
  -> optimize audio diffusion / flow generator without policy-gradient SDE rollout
```

它特別適合我們之前討論的 AnyAudio-Judge：

- AnyAudio-Judge 可以給多個 rubrics / yes-no score。
- DGPO-style group relative objective 可以把同一 prompt 下的多個 generated audio 排序。
- 不需要把 audio generator 強行做成 stochastic policy。
- 可以使用高品質 deterministic ODE / flow sampler 做 rollouts。

對 audio reward hacking 的啟發也很強：作者用 Aesthetic / DeQA / ImageReward / UnifiedReward 做 out-of-domain metrics，避免只追 GenEval / OCR / PickScore。Audio 版也應該用：

- in-domain AnyAudio rubrics。
- out-of-domain ASR WER、speaker similarity、FAD、UTMOS、human preference、event timing judge。
- qualitative artifact audit。

### project-one-step-audio-generation：中度相關

DGPO 不是 one-step generation paper，但它偏好 deterministic ODE / few-step rollout，和 low-latency audio generator 有關。如果 one-step audio generator 或 few-step flow generator 已有 reward model，可用 DGPO 做 fast post-training，而不是 SDE policy gradient。

### project-generative-speech-representation-evaluation：低到中度相關

DGPO 不評估 representation，但它的 lesson 是：post-training objective 不能只看 target reward，要看 out-of-domain metrics 和 artifacts。這對比較 WavCube / AudioVAE / codec latent 後的 reward tuning 很重要。

## Related papers in my pool

- [AnyAudio-Judge](../arxiv_2606_03116/)：可作 audio reward/rubric source；DGPO 可把 group-level audio reward 轉成 diffusion generator post-training objective。
- [PlanAudio](../arxiv_2605_28063/)：composite speech+sound generator target；若有 rubric judge，可用 DGPO-style online post-training。
- [FlashTrace](../arxiv_2602_01914/)：可補 DGPO reward 的 attribution audit，確認 reward improvement 是否由正確 audio/token span 支持。
- [StepOPSD](../arxiv_2605_27140/)：credit assignment in agent RL；DGPO 是 group-level sample preference，StepOPSD 是 step/token-level local credit，兩者可合成 span-grounded group preference training。
- [MeanFlow Transformers with Representation Autoencoders](../arxiv_2511_13019/)：few-step / one-step generation efficiency；DGPO 可作 deterministic sampler generator 的 reward post-training route。
- [Representation Fréchet Loss](../arxiv_2604_28190/)：FD-loss 是 distribution-level differentiable objective；DGPO 是 reward/preference-level objective。
- [RepFusion](../arxiv_2606_14700/)：提到 benchmark/reward overfitting 問題；DGPO 也用 out-of-domain metrics 檢查 reward hacking。

## OpenReview / reviewer discussion

OpenReview forum `jymuXl8GYi` decision 為 **Accept (Poster)**。Reviews 分數包含 8、6、6、4；decision summary 認為 paper 的優點是動機清楚、20-30x speedup、strong benchmark performance、evaluation 完整。

主要 reviewer concerns：

1. **Novelty 是否只是 DPO + GRPO 組合**
   Reviewer 認為核心新意是把 DPO 擴到 group-wise diffusion setting，不一定是全新 paradigm。作者回覆強調 diffusion-native RL、移除 stochastic policy、保留 group info 的 practical impact。

2. **Derivation 不夠完整**
   Reviewer 要求補 Eq. 15 到 Eq. 17、likelihood ratio 到 DSM loss 的推導。作者回覆 revision 已補 Appendix C，並修正一個 missing expectation sign。

3. **Hyperparameters: beta / group size / t_min**
   Reviewer 要求 ablation。作者在 response 補：
   - `beta` 在 10 到 1000 都可強，太小如 1 會不穩。
   - group size 24 明顯優於 12 / 6。
   - `t_min` 在 0.3 到 0.6 較穩，通常用 0.3 / 0.4。

4. **DiffusionNFT concurrent comparison**
   Reviewer 要求和 DiffusionNFT 比。作者回覆說 DiffusionNFT 是 concurrent work，並補表：DGPO 在 GenEval、OCR、PickScore、ClipScore、HPSv2.1、Aesthetic、UnifiedReward 多數指標更好，但 ImageReward 稍低。

5. **Reward model quality / reward hacking**
   Reviewer 要求討論 reward failure modes。作者回覆區分 rule-based rewards 和 model-based rewards，並強調 out-of-domain metrics / qualitative samples 的必要性。

6. **PPO-style clipping / CFG**
   Reviewer 問如何加入 PPO clipping，作者說當前 arXiv method 未用，但 repo README 顯示 post-review 已加入 clipping recipe。CFG 方面，作者說 training 不用 CFG，sampling 可用 CFG；fully CFG-free 也能 work，但 OOD metrics 較差。

## 我該不該細讀

**建議讀，尤其是如果我們要把 AnyAudio-Judge 或其他 audio evaluator 接到 generator training。**

最值得讀：

- Method 裡如何從 group BT objective 推到 final DGPO loss。
- Advantage-based weight 為什麼能消掉 partition function。
- Timestep Clip Strategy，這對 few-step / artifact-prone audio rollouts 也很重要。
- OpenReview response 裡的 group size / beta / CFG / DiffusionNFT comparison。
- Out-of-domain metrics 設計，避免 reward hacking。

如果只關心 paper ingestion 或 pure evaluation，不一定要深讀公式；但如果要做 reward-model post-training，這篇是 high-priority。

## 可能的弱點 / open questions

1. **仍強依賴 reward quality**
   DGPO 只會優化給定 reward。若 AnyAudio-Judge / audio reward 有 blind spots，模型可能學會 reward hacking。

2. **Audio 的 deterministic rollout / forward diffusion approximation 需要重驗**
   Image diffusion 的 DSM loss / ODE sampler 設定不能直接套到 audio codec latent、waveform latent 或 flow-matching TTS。

3. **Group size cost**
   `G=24` 對 image 已經不小；audio generation 每個 sample 可能更長、更貴。需要測 smaller group、reuse partial generations、或 per-rubric grouping。

4. **Timestep clip 的 audio analogue 不明**
   Image 用 `t_min` 避免 overfit few-step blur artifacts；audio 可能要避免 overfit vocoder noise、muffling、ASR-friendly artifacts 或 clipped/noisy high-frequency detail。

5. **Reward overfitting 仍可能被 OOD metrics 漏掉**
   Image paper 用多個 model-based OOD metrics；audio 應加入 human spot-check 和 span-grounded attribution，不只換另一個 reward model。

6. **ICLR repo 版本和 arXiv TeX 有差異**
   GitHub README 補了 PPO-style clipping、CFG-free modes、hyperparameter recipes；正式 note 應未來再依 camera-ready / updated arXiv 修正。

## Tags

- `diffusion-rl`
- `preference-optimization`
- `reward-modeling`
- `direct-preference-optimization`
- `group-preference`
- `text-to-image`
- `project-audio-model-evaluation`
- `project-one-step-audio-generation`

## Concepts

- DGPO
- Direct Group Preference Optimization
- group-level preference
- advantage-based weights
- deterministic ODE rollout
- stochastic policy mismatch
- diffusion RL
- reward hacking
- timestep clip strategy
- Flow-GRPO
- Diffusion-DPO
- GenEval
- OCR reward
- PickScore
- out-of-domain metrics

## Citation

目前以 ICLR 2026 / arXiv preprint 記錄。

```bibtex
@inproceedings{luo2026dgpo,
  title={Reinforcing Diffusion Models by Direct Group Preference Optimization},
  author={Yihong Luo and Tianyang Hu and Jing Tang},
  booktitle={The Fourteenth International Conference on Learning Representations},
  year={2026}
}
```
