import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

const StrengthsWeaknesses = ({ attempt, feynman }) => {
  if(!attempt || !attempt.breakdown || !Array.isArray(feynman?.key_points)) return null;
  const matchedIdx = new Set(attempt.breakdown.matched_key_points || []);
  const missingIdx = new Set(attempt.breakdown.missing_key_points || []);
  return (
    <Box sx={{ mt:3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight:'bold', mb:1 }}>Key Points</Typography>
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:1 }}>
        {feynman.key_points.map((kp,i)=>{
          const id = kp.id || (i+1);
            const hit = matchedIdx.has(id);
            const miss = missingIdx.has(id);
            return <Chip key={id} size="small" label={kp.point || kp} color={hit? 'success': miss? 'default':'primary'} variant={hit? 'filled':'outlined'} />
        })}
      </Box>
    </Box>
  );
};
export default StrengthsWeaknesses;
