const fs = require('fs');
const path = '/Users/andreansescobar/Documents/TurboAI-assestment/components/orders-workspace.tsx';
let content = fs.readFileSync(path, 'utf8');

// Ensure that we capture and replace visibleOrders correctly
const regex = /const visibleOrders = orders\.filter\([\s\S]*?\n  \);/;
if (regex.test(content)) {
  content = content.replace(
      regex,
      "const visibleOrders = orders.filter((order) => matchesFilter(order, activeFilter) && orderMatchesSearch(order, deferredSearch)).sort((a, b) => b.order_id.localeCompare(a.order_id));"
  );
  fs.writeFileSync(path, content);
} else {
  console.log("Regex didn't match! The file might already be sorted or have different syntax.");
}
