---
paper_key: arxiv_2505_19273
canonical_id: "arxiv:2505.19273"
title: "Eta-WavLM: Efficient Speaker Identity Removal in Self-Supervised Speech Representations Using a Simple Linear Equation"
year: 2025
venue: "Findings of ACL 2025"
url: "https://arxiv.org/abs/2505.19273"
pdf_url: "https://arxiv.org/pdf/2505.19273"
status: read
rating: 8
tags:
  - speech-representation
  - speaker-disentanglement
  - voice-conversion
  - self-supervised-speech
  - project-generative-speech-representation-evaluation
  - project-tts-data-pipeline
created: 2026-07-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`acl_latex.tex`) and ACL Anthology metadata. This is a speech representation / voice conversion paper, included because it gives a simple probeable example of speaker leakage removal from SSL representations.

## Links

- [Original URL](https://arxiv.org/abs/2505.19273)
- [arXiv abstract](https://arxiv.org/abs/2505.19273)
- [PDF](https://arxiv.org/pdf/2505.19273)
- [arXiv source](https://arxiv.org/src/2505.19273)
- [ACL Anthology](https://aclanthology.org/2025.findings-acl.127/)
- [Voice conversion demo](https://giuseppe-ruggiero.github.io/eta-wavlm-vc-demo/)

## 一句話總結

Eta-WavLM 提出一個非常簡單的 speaker disentanglement 方法：把 WavLM SSL representation 視為 `speaker-dependent component + speaker-independent component`，用 frozen speaker encoder 的 embedding 透過線性 least-squares 估出 speaker component，然後從 WavLM feature 中相減；結果 speaker classification accuracy 從 `82.30%` 降到 `55.73%`，並在 Any-to-One voice conversion 上同時改善 WER、target speaker similarity、source speaker leakage 和 MOS。

## 這篇在解決什麼問題

很多 speech downstream tasks 其實不希望 SSL representation 帶太多原始 speaker identity：

- voice conversion / TTS 需要保留 linguistic content，但 speaker identity 應該由 target speaker / prompt 控制。
- 如果 content encoder 裡殘留 source speaker，VC 或 TTS decoder 可能把 source timbre 混進 output。
- k-means / VQ 類 pseudo-unit 可以降低 speaker information，但常犧牲 content、prosody 或自然度。
- ContentVec、SoftVC、RepCodec、perturbation、utterance-level standardization 等方法有效，但有些需要額外 training、quantization、複雜 loss，或仍然殘留 speaker leakage。

這篇的主張是：不需要 fine-tune WavLM，也不需要訓練新的 neural disentangler；只要把 speaker embedding 到 SSL feature 的關係近似成線性映射，就能離線扣掉 speaker-dependent direction。

## 核心方法

方法有三個 frozen / offline components：

1. **SSL model**

   使用 frozen WavLM-Large，取第 15 層 hidden representation。每個 frame 是 `1024-dim`。

2. **speaker encoder**

   使用 frozen ECAPA-TDNN speaker encoder，輸出 `192-dim` speaker embedding。作者再用 PCA 降到 `128-dim`。

3. **linear disentanglement module**

   假設 SSL feature `s` 可以拆成：

```text
s = f(d) + eta
```

其中：

- `d` 是 speaker embedding。
- `f(d)` 是 speaker-dependent component。
- `eta` 是 speaker-independent representation，理想上保留 linguistic content、prosody、environment / recording condition 等非 speaker-specific information。

作者把 `f(d)` 設成線性函數：

```text
S = D^T A + 1 b^T
```

用 multi-speaker LibriSpeech training set 抽樣 frame，堆出 SSL matrix `S` 和 speaker embedding matrix `D`，再用 pseudo-inverse 解 `A*` 和 `b*`。

推論時：

```text
waveform
  -> WavLM layer-15 feature S
  -> ECAPA-TDNN speaker embedding e
  -> PCA speaker vector d
  -> eta = S - 1_K (d^T A* + b*)
```

這個 `eta` 就是 Eta-WavLM representation。

值得注意的是，這不是 adversarial training，也不是 information bottleneck；它比較像一個 cheap linear residualization / deconfounding step。

## Training / Data

### latent basis / bias estimation

- Dataset：LibriSpeech full training set，約 1,000 hours English speech。
- Hardware：single NVIDIA RTX 3090 24GB。
- SSL model：WavLM-Large official Hugging Face model。
- WavLM layer：第 15 層。
- SSL feature dim：`Q = 1024`。
- speaker encoder：SpeechBrain ECAPA-TDNN pretrained on VoxCeleb。
- speaker embedding dim：`V = 192`。
- PCA reduced speaker dim：`P = 128`。
- 每個 utterance 隨機 subsample `L = 100` frames 來估線性 mapping。

### speaker classification probe

- Dataset：LibriSpeech test-clean。
- 選 10 speakers，共 1,285 utterances。
- 對 WavLM 和 Eta-WavLM 各自訓練 multi-class SVM speaker classifier。
- 5-fold cross validation。
- metric：speaker classification accuracy，越低代表 speaker information 越少。

### voice conversion task

作者用 Any-to-One VC setup 評估 downstream usefulness：

```text
source speech
  -> content encoder: WavLM / Eta-WavLM / baselines
  -> acoustic model
  -> mel spectrogram of target speaker
  -> Vocos vocoder
  -> converted speech
```

target speakers：

- LJSpeech female speaker，約 24 hours，clean。
- Elliot Miller male speaker，從 M-AILABS 中取 24 hours，比 LJSpeech noisy / challenging。

比較的 content encoder：

- WavLM direct。
- Perturbation。
- Utterance-level standardization。
- Soft units。
- Vector quantization / RepCodec-style VQ。
- Proposed Eta-WavLM。

Evaluation：

- Intelligibility：WER by Whisper Medium，PER by phonemizer。
- Speaker similarity：Resemblyzer d-vector cosine similarity。
  - `T-SSIM` 越高越好，表示像 target speaker。
  - `S-SSIM` 越低越好，表示 source speaker leakage 少。
- Overall quality：20 native-language listeners 做 MOS。

## 主要結果

### 1. speaker information 明顯下降

10-way speaker classification：

- WavLM：`82.30 +/- 0.01`
- Eta-WavLM：`55.73 +/- 0.01`

作者也做 paired t-test：

- `T = 18.41`
- `p = 5.12e-5`

UMAP / PaCMAP visualization 也顯示 WavLM feature 會按 speaker cluster，Eta-WavLM 則不再有明顯 speaker cluster。

但注意：`55.73%` 對 10-way speaker classification 仍遠高於 chance `10%`，所以 speaker identity 沒有被完全消掉。

### 2. VC 上 content preservation 和 target speaker similarity 同時改善

LJSpeech target：

- WavLM direct：WER `4.56`，PER `5.84`，T-SSIM `89.52`，S-SSIM `52.77`，MOS `3.84 +/- 0.05`
- Eta-WavLM：WER `3.81`，PER `5.63`，T-SSIM `92.46`，S-SSIM `47.60`，MOS `4.00 +/- 0.05`

Elliot Miller target：

- WavLM direct：WER `5.14`，PER `6.38`，T-SSIM `86.18`，S-SSIM `54.30`，MOS `3.66 +/- 0.06`
- Eta-WavLM：WER `4.64`，PER `6.09`，T-SSIM `89.32`，S-SSIM `48.25`，MOS `3.79 +/- 0.05`

也就是 Eta-WavLM 不只是讓 source speaker information 變少，也讓 target speaker 更像、內容更穩、MOS 更高。

### 3. speaker encoder 和 PCA 很重要

Ablation 顯示 ECAPA-TDNN + PCA-128 最好：

- Resemblyzer w/o PCA：WER `4.94`，T-SSIM `89.02`，SPK ACC `74.01`
- WavLM-SV w PCA-128：WER `3.91`，T-SSIM `89.76`，SPK ACC `65.83`
- ECAPA-TDNN w PCA-128：WER `3.81`，T-SSIM `92.46`，SPK ACC `55.73`

這支持一個重要解釋：如果 speaker embedding 本身混入太多 content/prosody，線性相減會扣錯東西，傷害 content；好的 speaker encoder 和適度 PCA 可以讓被扣掉的 component 更接近 speaker-only direction。

## Project relevance

### project-generative-speech-representation-evaluation

高相關。這篇提供一個很清楚的 representation evaluation pattern：

```text
representation candidate
  -> speaker leakage probe
  -> downstream VC / TTS generator
  -> content WER + target speaker similarity + source speaker leakage + MOS
```

它和我們的 project thesis 很吻合：representation 不能只看 reconstruction，要看 downstream generator 是否更容易控制 speaker/content decomposition。

對 `Generative Speech Representation Evaluation`，Eta-WavLM 可以變成一個 baseline / diagnostic：

- 對任何 WavLM-derived latent，先量 speaker classifier accuracy。
- 用 linear residualization 扣掉 speaker component。
- 看 downstream TTS / VC / full-duplex generator 的 WER、speaker similarity、prosody、naturalness 是否改善。
- 對 interpolation alpha test，可用 Eta-WavLM 檢查「content-only path」和 speaker embedding path 是否真的分開。

### project-tts-data-pipeline

中度相關。這篇不是 data cleaning paper，但它提醒 TTS pipeline 的 representation cache 不應只保存 raw SSL feature。若 downstream target 是 voice cloning / controllable TTS，最好保存：

- content-oriented SSL representation。
- speaker embedding / reference speaker vector。
- source speaker leakage probe score。
- ASR WER / PER。
- target speaker similarity metric。

這對 dataset filtering 也有用：如果某些 utterance 的 content representation 仍能被 speaker classifier 高準確率辨識，代表 speaker leakage 很強，可能不適合當 speaker-independent content target。

### project-full-duplex-data

間接相關。full-duplex dual-channel generator 需要 speaker-wise content control：speaker A / B 的內容、speaker identity、backchannel、overlap timing 不應混掉。Eta-WavLM 的 linear residualization 可以用來嘗試拆開：

```text
speaker-specific identity vector
speaker-independent content/prosody/event representation
```

但它沒有處理 overlap speech，也沒有驗證 multi-speaker simultaneous audio；只能作為單 speaker utterance representation 的 building block。

## Related papers in my pool

- [WavCube](../arxiv_2605_06407/)：同樣是 WavLM-derived continuous representation，但 WavCube 目標是 compact semantic-acoustic latent for understanding/reconstruction/generation；Eta-WavLM 則專注 speaker identity removal。兩者可以結合：先做 compact latent，再測 speaker residualization 是否改善 downstream VC/TTS。
- [TASTE](../arxiv_2504_07053/)：TASTE 提供 text-aligned speech tokens；Eta-WavLM 提供 speaker-independent SSL feature。兩者可形成 paired-utterance benchmark：同一句話不同 speaker 時，TASTE 對齊 lexical positions，Eta-WavLM 測 word-local acoustic side-channel 是否仍有 speaker leakage。
- [DinoSR](../arxiv_2305_10005/)：DinoSR 也是 content/phonetic-oriented speech representation；可和 Eta-WavLM 比較 speaker leakage、ASR/VC/TTS usefulness。
- [NaturalSpeech 2](../arxiv_2304_09116/)：continuous latent diffusion TTS baseline；Eta-WavLM 可作 content encoder / leakage probe 的參考。
- [LongCat-AudioDiT](../arxiv_2603_29339/)：large-scale diffusion TTS / voice cloning；可借 Eta-WavLM 式 probe 評估 Wav-VAE latent 是否混入不該有的 source speaker identity。
- [DiTTo-TTS](../arxiv_2406_11427/)：zero-shot TTS representation comparison；可加入 speaker leakage probe，不只看 WER/SIM。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。這篇已有 ACL Anthology entry，venue 是 Findings of ACL 2025。

## 我該不該細讀

建議細讀，尤其是我們要做 speech representation / codec / VAE evaluation 時。

最值得讀：

- linear decomposition formulation。
- pseudo-inverse 解 latent basis / bias 的做法。
- speaker classification probe。
- VC evaluation table。
- speaker encoder + PCA ablation。

這篇不一定是最強模型，但它很適合當 project baseline，因為方法便宜、可重現、評估軸清楚，而且直接對應我們在乎的 `content vs speaker leakage`。

## 可能的弱點 / open questions

1. **speaker identity 沒有完全移除**

   Eta-WavLM 的 10-way speaker accuracy 還有 `55.73%`，遠高於 chance。它是 reduce leakage，不是 perfect disentanglement。

2. **方法依賴 speaker encoder quality**

   如果 speaker encoder 把 content/prosody/recording condition 也編進 embedding，linear subtraction 可能會扣掉有用資訊。

3. **只在 WavLM-Large 和 English 上驗證**

   多語、低資源、accented speech、emotional speech、noisy web audio 是否穩定還不清楚。

4. **沒有直接做 TTS / full-duplex**

   VC 是合理 proxy，但不等於 zero-shot TTS、speech LLM、dual-channel dialogue generation。

5. **linear assumption 可能太弱**

   它的優點是便宜和可解釋；但 speaker/content entanglement 可能是 nonlinear。作者也把 nonlinear disentanglement 留給 future work。

6. **speaker-independent 不代表 generation-friendly**

   Eta-WavLM 改善 VC，但還沒證明它比 WavCube、Semantic-VAE、codec latent 更適合 diffusion TTS 或 one-step generation。

## Tags

speech-representation, speaker-disentanglement, self-supervised-speech, WavLM, voice-conversion, speaker-leakage, project-generative-speech-representation-evaluation, project-tts-data-pipeline

## Concepts

- Eta-WavLM
- speaker identity removal
- speaker-independent representation
- WavLM layer-15 representation
- linear residualization
- pseudo-inverse latent basis
- speaker leakage probe
- ECAPA-TDNN speaker embedding
- PCA speaker embedding
- Any-to-One voice conversion
- source speaker similarity
- target speaker similarity
- content preservation

## Citation

ACL Anthology records this paper as Findings of ACL 2025.

```bibtex
@inproceedings{ruggiero-etal-2025-eta,
  title = "Eta-{W}av{LM}: Efficient Speaker Identity Removal in Self-Supervised Speech Representations Using a Simple Linear Equation",
  author = "Ruggiero, Giuseppe and Testa, Matteo and Walle, Jurgen Van De and Di Caro, Luigi",
  editor = "Che, Wanxiang and Nabende, Joyce and Shutova, Ekaterina and Pilehvar, Mohammad Taher",
  booktitle = "Findings of the Association for Computational Linguistics: ACL 2025",
  month = jul,
  year = "2025",
  address = "Vienna, Austria",
  publisher = "Association for Computational Linguistics",
  url = "https://aclanthology.org/2025.findings-acl.127/",
  doi = "10.18653/v1/2025.findings-acl.127",
  pages = "2494--2504"
}
```
