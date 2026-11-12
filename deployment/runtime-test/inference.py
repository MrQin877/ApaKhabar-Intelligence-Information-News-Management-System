import os,time,requests
start=time.monotonic()
r=requests.post('http://llama-writer:8080/v1/chat/completions',json={'model':'apakhabar-gemma','messages':[{'role':'user','content':'Reply with just the word OK.'}],'max_tokens':16,'temperature':0},timeout=90)
r.raise_for_status()
print({'writer_http':r.status_code,'seconds':round(time.monotonic()-start,2),'reply':r.json()['choices'][0]['message']['content'],'usage':r.json().get('usage')},flush=True)
r=requests.get('http://127.0.0.1:8001/health/models',headers={'X-ApaKhabar-Service-Token':os.environ['APAKHABAR_AI_SERVICE_TOKEN']},timeout=90)
print({'fastapi_model_probe':r.status_code,'result':r.json()},flush=True)
r.raise_for_status()
