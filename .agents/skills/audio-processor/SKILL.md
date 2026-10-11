---
name: audio-processor
description: >-
  Use this skill for game audio processing, music stem separation (伴奏与人声提取), AI rearrangement (重新编曲), variation, and sound effect refinement.
---

# Audio Processor (伴奏提取 / 变奏 / AI 重新编曲)

This skill documents and automates audio asset workflows for game music, background tracks, and spell effects.

## 1. 伴奏分离 (Stem Separation / Vocals & BGM)

### Local Tool: Ultimate Vocal Remover (UVR5)
- **Engine**: MDX-Net / Demucs v4
- **Hardware**: Fully supports Windows GPU (DirectML / Vulkan) & CPU.
- **Workflow**:
  1. Input audio file from `pc/Audio/*.ogg`.
  2. Select Model: `UVR-MDX-NET-Inst_HQ_3` (for clean instrumental) or `Demucs v4 4-Stem` (Vocals, Drums, Bass, Other).
  3. Output stems to target audio folder for game integration.

### Cloud/API Alternative (Replicate / fal.ai)
- Model: `lucataco/demucs`
- Takes any `.ogg` or `.mp3`, returns split URLs for:
  - `vocals.wav`
  - `bass.wav`
  - `drums.wav`
  - `other.wav` (instrumental melody)

## 2. 变奏与重新编曲 (AI Rearrangement & Variation)

### Workflow Pipeline
1. **Audio Analysis**:
   - Identify key signature, BPM, and core melodic motif from original game track.
2. **AI Variation (MusicGen / Suno)**:
   - Provide original track / melody snippet as audio prompt.
   - Describe desired rearrangement style: e.g. "epic orchestral card battle, aggressive brass and timpani, celtic harp fantasy, cinematic remix of the original melody".
3. **Game Loop Normalization**:
   - Ensure the track loops seamlessly (crossfade 0.5s at endpoints).
   - Normalize loudness to -14 LUFS standard for Android/Web games.
