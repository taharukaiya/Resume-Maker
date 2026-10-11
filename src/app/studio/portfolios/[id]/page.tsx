import { PortfolioEditor } from "@/components/portfolio-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PortfolioEditor key={id} id={id} />;
}
