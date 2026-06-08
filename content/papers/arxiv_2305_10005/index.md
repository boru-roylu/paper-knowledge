---
paper_key: arxiv_2305_10005
canonical_id: "arxiv:2305.10005"
title: "DinoSR: Self-Distillation and Online Clustering for Self-supervised Speech Representation Learning"
year: 2023
venue: "NeurIPS 2023"
url: "https://arxiv.org/abs/2305.10005"
pdf_url: "https://arxiv.org/pdf/2305.10005"
status: read
rating: 8.1
tags:
  - speech-ssl
  - acoustic-unit-discovery
  - online-clustering
  - speech-representation
  - speech-tokenizer
  - project-tts-data-pipeline
  - project-generative-speech-representation-evaluation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> 生成註記：本 note 由 Codex 根據 arXiv TeX source `source/neurips_2023.tex`、`sections/*.tex`、`tables/*.tex`，以及 OpenReview forum metadata 整理；summary model: GPT-5 Codex。

## Links

- Original URL: [https://arxiv.org/abs/2305.10005](https://arxiv.org/abs/2305.10005)
- arXiv abstract: [https://arxiv.org/abs/2305.10005](https://arxiv.org/abs/2305.10005)
- PDF: [https://arxiv.org/pdf/2305.10005](https://arxiv.org/pdf/2305.10005)
- arXiv source: [https://arxiv.org/src/2305.10005](https://arxiv.org/src/2305.10005)
- Code: [https://github.com/Alexander-H-Liu/dinosr](https://github.com/Alexander-H-Liu/dinosr)
- OpenReview: [https://openreview.net/forum?id=m5LSvWAI1N](https://openreview.net/forum?id=m5LSvWAI1N)

## 一句話總結

DinoSR 把 `masked language modeling`、`self-distillation` 和 `online clustering` 結合起來做 self-supervised speech representation learning：teacher 用 unmasked audio 產生 contextualized embeddings，online clustering 把它們離散成 machine-discovered acoustic units，再讓 masked student 預測這些 cluster labels；結果在 acoustic unit discovery、low-resource ASR、SUPERB content tasks 上都很強，而且 codewords 和 human phone units 有明顯對齊。

## 這篇在解決什麼問題

speech SSL 裡有幾條常見路線：

- `wav2vec 2.0`：contrastive learning + vector quantization。
- `HuBERT`：先用 offline clustering 產生 pseudo labels，再做 masked prediction；之後還要 iterative reclustering。
- `data2vec`：self-distillation，student 回歸 teacher continuous representations。
- VQ 類方法：能產生 discrete units，但容易有 straight-through estimator、code collapse、codebook usage 不穩等問題。

DinoSR 想解決的是：**能不能 end-to-end 學出有 phonetic meaning 的 discrete acoustic units，同時避免 HuBERT 的 offline / iterative clustering 和 VQ 的 training instability？**

它的回答是：用 self-distillation teacher 產生 contextualized targets，但不要直接 regression continuous embedding；改成在 teacher hidden space 做 gradient-free online clustering，讓 student 預測 cluster IDs。

## 核心方法

### 1. Student-teacher self-distillation

模型有 student 和 teacher，兩者架構相同，都是 transformer encoder。teacher 不是另訓練的 supervised teacher，而是 student 參數的 EMA copy：

```text
theta_teacher <- lambda * theta_teacher + (1 - lambda) * theta_student
```

input view 的差異來自 masking：

- student：看到 masked speech features。
- teacher：看到 unmasked speech features。

這和 `data2vec` 類似，但 DinoSR 不直接讓 student 回歸 teacher embedding，而是讓 teacher embedding 先被 clustered。

### 2. Teacher hidden states 上的 online clustering

DinoSR 在 teacher 的 top `N` layers 各自維護一個 codebook。對第 `k` 層：

```text
teacher representation z_tilde_t^k
  -> nearest codeword assignment
  -> cluster index v as pseudo label
```

codebook 不是用 K-means offline 跑完再固定，而是在 training 中用 EMA 更新：

```text
code_sum_v <- tau * code_sum_v + (1 - tau) * sum(neighbor embeddings)
code_cnt_v <- tau * code_cnt_v + (1 - tau) * count(neighbors)
codeword_v <- code_sum_v / code_cnt_v
```

這讓 acoustic unit discovery 跟 representation learning 一起演化，但 codebook update 本身是 gradient-free，因此避免 VQ 的 straight-through estimator。

### 3. Multi-layer cluster prediction

student 只用最後一層 output，在 masked positions 上預測 teacher top layers 的 cluster IDs：

```text
loss = sum_{t in masked positions} sum_{k in top N layers}
       CE(prediction_head_k(student_last_layer_t), cluster_id_t^k)
```

也就是 DinoSR 同時向多層 teacher discrete targets 學習。作者發現 top layers 的選擇比 codebook size 更重要。

### 4. Online clustering vs VQ 的差別

作者強調 DinoSR 的 online clustering 和 VQ 概念相近但用途不同：

- VQ：通常是 forward pass 裡的 differentiable-ish bottleneck，需要 straight-through estimator。
- DinoSR：cluster 是 teacher hidden space 上的 pseudo-label mining，不讓 gradient 穿過 cluster assignment。

實務好處：

- 降低 computation。
- 避免 non-differentiable quantization 的 gradient approximation。
- 減少 code collapse。
- 產生可解釋的 acoustic units。

## Training / Data

Pre-training：

- Data：LibriSpeech 960 hours。
- Input：16 kHz waveform，先用 convolutional feature encoder downsample 到 50 Hz。
- Model：Base transformer encoder，12 layers，hidden dimension 768。
- Student masking：80% 的 50 Hz features 被 mask，每段 mask span 至少 10 frames。
- Teacher：不 mask input。
- Online clustering：top 8 layers，也就是 layers 5-12。
- 每層 codebook size：256 codewords。
- Codebook EMA decay `tau = 0.9`。
- Batch size：16 GPUs 上總共 63 minutes audio。
- Optimizer：Adam。
- LR：12k steps warmup 到 0.0005，接著 188k steps hold，再 200k steps decay 到 0.00005。
- Training steps：400k。
- Teacher EMA decay `lambda`：0.999 線性到 0.9999，再最後 anneal 到 1.0。
- 訓練成本：約 180 hours on 16 Nvidia V100 GPUs。

Fine-tuning / evaluation：

- LibriSpeech ASR：10 min / 1 hr / 10 hr / 100 hr labeled data，CTC fine-tuning，4-gram LM decoding。
- ZeroSpeech 2021 acoustic unit discovery：ABX error rate。
- SUPERB：PR、ASR、KS、IC、SF、ST。
- BABEL multilingual preliminary：10 languages pretrain，4 unseen languages fine-tune。

## 主要結果

### 1. Acoustic unit discovery 很強

ZeroSpeech 2021 ABX average error：

- wav2vec 2.0：`5.39`
- HuBERT：`4.22`
- data2vec：`5.20`
- ContentVec：`3.82`
- DinoSR：`3.59`

DinoSR 除了 same-speaker clean setup 之外，多數設定都最好，尤其 cross-speaker other 從 ContentVec / HuBERT 的 `5.17 / 6.19` 降到 `4.42`。

### 2. Low-resource ASR 優於或接近 data2vec

LibriSpeech WER with 4-gram LM：

- 10 minutes labeled data：test-clean / test-other = `7.3 / 11.8`，優於 data2vec `7.9 / 12.3`。
- 1 hour：`4.6 / 8.7`，test-clean 與 data2vec 持平，test-other 更好。
- 10 hours：`3.6 / 7.6`，優於 data2vec `3.9 / 8.1`。
- 100 hours：`2.9 / 6.7`，和 data2vec 接近或略好。

作者也用 `hours of speech processed` 強調 DinoSR 的 data / compute efficiency：比 HuBERT / WavLM 這種 iterative offline clustering 更省。

### 3. SUPERB content tasks 強，semantic tasks 接近強 baseline

SUPERB：

- PR PER：DinoSR `3.21`，優於 data2vec `4.69`、WavLM `4.84`。
- ASR WER：DinoSR `4.71`，優於 data2vec `4.94`、WavLM `6.31`。
- KS / IC / SF / ST：整體接近 WavLM / data2vec，其中 WavLM 在部分 semantic tasks 更強。

這表示 DinoSR 特別擅長 content / phonetic representation，但不一定全面壓過 WavLM 的 speaker / semantic / paralinguistic 工程化優勢。

### 4. Codewords 和 phone units 有明顯對齊

Discrete unit quality on LibriSpeech dev：

offline K-means on DinoSR L5：

- Code perplexity：`242.4 / 256`
- Cluster purity：`0.17`
- Phone purity：`0.63`
- PNMI：`0.62`

DinoSR online codebook L5：

- Active clusters：`217 / 256`
- Code perplexity：`179.2`
- Cluster purity：`0.19`
- Phone purity：`0.58`
- PNMI：`0.57`

相比 VQ-APC / Co-training APC，DinoSR codebook usage 明顯更好，code collapse 較少。作者也觀察到 codewords 對 phone 的分布呈現 long-tail：常見 phones 佔更多 codewords，而 acoustically similar phones 可能共享 codeword，例如 short pause / silence。

### 5. Multilingual preliminary 有訊號

BABEL setup 中，DinoSR 在 10 種 pretraining languages 上訓練，再 fine-tune 到 4 個 unseen languages。CER：

- Assamese：`27.2`
- Tagalog：`19.4`
- Swahili：`14.6`
- Lao：`22.8`

都優於 XLSR-10 table 裡的對應結果。作者也發現 5th layer 有 `86.5%` codewords 在全部 10 種語言中出現，12th layer 達 `97.6%`，支持 shared acoustic unit vocabulary 的可能性。

## Project relevance

### project-tts-data-pipeline：中高相關

DinoSR 對 TTS data pipeline 的價值不是直接生成 speech，而是提供一種 **phonetic / acoustic unit discovery** 工具：

- 可以用 learned codewords 檢查 transcript / audio alignment 是否合理。
- 可以拿 ABX / phone purity / PNMI 類 metric 來評估 speech representation 是否保留 phonetic content。
- 對 noisy web speech cleaning，DinoSR 類 units 可能可用於偵測 pronunciation outlier、ASR mismatch、silence / pause / phone distribution abnormality。
- 對 TTS training transcript format，這篇提醒我們：speech representation 應該保留 phone-level content，而不是只保留高層 semantic。

### project-generative-speech-representation-evaluation：高相關

這篇可當 speech representation evaluation project 的一個 baseline / inspiration：

- 它提供 discrete acoustic units，不是 codec reconstruction tokens。
- 它明確量測 representation 是否對齊 human phone units。
- 它同時報告 downstream ASR / SUPERB 和 unit interpretability。
- 它可以作為比較 `codec / VAE / SSL encoder / continuous latent` 的 content axis。

如果我們做 `Making Reconstruction FID Predictive of Diffusion Generation FID` 的 speech 版，DinoSR 類 representation 可作為 content-preserving encoder baseline；audio-iFID 不能只看 FAD，也應看 decoded / generated audio 經過 DinoSR / ASR / phone unit metrics 後是否 content consistent。

### project-full-duplex-data：低到中相關

DinoSR 本身不是 full-duplex / overlap paper，但可提供一個 frame-level acoustic unit layer，用來檢查分離後的 speaker A/B track 是否仍保留 phonetic units。限制是它主要針對單聲道 clean-ish speech SSL，不處理 overlap event、turn-taking、backchannel timing。

## Related papers in my pool

- [WavCube](https://arxiv.org/abs/2605.06407)：同樣是 continuous / SSL speech representation 路線，但更直接面向 understanding + reconstruction + generation。
- [Semantic-VAE](https://arxiv.org/abs/2509.22167)：speech VAE 的 dimension dilemma，和 DinoSR 的 phonetic unit preservation 可以互補。
- [On the Distillation Loss Functions of Speech VAE](https://arxiv.org/abs/2604.12383)：關心 speech VAE distillation/alignment loss 如何影響 reconstruction、understanding、generation。
- [VoxCPM / VoxCPM2](../../tools/openbmb-voxcpm/)：tokenizer-free TTS continuous latent candidate；可和 DinoSR 的 phone/unit metrics 一起評估 content fidelity。
- [HuBERT](https://arxiv.org/abs/2106.07447)：DinoSR 最直接對照之一，offline iterative clustering。
- [data2vec](https://arxiv.org/abs/2202.03555)：self-distillation continuous target baseline。

## OpenReview / reviewer discussion

找到 OpenReview forum：[https://openreview.net/forum?id=m5LSvWAI1N](https://openreview.net/forum?id=m5LSvWAI1N)，但 matched forum 沒有公開 review / rebuttal / decision notes。TeX source 使用 `neurips_2023` final style，因此此 note 以 NeurIPS 2023 記錄。

## 我該不該細讀

建議讀，尤其如果你要做 speech representation / tokenizer / VAE evaluation。

最值得讀：

- online clustering 的 codebook update。
- 為什麼它比 VQ 穩、比 HuBERT offline clustering 更 end-to-end。
- acoustic unit discovery 的 ABX / purity / PNMI 分析。
- codeword-phone mapping visualization。
- multilingual BABEL appendix。

這篇對生成模型的直接貢獻不是 TTS generator，而是提供一個「content / phone axis」的 representation learning 和 evaluation 工具。

## 可能的弱點 / open questions

- 主要 pretraining 是 English LibriSpeech；BABEL 只是 preliminary multilingual result。
- 作者自己也指出模型偏向 phonetic content，可能忽略 speaker / paralinguistic information。
- codewords 對 phone 有關，但 frame-wise phone error 仍高，不能直接當精準 phoneme recognizer。
- 只展示 Base model；沒有大規模 scaling law。
- 對 noisy speech、overlap speech、full-duplex dialogue 的 robustness 沒有直接驗證。
- 對 TTS / speech generation 的下游效果沒有直接測，例如用 DinoSR units 作為 TTS tokenizer 或 conditioning。

## Tags

- speech-ssl
- acoustic-unit-discovery
- online-clustering
- speech-representation
- speech-tokenizer
- self-distillation
- project-tts-data-pipeline
- project-generative-speech-representation-evaluation

## Concepts

- DinoSR
- self-distillation
- online clustering
- masked language modeling
- acoustic unit discovery
- codebook EMA
- pseudo-label clustering
- ABX error
- phone purity
- cluster purity
- phone-normalized mutual information
- codebook perplexity
- speech SSL
- discrete acoustic units

## Citation

```bibtex
@inproceedings{liu2023dinosr,
  title={DinoSR: Self-Distillation and Online Clustering for Self-supervised Speech Representation Learning},
  author={Liu, Alexander H. and Chang, Heng-Jui and Auli, Michael and Hsu, Wei-Ning and Glass, James R.},
  booktitle={Advances in Neural Information Processing Systems},
  year={2023}
}
```
