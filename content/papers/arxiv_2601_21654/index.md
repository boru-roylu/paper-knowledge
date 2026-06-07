---
paper_key: arxiv_2601_21654
canonical_id: "arxiv:2601.21654"
title: "ScholarGym: Benchmarking Large Language Model Capabilities in the Information-Gathering Stage of Deep Research"
year: 2026
venue: "arXiv preprint / ICML 2026 style submission"
url: "https://arxiv.org/abs/2601.21654"
pdf_url: "https://arxiv.org/pdf/2601.21654"
status: read
rating: 6
tags:
  - deep-research
  - research-agent
  - academic-retrieval
  - agent-evaluation
  - information-gathering
  - project-audio-model-evaluation
created: 2026-06-07
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`main.tex`, `sec/*.tex`) plus the official GitHub repository. This is not an audio paper; it is included because it gives a useful decomposable evaluation pattern for research agents and paper-ingestion workflows.

## Links
- [Original URL](https://arxiv.org/abs/2601.21654)
- [arXiv abstract](https://arxiv.org/abs/2601.21654)
- [PDF](https://arxiv.org/pdf/2601.21654)
- [arXiv source](https://arxiv.org/src/2601.21654)
- [Official GitHub repo](https://github.com/shenhao-stu/ScholarGym)
- [HuggingFace dataset](https://huggingface.co/datasets/shenhao/ScholarGym)
- [ModelScope dataset](https://modelscope.cn/datasets/shenhao23/ScholarGym)

## 一句話總結
**ScholarGym** 把 deep research 的 information-gathering 階段拆成 **Query Planning -> Tool Invocation -> Relevance Assessment** 三個可分開評估的模組，並用 570K static paper corpus + 2,536 expert-annotated queries 建立可重現的 academic retrieval environment，避免 live search API 的 non-determinism 讓 model / workflow / environment 混在一起。

## 這篇在解決什麼問題
Deep research agent 通常是 end-to-end 評估 final report，例如看報告是否完整、引用是否正確、結論是否合理。但這種評估有幾個問題：

1. **final report score 太耦合**  
   分數同時反映 query planning、retrieval tool、ranking、evidence filtering、summarization、citation formatting、writing style。最後分數低時，很難知道到底是沒有找到 paper，還是找到了但丟掉，或是摘要寫壞。

2. **live web / search API 不可重現**  
   同一 query 在不同時間可能回傳不同結果；API rate limit、anti-scraping、index update、URL timeout 都會污染評估。這對比較模型或訓練 RL policy 很不利。

3. **academic research 的 upstream information gathering 很關鍵**  
   如果資料找錯，後面再強的 synthesis 都沒用。作者因此不評 final survey report，而是先 isolating information-gathering stage。

ScholarGym 的立場是：deep research evaluation 應先變成可控的 environment，讓我們能分解診斷「模型如何規劃 query、如何調用 tool、如何篩 relevance」。

## 核心方法
### 1) Unified deep research workflow
ScholarGym 固定一個 iterative workflow，每輪有三段：

```text
Query Planning
  -> Tool Invocation
  -> Relevance Assessment
  -> feedback / memory
  -> next iteration
```

輸入是一個 research query `q` 和 date constraint `d`；輸出是一組 selected papers `S`。

### 2) Query Planning
Query planner 讀取：

- original query。
- previous subquery tree。
- experience buffer。
- 上一輪 relevance feedback。

然後產生新的 search plan。它支援三種操作：

- **Derive**：從既有 query 產生更 specific 的 child query，例如 `transformer efficiency -> sparse attention`。
- **Expand**：產生 sibling query，探索另一個 aspect。
- **Continue**：對既有 subquery 要更多結果。

這比單次 search 更符合真實 deep research：一個問題通常要被拆成 methodology、dataset、application、evaluation 等多個 search facet。

### 3) Tool Invocation
Tool invocation 把 plan 轉成 structured retrieval calls：

```text
(query string, top-k, date constraint)
```

retrieval backend 有兩種：

- **Sparse retrieval**：BM25 over title + abstract。
- **Dense retrieval**：Qwen3-Embedding-0.6B + Qdrant vector database。

關鍵是所有 retrieval 都在 static corpus 上跑，因此相同 tool call 得到 deterministic results。

### 4) Relevance Assessment
Relevance assessment 對 retrieved candidates 做分類 / 選擇：

- **Abstract-only**：只看 title / abstract 判斷相關。
- **Adaptive browsing**：允許 `uncertain`，對不確定 candidate 進一步讀 full text 再決定。

這個 stage 會輸出：

- selected papers `S_t`。
- feedback `O_t`：給下一輪 planner，用來指出目前找到什麼、缺什麼。

### 5) Memory mechanism
作者設計兩種 memory：

- **Subquery tree**：記錄 query decomposition path 和每個 node 的 retrieved papers。
- **Experience buffer**：把歷史 search / assessment 壓縮成 fixed-length summary，避免 context overflow，也避免後續 query planning 重複探索同一區域。

Memory ablation 顯示它不是裝飾：拿掉 experience buffer 會讓 F1 下降 6-22%，尤其 thinking-enabled models 因為 reasoning traces 更長，更容易被 raw history 干擾。

## Training / Data
這篇不是訓練新模型，而是 benchmark / environment。

Dataset 來源：

- **PaSa-AutoScholar**：從 citation contexts 生成的 query。
- **PaSa-RealScholar**：human-curated research questions。
- **LitSearch**：real-world literature search scenarios。

Corpus construction：

- 聚合 PaSa / LitSearch paper corpus。
- 以 arXiv identifier deduplicate。
- 用 arXiv API 補 metadata。
- 過濾空 abstract、invalid identifier、1990-2024 之外的 papers。
- 最後得到 **570K papers**，涵蓋 computer science、physics、mathematics。

Benchmark：

- 全量：2,536 expert-annotated queries，平均每 query 2.3 ground-truth papers。
- Test-Fast：200 queries，平均 1.9 GT papers，用於快速開發。
- Test-Hard：100 queries，平均 2.6 GT papers，是所有 models 表現差的 harder subset。

Evaluation setup：

- default `T=5` iterations。
- greedy decoding，temperature 0。
- main results 用 sparse retrieval + Abstract-only assessment。
- 模型包含 Qwen3 8B / 30B、GLM-4.7、DeepSeek-V3.2、GPT-5.2、Gemini3-Pro；Qwen3 和 DeepSeek 另測 extended thinking mode。

## 主要結果
### 1) Iterative query decomposition 明顯勝過 Direct Query
Direct Query baseline 只把原始 query 丟給 retrieval backend，不做 iterative decomposition。

Test-Fast 上：

- Qwen3-8B：Direct Query F1 0.069 -> full workflow 0.231，提升 3.3x。
- Qwen3-30B：Direct Query F1 0.098 -> full workflow 0.285，提升 2.9x。

這支持一個實務直覺：複雜 research query 需要分解成多個 search facets，單一 query 很容易漏掉跨領域 / 跨方法的 relevant papers。

### 2) GPT-5.2 best F1，Gemini3-Pro best recall
Test-Fast main results：

- **GPT-5.2**：R 0.837、P 0.305、F1 0.447，最佳 F1。
- **Gemini3-Pro**：R 0.950、P 0.199、F1 0.329，最高 recall。
- **DeepSeek-V3.2 thinking**：F1 0.423，接近 GPT-5.2。
- best open-source：Qwen3-30B thinking，F1 0.362。

作者的解讀是：Gemini3-Pro 很會擴張 search coverage；GPT-5.2 在 recall / precision 間平衡較好。

### 3) Extended thinking 通常提高 precision、犧牲 recall
Qwen3-8B thinking：

- precision：0.152 -> 0.216。
- recall：0.483 -> 0.458。
- F1：0.231 -> 0.293。

Qwen3-30B thinking：

- precision：0.181 -> 0.290。
- recall：0.673 -> 0.482。
- F1：0.285 -> 0.362。

DeepSeek-V3.2 thinking：

- precision：0.135 -> 0.287。
- recall：0.855 -> 0.812。
- F1：0.233 -> 0.423。

這個 pattern 很有意思：extended thinking 在這裡比較像 **更嚴格的 relevance filter**，不是單純發現更多 paper。它會把 precision 拉高，但也會丟掉一些 relevant papers。

### 4) Query Planning 和 Relevance Assessment 是雙瓶頸
作者引入兩個 diagnostic metrics：

- **Avg.Distance**：ground-truth paper 在 retrieval results 中出現得多前面，衡量 query planning quality。
- **GT Discard Rate**：retrieved ground-truth papers 被 relevance assessment 錯丟的比例。

結果：

- Gemini3-Pro Avg.Distance 最高，平均 0.845；proprietary models 整體比 open-source 高約 43%。
- Proprietary models 的 GT Discard Rate 通常低於 0.20%。
- Qwen3-30B thinking 有較高 precision，但 GT Discard Rate 也高，表示它靠 aggressive filtering 提升 precision。

這對 research agent 很重要：有些模型找不到 paper是 planning / query formulation 問題；有些模型其實 retrieve 到了，但 relevance assessment 錯丟。

### 5) Dense retrieval 和 Adaptive Browsing 有幫助，但不是萬靈丹
Dense retrieval：

- 對 standard Qwen3 models 有較大 recall gain，例如 Qwen3-8B recall 0.483 -> 0.608。
- 對 thinking-enabled models gain 較小，因為 strict filtering 限制了 retrieval recall 的轉換。

Adaptive Browsing：

- 對 open-source models 可降低 GT Discard Rate 約 30-40%。
- 對 proprietary models 影響小，因為 abstract-only assessment 已經很準。

## Project relevance
**Paper Knowledge / Telegram ingestion：高度相關。**

這篇非常適合拿來反思我們自己的 paper-knowledge workflow。目前使用者丟 URL，我們通常做：

```text
URL
  -> fetch arXiv / TeX / metadata
  -> summarize
  -> tag / project relevance
  -> publish
```

但當使用者問「幫我找最新 data cleaning paper」或「幫我整理 full-duplex project 相關 papers」時，問題變成 deep research。ScholarGym 提醒我們應該把 paper discovery 拆成可診斷模組：

```text
Query Planning: 把研究問題拆成 search facets
Tool Invocation: arXiv / Semantic Scholar / GitHub / OpenReview / local paper pool
Relevance Assessment: 判斷 paper 是否真的相關
Memory: 記錄已探索 topic / 已排除 papers / 下一輪缺口
```

這對 Telegram bot / Codex worker 很直接：不要只讓 LLM free-form search，而要記錄 subqueries、retrieved candidates、selected papers、discard reasons。

**project-audio-model-evaluation：中度相關。**

ScholarGym 不是 audio evaluator，但它的 decomposable evaluation pattern 可以借到 audio research-agent evaluation：

- 評估一個 audio research assistant 是否能找到正確 papers，不要只看最後回答。
- 將 retrieval-stage recall 和 selection-stage precision 分開。
- 對 AnyAudio-Judge / FlashTrace 類研究，也可建立 static paper / benchmark corpus，避免 live search drift。
- 對 audio reasoning / speech LLM survey generation，可用 GT paper set 檢查 coverage，而不是只靠人工讀 final report。

**project-full-duplex-data / project-tts-data-pipeline：間接相關。**

當我們要找 data cleaning、diarization、overlap detection、TTS dataset construction 相關 paper 時，ScholarGym 的 workflow 可以當自動文獻探索框架。它不處理 audio data，但可以幫我們訓練/評估「找 paper 的 agent」。

## Related papers in my pool
- [[arxiv_2406_12045|τ-bench]]：同樣主張把 agent evaluation 變成可分解、可重現的 environment；τ-bench 評 tool-agent-user task success，ScholarGym 評 research-agent information gathering。
- [[arxiv_2605_27140|StepOPSD]]：可用來把 ScholarGym 的 stage-level reward / failure 拆成 step-level credit assignment，例如哪個 query planning action 導致 retrieval coverage 變好。
- [[arxiv_2602_01914|FlashTrace]]：可檢查 final research answer / selection decision 是否依賴正確 retrieved paper / abstract span。
- [[arxiv_2606_03116|AnyAudio-Judge]]：若要做 audio research assistant，ScholarGym-style static corpus + AnyAudio-Judge-style rubric 可合成可評估的 research workflow。
- [[arxiv_2512_07805|GRAPE]]：long-context positional encoding；research agent 的 memory / long retrieval history 也會受到 long-context modeling 影響。

## OpenReview / reviewer discussion
未找到公開 OpenReview review/rebuttal context。arXiv page 顯示 submitted on January 29, 2026，last revised February 17, 2026，版本 v3；source 使用 `icml2026` style，但 arXiv metadata 未列正式 venue。

## 我該不該細讀
**如果你想把 Telegram / Codex 做成更可靠的 paper discovery agent，值得細讀。**

優先讀：

1. Method 的 workflow decomposition。
2. metrics：retrieval vs selection、Avg.Distance、GT Discard Rate。
3. memory mechanism 和 ablation。
4. Appendix prompt templates，尤其 Query Planning prompt。

如果只關心 TTS model architecture 或 speech data cleaning，這篇不是直接相關。但對「如何讓 agent 幫你找 paper，而且知道自己找漏了什麼」很有用。

## 可能的弱點 / open questions
1. **只評 information gathering，不評 final synthesis**  
   這是刻意設計，但也代表不能直接回答 final research report 是否有洞察、是否正確整合。

2. **GT paper set 可能不完整**  
   Academic retrieval 的 relevant papers 很難有完美全集。即使用 expert annotations，也可能漏掉合理 alternative papers。

3. **Static corpus 代表可重現，但可能落後**  
   對最新 paper discovery，static 570K corpus 和 live arXiv / web search 之間會有落差。實務系統可能需要 static eval + live mode 兩套。

4. **主要 corpus 限 arXiv metadata / title / abstract**  
   很多 paper relevance 需要讀方法細節、實驗表或 code。Adaptive Browsing 有補，但 main results 還是以 Abstract-only 為主。

5. **模型名和結果是 2026 時點**  
   GPT-5.2、Gemini3-Pro、DeepSeek-V3.2、Qwen3/GLM-4.7 的相對表現會隨模型更新而改變。這篇更穩定的貢獻是 benchmark design，不是 leaderboard。

6. **沒有直接 audio / speech task**  
   對我們的 audio projects，這篇是 research-agent infrastructure，不是 acoustic model 或 evaluator。

## Tags
- `deep-research`
- `research-agent`
- `academic-retrieval`
- `agent-evaluation`
- `information-gathering`
- `project-audio-model-evaluation`

## Concepts
- `ScholarGym`
- `deep research workflow`
- `Query Planning`
- `Tool Invocation`
- `Relevance Assessment`
- `subquery tree`
- `experience buffer`
- `static paper corpus`
- `deterministic retrieval`
- `BM25`
- `dense retrieval`
- `Qwen3-Embedding-0.6B`
- `Qdrant`
- `Avg.Distance`
- `GT Discard Rate`
- `Adaptive Browsing`

## Citation
```bibtex
@misc{shen2026scholargymbenchmarkinglargelan,
  title={ScholarGym: Benchmarking Large Language Model Capabilities in the Information-Gathering Stage of Deep Research},
  author={Hao Shen and Hang Yang and Zhouhong Gu and Weili Han},
  year={2026},
  eprint={2601.21654},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  doi={10.48550/arXiv.2601.21654}
}
```
