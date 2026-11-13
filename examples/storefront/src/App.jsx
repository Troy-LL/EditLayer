import { useCallback, useState } from "react";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import Testimonial from "./components/Testimonial.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  const [cartCount, setCartCount] = useState(0);

  const addToCart = useCallback(() => {
    setCartCount((n) => n + 1);
  }, []);

  const handleCartClick = useCallback(() => {
    /* placeholder — cart drawer not implemented in this stand-in */
  }, []);

  return (
    <div className="app">
      <Nav cartCount={cartCount} onCartClick={handleCartClick} />
      <main>
        <Hero />
        <ProductGrid onAddToCart={addToCart} />
        <Testimonial />
      </main>
      <Footer />
    </div>
  );
}
