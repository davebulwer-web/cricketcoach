// Two invented teams for the proof of concept.
// Ratings are 1-99. `role` is BAT, BOWL, ALL (all-rounder) or WK (wicket-keeper).
// `bowl` style: PACE, MED or SPIN (null for non-bowlers).
CC.teams = [
  {
    name: 'ASHBY VALE',
    short: 'ASH',
    colour: '#d02020',
    players: [
      { name: 'T. Harker',   role: 'BAT',  bat: 78, bowl: 10, style: null },
      { name: 'R. Pellow',   role: 'BAT',  bat: 74, bowl: 12, style: null },
      { name: 'D. Ormsby',   role: 'BAT',  bat: 81, bowl: 20, style: 'MED' },
      { name: 'S. Whitlock', role: 'BAT',  bat: 70, bowl: 15, style: null },
      { name: 'J. Fenwick',  role: 'ALL',  bat: 62, bowl: 60, style: 'MED' },
      { name: 'M. Cragg',    role: 'WK',   bat: 55, bowl: 5,  style: null },
      { name: 'P. Dunmore',  role: 'ALL',  bat: 50, bowl: 64, style: 'SPIN' },
      { name: 'L. Rudd',     role: 'BOWL', bat: 32, bowl: 72, style: 'PACE' },
      { name: 'G. Tansley',  role: 'BOWL', bat: 25, bowl: 70, style: 'SPIN' },
      { name: 'K. Brayford', role: 'BOWL', bat: 20, bowl: 76, style: 'PACE' },
      { name: 'A. Quill',    role: 'BOWL', bat: 15, bowl: 74, style: 'PACE' },
    ],
  },
  {
    name: 'KINGSMOOR',
    short: 'KGM',
    colour: '#2040c0',
    players: [
      { name: 'B. Lowther',  role: 'BAT',  bat: 76, bowl: 8,  style: null },
      { name: 'C. Ainsley',  role: 'BAT',  bat: 72, bowl: 18, style: 'MED' },
      { name: 'N. Grisdale', role: 'BAT',  bat: 83, bowl: 10, style: null },
      { name: 'H. Merriott', role: 'ALL',  bat: 66, bowl: 58, style: 'MED' },
      { name: 'F. Sowerby',  role: 'BAT',  bat: 68, bowl: 22, style: 'SPIN' },
      { name: 'E. Tolley',   role: 'WK',   bat: 52, bowl: 5,  style: null },
      { name: 'W. Ashdown',  role: 'ALL',  bat: 54, bowl: 62, style: 'PACE' },
      { name: 'O. Kettle',   role: 'BOWL', bat: 30, bowl: 70, style: 'SPIN' },
      { name: 'V. Pryor',    role: 'BOWL', bat: 28, bowl: 73, style: 'PACE' },
      { name: 'I. Bastow',   role: 'BOWL', bat: 18, bowl: 75, style: 'PACE' },
      { name: 'U. Halsall',  role: 'BOWL', bat: 12, bowl: 71, style: 'MED' },
    ],
  },
];
