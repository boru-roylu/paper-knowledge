---
paper_key: arxiv_2605_22170
canonical_id: "arxiv:2605.22170"
title: "Do Factual Recall Mechanisms Carry over from Text to Speech in Multimodal Language Models?"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.22170"
pdf_url: "https://arxiv.org/pdf/2605.22170"
status: read
rating: 4
tags:
  - speech-llm
created: 2026-06-01
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2605.22170)
- [PDF](https://arxiv.org/pdf/2605.22170)

## 一句話總結
這篇用 Causal Tracing / Causal Mediation Analysis 比較 `SpiritLM` 在 text-to-text 與 speech-to-text 的 factual recall 機制，發現 speech 模態仍能觸發部分 factual localization，但訊號明顯比 text 弱很多。

## 這篇在解決什麼問題
作者想回答一個 mechanistic interpretability 問題：在 multimodal Speech Language Models（SLMs）裡，模型從 text 學到的 factual recall 機制，會不會也原封不動地轉移到 speech modality？

更具體地說，他們關心：
- factual knowledge 在 model internal activations 中是怎麼被 encode / store / retrieve 的
- text-only LLM 裡常見的 factual localization（特別是中層 MLP）是否也出現在 speech input 下
- multimodal model 的 speech path 是否只是 text path 的延伸，還是有顯著的 modality gap

## 核心方法
主要方法是把 text-model 常用的 `Causal Mediation Analysis (CMA)` / `Causal Tracing (CT)` 搬到 speech setting。

流程是三段式：
1. **Clean run**：輸入正常 prompt，記錄 hidden states 與正確答案機率。
2. **Corrupted run**：對 subject token 的表示加 noise，破壞 factual recall。
3. **Corrupted-with-restoration run**：在 corrupted input 上，把某個 component（例如 layer、MLP、attention）從 clean run patch 回來。

然後用：
- `Indirect Effect (IE) = P[x*, clean C_i][o] - P[x*][o]`
- 再對多個 prompts 平均成 `Average Indirect Effect (AIE)`

模組分析對象包括：
- transformer layers
- MLP sub-layers
- attention sub-layers

### multimodal 部分的關鍵設計
`SpiritLM` 使用：
- `discrete speech tokens`
- `modality declaration tokens`（`T` / `S`）
- `HuBERT` 做 audio discretization
- `Llama2` tokenizer 處理 text
- `HiFi-GAN` decode speech tokens

speech input 下，subject token 的定位不是直接可見，所以作者用 `CTC-based forced alignment` 把 transcript 對到 audio frame，再映射到 speech tokens，讓 causal tracing 可以跨模態對齊。

## Training / Data
這篇不是訓練新模型，而是做 interpretability analysis。

資料來源：
- `Known` dataset：大約 1000 個 factual prompts，原本是為 text-only factual recall 實驗設計
- 作者為每筆資料補上 speech counterpart，用 `MeloTTS` 生成 audio
- 再用 `Whisper-small` 自動轉錄檢查品質，prompt transcription 的 `WER = 19%`

為了只保留模型真的會的樣本，作者另外過濾出兩個子集：
- `Known-t2t`：text input 下模型能答對或近似答對
- `Known-s2t`：speech input 下模型能答對或近似答對

實驗設定：
- `T -> T`：text input、text output
- `S -> T`：speech input、text output

## 主要結果
核心發現可以濃縮成三點：

1. **SpiritLM 的 T->T 路徑幾乎和 text-only backbone 一樣**
   - causal signals 仍然集中在 subject tokens
   - 特別是 mid-layer MLP 出現明顯高 AIE
   - 表示 speech fine-tuning 後，原本的 text-based factual computation pathways 大致保留

2. **S->T 時 factual localization 仍存在，但很弱、很分散**
   - AIE 大幅下降
   - 訊號更 diffuse、magnitude 更低
   - 但在 MLP 和 attention 仍可看到 subject token 附近的痕跡

3. **結論是 partial carry-over，而非完整 modality-invariant**
   - speech input 可以觸發某些 factual recall
   - 但 text 是更穩定、更強的 trigger
   - 作者推測原因可能是 `semantic gap`、post-training speech adaptation 的限制，或 discrete speech token mapping 的資訊損失

## Project relevance
- **project-full-duplex-data**：low
- **project-tts-data-pipeline**：high

## Related papers in my pool
目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
**如果你在做 speech LLM / multimodal mechanistic interpretability，值得細讀。**  
這篇的價值主要在方法轉譯：把 text-only 的 causal tracing / activation patching 系統性搬到 speech input，還處理了 cross-modal token alignment 問題。

如果你的重點是：
- speech-based factual recall
- text/speech modality gap
- mechanistic analysis of SLMs

那這篇很有參考價值。  
如果你主要關心的是資料管線、TTS 清洗、overlap detection 或 transcription filtering，這篇只有間接相關。

## 可能的弱點 / open questions
- **資料集偏單一**：只測 `Known` 與其合成 speech 版本，泛化到其他 factual QA 資料未必成立。
- **模型偏單一**：只看 `SpiritLM`，不確定其他 discrete-speech-token SLM 是否同樣現象。
- **speech alignment 可能引入誤差**：`CTC-based forced alignment` 與 token-to-audio mapping 本身就可能影響 causal attribution。
- **只看 discrete speech tokens**：若換成 continuous speech representation，結果可能不同。
- **因果結論有限**：只能說 speech 模態下 recall mechanism 較弱，還不能確定是 noise、alignment error，還是 intrinsic modality gap。
- **資料是 synthetic speech**：`MeloTTS` 生成的音訊是否能代表真實 spoken dialogue，仍有落差。
- **只做 factual recall**：沒有測其他語言理解/生成現象，無法判斷這種 partial carry-over 是否普遍。

## Tags
- mechanistic interpretability
- Causal Mediation Analysis
- Causal Tracing
- Speech Language Models
- multimodal LLM
- factual recall
- modality gap
- discrete speech tokens
- forced alignment
- activation patching

## Concepts
- `Causal Mediation Analysis (CMA)`
- `Causal Tracing (CT)`
- `Indirect Effect (IE)`
- `Average Indirect Effect (AIE)`
- `activation patching`
- `transformer layer`
- `MLP`
- `attention sub-layer`
- `discrete speech tokens`
- `modality declaration tokens`
- `HuBERT`
- `HiFi-GAN`
- `CTC-based forced alignment`
- `semantic gap`
- `speech-to-text (S->T)`
- `text-to-text (T->T)`

## Citation
```bibtex
@article{modica2026dofactualrecallmechanismscarry,
  title={Do Factual Recall Mechanisms Carry over from Text to Speech in Multimodal Language Models?},
  author={Modica, Luca and Landin, Filip and Farahani, Mehrdad and Qian, Livia and Skantze, Gabriel and Johansson, Richard},
  year={2026},
  journal={arXiv preprint},
  eprint={2605.22170},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```
