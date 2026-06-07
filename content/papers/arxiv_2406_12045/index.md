---
paper_key: arxiv_2406_12045
canonical_id: "arxiv:2406.12045"
title: "$τ$-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains"
year: 2024
venue: "arXiv preprint / NeurIPS 2024 Datasets & Benchmarks style submission"
url: "https://arxiv.org/abs/2406.12045"
pdf_url: "https://arxiv.org/pdf/2406.12045"
status: read
rating: 7
tags:
  - agent-evaluation
  - tool-use
  - task-oriented-dialogue
  - user-simulation
  - voice-agent
  - project-audio-model-evaluation
  - project-full-duplex-data
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `appendix.tex`, `main.bib`), the original GitHub repo, and the current tau-bench / tau2-bench repo notes. This is not an audio paper, but it is directly useful for voice-agent and full-duplex spoken tool-use evaluation design.

## Links
- [Original URL](https://arxiv.org/abs/2406.12045)
- [arXiv abstract](https://arxiv.org/abs/2406.12045)
- [PDF](https://arxiv.org/pdf/2406.12045)
- [arXiv source](https://arxiv.org/src/2406.12045)
- [Original GitHub repo](https://github.com/sierra-research/tau-bench)
- [Current tau2/tau3-bench repo](https://github.com/sierra-research/tau2-bench)
- [Leaderboard / project site](https://www.tau-bench.com/)

## 一句話總結
**τ-bench** 是一個 text-based customer-service agent benchmark：agent 必須在多輪對話中和 LM-simulated user 互動、使用 domain API tools、遵守 policy，最後用 database state 和 required outputs 做 deterministic evaluation；它最有價值的地方是把 agent 評估從單步 tool calling 推到 **human-agent-tool interaction reliability**，並提出 `pass^k` 量測同一任務多次互動的一致性。

## 這篇在解決什麼問題
現有 agent benchmark 常有三個問題：

1. **user instruction 一開始給太完整**  
   很多 tool-use benchmark 讓使用者一次提供所有必要資訊，agent 只要做 function call。真實 customer service 需要 agent 主動問問題、確認資訊、處理 user preference 和 partial information。

2. **缺少 domain policy following**  
   真實 agent 不只是完成任務，還要遵守退貨、改票、付款、安全確認、補償等 domain-specific rules。有些規則 API 不會自動檢查，必須靠 agent 自己讀 policy。

3. **平均成功率不等於可靠性**  
   agent 在同一個 task 上可能一次成功、下一次失敗。部署到大量使用者時，需要的是 consistency，而不是偶爾成功。

τ-bench 的核心是：把 customer-service agent 形式化成 **Tool-Agent-User Interaction**，讓 agent 在 stochastic conversation 中仍然達成唯一正確的 final database state。

## 核心方法
### 1) POMDP-style environment
每個 task 被寫成 partially observable environment：

```text
agent <-> user simulator
agent <-> database API tools
agent sees: policy + tool docs + conversation/tool observations
agent cannot see: hidden task annotation / full database state
```

State 被拆成：

- `S_db`：database state，例如 orders、products、reservations、users。
- `S_user`：user simulator state，包含 hidden task instruction 和 user-agent dialogue history。

Action 被拆成：

- `A_db`：API tool calls，例如 `return_delivered_order_items`、`book_reservation`。
- `A_user`：agent 對使用者說的自然語言。

這個設計比單步 function calling 更接近真實客服：agent 需要交替問 user、查 database、遵守 policy、再做 write actions。

### 2) Two domains: retail and airline
作者建立兩個 customer-service domains：

**τ-retail**

- databases：500 users、50 products、1000 orders。
- tools：7 write APIs、8 non-write APIs。
- tasks：115。
- 任務包含 cancel / modify pending orders、return / exchange delivered orders、modify address、提供 order/product/profile information。

**τ-airline**

- databases：500 users、300 flights、2000 reservations。
- tools：6 write APIs、7 non-write APIs。
- tasks：50。
- 任務包含 book / modify / cancel reservations、refund / certificate、baggage / passenger / cabin / payment constraints。

airline 明顯更難，因為 policy 有很多 ad-hoc constraints，例如 basic economy 不能改航班、baggage allowance 依 membership tier 和 cabin class 而變、部分規則 API 不會替 agent 檢查。

### 3) LM-simulated user
User simulator 用 `gpt-4-0613` 生成多輪 user utterances。hidden user instruction 包含：

- user identity。
- user intent。
- preferences。
- necessary constraints。
- 語氣或行為設定，例如 brief / sad / detail-oriented。

重要設計是：同一 task 在多次 trial 裡 semantic goal 不變，但 user wording / conversation flow 會變。這讓 benchmark 可以測 agent 是否對「同一意圖的不同對話實現」保持穩定。

### 4) Deterministic database-state evaluation
每個 task annotation 包含 ground-truth database write actions，以及必要時的 required outputs。最後 reward：

```text
r = r_action * r_output
```

- `r_action`：final database state 是否等於唯一正確 outcome。
- `r_output`：agent response 是否包含必要資訊，例如 refund amount、tracking ID、price difference。

這比讓 LLM judge 整段對話更穩定，也比較便宜。不過作者也承認 `r=1` 不是充分條件，因為 agent 可能沒取得 explicit confirmation 卻碰巧 final database 正確。

### 5) `pass^k`: reliability metric
一般 code generation 常用 `pass@k`：k 次裡有一次成功就算可發現解。τ-bench 反過來提出 `pass^k`：同一 task 的 k 次 independent trials 必須 **全部成功**。

直覺：

```text
pass@k  = discovery / can find a solution
pass^k  = reliability / consistently solves the task
```

對客服或 voice agent 來說，`pass^k` 比 `pass@k` 更符合 deployment risk。一次失敗可能就是錯退貨、錯改票、錯收費。

## Training / Data
這不是訓練 paper，而是 benchmark construction paper。

資料建立流程：

1. **Manual schema / API / policy design**  
   作者手動設計簡化但足夠真實的 database schemas、API tools、domain policy。

2. **LM-assisted data generation**  
   使用 GPT-4 幫忙產生 scalable database sampling code，再由人修 bug / polish。附錄展示 retail `users` database 生成 code。

3. **Manual task annotation and validation**  
   人寫 user instruction 和 expected actions，並用 `gpt-4-turbo` function-calling agent 跑 trial，反覆檢查 ambiguity。Retail tasks 還用超過 40 次 `gpt-4-turbo` trials 觀察 task difficulty 和 annotation 問題。

實驗設定：

- agent temperature：0.0。
- user simulator temperature：1.0。
- 每個 task 最多 30 agent actions。
- main results 每 task 至少 3 trials。
- agent methods：function calling、ReAct、Act-only。
- tested models：GPT-4o、GPT-4-turbo、GPT-4-32k、GPT-3.5-turbo、Claude 3 family、Gemini 1.5、Mistral Large、Mixtral 8x22B、Llama-3-70B。

## 主要結果
### 1) GPT-4o 仍然不到一半平均成功
Function calling main results：

- `gpt-4o`：retail 61.2、airline 35.2、avg 48.2。
- `gpt-4-turbo`：retail 57.7、airline 32.4、avg 45.1。
- `gpt-4-32k`：retail 56.5、airline 33.0、avg 44.8。
- `claude-3-opus`：retail 44.2、airline 34.7、avg 39.5。
- `gpt-3.5-turbo`：avg 15.4。
- open-weight tested models 明顯落後：`meta-llama-3-70B` avg 14.6，`mixtral-8x22b` avg 24.7。

最重要的訊號是：即使是 GPT-4o，在 airline domain 也只有 35.2 pass^1。

### 2) `pass^k` 暴露 consistency collapse
在 retail 上，最強的 GPT-4o function-calling agent pass^1 超過 60%，但 `pass^8` 掉到低於 25%。這代表：

- 平均一次成功不代表可部署。
- 同一 intent 在不同 conversation variation 下仍會不穩。
- real-world agents 需要 reliability objective，而不是只優化 single-run success。

### 3) Function calling 明顯優於 text ReAct / Act-only
作者比較不同 agent method，發現 native function calling 普遍勝過 text-formatted ReAct / Act-only。對 text methods 來說，ReAct reasoning traces 比 Act-only 有幫助，因為 tool observation 到 action 之間需要 reasoning bridge；但 FC models 加 `think` function 沒有明顯提升，可能因為 function-calling models 沒有被訓練成用這種 explicit reasoning tool。

### 4) 主要錯誤類型
作者人工分析 GPT-4o retail failures：

1. **Wrong argument / wrong information**  
   agent 選對 tool type，但填錯 item ID、payment method、product variant，或算錯 price / refund / tracking info。這類錯誤約佔 failures 的 55%。

2. **Wrong decision-making / policy following failure**  
   agent 沒有遵守 domain policy，例如 exchange tool 只能 call 一次，卻先交換一個 item，導致第二個 item 無法處理。這類約 25%。

3. **Partial resolution of compound requests**  
   多個 request / 多個 write actions 時，agent 常只處理一部分。ground-truth write actions 越多，任務越難。

### 5) Policy ablation 顯示模型不一定真的讀規則
移除 domain policy 後：

- retail：GPT-4o 61.2 -> 56.8，只掉 4.4。
- airline：GPT-4o 33.2 -> 10.8，掉 22.4。

解讀：retail 規則比較 commonsense，模型可能靠 prior 就能做不少；airline 規則比較 ad-hoc，沒有 policy 就嚴重失敗。這對 voice agent 也很重要：如果 spoken agent 背後要遵守業務規則，不能只靠通用模型 prior。

## Project relevance
**project-audio-model-evaluation：高度相關，尤其是 voice-agent evaluation。**

τ-bench 的 text setup 可以直接變成 spoken / full-duplex setup：

```text
spoken user <-> voice agent <-> tools / database
```

對 audio evaluation 的啟發：

- 評估不應只看 response 是否像人話，而要看 final tool/database state 是否正確。
- multi-turn voice agent 應測 `pass^k`，因為 ASR variation、barge-in、user rephrasing、latency 都會造成同一 intent 的多種 trajectory。
- rubric judge 應該補在 deterministic state evaluation 之外，用來檢查 policy compliance、confirmation、helpfulness、spoken grounding。
- 如果要做 AnyAudio-Judge + FlashTrace 式 grounded evaluator，τ-bench 提供很好的 task skeleton：每個 failure 可以追到 specific user utterance、agent turn、tool call、policy clause、database state。

**project-full-duplex-data：高度相關但需要 voice extension。**

這篇本體是 text half-duplex，但 current tau2/tau3-bench repo 已經明確提到 voice full-duplex evaluation mode。對我們的 full-duplex project，最值得借的是 task structure：

```text
user speech stream
  -> ASR / audio-native model
  -> dialogue policy / tool decision
  -> spoken response + tool call
  -> final database state
```

Full-duplex voice agent 不只要 turn-taking 自然，還要在 interruption / correction / overlap 下保持 task correctness。τ-bench 的 deterministic final-state evaluation 可以和 Full-Duplex-Bench 的 turn-taking / interruption metrics 結合：

- FDB-style metrics：是否該聽、該說、該停、該被打斷。
- τ-bench-style metrics：最後是否完成正確 tool/database outcome。

這可以避免一個常見問題：full-duplex benchmark 只評 latency / interruption，看不出 agent 是否真的幫 user 做對事情。

**project-tts-data-pipeline：低到中度相關。**

這不是 TTS data cleaning paper。但如果要建立 voice-agent TTS / dialogue synthesis data，τ-bench 的 scenario annotation 可以提供 controllable spoken dialogue prompts：

- user goal。
- domain policy。
- tool result。
- required response。
- success / failure labels。

這些可以轉成 spoken dialogue data generation templates，用來合成客服式 agent-user conversation，並加入 confirmation、correction、compound requests、policy denial 等語用現象。

## Related papers in my pool
- [[arxiv_2606_03116|AnyAudio-Judge]]：可補 τ-bench deterministic state check 缺少的 spoken quality / policy explanation / evidence-grounding rubrics。
- [[arxiv_2602_01914|FlashTrace]]：可用來定位 agent decision 依賴哪段 user utterance、policy clause 或 tool observation。
- [[arxiv_2605_27140|StepOPSD]]：τ-bench 的 failures 很適合 step-level credit assignment；不要只給整條 trajectory reward，而要定位錯誤 tool call / wrong argument / missing confirmation。
- [[arxiv_2604_04847|Full-Duplex-Bench-v3]]：可結合 τ-bench-style final task success，補足 full-duplex spoken dialogue 的 task correctness。
- [[arxiv_2603_14877|SoulX-Duplug]]：負責 streaming dialogue state / turn management；τ-bench 負責 tool/task outcome。
- [[arxiv_2405_19487|LLM-Enhanced Dialogue Management for Full-Duplex Spoken Dialogue Systems]]：把 dialogue control tokenized；τ-bench 提供更任務導向的 tool-use evaluation。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。TeX 使用 `neurips_data_2024` style，但 arXiv metadata 目前沒有正式 conference/journal reference；note 中以 arXiv / benchmark paper 記錄。

## 我該不該細讀
**如果你要做 voice-agent / full-duplex speech agent evaluation，值得細讀。**

優先讀：

1. Section 3：environment formulation、database/API/policy/user simulator/reward。
2. Section 4：benchmark construction，尤其是如何保證 unique final database outcome。
3. Section 5：`pass^k`、failure analysis、policy ablation。
4. Appendix：retail / airline policy 和 failure examples。

它不是 audio paper，但它給了 full-duplex voice agent 很缺的一塊：**task-level correctness evaluation**。

## 可能的弱點 / open questions
1. **`r=1` 不是充分成功條件**  
   final database state 正確，不代表 agent 過程中有遵守所有 policy，例如是否真的取得 explicit confirmation。作者也承認這點。

2. **user simulator 會引入 bias**  
   user LM 的能力、記憶、計算、instruction following 會影響 trajectory。若 user simulator 太配合，可能高估 agent；若 user simulator 出錯，可能低估 agent。

3. **task annotation 成本高**  
   為了 unique outcome，需要大量人工設計與驗證。這對擴到更多 domains 或 voice setting 會變貴。

4. **原始 repo tasks 已被標註為 outdated**  
   官方 GitHub 目前提醒原始 `tau-bench` tasks 未更新，建議使用 tau2/tau3-bench。若要實驗，應優先用 current repo / fixed tasks，而不是只跑 2024 原始版本。

5. **text benchmark 到 voice benchmark 會多出 ASR/TTS/full-duplex error**  
   voice setting 需要處理 ASR error、latency、barge-in、overlap、prosody、user interruption 和 acoustic grounding。這些不在 2024 τ-bench 本體中。

6. **deterministic state check 需要搭配 process-level checks**  
   對真實 customer service，錯誤不只在 final database，也在過程：有沒有說清楚、是否誤導 user、是否洩漏資料、是否違反安全確認。未來可加 rubric judge / policy trace / attribution audit。

## Tags
- `agent-evaluation`
- `tool-use`
- `task-oriented-dialogue`
- `user-simulation`
- `voice-agent`
- `project-audio-model-evaluation`
- `project-full-duplex-data`

## Concepts
- `tau-bench`
- `Tool-Agent-User Interaction`
- `function calling`
- `LM-simulated user`
- `database state evaluation`
- `domain policy following`
- `pass^k`
- `pass@k`
- `retail domain`
- `airline domain`
- `tool-use reliability`
- `task-oriented dialogue`
- `voice-agent evaluation`
- `full-duplex voice agent`

## Citation
```bibtex
@misc{yao2024benchabenchmarkfortoolagentuse,
  title={$τ$-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains},
  author={Shunyu Yao and Noah Shinn and Pedram Razavi and Karthik Narasimhan},
  year={2024},
  eprint={2406.12045},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  doi={10.48550/arXiv.2406.12045}
}
```
