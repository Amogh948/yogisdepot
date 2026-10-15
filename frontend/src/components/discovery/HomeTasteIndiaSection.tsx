import { Link } from "react-router-dom";
import { SectionHeader } from "../ui/Feedback";
import { TasteIndiaMap } from "./TasteIndiaMap";

export function HomeTasteIndiaSection() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Taste India"
        subtitle="Explore regional kitchens across the map"
        action={
          <Link to="/discover/regions" className="text-sm font-semibold text-yd-green">
            View all
          </Link>
        }
      />
      <TasteIndiaMap compact />
    </section>
  );
}
