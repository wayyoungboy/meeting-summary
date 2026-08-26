"""
语音识别服务 - FunASR集成
支持说话人分离功能
"""
import logging
from typing import List, Dict
from sqlalchemy.orm import Session
from app.config import MODEL_DIR
from app.models.transcript import Transcript

logger = logging.getLogger(__name__)

# FunASR模型缓存（单模型管道，包含ASR+VAD+PUNC+SPK）
_asr_model = None


def load_asr_model():
    """
    加载 ASR 模型管道（说话人分离组合模型）

    使用本地下载的模型文件，显式加载 VAD、PUNC、SPK 子模型
    """
    global _asr_model
    if _asr_model is None:
        try:
            from funasr import AutoModel

            logger.info("Loading ASR model pipeline from local models...")

            _asr_model = AutoModel(
                model=str(MODEL_DIR / "paraformer-large-vad-punc"),
                vad_model=str(MODEL_DIR / "fsmn-vad"),
                punc_model=str(MODEL_DIR / "ct-transformer-punc"),
                spk_model=str(MODEL_DIR / "campplus_sv"),
                device="cpu",
            )
            logger.info("ASR pipeline loaded successfully with VAD, PUNC, and SPK models")
        except Exception as e:
            logger.error(f"Failed to load ASR pipeline: {e}")
            raise
    return _asr_model


def transcribe_audio(audio_path: str, use_diarization: bool = True) -> List[Dict]:
    """
    转写音频文件（支持说话人分离）

    Args:
        audio_path: 音频文件路径
        use_diarization: 是否使用说话人分离

    Returns:
        转写结果列表，每个元素包含 speaker, content, start_time, end_time
    """
    try:
        model = load_asr_model()

        # 执行语音识别（多模型管道自动处理VAD、ASR、PUNC、SPK）
        result = model.generate(input=audio_path, return_spk_res=use_diarization)

        if not result:
            raise RuntimeError("语音识别未返回结果")

        # 解析结果
        transcript_data = result[0]

        # 说话人分离结果在 sentence_info 字段
        if use_diarization and "sentence_info" in transcript_data:
            sentence_info = transcript_data["sentence_info"]
            segments = []

            for i, sentence in enumerate(sentence_info):
                # 时间戳单位为毫秒，转换为秒
                start_ms = sentence.get("start", 0)
                end_ms = sentence.get("end", 0)
                segment = {
                    "speaker": f"说话人{sentence.get('spk', 0)}",
                    "content": sentence.get("text", ""),  # 字段名是text，不是sentence
                    "start_time": start_ms / 1000.0 if start_ms else 0,
                    "end_time": end_ms / 1000.0 if end_ms else 0,
                    "sequence": i + 1
                }
                segments.append(segment)

            return segments

        # 如果没有说话人分离结果，使用timestamp解析
        elif "timestamp" in transcript_data:
            text = transcript_data.get("text", "")
            timestamps = transcript_data.get("timestamp", [])

            if timestamps and len(timestamps) > 0:
                # 按时间戳分段
                segments = []
                # 这里简化处理：整体作为一段
                segments.append({
                    "speaker": "说话人",
                    "content": text,
                    "start_time": timestamps[0][0] / 1000.0 if timestamps else 0,
                    "end_time": timestamps[-1][1] / 1000.0 if timestamps else 0,
                    "sequence": 1
                })
                return segments
            else:
                return [{
                    "speaker": "说话人",
                    "content": text,
                    "start_time": 0,
                    "end_time": transcript_data.get("duration", 0),
                    "sequence": 1
                }]

        # 最简情况：只有文本
        else:
            text = transcript_data.get("text", "")
            if isinstance(text, list):
                text = " ".join(text)

            return [{
                "speaker": "说话人",
                "content": text,
                "start_time": 0,
                "end_time": transcript_data.get("duration", 0),
                "sequence": 1
            }]

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        logger.exception("ASR transcription failed")
        raise RuntimeError("语音转写失败") from e


def save_transcript(db: Session, meeting_id: int, segments: List[Dict]) -> None:
    """
    将转写结果保存到数据库

    Args:
        db: 数据库会话
        meeting_id: 会议ID
        segments: 转写片段列表
    """
    # 先清除旧的转写记录
    db.query(Transcript).filter(Transcript.meeting_id == meeting_id).delete()

    # 保存新的转写记录
    for segment in segments:
        transcript = Transcript(
            meeting_id=meeting_id,
            speaker=segment.get("speaker"),
            content=segment.get("content"),
            start_time=segment.get("start_time"),
            end_time=segment.get("end_time"),
            sequence=segment.get("sequence", 0)
        )
        db.add(transcript)

    db.commit()


def get_transcript(db: Session, meeting_id: int) -> List[Dict]:
    """
    获取会议的转写结果

    Args:
        db: 数据库会话
        meeting_id: 会议ID

    Returns:
        转写片段列表
    """
    transcripts = db.query(Transcript).filter(
        Transcript.meeting_id == meeting_id
    ).order_by(Transcript.sequence).all()

    segments = []
    for t in transcripts:
        segments.append({
            "speaker": t.speaker,
            "content": t.content,
            "start_time": t.start_time,
            "end_time": t.end_time,
            "sequence": t.sequence
        })

    return segments


def format_transcript_text(segments: List[Dict]) -> str:
    """
    将转写片段格式化为文本，用于LLM处理

    Args:
        segments: 转写片段列表

    Returns:
        格式化后的文本
    """
    lines = []
    for segment in segments:
        speaker = segment.get("speaker", "未知")
        content = segment.get("content", "")
        lines.append(f"{speaker}: {content}")

    return "\n".join(lines)


def get_audio_duration(audio_path: str) -> int:
    """
    获取音频时长

    Args:
        audio_path: 音频文件路径

    Returns:
        音频时长（秒）
    """
    try:
        import torchaudio
        waveform, sample_rate = torchaudio.load(audio_path)
        duration = waveform.shape[1] / sample_rate
        return int(duration)
    except Exception as e:
        logger.error(f"Failed to get audio duration: {e}")
        return 0
