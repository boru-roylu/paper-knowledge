---
paper_key: arxiv_2510_03597
canonical_id: "arxiv:2510.03597"
title: "Neon: Negative Extrapolation From Self-Training Improves Image Generation"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2510.03597"
pdf_url: "https://arxiv.org/pdf/2510.03597"
status: read
rating: 4
tags:
  - speech-llm
  - speech-data
  - project-tts-data-pipeline
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- OpenReview summary model: `gpt-5.5`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2510.03597)
- [PDF](https://arxiv.org/pdf/2510.03597)

## 一句話總結
Neon 提出一個很簡單的 post-hoc method：先用 model 自己生成的 synthetic data 做短暫 self-training，再把這個 degraded update 反向 extrapolate 回去，藉此在幾乎不增加 compute、也不需要新 real data 的情況下提升 image generation quality。

## 這篇在解決什麼問題
這篇在解決 **generative AI 對高品質 training data 依賴過強** 的問題，特別是當 real data 變少時，如何還能持續提升 generative model。

作者聚焦的痛點是：

- **high-quality training data scarce**：擴大模型不再是唯一瓶頸，資料品質與數量才是關鍵限制
- **naïve self-training 會 collapse**：直接用模型自己的生成資料再訓練，會導致 model autophagy disorder (MAD) / model collapse
- **現有解法太重或太侷限**：像 external verifier、auxiliary discriminator、negative guidance、likelihood-based discrimination 等方法，常有額外 inference overhead、只適用特定架構，或訓練流程複雜

作者想回答的是：  
**能不能把 self-training 的「壞方向」本身變成修正訊號，並且用一個非常便宜的方式反過來幫模型變好？**

## 核心方法
核心方法叫 **Neon (Negative Extrapolation frOm self-traiNing)**。

### 方法流程
1. 先從 base model parameters `θ_r` 出發
2. 用模型自己生成的 synthetic samples 做短暫 fine-tuning，得到 degraded parameters `θ_s`
3. 不直接使用 `θ_s`，而是做 **negative extrapolation**：

\[
\theta_{\text{Neon}} = \theta_r - w(\theta_s - \theta_r) = (1+w)\theta_r - w\theta_s,\quad w>0
\]

也就是把 self-training 造成的更新方向反過來走。

### 直覺
- `θ_s - θ_r` 不是噪音，而是 **synthetic gradient direction**
- 對常見的 mode-seeking sampler 而言，這個方向會和真實 population gradient 出現 **anti-alignment**
- Neon 用 reverse merge 把這個偏差拉回來，讓 model 更接近 true data distribution

### 優點
- **post-hoc merge**：不需要改整個 training pipeline
- **no new real data**
- **few synthetic samples enough**：大約 1k synthetic samples 就能起作用
- **compute 很低**：通常 <1% additional training compute
- **architecture-agnostic**：可用在 diffusion, flow matching, autoregressive, inductive moment matching 等模型

## Training / Data
這篇是 **image generation** paper，不是 speech/TTS。

### 訓練設定
- 先對 base model 做短暫 self-training，產生 `θ_s`
- 再以 `θ_r` 與 `θ_s` 做 parameter merge，得到 Neon model
- 額外 training compute 通常很少，文中強調多數情況下低於 **1%**

### 使用資料
作者在多個 dataset 上驗證：
- **ImageNet**
- **CIFAR-10**
- **FFHQ**

### 使用模型
涵蓋多種 generative architectures：
- **diffusion**
- **flow matching**
- **autoregressive**
- **inductive moment matching (IMM)**

## 主要結果
作者主張 Neon 的效果具備 **universality**，在多種架構與資料集上都能改善生成品質。

### 代表性結果
- **ImageNet 256x256** 上，`xAR-L + Neon` 達到 **FID 1.02**
- 這被描述為新的 SOTA，且只用了 **0.36% additional training compute**
- 在 CIFAR-10、FFHQ、ImageNet-512 等設定上也能帶來穩定改善

### 結果特徵
- Neon 通常能在 **fidelity / recall** 上改善，並把模型從 self-training 的 collapse 邊緣拉回來
- 對比直接 self-training (`w < 0` 或等價的 direct synthetic fine-tuning)，Neon 明顯更好
- 文中也強調它不是只改善最高 quality 的極少數樣本，而是增加高品質輸出的比例，並提升覆蓋度

## Project relevance
- **project-full-duplex-data**: 不相關
- **project-tts-data-pipeline**: 不相關

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)
OpenReview summary 顯示這篇 **Accepted (Oral)**，reviewer 整體評價非常正面。

### reviewer discussion 重點
- reviewers 普遍認為實驗 **thorough and convincing**
- 強調方法 **cheap and efficient**
- 一致支持接受，甚至有 summary 明確說是 **clear accept**

### authors rebuttal / revision 回應
作者在 rebuttal / revision 中補強了幾個點：
- 加入更完整的 **quantitative comparisons**，特別是 direct self-training (`w = -1`) 與 Neon 的對照
- 補上更多 **qualitative visualizations**
- 增加一個 **Gaussian warmup example** 來更清楚說明理論機制
- 補充更詳細的 **efficiency comparisons**
- 回應了 Neon 是否只改善 diversity 或也改善 fidelity 的問題，強調兩者都有改善，但機制是 correction to covariance / distributional shape

### 對讀 paper 的影響
這些 discussion 表示：
- 這篇的主要爭點不在於「方法是否有效」，而在於 **mechanism 解釋是否足夠清楚**
- 作者已透過 additional theory + visual evidence 把這點補強
- 因此這篇更適合當成一個 **簡單但可遷移的 post-hoc improvement recipe** 來看

## 我該不該細讀
**建議細讀。**

理由：
- 方法非常簡潔，但背後的 **negative extrapolation** 觀念有通用性
- 對 data-scarce generative modeling 很實用
- 實驗覆蓋多個 architecture，說服力高
- 如果你關心 **self-training、synthetic data reuse、model collapse、post-hoc model correction**，這篇很值得看

如果你只想抓一個核心結論：  
**self-training 不一定只能避免，還可以反過來當成 correction signal。**

## 可能的弱點 / open questions
- **需要先有一個 degraded self-training model**：Neon 不是完全不靠 synthetic data，而是依賴先做一次「壞方向」更新
- **synthetic samples 的品質與 sampler 偏差** 可能影響效果；理論上依賴 anti-alignment，但實務上何時成立需要看設定
- **超低 data regime 的穩定性**：雖然文中說 1k synthetic samples 就夠，但更極端情況下是否穩定仍值得驗證
- **是否會受 model family / sampler choice 限制**：作者宣稱 universal，但不同生成範式的細節可能仍影響效果
- **更多非影像 domain 的驗證**：雖然作者提到理論上可延伸到 NLP，但本文沒有直接做這方面實驗
- **最佳 `w` 的選擇**：negative extrapolation strength 仍需要調參，實務上可能沒有單一通用值

## Tags
- generative modeling
- synthetic data
- model collapse
- self-training
- negative extrapolation
- post-hoc merge
- diffusion models
- flow matching
- autoregressive models
- image generation
- data scarcity

## Concepts
- **model autophagy disorder (MAD)**
- **model collapse**
- **self-training**
- **synthetic data**
- **negative extrapolation**
- **post-hoc parameter merge**
- **population gradient**
- **anti-alignment**
- **mode-seeking sampler**
- **fidelity / recall**
- **FID (Fréchet Inception Distance)**
- **diffusion**
- **flow matching**
- **autoregressive generation**
- **inductive moment matching (IMM)**

## Citation
```bibtex
@article{alemohammad2025neonnegativeextrapolationfroms,
  title={Neon: Negative Extrapolation From Self-Training Improves Image Generation},
  author={Alemohammad, Sina and Wang, Zhangyang and Baraniuk, Richard G.},
  year={2025},
  journal={arXiv preprint},
  eprint={2510.03597},
  archivePrefix={arXiv}
}
```
