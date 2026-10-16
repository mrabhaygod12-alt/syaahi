export default function NotFound() {
  return (
    <section className="app-state">
      <p className="eyebrow">A DIFFERENT PAGE, PERHAPS</p>
      <h1>We could not find this page.</h1>
      <p>
        The link may have changed. Start from your workspace or explore the
        public examples.
      </p>
      <div>
        <a className="btn dark" href="/dashboard">
          Open workspace
        </a>
        <a className="btn light" href="/examples">
          See examples
        </a>
        <a className="btn light" href="/support">
          Get help
        </a>
      </div>
    </section>
  );
}
