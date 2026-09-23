export default function Testimonial() {
  return (
    <section className="testimonial" aria-labelledby="testimonial-heading">
      <h2 id="testimonial-heading" className="visually-hidden">
        Customer testimonial
      </h2>
      <blockquote
        className="testimonial__quote"
        style={{ maxWidth: "36rem", margin: "0 auto" }}
      >
        <p>
          &ldquo;Everything feels considered without trying too hard. The linen
          shirt has become the piece I reach for first on cool mornings.&rdquo;
        </p>
        <footer className="testimonial__author">— Maya R., Portland</footer>
      </blockquote>
    </section>
  );
}
