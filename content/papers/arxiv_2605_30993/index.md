---
paper_key: arxiv_2605_30993
canonical_id: "arxiv:2605.30993"
title: "SwanVoice: Expressive Long-Form Zero-Shot Speech Synthesis for Both Monologue and Dialogue"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.30993"
pdf_url: "https://arxiv.org/pdf/2605.30993"
status: pending-summary
rating: 0
tags:
  - speech-llm
  - tts
  - dialogue
  - speech-data
  - project-full-duplex-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links

- [arXiv abstract](https://arxiv.org/abs/2605.30993)
- [PDF](https://arxiv.org/pdf/2605.30993)
- [Project / demos](https://swanaigc.github.io/#/swanvoice)

## Status

已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。

## Abstract

Zero-shot text-to-speech (TTS) has improved substantially for single-speaker synthesis, yet expressive long-form multi-speaker dialogue remains difficult. A common workaround is to synthesize each turn with a monologue TTS model and stitch the outputs together. This adds inference cost and often breaks acoustic consistency, conversational coherence, and affective continuity across turns. Recent dialogue TTS systems have begun to address this setting, but they still struggle to keep expressive coherence, controllable speaker switching, and monologue quality at the same time. We present SwanData-Speech and SwanVoice. SwanData-Speech builds monologue and dialogue corpora from in-the-wild audio, using Swan Forced Aligner for pause-aware word-level alignment and RobustMegaTTS3 for pronunciation-hard cases. Built on these data, SwanVoice is a zero-shot TTS model for 1--4 speakers, combining a 25 Hz VAE, raw-text conditioning with pause-aware symbols and pinyin substitution, and a flow-matching DiT with speaker-turn conditioning. Training starts from monologue speech, moves through mixed and real dialogue data, and then uses DiffusionNFT post-training with phone-level and speaker-similarity rewards. On SwanBench-Speech, SwanVoice obtains higher richness and hierarchy scores than all evaluated open-source baselines in both monologue and dialogue settings, while content accuracy remains the main limitation. Audio demos are available at https://swanaigc.github.io/#/swanvoice.

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{li2026swanvoice,
  title={SwanVoice: Expressive Long-Form Zero-Shot Speech Synthesis for Both Monologue and Dialogue},
  author={Ruiqi Li and Yu Zhang and Changhao Pan and Ke Lei and Xiang Yin and Cheng Yang},
  year={2026},
  eprint={2605.30993},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.30993}
}
```
