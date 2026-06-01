---
paper_key: arxiv_2603_14877
canonical_id: "arxiv:2603.14877"
title: "SoulX-Duplug: Plug-and-Play Streaming State Prediction Module for Realtime Full-Duplex Speech Conversation"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2603.14877"
pdf_url: "https://arxiv.org/pdf/2603.14877"
status: read
rating: 4
tags:
  - speech-llm
  - asr
  - full-duplex
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-05-31
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2603.14877)
- [PDF](https://arxiv.org/pdf/2603.14877)

## 一句話總結
SoulX-Duplug 是一個 plug-and-play 的 streaming state prediction module，把 streaming ASR 與 turn/state prediction 結合成 semantic VAD，用來讓 modular full-duplex spoken dialogue system 在低延遲下更準確地判斷何時該聽、該說、該停。

## 這篇在解決什麼問題
這篇聚焦在 **realtime full-duplex speech conversation** 的互動控制問題：系統要能在邊聽邊說時，正確判斷使用者是否講完、是否插話、以及系統何時要繼續說或停止說。

作者指出幾個實務瓶頸：
- training data 很難取得，尤其是可用於 full-duplex control 的標註資料
- end-to-end full-duplex models 容易把 turn-taking policy 和 content generation 綁死，難以 controllable
- existing modular pipelines 常用傳統 acoustic VAD + non-streaming ASR + turn detector，延遲高且缺乏 semantic awareness
- bilingual / multilingual evaluation benchmark 不夠完整，公平比較很困難
- 模型在 full-duplex setting 中還面臨 catastrophic forgetting 與 scalability 問題

所以這篇不是在改進一般 ASR 或 TTS，而是在做 **可插拔、低延遲、語意感知的 dialogue state control**。

## 核心方法
核心方法是把 full-duplex interaction control 形式化成 **streaming state prediction**，並把它做成一個能接在既有 half-duplex SDM 前面的 module。

### 1) Semantic VAD 的 state token 設計
模型不是只做 acoustic VAD，而是預測四種 control states：
- `<|Continue-Listening|>`：query 還沒完整，繼續聽
- `<|Start-Speaking|>`：query 已完整，開始回覆
- `<|Start-Listening|>`：偵測到 intentional interruption，停止說並切回聽
- `<|Continue-Speaking|>`：偵測到 unintentional interruption，維持說

這讓模型能利用語意判斷 turn-taking，而不是只靠聲學停頓。

### 2) Joint streaming ASR + state prediction
SoulX-Duplug 在 chunk-based streaming 設定下，**同時做 streaming ASR 與 state prediction**。
- ASR 提供 textual information
- textual information 用來判斷 user intent
- 這種設計相當於把 ASR 當成語意感知的中介訊號

作者強調這點是關鍵：不是單純用 speech features 做 VAD，而是 explicitly 用 text-guided semantic information 來做 control。

### 3) Plug-and-play modular framework
它被設計成可以掛到現有的 half-duplex SDM 上，不需要改 backbone architecture。
這使它比較像一個可部署的 control layer，而不是端到端重訓整個系統。

### 4) Hybrid 3-stage training with teacher-forced inference
TeX 片段顯示它採用 **hybrid 3-stage training**，並在訓練中使用 **teacher-forced inference** 來穩定學習 streaming state prediction 與 ASR 對齊。
整體目標是讓模型在 incremental observations 下學會低延遲 state control。

### 5) 新 benchmark: SoulX-Duplug-Eval
作者另外提出 **SoulX-Duplug-Eval**，把既有 benchmark 擴充成 bilingual evaluation：
- state-level assessment：延伸 `Easy Turn` testset，補充 English samples
- system-level assessment：選取 `Full-Duplex-Bench` 系列任務，並加入 Chinese test sets

目的在於讓 full-duplex evaluation 更標準化、可比較。

## Training / Data
從摘要與 TeX 片段可知，訓練與資料設計重點如下：

- **streaming / chunk-based** 設定
- 以 **streaming ASR objective** 作為 semantic supervision
- 使用 **teacher-forced inference** 的 hybrid multi-stage training
- 系統化對 full-duplex interaction 的 state prediction 進行監督

資料與 benchmark 方面：
- state prediction 評估基於 `Easy Turn`
- system-level 評估基於 `Full-Duplex-Bench` 系列
- 新增 bilingual coverage，補足英文與中文測試
- 這篇同時關注 modular FD-SDS 的 evaluation fairness，而不只是單一模型分數

摘要沒有提供明確的訓練資料總量或語料規模，因此這部分只能確定是 **benchmark extension + streaming supervision**，而非大規模新收集 corpus。

## 主要結果
主要結果可以整理成三點：

- **低延遲**：SoulX-Duplug 能做到 low-latency streaming dialogue state control，摘要提到整體延遲表現接近可接受上限，TeX 片段也提到平均 latency 約 **240 ms**
- **turn management 更好**：在 Full-Duplex-Bench 與 SoulX-Duplug-Eval 上，搭配該 module 的 full-duplex system 在 overall turn management 上優於 existing full-duplex models
- **latency / controllability 兼顧**：系統在 latency performance 上也有更好的整體表現，顯示 text-guided streaming state prediction 對 real-time full-duplex control 有效

另外，文中也強調：
- auxiliary textual supervision 對 dialogue state prediction 有幫助
- 新 benchmark 有助於更公平地比較 bilingual full-duplex models

## Project relevance
- **project-full-duplex-data**：高度相關，屬於 full-duplex turn-taking / state control / semantic VAD
- **project-tts-data-pipeline**：低度相關，主要是評估與 streaming control，不是 English TTS cleaning pipeline

## Related papers in my pool
和已讀 paper 裡的 **LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems** 有明顯相關：
- 兩篇都在做 **full-duplex spoken dialogue systems** 的互動控制
- 都關注 **turn-taking / pause handling / interruption handling**
- 都是偏 modular 或 control layer 的思路，而不是單純端到端 speech generation
- 這篇更偏 **streaming ASR + semantic VAD + bilingual benchmark**
- 前一篇更偏 **LLM-based dialogue manager**，強調 control tokens 與 DM / CDE 解耦

目前 pool 裡沒有明顯直接相關的已讀 paper。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。

## 我該不該細讀
如果你正在做 **full-duplex speech conversation、turn-taking control、semantic VAD、streaming ASR-based dialogue management**，這篇值得細讀，尤其是：
- state token design
- streaming ASR 如何被用作 semantic supervision
- modular full-duplex 的 benchmark 設計
- latency 與 turn management 的 trade-off

如果你的重點是 **TTS cleaning / data filtering**，這篇相關性不高，可以先略過。

## 可能的弱點 / open questions
- **資料依賴仍然強**：雖然是 plug-and-play，但效果可能仍仰賴高品質 streaming ASR 與標註對齊
- **語言擴展性未知**：雖然有 bilingual evaluation，但對更多語言或更強 code-switching 的泛化不清楚
- **control token 空間較粗**：四種 state 能否覆蓋更細緻的 turn-taking 現象，例如 backchannel、soft interruption、repair，仍有疑問
- **上游 ASR 錯誤會傳導**：既然 semantic control 建立在文本上，ASR error 可能直接影響 state prediction
- **benchmark 仍偏自建擴充**：即便比以前更標準化，是否能代表真實世界多樣 full-duplex 行為，還需要更多外部驗證
- **與 end-to-end models 的公平比較**：模組化系統和端到端系統的 latency / controllability 比較，可能仍受系統設計差異影響

## Tags
full-duplex, speech-dialogue, streaming ASR, semantic VAD, turn-taking, dialogue state prediction, low-latency, plug-and-play, bilingual benchmark

## Concepts
- full-duplex spoken dialogue system (FD-SDS)
- half-duplex vs. full-duplex interaction
- turn-taking
- intentional interruption / unintentional interruption
- semantic VAD
- streaming ASR
- dialogue state prediction
- control tokens
- plug-and-play module
- chunk-based streaming
- teacher-forced inference
- latency-aware interaction control
- bilingual benchmark evaluation

## Citation
```bibtex
@article{yan2026soulxduplugplugandplaystreamin,
  title={SoulX-Duplug: Plug-and-Play Streaming State Prediction Module for Realtime Full-Duplex Speech Conversation},
  author={Yan, Ruiqi and Chen, Wenxi and Liu, Zhanxun and Ma, Ziyang and Lin, Haopeng and Wen, Hanlin and Xie, Hanke and Wu, Jun and Liang, Yuzhe and Zhao, Yuxiang and Feng, Pengchao and Qian, Jiale and Meng, Hao and Dai, Yuhang and Yin, Shunshun and Tao, Ming and Xie, Lei and Yu, Kai and Wang, Xinsheng and Chen, Xie},
  journal={arXiv preprint arXiv:2603.14877},
  year={2026}
}
```
