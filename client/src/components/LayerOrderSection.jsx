import LayerOrderControls from "./LayerOrderControls.jsx";

export default function LayerOrderSection({ onOrder, disabled }) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-header inspector-section-header-static">
        <span className="inspector-section-title">Layer order</span>
      </div>
      <div className="inspector-section-body">
        <p className="inspector-hint">Among siblings at the same level. Top of the layers list = in front.</p>
        <LayerOrderControls onOrder={onOrder} disabled={disabled} />
      </div>
    </section>
  );
}
