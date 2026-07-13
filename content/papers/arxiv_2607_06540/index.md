---
paper_key: arxiv_2607_06540
canonical_id: "arxiv:2607.06540"
title: "Hierarchical Acoustic-Semantic Modeling: Modality Separation and Semantic Coherence for Full-Duplex SLMs"
year: 2026
venue: "ACL 2026"
url: "https://arxiv.org/abs/2607.06540"
pdf_url: "https://arxiv.org/pdf/2607.06540"
status: read
rating: 9
tags:
  - speech-llm
  - full-duplex
  - modality-interference
  - acoustic-semantic-modeling
  - turn-taking
  - backchannel
  - interruption
  - project-full-duplex-data
  - project-audio-model-evaluation
  - project-tts-data-pipeline
created: 2026-07-13
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `body/*.tex`, `tables/*.tex`), with public web checks for ACL Anthology, GitHub, project page, Hugging Face, and OpenReview status on 2026-07-13.

## Links
- [Original URL](https://arxiv.org/abs/2607.06540)
- [arXiv abstract](https://arxiv.org/abs/2607.06540)
- [PDF](https://arxiv.org/pdf/2607.06540)
- [arXiv source](https://arxiv.org/src/2607.06540)
- [ACL Anthology PDF](https://aclanthology.org/2026.acl-long.419.pdf)
- [Official GitHub repo](https://github.com/HITsz-TMG/Lychee-FD)
- [Hugging Face model](https://huggingface.co/HIT-TMG/Lychee-FD)
- [Project page](https://hitsz-tmg.github.io/Lychee-FD)
- [OpenReview forum](https://openreview.net/forum?id=iZ2y0sqJJD)

## 一句話總結
Lychee-FD 指出 native full-duplex SLM 的核心瓶頸不是單純缺資料或 latency，而是 acoustic modeling 和 semantic modeling 在深層 shared parameter space 裡產生 gradient conflict；它用 hierarchical parameter separation 把深層分成 Semantic / Acoustic / Control heads，再用 semantic alignment channel 保住內部文字語義，因此同時提升 full-duplex interaction fluidity 和 speech QA intelligence。

## 這篇在解決什麼問題
full-duplex spoken dialogue model 要同時聽使用者、生成自己的語音、判斷要不要停止、插入 backchannel、處理 interruption。傳統 half-duplex SLM 只能「先聽完再說」，自然度不夠；system-level full-duplex pipeline 用 VAD 或外部 dialogue manager 可以處理打斷，但 latency 與 error propagation 會上升；native end-to-end full-duplex model 則容易在共同 backbone 中把 acoustic generation 和 semantic reasoning 混在一起，造成知識能力下降。

這篇把問題命名為 modality interference。作者的細讀點是：full-duplex model 裡 speech token 很密，text token 很稀。若把 text supervision 用 padding 對齊到 dense audio frames，semantic gradients 會被稀釋；若 acoustic loss 和 semantic loss 共享所有深層參數，兩者 gradient 在深層會從正相關變成 orthogonal / negative，導致 optimization divergence。

所以它不是只提出一個新架構，而是先提出一個可量化診斷：看 layer-wise gradient cosine similarity 和 text/speech gradient magnitude ratio，判斷 full-duplex SLM 為什麼變笨、為什麼語音生成和語義推理互相傷害。

## 核心方法

### 1) Optimization dynamics analysis
作者用 StepAudio-2-mini 初始化一個 native CDM architecture，對訓練集 1K samples 做 forward/backward，但不更新參數，分別累積 text token generation loss 和 speech token generation loss 的 gradients。

它們看兩個量：

- Gradient cosine similarity：淺層 0-9 層 text / speech gradients 是 positive，表示低層 acoustic-language processing 可共享；深層相似度急降甚至變 negative，表示 semantic reasoning 和 acoustic rendering 開始互相衝突。
- Gradient magnitude ratio：text 約 3 Hz、audio 約 25 Hz。若用 padding 把 text 對齊 audio frame，semantic supervision 變稀，gradient magnitude 被 speech modeling 壓過，造成 semantic dilution。

這個分析對我們很重要，因為它暗示 full-duplex model 的設計不能只想「把 dual-channel audio 和 transcript 丟進同一個大模型」。我們要關心不同 supervision 在時間密度、loss magnitude 和 layer depth 上如何互相競爭。

### 2) Hierarchical parameter separation
Lychee-FD 保留 shallow shared backbone，讓低層學共同 acoustic-language features；到了 deep layers，拆成三個 parallel heads：

- Semantic Head：負責 text / semantic generation。
- Acoustic Head：負責 speech token generation。
- Control Head：負責 interaction management，例如 start / stop / interruption control。

這個設計不是 Thinker-Talker 那種完全拆成多模型 pipeline，而是在同一個 native end-to-end model 中做深層參數分離。目標是保住原本 model depth 和 inference efficiency，同時避免 acoustic / semantic objectives 在深層互相破壞。

### 3) Semantic alignment channel
為了解決 semantic dilution，模型訓練時額外產生 coherent internal monologues，也就是一條 text semantic channel。它讓 language modeling objective 持續有 dense / high-magnitude supervision，而不是只靠 sparse time-aligned text tokens。

這是本文最值得借鑑的設計之一：full-duplex audio generation 不能只靠 audio tokens；如果我們想要模型在 overlap / backchannel / interruption 裡仍然懂語義，需要保留明確的 semantic scaffold。

### 4) Real-time inference: DAG pipeline parallelism
附錄說 Lychee-FD 為 multi-head architecture 客製 vLLM，使用 Directed Acyclic Graph Pipeline Parallelism (DAG-PP)。shared backbone 的 hidden states 會 broadcast 到 Semantic / Acoustic / Control heads，讓三個 heads 在不同 GPU 上並行執行，再同步 logits。

這讓 hierarchical split 不一定帶來 critical path 變深。對 full-duplex 系統很重要，因為 interruption response latency 不只看模型是否答對，也看 control signal 能不能夠早產生。

## Training / Data
作者指出 open-source full-duplex datasets 很少，因此自己做 automated synthesis pipeline，最後得到約 140K full-duplex dialogue instances。

資料合成涵蓋三種行為：

- Interruptions：使用者中途打斷，例如 correction、deeper inquiry、topic shift、strong emotional reaction、impatience。
- User Backchannels：使用者在 AI 說話時給「uh-huh」「gotcha」等短回饋。
- AI Backchannels：AI 在使用者說話時給 active listening signal。

pipeline 包含多個 agents：

- User Agent：有 persona 和 speaking style，19 種風格，例如 concise / impatient / humorous 等。
- Assistant Agent：根據 conversation history 產生 AI response。
- Reviewer Agent：檢查 persona consistency、interruption event quality、backchannel naturalness、logical flow。

語音合成使用 CosyVoice 2，搭配 80K predefined voice prompts 做 zero-shot cloning。最後過濾 logical inconsistency 和 low audio quality。

模型訓練：

- Backbone：StepAudio-2-mini。
- Input audio encoder：Whisper-v3-large encoder。
- Acoustic output tokenizer：CosyVoice2 tokenizer，25 Hz speech tokens。
- Training：AdamW + cosine LR scheduler。
- Hardware：8 NVIDIA H20 GPUs。
- Global batch size：32。
- Learning rate：3e-6。
- Warmup ratio：0.1。
- Train 1 epoch，約 16 hours。
- Inference：greedy sampling for text and speech token generation。
- Architecture：24 shared Transformer layers；text head 4 layers、speech head 4 layers、control head 2 layers；約 10B total parameters。

## 主要結果

### 1) Spoken Question Answering
在 LlamaQ、WebQ、TriviaQA 的 spoken QA 上，Lychee-FD 同時評估 speech-to-text (S->T) 和 speech-to-speech (S->S) accuracy。

平均結果：

- Lychee-FD：S->T 51.5、S->S 46.2、TOR 100。
- StepAudio-2-mini half-duplex：S->T 51.3、S->S 40.9。
- Fun-Audio-Chat：S->T 42.7、S->S 38.8。
- VITA 1.5：S->T 50.8、S->S 35.4。

作者強調 Lychee-FD 比 previous SOTA native full-duplex Fun-Audio-Chat 在 S->S 平均 accuracy 高 7.4%，在 S->T 高 8.8%。更重要的是，它沒有比 half-duplex backbone 笨，反而在 S->S 比 StepAudio-2-mini 高 5.3%。

### 2) Ablation：semantic channel 和 parameter separation 都必要
Spoken QA ablation：

- Full Lychee-FD：Avg S->T 51.5、S->S 46.2。
- w/o Sem-Channel：Avg S->T 45.9、S->S 40.8。
- w/o Param-Sep：Avg S->T 46.1、S->S 27.6。

移除 semantic alignment channel 造成 semantic dilution，S->T / S->S 都下降。移除 hierarchical parameter separation 後，S->S 掉到 27.6，表示 speech generation 被嚴重傷害。這支持作者的主張：深層 acoustic / semantic gradients 需要物理分離。

### 3) Full-duplex interaction
在 FDBench、FullDuplexBench 1.0、FullDuplexBench 1.5 上，Lychee-FD 在多數 interaction 指標取得最佳。

關鍵數字：

- FDBench：SRR 86.3、SIR 99.7、EIR 0.4、SRIR 95.8、FSED 637 ms、IRD 1210 ms。
- FullDuplexBench 1.0：I-TOR 94.5、B-Freq 14.6、B-TOR 23.4、T-TOR 98.3、P-TOR 10.0、Stop 840 ms。
- FullDuplexBench 1.5：IRR 78.0、BRR 69.0、Stop 570 ms、Latency 826 ms。

作者說 Lychee-FD 在 11 個 interaction metrics 中 10 個達到 SOTA，並在 FullDuplexBench 1.5 比 system-level baselines 有 28.5% average improvement。

### 4) Speech quality
在 LlamaQ speech generation quality 上，作者用 WER 衡量 content consistency，用 UTMOS 衡量 naturalness。Lychee-FD 的 UTMOS 報告為 4.50，高於 Freeze-Omni、Moshi 和 half-duplex backbone。作者把這歸因於 acoustic head 不再被 semantic objective 干擾，因此 prosodic detail 保留更好。

### 5) Known failure：side-talk
附錄 error analysis 提到，模型對任何 user barge-in 很敏感，但在 open-mic multi-speaker scenario 中，可能把使用者對第三方說話的 side-talk 誤判成對 agent 的 interruption，然後停止或回應不該回應的內容。

這對我們的 data project 非常重要：只做 two-party direct interaction synthesis 不夠。full-duplex data 必須有「intent annotation」和 multi-speaker side-talk / background speech，否則模型只會學到「有聲音就停」。

## Project relevance

### project-full-duplex-data：非常高相關
這篇幾乎直接命中我們的核心方向。它說 full-duplex 不只是資料格式問題，而是 model objective 會互相干擾。對我們「mono-channel dialogue -> dual-channel data -> train dual-channel audio generator」的計畫，有幾個直接啟發：

- dual-channel audio generator 應該分清 semantic channel、acoustic channel、control / turn-taking channel，而不是只用一條 audio-token loss。
- overlap、backchannel、interruption 應該要有 explicit event labels 或 control tokens，否則模型容易把所有 user speech 都當 interruption。
- side-talk 是必補資料類型：第三方 speech、background speech、user muttering、passive backchannel、true interruption 必須標清楚 intent。
- 如果做 multi-loss 訓練，例如 A channel、B channel、A+B mixture loss，還需要觀察不同 loss 的 gradient conflict，否則 mixture loss 可能壓過 speaker-specific losses。

最重要的實驗靈感：我們可以對 full-duplex generator 做 layer-wise gradient cosine analysis，分別看 content loss、speaker separation loss、overlap reconstruction loss、turn-taking/control loss 是否在深層衝突。

### project-tts-data-pipeline：中高相關
它的 data synthesis pipeline 有可借鑑處：用 multi-agent 產生 interruption/backchannel，再用 reviewer agent 過濾 event quality 和 logical flow，最後用 TTS 合成 audio。這可以改造成我們的 TTS / dialogue data pipeline：

- transcript 內加 `<interruption/>`、`<user_backchannel>`、`<ai_backchannel>` 等 event tags。
- 對 interruption placement 做 reviewer scoring，不只檢查文字，也檢查 acoustic timing。
- 對 side-talk / non-directed speech 加 intent labels，避免模型學壞 turn-taking。

### project-audio-model-evaluation：高相關
Full-duplex evaluation 不應只看 WER 或 response quality。這篇使用 FDBench / FullDuplexBench 的 SRR、SIR、EIR、SRIR、FSED、IRD、IRR、BRR、Stop latency 等 metrics，對我們設計 audio judge 很有參考價值。

可以接到 AnyAudio-Judge / FlashTrace：不只問「是否正確 interruption」，還要定位 audio timeline 上哪一秒發生 side-talk、哪一秒模型應該 stop、哪一秒不該 stop，並把 judge rubric grounded 到 audio span。

## Related papers in my pool
- [Sommelier: Scalable Open Multi-turn Audio Pre-processing for Full-duplex Speech Language Models](../arxiv_2603_25750/)：資料前處理 / full-duplex pipeline 方向互補。Sommelier 更偏資料處理，Lychee-FD 更偏 model architecture 和 optimization conflict。
- [LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems](../arxiv_2502_14145/)：dialogue management / full-duplex interaction 的相關背景；Lychee-FD 的主張是把 dialogue management 內化到 native SLM。
- [On The Landscape of Spoken Language Models: A Comprehensive Survey](../arxiv_2504_08528/)：SLM taxonomy 背景。
- StepAudio-2-mini：本文 backbone，但目前本地 pool 尚未有對應 paper note。
- Moshi / Fun-Audio-Chat / Freeze-Omni / VITA-1.5：本文主要 baselines，之後可補進 paper pool 做 full-duplex model comparison。

## OpenReview / reviewer discussion
找到 OpenReview forum `iZ2y0sqJJD`，但本地 `npm run paper:openreview -- arxiv_2607_06540` 沒有產生可摘要的 public review notes；瀏覽器開啟 OpenReview forum 時也遇到 verification gate。因此目前不寫 reviewer/rebuttal 細節。

公開來源顯示此文有 ACL 2026 proceedings PDF，GitHub README 也標示為 ACL 2026 Outstanding Paper；這裡採用 ACL 2026 作為 venue。

## 我該不該細讀
應該細讀，而且優先級很高。

理由：

- 它直接討論 full-duplex SLM 為什麼會變笨，且用 gradient conflict / semantic dilution 給出可操作診斷。
- 它的 data synthesis pipeline 正好對應 interruption、backchannel、turn-taking。
- 它明確指出 side-talk / multi-speaker intent annotation 是未解問題，這和我們從 mono-channel dialogue 做 dual-channel / overlap data 的方向高度一致。
- 它的 hierarchical separation 可以啟發我們設計 dual-channel audio generator：shared low-level representation + separated speaker/acoustic/control heads。

最值得細讀：

- Figure 2 optimization dynamics。
- Hierarchical Parameter Separation。
- Semantic Alignment Channel。
- Appendix 的 data synthesis pipeline。
- Appendix 的 side-talk error analysis。
- DAG-PP inference system。

## 可能的弱點 / open questions

### 1) Synthetic data 可能過於規則化
140K full-duplex instances 主要由 agents + rule-based constraints 生成，再用 CosyVoice 2 合成。這會帶來 coverage 問題：真實 overlap timing、自然 hesitation、speaker leakage、room acoustics、side-talk、多人場景可能不夠。

### 2) side-talk 是核心 failure，不是小問題
作者把 side-talk 說成 data coverage gap。我同意，但這個 gap 對 full-duplex deployment 非常大：open-mic 場景中，non-directed speech 很常見。如果模型只學 two-party direct interaction，很容易 over-interrupt。

### 3) Gradient analysis 很有說服力，但還可更細
目前主要看 text vs speech gradients。對我們的 dual-channel generator，還需要看：

- speaker A loss vs speaker B loss。
- separated channels loss vs A+B mixture loss。
- semantic transcript loss vs waveform / codec reconstruction loss。
- overlap event/control loss vs acoustic generation loss。

### 4) Evaluation 仍偏 benchmark
FDBench / FullDuplexBench 很有用，但真實互動還有更細的 human-friendly dimensions：打斷是否禮貌、backchannel 是否過多、是否在句子邊界停、是否對低聲 murmuring 過度反應、是否能辨別 directed vs non-directed speech。

### 5) 10B total parameters 和 multi-GPU serving 成本不低
雖然 critical path 保持低 latency，但實際部署仍依賴多頭並行和客製 vLLM。若我們要做資料/模型研究，可能先用小模型重現 gradient conflict 診斷，而不是直接訓練同級模型。

## Tags
- speech-llm
- full-duplex
- modality-interference
- acoustic-semantic-modeling
- hierarchical-parameter-separation
- semantic-alignment-channel
- turn-taking
- backchannel
- interruption
- side-talk
- project-full-duplex-data
- project-audio-model-evaluation
- project-tts-data-pipeline

## Concepts
- Lychee-FD
- full-duplex SLM
- modality interference
- optimization divergence
- semantic dilution
- gradient cosine similarity
- gradient magnitude ratio
- hierarchical parameter separation
- semantic alignment channel
- acoustic head
- semantic head
- control head
- internal monologue
- channel-division multiplexing
- full-duplex data synthesis
- interruption generation
- backchannel injection
- side-talk error
- DAG pipeline parallelism

## Citation
ACL Anthology title appears as `Hierarchical Intelligent Acoustic-Semantic Modeling: Modality Separation and Alignment for Full-Duplex SLMs`, while the arXiv page uses `Hierarchical Acoustic-Semantic Modeling: Modality Separation and Semantic Coherence for Full-Duplex SLMs`. This note keeps the arXiv title in frontmatter and records ACL 2026 as the venue.

```bibtex
@misc{liu2026hierarchicalacousticsemanticmo,
  title={Hierarchical Acoustic-Semantic Modeling: Modality Separation and Semantic Coherence for Full-Duplex SLMs},
  author={Zhenyu Liu and Xuanyu Zhang and Yunxin Li and Qixun Teng and Shenyuan Jiang and Haolan Chen and Minjun Zhao and Fanbo Meng and Yu Xu and Yancheng He and Baotian Hu and Haizhou Li and Min Zhang},
  year={2026},
  eprint={2607.06540},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2607.06540}
}
```
