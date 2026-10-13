from pathlib import Path
import subprocess,os,json
D=Path(__file__).resolve().parent
ID=json.loads((D/'config.json').read_text())['id']
def probe(f,frames):
 v=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames','-of','json',str(f)]))['streams'][0]
 assert int(v['nb_frames'])==frames,(f,v)
for v in ['front','side','rear']:
 target=D/f'{ID}_BG02_{v}_walk_v05.mp4';tmp=target.with_suffix('.mp4.tmp')
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-framerate','24','-i',str(D/f'renders/{v}/%04d.png'),'-c:v','libx264','-threads','2','-crf','17','-pix_fmt','yuv420p','-f','mp4',str(tmp)],check=True,stdin=subprocess.DEVNULL)
 probe(tmp,48);os.replace(tmp,target)
(D/'concat.txt').write_text(''.join(f"file '{ID}_BG02_{v}_walk_v05.mp4'\n" for v in ['front','side','rear']))
target=D/f'{ID}_BG02_3view_walk_review_v05.mp4';tmp=target.with_suffix('.mp4.tmp')
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','0','-i',str(D/'concat.txt'),'-c','copy','-f','mp4',str(tmp)],check=True,stdin=subprocess.DEVNULL)
probe(tmp,144);os.replace(tmp,target)
print(ID,'verified 3x48 frames +144 frame montage',flush=True)
