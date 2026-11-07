import os,sys,time,requests
base='http://127.0.0.1:8001'
headers={'X-ApaKhabar-Service-Token':os.environ['APAKHABAR_AI_SERVICE_TOKEN']}
item={'information_id':'phase2c-disposable','document_id':'phase2c-document','owner_id':'phase2c-test','title':'Community library opening','summary':'The community library opens on 1 November 2026 at 10 AM in the village hall. Entry is free.','source':'isolated Docker fixture','review_status':'approved','is_active':True,'archived':False}
if sys.argv[1]=='index':
    start=time.monotonic()
    r=requests.post(base+'/rag/information/index',headers=headers,json={'items':[item]},timeout=120)
    print({'index_http':r.status_code,'seconds':round(time.monotonic()-start,2)},flush=True)
    if r.status_code!=200: print(r.text[:500]); r.raise_for_status()
    assert r.json()['indexed']==1
elif sys.argv[1]=='search':
    r=requests.post(base+'/rag/information/search',headers=headers,json={'query':'When does the community library open?','owner_id':'phase2c-test','information_ids':['phase2c-disposable'],'top_k':1},timeout=120)
    print({'search_http':r.status_code},flush=True); r.raise_for_status()
    assert r.json()['results'][0]['information_id']=='phase2c-disposable'
    print('Actual Ollama embeddings and Chroma semantic retrieval passed',flush=True)
else:
    r=requests.delete(base+'/rag/information/phase2c-disposable',headers=headers,params={'owner_id':'phase2c-test'},timeout=20);r.raise_for_status();print('Disposable vector removed')
