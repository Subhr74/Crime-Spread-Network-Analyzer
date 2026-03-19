const nodes = [];
const edges = [];

let mode         = 'add';
let selectedNode = null;
let edgeSrc      = null;

let animNodes      = new Set();
let highlightEdges = new Set();
let bridgeEdges    = new Set();
let sccColors      = {};
let dijkstraPath   = [];
let mstEdges       = new Set();
let prSizes        = {};

const crimeTimeline = [];

const TYPE_COLOR = {
  hotspot:  '#e84040',
  suspect:  '#f59e0b',
  junction: '#3b82f6',
  safe:     '#00c9a7',
  hideout:  '#a855f7',
};
const TYPE_RING = {
  hotspot:  '#ff7070',
  suspect:  '#fcd34d',
  junction: '#93c5fd',
  safe:     '#6ee7b7',
  hideout:  '#c084fc',
};
const EDGE_COLOR = {
  supply:    '#ff6b35',
  comm:      '#3b82f6',
  movement:  '#f59e0b',
  financial: '#a855f7',
};
const SCC_PALETTE = [
  '#e84040','#00c9a7','#f59e0b','#3b82f6',
  '#a855f7','#06b6d4','#ec4899','#84cc16',
  '#ff6b35','#14b8a6'
];

const SAMPLE_DATA = {
  nodes: [
    { name: 'Market Sq',   type: 'hotspot',  severity: 3, officer: 'Insp. Sharma' },
    { name: 'E. Harbor',   type: 'hotspot',  severity: 3, officer: 'SI Mehta' },
    { name: 'South Docks', type: 'suspect',  severity: 2, officer: 'SI Rao' },
    { name: 'City Park',   type: 'safe',     severity: 1, officer: 'Const. Das' },
    { name: 'West End',    type: 'suspect',  severity: 2, officer: 'SI Patel' },
    { name: 'North Gate',  type: 'junction', severity: 2, officer: 'Insp. Khan' },
    { name: 'City Core',   type: 'hotspot',  severity: 3, officer: 'DCP Roy' },
    { name: 'E. Market',   type: 'junction', severity: 1, officer: 'SI Joshi' },
    { name: 'W. Market',   type: 'junction', severity: 2, officer: 'SI Verma' },
    { name: 'Old Quarter', type: 'hideout',  severity: 3, officer: 'Insp. Nair' },
    { name: 'Rail Yard',   type: 'suspect',  severity: 2, officer: 'SI Singh' },
    { name: 'Airport Rd',  type: 'junction', severity: 1, officer: 'SI Iyer' },
  ],
  edges: [
    [0,6,3,'supply'],  [1,6,4,'comm'],    [1,7,2,'movement'],
    [2,7,6,'supply'],  [2,3,3,'movement'],[3,8,2,'comm'],
    [4,8,5,'financial'],[4,5,4,'movement'],[5,0,3,'supply'],
    [6,7,2,'comm'],    [6,8,1,'supply'],  [7,2,5,'financial'],
    [8,4,3,'movement'],[0,1,7,'comm'],    [5,6,2,'supply'],
    [9,6,4,'supply'],  [9,4,3,'financial'],[10,9,5,'movement'],
    [10,7,3,'comm'],   [11,1,2,'movement'],[11,7,4,'supply'],
  ]
};