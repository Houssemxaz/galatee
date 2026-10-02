import { TrendingDown, TrendingUp } from "lucide-react";

function ProductList({ title, items, Icon }) {
  const maxQuantity = Math.max(...(items || []).map((item) => Number(item.quantity) || 0), 1);
  return <section className="bo-product-performance"><div className="bo-stat-block-heading"><div><p className="bo-eyebrow">Ventes confirmées</p><h3>{title}</h3></div><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>{!items?.length ? <p className="bo-empty">Aucune vente confirmée sur cette période.</p> : <div className="bo-product-list">{items.map((item) => <div className="bo-product-row" key={`${item.productType}-${item.productId}`}><div className="bo-product-main"><span>{item.title}</span><div className="bo-product-bar" aria-hidden="true"><i style={{ width: `${Math.max(4, (Number(item.quantity) / maxQuantity) * 100)}%` }} /></div></div><strong>{item.quantity} vente{item.quantity > 1 ? "s" : ""}</strong><small>{item.revenue} DA</small></div>)}</div>}</section>;
}

export default function ProductPerformance({ products }) {
  return <div className="bo-product-performance-grid"><ProductList title="Les plus vendus" items={products?.bestSelling} Icon={TrendingUp} /><ProductList title="Les moins vendus" items={products?.leastSelling} Icon={TrendingDown} /></div>;
}
