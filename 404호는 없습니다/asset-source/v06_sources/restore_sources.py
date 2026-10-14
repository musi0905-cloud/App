#!/usr/bin/env python3
"""Verify every package and piece, then restore original bytes without overwrite."""
import argparse, hashlib, json, os, tempfile, zipfile
from pathlib import Path, PurePosixPath

def digest(data):return hashlib.sha256(data).hexdigest()
def child(root,name):
    p=PurePosixPath(name)
    if p.is_absolute() or not p.parts or any(x in ('..','.') for x in p.parts) or '\\' in name or ':' in name:
        raise ValueError('Unsafe path: '+name)
    target=root.joinpath(*p.parts).resolve()
    if not target.is_relative_to(root.resolve()):raise ValueError('Path escapes root')
    return target
def verify(data,entry):
    if len(data)!=entry['bytes'] or digest(data)!=entry['sha256']:raise ValueError('Size/hash mismatch')

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,default=Path(__file__).resolve().parent)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--verify-only',action='store_true')
    a=ap.parse_args();m=json.loads((a.input/'SOURCE_MANIFEST.json').read_text())
    if m['format']!='404-byte-pieces-v1':raise ValueError('Unknown format')
    packages={}
    for p in m['packages']:
        path=child(a.input,p['name']);verify(path.read_bytes(),p)
        if p['name'] in packages:raise ValueError('Duplicate package')
        packages[p['name']]=path
    ready={}
    for f in m['files']:
        target=child(a.output,f['path'])
        if target in ready:raise ValueError('Duplicate destination')
        chunks=[]
        for piece in f['pieces']:
            with zipfile.ZipFile(packages[piece['package']]) as z:
                if len([x for x in z.infolist() if x.filename==piece['member']])!=1:raise ValueError('Ambiguous ZIP member')
                if z.getinfo(piece['member']).file_size!=piece['bytes']:raise ValueError('Piece size mismatch')
                b=z.read(piece['member']);verify(b,piece);chunks.append(b)
        data=b''.join(chunks);verify(data,f)
        if target.exists() and (not target.is_file() or digest(target.read_bytes())!=f['sha256']):
            raise ValueError('Conflicting existing file, use a fresh output directory: '+str(target))
        ready[target]=data
    if not a.verify_only:
        for target,data in ready.items():
            if target.exists():continue
            target.parent.mkdir(parents=True,exist_ok=True)
            fd,tmp=tempfile.mkstemp(dir=target.parent,prefix='.restore-')
            try:
                with os.fdopen(fd,'wb') as out:out.write(data)
                os.link(tmp,target) # exclusive creation; never overwrite a concurrent change
            finally:os.unlink(tmp)
    print(json.dumps({'status':'VERIFIED' if a.verify_only else 'RESTORED','files':len(ready),'packages':len(packages),'motion_status':'UNCHANGED_REVISE_BLOCKED'}))

if __name__=='__main__':main()
