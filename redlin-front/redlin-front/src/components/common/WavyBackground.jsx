import React from 'react';
import Box from '@mui/material/Box';

// Base64 SVG provided by user for the wave layer
const WAVE_SVG_DATA_URL = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDQwIiBoZWlnaHQ9IjIzNCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQiIHZpZXdCb3g9IjAgMCAxNDQwIDIzNCI+CjxwYXR0ZXJuIGlkPSJsZy0wIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSIzIj4KPGltYWdlIHdpZHRoPSIxNDQwIiBoZWlnaHQ9IjMiIGhyZWY9ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFCYUFBQUFBRENBTUFBQUJTemxnZEFBQUFHWFJGV0hSVGIyWjBkMkZ5WlFCQlpHOWlaU0JKYldGblpWSmxZV1I1Y2NsbFBBQUFBTUJRVEZSRkFNUEdBUEhsQVAzdEFPSFpBUG5xQUtXeEFPM2lBT2JkQUhTUkFJbWVBR21KQU0zTkFQYm9BTDNCQUlHWkFMRzVBTW5LQU5IUUFJMmdBSEdPQUpXbUFOclZBTjNXQU9yZ0FMYTlBS0d1QUsyMkFKbXBBSHlXQUtxMUFOVFNBSHFVQUc2TUFMaStBTWJJQUlXY0FPZmVBUFBtQUo2c0FHeUtBSnlxQUpDaUFJV2JBTmZVQU43WUFKT2tBUHZzQUxyQUFIZVNBTkRPQUtlekFIK1lBSmVvQUdlSEFMUzdBR2lJQUs2NEFML0VBT1RjQU12TUFPL2pBT1BiQUdlSUFOalNDUTVuRGdBQUFTMUpSRUZVZU5yczFPMWFna0FRQldBcXJTQWpNd3NMVTNUem82V3NGQU10Ni83dnFwbFplV0poSVBxLzc1NDV1M0FCWXgzV3M4QkovYjVJWTlHb285V0MxREtaNEpRNnFQS3BPZVo0bm9kVDRvRXE1d1NpMjI0aFpFZTFnNkFqS3Q0VEhzME5UdFkxaEJXR0lkWGVOL1VnSFBBdTg5NXdOR2VhRDZxTU5vUXpibzh4R2tzMVk3T3g0QlNkUXdwZThPaEd1dDZvVi9TT1IzZkJTcElFSjdtRFpOM2pNSlo1eldXejFDMmdLcGhDT1BQcFBPVWpkYXUzNzBkK0JLaEFOK3J5bm5GMGo2d09wSnpkc2Y4a2hMQ0ZGRUpLaWRlZVZIK0lLOTB5cTVVTGg5T3ZNdXdQV2ErUVNxZElkZFlWSkV2L1NnV3FnaHBtd1F4VDRPQTRFQWR2WHF3U3h6aGd2YWJyaTU2QTJqSUwyaXhvczZETmdqWUwyaXhvczZETmdqWUwyaXhvczZEL3NhQi9CQmdBMlN2SnFOck80UWdBQUFBQVNVVk9SSzVDWUlJPSIvPgo8L3BhdHRlcm4+CjxwYXRoIGQ9IiIgZmlsbD0idXJsKCNsZy0wKSIgb3BhY2l0eT0iMC41Ij4KPGFuaW1hdGUgYXR0cmlidXRlTmFtZT0iZCIgZHVyPSIxMHMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiBrZXlUaW1lcz0iMDswLjMzOzAuNjc7MSIgY2FsY01vZGU9InNwbGluZSIga2V5U3BsaW5lcz0iMC4zIDAgMC43IDE7MC4zIDAgMC43IDE7MC4zIDAgMC43IDEiIGJlZ2luPSIwcyIgdmFsdWVzPSJNMCAwTCAwIDIwMFEgMTQ0IDIwNSAgMjg4IDE2N1QgNTc2IDE0M1QgODY0IDg1VCAxMTUyIDY1VCAxNDQwIDMwTCAxNDQwIDAgWjtNMCAwTCAwIDIyNlEgMTQ0IDIwNSAgMjg4IDE1NlQgNTc2IDE0M1QgODY0IDgwVCAxMTUyIDUyVCAxNDQwIDIxTCAxNDQwIDAgWjtNMCAwTCAwIDIyM1EgMTQ0IDE5NyAgMjg4IDE2MlQgNTc2IDEyM1QgODY0IDk0VCAxMTUyIDYzVCAxNDQwIDIxTCAxNDQwIDAgWjtNMCAwTCAwIDIwMFEgMTQ0IDIwNSAgMjg4IDE2N1QgNTc2IDE0M1QgODY0IDg1VCAxMTUyIDY1VCAxNDQwIDMwTCAxNDQwIDAgWiI+PC9hbmltYXRlPgo8L3BhdGg+PHBhdGggZD0iIiBmaWxsPSJ1cmwoI2xnLTApIiBvcGFjaXR5PSIwLjUiPgo8YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJkIiBkdXI9IjEwcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIGtleVRpbWVzPSIwOzAuMzM7MC42NzsxIiBjYWxjTW9kZT0ic3BsaW5lIiBrZXlTcGxpbmVzPSIwLjMgMCAwLjcgMTswLjMgMCAwLjcgMTswLjMgMCAwLjcgMSIgYmVnaW49Ii01cyIgdmFsdWVzPSJNMCAwTCAwIDIxMlEgMTQ0IDE4NiAgMjg4IDE1OVQgNTc2IDE0NVQgODY0IDgwVCAxMTUyIDYyVCAxNDQwIDI3TCAxNDQwIDAgWjtNMCAwTCAwIDIyMVEgMTQ0IDE4NiAgMjg4IDE2NVQgNTc2IDEzM1QgODY0IDg5VCAxMTUyIDYzVCAxNDQwIDIzTCAxNDQwIDAgWjtNMCAwTCAwIDE5N1EgMTQ0IDE5MCAgMjg4IDE3M1QgNTc2IDE1NlQgODY0IDEyNlQgMTE1MiA4MlQgMTQ0MCA0N0wgMTQ0MCAwIFo7TTAgMEwgMCAyMTJRIDE0NCAxODYgIDI4OCAxNTlUIDU3NiAxNDVUIDg2NCA4MFQgMTE1MiA2MlQgMTQ0MCAyN0wgMTQ0MCAwIFoiPjwvYW5pbWF0ZT4KPC9wYXRoPgo8L3N2Zz4K";

export default function WavyBackground({ baseColor = '#ffffff', waveHeight = 1500, offsetY = 0, tintColor = '#00ff81' }) {
  const heightValue = typeof waveHeight === 'number' ? `${waveHeight}px` : waveHeight;
  const withAlpha = (hex, a) => {
    // expects #RRGGBB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        // Solid base color for the whole page
        backgroundColor: baseColor,
        // Render the wave only in a top band using a pseudo element
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1200px',
          transform: `translateY(${offsetY}px)`,
          // Paint with gradient and shape it using the SVG as a mask for precise recoloring
          backgroundImage: `linear-gradient(180deg, ${tintColor} 10%, ${withAlpha(tintColor, 0.6)} 30%, ${withAlpha(tintColor, 0)} 50%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: '0 0',

          WebkitMaskImage: `url(${WAVE_SVG_DATA_URL})`,
          maskImage: `url(${WAVE_SVG_DATA_URL})`,
          WebkitMaskRepeat: 'repeat-x',
          maskRepeat: 'repeat-x',
          WebkitMaskSize: `auto ${heightValue}`,
          maskSize: `auto ${heightValue}`,
          WebkitMaskPosition: '0 0',
          maskPosition: '0 0',
          pointerEvents: 'none',
          willChange: 'transform',
          // Responsive height hint (like the CSS you shared)
          '@media (max-width: 961px)': {
            height: '700px',
            WebkitMaskSize: 'auto 700px',
            maskSize: 'auto 700px',
          },
        },
        // Duplicate the wave at the bottom, flipped vertically so it appears upside down
        // '&::after': {
        //   content: '""',
        //   position: 'absolute',
        //   bottom: -280,
        //   left: 0,
        //   right: 0,
        //   height: '400px',
        //   // Mirror the offset for symmetry and flip vertically
        //   transform: `translateY(${offsetY}px) scaleY(-1)`,
        //   backgroundImage: `url(${WAVE_SVG_DATA_URL}), linear-gradient(180deg, ${tintColor} 7%, ${withAlpha(tintColor, 0.6)} 10%, ${withAlpha(tintColor, 0)} 100%)`,
        //   backgroundBlendMode: 'color',
        //   backgroundRepeat: 'repeat-x, no-repeat',
        //   backgroundSize: `auto ${heightValue}, cover`,
        //   backgroundPosition: '0 0, 0 0',
        //   pointerEvents: 'none',
        //   willChange: 'transform',
        //   '@media (max-width: 961px)': {
        //     height: '700px',
        //     backgroundSize: 'auto 700px, cover',
        //   },
        // },
      }}
    />
  );
}
