# OpenReview Summary: A Full-duplex Speech Dialogue Scheme Based On Large Language Model

## Verdict

**Accept (poster).**  
這篇 paper 提出一個以 LLM 為核心的 **full-duplex speech dialogue system**：透過 **neural FSM**（兩個 states: `SPEAK` / `LISTEN`，四種 control tokens）把「回應、等待、打斷、讓出話語權」全部轉成 **next token prediction**。系統實作上仍是 modular pipeline：streaming ASR + fine-tuned Llama-3-8B-Instruct + streaming/non-streaming TTS。

整體 reviewer 對方向與 demo 評價偏正面，認為這是一個有用且新興的工程/研究方向；但主要批評集中在：

1. **不是 end-to-end / unified multimodal model**，ASR/TTS pipeline 可能造成資訊流失與 error propagation。
2. **evaluation metrics 不足以完整衡量 real-life spoken dialogue quality**，尤其 helpfulness、relevance、emotion、prosody、long-context robustness。
3. **comparison 與實驗仍有限**，特別是與既有 full-duplex / realtime chatbot 系統、模型能力是否退化、安全性與 bias。
4. 作者 rebuttal 對部分問題有回應，但對「helpfulness/relevance 可由 current LLM guaranteed」的說法不充分，decision comment 也明確指出這是不合理的 claim，應列為 limitation。

---

## Main Strengths

- **清楚提出 neural FSM abstraction**  
  Paper 將 full-duplex interaction formalize 成 LLM 操作一個 two-state FSM：`SPEAK` 與 `LISTEN`，並以 `[C.SPEAK]`, `[S.LISTEN]`, `[C.LISTEN]`, `[S.SPEAK]` 作為 state transition control tokens。這讓「是否開始說話、是否繼續聽、是否打斷、是否讓出」都變成 standard autoregressive token prediction。

- **可利用既有 pretrained LLM 與 instruction tuning**  
  方法不需要重新訓練 end-to-end speech model，而是基於 Llama-3-8B-Instruct 做少量 SFT。TeX 中寫到使用 1500 series GPT-4-generated transcripts，fine-tuning 20 steps。Reviewer 認為這個設計讓 training / finetuning overhead 低，也易於複用現有 LLM。

- **實驗顯示 latency 明顯下降**  
  Paper Table `FTED` 顯示 full-duplex configuration `asr-s + llm-fd + tts-s` 平均 first token emission delay 為 **0.68s**，相比 baseline `asr-ns + llm + tts-ns` 的 **2.28s**，約三倍以上改善。這支持 paper abstract 中的 latency claim。

- **interruption precision 優於 GPT-4o / GPT-3.5-turbo-0125**  
  TeX 表格顯示 Llama-3-8B-Instruct-fd 在 `M interrupts U` 的 composite Precision 為 **54.7**，高於 GPT-4o 的 **46.6** 與 GPT-3.5-turbo-0125 的 **24.7**。Reviewer 也認可這點，尤其在 smaller model 上達到不錯的 interruption behavior。

- **研究方向具啟發性**  
  多位 reviewer 認為 full-duplex LLM dialogue 是 promising direction。即使系統是 pipeline engineering effort，neural FSM 的 abstraction 可能也能遷移到 future unified speech-language models。

---

## Main Weaknesses

- **依賴 ASR/TTS pipeline，而非 end-to-end multimodal model**  
  Reviewer 指出把 speech 全部轉成 text tokens 會遺失 prosody、emotion、tone、overlap speech 等資訊，也可能有 ASR error propagation。Paper 方法確實明確使用 off-the-shelf ASR/TTS：perception module 是 ASR，motor function 是 TTS，因此此批評合理。

- **evaluation 對 real-life conversation 不夠完整**  
  Paper 主要評估：
  - latency: `FTED`
  - interruption timing: `PIR`
  - interruption response reasonableness: `PRR`
  - machine/user interruption categories

  但 reviewer 認為 spoken dialogue quality 還包括 helpfulness、relevance、coherence over long histories、safety、emotion handling、noise robustness、ASR error robustness 等。TeX 中的 benchmark 主要是 simulated text-level conversation + GPT-4 evaluation，確實不足以支持全面 human-like conversation claim。

- **LLM-as-evaluator 與 synthetic data 可能有 bias**  
  Paper 用 GPT-4 產生 training/evaluation data，也用 GPT-4-turbo 評估 interruption rationality。這會帶來 evaluator bias、style bias、data leakage-like correlation 或過度依賴 GPT-4 preference 的問題。Reviewer 問到是否評估 GPT-4-generated instruction tuning transcripts、是否會 weaken safety measures；作者回應較籠統。

- **對模型能力退化的實驗有限**  
  有 reviewer 提到 Table 3 顯示 full-duplex SFT 可能導致原模型其他能力下降。作者承認因為只用 full-duplex data 做 SFT，可能 compromise other capabilities，但說混合其他 data 可緩解。這是合理但未實證的回答。

- **comparison 不足，不宜過度宣稱 SOTA**  
  Reviewer 指出缺少與既有 realtime chatbot / full-duplex implementations 的直接比較。作者回應 submission 時沒有類似 open-source implementation / data / model，且某 GitHub 系統未評估 latency/interruption accuracy。這有部分道理，但仍不足以支撐「new SOTA」式強宣稱。

---

## Reviewer Questions

### Q1. 為什麼需要三個 components？為何不用 unified end-to-end model？
Reviewer 擔心 ASR + LLM + TTS pipeline 增加 latency，且 ASR transcription 會遺失 speech-specific information，例如 emotion、tone、prosody。

### Q2. Evaluation metrics 是否足夠？
Reviewer 認為 latency 與 interruption precision/PRR 不能完整評估 dialogue quality。尤其 machine response 是否 helpful、relevant、coherent，並沒有被充分測量。

### Q3. Text-based synthetic dialogue 如何轉成 natural spoken dialogue？
Reviewer 問 GPT-4 產生的是 text-based dialogue，如何保證轉成 spoken dialogue 時 speaker turn gap、overlap、pause 等自然？

### Q4. ASR chunks 是否每 640ms 都插入 LLM input sequence？
Reviewer 要釐清 inference 時 streaming ASR output 是否每 640ms 都送進 LLM，以及在 `SPEAK` / `LISTEN` state 下如何處理 empty chunks。

### Q5. 是否評估 GPT-4-generated transcripts 的安全性與 bias？
Reviewer 問 GPT-4 產生的 SFT transcripts 是否可能帶入 bias 或削弱 safety alignment。

### Q6. 是否嘗試 distill Llama-3-8B 以降低 footprint / latency？
Reviewer 問是否可用 smaller model 改善 latency。

### Q7. 20 steps SFT 是否真的足夠？
Reviewer 對只訓練 20 steps 是否能讓 Llama-3-8B-Instruct 學會 neural FSM 表示疑問。

### Q8. 這個 idea 是否受 GPT-4o 啟發？
Reviewer 懷疑 paper 在 GPT-4o release 後完成，因此 motivation 可能來自 GPT-4o。

### Q9. Code readability 與 reproducibility
Reviewer 認為 demo 有價值，但 code readability 差，希望以 HuggingFace-style interface 重構。

---

## Author Rebuttal

### 對 unified model / end-to-end model 的回應
作者表示
