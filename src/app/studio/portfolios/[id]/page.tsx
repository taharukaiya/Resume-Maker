import { PortfolioEditor } from "@/components/portfolio-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PortfolioEditor id={(await params).id} />;
}
