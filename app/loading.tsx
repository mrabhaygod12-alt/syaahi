import Loader from "@/components/Loader";

// First-paint skeleton while a route streams in.
export default function Loading() {
  return (
    <div className="wrap" style={{ padding: "48px 1.5rem", maxWidth: 640 }}>
      <Loader done={0} total={1} />
    </div>
  );
}
