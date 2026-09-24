export default function ForgotClient() {
  return (
    <div
      className="wrap"
      style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 520 }}
    >
      <h1>Account recovery</h1>
      <p>
        Email recovery is not configured for this installation. No reset email
        has been sent.
      </p>
      <p>Contact the installation owner to recover your account.</p>
      <a className="btn light" href="/login">
        Back to log in
      </a>
    </div>
  );
}
