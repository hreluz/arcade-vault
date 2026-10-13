// Shared placeholder for a leaderboard with no rows to show.
// `null` scores mean the read failed; an empty array means nobody has played yet.
export default function BoardMessage({ unavailable }: { unavailable: boolean }) {
  return unavailable ? (
    <div className="board-msg unavailable" role="status">
      <span className="board-msg-title">SCORES UNAVAILABLE</span>
      <span className="board-msg-sub">The scoreboard is offline. Try again later.</span>
    </div>
  ) : (
    <div className="board-msg" role="status">
      <span className="board-msg-title">
        NO SCORES YET — BE THE FIRST<span className="blink">_</span>
      </span>
    </div>
  );
}
