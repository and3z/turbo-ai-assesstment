const fs = require('fs');
const path = "/Users/andreansescobar/Documents/TurboAI-assestment/components/orders-workspace.tsx";
try {
  let c = fs.readFileSync(path, 'utf8');
  console.log(c.substr(c.indexOf('const visibleOrders'), 250));
} catch(e) {}
