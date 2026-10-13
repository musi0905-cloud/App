from pathlib import Path
import subprocess,json,concurrent.futures
root=Path(__file__).resolve().parent
def run(d):
 logs=[]
 for cmd in [['node',str(d/'render.js')],['node',str(d/'check_frames.js')],['node',str(d/'qa_contact.js')],['python',str(d/'encode.py')]]:
  r=subprocess.run(cmd,capture_output=True,text=True);logs.append({'command':cmd,'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr});(d/'execution_v05.json').write_text(json.dumps(logs,indent=2))
  if r.returncode:return d.name,False
 return d.name,True
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for f in concurrent.futures.as_completed([pool.submit(run,d) for d in sorted(root.glob('NPC*'))]):print(*f.result(),flush=True)
