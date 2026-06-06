---
paper_key: arxiv_2603_25750
canonical_id: "arxiv:2603.25750"
title: "Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.25750"
pdf_url: "https://arxiv.org/pdf/2603.25750"
status: read
rating: 5
tags:
  - speech-llm
  - audio-data
  - diarization
  - preprocessing
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-30
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`
- Deep review update: `gpt-5`
- Source used: arXiv TeX source, appendix tables, project page, and official GitHub.

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2603.25750)
- [PDF](https://arxiv.org/pdf/2603.25750)
- [TeX source](https://arxiv.org/src/2603.25750)
- [Project page / demo](https://kyudan1.github.io/sommelier.github.io/)
- [Official GitHub: naver-ai/sommelier](https://github.com/naver-ai/sommelier)

## 一句話總結
**Sommelier** 是一條針對 full-duplex Speech Language Models 的 open multi-turn audio preprocessing pipeline：它把 in-the-wild podcast / radio-style mono conversational audio 轉成 speaker-structured、overlap-aware、word-timestamped 的訓練資料，核心精神是 **保留 overlap / backchannel，而不是把它們當 noise 刪掉**。

## 這篇在解決什麼問題
這篇在解決 full-duplex SLM 的資料瓶頸：模型需要學會 simultaneous listening/speaking、backchannel、overlap、interruption、turn-taking，但現有大規模 speech datasets 多半是 single-speaker、read speech、monologue，或是把 overlap 當成污染處理。

作者的問題定義很貼近我們的 project：

- real dialogue 中有 short utterances、backchanneling、speaker changes、overlap speech。
- web audio 還有 BGM、noise、silence、clipping、low volume。
- diarization error 會直接造成 speaker/channel 錯配。
- ASR hallucination 會把 training label 污染，讓 downstream SLM 學到重複、亂補字、或 off-audio transcript。
- 如果處理流程太慢，就算方法好也無法擴展到萬小時級資料。

所以 Sommelier 不是一般 ASR cleaning pipeline。它的目標是：**從單軌、不乾淨的 conversational audio 中，盡量恢復可用於 full-duplex training 的 speaker-wise structure。**

## 核心方法
Sommelier 是 modular pipeline，可開關不同模組，在 data purity 與 conversational authenticity 間取捨。

### 1) Audio standardization
先把來源音訊統一成：

- 16 kHz
- 16-bit
- mono
- loudness normalization 到 `-20 dBFS`

這一步本身不新，但它確保後面的 VAD、diarization、separation、ASR 在同一個音訊規格下工作。

### 2) VAD + chunking + Sortformer diarization
長音訊先用 silence / VAD 切成小於 5 分鐘的 chunks，避免 diarization OOM，同時盡量保留 conversational context。

diarization 選 **NVIDIA Sortformer**，不是常見的 Pyannote 3.1。原因不是 global DER 稍好而已，而是 Sortformer 在 full-duplex 最重要的短 utterance / rapid turn-taking 上明顯更穩。

VoxConverse common subset 結果：

- Pyannote 3.1：DER 8.40、JER 17.68、DER <=1s 20.21、turn DER 0.051
- Sortformer：DER **7.16**、JER **14.69**、DER <=1s **16.87**、turn DER **0.006**

對我們來說，這代表 diarization 評估不能只看 overall DER，還要看：

- short backchannel DER
- turn-boundary DER
- overlap-adjacent speaker confusion

### 3) Overlap handling: Case 4 + two-speaker separation
作者把 overlap / backchannel 處理分成四類。前幾種要嘛切掉 overlap、要嘛把 overlap 指派給其中一邊，這會造成 utterance loss 或 ASR 混雜。Sommelier 選 **Case 4**：允許兩個 speaker segment 都保有 overlap，再在 overlap interval 做 two-speaker separation。

具體流程：

1. 從 non-overlap 區段抽出兩位 speaker 的 reference embeddings。要求 non-overlap reference 至少 2 秒。
2. 只把 overlapped interval 送進 SepReformer-style two-speaker separation，而不是把整段送進 separation。作者觀察只處理 duplicated overlap part 效果較好。
3. separation 產生 `candidate1`, `candidate2`。
4. 用 speaker embedding cosine similarity 把 candidates 對回原 speaker。
5. 把 separated overlap pieces 接回各自 speaker stream。

這個 design 對我們的主線非常重要：它不是「denoise」，而是把 mono-channel overlap 轉成可訓練的 pseudo dual-channel / speaker-wise tracks。

### 4) Background music removal
針對 radio / podcast / drama audio 的 BGM：

- 用 **PANNs** 偵測 BGM probability。
- threshold > 0.3 才跑 **Demucs** 抽 vocal track。
- 為了效果，Demucs 不是只處理短 segment，而是吃完整 2-minute audio context，再回切需要的片段。
- 作者考慮過 SAM-Audio，但因 A100 RTF 0.73 太慢而排除。

這裡的實用訊號是：music removal 會傷 speech quality，所以要 selective，不要無腦全跑。

### 5) Ensemble ASR + hallucination filtering
ASR 用三個模型做 ROVER ensemble：

- Whisper-large-v3
- Canary
- Parakeet

策略是 word-level alignment + voting：

- 如果至少兩個模型同意某 word，就接受。
- 否則 fallback 到 primary backbone Whisper，維持 consistent style。
- 再用 `RepetitionFilter` 移除過度 n-gram repetition：`n=15`, count >= 5。
- 另外用 Whisper / WhisperX 取 word-level timestamps。

這個設計的意義是降低 Whisper 在 silence / noise / low-volume / BGM 區段的 hallucination，避免 downstream model 學到「音訊裡沒有但 transcript 裡有」的內容。

**ROVER 評論：**這篇有把 ASR ensemble 當成 pipeline component 做實驗，證明最後的 ensemble transcript 比單用 Whisper-large-v3 更穩；但它沒有做一個很乾淨的 ablation 去分離「ROVER voting algorithm 本身」和「多個 ASR backbone 互補」各自的貢獻。換句話說，我們可以說 Sommelier 的 ROVER-style ensemble 有實用收益，尤其是降低 noisy / BGM / silence 下的 hallucination；但不能過度解讀成作者已經證明 ROVER 比所有其他 ensembling / confidence selection 方法都好。

### 6) Context captioning
附錄提到用 **Qwen3-Omni-Captioner** 產生 richer metadata，例如 emotion、gender、age group、situation description。

有一個細節值得注意：短 segment 單獨 caption 容易失去 context，例如 sarcasm。因此作者用前兩段 audio 作 in-context prompt，生成當前 segment caption。這對我們未來做 dual-channel generator 很有用，因為 generator 可能需要 style / emotion / situation metadata，而不只是 text。

## Training / Data
### Pipeline output
GitHub README 和 appendix JSON 顯示 Sommelier output 不是單純 transcript，而是一個 segment-level JSON。每段包含：

- `start`, `end`
- `speaker`
- ensemble `text`
- `text_whisper`, `text_parakeet`, `text_canary`
- `language`
- `demucs`
- `is_separated`
- `sepreformer`
- word-level timestamps：`word`, `start`, `end`, `score`
- optional `qwen3omni_caption`
- processing metadata / RTF

這對我們的 data format 有直接啟發：如果目標是 `mono-channel dialogue -> dual-channel training data -> dual-channel generator`，Sommelier 的 JSON 還不夠，需要再加：

- `channel`: left / right
- `overlap_with`: utterance ids
- `event`: backchannel / interruption / repair / hesitation
- `source_type`: original / separated / denoised / synthetic
- `speaker_confidence`, `separation_confidence`, `asr_confidence`

### Moshi fine-tuning validation
作者用 Sommelier processed data fine-tune `moshiko-pytorch-bf16`，不是要提出新 model，而是驗證資料是否真的改善 full-duplex behavior。

重要 training constraints：

- LoRA fine-tuning
- total data duration：約 **83 hours**
- training steps：2,000
- hardware：8 x A100
- LoRA rank：128
- batch size：16
- learning rate：2e-6
- weight decay：0.1
- 每個 turn 最長不超過 10 秒
- valid region 至少要有 3 個連續 turns
- 若遇到超過 10 秒的 utterance 就截斷 region
- stereo training data 左聲道只放單一 speaker

最關鍵的觀察：**single speaker 持續講超過 1 分鐘會讓 Moshi training loss 不穩，甚至讓模型變得 unresponsive。** 這表示 full-duplex training data 不能只是「長對話音檔」，而要控制 turn density、speaker switching 和 event distribution。

## 主要結果
### 1) Diarization：Sortformer 更適合 short utterances / turn boundaries
Sortformer 相對 Pyannote 3.1 在 VoxConverse 上整體較好，但真正關鍵是 short utterance 和 turn-taking region：

- DER <=1s：20.21 -> **16.87**
- turn DER：0.051 -> **0.006**

這對 backchannel / interruption 很重要，因為這些事件常常很短。若 diarization 漏掉短 utterance，後面再好的 generator 都學不到。

### 2) Overlap separation：overlap ratio 越高，改善越大
作者用 LibriSpeech 合成 900 個 two-speaker mixture，控制：

- SIR：0 / 5 / 10 dB
- overlap ratio：0.2 / 0.5 / 1.0

結果重點：

- 0 dB, overlap 1.0：WER 48.9 -> **15.6**，UTMOS 1.70 -> **3.02**
- 5 dB, overlap 1.0：WER 52.5 -> **9.1**，UTMOS 1.79 -> **3.12**
- 10 dB, overlap 1.0：WER 51.0 -> **13.8**，UTMOS 2.17 -> **3.01**

附錄強調改善對 secondary / interfering speaker 特別大。例如 0 dB、full overlap 時 Speaker 2 WER 從 0.444 降到 0.138。這對 full-duplex 很關鍵，因為 backchannel / interrupting speaker 常常就是 quieter / secondary speaker。

### 3) ASR ensemble：降低 noisy / BGM / hallucination failure
相對 Whisper-large-v3：

- LibriSpeech test-clean：3.63 -> **2.04**
- LibriSpeech test-other：6.26 -> **3.92**
- TEDLIUM3 test：12.19 -> **10.66**

代價是 inference time 約 3x。作者指出 bottleneck 主要是 Canary，且三模型同時載入/推理有額外 overhead。

要注意這組實驗驗證的是 **Sommelier ASR ensemble module** 的整體效果，而不是單獨驗證 ROVER。因為對照組是 Whisper-large-v3，實驗同時改了兩件事：從 single ASR 變成 Whisper / Canary / Parakeet 三模型互補，也加入 word-level voting / fallback。對我們的 pipeline 設計，這仍然有價值：若目標是 data cleaning，第一優先是降低 transcript hallucination 和 content mismatch；但若要研究最佳 ASR fusion 方法，還需要額外比較 confidence-based selection、oracle-best model、majority voting、ROVER variants、以及 LLM transcript repair。

### 4) Full-Duplex-Bench 1.0：83 hours processed data 已能改變 Moshi 行為
Moshi + Sommelier 在 FDB 1.0：

- Backchannel TOR：1.000 -> **0.291**，表示不再把 backchannel window 當作完整 turn 接管。
- Backchannel frequency：0.001 -> **0.052**，表示模型真的開始產生 backchannel。
- Backchannel JSD：0.957 -> **0.630**，timing distribution 更像 human。
- Smooth turn-taking Candor TOR：0.941 -> **1.000**。
- User interruption GPT-4o relevance：0.765 -> **3.684**。

但也有 trade-off：

- Pause Handling 幾乎沒改善，甚至 TOR 仍接近 1.0。
- User Interruption TOR 從 1.000 降到 0.858，但 relevance 大幅提高。
- Latency 變高，作者認為 base Moshi 低 latency 是因為它沒有真的處理 user input，而不是行為更好。

### 5) Full-Duplex-Bench 1.5：overlap handling / latency 有更清楚改善
FDB 1.5 裡 fine-tuned Moshi 在 four overlap scenarios 上多數 audio-quality 和 latency 指標顯著改善。

例子：

- Background Speech：STOI 0.79 -> **0.98**，PESQ 2.19 -> **3.33**，SI-SDR 5.43 -> **20.76**
- User Backchannel：STOI 0.63 -> **0.91**，PESQ 1.60 -> **3.01**，SI-SDR -6.57 -> **16.48**
- User Interruption response latency：1.99s -> **0.66s**
- Background Speech response latency：2.90s -> **0.73s**

這些結果支持一個結論：即使只用 83 hours processed data，資料 recipe 也能顯著改變 full-duplex behavior。

### 6) Throughput：可到 web-scale
單一 A100 80GB、120 秒 audio sample：

- VAD + Sortformer：RTF 0.0159
- SepReformer separation：RTF 0.0013
- ASR ensemble：RTF 0.1159
- FlowSE denoising：RTF 0.0416
- Total：RTF **0.1746**

拿掉 optional FlowSE 後 total RTF 約 **0.133**。因 peak memory 約 23GB，可在一張 A100 上跑 3 concurrent processes，等效 RTF 約 **0.0443 / GPU**。作者估計 8 張 A100 處理 10,000 hours 約 55 小時。

## Project relevance
**project-full-duplex-data：極高相關。**

這篇就是我們「mono-channel dialogue -> speaker-wise / dual-channel data」路線裡最直接的 engineering blueprint。它沒有完全解決 dual-channel audio generator，但它回答了上游最關鍵的問題：

- 如何從 single-stream in-the-wild dialogue 保留 overlap / backchannel。
- 如何把 overlap region 拆成 speaker-wise tracks。
- 如何避免 diarization / ASR hallucination 污染 training data。
- 如何把 output 做成可訓練 full-duplex model 的 structured segments。
- 如何用 downstream Moshi fine-tuning 驗證資料是否真的影響 full-duplex behavior。

**project-tts-data-pipeline：中到高度相關。**

Sommelier 偏 SLM / full-duplex，不是一般 TTS pipeline。但它的 speaker/event/time-aligned transcript、ASR ensemble、BGM filtering、captioning 都可以直接借到 dialogue TTS / dual-channel TTS data construction。

## 對我們的 mono -> dual -> generator project 的具體結論
Sommelier 和我們的關係不是「evaluation paper」，而是 **data production baseline**。

我們可以把它放在第一段箭頭：

```text
mono-channel dialogue
  -> Sommelier-style diarization + overlap separation + ASR ensemble
  -> speaker-wise pseudo dual-channel records
  -> train dual-channel audio generator
```

但 Sommelier output 還需要補幾個欄位才適合 generator：

- channel assignment：left/right 或 speaker track id。
- explicit overlap graph：哪個 utterance 跟哪個 utterance overlap。
- event labels：backchannel / interruption / repair / hesitation。
- source confidence：哪些片段是 separated、哪些是 clean non-overlap。
- training role：real distribution sample vs stress-test sample。

Evaluation 的位置則是在 Sommelier 後面做 QA：

- separation 是否保留 both speakers。
- backchannel 是否被刪掉。
- speaker 是否 swap。
- transcript 是否和各 speaker channel 對齊。
- overlap timing 是否仍在原位置。

所以 Sommelier 給 pipeline，AnyAudio-Judge / rubric checks 給 QA，dual-channel generator 是 downstream consumer。

## Related papers in my pool
- [DialogueSidon](/papers/arxiv_2604_09344/)：和 Sommelier 最互補。DialogueSidon 更像 model-based restoration/separation；Sommelier 更像 scalable preprocessing pipeline。若要做 mono -> dual，應該把兩者當 baseline。
- [Full-Duplex-Bench-v3](/papers/arxiv_2604_04847/)：Sommelier 用 FDB 1.0 / 1.5 驗證 Moshi；FDB-v3 則把 disfluency + tool-use 帶進更接近 voice agent 的設定。
- [PersonaPlex](/papers/arxiv_2602_06053/)：Sommelier 引用它，且 pause handling failure 被作者猜測可能和缺 prompt audio / architecture 有關；PersonaPlex 的 prompt audio / role-voice conditioning 可能是後續補法。
- [LLM-Enhanced Dialogue Management](/papers/arxiv_2502_14145/) / [SoulX-Duplug](/papers/arxiv_2603_14877/)：這兩篇是 runtime policy / semantic VAD；Sommelier 是 data side。兩邊應該接起來：用 Sommelier 產生 control-token training data。
- [WhisperD / Parakeet](/tools/jordandarefsky-parakeet-whisperd/)：WhisperD 提供 speaker/event transcript style；Sommelier 提供 time-aligned processing pipeline。兩者結合後更接近我們需要的 training format。

## OpenReview / reviewer discussion
- [OpenReview summary](./reviews/openreview-summary/)

未找到公開 review/rebuttal notes；OpenReview forum metadata 有匹配頁，但目前沒有可摘要的公開 review 內容。

## 我該不該細讀
**應該細讀，而且是 full-duplex data project 的第一優先 paper 之一。**

建議細讀順序：

1. Method 的 `Handling Overlapping Speech`。
2. Appendix 的 overlap cases，理解 backchannel fully-contained overlap vs partial overlap。
3. Output JSON example，反推我們自己的 dual-channel training schema。
4. Fine-tuning data constraints：turn <= 10s、至少 3 turns、長 single-speaker turn 會讓 Moshi 失穩。
5. ASR ensemble 和 RepetitionFilter，設計 transcript QA。

如果只讀一個 takeaway：**full-duplex data cleaning 不能把 overlap 清掉；要把 overlap 轉成可訓練的 speaker-wise evidence。**

## 可能的弱點 / open questions
- **仍不是真正 isolated dual-channel ground truth**：overlap separation 會有 artifact，品質低於 oracle isolated channels。
- **two-speaker assumption 偏強**：overlap module 主要是 two-speaker separation；more speakers / group conversation 不一定可直接用。
- **speaker identity matching 依賴 non-overlap reference**：如果某 speaker 幾乎只在 overlap 裡出現，或 reference <2s，speaker assignment 會變弱。
- **event labeling 不足**：pipeline 保留 backchannel / overlap，但沒有直接輸出 backchannel、repair、hesitation、interruption labels；我們需要額外 classifier / heuristic / LLM labeler。
- **ASR ensemble 成本高**：ASR 是主要 RTF bottleneck，三模型 ensemble 對超大規模資料仍有成本。
- **Pause handling 沒改善**：代表資料 pipeline alone 可能不足，還需要 architecture / prompt audio / control-token supervision。
- **evaluation 仍偏 FDB / Moshi**：是否能泛化到我們自己的 dual-channel generator，需要重新做 generator-side metrics。
- **non-speech events 覆蓋有限**：對 environment sound / laughter / breath / room tone 的處理沒有像 PlanAudio / AnyAudio-Judge 那樣細。
- **ethical / consent risk**：high-fidelity conversation data 可能被用於 voice cloning；實際建庫需要 consent / provenance / license policy。

## Tags
- full-duplex
- speech-language-model
- data-preprocessing
- speaker-diarization
- overlap-separation
- backchanneling
- turn-taking
- ASR-ensemble
- hallucination-filtering
- web-scale-pipeline
- project-full-duplex-data
- project-tts-data-pipeline

## Concepts
- full-duplex SLM
- mono-channel conversational audio
- speaker-wise track recovery
- overlap disentanglement
- backchannel preservation
- Sortformer diarization
- SepReformer separation
- speaker embedding identity matching
- PANNs music detection
- Demucs vocal extraction
- ROVER ASR ensemble
- Whisper / Canary / Parakeet
- RepetitionFilter
- word-level timestamps
- context-aware audio captioning
- Moshi LoRA fine-tuning
- Full-Duplex-Bench 1.0 / 1.5
- turn density filtering
- Real-Time Factor (RTF)

## Citation
```bibtex
@article{jung2026sommelierscalableopenmultiturn,
  title={Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models},
  author={Jung, Kyudan and Kim, Jihwan and Kim, Soyoon and Kim, Jeonghoon and Choo, Jaegul and Park, Cheonbok},
  journal={arXiv preprint},
  year={2026},
  arxiv={2603.25750}
}
```
