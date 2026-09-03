import { QueueScreen } from "@/components/cafe/QueueScreen";

export const dynamic = "force-dynamic";

export default async function TvPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <QueueScreen displayKey={decodeURIComponent(key)} />;
}
