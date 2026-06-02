---
paper_key: arxiv_2605_31530
canonical_id: "arxiv:2605.31530"
title: "UNISON: A Unified Sound Generation and Editing Framework via Deep LLM Fusion"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31530"
pdf_url: "https://arxiv.org/pdf/2605.31530"
status: pending-summary
rating: 0
tags:
  - speech-llm
  - tts
  - audio-data
  - project-tts-data-pipeline
created: 2026-06-02
---
<div class="paper-nav"><a href="../../">&larr; Papers</a></div>

## Links

- [arXiv abstract](https://arxiv.org/abs/2605.31530)
- [PDF](https://arxiv.org/pdf/2605.31530)
- [Project / demos](https://lizhaoqing.github.io/UNISON-demo/)

## Status

已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。

## Abstract

We present UNISON, a latent diffusion framework that unifies speech generation, sound generation, and audio editing within a single model. A single model handles text-to-audio, text-to-speech, zero-shot speaker cloning, mixed speech-and-sound generation, scene-level audio editing, speech-in-scene editing, and timed temporal composition, all of which share a single set of weights. Our architecture features two core designs: (1) Layer-wise deep LLM fusion, which injects hidden states from uniformly sampled layers of a frozen MLLM into corresponding MM-DiT blocks via learned projections, providing depth-matched semantic conditioning that improves instruction following over single-layer baselines; and (2) a unified multi-task architecture where task identity is encoded solely by a channel-wise mask and source audio is provided through VAE-encoded channel concatenation. Training is stabilized by an online GPU-side multi-task data synthesis pipeline with task-homogeneous batching and a two-stage curriculum. With 621M--732M trainable parameters, UNISON achieves results competitive with or exceeding task-specialist models across evaluated domains, while being roughly 4x smaller than comparable unified systems. Audio samples are available at https://lizhaoqing.github.io/UNISON-demo/.

## Citation

目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。

```bibtex
@misc{li2026unison,
  title={UNISON: A Unified Sound Generation and Editing Framework via Deep LLM Fusion},
  author={Zhaoqing Li and Haoning Xu and Jingran Su and Yaofang Liu and Zhefan Rao and Huimeng Wang and Jiajun Deng and Tianzi Wang and Zengrui Jin and Rui Liu and Haoxuan Che and Xunying Liu},
  year={2026},
  eprint={2605.31530},
  archivePrefix={arXiv},
  primaryClass={cs.SD},
  doi={10.48550/arXiv.2605.31530}
}
```
