---
name: card-art-upscaler
description: >-
  Use this skill to upscale low-resolution card art, images, or sprites using Real-ESRGAN Vulkan with AMD/NVIDIA GPU hardware acceleration.
---

# Card Art Upscaler (Real-ESRGAN Vulkan)

This skill utilizes `realesrgan-ncnn-vulkan`, a standalone GPU-accelerated engine that runs natively on AMD Radeon (via Vulkan API) and NVIDIA GPUs without needing Python, PyTorch, or CUDA.

## Capabilities

- **4x/8x Upscaling**: Transforms 2008-era 100~300px low-res images into 1080p/4K high-definition assets.
- **Denoising & Edge Sharpening**: Cleans up JPG compression artifacts while preserving painted strokes.
- **Optimized Models**:
  - `realesr-animevideov3`: Best for anime/stylized hand-drawn illustration and card art, very fast.
  - `realesrgan-x4plus-anime`: Best for detailed fantasy card artwork, smooth gradients, lines.
  - `realesrgan-x4plus`: General purpose photographic / painted 4x upscaler.

## Usage Guide

### 1. Single Image Upscale
Run the PowerShell script:
```powershell
d:\sync\project\Spectromancer\tools\realesrgan\upscale.ps1 -InputPath "d:\sync\project\Spectromancer\pc\Images\Cards\GoblinBerserker.jpg" -OutputPath "d:\sync\project\Spectromancer\android\public\cards\GoblinBerserker_hd.png" -Model "realesr-animevideov3"
```

### 2. Batch Folder Upscale
To upscale an entire card directory:
```powershell
d:\sync\project\Spectromancer\tools\realesrgan\upscale.ps1 -InputDir "d:\sync\project\Spectromancer\pc\Images\Cards" -OutputDir "d:\sync\project\Spectromancer\android\public\cards_hd" -Model "realesrgan-x4plus-anime"
```

### 3. Verification
Verify that the output image dimensions and visual quality match expectations:
- Check file size and dimensions using PowerShell or image viewer.
- Compare original vs upscaled side by side.
