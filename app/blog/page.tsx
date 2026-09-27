import { pageMeta, jsonLd, SITE } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog-data";

export const metadata = pageMeta({
  title: "Blog & Exam Study Guides",
  description:
    "Expert guides, cognitive study science, and exam preparation strategies for CBSE, ICSE, and University students using AI handwritten notes.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Syaahi Study Blog",
    description:
      "Expert study hacks, memory retention science, and AI handwritten note preparation tips.",
    url: `${SITE.url}/blog`,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
    blogPost: BLOG_POSTS.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      url: `${SITE.url}/blog/${post.slug}`,
      datePublished: post.date,
      author: {
        "@type": "Person",
        name: post.author,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      <main className="wrap" style={{ maxWidth: 1040, padding: "60px 20px 100px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 50px" }}>
          <p className="eyebrow">SYAAHI STUDY INSIGHTS</p>
          <h1 style={{ fontSize: "2.6rem", lineHeight: 1.15, margin: "10px 0 16px" }}>
            Master Your Exams with <br />
            <span style={{ color: "#b45309" }}>Handwritten Notes & AI</span>
          </h1>
          <p className="small" style={{ fontSize: "1.05rem", color: "#4b5563" }}>
            Actionable study strategies, cognitive science insights, and board exam blueprints to help you score higher in less time.
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 28,
            marginBottom: 60,
          }}
        >
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: 24,
                borderRadius: 14,
                border: "1px solid #e5e0d8",
                background: "#ffffff",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #fde68a",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {post.category}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                    {post.readingTime}
                  </span>
                </div>

                <h2 style={{ fontSize: "1.35rem", lineHeight: 1.3, margin: "0 0 10px" }}>
                  <a
                    href={`/blog/${post.slug}`}
                    style={{ color: "#111827", textDecoration: "none" }}
                  >
                    {post.title}
                  </a>
                </h2>

                <p
                  className="small"
                  style={{ color: "#4b5563", margin: "0 0 18px", lineHeight: 1.55 }}
                >
                  {post.excerpt}
                </p>
              </div>

              <div
                style={{
                  borderTop: "1px solid #f3f4f6",
                  paddingTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1f2937" }}>
                    {post.author}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {new Date(post.date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <a
                  href={`/blog/${post.slug}`}
                  className="btn light"
                  style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                >
                  Read Article →
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom CTA Card */}
        <section
          style={{
            background: "linear-gradient(135deg, #1f1f1f 0%, #2b2c34 100%)",
            color: "#ffffff",
            padding: "44px 36px",
            borderRadius: 16,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            border: "1px solid #3f3f46",
          }}
        >
          <span className="eyebrow" style={{ color: "#f0c06a", letterSpacing: "0.08em" }}>
            START LEARNING BETTER TODAY
          </span>
          <h2 style={{ color: "#ffffff", fontSize: "2rem", margin: "8px 0 12px" }}>
            Generate Your First Handwritten Exam Note in 60s
          </h2>
          <p
            className="small"
            style={{ color: "#d1d5db", maxWidth: 580, margin: "0 auto 24px" }}
          >
            Turn complex chapters into clean, legible handwritten PDFs with diagrams and formulas. Claim your 19 free credits now.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/signup"
              className="btn dark"
              style={{
                background: "#f0c06a",
                color: "#1f1f1f",
                borderColor: "#f0c06a",
                padding: "12px 28px",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              Get Started Free (19 Credits)
            </a>
            <a
              href="/examples"
              className="btn light"
              style={{
                background: "transparent",
                color: "#ffffff",
                borderColor: "rgba(255,255,255,0.4)",
                padding: "12px 24px",
              }}
            >
              View Sample Notes
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
