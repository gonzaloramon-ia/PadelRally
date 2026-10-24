/* Player key profiles shared by local game and online guest; independent of physics. */
(function(g){'use strict';
const defaults={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',backhand:'KeyZ',forehand:'KeyX',lob:'KeyC',smash:'Space',drop:'KeyV',sprint:'ShiftLeft',rear:'KeyS',leftGlass:'KeyA',rightGlass:'KeyD',pause:'KeyP'};
const labels={up:'Subir',down:'Bajar',left:'Izquierda',right:'Derecha',backhand:'Familia de revés',forehand:'Familia de derecha',lob:'Familia de globo',smash:'Golpes aéreos',drop:'Juego corto / red',sprint:'Correr',rear:'Vidrio fondo',leftGlass:'Vidrio izquierdo',rightGlass:'Vidrio derecho',pause:'Pausa'};
const legacy={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',backhand:'KeyZ',forehand:'KeyX',lob:'KeyC',smash:'Space',drop:'KeyV',sprint:'ShiftLeft',rear:'KeyS',leftGlass:'KeyA',rightGlass:'KeyD',pause:'KeyP'};
const remote={up:'up',down:'down',left:'left',right:'right',backhand:'backhand',forehand:'forehand',lob:'lob',smash:'smash',drop:'drop',sprint:'sprint',rear:'rear',leftGlass:'leftGlass',rightGlass:'rightGlass'};
const STORE='padel-rally-control-profiles-v1';
let storage={active:'A',profiles:{A:{...defaults},B:{...defaults}}};
try{const val=JSON.parse(localStorage.getItem(STORE));if(val&&['A','B'].includes(val.active)&&val.profiles){storage.active=val.active;for(const id of ['A','B'])if(val.profiles[id])for(const key of Object.keys(defaults))if(typeof val.profiles[id][key]==='string'&&val.profiles[id][key])storage.profiles[id][key]=val.profiles[id][key];}}catch(_){}
let capturing=null,modal=null,message=null,grid=null,profileSelect=null;
// Same-origin online iframe and toolbar must use the same current key profile.
g.addEventListener('storage',e=>{if(e.key!==STORE||!e.newValue)return;try{const next=JSON.parse(e.newValue);if(!next||!['A','B'].includes(next.active)||!next.profiles)return;storage.active=next.active;for(const id of ['A','B'])if(next.profiles[id]){for(const key of Object.keys(defaults))if(typeof next.profiles[id][key]==='string')storage.profiles[id][key]=next.profiles[id][key];}if(modal&&!modal.hidden)render();}catch(_){}});
const mapping=()=>storage.profiles[storage.active];
function save(){try{localStorage.setItem(STORE,JSON.stringify(storage));}catch(_){} }
function actionOf(code){return Object.keys(defaults).find(action=>mapping()[action]===code)||null;}
function toLegacy(code){const action=actionOf(code);if(action)return legacy[action];if(code==='ShiftRight'&&mapping().sprint==='ShiftLeft')return 'ShiftRight';if(Object.values(defaults).includes(code))return '__UNBOUND__';return code;}
function buttonFor(code){return remote[actionOf(code)]||null;}
function friendly(code){const matches={Space:'ESPACIO',ShiftLeft:'SHIFT IZQ',ShiftRight:'SHIFT DER',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'ESC',Enter:'ENTER'};return matches[code]||code.replace(/^Key/,'').replace(/^Digit/,'');}
function render(){if(!grid)return;grid.innerHTML='';profileSelect.value=storage.active;for(const action of Object.keys(defaults)){
 const row=document.createElement('div');row.className='padel-control-row';const name=document.createElement('span');name.textContent=labels[action];const btn=document.createElement('button');btn.type='button';btn.textContent=friendly(mapping()[action]);btn.setAttribute('aria-label','Cambiar '+labels[action]);btn.addEventListener('click',()=>{capturing=action;message.textContent='Presioná una tecla para '+labels[action]+' (ESC cancela).';btn.textContent='TECLA…';btn.focus();});row.append(name,btn);grid.append(row);
 }}
function open(){if(!modal)return;modal.hidden=false;render();message.textContent='Elegí una acción y presioná la nueva tecla. Si ya está usada, intercambiamos las asignaciones.';}
function close(){if(modal)modal.hidden=true;capturing=null;}
function onKey(e){if(!modal||modal.hidden)return;e.preventDefault();e.stopImmediatePropagation();if(e.type!=='keydown')return;
 if(e.code==='Escape'){if(capturing){capturing=null;render();message.textContent='Cambio cancelado.';}else close();return;}
 if(!capturing||e.repeat)return;
 // Do not capture browser/system modifier chords, pure modifier keys or reserved setup keys.
 if(e.ctrlKey||e.altKey||e.metaKey||['ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','Tab','Enter','F5','F11'].includes(e.code)){message.textContent='Elegí una tecla sin Ctrl, Alt o combinaciones del navegador.';return;}
 const active=mapping(),before=active[capturing],other=actionOf(e.code);
 if(other&&other!==capturing){active[other]=before;message.textContent='Tecla utilizada: se intercambiaron '+labels[other]+' y '+labels[capturing]+'.';}
 else message.textContent='Tecla asignada: '+labels[capturing]+' → '+friendly(e.code)+'.';
 active[capturing]=e.code;capturing=null;save();render();
}
function mount(button){if(!button)return;
 modal=document.createElement('div');modal.id='padel-controls-dialog';modal.hidden=true;
 modal.innerHTML='<section role="dialog" aria-modal="true" aria-label="Configurar controles"><header><strong>CONFIGURAR CONTROLES</strong><button type="button" id="padel-ctrl-close">Cerrar ×</button></header><div class="padel-profile-bar"><label>Perfil <select id="padel-ctrl-profile"><option value="A">A</option><option value="B">B</option></select></label><button id="padel-ctrl-reset" type="button">Restaurar perfil</button></div><p id="padel-ctrl-note" aria-live="polite"></p><div id="padel-ctrl-grid"></div><p style="margin:14px 0 0;color:#acd7eb;font-size:12px;line-height:1.45">La potencia cambia la variante del golpe. A+S = fondo + izquierdo · D+S = fondo + derecho. ESPACIO: bandeja / víbora / smash; con contexto adecuado puede salir X3/X4. F11 = pantalla completa del navegador.</p></section>';
 document.body.appendChild(modal);message=modal.querySelector('#padel-ctrl-note');grid=modal.querySelector('#padel-ctrl-grid');profileSelect=modal.querySelector('#padel-ctrl-profile');
 profileSelect.onchange=()=>{storage.active=profileSelect.value;capturing=null;save();render();message.textContent='Perfil '+storage.active+' seleccionado.';};
 modal.querySelector('#padel-ctrl-close').onclick=close;
 modal.querySelector('#padel-ctrl-reset').onclick=()=>{storage.profiles[storage.active]={...defaults};capturing=null;save();render();message.textContent='Perfil restaurado.';};
 button.addEventListener('click',open);
 document.addEventListener('keydown',onKey,true);document.addEventListener('keyup',onKey,true);
}
g.PadelControls={toLegacy,buttonFor,mount,actionOf,mapping,visible:()=>modal&&!modal.hidden};
})(window);
