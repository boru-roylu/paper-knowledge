---
paper_key: arxiv_2605_31521
canonical_id: "arxiv:2605.31521"
title: "UniAudio-Token: Empowering Semantic Speech Tokenizers with General Audio Perception"
year: 2026
venue: "arXiv preprint"
url: "https://arxiv.org/abs/2605.31521"
pdf_url: "https://arxiv.org/pdf/2605.31521"
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
- [arXiv abstract](https://arxiv.org/abs/2605.31521)
- [PDF](https://arxiv.org/pdf/2605.31521)
- [Code](https://github.com/Tencent/Universal_Audio_Tokenizer)
## Status
已完成 deterministic ingest：metadata、source archive、source extraction 都已存好。Summary 尚未生成或等待 retry。
## Abstract
Semantic speech tokenizers have become a widely used interface for Audio-LLMs, owing to their compact single-codebook design and strong linguistic alignment. However, their focus on linguistic abstraction induces acoustic blindness, limiting their applicability beyond speech-centric tasks. We propose UniAudio-Token, a framework that empowers semantic tokenizers with general audio perception without compromising speech ability. Instead of altering the semantic paradigm, UniAudio-Token mitigates its information loss through two key innovations: (1) Semantic-Acoustic Primitives (SAP) provide structured supervision by decomposing audio into linguistic content, vocal attributes, and auditory-scene primitives; and (2) Semantic-Acoustic Equilibrium (SAE) introduces a content-aware gating mechanism that adaptively restores fine-grained acoustic details from shallow layers. Extensive evaluations show that UniAudio-Token learns comprehensive universal representations while preserving high-fidelity speech generation. When integrated with downstream LLMs, it outperforms all single-codebook baseline tokenizers on both understanding and generation tasks, effectively serving as a unified audio interface. We publicly release all our code, including training and inference scripts, together with the model checkpoints at https://github.com/Tencent/Universal_Audio_Tokenizer.
## Citation
目前以 arXiv preprint 記錄；若之後找到正式 venue，再更新 citation。
```bibtex
@misc{song2026uniaudiotokenempoweringsemanti,
  title={UniAudio-Token: Empowering Semantic Speech Tokenizers with General Audio Perception},
  author={Yuhan Song and Linhao Zhang and Aiwei Liu and Chuhan Wu and Sijun Zhang and Wei Jia and Yuan Liu and Houfeng Wang and Xiao Zhou},
  year={2026},
  eprint={2605.31521},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  doi={10.48550/arXiv.2605.31521}
}
```
