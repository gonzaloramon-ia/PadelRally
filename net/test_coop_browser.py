import subprocess,sys,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
p=subprocess.Popen([sys.executable,'-u',str(ROOT/'net/server.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 for _ in range(100):
  try:urllib.request.urlopen('http://127.0.0.1:8765/online.html',timeout=.25);break
  except Exception:time.sleep(.12)
 else:raise RuntimeError('Servidor no disponible')
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
  host=browser.new_page(viewport={'width':1400,'height':1050});guest=browser.new_page(viewport={'width':1400,'height':1050})
  errors=[]
  for page,who in [(host,'host'),(guest,'guest')]:
   page.on('pageerror',lambda e,who=who:errors.append((who,str(e))))
   page.on('console',lambda e,who=who:errors.append((who,e.text)) if e.type=='error' else None)
   page.goto('http://127.0.0.1:8765/online.html')
  host.locator('#create').wait_for(state='enabled');host.locator('#create').click()
  host.wait_for_function("document.getElementById('room').textContent.length===6",timeout=6000)
  code=host.locator('#room').inner_text()
  guest.locator('#joincode').fill(code);guest.locator('#join').click()
  host.wait_for_function("document.querySelector('#gameframe').contentWindow?.PadelOnlineBridge?.debug()?.remoteActive===true",timeout=25000)
  guest.wait_for_function("document.querySelector('#gameframe').contentWindow?.PadelOnlineBridge?.debug()?.mode==='guest'",timeout=25000)
  host.wait_for_function("document.querySelector('#gameframe').contentWindow?.__padelDebug?.()?.phase==='intro'",timeout=30000)
  # start game by keyboard Enter inside host iframe
  host.frame_locator('#gameframe').locator('#game').focus()
  host.frame_locator('#gameframe').locator('#game').press('Enter')
  host.wait_for_function("document.querySelector('#gameframe').contentWindow?.__padelDebug?.()?.phase==='serveReady'",timeout=8000)
  guest.wait_for_function("document.querySelector('#gameframe').contentWindow?.__padelDebug?.()?.phase==='serveReady'",timeout=8000)
  x0=host.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug().roster[1].x")
  # guest controls yellow, press right and hold
  guest.keyboard.down('ArrowRight');guest.wait_for_timeout(500)
  x1=host.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug().roster[1].x")
  guest.keyboard.up('ArrowRight')
  guest.wait_for_timeout(400)
  xg=guest.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug().roster[1].x")
  print('REMOTE_PLAYER_MOVEMENT',x0,x1,xg)
  assert x1>x0+.5, (x0,x1)
  assert abs(xg-x1)<.2, (xg,x1)
  # host press serves
  host.frame_locator('#gameframe').locator('#game').press('x',delay=200)
  host.wait_for_function("['serveDrop','rally','pointEnd'].includes(document.querySelector('#gameframe').contentWindow?.__padelDebug?.()?.phase)",timeout=4000)
  print('HOST_SERVE_PHASE',host.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug().phase"))
  # guest cannot start their own physics
  guest.wait_for_timeout(400)
  ha=host.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug()")
  ga=guest.evaluate("document.querySelector('#gameframe').contentWindow.__padelDebug()")
  assert ga['phase']==ha['phase'],(ha['phase'],ga['phase'])
  assert abs(ga['roster'][1]['x']-ha['roster'][1]['x'])<.02
  print('SYNCHRONIZED_SCORE',ha['score'],ga['score'],'roster',ha['roster'][1]['x'])
  assert not errors,errors
  print('BROWSER_2_TABS_COOP_OK')
  host.screenshot(path='/mnt/data/padel_build/coop_host_test.png',full_page=True)
  guest.screenshot(path='/mnt/data/padel_build/coop_guest_test.png',full_page=True)
  browser.close()
finally:
 p.terminate()
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:p.kill()
 print('SERVER_STDERR',p.stderr.read()[-1500:])
