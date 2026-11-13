export default function Nav({ cartCount, onCartClick }) {
  return (
    <header className="site-header">
      <nav className="nav" aria-label="Main">
        <a href="/" className="nav__brand">Fieldnote</a>
        <ul className="nav__links">
          <li>
            <a href="#shop">Shop</a>
          </li>
          <li>
            <a href="#about">About</a>
          </li>
          <li>
            <a href="#journal">Journal</a>
          </li>
        </ul>
        <button
          type="button"
          className="nav__cart"
          onClick={onCartClick}
          aria-label={`Cart, ${cartCount} items`}
        >
          Cart
          <span className="nav__cart-count" aria-hidden="true">
            {cartCount}
          </span>
        </button>
      </nav>
    </header>
  );
}
