import { notFound } from "next/navigation";
import { BLOG_POSTS, getPostBySlug } from "@/lib/blog-data";
import { pageMeta, jsonLd, SITE } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return pageMeta({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: `${SITE.url}/blog/${post.slug}`,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author,
      jobTitle: post.authorRole,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
  };

  const faqSchema = post.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.answer,
          },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
        />
      )}

      <article className="wrap" style={{ maxWidth: 840, padding: "60px 20px 100px" }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: 20 }}>
          <a href="/blog" className="btn light" style={{ fontSize: "0.85rem", padding: "4px 12px" }}>
            ← All Articles
          </a>
        </div>

        {/* Article Header */}
        <header style={{ marginBottom: 36, borderBottom: "1px solid #e5e0d8", paddingBottom: 28 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <span
              style={{
                background: "#efedfc",
                color: "#6246ea",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 12,
                textTransform: "uppercase",
              }}
            >
              {post.category}
            </span>
            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              {post.readingTime} · Published on{" "}
              {new Date(post.date).toLocaleDateString("en-IN", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <h1 style={{ fontSize: "2.5rem", lineHeight: 1.2, margin: "0 0 16px" }}>
            {post.title}
          </h1>

          <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: "#4b5563", margin: 0 }}>
            {post.excerpt}
          </p>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#6246ea",
                color: "#fff",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
              }}
            >
              {post.author.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{post.author}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{post.authorRole}</div>
            </div>
          </div>
        </header>

        {/* Article Body Content */}
        <div
          style={{
            fontSize: "1.1rem",
            lineHeight: 1.8,
            color: "#2b2c34",
          }}
        >
          {post.content.split("\n\n").map((para, i) => {
            const p = para.trim();
            if (p.startsWith("# ")) {
              return null; // Skip main title as it's already in header
            }
            if (p.startsWith("## ")) {
              return (
                <h2
                  key={i}
                  style={{
                    fontSize: "1.7rem",
                    margin: "40px 0 16px",
                    lineHeight: 1.3,
                    color: "#111827",
                  }}
                >
                  {p.replace("## ", "")}
                </h2>
              );
            }
            if (p.startsWith("---")) {
              return <hr key={i} style={{ margin: "36px 0", border: "none", borderTop: "1px solid #e5e0d8" }} />;
            }
            if (p.startsWith("- ")) {
              const items = p.split("\n").map((item) => item.replace(/^- /, "").trim());
              return (
                <ul key={i} style={{ paddingLeft: 24, margin: "16px 0" }}>
                  {items.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 8 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }
            if (p.match(/^\d+\. /)) {
              const items = p.split("\n").map((item) => item.replace(/^\d+\. /, "").trim());
              return (
                <ol key={i} style={{ paddingLeft: 24, margin: "16px 0" }}>
                  {items.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 8 }}>
                      {item}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <p key={i} style={{ margin: "0 0 20px" }}>
                {p}
              </p>
            );
          })}
        </div>

        {/* FAQs Section */}
        {post.faqs && post.faqs.length > 0 && (
          <section
            style={{
              margin: "50px 0",
              padding: 28,
              background: "#f9f8f6",
              borderRadius: 14,
              border: "1px solid #e5e0d8",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "1.3rem" }}>
              Frequently Asked Questions
            </h3>
            <div style={{ display: "grid", gap: 16 }}>
              {post.faqs.map((faq, idx) => (
                <div key={idx} style={{ background: "#fff", padding: 18, borderRadius: 10, border: "1px solid #e5e0d8" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: "#111827", marginBottom: 6 }}>
                    Q: {faq.question}
                  </div>
                  <div style={{ color: "#4b5563", fontSize: "0.95rem", lineHeight: 1.6 }}>
                    {faq.answer}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Author Footer Bio */}
        <div
          style={{
            borderTop: "1px solid #e5e0d8",
            paddingTop: 24,
            marginBottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#6246ea",
              color: "#fff",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              flexShrink: 0,
            }}
          >
            {post.author.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{post.author}</div>
            <p className="small" style={{ margin: 0, color: "#4b5563" }}>
              {post.authorRole}. Passionate about building intelligent, human-centered study tools for students in India and across the globe.
            </p>
          </div>
        </div>

        {/* Bottom CTA Box */}
        <section
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            color: "#ffffff",
            padding: "36px 30px",
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#fff", fontSize: "1.7rem", margin: "0 0 10px" }}>
            Ready to study with high-retention handwritten notes?
          </h2>
          <p className="small" style={{ color: "#e0e7ff", maxWidth: 500, margin: "0 auto 20px" }}>
            Generate structured handwritten PDFs from any topic or lecture. Get 21 free credits on registration.
          </p>
          <a
            href="/signup"
            className="btn dark"
            style={{
              background: "#6246ea",
              borderColor: "#6246ea",
              padding: "10px 24px",
              fontSize: "0.95rem",
            }}
          >
            Create Your Free Account →
          </a>
        </section>
      </article>
    </>
  );
}
