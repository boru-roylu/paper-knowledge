---
paper_key: arxiv_2606_07229
canonical_id: "arxiv:2606.07229"
title: "MMAE: A Massive Multitask Audio Editing Benchmark"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2606.07229"
pdf_url: "https://arxiv.org/pdf/2606.07229"
status: read
rating: 0
tags:
  - audio-editing
  - audio-evaluation
  - rubric-judge
  - benchmark
  - speech-llm
  - project-audio-model-evaluation
created: 2026-06-27
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

> Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`paper.tex`, `sections/*.tex`, `tables/result.tex`) and the released code/data links embedded in the paper.

## Links

- [Original URL](https://arxiv.org/abs/2606.07229)
- [arXiv abstract](https://arxiv.org/abs/2606.07229)
- [PDF](https://arxiv.org/pdf/2606.07229)
- [arXiv source](https://arxiv.org/src/2606.07229)
- [Official GitHub repo](https://github.com/ddlBoJack/MMAE)
- [Hugging Face dataset](https://huggingface.co/datasets/BoJack/MMAE)

## 一句話總結

**MMAE** 是一個 general-purpose instruction-based audio editing benchmark：它把 speech、sound、music 和 mixed audio editing 任務拆成 2,000 個 samples、17,741 個 atomic rubrics，用 Qwen3-Omni 作外部 audio MLLM judger，評估模型是否同時做到 instruction following 和 context consistency；結果顯示現有 audio editing systems 的 Exact Match Rate 幾乎都低於 5%，複雜 mixed-modality editing 甚至常常是 0%。

## 這篇在解決什麼問題

作者認為 audio editing 正在從單一任務走向 interactive intelligent creation：使用者會用自然語言要求模型修改 speech、music、sound effects，甚至要求多輪、跨 modality、帶 reasoning 的編輯。但現有 evaluation infrastructure 太碎：

- speech editing benchmark 通常只看 speech-only editing，例如補字、替換詞、voice cloning。
- sound editing benchmark 常只看 event addition / removal / replacement。
- music editing 又是另一套 evaluation。
- 很多 metric 只能給 coarse score，無法指出哪個 instruction 沒做、哪個原始內容被不該改地破壞。

這篇的核心問題是：**如何評估 free-form instruction audio editing 是否真的做對，而且能診斷錯在哪裡？**

MMAE 的答案是 rubric-based evaluation。每個 sample 不是只給一個總分，而是把任務拆成多個可驗證 criteria，例如「指定 sound event 是否被保留」、「某段 speech 是否被移除」、「background 是否不應改變」、「時間區間內的 dominant sound 是否正確」。這對 audio editing 比單純 FAD / CLAP / WER / MOS 更可診斷。

## 核心方法

### 1) 三軸 taxonomy

MMAE 用三個 orthogonal dimensions 組合 audio editing 任務。

**Modality** 有 7 類：sound、music、speech、sound-music、sound-speech、music-speech、sound-music-speech。這點很重要，因為 real-world audio editing 常常不是純 speech 或純 sound，而是 speech + background music + environmental sound 混在一起。

**Complexity** 有 6 級：

- `Single`：單一元素、單一操作。
- `Multi-part`：一個 instruction 涉及多個元素。
- `Multi-instruction`：多個獨立 instruction 合在一起。
- `Multi-audio`：需要多個 audio sources。
- `Multi-round`：多輪 iterative editing，後面編輯依賴前面結果。
- `Multi-hop`：需要中間推理才能知道該改什麼。

**Operation** 分 local / global：

- local：addition、removal、replacement、extraction、alteration。
- global：background change、foreground change、global alteration。

### 2) Rubric-based evaluation

每個 sample 有一組 rubrics。rubric 是 multiple-choice question，其中一個正確選項代表 editing 成功，其他選項代表失敗。外部 audio language model 看 edited audio 和相關條件後選答案，再和 ground-truth choice 比對。

作者把 rubrics 分成兩個 evaluation dimensions：

- **Instruction Following Rate (IFR)**：模型是否做了 instruction 要求的修改。
- **Consistency Rate (CR)**：模型是否保留了不該被改動的 acoustic context。
- **Exact Match Rate (EMR)**：一個 sample 的所有 rubrics 都正確才算成功。

這個設計刻意避免單一總分。audio editing 有天然 trade-off：模型可以什麼都不改來拿高 CR，也可以亂改來碰巧滿足少數 IF rubrics，但真正好的 editor 必須同時高 IFR 和高 CR。

### 3) Human-agent collaborative data curation

資料流程分五步：

1. **Brainstorming**：expert annotators 收集多樣 audio editing scenarios。
2. **Taxonomy & paradigm construction**：定義 modality / complexity / operation taxonomy 和 rubric evaluation paradigm。
3. **Instruction-centric data collection**：annotators 從 online videos 搜尋 audio、裁切 clips、寫 instruction、標 metadata，並沿 taxonomy 做 dynamic balancing。
4. **Rubrics annotation**：先用 Omni-Detective 產生 detailed audio captions，再用 LLM 根據 captions、instruction、metadata 產生 rubric drafts；human annotators 再增刪與修正，最後用 LLM 做 normalization。
5. **Quality inspection**：blind inspectors 做 cross-review；不合格 samples 迭代修正，不能修的丟棄。

### 4) External judge protocol

實驗使用 **Qwen3-Omni** 作 external MLLM judger。每個 rubric 會獨立 query 3 次，使用 majority vote；選項順序會 shuffle，降低 positional bias。這比一次 judge answer 穩定，但也代表 benchmark 的可信度仍依賴 Qwen3-Omni 的 audio perception / reasoning 能力。

## Training / Data

這篇主要是 benchmark，不是訓練新 model。

MMAE 統計：

- Total samples：2,000
- Total rubrics：17,741
- Avg. rubrics / sample：8.87
- Avg. IF rubrics / sample：3.58
- Avg. consistency rubrics / sample：5.29
- Avg. operations / sample：1.22
- Avg. audio duration：14.46 sec
- Avg. instruction length：14.00 words
- Avg. choices / rubric：3.53
- Avg. rubric question length：25.45 words

Benchmarking candidates：

- Step-Audio-EditX
- Ming-UniAudio
- MMEdit
- Audio-Omni
- SmartDJ without planner
- SmartDJ with planner

Step-Audio-EditX 和 Ming-UniAudio 跑 full 2,000 samples。MMEdit、Audio-Omni、SmartDJ 因 input length 或 training duration 限制，只在 duration <= 10s 的 801 samples 上評估。

Reference baselines：

- `Identity`：直接輸出原音訊，不做任何改動。
- `Noise`：輸出同長度 Gaussian noise。

這兩個 baseline 揭示 IFR / CR 的 trade-off：Identity CR 很高但 IFR 低；Noise 偶爾會碰巧滿足 deletion 類 IF rubric，但 CR 幾乎崩掉。

## 主要結果

### 1) 現有模型離 reliable editing 還很遠

Full set 上：

- Step-Audio-EditX：IFR 44.86%、CR 58.88%、EMR 3.05%。
- Ming-UniAudio：IFR 29.82%、CR 52.71%、EMR 3.20%。

<=10s subset 上：

- Audio-Omni 最強：IFR 50.73%、CR 56.93%、EMR 4.99%。
- MMEdit：IFR 43.12%、CR 47.64%、EMR 3.50%。
- SmartDJ w/o planner：IFR 38.20%、CR 55.41%、EMR 4.62%。
- SmartDJ w/ planner：IFR 42.26%、CR 48.33%、EMR 3.12%。

核心 takeaway：平均 IFR / CR 看起來有基本能力，但 **EMR 幾乎都低於 5%**，表示模型很少能把一個 sample 的所有要求都完整做對。

### 2) Mixed modality 明顯更難

模型在 speech-only 通常相對好一些，尤其 consistency；例如 Step-Audio-EditX speech CR 達 77.27%。但 mixed audio，尤其 sound-music-speech，是最難的類型。

這對我們很關鍵：future full-duplex / dialogue audio generation 不只是 speech content，還包含 overlapping speech、背景聲、turn-taking、nonverbal events。MMAE 的 mixed-modality 結果說明，現在模型在「改某一層、保留其他層」這件事上還很弱。

### 3) IFR 和 CR 是基本 trade-off

Identity baseline：

- IFR 27.37%
- CR 94.13%
- EMR 4.60%

Noise baseline：

- IFR 32.08%
- CR 15.68%
- EMR 0%

這說明若只看單一 metric 很容易被 hack。什麼都不改可以拿高 consistency；亂輸出 noise 也可能在某些 removal / extraction rubric 上誤中。MMAE 報 IFR + CR + EMR 是合理的。

### 4) 平均能力不等於 flawless execution

Step-Audio-EditX 的 IFR / CR 高於 Ming-UniAudio，但 EMR 反而略低：

- Step-Audio-EditX：IFR 44.86%、CR 58.88%、EMR 3.05%。
- Ming-UniAudio：IFR 29.82%、CR 52.71%、EMR 3.20%。

作者把這解讀成 mean-seeking vs mode-seeking：Step-Audio-EditX 像 generalist，很多 sample 部分做對但小錯誤多；Ming-UniAudio 失敗很多，但成功時較容易全部命中。

### 5) Planner 沒有穩定改善

SmartDJ with planner 的 IFR 比 without planner 高，但 CR 下降，EMR 也沒有明顯變好。作者認為原因是 planner 會誤解 audio context，base generator 不一定能可靠執行 atomic operations，多步 cascade 又會累積 artifacts。

這和我們之前討論 PlanAudio / audio reasoning 很相關：planning 不是萬靈丹；如果 perception 和 generation 本體弱，外掛 planner 可能只是把錯誤拆得更細，還增加 degradation。

## Project relevance

### project-audio-model-evaluation：非常高相關

MMAE 幾乎直接補上 AnyAudio-Judge 之外的另一個 benchmark template：

- AnyAudio-Judge：偏 instruction-following / audio generation correctness 的 dynamic yes/no rubrics。
- MMAE：偏 audio editing，明確拆成 IFR、CR、EMR，且把 consistency 作為獨立核心指標。

對我們的 audio evaluation project，MMAE 最值得借的是：

- **IFR vs CR 分開報**：避免模型靠不改音訊拿高分，或靠亂改碰巧滿足局部 rubric。
- **EMR 作 reliability metric**：真實使用者要的是整個 edit 都對，不是平均一半對。
- **mixed-modality taxonomy**：sound/speech/music 混合時，rubric 必須問「改目標層」和「保留非目標層」。
- **time-span rubric format**：appendix 的例子已經包含 `<audio output[4.0s:5.7s]>` 這種局部 evidence span，很接近我們想做的 grounded rubric / FlashTrace-style audio span attribution。

### project-full-duplex-data：中高相關

雖然 MMAE 不是 full-duplex dialogue benchmark，但它的 editing formulation 可以轉成 full-duplex data repair：remove speaker leakage、preserve speaker B backchannel、replace overlapped segment with cleaner separated speech、keep non-target speaker timing unchanged。MMAE 的 IFR / CR 很適合評估 dual-channel recovery。

### project-tts-data-pipeline：中度相關

TTS data cleaning 常常也是 editing / filtering 問題：移除噪音、刪掉 overlap、保留 speech content、修正 transcript mismatch。MMAE 的 rubric annotation pattern 可以改成 TTS data QA：speech content 是否仍可辨識、target speaker 是否被保留、non-speech event 是否被移除、edited clip 是否破壞 prosody / naturalness。

## Related papers in my pool

- [[arxiv_2606_03116|AnyAudio-Judge]]：最直接相關。兩者都是 rubric-based audio evaluation；MMAE 更重 audio editing 的 instruction following / consistency trade-off。
- [[arxiv_2602_01914|FlashTrace]]：MMAE 的 time-span rubrics 可作為未來 audio span attribution 的 seed。若 judge 判某 rubric fail，FlashTrace-style 方法可追到哪段 audio token / transcript span 造成 fail。
- [[arxiv_2605_27140|StepOPSD]]：提供 step-aware credit assignment framing；可把 MMAE 的 clip-level rubric score 轉成 span-level / operation-level credit。
- [[arxiv_2510_08425|DGPO]]：MMAE rubrics 可變成 audio editing reward；DGPO-style group preference optimization 可以用於 audio diffusion / flow editor post-training，但要防 reward hacking。
- [[arxiv_2605_28063|PlanAudio]]：MMAE 可評估 speech+sound composite generation / editing 的 correctness 和 consistency。
- [[arxiv_2604_04847|Full-Duplex-Bench-v3]]：FDB-v3 偏 voice-agent / full-duplex interaction；MMAE 的 rubric design 可借來補 full-duplex audio editing / repair metrics。
- [[arxiv_2603_29339|LongCat-AudioDiT]]、[[arxiv_2509_24650|VoxCPM]]：可作未來 audio editing / generation target model，並用 MMAE-style rubrics 做更細 evaluation。

## OpenReview / reviewer discussion

未找到公開 OpenReview review/rebuttal context。這篇目前以 arXiv preprint 記錄。

## 我該不該細讀

建議細讀，尤其是你要做 **audio model evaluation / grounded rubric dataset / reward model for audio generation or editing**。

最值得讀：

- taxonomy：modality / complexity / operation 怎麼拆。
- rubric design principles：Completeness、Atomicity、Orthogonality、Objectivity。
- IFR / CR / EMR：這三個 metric 如何避免 reward shortcut。
- data curation pipeline：human-agent collaborative annotation + blind inspection。
- appendix metadata format：每個 sample 如何存 messages、audio_url、tags、rubrics。

如果只關心 TTS synthesis model 本身，不需要把整篇當核心方法讀；但它對「怎麼評估一個模型有沒有真的遵守 instruction 並保留原始內容」非常有價值。

## 可能的弱點 / open questions

1. **External judge 依賴 Qwen3-Omni**

   MMAE 的分數取決於 Qwen3-Omni 是否能可靠聽懂 audio、讀懂 rubric、辨別局部 time span。若 judge 對某些 sound/music/speech mix 有偏差，benchmark score 也會偏。

2. **Rubric 是 multiple-choice，不等於 grounded explanation**

   multiple-choice 比 yes/no 更結構化，但仍不保證 judge 的 reasoning grounded in correct audio span。這正好可以和 FlashTrace / grounded audio attribution 結合。

3. **Human annotation cost 高**

   17,741 rubrics 很有價值，但這種 benchmark 很難快速擴展到每個新 domain。未來需要 semi-automatic rubric generation + human verification loop。

4. **EMR 非常嚴格但可能太 sparse**

   EMR 對 reliability 很有意義，但作為 training reward 可能太 sparse。若要拿 MMAE 做 RL，需要把 rubric-level score、span-level score、operation-level score拆開。

5. **Editing 和 generation 的界線**

   MMAE 評估 audio editing，不是純 prompt-to-audio generation。對 PlanAudio / one-step audio generation，要明確定義 input audio 是否存在、哪些內容需要保留。

6. **Time-span rubrics 值得深挖**

   appendix 已經出現 `<audio output[2.0s:15.0s]>` 這種 localized criterion。這可能是我們做 audio token attribution / evidence-grounded judge 的切入點。

## Tags

- `audio-editing`
- `audio-evaluation`
- `rubric-judge`
- `benchmark`
- `audio-reasoning`
- `speech-llm`
- `project-audio-model-evaluation`
- `project-full-duplex-data`
- `project-tts-data-pipeline`

## Concepts

- Massive Multitask Audio Editing
- rubric-based audio evaluation
- Instruction Following Rate
- Consistency Rate
- Exact Match Rate
- audio editing benchmark
- mixed-modality audio
- speech sound music editing
- grounded rubric
- audio MLLM judge
- Qwen3-Omni judge
- human-agent collaborative annotation
- time-span audio rubric
- instruction following vs context preservation

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{ma2026mmaeamassivemultitaskaudioedit,
  title={MMAE: A Massive Multitask Audio Editing Benchmark},
  author={Ziyang Ma and Ruiqi Yan and Ruiyang Xu and Jie Fang and Zhikang Niu and Yi-Wen Chao and Wenming Tu and Tianrui Wang and Auden and Qi Chen and Wenxi Chen and Jiaying Chi and Yanru Huo and Zixuan Jiang and Xiquan Li and Yalin Li and Junxi Liu and Minghao Liu and Binghao Qiang and Yijia Shan and Zheshu Song and Tian Tan and Zixiang Wang and Zeyu Xie and Zhifei Xie and Xiaoyu Xing and Qixiang Xu and Chen Yang and Guanrou Yang and Shan Yang and Yifan Yang and Steve Yves and Haotian Zhang and Haina Zhu and Kai Yu and Liefeng Bo and Eng-Siong Chng and Xie Chen},
  year={2026},
  eprint={2606.07229},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2606.07229}
}
```
