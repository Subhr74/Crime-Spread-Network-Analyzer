window.addEventListener('load', function() {
  resizeCanvas();
  setMode('add');
  loadSample();
  startAutoSimulation();
});

function startAutoSimulation() {
  setInterval(function() {
    if (nodes.length > 0) addRandomCrime();
  }, 12000);
}

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  switch (e.key) {
    case '1': setMode('add');    break;
    case '2': setMode('edge');   break;
    case '3': setMode('select'); break;
    case '4': setMode('delete'); break;
    case 'b': runBFS();      break;
    case 'd': runDFS();      break;
    case 'j': runDijkstra(); break;
    case 'r': runBridges();  break;
    case 's': runSCC();      break;
    case 'p': runPageRank(); break;
    case 'm': runMST();      break;
    case 'Escape': clearViz(); selectedNode = null; draw(); break;
  }
});