import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { TopUtilityBar } from "@/components/TopUtilityBar";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopUtilityBar />
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </>
  );
}
