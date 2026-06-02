---
paper_key: paper_1780385949770
canonical_id: "https://jordandarefsky.com/blog/2025/echo/"
title: "Echo-TTS"
year: 2025
venue: "Blog / GitHub release"
url: "https://jordandarefsky.com/blog/2025/echo/"
repo_url: "https://github.com/jordandare/echo-tts"
pdf_url: ""
status: read
rating: 4
tags:
  - speech-llm
  - speech-data
  - tts
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

<div class="generation-note">

- Paper summary model: `manual README update`
- Note: GitHub repo link was provided by WhisperD.

</div>

## Links
- [Blog post](https://jordandarefsky.com/blog/2025/echo/)
- [GitHub repo: echo-tts](https://github.com/jordandare/echo-tts)
- [Hugging Face model: jordand/echo-tts-base](https://huggingface.co/jordand/echo-tts-base)
- [Hugging Face demo: echo-tts-preview](https://huggingface.co/spaces/jordand/echo-tts-preview)
- [WhisperD prompt format reference](https://huggingface.co/jordand/whisper-d-v1a)

## 一句話總結
**Echo-TTS** 是 Jordan Darefsky 釋出的 multi-speaker text-to-speech model，可以用 speaker reference audio 做 voice conditioning，目標是用 text prompt 生成對應 speaker style 的語音。

## 這篇在解決什麼問題
Echo-TTS 比較像是 blog / open-source release，而不是一般 arXiv paper。它主要關心的是：

- 給定 text prompt 和 speaker reference audio，生成符合目標 speaker 的 speech
- 讓 inference workflow 可以直接從 Hugging Face model / Gradio demo / Python API 使用
- 支援較低 VRAM 的本地生成設定

目前 repo README 顯示它需要 Python 3.10+，以及至少 8GB VRAM 的 CUDA GPU。

## 核心方法
從 README 可以確認的重點：

- model 是 multi-speaker TTS，支援 speaker reference conditioning
- generation 最多約 30 秒 audio，對應 640 latents
- 可以用較短 reference clip，例如 10 秒左右，來做 speaker conditioning
- sampling 中有 text guidance 和 speaker guidance 相關參數
- 有 Force Speaker / speaker KV scaling 的設定，用來減少 out-of-distribution text 造成 speaker drift 的問題

README 也提到 model release 是 fully fine-tuned model，不是 blog 裡描述的 LoRA。

## Training / Data
目前 README 沒有完整列出 training data recipe，因此這部分還需要回頭讀 blog post 或更完整的 technical note。

可確定的是 text prompt format 來自 **WhisperD**：

- prompt 使用 `[S1] ...` 這類 speaker-marked format
- comma 通常會作為 pause
- exclamation mark 或比較 expressive 的 punctuation 可能增加表現力，但也可能降低品質
- included text presets 與 WhisperD transcription style 在 style 上較接近

這點對你的 TTS data pipeline 有直接關係，因為它暗示 training / inference prompt style 會影響 TTS controllability 和 speech quality。

## 主要結果
README 沒有提供 formal benchmark 或 ablation，因此目前不能把它當成有完整實驗結果的 paper summary。

更適合把它標成：

- repo / model release
- 可實驗的 TTS baseline
- 與 WhisperD transcription style 相關的 prompt-format reference

## Project relevance
- **project-tts-data-pipeline**：高度相關。Echo-TTS 的 prompt format、speaker reference conditioning、punctuation handling、speaker drift 問題，都可以作為設計 TTS data cleaning / transcript formatting / inference control 的參考。
- **project-full-duplex-data**：中度相關。它目前主要是 single-speaker conditioned TTS，但 `[S1]` prompt format 和 reference-conditioned generation 可能延伸到 multi-speaker / dialogue synthesis。

## Related papers in my pool
可以和目前 pool 裡的 TTS / speech generation papers 一起比較：

- **Seed-TTS**：同樣是 high-quality speech generation / TTS model family，可以比較 prompt format、speaker conditioning 和 release constraints。
- **PilotTTS**：更偏 modular TTS recipe，可用來比較 Echo-TTS 的 practical recipe 是否完整。
- **RobustSpeechFlow**：若之後加入，適合比較 content fidelity、skip / repeat error mitigation。

## OpenReview / reviewer discussion
目前沒有找到公開 OpenReview review/rebuttal context。這是一個 blog / GitHub / Hugging Face release，不是 OpenReview-hosted paper。

## 我該不該細讀
**建議保留並做中度細讀。**

原因是它不是完整 paper，但 repo 對你的 TTS data pipeline 很實用，尤其是：

- WhisperD-style transcript format
- speaker reference conditioning
- prompt punctuation 對 expressiveness / quality 的影響
- speaker drift 與 Force Speaker control
- low-VRAM inference settings

如果要進一步用於研究設計，下一步應該讀 blog post 和 inference code，而不是只看 README。

## 可能的弱點 / open questions
- README 沒有 formal benchmark，無法量化品質
- training data recipe 不完整
- non-commercial output/license constraints 需要注意
- blockwise generation README 說尚未 thoroughly tested
- prompt style 對 quality 的影響目前比較像 engineering note，還不是 systematized evaluation

## Tags
- tts
- speaker-conditioning
- whisperd
- speech-data
- project-tts-data-pipeline

## Concepts
- speaker reference conditioning
- WhisperD transcription style
- prompt punctuation control
- speaker drift
- blockwise generation

## Citation
```bibtex
@misc{darefsky2025echo,
  author = {Darefsky, Jordan},
  title = {Echo-TTS},
  year = {2025},
  url = {https://jordandarefsky.com/blog/2025/echo/}
}
```
