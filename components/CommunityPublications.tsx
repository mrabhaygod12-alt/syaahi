import { publicGuides } from "@/lib/writing/public";
import CommunityFeed from "./writer/CommunityFeed";
export default async function CommunityPublications() {
  return <CommunityFeed stories={await publicGuides()} />;
}
