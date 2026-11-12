import os,requests
headers={'X-ApaKhabar-Service-Token':os.environ['APAKHABAR_AI_SERVICE_TOKEN']}
r=requests.post('http://127.0.0.1:8001/rag/information/search',headers=headers,json={'query':'Docker test','owner_id':'phase2b-disposable','information_ids':[]},timeout=10)
assert r.status_code==200 and r.json()['results']==[]
print('FastAPI KnowledgeService/embedded Chroma empty-search integration: passed; semantic embedding search not tested')
