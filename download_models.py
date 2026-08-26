from pathlib import Path

from modelscope import snapshot_download

# 模型下载到 backend/models/ 目录下
# 与 asr_service.py 中的 MODEL_DIR 路径一致
MODEL_DIR = Path(__file__).resolve().parent / "backend" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# 下载所有模型
models = [
    # ASR组合模型（Paraformer + VAD + PUNC + SPK）
    ('iic/speech_paraformer-large-vad-punc-spk_asr_nat-zh-cn', 'paraformer-large-vad-punc'),
    # VAD模型（语音端点检测）
    ('iic/speech_fsmn_vad_zh-cn-16k-common-pytorch', 'fsmn-vad'),
    # 标点恢复模型
    ('iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch', 'ct-transformer-punc'),
    # 说话人识别模型（CAM++）
    ('iic/speech_campplus_sv_zh-cn_16k-common', 'campplus_sv'),
]

for model_id, folder_name in models:
    target_dir = MODEL_DIR / folder_name
    print(f"[{models.index((model_id, folder_name)) + 1}/{len(models)}] 正在下载: {model_id}")
    print(f"  目标目录: {target_dir}")
    snapshot_download(model_id, local_dir=str(target_dir))
    print(f"  下载完成: {folder_name}\n")

print("所有模型下载完成！")
