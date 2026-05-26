import type { CSSProperties } from 'react';

export type FruitKind =
  | 'grape'
  | 'strawberry'
  | 'orange'
  | 'blueberry'
  | 'cherry'
  | 'peach'
  | 'apple'
  | 'watermelon';

interface PixelFruitProps {
  kind: FruitKind;
  size?: number;
  className?: string;
}

const PALETTES: Record<FruitKind, Record<string, string>> = {
  grape: {
    S: '#4A1E66',
    P: '#8A4FB8',
    p: '#C9A2E5',
    L: '#6BBE7E',
    D: '#3F7D4D',
    B: '#7B5635',
  },
  strawberry: {
    R: '#E03737',
    h: '#FF6B6B',
    y: '#FFD93D',
    L: '#6BBE7E',
    D: '#3F7D4D',
  },
  orange: {
    O: '#F58A2E',
    h: '#FFC07A',
    s: '#C9651A',
    L: '#6BBE7E',
    D: '#3F7D4D',
  },
  blueberry: {
    B: '#2C3F7A',
    h: '#6383C8',
    b: '#1E2C56',
  },
  cherry: {
    R: '#D63333',
    h: '#FF6F6F',
    B: '#7B5635',
    L: '#6BBE7E',
    D: '#3F7D4D',
  },
  peach: {
    P: '#FFB58A',
    h: '#FFD9C2',
    s: '#E08055',
    L: '#6BBE7E',
    D: '#3F7D4D',
  },
  apple: {
    R: '#D63333',
    h: '#FF6F6F',
    s: '#A52424',
    B: '#7B5635',
    L: '#6BBE7E',
  },
  watermelon: {
    G: '#2E7A3F',
    g: '#4A9A55',
    M: '#FFFFFF',
    R: '#FF5757',
    h: '#FF8A8A',
    b: '#2A2434',
  },
};

const ART: Record<FruitKind, string[]> = {
  grape: [
    '................',
    '......LL........',
    '.....LLL.B......',
    '....LLDL.B......',
    '.....LL.BB......',
    '........BB......',
    '....SSSSSS......',
    '...SPPpPPS......',
    '..SPpPPpPPS.....',
    '..SPpPpPpPS.....',
    '...SPpPpPPS.....',
    '....SPpPPS......',
    '.....SPpS.......',
    '......SPS.......',
    '.......S........',
    '................',
  ],
  strawberry: [
    '................',
    '......LL........',
    '.....LLLL.......',
    '....LDLLLL......',
    '....LLLLLL......',
    '...RRRRRRRR.....',
    '..RyRRRRRyRR....',
    '..RRRyRRyRRR....',
    '..RRRRyRRRRR....',
    '...RyRRRRRyR....',
    '...RRyRRyRRR....',
    '....RRRyRRR.....',
    '.....RRyRRR.....',
    '.....RRRRR......',
    '......RRR.......',
    '.......R........',
  ],
  orange: [
    '................',
    '......L.........',
    '.....LLL........',
    '....LDLLL.......',
    '......hh........',
    '....OOOOOO......',
    '...OOhOOOOO.....',
    '..OOhOhOOOOO....',
    '..OOhOOOOOsO....',
    '..OOOOOOOOsO....',
    '..OOOOOOOOss....',
    '...OOOOOOss.....',
    '....OOOOss......',
    '.....OOOs.......',
    '................',
    '................',
  ],
  blueberry: [
    '................',
    '................',
    '....b.bb.b......',
    '...bBBBBBBb.....',
    '..bBBBhBBBBb....',
    '..BBBhBhBBBB....',
    '.BBhBhBBBBBBB...',
    '.BBBBBBBBBBBB...',
    '.BBBBBBBBBBBB...',
    '.BBBBBBBBBBbb...',
    '..BBBBBBBBbb....',
    '...BBBBBBbb.....',
    '....BBBBbb......',
    '.....BBbb.......',
    '................',
    '................',
  ],
  cherry: [
    '................',
    '........BB......',
    '.......BB.......',
    '......BB........',
    '......B.B.......',
    '.....B..BB......',
    '....LLL..B......',
    '...LDLLL.B......',
    '....LLL.BB......',
    '....RRRRRRR.....',
    '...RhRRRRRRR....',
    '..RhRRRRhRRRR...',
    '..RRRRRRRRRRR...',
    '...RRRRRRRRR....',
    '....RRRRRRR.....',
    '.....RRRRR......',
  ],
  peach: [
    '................',
    '......LL........',
    '.....LDLL.......',
    '....LLLLL.......',
    '.....PPSP.......',
    '....PPPPPPP.....',
    '...PhhPPPPPP....',
    '..PhhPPPPPPPs...',
    '..PPhPPPPPPPs...',
    '..PPPPPPPPPPs...',
    '..PPPPPPPPPss...',
    '...PPPPPPPss....',
    '....PPPPPss.....',
    '.....PPPss......',
    '......PPs.......',
    '................',
  ],
  apple: [
    '................',
    '.......B........',
    '......BB........',
    '.....BBLL.......',
    '....BB.LLL......',
    '....RRRRRRR.....',
    '...RhRRRRRRR....',
    '..RhRRRRRRRRR...',
    '..RhRRRRRRRRsR..',
    '..RRRRRRRRRRsR..',
    '..RRRRRRRRRRsR..',
    '..RRRRRRRRRRsR..',
    '...RRRRRRRRRs...',
    '....RRRRRRRR....',
    '.....RRRRRR.....',
    '......RRR.......',
  ],
  watermelon: [
    '................',
    '................',
    '................',
    '....GGGGGGGG....',
    '...gGGGGGGGGg...',
    '..gMMMMMMMMMMg..',
    '.gMMMMMMMMMMMMg.',
    '.MRRRRRRRRRRRRM.',
    '.MRRRbRRRRbRRRM.',
    '.MRRRRRRRRRRRRM.',
    '.MRbRRRRbRRRbRM.',
    '..MRRRRRRRRRRM..',
    '..MMRRRRRRRRMM..',
    '....MMMMMMMM....',
    '......MMMM......',
    '................',
  ],
};

export default function PixelFruit({ kind, size = 40, className = '' }: PixelFruitProps) {
  const grid = ART[kind];
  const palette = PALETTES[kind];
  const cols = grid[0].length;
  const rows = grid.length;

  const style: CSSProperties = {
    imageRendering: 'pixelated',
  };

  const rects: JSX.Element[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const color = palette[ch];
      if (color) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="1.02"
            height="1.02"
            fill={color}
          />,
        );
      }
    }
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      shapeRendering="crispEdges"
      style={style}
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}
