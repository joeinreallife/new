import { useEffect, useRef, useState } from "react";

export function PlantRibbon({ filteredPlants, selectedPlant, setSelectedPlantId, PlantTile }) {
  const plantStripRef = useRef(null);
  const [plantStripMetrics, setPlantStripMetrics] = useState({
    scrollLeft: 0,
    maxScrollLeft: 0,
  });

  function syncPlantStripMetrics() {
    const strip = plantStripRef.current;
    if (!strip) return;

    setPlantStripMetrics({
      scrollLeft: strip.scrollLeft,
      maxScrollLeft: Math.max(0, strip.scrollWidth - strip.clientWidth),
    });
  }

  function scrollPlantStripBy(direction) {
    const strip = plantStripRef.current;
    if (!strip) return;

    const travel = Math.max(220, Math.round(strip.clientWidth * 0.72));
    strip.scrollBy({
      left: direction * travel,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    syncPlantStripMetrics();
  }, [filteredPlants.length]);

  useEffect(() => {
    const strip = plantStripRef.current;
    if (!strip) return undefined;

    const handleScroll = () => syncPlantStripMetrics();
    const handleResize = () => syncPlantStripMetrics();

    strip.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      strip.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [filteredPlants.length]);

  const canScrollPlantPrev = plantStripMetrics.scrollLeft > 0;
  const canScrollPlantNext = plantStripMetrics.scrollLeft < plantStripMetrics.maxScrollLeft - 1;

  return (
    <div className="plant-strip-panel shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            shown plants {filteredPlants.length}
          </div>
          {selectedPlant && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              selected plt {selectedPlant.id}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => scrollPlantStripBy(-1)}
            disabled={!canScrollPlantPrev}
            className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] ${
              canScrollPlantPrev
                ? "border-slate-200 bg-white text-slate-600"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            prev
          </button>

          <button
            onClick={() => scrollPlantStripBy(1)}
            disabled={!canScrollPlantNext}
            className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] ${
              canScrollPlantNext
                ? "border-slate-200 bg-white text-slate-600"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            next
          </button>

          <input
            type="range"
            min="0"
            max={Math.max(1, plantStripMetrics.maxScrollLeft)}
            value={Math.min(
              plantStripMetrics.scrollLeft,
              Math.max(1, plantStripMetrics.maxScrollLeft),
            )}
            onChange={(event) => {
              const strip = plantStripRef.current;
              if (!strip) return;
              strip.scrollLeft = Number(event.target.value);
              syncPlantStripMetrics();
            }}
            className="h-2 w-40 accent-slate-200"
          />
        </div>
      </div>

      <div ref={plantStripRef} className="overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex min-w-max snap-x snap-mandatory items-start gap-3 pr-3">
          {filteredPlants.map((plant) => (
            <PlantTile
              key={plant.id}
              plant={plant}
              selected={selectedPlant?.id === plant.id}
              onClick={() =>
                setSelectedPlantId((current) => (current === plant.id ? null : plant.id))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
