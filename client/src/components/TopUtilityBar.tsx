import Link from "next/link";
import { Phone, Mail } from "lucide-react";

export function TopUtilityBar() {
  return (
    <div className="bg-topbar border-b border-border hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-9 text-xs text-topbar-foreground">
          <div className="flex items-center gap-4">
            <Link href="/policies/returns" className="hover:text-foreground transition-colors">
              Returns Policy
            </Link>
            <Link href="/orders" className="hover:text-foreground transition-colors">
              Order Tracking
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              (876) 555-0316
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              info@316automotive.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
