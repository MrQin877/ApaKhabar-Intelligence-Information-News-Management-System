import sys
import chromadb
from chromadb.config import Settings
client = chromadb.PersistentClient(path='/app/data/chroma', settings=Settings(anonymized_telemetry=False))
if sys.argv[1] == 'write':
    collection = client.get_or_create_collection('phase2b_smoke', embedding_function=None)
    collection.upsert(ids=['disposable'], embeddings=[[1.0, 0.0, 0.0]], documents=['Docker persistence test'])
elif sys.argv[1] == 'read':
    collection = client.get_collection('phase2b_smoke', embedding_function=None)
    assert collection.get(ids=['disposable'])['documents'] == ['Docker persistence test']
    assert collection.query(query_embeddings=[[1.0, 0.0, 0.0]], n_results=1)['ids'][0] == ['disposable']
else:
    client.delete_collection('phase2b_smoke')
print('Chroma ' + sys.argv[1] + ' passed')
