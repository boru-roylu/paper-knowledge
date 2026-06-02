---
paper_key: arxiv_2505_17060
canonical_id: "arxiv:2505.17060"
title: "SALMONN-omni: A Codec-free Speech LLM\\\\ for Full-duplex Listening and Speaking"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2505.17060"
pdf_url: "https://arxiv.org/pdf/2505.17060"
status: read
rating: 4
tags:
  - speech-llm
  - full-duplex
  - project-full-duplex-data
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `gpt-5.4-mini`

</div>

## Links
- [arXiv abstract](https://arxiv.org/abs/2505.17060)
- [PDF](https://arxiv.org/pdf/2505.17060)

## 一句話總結
SALMONN-omni 提出一個 **codec-free** 的 standalone speech LLM，透過 streaming speech encoder、單一 LLM backbone 與 streaming speech synthesizer 的整合，以及 explicit `thinking` / state-transition tokens，來實現 **full-duplex listening and speaking**。

## 這篇在解決什麼問題
這篇主要解決 full-duplex spoken dialogue system 的幾個核心痛點：

- 傳統 **half-duplex** speech LLM 只能「你講完我再講」，無法自然處理人類對話中的 simultaneous listening and speaking
- 現有 full-duplex 方法常依賴 **audio codec injection**，會帶來 **modality gap**、catastrophic forgetting，且仍可能有 timing 不準的問題
- modular pipeline 雖然可行，但常有 **error propagation**，例如 VAD、dialogue controller、interruption detector 各模組互相放大錯誤
- 需要同時處理 **turn-taking、backchanneling、echo cancellation、context-dependent barge-in**
- 希望做到真正 **standalone**：單一 LLM 自己決定何時說、何時停、何時聽，而不是靠外掛控制器

簡單說，作者想把 full-duplex conversation 變成一個可由單一 LLM 自主學會的對話控制問題。

## 核心方法
核心是把 full-duplex dialogue 做成一個 **codec-free, end-to-end** 框架，並讓 LLM 學會對話狀態切換。

### 1) 整體架構
SALMONN-omni 由三部分組成：

- **streaming speech encoder**：把輸入語音轉成可串流的 hidden embeddings
- **LLM backbone**：以單一 LLM 處理語意、對話內容與 state transition
- **streaming speech synthesizer**：把 LLM 輸出的表示轉成語音

重點是：**沒有把 audio codecs 注入 LLM vocabulary**。

### 2) Dual-stream / interleaving 設計
作者把對話拆成兩條 stream：

- **environment stream**：使用者語音、背景聲、assistant echo
- **assistant stream**：模型要生成的回應語音

再把這些訊號與 text response tokens **interleave** 成單一序列，讓 LLM 用 autoregressive 方式共同建模。

### 3) Periodic synchronisation
為了讓 audio 與 text 在時間上對齊，模型使用固定長度的 **time blocks**：

- 每個 block 先讀一段輸入語音
- 再生成對應長度的輸出語音

這讓模型具有某種 temporal awareness，避免輸入/輸出步調失衡。

### 4) Explicit “thinking” strategy
作者最重要的設計之一是把 turn-taking / state transition 當成 token prediction 來學。

兩種版本：

- **implicit thinking**：不顯式輸入 `\<listen>` / `\<speak>` 類 state tokens
- **explicit thinking**：加入 `\<think>` 與 `\<shift>`  
  - `\<think>`：代表 listening 時的思考/等待狀態
  - `\<shift>`：代表 `listening -> speaking` 或 `speaking -> listening`

作者發現 explicit thinking 更好，因為它更符合 LLM 的 autoregressive 特性。

### 5) Training stages
訓練分三階段：

1. **Connect streaming encoder**  
   冻結 encoder 和 LLM backbone，只訓練 connector + LoRA，先學 ASR / QA

2. **Connect streaming synthesizer**  
   加入語音生成能力，訓練 connector、LoRA、synthesizer，並加入 multi-turn dialogue、barge-in、backchanneling 資料

3. **RL / DPO for full-duplex modeling**  
   進一步用 **DPO** 強化 barge-in 與 backchanneling；作者指出 SFT 後模型偏向容易被打斷，因此 RL 可以改善 context understanding 與 interaction policy

## Training / Data
### 模型設定
- **LLM backbone**：Llama-3-8B-Instruct
- **streaming speech encoder**：Mamba-based，32 個 Mamba blocks，hidden size 2048
- **speech synthesizer**：CosyVoice2-0.5B fine-tuned
- **LoRA**：rank 32，scaling factor 1.0
- **time block**：80 ms
- 每 80 ms 音訊對應產生 1 個 text token
- 產生 4 個 text tokens 後，speech synthesizer 生成 12 個 speech tokens（約 480 ms speech）
- 估計從開始說到音訊輸出有約 320 ms delay

### 訓練資料
- **ASR**：
  - LibriSpeech-960h
  - GigaSpeech-M
  - 約 480k samples

- **spoken QA**：
  - Alpaca-52k
  - Web Questions
  - TriviaQA
  - SQuAD
  - Natural Questions
  - VoiceAssistant-400K from Mini-Omni
  - UltraChat from SLAM-Omni
  - 合計約 730k QA samples

- **multi-round conversation**：
  - 以 Llama-3-8B-Instruct 生成 conversation transcript
  - theme 來自 TriviaQA / Natural Questions
  - 再用 CosyVoice2-0.5B 合成語音
  - 約 80k samples

- **barge-in / backchanneling**：
  - context-independent barge-in：用 GPT-4o 生成直接打斷句
  - context-dependent barge-in：用 Llama-3-8B-Instruct 生成相關/不相關問題來區分真正打斷與干擾
  - backchanneling：加入常見短回應如 “Uh-huh.”
  - 也考慮 multi-speaker barge-in

### 訓練細節
- encoder pretrain：LibriHeavy + GigaSpeech，300k steps
- optimizer：AdamW
- 訓練在 32 A100 GPUs 上進行
- stage 1 / 2 / 3 分別訓練約 50k / 30k steps（後續 DPO 另有設定）

## 主要結果
作者宣稱 SALMONN-omni 在多個面向都表現很強：

- 在 **predicted turn-taking** 設定下，相較既有 open-source full-duplex speech models，平均有 **35.9% relative improvement**
- 在 **full-duplex mode** 下達到新的 SOTA
- 在 **half-duplex evaluation** 下，也能和訓練資料量更大的 turn-based models 競爭，甚至接近或優於部分模型
- 在以下情境表現特別好：
  - turn-taking prediction
  - backchanneling
  - echo cancellation
  - context-dependent barge-in

另外作者指出：

- **explicit thinking** 明顯優於 implicit thinking
- 加入 **assistant stream** 後，turn-taking success rate 顯著提升
- **DPO** 可以進一步改善 full-duplex modeling，特別是 contextual barge-in / backchannel 判斷
- 但 SFT 後模型會有「太容易被打斷」的 bias，顯示單靠 supervised training 不夠穩定

## Project relevance
- **project-full-duplex-data**：高相關，屬於 full-duplex speech dialogue / barge-in / backchanneling / dual-stream conversation generation
- **project-tts-data-pipeline**：低相關，雖用到 TTS 與資料合成，但不是重點在 English TTS cleaning/pipeline

## Related papers in my pool
有明顯直接相關，尤其是：

- **A Full-duplex Speech Dialogue Scheme Based On Large Language Model (2024)**  
  同樣關注 full-duplex speech dialogue、turn-taking、speech-LLM 與控制策略，與本篇在任務目標和控制問題上高度接近。  
  差異在於這篇更進一步主打 **codec-free standalone LLM**，並把 state transition 直接納入 token-level generation，方法更端到端。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context

## 我該不該細讀
如果你關心 **full-duplex speech LLM、turn-taking、barge-in/backchannel control、codec-free architecture**，這篇值得細讀。  
尤其推薦讀它的 **Methodology** 和 **Training Scheme**，因為 explicit thinking、dual-stream interleaving、DPO 對 full-duplex modeling 的設計都很有參考價值。

## 可能的弱點 / open questions
- **complexity 仍不低**：雖然宣稱 standalone，但仍有 streaming encoder、LLM、streaming synthesizer 與多階段訓練
- **320 ms latency** 對某些即時互動場景未必足夠低
- **資料合成比例高**：multi-turn dialogue、barge-in 等資料多半是合成或半合成，真實 in-the-wild robustness 未必完全可知
- **DPO 效果的可泛化性**：是否能穩定提升不同語言、不同 speaker、不同噪音條件下的 full-duplex behavior，還需要更多驗證
- **emotional speech generation** 被提到，但作者也承認情緒表達仍不夠一致
- **turn-taking policy vs. content generation** 是否真的完全解耦，或只是被封裝到 tokens 中，仍是個 open question
- 對比基線多為 open-source；和最強 closed-source systems 的差距沒有完整呈現

## Tags
- speech-llm
- full-duplex
- turn-taking
- barge-in
- backchanneling
- streaming-ASR
- streaming-TTS
- codec-free
- DPO
- dialogue-management

## Concepts
- full-duplex spoken dialogue system
- half-duplex vs. full-duplex
- codec injection
- modality gap
- catastrophic forgetting
- streaming speech encoder
- streaming speech synthesizer
- dual-stream modeling
- environment stream
- assistant stream
- periodic synchronisation
- explicit thinking
- implicit thinking
- state-transition tokens
- turn-taking prediction
- context-dependent barge-in
- backchanneling
- echo cancellation
- DPO
- LoRA
- Mamba
- CosyVoice2

## Citation
```bibtex
@article{yu$^12025salmonnomniacodecfreespeechllm,
  title={SALMONN-omni: A Codec-free Speech LLM for Full-duplex Listening and Speaking},
  author={Wenyi Yu and others},
  year={2025},
  journal={arXiv preprint},
  eprint={2505.17060}
}
```
