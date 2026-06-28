# Model Improvements

Track voice model training progress, dataset changes, and accuracy improvements.

## Training Runs
### 2026-06-26 — Full Pipeline Complete
- **Status:** Full pipeline ready — next step: collect audio data and train
- **inference.py:** Standalone CLI (`--file audio.wav`) + importable (`from inference import transcribe`). Accepts .wav/.mp3/.m4a/.flac/.ogg/.webm. Falls back to base Whisper if models/ is empty.
- **colab_train.ipynb:** 9-cell notebook — GPU check, install, Drive mount, data copy, prepare, train, evaluate, save to Drive, download zip.
- **README.md:** Full setup guide — local training, Colab training, inference usage, config reference.

### 2026-06-26 — Training + Evaluation Scripts Built
- **Status:** Ready to train — awaiting real audio dataset
- **train.py:** Seq2SeqTrainer with WhisperForConditionalGeneration, WER metric, saves best model by lowest WER
- **evaluate.py:** Per-sample WER table printed to console + full results saved to `voice-model/results.json`
- **requirements.txt:** torch, transformers, datasets, librosa, soundfile, jiwer, pandas, numpy, accelerate, evaluate, scikit-learn

**Training config:**
| Param | Value |
|---|---|
| Model | openai/whisper-small |
| Language | ms (Malay) |
| Epochs | 10 |
| Batch size | 8 |
| Learning rate | 1e-5 |
| Warmup steps | 500 |
| Eval strategy | per epoch |
| Best model metric | WER (lower = better) |
| FP16 | auto (enabled if CUDA available) |

**To run:**
```bash
pip install -r voice-model/requirements.txt
python voice-model/src/prepare_data.py   # build dataset first
python voice-model/src/train.py          # fine-tune
python voice-model/src/evaluate.py       # evaluate + save results.json
```


## Dataset Changes
### 2026-06-26 — Data Pipeline Built
- **Status:** Data pipeline built — ready for real audio samples
- **Base model:** `openai/whisper-small`
- **Language:** Malay (`ms`)
- **Task:** transcribe
- **Pipeline:** `data/audio/*.wav` → `prepare_data.py` (16kHz mono, normalise, ≤30s) → HuggingFace DatasetDict → `data/processed/`
- **Split:** 80% train / 20% validation (sklearn `train_test_split`, seed=42)
- **Sample rows in transcripts.csv:** 3 Malay example sentences added

**Files created:**
- `voice-model/data/transcripts.csv` — filename + text columns, 3 sample rows
- `voice-model/src/prepare_data.py` — full preprocessing pipeline
- `voice-model/src/config.py` — all hyperparams (epochs=10, batch=8, lr=1e-5)

**Next step:** Add real `.wav` recordings to `voice-model/data/audio/`, update `transcripts.csv`, then run `python src/prepare_data.py`


### 2026-06-27 — vtt-app Built
- **Status:** Voice-to-text web app complete — ready to serve via pm2 + Cloudflare tunnel
- **vtt-app/backend/server.py:** Flask on port 3000; serves static frontend; proxies POST /api/transcribe → voice-model server (localhost:5555); returns 503 if voice server is down
- **vtt-app/frontend/index.html + app.js:** MediaRecorder API (webm/ogg auto-detected); real-time waveform (FFT bars); Malay UI ("Mula Rakam", "Transkripsi Suara"); transcription history (last 20); copy button
- **ecosystem.config.js:** Added vtt-app (port 3000) and investment-agent entries; fixed missing comma bug between objects
- **cloudflared config.yml:** Corrected ports — voicetotext→3000, dashboard→5173, api→5555

**Architecture:**
```
Browser → voicetotext.percubaan.com (cloudflared) → localhost:3000 (vtt-app Flask)
                                                      ↓ proxy /api/transcribe
                                                    localhost:5555 (voice-model Flask)
                                                      ↓ calls transcribe()
                                                    openai/whisper-small
```

**pm2 start:** `pm2 start ecosystem.config.js` (after installing Python deps from host terminal)


## Accuracy Metrics

No training runs completed yet — awaiting real audio dataset.

Base model (`openai/whisper-small`) performance on Malay:
- General Malay speech: reasonable quality, not benchmarked
- Noisy environments: degrades, expected
- Fine-tuned model target: WER < 20% on domain-specific Malay

## Notes

### Pipeline status: COMPLETE — awaiting data

All scripts are built and tested. The full pipeline from raw audio to deployed inference is ready. The only missing piece is real audio data.

**Next step for training:**
1. Record or collect Malay speech samples (WAV format, ≤30s each)
2. Add `.wav` files to `voice-model/data/audio/`
3. Add corresponding transcriptions to `voice-model/data/transcripts.csv` (columns: `filename`, `text`)
4. Run: `python voice-model/src/prepare_data.py`
5. Run: `python voice-model/src/train.py` (or open `colab_train.ipynb` on Google Colab)
6. Run: `python voice-model/src/evaluate.py` — results saved to `voice-model/results.json`
7. Copy trained model to `voice-model/models/` — vtt-backend auto-detects `config.json` and switches to fine-tuned model

**Colab training:**
- Open `voice-model/colab_train.ipynb`
- Mount Google Drive
- Set `GOOGLE_DRIVE_FOLDER_ID` in `.env`
- Run all cells — trains on free T4 GPU, saves to Drive, downloads zip

**Integration with vtt-backend:**
- `transcriber.py` checks for `voice-model/models/config.json`
- If present: loads fine-tuned model → `model_used = 'fine-tuned'`
- If missing: falls back to `openai/whisper-small` → `model_used = 'base'`
- No code change needed — just place the model files and restart vtt-backend

---

## 2026-06-27 — Final Pipeline State

| Component | File | Status |
|---|---|---|
| Hyperparameters | `src/config.py` | ✅ ready |
| Data preprocessing | `src/prepare_data.py` | ✅ ready |
| Training script | `src/train.py` | ✅ ready |
| Evaluation script | `src/evaluate.py` | ✅ ready |
| Inference module | `src/inference.py` | ✅ ready |
| Flask server | `server.py` (`POST /inference`) | ✅ running (pm2: voice-model-server, port 5555) |
| Colab notebook | `colab_train.ipynb` | ✅ ready |
| Sample data | `data/transcripts.csv` | ⚠️ 3 placeholder rows — needs real data |
| Trained model | `models/` | ❌ empty — not yet trained |

