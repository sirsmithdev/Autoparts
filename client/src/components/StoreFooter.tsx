"use client";
import Link from "next/link";
import { Store, Mail, Clock, Phone, MapPin } from "lucide-react";

export function StoreFooter() {
  return (
    <footer className="bg-[hsl(222,47%,11%)] text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg text-white mb-3">
              <Store className="h-5 w-5 text-blue-400" />
              316 Auto Parts
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Quality OEM and aftermarket automotive parts with island-wide delivery.
              Browse by vehicle, part number, or VIN.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Shop</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/search" className="hover:text-white transition-colors">
                  Browse All Parts
                </Link>
              </li>
              <li>
                <Link href="/search?featured=true" className="hover:text-white transition-colors">
                  Featured Parts
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Customer Service</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/orders" className="hover:text-white transition-colors">
                  My Orders
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-white transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <a
                  href="https://316-automotive.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  316 Automotive Main Site
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Contact</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                <a href="mailto:info@316-automotive.com" className="hover:text-white transition-colors">
                  info@316-automotive.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-gray-500" />
                <span>Mon – Sat: 8am – 5pm</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>&copy; {new Date().getFullYear()} 316 Automotive. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <span>Quality parts, delivered.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
