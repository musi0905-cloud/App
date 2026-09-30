"""Validate delivered media with Pillow and ffprobe; does not modify media."""
from pathlib import Path
from PIL import Image
import json,subprocess
root=Path(__file__).resolve().parent.parent
report={'images':[],'movies':[],'limitations':['Browser preview and iPhone physical device not tested in this environment.','Visual review is sampled; not a 100-case gameplay regression test.']}
for p in sorted((root/'images').rglob('*.png')):
 im=Image.open(p);im.verify();im=Image.open(p)
 report['images'].append({'file':str(p.relative_to(root)),'width':im.width,'height':im.height,'mode':im.mode,'bytes':p.stat().st_size})
 if p.parent.name.startswith('visitor-'):assert im.mode=='RGBA' and im.size==(384,512)
for p in sorted((root/'motion').glob('*.mp4')):
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames:format=duration','-of','json',str(p)]))
 v=data['streams'][0]
 assert v['codec_name']=='h264' and v['width']==960 and v['height']==640 and v['nb_frames']=='144',p
 assert v['r_frame_rate']=='24/1' and len(data['streams'])==1 and data['format']['duration']=='6.000000',p
 # Decode entire video rather than only reading metadata.
 subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,capture_output=True)
 report['movies'].append({'file':str(p.relative_to(root)),**data,'bytes':p.stat().st_size})
assert len(report['movies'])==23
report['summary']={'png_count':len(report['images']),'mp4_count':len(report['movies']),'movie_checks':'23/23 fully decoded: H.264, 960x640, 24fps, 144 frames, 6 seconds, no audio','images_bytes':sum(i['bytes'] for i in report['images'])}
(root/'docs'/'QA_technical.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report['summary'],ensure_ascii=False))
