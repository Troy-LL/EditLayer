import { products } from "../data/products.js";
import ProductCard from "./ProductCard.jsx";

export default function ProductGrid({ onAddToCart }) {
  return (
    <section id="shop" className="products" aria-labelledby="products-heading">
      <div className="section-header">
        <h2 id="products-heading" className="section-header__title">
          The collection
        </h2>
        <p className="section-header__subtitle">
          Six staples we return to season after season.
        </p>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.id} {...p} onAddToCart={onAddToCart} />
        ))}
      </div>
    </section>
  );
}
