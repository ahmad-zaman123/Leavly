export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="skel-row">
        <div className="skel" style={{ width: "30%", height: 22 }} />
      </div>
      <div className="topgrid">
        <div className="skel" style={{ height: 300 }} />
        <div className="skel" style={{ height: 300 }} />
      </div>
      <div className="skel" style={{ height: 380 }} />
    </main>
  );
}
