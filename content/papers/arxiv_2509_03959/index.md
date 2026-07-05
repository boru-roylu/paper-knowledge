---
paper_key: arxiv_2509_03959
canonical_id: "arxiv:2509.03959"
title: "WenetSpeech-Yue: A Large-scale Cantonese Speech Corpus with Multi-dimensional Annotation"
year: 2025
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2509.03959"
pdf_url: "https://arxiv.org/pdf/2509.03959"
status: read
rating: 8
tags:
  - speech-data
  - cantonese
  - asr
  - tts
  - data-cleaning
  - speech-corpus
  - project-tts-data-pipeline
  - project-full-duplex-data
created: 2026-07-05
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

Generation note: summary by Codex GPT-5, based primarily on arXiv TeX source (`neurips_2024.tex`) and bibliography. This note focuses on the data construction / cleaning pipeline rather than Cantonese ASR leaderboard details only.

## Links

- [Original URL](https://arxiv.org/abs/2509.03959)
- [arXiv abstract](https://arxiv.org/abs/2509.03959)
- [PDF](https://arxiv.org/pdf/2509.03959)
- [arXiv source](https://arxiv.org/src/2509.03959)
- [Project page / official GitHub](https://github.com/ASLP-lab/WenetSpeech-Yue)

## 一句話總結

WenetSpeech-Yue 是一個 21,800 小時的 large-scale Cantonese speech corpus，搭配 WenetSpeech-Pipe 做 VAD segmentation、speaker attributes、speech quality annotation、multi-ASR transcription、text normalization、ROVER voting、LLM correction 和 forced alignment；它的價值不只是粵語資料量，而是把 ASR/TTS 共用的 multi-dimensional metadata schema 做得很完整。

## 這篇在解決什麼問題

粵語 speech resources 長期比 Mandarin / English 少很多。既有公開 Cantonese corpora 常見問題是：

- Scale 小：Common Voice Cantonese 大約數百小時，MDCC 約 73.6 小時，ZoengJyutGaai-Storytelling 約 112.54 小時。
- Domain 窄：多數是 read speech / audiobook，不夠貼近 in-the-wild speech。
- Label 單薄：通常只有 speech-text alignment，缺少 speaker identity、age、gender、SNR、DNSMOS、timestamps、domain 等 metadata。
- Evaluation 覆蓋不足：短句多，缺 code-switching、long utterance、domain shift、TTS generalization cases。

作者要解的是「低資源方言也要有可支援 ASR + TTS + speech generation 的 industrial-scale data pipeline」。因此這篇比單純 dataset release 更值得看的是 WenetSpeech-Pipe 的工程設計。

## 核心方法

### 1. WenetSpeech-Pipe 六個模組

Pipeline 包含六個 modules：

- Audio Collection
- Speaker Attributes Annotation
- Speech Quality Annotation
- Automatic Speech Recognition
- Text Postprocessing
- Recognizer Output Voting

資料來源包含 YouTube、Podcast、TikTok、Bilibili、audiobooks 等 in-the-wild content。原始錄音常是幾十分鐘到一小時以上，所以先用 VAD 切成 utterance-level clips。

### 2. Speaker metadata

Speaker Attributes Annotation 使用：

- `pyannote` 做 speaker diarization，得到同一來源內的 local speaker labels。
- `Vox-Profile` 做 age / gender estimation。

最後每個 segment 會有 speaker identity、age、gender 等 metadata。這對 TTS 很重要，因為同一個 corpus 可以同時做 ASR、speaker-aware filtering、voice cloning / style-aware TTS。

### 3. Speech quality annotation

作者對每段音訊存三類 quality signals：

- `Brouhaha` 估 SNR。
- `DNSMOS` 估 human-perceived quality / MOS。
- Bandwidth detection / sampling-rate information 估有效頻域覆蓋。

文中提到 DNSMOS 約 2.0 到 4.4，SNR 約 -5 到 80 dB，sampling rate 約 8 kHz 到 32 kHz。為了 TTS / generation，作者用 `DNSMOS > 2.5` 和 `SNR > 25 dB` 過濾出約 12,000 小時 high-quality TTS subset。

### 4. Multi-ASR + text normalization

每段 audio 由三個 ASR 系統轉寫：

- SenseVoice
- Whisper
- TeleASR

因為不同 ASR 會輸出不同格式，作者先做 text postprocessing：

- Traditional-to-Simplified conversion：OpenCC。
- punctuation / symbol removal。
- number/date normalization。
- Cantonese-English code-switch spacing。
- 移除或正規化 non-lexical tags。

這一步對 ROVER 很關鍵，否則 voting 會被表面格式差異干擾，而不是比較真正 transcription content。

### 5. ROVER voting + confidence

作者用 Recognizer Output Voting Error Reduction (ROVER) 融合三個 ASR hypotheses：

- 先把 normalized hypotheses 用 dynamic programming alignment。
- 計算每個 ASR output 和其他兩個平均 transcription 的 edit distance。
- 偏離太大的候選會被 candidate filtering 排除。
- 每個 aligned position 用 majority voting 取最常見 token。
- 平均 voting frequency 變成 utterance-level text confidence。
- 另有 Cantonese pinyin / jyutping confidence，強化 pronunciation-level consistency。

這是這篇對我們最有用的部分：不是盲信單一 ASR，而是把 ASR ensemble disagreement 變成可保存的 confidence signal。

### 6. Qwen3-4B LLM corrector

ROVER 後，作者再用 Qwen3-4B 做 minimal correction：

- Input 包含 voted result 和三個原始 ASR hypotheses。
- LLM 被設定成 Cantonese ASR correction expert。
- 只做必要的 grammar、word choice、named entity correction。
- 輸出 refined transcription、confidence score 和 correction analysis。

這個設計很實用，但也是可能出問題的點：LLM correction 可能改善 fluency，也可能 hallucinate 或把 spoken disfluency 正規化掉。若用於 TTS data，必須保留 pre-LLM hypotheses / ROVER result，避免只留下不可追溯的 corrected transcript。

### 7. Character-level forced alignment

最後作者用 pretrained acoustic model 做 character-level forced alignment，產生每個 character 的 timestamps。這讓 corpus 不只是 waveform+text，而是可以支援 segmentation、duration modeling、TTS alignment、subtitle / transcript audit。

## Training / Data

### WenetSpeech-Yue corpus

資料集規模：

- Total duration：21,800 hours。
- Average segment duration：11.40 seconds。
- Domains：Storytelling、Entertainment、Drama、Culture、Vlog、Commentary、Education、Podcast、News、Others。
- Metadata：audio path、duration、text confidence、speaker identity、SNR、DNSMOS、age、gender、character-level timestamps。

注意：abstract 寫 10 domains，introduction 其中一句寫 11 domains，但正文 domain list 是 10 categories。這裡以正文列出的 10 domains 記錄。

### Confidence split

作者只保留 text confidence > 0.6 的 labels，並切成三個 subset：

- Strong labels：confidence > 0.9，6,771.43 hours。
- Moderate labels：0.8 < confidence <= 0.9，10,615.02 hours。
- Weak labels：0.6 < confidence <= 0.8，4,488.13 hours。

這個 split 很值得借：不同 confidence tier 可以對應不同 training stage，而不是硬切「用/不用」。

### WSYue-ASR-eval

ASR benchmark 手動標註，包含 transcription、emotion、age、gender 等 tags，並分成：

- Short：0-10s，2,861 speakers，9.46 hours。
- Long：10-30s，838 speakers，1.97 hours。

它也涵蓋 Cantonese-English code-switching 和 multi-domain conditions。

### WSYue-TTS-eval

TTS benchmark 分兩組：

- Base：1,000 prompt-text pairs from CommonVoice，反映比較自然的 real-world distribution。
- Coverage：人工 seed + LLM expansion + human verification，覆蓋 daily life、news、entertainment、poetry，以及 polyphonic characters、tone sandhi、code-switching、proper nouns、numerals、colloquial particles 等 Cantonese-specific phenomena。

Evaluation 使用：

- MER：用 U2pp-Conformer-Yue 轉寫 synthesized speech，再和 reference text 比。
- SIM：用 Wespeaker speaker embeddings。
- UTMOSv2：估 naturalness。
- Human MOS：10 位 native Cantonese speakers，評估 I-MOS、S-MOS、A-MOS。

### ASR training

作者訓練 / fine-tune 幾類 ASR models：

- U2pp-Conformer-Yue：from scratch。
- Whisper-medium-Yue：low learning-rate fine-tuning。
- SenseVoice-small-Yue：fine-tuned baseline。
- U2pp-Conformer-LLM-Yue：Conformer encoder + Qwen3-4B via adapter。

Training strategy 是 two-stage：

- Stage 1：medium + high confidence labels，用於快速收斂。
- Stage 2：high confidence labels fine-tuning，用於提高 transcription accuracy。

### TTS training

作者把 Llasa-1B 和 CosyVoice2 轉移到 Cantonese：

- Llasa-1B：pretrained on 250,000 hours Mandarin + English。
- CosyVoice2：作為 strong multilingual / zero-shot TTS baseline。
- Fine-tune on WenetSpeech-Yue TTS subset，得到 Llasa-1B-Yue 和 CosyVoice2-Yue。

## 主要結果

### ASR

ASR 使用 MER，Chinese 以 character-level error、English 以 word-level error。

代表性結果：

- U2pp-Conformer-LLM-Yue 在 WSYue-ASR-eval Short / Long 達到 4.73 / 7.91 MER，是表中最強。
- Whisper-medium-Yue 從原本 Whisper-medium 在多個 Cantonese test sets 上很差的表現大幅改善，例如 WSYue Short 從 80.82 降到 5.05，Long 從 50.96 降到 8.05。
- U2pp-Conformer-Yue 只有 130M，但在 Dialogue test set 達到 16.57 MER，優於多個更大的 baseline。

Two-stage training 也有效：

- Whisper-medium-Yue：Short 7.27 -> 5.05，Long 11.19 -> 8.05。
- U2pp-Conformer-Yue：Short 7.62 -> 5.05，Long 12.01 -> 8.89。
- U2pp-Conformer-LLM-Yue：Short 6.81 -> 4.73，Long 10.75 -> 7.91。

這支持「保留 confidence tier，先混合訓練再 high-confidence fine-tune」的資料策略。

### TTS

TTS 結果顯示 WenetSpeech-Yue 對 Cantonese TTS adaptation 有明顯效果。

Objective：

- Llasa-1B：Base MER 53.31，Coverage MER 43.68。
- Llasa-1B-Yue：Base MER 10.89，Coverage MER 12.78。
- CosyVoice2：Base MER 14.38，Coverage MER 13.74。
- CosyVoice2-Yue：Base MER 10.33，Coverage MER 9.49；SIM 也最高，Base 0.821 / Coverage 0.834。

Subjective：

- CosyVoice2-Yue：I-MOS 4.45 +/- 0.16 最高。
- Llasa-1B-Yue：S-MOS 4.11 +/- 0.37 最高，A-MOS 4.34 +/- 0.34 最高。

有趣的是 CosyVoice2-Yue 的 objective SIM 較高，但 perceived speaker similarity 不如 Llasa-1B-Yue。作者推測 Llasa-1B-Yue 的 in-context learning inference 帶來更自然 prosody / style，因此 subjective speaker similarity 更好。這提醒我們：TTS data eval 不應只看 SIM，還要看 prosody/style perception。

## Project relevance

### project-tts-data-pipeline

高度相關。這篇幾乎是可直接借鑑的 speech data pipeline template：

- Multi-ASR transcription 不應只產生 final transcript，也要保留每個 ASR hypothesis、ROVER result、confidence、LLM correction trace。
- TTS subset filtering 可以用 `DNSMOS + SNR + duration + speaker consistency + transcript confidence` 多維條件，而不是只用 WER。
- Confidence tier 可以支持 staged training：medium/high 先預訓練，high-confidence 再 fine-tune。
- Evaluation set 應有 Base / Coverage split：Base 代表自然分布，Coverage 專門測 code-switch、numbers、names、polyphonic words、colloquial expressions、hard prosody。
- Metadata JSON schema 要保存 timestamps、source link、domain、speaker attributes、quality scores，方便之後 audit / re-filter。

對我們 English TTS data pipeline，可以改成：

```text
raw web/podcast/audiobook audio
  -> VAD/segmentation
  -> ASR ensemble
  -> text normalization preserving spoken content
  -> ROVER + disagreement/confidence
  -> optional LLM correction with trace
  -> forced alignment
  -> DNSMOS/SNR/reverb/speaker consistency
  -> tiered training manifests
```

### project-full-duplex-data

中度相關。它不做 overlap separation 或 dual-channel recovery，但它提供了 transcript / metadata layer 的做法：

- pyannote diarization + speaker attributes 可作 initial speaker segmentation。
- Multi-ASR + ROVER 可以降低 mono dialogue transcript 錯誤。
- character-level timestamps 可接到 turn-taking / overlap / backchannel annotation。
- text confidence 和 ASR disagreement 可作後續 separation / full-duplex label 的 uncertainty signal。

限制是：WenetSpeech-Yue 的目標是 Cantonese ASR/TTS corpus，不是 full-duplex dialogue disentanglement；overlap、speaker swap、backchannel preservation 仍要靠 DialogueSidon / Sommelier / SAM Audio 類 pipeline。

### project-audio-model-evaluation

中度相關。WSYue-eval 的 Base/Coverage split 對 evaluator design 有用：一組測 natural distribution，一組測 hard linguistic phenomena。TTS evaluation 同時看 MER、SIM、UTMOSv2 和 MOS，也提醒我們 generated speech evaluation 要分 content fidelity、speaker similarity、naturalness、accent nativeness，而不是壓成單一分數。

## Related papers in my pool

- [WenetSpeech4TTS](../arxiv_2510_11690/)：同一 WenetSpeech 系列的 Mandarin TTS corpus refinement，和本篇的 Cantonese pipeline 可對照。
- [SODA](../arxiv_2602_16687/)：同樣關心 speech/TTS data mixture、transcript formatting 和 dataset quality 對 downstream 的影響。
- [NaturalSpeech 2](../arxiv_2304_09116/)：large-scale TTS training recipe；WenetSpeech-Yue 更偏 data construction / metadata / benchmark。
- [FunASR](../../tools/modelscope-funasr/)：可作 production ASR/VAD/punctuation/diarization baseline；WenetSpeech-Yue 展示如何把多個 ASR system 融合成 corpus annotation。
- [Mega-ASR](../arxiv_2605_19833/)：robust ASR data construction；WenetSpeech-Yue 是 low-resource dialect corpus construction。
- [TASTE](../arxiv_2504_07053/)：需要 high-quality ASR transcript 來做 text-aligned speech tokens；WenetSpeech-Yue 的 ROVER/confidence pipeline 可作 transcript quality source。
- [Sommelier](../arxiv_2603_25750/)：full-duplex preprocessing pipeline；WenetSpeech-Yue 可補 transcript voting / metadata schema。

## OpenReview / reviewer discussion

未取得可用 OpenReview review/rebuttal。工具找到疑似 forum，但 OpenReview API 回傳 403，因此目前只以 arXiv source 和 paper 內容記錄。

## 我該不該細讀

如果你在做 TTS data pipeline，建議細讀；如果只關心模型架構，優先度中等。

最值得讀：

- WenetSpeech-Pipe 六個模組。
- ROVER + candidate filtering + confidence score。
- Qwen3-4B LLM corrector 的位置和風險。
- DNSMOS/SNR filtering 出 TTS subset 的做法。
- WSYue-TTS-eval Coverage subset 的 construction。

## 可能的弱點 / open questions

- LLM corrector 可能 hallucinate 或過度 normalize spoken language；paper 沒有充分量化 LLM correction 的錯誤類型。
- Text normalization 轉成 simplified Chinese、移除 punctuation/symbol，對 TTS prosody 可能會丟掉有用 cues；若做 expressive TTS，可能需要保存原始 transcript 和 normalized transcript。
- Speaker diarization / age / gender / quality scores 都是 automatic labels；paper 沒有足夠討論這些 metadata 的 error rate。
- High-quality TTS subset 用 DNSMOS > 2.5、SNR > 25 dB，但 speaker consistency、overlap、room/reverb、prosody naturalness 的 filtering 沒有完整展開。
- Abstract / intro 對 domain 數量有 10 vs 11 的小不一致，正文 domain list 是 10。
- 這是 Cantonese-specific pipeline；搬到 English podcast / dialogue data 時，要重新處理 punctuation、case、speaker turns、disfluency、overlap、license/consent。

## Tags

speech-data, cantonese, asr, tts, data-cleaning, speech-corpus, project-tts-data-pipeline, project-full-duplex-data

## Concepts

WenetSpeech-Yue, WenetSpeech-Pipe, Cantonese speech corpus, multi-dimensional annotation, ROVER, ASR ensemble, text confidence, jyutping confidence, Qwen3-4B LLM corrector, pyannote diarization, Vox-Profile, DNSMOS, SNR, Brouhaha, forced alignment, WSYue-ASR-eval, WSYue-TTS-eval, Base/Coverage split, MER, SIM, UTMOSv2

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{li2025wenetspeechyuealargescalecanto,
  title={WenetSpeech-Yue: A Large-scale Cantonese Speech Corpus with Multi-dimensional Annotation},
  author={Longhao Li and Zhao Guo and Hongjie Chen and Yuhang Dai and Ziyu Zhang and Hongfei Xue and Tianlun Zuo and Chengyou Wang and Shuiyuan Wang and Jie Li and Jian Kang and Xin Xu and Hui Bu and Binbin Zhang and Ruibin Yuan and Ziya Zhou and Wei Xue and Lei Xie},
  year={2025},
  eprint={2509.03959},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2509.03959}
}
```
