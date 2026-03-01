const fs = require('fs');
const path = "/Users/andreansescobar/Documents/TurboAI-assestment/components/orders-workspace.tsx";
let content = fs.readFileSync(path, 'utf8');

// I'm using regex to confidently replace the filtering logic
let changed = false;
content = content.replace(
  /const visibleOrders = orders[\.|\n\s]*filter\([\s\S]*?\n  \);/, 
  match => {
    changed = true;
    return `const visibleOrders = orders
    .filter((order) => matchesFilter(order, activeFilter) && orderMatchesSearch(order, deferredSearch))
    .sort((a, b) => b.order_id.localeCompare(a.order_id));`;
  }
);
if (changed) {
  fs.writeFileSync(path, content);
  console.log('Successfully updated sorting logic!');
} else {
  console.log('Failed to find matching filter code.');
}
