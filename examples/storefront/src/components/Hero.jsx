export default function Hero() {
  return (
    <section
      className="hero"
      style={{ paddingTop: "4.5rem", paddingBottom: "4.5rem" }}
      aria-labelledby="hero-heading"
    >
      <p className="hero__eyebrow">New season</p>
      <h1 id="hero-heading" className="hero__title">
        Quiet goods for everyday life
      </h1>
      <p className="hero__lead">
        Thoughtfully made clothing and objects with honest materials and
        restrained form. Built to last, designed to fade into your routine.
      </p>
      <div className="hero__actions">
        <a href="#shop" className="btn btn--primary">
          Shop the collection
        </a>
        <a href="#about" className="btn btn--ghost">
          Our story
        </a>
      </div>
    </section>
  );
}
