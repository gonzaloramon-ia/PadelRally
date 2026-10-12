#!/usr/bin/env python3
"""Padel Rally Online Coop Alpha: single-port HTTP + WebSocket room relay.

Host browser owns game rules and physics. Server validates room ownership,
message shape/size/rate and relays only sanitized input/snapshots. This is not
server-side competitive authority. Made for invite-only cooperative tests.
"""
import argparse
import asyncio
import json
import os
import secrets
import string
import time
from pathlib import Path
from aiohttp import web, WSMsgType

ROOT = Path(__file__).resolve().parent.parent
ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
MAX_ROOMS = 100
MAX_WS_BYTES = 18000
rooms = {}
connections = {}


def code_new():
    for _ in range(100):
        candidate = ''.join(secrets.choice(ALPHABET) for _ in range(6))
        if candidate not in rooms:
            return candidate
    raise RuntimeError('No se pudo generar sala')


async def send(ws, payload):
    if ws is not None and not ws.closed:
        try:
            await ws.send_json(payload)
        except (ConnectionError, RuntimeError):
            pass


async def broadcast(room, payload):
    await send(room['host'], payload)
    await send(room['guest'], payload)


async def room_status(room):
    await broadcast(room, {'type':'room', 'code':room['code'],
        'host':room['host'] is not None, 'guest':room['guest'] is not None,
        'ready':room['host'] is not None and room['guest'] is not None})


async def leave(ws):
    info = connections.pop(ws, None)
    if info is None:
        return
    room = rooms.get(info['code'])
    if not room or room.get(info['role']) is not ws:
        return
    room[info['role']] = None
    if info['role'] == 'host':
        await broadcast(room, {'type':'ended', 'reason':'El anfitrión se desconectó'})
        guest = room['guest']
        if guest:
            connections.pop(guest, None)
            await guest.close()
        rooms.pop(info['code'], None)
    else:
        await room_status(room)


def sanitize_buttons(raw):
    allowed = ('up','down','left','right','backhand','forehand','lob','smash','sprint',
               'rear','leftGlass','rightGlass')
    if not isinstance(raw, dict):
        return None
    return {k: raw.get(k) is True for k in allowed}


async def websocket(request):
    origin = request.headers.get('Origin')
    # Browsers visiting the served page send a same-origin Origin header.
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        if parsed.hostname != request.host.split(':')[0] and origin != os.getenv('PADEL_PUBLIC_ORIGIN', ''):
            raise web.HTTPForbidden(text='Origin not allowed')
    ws = web.WebSocketResponse(max_msg_size=MAX_WS_BYTES, heartbeat=20)
    await ws.prepare(request)
    recent = []
    try:
        async for packet in ws:
            if packet.type != WSMsgType.TEXT:
                if packet.type == WSMsgType.ERROR: break
                continue
            now = time.monotonic()
            recent = [t for t in recent if now - t < 1]
            recent.append(now)
            if len(recent) > 45:
                await ws.close(code=1008, message=b'Rate limit')
                break
            if len(packet.data) > MAX_WS_BYTES:
                await ws.close(code=1009, message=b'Message too large')
                break
            try:
                msg = json.loads(packet.data)
                if not isinstance(msg, dict):raise ValueError()
            except (TypeError, ValueError):
                await send(ws, {'type':'error','message':'Mensaje inválido'})
                continue
            kind = msg.get('type')
            if kind == 'ping':
                await send(ws, {'type':'pong','sent':msg.get('sent'), 'server':time.time()})
                continue
            if kind == 'leave':
                await leave(ws)
                continue
            if kind in ('create','join'):
                if ws in connections:
                    await send(ws, {'type':'error','message':'Ya estás en una sala'})
                    continue
                if kind == 'create':
                    if len(rooms) >= MAX_ROOMS:
                        await send(ws, {'type':'error','message':'Servidor lleno'})
                        continue
                    code = code_new()
                    room = {'code':code,'host':ws,'guest':None,'seq':-1,'created':now}
                    rooms[code] = room
                    role = 'host'
                else:
                    code = msg.get('code')
                    if not isinstance(code,str) or len(code)>15:
                        await send(ws, {'type':'error','message':'Código inválido'})
                        continue
                    code = code.upper().strip()
                    room = rooms.get(code)
                    if room is None or room['host'] is None:
                        await send(ws, {'type':'error','message':'Sala inexistente'})
                        continue
                    if room['guest'] is not None:
                        await send(ws, {'type':'error','message':'La sala ya tiene dos participantes'})
                        continue
                    room['guest'] = ws
                    role = 'guest'
                connections[ws] = {'code':code,'role':role}
                await send(ws, {'type':'joined','role':role,'code':code})
                await room_status(room)
                continue
            info = connections.get(ws)
            if not info:
                await send(ws, {'type':'error','message':'Primero entrá a una sala'})
                continue
            room = rooms.get(info['code'])
            if room is None:
                continue
            if kind == 'snapshot' and info['role'] == 'host':
                state, seq = msg.get('state'),msg.get('seq')
                if not isinstance(state,dict) or type(seq) is not int or seq<=room['seq']:
                    continue
                if len(json.dumps(state, separators=(',',':'))) > 15000:
                    continue
                room['seq'] = seq
                await send(room['guest'],{'type':'snapshot','seq':seq,'state':state})
            elif kind == 'input' and info['role'] == 'guest':
                buttons = sanitize_buttons(msg.get('buttons'))
                if buttons is not None:
                    await send(room['host'],{'type':'remote_input','buttons':buttons})
            else:
                await send(ws,{'type':'error','message':'Acción no permitida'})
    finally:
        await leave(ws)
    return ws


def static_file(request):
    filename = request.match_info.get('filename','index.html')
    if filename not in ('index.html','partido.html','online.html','game.js','assets.js','audio.js','yellow.js','controls.js','a44-sprites.js','a45-sprites.js','a48-sprites.js'):
        raise web.HTTPNotFound()
    return web.FileResponse(ROOT / filename)


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host',default=os.getenv('HOST','127.0.0.1'))
    parser.add_argument('--port',type=int,default=int(os.getenv('PORT','8765')))
    args = parser.parse_args()
    app = web.Application(client_max_size=MAX_WS_BYTES)
    app.router.add_get('/ws',websocket)
    app.router.add_get('/',static_file)
    app.router.add_get('/{filename}',static_file)
    app.router.add_get('/net/client.js',lambda r:web.FileResponse(ROOT / 'net' / 'client.js'))
    app.router.add_static('/assets',path=ROOT / 'assets',show_index=False)
    print('Padel Rally Coop Alpha: http://%s:%s/online.html' % (args.host,args.port),flush=True)
    web.run_app(app,host=args.host,port=args.port,print=None)

if __name__=='__main__':run()
