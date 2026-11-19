export function joystickAxes(dx,dy){
  const distance=Math.hypot(dx,dy);
  const deadZone=4,fullTravel=38;
  if(!Number.isFinite(distance)||distance<=deadZone)return [0,0];
  const scale=Math.min(1,(distance-deadZone)/(fullTravel-deadZone))/distance;
  return [dx*scale,-dy*scale];
}

// Each surface owns one pointer. A second finger cannot replace an active drag.
export function bindGameControls({canvas, joystick, stick, runButton, inputs, camera, settings, enabled, onCameraInput=()=>{}}) {
  let cameraPointer = null, joystickPointer = null, runPointer = null;
  let previousX = 0, previousY = 0;
  const listen = (element, type, callback) => element.addEventListener(type, callback, type === 'wheel' ? {passive:false} : undefined);
  const capture = (element, event) => { event.preventDefault(); element.setPointerCapture(event.pointerId); };
  function reset() {
    inputs.keys.clear();
    inputs.joystickX = inputs.joystickY = 0;
    inputs.runTouch = false;
    stick.style.transform = 'translate(0px,0px)';
    for (const [element, pointer] of [[canvas,cameraPointer],[joystick,joystickPointer],[runButton,runPointer]]) {
      if (pointer !== null && element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
    }
    cameraPointer = joystickPointer = runPointer = null;
  }
  listen(canvas, 'pointerdown', e => {
    if (!enabled() || cameraPointer !== null || e.button !== 0) return;
    cameraPointer = e.pointerId; previousX = e.clientX; previousY = e.clientY; capture(canvas, e);
  });
  listen(canvas, 'pointermove', e => {
    if (cameraPointer !== e.pointerId || !enabled()) return;
    const dx = e.clientX - previousX, dy = e.clientY - previousY;
    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      const delta=-dx*settings.yawSensitivity;
      const pitch=Math.min(settings.maxPitch,Math.max(settings.minPitch,camera.pitch+dy*settings.pitchSensitivity));
      if(delta||pitch!==camera.pitch)onCameraInput(delta);
      camera.yaw=(camera.yaw+delta)%(Math.PI*2);
      camera.pitch=pitch;
    }
    previousX = e.clientX; previousY = e.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, type, e => {
    if (cameraPointer === e.pointerId) cameraPointer = null;
  });
  listen(canvas, 'wheel', e => {
    e.preventDefault();
    if (enabled() && Number.isFinite(e.deltaY)) camera.distance = Math.min(settings.maxDistance,
      Math.max(settings.minDistance, camera.distance + Math.sign(e.deltaY)));
  });
  listen(canvas, 'contextmenu', e => e.preventDefault());
  function moveJoystick(e) {
    const r = joystick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (![dx, dy].every(Number.isFinite)) return;
    [inputs.joystickX,inputs.joystickY]=joystickAxes(dx,dy);
    const travel = Math.min(38, Math.min(r.width, r.height) * .29);
    stick.style.transform = `translate(${inputs.joystickX * travel}px,${-inputs.joystickY * travel}px)`;
  }
  listen(joystick, 'pointerdown', e => {
    if (!enabled() || joystickPointer !== null) return;
    joystickPointer = e.pointerId; capture(joystick, e); moveJoystick(e);
  });
  listen(joystick, 'pointermove', e => {
    if (joystickPointer === e.pointerId && enabled()) moveJoystick(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(joystick, type, e => {
    if (joystickPointer !== e.pointerId) return;
    joystickPointer = null; inputs.joystickX = inputs.joystickY = 0; stick.style.transform = 'translate(0px,0px)';
  });
  listen(runButton, 'pointerdown', e => {
    if (!enabled() || runPointer !== null) return;
    runPointer = e.pointerId; inputs.runTouch = true; capture(runButton, e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(runButton, type, e => {
    if (runPointer === e.pointerId) { runPointer = null; inputs.runTouch = false; }
  });
  return {reset};
}
