---
title: "Project: TTS data pipeline"
---

## Motivation

我們想要做更好的 English TTS model，而 TTS 的上限很大一部分取決於資料品質。真實收集到的 audio / transcript 往往有 overlap speech、speaker inconsistency、ASR errors、hallucinated transcript、background noise、music、reverb、bad segmentation、或不適合 TTS training 的自然對話現象。

所以這條 project line 的重點不是單一 TTS architecture，而是 data pipeline：如何偵測、清理、過濾、對齊、評分，最後產生穩定可訓練的 English TTS corpus。特別是 overlap detection 與 transcription quality，是目前最需要系統化處理的部分。

## Target

- 偵測 transcript/audio 中的 overlap speech 與多 speaker contamination。
- 提高 transcription quality，降低 ASR hallucination、錯字、漏字與 timing mismatch。
- 設計 English TTS training data 的 filtering rules 與 quality scoring。
- 建立從 raw audio 到 clean utterance-level training examples 的 pipeline。
- 判斷哪些資料適合 TTS、哪些資料應該排除或只用於其他任務。

## Questions

- 哪些 overlap / noise / ASR error 會真正傷害 TTS training？
- 怎樣的 diarization、VAD、ASR ensemble、text normalization 組合最穩？
- 如何衡量 transcript/audio alignment quality？
- 該用哪些 automatic metrics、人類抽查策略、或 model-based filters？
- 對 English TTS 而言，資料多樣性和資料乾淨程度應該怎麼 trade off？

## Structured controllable TTS prompts

[TED-TTS](../papers/arxiv_2601_03170/) 補上一個重要方向：TTS data pipeline 不應只產生 plain transcript，而應產生 **segment-level structured prompt**。

一個更有訓練價值的 expressive TTS example 可以長成：

```text
utterance text
  -> contiguous segments
  -> emotion label / natural language emotion description
  -> expected duration or speaking-rate range
  -> pause / emphasis / nonverbal tags
  -> speaker identity and style constraints
```

TED-TTS 的 MED-TTS 是 synthetic text-side dataset，不是真實 speech annotation，但它提供了可借鑑的 schema：

- GPT-4o 產生 emotion-rich English / Chinese text。
- DeepSeek-Chat 做 emotion-aligned segmentation 和 duration estimation。
- Qwen3-8B 被 fine-tune 成 automatic prompt constructor。
- 人工 verification checklist 檢查 segment order、emotion-text alignment、emotion description、duration plausibility。

對我們的 pipeline，下一步可以把這種 schema 接到真實 audio：

```text
raw audio + transcript
  -> ASR / diarization / forced alignment
  -> segment boundary detection
  -> emotion / prosody / speaking-rate tags
  -> duration from timestamps or codec-token counts
  -> verification / filtering
  -> structured TTS training example
```

這樣可以同時服務兩個目標：

- clean English TTS training：保留 content fidelity、speaker consistency、alignment quality。
- controllable expressive TTS：讓模型學會 segment-level emotion、pace、pause 和 emphasis，而不是只有整句 global style。

## Overlap cleanup / separation references

- [Dual-path Mamba](../papers/arxiv_2403_18257/)：不是 TTS paper，但可作 TTS data pipeline 的 upstream separation baseline。對 podcast / dialogue / web audio 來說，先用 efficient single-channel speech separation 把 overlap speaker contamination 降低，再進 ASR、forced alignment、speaker filtering 和 transcript validation，會比直接把 contaminated utterance 丟給 TTS training 更穩。限制是它只在 WSJ0-2mix 類 benchmark 驗證，不能替代 diarization、speaker consistency check 或 human spot-check。
- [FunASR](../tools/modelscope-funasr/)：production-oriented ASR / VAD / punctuation / speaker diarization / emotion-event tagging toolkit。適合作為 TTS data cleaning 的 first-pass transcription 和 segmentation baseline，但在 overlap speech、short backchannels、speaker swaps 上仍需要和 separation / OSD / human spot-check 搭配。

## Data recipe / scaling references

- [NaturalSpeech 2](../papers/arxiv_2304_09116/)：large-scale zero-shot TTS / latent diffusion baseline。它的 pipeline 很值得借：44K hours MLS English、G2P phoneme sequence、internal phoneme-duration alignment、PyWorld pitch extraction、3s prompt crop、codec latent cache、WER/SMOS/CMOS/hard-sentence robustness evaluation。對我們來說，它支持 TTS example schema 不應只有 waveform+text，還要保存 phoneme duration、pitch、speaker/prompt reference、latent representation 和 quality metrics。
- [DataComp-VLM](../papers/arxiv_2606_28551/)：不是 speech paper，但提供 data-curation benchmark blueprint。它固定 model / training recipe / eval suite，只改 filtering、mixing、formatting、sampling；核心結論是 already-curated pool 上 additional filtering often has diminishing returns，data mixture and scale-aware validation are bigger levers。TTS pipeline 可借這個設計來比較 clean studio / audiobook / podcast / dialogue / synthetic / noisy data 的比例，而不是只比較 filter thresholds。
- [SODA](../papers/arxiv_2602_16687/)：對 TTS data pipeline 很有參考價值。作者比較 Yodas、Emilia、MLS，發現 MLS 因為 uncased / unpunctuated transcript 和 fixed chunking 在 cross-modal ASR/TTS 上很差；最後採用 Yodas + Emilia + 5% Nemotron-CC text。這支持我們把 punctuation、casing、utterance boundary、chunk length diversity 和 transcript normalization 視為 core filtering signals，而不是 ingestion 後的小修補。
- [LongCat-AudioDiT](../papers/arxiv_2603_29339/)：不是 data-cleaning paper，但它把 100K/1M hours Chinese-English speech、ASR-generated transcripts、max 60s utterances、prompt audio 和 Wav-VAE waveform latent 組成一個可訓練的 zero-shot TTS setup。對 pipeline 的啟發是：若 downstream target 是 waveform latent / voice cloning，資料格式要保留 prompt audio、speaker similarity reference、duration、ASR transcript quality，以及可重建的 latent cache，而不只是 plain text + waveform。
- [DiTTo-TTS](../papers/arxiv_2406_11427/)：提供一個 scalable zero-shot TTS data formatting reference：82K hours / 9 languages / 12K+ speakers，prompt 取 3 秒 speech，訓練 speech length predictor 預測 total latent length，而不是 phoneme-level duration。對我們來說，它支持把 `text + prompt audio + prompt transcript + latent length + speaker similarity target` 作為 TTS example schema。
- [MMAE](../papers/arxiv_2606_07229/)：不是 TTS data cleaning paper，但它的 rubric-based audio editing evaluation 可改成 TTS data QA：檢查 denoise / de-overlap / extraction 後 speech content、speaker identity、non-speech events、prosody 和 background preservation 是否符合預期。
- [MAVEN](../papers/arxiv_2605_21917/)：不是 speech paper，但它提供 agentic annotation pipeline pattern。TTS data pipeline 可借它的 structured intermediate + root-cause tracing：先產生 utterance/global context、dense timestamps、chunk-level noise/overlap/prosody notes，再生成 filter decision、quality rubric 或 structured TTS prompt。
- [WavCube](../papers/arxiv_2605_06407/)：不是 data cleaning paper，但它提醒 TTS pipeline 不只要保存 clean waveform / transcript，也可以保存 downstream-friendly representation cache。若未來比較 mel、codec token、VAE latent、WavCube latent，資料 schema 應包含 latent frame count、reconstruction WER/SIM/UTMOS、speaker reference、ASR quality，以及 small-generator convergence score。
- [SuperBPE](../papers/arxiv_2503_13423/)：text-side tokenizer paper，對 TTS data pipeline 是間接但有用的提醒。TTS transcript / prompt side 不一定只能用 word/subword units；multi-word expressions 可能更接近 prosody phrase 或 discourse unit。但若把它用到 TTS，要額外處理 word/phoneme boundary、speaker/event tags、prompt-completion boundary、ASR artifacts，不能只看 tokens-per-byte。

## Related Tags

#audio-data #diarization #preprocessing #speech-data #tts #asr
