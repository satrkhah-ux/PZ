import { listPastryBatches, listOffers, type PastryBatch, type Offer } from "@/lib/cafe/pastry-actions";
import { isDemoServer } from "@/lib/cafe/demo";
import { PastriesClient } from "@/components/cafe/PastriesClient";

export const dynamic = "force-dynamic";

export default async function PastriesPage() {
  let batches: PastryBatch[] = [];
  let offers: Offer[] = [];
  try {
    if (!isDemoServer()) [batches, offers] = await Promise.all([listPastryBatches(), listOffers()]);
  } catch {
    // signed-out / demo — empty state
  }
  return <PastriesClient batches={batches} offers={offers} />;
}
