"use client";
import { useEffect, useRef, useState } from "react";
import { Star, BadgeCheck, MessageSquare } from "lucide-react";
import { requestJson } from "@/lib/http-client";
import { useAccount } from "@/components/WorkspaceProvider";
import "./reviews.css";
export function ReviewWidget() {
  const [reviews, setReviews] = useState<any[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    requestJson("/api/reviews", { signal: controller.signal }, 15000)
      .then(({ response, data }) => {
        if (!response.ok || !Array.isArray(data.reviews))
          throw new Error("Reviews are temporarily unavailable.");
        setReviews(data.reviews);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Reviews are temporarily unavailable.");
      });
    return () => controller.abort();
  }, []);
  return (
    <section
      className="growth-wrap review-section"
      aria-labelledby="reviews-heading"
    >
      <p className="growth-eyebrow">FROM PEOPLE WHO HAVE USED SYAAHII</p>
      <div className="review-heading">
        <h2 id="reviews-heading">
          Real experience.
          <br />
          <em>Useful feedback.</em>
        </h2>
        <a href="/feedback">Share your experience →</a>
      </div>
      {!loaded && !error && <p role="status">Loading reviewed feedback…</p>}
      {error && <p role="status">{error}</p>}
      {loaded && !reviews.length && (
        <div className="review-empty">
          <MessageSquare aria-hidden="true" />
          <div>
            <h3>Help shape your study space.</h3>
            <p>
              Complete a lesson or publish a story, then share an honest review.
              Approved feedback will appear here.
            </p>
          </div>
        </div>
      )}
      <div className="review-grid">
        {reviews.map((review) => (
          <article key={review.id}>
            <div
              className="review-stars"
              aria-label={`${review.stars} out of 5 stars`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={17}
                  fill={i < review.stars ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              ))}
            </div>
            <blockquote>{review.text}</blockquote>
            <strong>{review.displayName}</strong>
            <span className="review-verified">
              <BadgeCheck size={16} aria-hidden="true" />
              Verified user · reviewed feedback
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
export default function ReviewForm() {
  const { user, loading } = useAccount();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [stars, setStars] = useState(5),
    [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [website, setWebsite] = useState("");
  const [state, setState] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setState(null);
    setBusy(false);
    setMessage("");
    setText("");
    setConsent(false);
    if (!user) return;
    const controller = new AbortController();
    requestJson("/api/reviews?mine=1", { signal: controller.signal })
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setState({ ...data, owner: user.id });
        if (data.review) {
          setStars(data.review.stars);
          setText(data.review.text);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      });
    return () => controller.abort();
  }, [user?.id]);
  if (loading) return <p role="status">Checking your account…</p>;
  if (!user)
    return (
      <p>
        <a href="/login?next=%2Ffeedback">Sign in</a> to share your experience.
      </p>
    );
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const submittingOwner = user.id;
        setBusy(true);
        setMessage("");
        try {
          const { response, data } = await requestJson("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stars,
              text,
              consent,
              website,
              revision: state?.review?.revision,
            }),
          });
          if (owner.current !== submittingOwner) return;
          if (!response.ok) throw new Error(data.error);
          setState({ ...state, review: { ...data, stars, text } });
          setConsent(false);
          setMessage(
            "Thank you. Your feedback is saved for editorial review. It becomes public only after approval.",
          );
        } catch (e) {
          if (owner.current !== submittingOwner) return;
          setMessage(
            e instanceof Error ? e.message : "Could not save your review.",
          );
        } finally {
          if (owner.current === submittingOwner) setBusy(false);
        }
      }}
    >
      <p>
        Honest feedback from verified accounts that have completed a lesson or
        published a story. Your account name and review become public only with
        your consent and editorial approval.
      </p>
      {state?.review && (
        <p>
          Your review: {state.review.status}. Editing sends it back for review.
        </p>
      )}
      {state && !state.eligible && (
        <p role="status">
          Complete a lesson or publish a story before submitting.
        </p>
      )}
      <fieldset disabled={busy || !state?.eligible}>
        <legend>Your rating</legend>
        <div className="review-rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name="stars"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
              />
              <Star
                size={24}
                fill={n <= stars ? "currentColor" : "none"}
                aria-hidden="true"
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Your experience
        <textarea
          required
          minLength={40}
          maxLength={800}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What helped you, and what should we improve?"
        />
      </label>
      <small>{text.length}/800 characters</small>
      <label className="review-honeypot" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>
      <label className="review-consent">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I agree to display my account name, rating and feedback publicly after
        review.
      </label>
      <button
        className="btn dark"
        disabled={busy || !state?.eligible || !consent}
      >
        {busy ? "Saving…" : "Submit for review"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
