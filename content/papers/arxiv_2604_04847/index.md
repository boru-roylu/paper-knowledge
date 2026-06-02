---
paper_key: arxiv_2604_04847
canonical_id: "arxiv:2604.04847"
title: "Full-Duplex-Bench-v3: Benchmarking Tool Use for Full-Duplex Voice Agents Under Real-World Disfluency"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2604.04847"
pdf_url: "https://arxiv.org/pdf/2604.04847"
status: read
rating: 5
tags:
  - speech-llm
  - audio-reasoning
  - tts
  - full-duplex
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `Codex GPT-5`
- Source used: arXiv TeX source, metadata, and paper tables.

</div>

## Links
- [Original URL / arXiv abstract](https://arxiv.org/abs/2604.04847)
- [PDF](https://arxiv.org/pdf/2604.04847)
- [arXiv source](https://arxiv.org/src/2604.04847)
- [Project / demo page](https://daniellin94144.github.io/FDB-v3-demo/)

## 一句話總結
**Full-Duplex-Bench-v3 (FDB-v3)** 是一個針對 full-duplex voice agents 的 benchmark：它用真實人類語音、自然 disfluency、multi-step tool use 和 mock API chain，測試 speech-to-speech agents 是否能在打斷、修正、停頓與多步操作中正確理解使用者意圖。

## 這篇在解決什麼問題
現有 voice agent benchmark 常常只測一般對話、ASR/SLU，或用 synthetic audio 測 tool call，沒有真正覆蓋「使用者用自然語音下指令、途中猶豫或自我修正、系統還要即時決定何時回話與何時 call tool」這種場景。

這篇的核心問題是：**text LLM 的 tool use 已經很成熟，但 voice agent 的 tool use 會被 speech disfluency、turn-taking、latency 和 interruption 同時拖累。** 例如使用者說「Book me a flight um... to New York - actually wait... make that Boston」，模型不能只抓第一個 destination，也不能在修正還沒說完時就提前下單。

作者把這個問題拆成幾個 failure modes：

- **false starts**：使用者放棄原本 intent，改成新的 intent。
- **self-corrections**：使用者中途更新 slot value，系統需要 state rollback。
- **fillers**：`um`, `uh` 這類 filler 會影響 turn detection 和 semantic parsing。
- **pauses**：語句中段沉默會讓 agent 錯判 end-of-turn。
- **hesitations**：filler/repetition/停頓混合，會同時影響 latency 和 argument extraction。

## 核心方法
FDB-v3 不是提出新的 model，而是提出一個 evaluation benchmark。設計重點有三個：

1. **Real human audio**
   資料不是 TTS 合成，也不是把文字 transcript 讀成乾淨語音，而是由真人依照 scenario 自然說出 request。這讓 accent、microphone variation、pause、hesitation 和 spontaneous correction 都會出現在音訊裡。

2. **Multi-step tool chaining**
   每個 scenario 可能需要一個或多個 API call，而且後一步依賴前一步結果。這比 single-step function calling 更接近真實 voice assistant，例如先 `search_flights` 再 `book_ticket`，或先查 order status 再 `process_exchange`。

3. **Deterministic mock APIs**
   所有工具都是 zero-latency local mock API，用來隔離 model 本身的 reasoning、tool selection、argument construction 與 state tracking 能力。這避免 network latency 或真實 API instability 汙染 benchmark。

四個 task domains 和代表工具如下：

- **Travel & Identity**：`search_flights(destination,date)`, `book_ticket(passenger_name,flight_id)`, `update_travel_profile(document_type,document_number)`
- **Finance & Billing**：`query_card_benefits(card_last_4,category)`, `calculate_currency_exchange(amount,from_currency,to_currency)`, `modify_autopay_source(new_account_id)`
- **Housing & Location**：`search_apartments(max_budget,amenities)`, `update_search_filter(condition,new_value)`
- **E-Commerce Support**：`check_order_status(order_id)`, `cancel_pending_action(action_type)`, `process_exchange(order_id,new_shipping_address)`

## Training / Data
這篇是 benchmark paper，沒有 training recipe；資料重點在 evaluation set 的構成。

FDB-v3 包含 **100 段錄音、12 位 speaker**，speaker 同時包含 native 與 non-native English speakers，其中有 Korean / Russian background 的 accent variation。大多數錄音使用 everyday built-in microphones，環境從安靜到 mild background noise。

資料設計細節很值得保留：

- 每位 speaker 被分配 10 個 scenario，覆蓋不同 domain 和 disfluency。
- scenario 有 difficulty tier：Easy 是 single-step，Medium 是 two-step 且含 moderate ambiguity，Hard 是 multi-step 且常有 conflicting constraints。
- 有 **21/100** scenarios 明確包含 self-correction / state rollback 類型。
- trailing silence 不是 digital silence，而是每位 speaker 額外錄 30 秒真實 ambient environment，用於更自然地測 end-of-turn behavior。

對你的資料管線來說，這篇最重要的是它把 disfluency 類型顯式標出，並且把語音事件連到 tool-use failure。這比單純 WER 或乾淨 transcript 更接近 full-duplex agent data 需要的 annotation granularity。

## 主要結果
作者評估六種設定：

- **GPT-Realtime**
- **Gemini Live 2.5**
- **Gemini Live 3.1**
- **Grok**
- **Ultravox v0.7**
- **Cascaded baseline**：Whisper -> GPT-4o -> OpenAI TTS

整體結果顯示，**GPT-Realtime 在 accuracy 與 interruption avoidance 上最穩**：

- GPT-Realtime：Pass@1 **0.600**，Tool Selection F1 **0.876**，Argument Accuracy **0.680**，Turn-take **96.0%**，Interruption **13.5%**。
- Gemini Live 3.1：Latency 最快，task completion latency **4.25s**，但 Turn-take 只有 **78.0%**，有一部分 case 會 silent tool execution。
- Cascaded baseline：Turn-take **100.0%**，但 latency 最慢，task completion latency **10.12s**，且 self-correction Pass@1 只有 **0.176**。
- Ultravox v0.7：Turn-take 也是 **96.0%**，但 Interruption 高達 **47.9%**，Filler rate **88.0%**，代表它常常太早或太空泛地回話。

依 difficulty 分層，所有模型在 Hard cases 都明顯下降。GPT-Realtime 仍最高，但 Hard Pass@1 也只有 **0.433**。這表示 multi-step reasoning、state tracking 和 disfluency handling 同時出現時，現有 voice agents 還沒有穩定解法。

依 disfluency 分析，self-correction 是最重要的壓力測試。GPT-Realtime 在 self-correction Pass@1 是 **0.588**，已經是最佳，但仍失敗超過 40%。Cascaded baseline 在 self-correction 只有 **0.176**，說明 ASR -> LLM -> TTS pipeline 會把早期 transcript commitment 和修正資訊處理得很差。

## Project relevance
**project-full-duplex-data：高度相關。**

這篇直接給出 full-duplex voice agent benchmark 應該怎麼設計：不是只看 overlap 或 turn-taking，而是把 turn-taking、tool call timing、state rollback、latency、interruption 和 natural disfluency 放進同一個 evaluation loop。對你要做的 mono-channel conversation audio -> useful multi-speaker / dual-channel data，FDB-v3 提供了很清楚的 annotation 方向：

- 標記 filler、pause、hesitation、false start、self-correction。
- 區分 provisional intent 和 confirmed intent。
- 把 correction point 對齊到後續 action/tool call。
- 評估 agent 是否在使用者尚未完成修正前 premature action。

**project-tts-data-pipeline：中度到高度相關。**

它不是 TTS model paper，但它對 TTS data pipeline 很有用，因為 full-duplex / conversational TTS 不能只學乾淨句子。若未來要合成自然 dual-channel conversation，資料格式需要能表達：

- `[pause]`, `[hesitation]`, `[filler]`, `[self-correction]` 這類事件。
- speaker turn 與 backchannel timing。
- 語意上被放棄的片段和最終有效 intent。
- agent 是否應該沉默等待、backchannel、或執行 tool call。

這些都會影響 TTS 訓練資料是否能支援自然 full-duplex dialogue synthesis，而不只是單輪朗讀。

## Related papers in my pool
- **WhisperD / Parakeet note**：WhisperD-style speaker/event annotations 可以和 FDB-v3 的 disfluency labels 接起來，形成更完整的 dialogue transcript format。
- **Echo-TTS**：Echo-TTS 使用 WhisperD-style prompt format；FDB-v3 則提供 conversational agent 場景中應該標哪些 disfluency / correction events。
- **Dia**：可比較 multi-speaker / dialogue TTS prompt format 是否能表達 FDB-v3 這類 hesitation、correction、turn-taking behavior。
- **Chatterbox TTS / Chatterbox-Flash 類 TTS work**：可作為語音生成端的 baseline，但需要額外控制 full-duplex timing 和 nonverbal event。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。此版本目前是 arXiv preprint，未看到正式 conference/journal venue 記錄。

## 我該不該細讀
**應該細讀。**

理由是這篇非常貼近你的 full-duplex data/model 主線，而且它不是泛泛談 voice agent，而是把 real speech disfluency、multi-step tool use、turn-taking、interruption 和 latency 全部量化。若你要設計自己的 full-duplex evaluation set 或資料標註規格，這篇可以直接當 checklist。

最值得細讀的部分：

- disfluency category definition
- scenario construction 和 difficulty tier
- self-correction / rollback examples
- turn-taking 與 interruption metric definition
- cascaded pipeline 在 self-correction 上失敗的 case study

## 可能的弱點 / open questions
- Dataset 只有 100 recordings，適合作為 benchmark seed，但還不能代表大規模 conversational speech distribution。
- 工具是 zero-latency mock API，能隔離 model 能力，但沒有測真實 API timeout、partial failure、permission denial 或 malformed response。
- Cloud model 評估仍受 server region、model update、runtime nondeterminism 影響，未來重跑可能有 drift。
- Disfluency 類別很有用，但 paper 摘要中沒有看到更細的 time-aligned annotation schema；若要用於訓練 full-duplex synthesis，還需要 word/phoneme/audio-level alignment。
- Benchmark 重點是 user -> agent tool use，較少處理 agent backchannel、overlap speech synthesis、dual-channel audio generation 這些生成端問題。

## Tags
- speech-llm
- audio-reasoning
- full-duplex
- speech-data
- tool-use
- disfluency
- project-full-duplex-data
- project-tts-data-pipeline

## Concepts
- full-duplex voice agent
- real-world disfluency
- self-correction
- state rollback
- multi-step tool use
- turn-taking
- interruption rate
- tool selection F1
- argument accuracy
- cascaded speech pipeline

## Citation
```bibtex
@misc{lin2026fullduplexbenchv3benchmarkingt,
  title={Full-Duplex-Bench-v3: Benchmarking Tool Use for Full-Duplex Voice Agents Under Real-World Disfluency},
  author={Guan-Ting Lin and Chen Chen and Zhehuai Chen and Hung-yi Lee},
  year={2026},
  eprint={2604.04847},
  archivePrefix={arXiv},
  primaryClass={eess.AS},
  doi={10.48550/arXiv.2604.04847}
}
```
