"use client";
import { useState } from "react";
export default function VideoEmbed({ id }: { id: string }) {
  const [play, setPlay] = useState(false);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return (
    <div className="story-video">
      {play ? (
        <iframe
          title="Embedded YouTube video"
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div>
          <span>▶</span>
          <h3>A video in this story</h3>
          <p>Playing loads content from YouTube.</p>
          <button
            type="button"
            className="btn light"
            onClick={() => setPlay(true)}
          >
            Play video
          </button>
          <a
            href={`https://www.youtube.com/watch?v=${id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on YouTube ↗
          </a>
        </div>
      )}
    </div>
  );
}
