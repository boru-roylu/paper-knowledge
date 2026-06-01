# OpenReview Summary: Neon: Negative Extrapolation From Self-Training Improves Image Generation

## Verdict

**Accept (Oral)；整體判斷：強接收、但閱讀時需保留幾個實務與理論上的 caveats。**

這篇 paper 提出 **Neon: Negative Extrapolation From Self-Training**：先將 base generative model 在自己生成的 synthetic data 上短暫 self-training 得到 degraded weights $\theta_s$，再做 parameter-space extrapolation：

\[
\theta_{\text{Neon}}=(1+w)\theta_r-w\theta_s,\quad w>0
\]

核心 claim 是：常見 mode-seeking inference samplers 會讓 synthetic-data gradient 與 true population gradient 產生 predictable anti-alignment；因此「反向」離開 self-training degradation direction 可以改善模型。

OpenReview 最終 decision 是 **Accept (Oral)**。Area Chair summary 指出 reviewers 一致認為實驗 thorough and convincing，方法 cheap and efficient，可能有 impact。Reviewer concerns 主要集中在：

- 與 **SIMS / Karras bad guidance / generic weight merging / model soups / SWA** 的 novelty positioning；
- theory presentation 是否清楚、assumptions 是否可驗證；
- hyperparameter sensitivity、FID-based tuning 是否可能 overfit；
- 是否有 direct self-training baseline；
- gains 是 diversity / recall 還是 perceptual fidelity；
- 是否能推廣到 NLP / text-to-image / broader modalities。

作者 rebuttal 大多有針對問題回答，且 reviewers 後續明確表示會提高分數或維持 strongly positive。不過，根據提供的 TeX excerpts，有些 rebuttal 中聲稱加入的內容，例如 **$w=-1$ direct self-training baseline、test-set DINOv2 validation、Gaussian warmup example、qualitative appendices**，在 excerpts 中無法完全驗證，甚至主文 Figure 的 x-axis 仍顯示 $w\in[0,3]$，未呈現 $w=-1$。因此，讀 paper 時應確認最終 PDF 是否真的包含這些 revision。

---

## Main Strengths

1. **方法非常簡單且 deployment-friendly**

   Paper 的 central update 是一個 one-shot parameter merge：

   \[
   \theta_{\text{Neon}} = \theta_r - w(\theta_s-\theta_r)
   \]

   相比 inference-time negative guidance 類方法，Neon 的主張是 **no extra inference overhead**、不需要改 sampler、不增加 NFE。這點在 paper abstract 和 experiments 中反覆強調。

2. **Empirical scope 廣**

   TeX excerpts 中明確說實驗涵蓋：

   - **diffusion**：EDM-VP；
   - **flow matching**；
   - **autoregressive**：VAR / xAR；
   - **few-step / IMM**；
   - datasets：ImageNet、CIFAR-10、FFHQ。

   這支持 reviewers 認為 experiments convincing。

3. **Compute / data efficiency claim 強**

   Paper claim：

   - ImageNet-256 xAR-L：FID 從 1.28 到 1.02，只需 0.36% extra training compute；
   - CIFAR-10 EDM-VP：FID 1.78 → 1.38，用 6k synthetic samples，1.75% extra compute；
   - FFHQ-64 EDM-VP：FID 2.39 → 1.12，用 18k samples，0.85% extra compute；
   - Flow matching CIFAR-10：FID 3.5
