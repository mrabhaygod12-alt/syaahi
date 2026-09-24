import { redirect } from "next/navigation";

// The standalone studio moved into the dashboard creator.
// Old links land here and continue seamlessly.
export default function GenerateRedirect() {
  redirect("/dashboard");
}
