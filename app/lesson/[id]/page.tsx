import { redirect } from "next/navigation";

export default async function LessonIndex({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect(`/lesson/${(await params).id}/notes`);
}
