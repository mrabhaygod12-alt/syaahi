import Loader from "@/components/Loader";

export default function LessonLoading() {
  return (
    <div className="ws-loading">
      <Loader done={0} total={1} />
    </div>
  );
}
