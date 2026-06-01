---
paper_key: arxiv_2603_14877
canonical_id: "arxiv:2603.14877"
title: "SoulX-Duplug: Plug-and-Play Streaming State Prediction Module for Realtime Full-Duplex Speech Conversation"
year: 2026
venue: "arXiv"
url: "https://arxiv.org/abs/2603.14877v1"
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

## Links
- [arXiv abstract](https://arxiv.org/abs/2603.14877v1)
- [PDF](https://arxiv.org/pdf/2603.14877)
- [GitHub](https://github.com/Soul-AILab/SoulX-Duplug)

## 一句話總結
SoulX-Duplug 是一個可插拔的 streaming state prediction module，透過 joint ASR 與 semantic-guided turn/state prediction，讓 full-duplex speech conversation 能在低延遲下更準確地做 turn-taking 控制。

## 這篇在解決什麼問題
這篇主要在解 full-duplex speech dialogue systems 的三個痛點：

1. **training data 難取得**：高品質、對齊精準的 full-duplex conversation data 很少。
2. **catastrophic forgetting / scalability**：端到端 full-duplex model 雖然整合，但容易把 turn-taking policy 和 language modeling 綁太死，不易擴展也不易控制。
3. **latency 與 semantic awareness 的矛盾**：傳統 modular pipeline 常用 acoustic VAD + non-streaming ASR + turn detection，雖然模組化，但延遲高，而且 VAD 缺少語意資訊，容易在 pause、backchannel、interruption 等場景判斷不準。

作者想要的是：**不改 backbone，就把 half-duplex 系統補成可 realtime 運作的 full-duplex 系統**。

## 核心方法
SoulX-Duplug 的核心是把 duplex interaction control 形式化成 **streaming state prediction**，並把它做成一個 plug-and-play module。

### 主要設計
- 模組同時處理：
  - **VAD**
  - **streaming ASR**
  - **dialogue state prediction**
- 不是把它們拆成獨立 cascaded modules，而是放進同一個 streaming framework 中端到端學習。

### 關鍵想法：text-guided semantic VAD
作者讓模型在每個 audio chunk 上先做 streaming ASR，再做 state prediction：
- 先預測 chunk 對應的 ASR tokens
- 再根據 audio + text context 預測 state token

這樣 state prediction 不只看聲學資訊，也能用 textual semantics 來判斷：
- user_idle
- user_nonidle
- user_backchannel
- user_complete
- user_incomplete

作者把這種做法視為一種 **semantic VAD**：不是只判斷「有沒有聲音」，而是判斷「這段話有沒有語意、是不是還沒講完、是不是 backchannel」。

### interleaved prediction
模型採用交錯式輸出：
- `A_t`：audio tokens
- `T_t`：ASR tokens
- `S_t`：state token

也就是每個 chunk 都先輸出 ASR，再輸出 state，讓語意資訊能即時進入 turn decision。

### hybrid 3-stage training
訓練分三階段：
1. **non-streaming ASR pretraining**
2. **streaming ASR adaptation**
3. **duplex state prediction fine-tuning**

另外還用了 **teacher-forced inference**：
- training 時 joint end-to-end optimize
- inference 時用 lightweight ASR teacher 提供較穩定的 text guidance

這個設計的目的，是兼顧：
- end-to-end training 的表徵能力
- streaming deployment 的低延遲與穩定性

## Training / Data
### ASR training data
作者用大規模 bilingual corpora：
- **Mandarin**：AISHELL-1, AISHELL-3, WenetSpeech, VoxBox subsets 等，約 **47,000 hours**
- **English**：LibriSpeech, GigaSpeech, VoxBox subsets 等，約 **31,000 hours**

### State prediction training data
- **English**：Fisher，千小時級
- **Mandarin**：作者自建的十千小時級 in-house corpus，格式類似 Fisher

### 標註與處理
- 先做 alignment
- Mandarin data 會做 dual-ASR consistency filtering
- 加入 noise augmentation：
  - Musan noise
  - ESC-50 noise（加到 silence segments）
- state labels 由 **Qwen2.5-72B-Instruct** 標註

### Model components
- speech tokenizer：**GLM-4-Voice tokenizer**，freeze 不訓練
- LLM backbone：**Qwen3-0.6B**
- state prediction stage：用 **LoRA** fine-tuning，rank `r=32`

### Inference
- Mandarin ASR teacher：**Paraformer**
- English ASR teacher：**SenseVoice Small**
- 在 single NVIDIA L20 GPU 上做 simulated online streaming inference

### 評估資料
作者另外做了 **SoulX-Duplug-Eval**，補足 bilingual evaluation：
- **Easy Turn testset-En**
- **Full-Duplex-Bench-Zh**

涵蓋：
- turn-taking
- pause handling
- user backchannel
- user interruption

## 主要結果
### 1) full-duplex system performance
在 Bilingual Full-Duplex-Bench 上，SoulX-Duplug-based system：
- 在 **overall turn management** 取得最佳平均表現
- latency 也保持低水準
- 對比多個 existing full-duplex models，整體更平衡

幾個重點：
- 在 English 與 Chinese 都有競爭力
- 相較 **Freeze-Omni**，多個 turn management / latency 指標更好
- 在 interruption 與 backchannel 情境中，表現相對穩定，不會只追求 aggressive response

### 2) state prediction performance
在 Bilingual Easy Turn testset 上：
- streaming 的 SoulX-Duplug 雖然不是每個 accuracy 都是最高
- 但整體表現接近 non-streaming baselines，且 latency 顯著更低且更穩定

文中給的理論 latency：
- **240 ms**

### 3) standalone latency
作者比較 streaming state prediction modules，SoulX-Duplug 的 practical latency 大約：
- **EN 205 ms**
- **ZH 295 ms**
- 平均約 **250 ms**

比：
- **FlexDuo**：343 ms
- **VAD-based**：500 ms

更低。

### 4) ablation
移除以下設計都會掉點：
- **w/o ASR pretraining**：accuracy 明顯下降
- **w/o Teacher-Forced Inference**：accuracy 也下降

這表示：
- ASR semantics 對 state prediction 很重要
- teacher-forced text guidance 對 short-chunk streaming 特別有幫助

## Project relevance
- **project-full-duplex-data**：高
- **project-tts-data-pipeline**：低

原因很直接：這篇核心是 **full-duplex / turn-taking / overlap / interruption / backchannel** 的 modular control 與 benchmark 設計，和 full-duplex data 建模高度相關。

## 我該不該細讀
**建議細讀。**

如果你在做：
- full-duplex speech conversation
- turn-taking / interruption / backchannel control
- streaming ASR + semantic endpoint / state prediction
- modular FD-SDS system design

這篇很值得看，因為它同時提供：
- 一個可落地的 streaming module
- bilingual benchmark
- 清楚的 ablation 與 latency analysis

如果你更關心的是純 TTS data cleaning / filtering，這篇就不是主線。

## 可能的弱點 / open questions
- **依賴 teacher-forced ASR**：inference 時靠外部 lightweight ASR 提供 text guidance，這讓模組本身的純 end-to-end 自主性下降。
- **state label quality 依賴大模型標註**：使用 Qwen2.5-72B-Instruct 產標籤，標註偏差可能影響上限。
- **in-house Mandarin state corpus 不公開**：可重現性與資料外部可驗證性有限。
- **chunk-based streaming 的 ASR instability**：作者也承認短 chunk 容易切碎 phoneme / syllable / word，特別是 English。
- **benchmarks mostly synthetic**：SoulX-Duplug-Eval 的一部分資料由 ChatGPT + TTS 合成，可能與真實對話分佈有落差。
- **module coupling still exists**：雖然是 modular，但 ASR quality 對 state control 很關鍵，整體 performance 可能仍受 recognition errors 牽動。

## Tags
full-duplex, streaming ASR, turn-taking, semantic VAD, dialogue state prediction, low-latency speech interaction, bilingual benchmark, modular speech dialogue system

## Concepts
- **full-duplex speech conversation**
- **streaming ASR**
- **turn-taking**
- **pause handling**
- **user interruption**
- **user backchannel**
- **semantic VAD**
- **state token**
- **teacher-forced inference**
- **chunk-based streaming**
- **LoRA fine-tuning**
- **bilingual benchmark**
- **dialogue state prediction**

## Citation
```bibtex
@article{yan2026soulxduplugplugandplaystream,
  title={SoulX-Duplug: Plug-and-Play Streaming State Prediction Module for Realtime Full-Duplex Speech Conversation},
  author={Yan, Ruiqi and Chen, Wenxi and Liu, Zhanxun and Ma, Ziyang and Lin, Haopeng and Wen, Hanlin and Xie, Hanke and Wu, Jun and Liang, Yuzhe and Zhao, Yuxiang and Feng, Pengchao and Qian, Jiale and Meng, Hao and Dai, Yuhang and Yin, Shunshun and Tao, Ming and Xie, Lei and Yu, Kai and Wang, Xinsheng and Chen, Xie},
  journal={arXiv},
  year={2026}
}
```
