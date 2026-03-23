"use client";
import Link from "next/link";
import { Store, Mail, Clock, Phone, MapPin, Facebook, Instagram, Twitter } from "lucide-react";
import { NewsletterBanner } from "./NewsletterBanner";

export function StoreFooter() {
  return (
    <footer className="mt-auto">
      <NewsletterBanner />

      <div className="bg-[hsl(var(--header-bg))] text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Contact Us */}
            <div>
              <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Contact Us</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-500 block">Phone Number</span>
                    <a href="tel:+18765550316" className="hover:text-white transition-colors">(876) 555-0316</a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-500 block">E-Mail</span>
                    <a href="mailto:info@316-automotive.com" className="hover:text-white transition-colors">info@316-automotive.com</a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-500 block">Address</span>
                    <span>Kingston, Jamaica</span>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-xs text-gray-500 block">Hours</span>
                    <span>Mon – Sat: 8am – 5pm</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Let Us Help You */}
            <div>
              <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Let Us Help You</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/account" className="hover:text-white transition-colors">My Account</Link></li>
                <li><Link href="/orders" className="hover:text-white transition-colors">Order Tracking</Link></li>
                <li><Link href="/returns" className="hover:text-white transition-colors">Returns & Replacements</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              </ul>
            </div>

            {/* Customer Service */}
            <div>
              <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Customer Service</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/search" className="hover:text-white transition-colors">Browse All Parts</Link></li>
                <li><Link href="/search?featured=true" className="hover:text-white transition-colors">Featured Parts</Link></li>
                <li><Link href="/search?category=Engine" className="hover:text-white transition-colors">Engine Parts</Link></li>
                <li>
                  <a href="https://316-automotive.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    316 Automotive Main Site
                  </a>
                </li>
              </ul>
            </div>

            {/* Get to Know Us */}
            <div>
              <h4 className="font-semibold text-sm text-white mb-4 uppercase tracking-wider">Get to Know Us</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/" className="hover:text-white transition-colors">About 316 Automotive</Link></li>
                <li><Link href="/search" className="hover:text-white transition-colors">Our Parts Catalog</Link></li>
                <li>
                  <a href="https://316-automotive.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Workshop Services
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 pt-6 border-t border-white/10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Logo + socials */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
                  <Store className="h-5 w-5 text-blue-400" />
                  316 Auto Parts
                </Link>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-2">Call us</span>
                  <a href="tel:+18765550316" className="text-xs text-gray-400 hover:text-white transition-colors">
                    (876) 555-0316
                  </a>
                </div>
              </div>

              {/* Payment badges */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Powered by</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-white/10 rounded text-gray-400 font-medium">Visa</span>
                  <span className="px-2 py-1 bg-white/10 rounded text-gray-400 font-medium">MC</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-gray-500">
              &copy; {new Date().getFullYear()} 316 Automotive. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
