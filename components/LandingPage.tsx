import GrowthLanding, { GROWTH_FAQS } from "./growth/GrowthLanding";
export const LANDING_FAQS = GROWTH_FAQS;
export function PaperScene({ writer = false }: { writer?: boolean }) {
  return (
    <div
      className={writer ? "paper-scene writer-scene" : "paper-scene"}
      aria-label="Illustration of learning and writing on Syaahi"
    >
      <div className="scene-orbit" />
      <div className="scene-sphere" />
      <div className="scene-sheet rear-sheet" />
      <div className="scene-sheet front-sheet">
        <span>SYAAHI / {writer ? "YOUR NEXT STORY" : "YOUR NEXT IDEA"}</span>
        <h2>
          {writer ? (
            <>
              Ideas deserve
              <br />a little <em>space.</em>
            </>
          ) : (
            <>
              A little curiosity.
              <br />A lot of <em>possibility.</em>
            </>
          )}
        </h2>
        <div className="scene-lines">
          <i />
          <i />
          <i />
        </div>
        <div className="scene-sheet-bottom">
          <b>✦</b>
          <span>
            {writer ? "DRAFT · YOUR OWN VOICE" : "LEARN · CREATE · PUBLISH"}
          </span>
        </div>
      </div>
      <div className="scene-sticky">
        <span>Remember this.</span>
        <p>
          Great ideas
          <br />
          start with
          <br />
          <em>why.</em>
        </p>
      </div>
      <div className="scene-pill">✦ A place to begin</div>
    </div>
  );
}

export default GrowthLanding;
