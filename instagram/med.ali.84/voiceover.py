"""
Daleel AI — Arabic Voiceover Generator
Generates TTS with edge-tts (ar-SA-HamedNeural) and merges with video via ffmpeg.

Usage:
  python voiceover.py <clip_number> <input_video> <output_video>
  python voiceover.py 1 "path/to/1.mov" "path/to/1_voiced.mp4"
"""

import sys
import os
import asyncio
import subprocess
import tempfile
import edge_tts

VOICE = "ar-SA-HamedNeural"  # Arabic male voice (deep, clear)

SCRIPTS = {
    1:  "اكتشف تطبيق دليل — طريقتك الجديدة لفهم القرآن الكريم بمساعدة الذكاء الاصطناعي. جرّبه مجاناً الآن.",
    2:  "مع دليل، اسأل أي سؤال ديني واحصل على إجابة مستندة إلى القرآن والسنة. رفيقك الروحاني دائماً.",
    3:  "هل تساءلت يوماً عن معنى آية؟ تطبيق دليل يعطيك التفسير في ثوانٍ. حمّله مجاناً.",
    4:  "دليل يجمع بين الذكاء الاصطناعي والعلم الشرعي. التكنولوجيا الحديثة في خدمة الإسلام.",
    5:  "ابحث في القرآن الكريم بأي كلمة تعرفها. دليل يفهم سؤالك ويعطيك الإجابة الصحيحة.",
    6:  "تدبّر القرآن الكريم مع تطبيق دليل. كل يوم افهم أعمق وتقرّب أكثر من كلام الله.",
    7:  "سؤال واحد يكفي. اكتب سؤالك ودليل يجيبك من كتاب الله وسنة نبيه صلى الله عليه وسلم.",
    8:  "تطبيق دليل متاح بالعربية والإنجليزية والفرنسية. لكل مسلم يبحث عن الفهم في أي مكان.",
    9:  "رمضان، الصلاة، الزكاة — كل أسئلتك الدينية في تطبيق دليل. إجابات موثوقة في لحظات.",
    10: "دليل — التطبيق الذي يقرّب القرآن من قلبك. للجيل الجديد من المسلمين في كل مكان.",
    11: "ما معنى هذه الآية؟ دليل يجيبك بتفسير واضح مستند إلى العلماء الموثوقين. جرّبه الآن.",
    12: "كل يوم خطوة مع القرآن. تطبيق دليل يساعدك على التعلم والتدبّر المستمر.",
    13: "الذكاء الاصطناعي في خدمة الإسلام. دليل — أكثر من مجرد تطبيق، رفيق روحاني حقيقي.",
    14: "حمّل دليل مجاناً على iOS وAndroid. اكتشف قوة الفهم القرآني في راحة يدك.",
    15: "القرآن الكريم دستور حياتنا. تطبيق دليل يجعله قريباً منك في كل لحظة. ابدأ اليوم.",
}


async def generate_tts(text: str, output_path: str):
    communicate = edge_tts.Communicate(text, VOICE, rate="+5%")
    await communicate.save(output_path)


def merge_audio_video(video_path: str, audio_path: str, output_path: str):
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg error: {result.stderr[-500:]}")


def add_voiceover(clip_num: int, input_path: str, output_path: str):
    script = SCRIPTS.get(clip_num)
    if not script:
        raise ValueError(f"No script for clip {clip_num}")

    print(f"  Generating Arabic voiceover (clip {clip_num})...")

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        audio_path = tmp.name

    try:
        asyncio.run(generate_tts(script, audio_path))
        print(f"  Merging audio + video...")
        merge_audio_video(input_path, audio_path, output_path)
        print(f"  Voiced video: {output_path}")
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python voiceover.py <clip_num> <input_video> <output_video>")
        sys.exit(1)

    clip_num   = int(sys.argv[1])
    input_path = sys.argv[2]
    output_path = sys.argv[3]

    add_voiceover(clip_num, input_path, output_path)
