export function speedShortcut(event){
  if(event.ctrlKey||event.metaKey||event.altKey||event.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return 0;
  return ['+','='].includes(event.key)?1:['-','−'].includes(event.key)?-1:0;
}

export function bindSpeedPanel(root,player,{minimized=false,onFocus=()=>{}}={}){
  const slider=root.querySelector('input'),badge=root.querySelector('[data-multiplier]');
  const configured=root.querySelector('[data-configured]'),actual=root.querySelector('[data-actual]');
  const toggle=root.querySelector('[data-toggle]'),body=root.querySelector('[data-body]');
  const minus=root.querySelector('[data-minus]'),plus=root.querySelector('[data-plus]');
  const format=value=>value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  function render(){
    slider.value=String(player.multiplier);
    badge.textContent=`${player.multiplier.toLocaleString('pt-BR')}×`;
    configured.textContent=`Caminhar ${format(player.configuredSpeed())} · Correr ${format(player.configuredSpeed(true))} un/s`;
    slider.setAttribute('aria-valuetext',`${player.multiplier.toLocaleString('pt-BR')} vezes`);
    minus.disabled=player.multiplier===1;plus.disabled=player.multiplier===5;
  }
  function collapse(value){
    body.hidden=value;toggle.setAttribute('aria-expanded',String(!value));
    toggle.setAttribute('aria-label',value?'Expandir controle de velocidade':'Minimizar controle de velocidade');
    toggle.textContent=value?'⌄':'⌃';
  }
  root.addEventListener('focusin',onFocus);
  slider.addEventListener('input',()=>{player.setMultiplier(Number(slider.value));render();});
  minus.addEventListener('click',()=>{player.setMultiplier(player.multiplier-.5);render();});
  plus.addEventListener('click',()=>{player.setMultiplier(player.multiplier+.5);render();});
  root.querySelector('[data-normal]').addEventListener('click',()=>{player.setMultiplier(1);render();});
  toggle.addEventListener('click',()=>collapse(!body.hidden));
  render();collapse(minimized);
  let lastSpeed=null;
  return {
    shortcut(event){const direction=speedShortcut(event);if(!direction)return false;event.preventDefault();player.setMultiplier(player.multiplier+direction*.5);render();return true;},
    update(speed){
      const value=format(Number.isFinite(speed)?speed:0);
      if(lastSpeed!==value){actual.textContent=`Atual: ${value} un/s`;lastSpeed=value;}
    },
  };
}
