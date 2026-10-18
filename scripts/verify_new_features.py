import httpx

r1 = httpx.get('http://127.0.0.1:8000/api/llm/status')
print('1. LLM Status:', r1.status_code, r1.json())

r2 = httpx.get('http://127.0.0.1:8000/mcp')
print('2. MCP Info:', r2.status_code, r2.json())

r3 = httpx.post('http://127.0.0.1:8000/mcp', json={'jsonrpc':'2.0', 'id':1, 'method':'tools/list'})
print('3. MCP tools/list count:', len(r3.json()['result']['tools']))

r4 = httpx.post('http://127.0.0.1:8000/mcp', json={'jsonrpc':'2.0', 'id':2, 'method':'tools/call', 'params':{'name':'rank_risk', 'arguments':{'repo':'taskflow'}}})
print('4. MCP tools/call rank_risk success:', 'result' in r4.json())

r5 = httpx.get('http://127.0.0.1:8000/')
print('5. Frontend SPA root:', r5.status_code, 'root' in r5.text)
