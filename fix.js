const fs = require('fs');
const path = "/Users/andreansescobar/Documents/TurboAI-assestment/components/orders-workspace.tsx";
let c = fs.readFileSync(path, 'utf8');
const searchStr = `  const visibleOrders = orders.filter(
    (order) => matchesFilter(order, activeFilter) && orderMatchesSearch(order, deferredSearch),
  );`;
if (c.includes(searchStr)) {
  c = c.replace(searchStr, `  const visibleOrders = orders
    .filter((order) => matchesFilter(order, activeFilter) && orderMatchesSearch(order, deferredSearch))
    .sort((a, b) => b.order_id.localeCompare(a.order_id));`);
  fs.writeFileSync(path, c);
  console.log("Replaced using exact multiline string match.");
} else {
  console.log("Could not find the exact string.");
}
