import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

// Versátil: modo count-up o countdown si se pasa countdownFrom.
// Props:
// active: bool
// resetKey: reinicia el reloj al cambiar
// countdownFrom: segundos (si definido => cuenta regresiva)
// onTick(value): remaining (countdown) o elapsed (count-up)
// onExpire(): se dispara cuando countdown llega a 0
const Timer = ({ active, resetKey, countdownFrom, onTick, onExpire }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(()=>{ setElapsed(0); }, [resetKey]);
  useEffect(()=>{
    if(!active) return; const id=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(id);
  }, [active]);
  const remaining = countdownFrom!=null ? Math.max(0, countdownFrom - elapsed) : elapsed;
  useEffect(()=>{ onTick && onTick(countdownFrom!=null ? remaining : elapsed); }, [remaining, elapsed, countdownFrom, onTick]);
  useEffect(()=>{ if(countdownFrom!=null && remaining===0) { onExpire && onExpire(); } }, [remaining, countdownFrom, onExpire]);
  return (
    <Typography variant="caption" sx={{ fontFamily:'monospace' }}>
      {countdownFrom!=null ? `Time Left: ${format(remaining)}` : `Time: ${format(elapsed)}`}
    </Typography>
  );
};
function format(s){
  const m=Math.floor(s/60); const r=s%60; return `${m}:${r.toString().padStart(2,'0')}`;
}
export default Timer;
