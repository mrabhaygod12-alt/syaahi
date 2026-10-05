"use client";
import { useState } from "react";
import type { PublicGuide } from "@/lib/writing/public";
import { useAccount } from "../WorkspaceProvider";
import { StoryRow } from "../WriterDashboard";
import FollowWriter from "./FollowWriter";
type Profile = {
  slug: string;
  name: string;
  bio?: string;
  about?: string;
  avatar?: string;
  pronouns?: string[];
  website?: string;
  joinedAt?: string;
  accent?: string;
};
export default function CreatorProfile({
  profile,
  stories,
}: {
  profile: Profile;
  stories: PublicGuide[];
}) {
  const [tab, setTab] = useState("stories"),
    [message, setMessage] = useState("");
  const { user } = useAccount();
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setMessage("Profile link copied.");
    } catch {
      setMessage("Copy the address from your browser to share this profile.");
    }
  };
  return (
    <div className="creator-public-page">
      <div className={`creator-cover accent-${profile.accent || "forest"}`}>
        <span>SYAAHI / WRITER PROFILE</span>
        <div aria-hidden="true">✦</div>
      </div>
      <div className="creator-public-wrap">
        <header className="creator-public-identity">
          <div className="creator-public-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} />
            ) : (
              <span>{profile.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <p className="writer-kicker">A VOICE ON SYAAHI</p>
            <h1>{profile.name}</h1>
            <p className="creator-pronouns">{profile.pronouns?.join(" · ")}</p>
            <p className="creator-bio">
              {profile.bio || "Stories, ideas and a perspective of their own."}
            </p>
            <div className="creator-public-meta">
              <span>
                {stories.length} published{" "}
                {stories.length === 1 ? "story" : "stories"}
                {stories.length === 100 ? " in this view" : ""}
              </span>
              {profile.joinedAt && (
                <span>
                  Joined{" "}
                  {new Date(profile.joinedAt).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Website ↗
                </a>
              )}
            </div>
            <FollowWriter slug={profile.slug} />
          </div>
          <button className="btn light" onClick={share}>
            Share profile ↗
          </button>
        </header>
        {message && <p role="status">{message}</p>}
        <div className="creator-public-layout">
          <section>
            <div
              className="writer-tabs"
              role="tablist"
              aria-label="Public profile sections"
            >
              <button
                role="tab"
                aria-selected={tab === "stories"}
                onClick={() => setTab("stories")}
              >
                Stories <small>{stories.length}</small>
              </button>
              <button
                role="tab"
                aria-selected={tab === "about"}
                onClick={() => setTab("about")}
              >
                About
              </button>
            </div>
            {tab === "about" ? (
              <div className="creator-about-card">
                <p className="writer-kicker">THE PERSON BEHIND THE WORDS</p>
                <h2>About {profile.name}</h2>
                <p>
                  {profile.about ||
                    profile.bio ||
                    "This writer hasn't added an About page yet."}
                </p>
              </div>
            ) : stories.length ? (
              stories.map((s) => <StoryRow key={s.slug} story={s} publicFeed />)
            ) : (
              <div className="writer-empty">
                <span>✎</span>
                <h2>The next chapter is on its way.</h2>
                <p>Published stories will appear here.</p>
                <a className="btn light" href="/community">
                  Discover other stories
                </a>
              </div>
            )}
          </section>
          <aside className="creator-public-sidebar">
            <p className="writer-kicker">GOOD IDEAS FIND A HOME</p>
            <h3>
              Read a little.
              <br />
              <em>Think a little more.</em>
            </h3>
            <p>
              Discover reviewed writing from curious people. Keep the stories
              that matter to you.
            </p>
            <a href="/community">Explore stories →</a>
            <hr />
            <h3>Have something to say?</h3>
            <p>Build a profile and give your own ideas a page.</p>
            <a
              href={
                user?.workspace === "writer" ? "/writer/welcome" : "/writing"
              }
            >
              {user?.workspace === "writer"
                ? "Your writing space"
                : "Explore writing"}{" "}
              ↗
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
