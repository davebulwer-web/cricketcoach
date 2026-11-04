// The 18 first-class counties. Club names are just county names; every player
// in the game is invented (see js/data/names.js and js/career/squads.js).
//
//   name      shown in matches and tables (kept short to fit the screen)
//   fullName  shown on the club pages
//   short     three-letter code for scoreboards
//   colour    team colour, used to tint the player sprites
//   strength  -5..+5, nudges how good the generated squad is
//   div       starting division in the four-day championship (1 or 2)
//   group     regional group in the T20 and 50-over competitions
CC.counties = [
  { id: 'DER', name: 'DERBYSHIRE',  fullName: 'DERBYSHIRE',       short: 'DER', colour: '#3060b0', strength: -3, div: 2, group: 'NORTH' },
  { id: 'DUR', name: 'DURHAM',      fullName: 'DURHAM',           short: 'DUR', colour: '#70309a', strength: 1,  div: 1, group: 'NORTH' },
  { id: 'ESS', name: 'ESSEX',       fullName: 'ESSEX',            short: 'ESS', colour: '#c02828', strength: 3,  div: 1, group: 'SOUTH' },
  { id: 'GLA', name: 'GLAMORGAN',   fullName: 'GLAMORGAN',        short: 'GLA', colour: '#2878c8', strength: -2, div: 2, group: 'SOUTH' },
  { id: 'GLO', name: 'GLOS',        fullName: 'GLOUCESTERSHIRE',  short: 'GLO', colour: '#a0a020', strength: -1, div: 2, group: 'SOUTH' },
  { id: 'HAM', name: 'HAMPSHIRE',   fullName: 'HAMPSHIRE',        short: 'HAM', colour: '#204890', strength: 2,  div: 1, group: 'SOUTH' },
  { id: 'KEN', name: 'KENT',        fullName: 'KENT',             short: 'KEN', colour: '#e03030', strength: 0,  div: 2, group: 'SOUTH' },
  { id: 'LAN', name: 'LANCASHIRE',  fullName: 'LANCASHIRE',       short: 'LAN', colour: '#d84860', strength: 2,  div: 2, group: 'NORTH' },
  { id: 'LEI', name: 'LEICS',       fullName: 'LEICESTERSHIRE',   short: 'LEI', colour: '#20a040', strength: -3, div: 2, group: 'NORTH' },
  { id: 'MID', name: 'MIDDLESEX',   fullName: 'MIDDLESEX',        short: 'MID', colour: '#3050e0', strength: 0,  div: 2, group: 'SOUTH' },
  { id: 'NOR', name: 'NORTHANTS',   fullName: 'NORTHAMPTONSHIRE', short: 'NOR', colour: '#882838', strength: -2, div: 2, group: 'NORTH' },
  { id: 'NOT', name: 'NOTTS',       fullName: 'NOTTINGHAMSHIRE',  short: 'NOT', colour: '#40a0a0', strength: 2,  div: 1, group: 'NORTH' },
  { id: 'SOM', name: 'SOMERSET',    fullName: 'SOMERSET',         short: 'SOM', colour: '#e06020', strength: 3,  div: 1, group: 'SOUTH' },
  { id: 'SUR', name: 'SURREY',      fullName: 'SURREY',           short: 'SUR', colour: '#806040', strength: 5,  div: 1, group: 'SOUTH' },
  { id: 'SUS', name: 'SUSSEX',      fullName: 'SUSSEX',           short: 'SUS', colour: '#40b8e8', strength: 1,  div: 1, group: 'SOUTH' },
  { id: 'WAR', name: 'WARWICKS',    fullName: 'WARWICKSHIRE',     short: 'WAR', colour: '#b02040', strength: 1,  div: 1, group: 'NORTH' },
  { id: 'WOR', name: 'WORCS',       fullName: 'WORCESTERSHIRE',   short: 'WOR', colour: '#40c060', strength: -1, div: 1, group: 'NORTH' },
  { id: 'YOR', name: 'YORKSHIRE',   fullName: 'YORKSHIRE',        short: 'YOR', colour: '#e8c020', strength: 2,  div: 1, group: 'NORTH' },
];
