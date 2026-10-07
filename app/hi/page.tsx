import GrowthLanding from "@/components/growth/GrowthLanding";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({
  title: "विश्वविद्यालय नोट्स और AI प्रेज़ेंटेशन",
  description:
    "UG और PG के छात्रों के लिए हिंदी में नोट प्रीव्यू। CSE, IT, BCA/MCA, DBMS और ऑपरेटिंग सिस्टम के विषयों से शुरू करें।",
  path: "/hi",
});
export default function HindiHome() {
  return (
    <div lang="hi">
      <GrowthLanding language="hindi" />
    </div>
  );
}
