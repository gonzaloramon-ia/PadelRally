/* Room transport for Padel Rally Online Coop Alpha; host simulates, guest controls yellow. */
(function(g){'use strict';
class PadelTransport {
 constructor(url){this.url=url;this.socket=null;this.role=null;this.code=null;this.onmessage=null;this.onstatus=null;this.seq=0;}
 connect(){return new Promise((resolve,reject)=>{
  const ws=new WebSocket(this.url);this.socket=ws;
  ws.onopen=()=>{this.status('Conectado al servidor');resolve();};
  ws.onerror=()=>{this.status('Error de conexión');reject(new Error('No se pudo conectar'));};
  ws.onclose=()=>{this.status('Desconectado');this.role=null;this.code=null;};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}
   if(m.type==='joined'){this.role=m.role;this.code=m.code;}
   if(this.onmessage)this.onmessage(m);
  };
 });}
 status(text){if(this.onstatus)this.onstatus(text);}
 send(m){if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify(m));return true;}
 create(){return this.send({type:'create'});}join(code){return this.send({type:'join',code:String(code).toUpperCase()});}
 input(buttons){return this.send({type:'input',buttons});}
 snapshot(state){if(this.role==='host')return this.send({type:'snapshot',seq:++this.seq,state});return false;}
 close(){this.send({type:'leave'});this.socket?.close();}
}
g.PadelTransport=PadelTransport;
})(window);
