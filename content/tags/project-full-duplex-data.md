---
title: "Project: Full-duplex data and model"
---

## Motivation

我們想要訓練更自然的 full-duplex speech model。真正的人類對話不是乾淨的 turn-by-turn：會有 backchannel、overlap speech、interruption、repair、hesitation，以及一方還沒完全講完另一方就開始回應的情況。這些現象如果只靠文字 transcript 或單純 turn-level dialogue data，很難學到 timing、interaction policy 和 speaker-wise acoustic behavior。

目前可取得的大量資料常常是 mono-channel / monaural conversation audio。這些資料有用，但問題是兩個 speaker 混在同一條 audio track 裡，尤其 overlap 區域很難知道誰說了什麼、誰在 backchannel、哪裡是自然的 interruption。因此這條 project line 的核心是：把自然 mono-channel 對話轉成可用於 full-duplex model training 的 speaker-wise / dual-channel data，並進一步研究如何合成自然的 overlap 與 backchannel。

## Updated thesis

現在看完新一批 paper 後，這個 project 不應只被定義成「speech separation」或「dialogue TTS」。比較合理的 framing 是：

> **先把 full-duplex dialogue 拆成可觀測、可生成、可評估的中間表示，再用 data recovery + synthetic generation + rubric evaluation 形成閉環。**

建議的中間表示不是單純 transcript，而是：

- speaker-wise transcript：`[S1]`, `[S2]`
- time-aligned turns：start / end / pause / overlap
- event tags：`[backchannel]`, `[laughs]`, `[breath]`, `[hesitation]`, `[repair]`
- interaction states：start-listening / start-speaking / continue-speaking / interruption
- optional acoustic scene tags：background noise、room tone、recording channel、distance
- provenance：real separated / restored / synthetic / edited

## Target

- 從 mono-channel two-speaker dialogue 中分離 speaker-wise tracks。
- 特別處理 overlap speech，而不是把 overlap 當成 noise 移除。
- 建立可訓練 full-duplex model 的 dual-channel conversation data。
- 給定 transcript / control signals，自動 synthesize 出自然、有 backchannel、有 overlap timing 的 dual-channel conversation。
- 因為 transcript / generation plan 是我們控制的，所以可以知道哪裡應該有 backchannel、interruption、overlap，進而產生 supervision。
- 建立 evaluation：不只看 WER / SIM / MOS，也檢查 turn-taking、speaker role、overlap timing、self-correction grounding 和 action correctness。

## Current reading map

### Core data recovery / preprocessing

- [DialogueSidon](../papers/arxiv_2604_09344/)：最直接命中本 project。它把 noisy monaural two-speaker dialogue 轉成 speaker-wise full-duplex tracks，用 **SSL-VAE + diffusion latent predictor** 同時做 restoration + separation。可作為「real mono audio -> dual-track training data」的核心 baseline。
- [Dual-path Mamba](../papers/arxiv_2403_18257/)：efficient single-channel speech separation backbone。它用 dual-path bidirectional Mamba 做 local/global separation，在 WSJ0-2mix 上以較小 memory 接近 SepFormer/MossFormer 等 baseline；可作 mono dialogue overlap cleanup baseline，但不處理 diarization、speaker swap、event tags 或 transcript alignment。
- [Sommelier](../papers/arxiv_2603_25750/)：web-scale open multi-turn audio preprocessing pipeline，包含 VAD、diarization、overlap disentanglement、background music removal、ASR ensemble。它的價值是工程 pipeline blueprint，尤其是保留 overlap / backchannel 而不是直接刪掉。
- [MeanFlow-TSE](../papers/arxiv_2512_18572/)：one-step generative target speaker extraction。它用 enrollment + mixing-ratio-aware MeanFlow 從 mono mixture 直接抽 target speaker，可作 overlap cleanup / speaker-conditioned extraction baseline；但目前只在 Libri2Mix synthetic mixture 上驗證，不是完整 dialogue diarization 或 dual-channel recovery pipeline。
- [WhisperD / Parakeet](../tools/jordandarefsky-parakeet-whisperd/)：提供 speaker/event transcript format：`[S1]`, `[S2]`, `(laughs)`, `(coughs)`。它是把 podcast data 轉成 dialogue TTS data 的實用中間層，但仍需要補 time alignment / channel-level annotation。
- [Miipher](../papers/arxiv_2303_01664/) / [Miipher-2](../papers/arxiv_2505_04457/)：speech restoration 可作為上游清理工具，但必須測它是否會抹掉 overlap、backchannel、breath、hesitation 等 conversational evidence。
- [Mega-ASR](../papers/arxiv_2605_19833/)：不是 full-duplex paper，但它的 compound acoustic simulation 和 WER-gated acoustic-to-semantic training 對 robust ASR / transcript recovery 有參考價值。用在本 project 時，重點是提升 noisy / far-field / dropout 場景下的 transcript fidelity。

### Runtime control / full-duplex policy

- [Full-Duplex-Bench-v3](../papers/arxiv_2604_04847/)：提供 disfluency + tool-use + real speech 的 evaluation checklist。尤其 self-correction、pause、filler、interruption 對 voice agent 是否正確行動非常關鍵。
- [SoulX-Duplug](../papers/arxiv_2603_14877/)：把 streaming ASR + state prediction 做成 semantic VAD，預測 listening / speaking / interruption control states。適合借鑑它的 low-latency turn management formulation。
- [LLM-Enhanced Dialogue Management](../papers/arxiv_2502_14145/)：0.5B LLM semantic VAD，用 control tokens 區分 intentional vs unintentional barge-in。適合當 lightweight dialogue manager reference。
- [A Full-duplex Speech Dialogue Scheme Based On LLM](../papers/arxiv_2405_19487/)：把 full-duplex dialogue 做成 neural FSM / serialized real-time dialogue，適合作為早期 system-level proof-of-concept。
- [SALMONN-omni](../papers/arxiv_2505_17060/)：codec-free speech LLM，explicit thinking / state transition tokens，並用 DPO 改善 barge-in / backchannel。偏 end-to-end model 方向。

### Dialogue synthesis / generation baseline

- [SwanVoice](../papers/arxiv_2605_30993/)：long-form 1-4 speaker dialogue TTS，重點在 pause-aware transcripts、speaker-turn conditioning、monologue/dialogue curriculum。它不是 explicit overlap model，但非常適合做 multi-speaker dialogue synthesis baseline。
- [PlanAudio](../papers/arxiv_2605_28063/)：free-form prompt -> speech+sound composite audio。它對 full-duplex 的啟發是 **Semantic Latent CoT**：先規劃 high-level audio event plan，再生成 waveform。未來可改成規劃 backchannel、overlap、turn-taking、pause、laughter 和環境音的時間關係。
- [Dia](../tools/nari-labs-dia/)：open dialogue TTS baseline，可測 `[S1]` / `[S2]` / nonverbal events 的可控性。
- [Echo-TTS](../papers/paper_1780385949770/)：使用 WhisperD-style prompt format，適合觀察 speaker reference conditioning 和 dialogue prompt style。
- [VoxCPM / VoxCPM2](../tools/openbmb-voxcpm/)、[Chatterbox TTS](../tools/resemble-ai-chatterbox/)：不是 full-duplex model，但可作為 streaming / expressive / paralinguistic speech output baselines。

### Evaluation / debugging

- [AnyAudio-Judge](../papers/arxiv_2606_03116/)：dynamic rubric-based audio evaluator。很適合把 full-duplex behavior 拆成 binary checks：speaker role 是否正確、backchannel 是否存在、overlap timing 是否合理、self-correction 是否被遵守、tool action 是否和最後 intent 一致。
- [τ-bench](../papers/arxiv_2406_12045/)：text-based tool-agent-user benchmark，但提供 final database state / required output 的 deterministic task success 和 `pass^k` reliability metric。可和 Full-Duplex-Bench 類 turn-taking metrics 結合，檢查 full-duplex voice agent 不只聽起來自然，也真的在 tool/database 層做對事情。
- [FlashTrace](../papers/arxiv_2602_01914/)：不是 audio paper，但可用於 transcript / event-token layer 的 grounding attribution。目標是檢查 voice agent 的 answer / tool action 是否真的依賴正確 transcript span，而不是被 false start 或 spurious speaker tags 誤導。
- [A Survey of Audio Reasoning](../papers/arxiv_2605_21008/)：可作 taxonomy 入口，把 full-duplex control 視為 Audio-to-Speech Reasoning 的一種。

## Recommended pipeline

### Stage 1: real mono dialogue -> structured training examples

先不要直接追求生成模型。第一步應該建立可重複的 data transformation：

```text
mono dialogue audio
  -> VAD / diarization / OSD
  -> overlap-aware source separation or DialogueSidon-style recovery
  -> robust ASR / WhisperD-style transcript
  -> time-aligned speaker/event/control annotation
  -> quality filters + rubric checks
  -> dual-channel training record
```

每個 training record 建議保存：

- original mixed audio
- recovered speaker tracks
- transcript with speaker labels
- word-level or phrase-level timestamps
- overlap intervals
- backchannel / interruption / hesitation / repair tags
- confidence scores：diarization confidence、ASR confidence、separation confidence、rubric judge score
- failure flags：speaker swap、content deletion、over-restoration、unnatural silence、overlap artifact

### Hypothesis: mixture-consistent multi-loss training

一個值得獨立驗證的想法是：**不要完全相信 DialogueSidon / diarization / separation 產出的 speaker A / speaker B pseudo labels，而是同時用原始 mixed audio 當 mixture-consistency supervision。**

問題背景是：從 mono-channel dialogue 切出 dual-channel tracks 時，overlap 區域很容易切不乾淨：

- Speaker A track 可能殘留 Speaker B。
- Speaker B track 可能漏掉 quieter backchannel。
- overlap 區域可能被 separation artifact 或 over-restoration 改壞。
- diarization 可能在短 utterance / interruption 附近 speaker swap。

如果 training 只用 separated pseudo labels，模型會被迫學這些錯誤。比較穩的訊號是 original mixture，因為它是真實可觀測的 audio。因此可以把 diffusion / audio generator 設計成 shared representation + 多個 prediction heads：

```text
shared encoder / diffusion backbone
  -> head_A: predict speaker A track
  -> head_B: predict speaker B track
  -> head_mix: predict original mixed track
```

基本 loss：

```text
L_A      = loss(A_pred, A_pseudo)
L_B      = loss(B_pred, B_pseudo)
L_mix    = loss(M_pred, A_plus_B_original)
L_total  = lambda_A * L_A + lambda_B * L_B + lambda_mix * L_mix
```

更強的版本應該加上 **sum-consistency**，直接約束分離後的兩條 channel 合起來要回到原始 mixture：

```text
L_sum = loss(A_pred + B_pred, A_plus_B_original)

L_total =
  lambda_A   * L_A
+ lambda_B   * L_B
+ lambda_mix * L_mix
+ lambda_sum * L_sum
```

這個 objective 的直覺是：

- `L_A` / `L_B` 讓模型仍然學 speaker-wise decomposition。
- `L_mix` 讓 shared representation 保留整體 acoustic scene，不完全被 noisy separated labels 帶歪。
- `L_sum` 防止 A/B outputs 各自看起來合理但合起來不像原始 conversation。

需要小心的是：`L_mix` 或 `L_sum` 太強時，模型可能學會只滿足 mixture reconstruction，而不是正確 speaker attribution。也就是：

```text
A_pred + B_pred ≈ mixture
```

不保證：

```text
A_pred ≈ true A
B_pred ≈ true B
```

所以這個 idea 不能只看 mixture loss 下降，必須同時測：

- overlap region 的 speaker leakage
- speaker swap rate
- quieter speaker / backchannel recall
- A/B channel 的 ASR WER
- `A_pred + B_pred` 對 original mixture 的 reconstruction quality
- human check：分開聽 A/B 是否仍然像正確 speaker

短期最合理的 framing：**這不是取代 DialogueSidon，而是把 DialogueSidon 產生的 noisy pseudo dual-channel labels，包進一個 mixture-consistent multi-task diffusion training objective。** 如果有效，它可以降低 imperfect separation 對 full-duplex generator 的傷害，並讓模型同時學到 speaker-wise output 和 realistic overlap mixture。

### Stage 2: synthetic full-duplex data

用 real data 學分布，但用 synthetic data 做 controllable coverage。建議的 synthetic generator 不是「逐句 TTS 後混音」而是兩層：

1. **Conversation event planner**
   - 輸入 transcript / scenario / speaker roles。
   - 輸出 time plan：turns、pause、backchannel、overlap、interruption、repair。
   - 可以借鑑 PlanAudio 的 semantic latent planning，但初期先用顯式 JSON / table plan 會比較容易 debug。

2. **Speaker-wise audio renderer**
   - 對每位 speaker 獨立生成 track。
   - 最後做 controlled mixing / room tone / channel degradation。
   - 用 SwanVoice / Dia / Echo-TTS / VoxCPM2 / Chatterbox 作 baseline，比較誰最能保留 speaker identity、event tags、pause timing。

### Stage 3: evaluation loop

評測不能只看整段音質。建議用四層：

- **Content**：WER / CER / semantic consistency。
- **Speaker**：speaker assignment、speaker similarity、speaker swap rate。
- **Interaction**：backchannel hit rate、overlap timing error、interruption response accuracy、pause/end-of-turn false trigger。
- **Grounding / reward safety**：AnyAudio-Judge rubrics + FlashTrace-style transcript attribution，檢查 yes/no decision 或 tool action 是否依賴正確 evidence。

## Concrete recommendations

1. **先做一個 50-100 段的小型 gold set。**  
   每段 15-60 秒，人工標 speaker turns、overlap、backchannel、repair、pause。這會成為所有 pipeline 的 sanity check；沒有這個 gold set，很難知道 DialogueSidon / Sommelier / WhisperD 的錯誤到底傷不傷 downstream。

2. **把 DialogueSidon + Sommelier 當兩條 baseline。**  
   DialogueSidon 解決 full-duplex track recovery；Sommelier 解決 scalable preprocessing。比較兩者在 overlap region 的 content preservation、speaker swap、artifact、ASR WER。

3. **採用 WhisperD-style transcript，但加 timestamp 和 channel fields。**  
   單純 `[S1] ... [S2] ... (laughs)` 不夠。建議資料格式要能表示：
   ```json
   {
     "speaker": "S1",
     "start": 12.34,
     "end": 13.10,
     "text": "yeah",
     "event": "backchannel",
     "overlaps_with": ["utt_042"],
     "channel": "left"
   }
   ```

4. **短期不要把 full-duplex generation 交給 black-box prompt。**  
   PlanAudio 的方向很有啟發，但它目前不是 open full-duplex dialogue model。初期應該先用 explicit event plan + controllable renderer，因為你需要知道每個 backchannel / overlap 是不是照計畫出現。

5. **把 AnyAudio-Judge 改造成 full-duplex rubric judge。**  
   先不用訓練新 judge，先設計 rubrics：
   - `S2 produced a short backchannel while S1 was still speaking.`
   - `S1's correction overrides the earlier destination.`
   - `The agent does not execute the tool before the user's self-correction is complete.`
   - `The overlap does not obscure the main lexical content.`

6. **用 FlashTrace 只做 transcript/event-token grounding，不要一開始追 raw audio attribution。**  
   先檢查模型 action 是否依賴正確 transcript span；audio-token attribution 等有 open audio judge / codec-token model 後再做。

7. **保留「真實 overlap」和「合成 overlap」兩個 bucket。**  
   真實 overlap 用來學自然分布；合成 overlap 用來做可控 stress test。不要把所有 overlap 都清掉，也不要只依賴合成 overlap。

## Next experiments

### Experiment A: overlap preservation audit

目標：回答「現有 restoration / separation 會不會把 backchannel 和 overlap 抹掉？」

- Input：50 段人工標註 mono dialogue。
- Baselines：DialogueSidon、Sommelier-style separation、Miipher / Miipher-2 restoration。
- Metrics：overlap interval recall、speaker swap rate、ASR WER in overlap vs non-overlap、backchannel deletion rate、human A/B。

### Experiment B: transcript format ablation

目標：找出最適合 dialogue TTS / full-duplex model 的 transcript format。

- Compare：
  - plain transcript
  - `[S1]` / `[S2]`
  - speaker + event tags
  - speaker + event + timestamp / pause duration
  - explicit channel / overlap plan
- Renderers：Dia、SwanVoice-style model if runnable、Echo-TTS、VoxCPM2 / Chatterbox as auxiliary baselines。
- Metrics：speaker consistency、pause timing、backchannel controllability、content accuracy。

### Experiment C: full-duplex rubric benchmark

目標：建立自己的 FDB-style mini benchmark，但專注 data/model generation，而不是只看 tool-use agent。

- 20 個 self-correction cases
- 20 個 backchannel cases
- 20 個 soft interruption cases
- 20 個 overlap-intelligibility cases
- 20 個 turn-taking latency cases

每個 case 都有 expected rubrics，先用 AnyAudio-Judge-style prompting 評估，再抽樣人工驗證。

### Experiment D: mixture-consistent loss ablation

目標：回答「在 separated pseudo labels 不乾淨時，mixture-consistency loss 是否能讓 full-duplex generator 更穩？」

- Input：人工 gold set + DialogueSidon / Sommelier recovered tracks。
- Compare：
  - `L_A + L_B`
  - `L_A + L_B + L_mix`
  - `L_A + L_B + L_sum`
  - `L_A + L_B + L_mix + L_sum`
- Stress cases：
  - full overlap
  - short backchannel
  - quiet secondary speaker
  - rapid speaker switch
  - diarization boundary error
- Metrics：speaker leakage、speaker swap、overlap WER、backchannel recall、mixture reconstruction、human A/B channel preference。

## Open questions

- 怎麼從 real mono-channel audio recovery 出可靠的 speaker-wise tracks？
- 怎麼評估 separation 是否保留 linguistic content，而不是只讓音質指標變好？
- 怎麼建模 backchannel / interruption / overlap timing？
- 能不能從 transcript 直接生成 dual-channel full-duplex audio？
- 什麼樣的 synthetic full-duplex data 對 training 最有效？
- rubric judge 是否會被 generator reward-hack？
- speaker/event transcript 是否需要 time-aligned phoneme-level detail，還是 word-level timestamp 已足夠？

## Related Tags

#speech-llm #full-duplex #turn-taking #speech-data #separation #restoration #dialogue-tts #audio-evaluation
