export default function ProductCard({ name, price, tagline, swatch, onAddToCart }) {
  const imageStyle = {
    background: `linear-gradient(145deg, ${swatch} 0%, color-mix(in srgb, ${swatch} 70%, #1f2421) 100%)`,
  };

  return (
    <article className="product-card">
      <div
        className="product-card__image"
        style={imageStyle}
        role="img"
        aria-label={`${name} color swatch`}
      />
      <div className="product-card__body">
        <h3 className="product-card__name">{name}</h3>
        <p className="product-card__price">${price}</p>
        <p className="product-card__tagline">{tagline}</p>
        <button
          type="button"
          className="btn btn--secondary product-card__add"
          onClick={onAddToCart}
        >
          Add to cart
        </button>
      </div>
    </article>
  );
}
