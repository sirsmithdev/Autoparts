import Link from "next/link";

export function TopUtilityBar() {
  return (
    <div className="bg-[rgb(239,244,247)] border-b border-[rgb(231,236,238)] hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-9 text-xs text-[rgb(81,93,100)]">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              About Us
            </Link>
            <Link href="/policies/returns" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            <Link href="/orders" className="hover:text-foreground transition-colors">
              Order Tracking
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span>English</span>
            <span>USD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
