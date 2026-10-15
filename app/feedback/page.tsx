import ReviewForm from "@/components/growth/Reviews";
export const metadata = {
  title: "Share your experience | Syaahii",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="wrap feature-section">
      <p className="eyebrow">YOUR EXPERIENCE MATTERS</p>
      <h1>Help us build a better Syaahii.</h1>
      <ReviewForm />
    </main>
  );
}
