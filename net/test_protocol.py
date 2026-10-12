"""End-to-end HTTP/WS test with real server, no browser required."""
import asyncio,json,subprocess,sys,time
from pathlib import Path
from aiohttp import ClientSession, WSMsgType
ROOT=Path(__file__).resolve().parent.parent

async def get(ws):
  m=await ws.receive(timeout=4)
  assert m.type==WSMsgType.TEXT,m
  return json.loads(m.data)

async def run():
  p=subprocess.Popen([sys.executable,str(ROOT/'net/server.py'),'--port','18675'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  try:
    async with ClientSession() as client:
      for _ in range(50):
        try:
          async with client.get('http://127.0.0.1:18675/online.html') as response:
            assert response.status==200
            assert 'DOBLES ONLINE COOPERATIVO' in await response.text()
          break
        except Exception:await asyncio.sleep(.1)
      else:raise RuntimeError('server did not start')
      for resource in ['/net/client.js','/game.js','/assets/court_clean.png']:
        async with client.get('http://127.0.0.1:18675'+resource) as resp:
          assert resp.status==200,(resource,resp.status)
      async with client.ws_connect('http://127.0.0.1:18675/ws',headers={'Origin':'http://127.0.0.1:18675'}) as h,client.ws_connect('http://127.0.0.1:18675/ws',headers={'Origin':'http://127.0.0.1:18675'}) as g:
        await h.send_json({'type':'create'})
        joined=await get(h);assert joined['type']=='joined' and joined['role']=='host'
        code=joined['code'];assert len(code)==6
        room=await get(h);assert room['ready'] is False
        await g.send_json({'type':'join','code':code})
        assert (await get(g))['role']=='guest'
        assert (await get(g))['ready'] is True
        assert (await get(h))['ready'] is True
        await g.send_json({'type':'snapshot','seq':1,'state':{'cheat':True}})
        assert (await get(g))['type']=='error'
        await h.send_json({'type':'snapshot','seq':1,'state':{'ball':{'x':.5},'roster':['human','partner']}})
        m=await get(g);assert m['type']=='snapshot' and m['state']['ball']['x']==.5
        await h.send_json({'type':'snapshot','seq':1,'state':{'stale':True}})
        await g.send_json({'type':'input','buttons':{'right':True,'backhand':True,'hack':True}})
        m=await get(h);assert m['type']=='remote_input' and m['buttons']['right'] and m['buttons']['backhand'] and 'hack' not in m['buttons']
        await g.send_json({'type':'leave'});assert (await get(h))['ready'] is False
        await g.send_json({'type':'join','code':code});assert (await get(g))['type']=='joined';assert (await get(g))['ready'] is True
        assert (await get(h))['ready'] is True
        print('HTTP_STATIC_OK, WS_CREATE_JOIN_OK, INPUT_SANITIZATION_OK, HOST_AUTHORITY_OK, RESUME_ROOM_OK')
  finally:
    p.terminate()
    try:p.wait(timeout=3)
    except subprocess.TimeoutExpired:p.kill()
    if p.returncode not in (0,-15):print('SERVER ERR',p.stderr.read().decode()[-1000:])

if __name__=='__main__':asyncio.run(run())
