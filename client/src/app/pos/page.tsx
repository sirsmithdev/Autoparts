"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Split, ShoppingCart, Pause, PlayCircle, DollarSign,
  Loader2, Package, Clock, BarChart3, X,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface PosSession {
  id: string;
  sessionNumber: string;
  openedAt: string;
  openingCash: string;
}

interface LookupProduct {
  id: string;
  name: string;
  partNumber: string;
  price: string;
  stockQty: number;
}

interface CartItem {
  productId: string;
  name: string;
  partNumber: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
}

interface HeldCart {
  id: string;
  label: string;
  items: CartItem[];
  heldAt: string;
}

const DEFAULT_TAX_RATE = 0.15;

export default function PosTerminalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tax rate from settings
  const { data: publicSettings } = useQuery<{ taxRate: string; taxName: string }>({
    queryKey: ["public-settings"],
    queryFn: () => api("/api/store/settings/public"),
  });
  const TAX_RATE = publicSettings ? parseFloat(publicSettings.taxRate) / 100 : DEFAULT_TAX_RATE;
  const searchRef = useRef<HTMLInputElement>(null);

  // Session
  const [openRegisterDialog, setOpenRegisterDialog] = useState(false);
  const [closeRegisterDialog, setCloseRegisterDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "split">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [cardTransactionId, setCardTransactionId] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [splitCardId, setSplitCardId] = useState("");

  // Held carts
  const [heldCartDialog, setHeldCartDialog] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Session query
  const { data: session, isLoading: sessionLoading } = useQuery<PosSession | null>({
    queryKey: ["pos-session"],
    queryFn: async () => {
      try {
        return await api<PosSession>("/api/store/pos/sessions/current");
      } catch {
        return null;
      }
    },
  });

  // Show open register dialog if no session
  useEffect(() => {
    if (!sessionLoading && !session) {
      setOpenRegisterDialog(true);
    }
  }, [sessionLoading, session]);

  // Product lookup
  const { data: searchResults } = useQuery<LookupProduct[]>({
    queryKey: ["pos-lookup", debouncedQuery],
    queryFn: () => api<LookupProduct[]>(`/api/store/pos/lookup?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  });

  // Held carts
  const { data: heldCarts } = useQuery<HeldCart[]>({
    queryKey: ["pos-held-carts"],
    queryFn: () => api<HeldCart[]>("/api/store/pos/hold"),
    enabled: heldCartDialog,
  });

  // Open session
  const openSessionMutation = useMutation({
    mutationFn: (amount: number) => api("/api/store/pos/sessions/open", {
      method: "POST",
      body: JSON.stringify({ openingCash: amount }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-session"] });
      setOpenRegisterDialog(false);
      setOpeningCash("");
      toast({ title: "Register opened" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Close session
  const closeSessionMutation = useMutation({
    mutationFn: (amount: number) => api("/api/store/pos/sessions/close", {
      method: "POST",
      body: JSON.stringify({ closingCash: amount }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-session"] });
      setCloseRegisterDialog(false);
      setClosingCash("");
      toast({ title: "Register closed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Complete sale
  const saleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ transactionNumber: string }>("/api/store/pos/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: (data) => {
      const result = data as { transactionNumber: string };
      toast({ title: `Sale complete: ${result.transactionNumber}` });
      setCart([]);
      setPaymentMethod("cash");
      setCashReceived("");
      setCardTransactionId("");
      setSplitCash("");
      setSplitCardId("");
      searchRef.current?.focus();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Hold cart
  const holdMutation = useMutation({
    mutationFn: () => api("/api/store/pos/hold", {
      method: "POST",
      body: JSON.stringify({ items: cart }),
    }),
    onSuccess: () => {
      toast({ title: "Cart held" });
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ["pos-held-carts"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Delete held cart
  const deleteHeldMutation = useMutation({
    mutationFn: (id: string) => api(`/api/store/pos/hold/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pos-held-carts"] }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Cart helpers
  const addToCart = useCallback((product: LookupProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        partNumber: product.partNumber,
        unitPrice: parseFloat(product.price),
        quantity: 1,
        discountPercent: 0,
      }];
    });
    setSearchQuery("");
    setShowResults(false);
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => c.productId === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.productId !== productId));
    } else {
      setCart((prev) => prev.map((c) => c.productId === productId ? { ...c, quantity: qty } : c));
    }
  }, []);

  const setDiscount = useCallback((productId: string, pct: number) => {
    setCart((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, discountPercent: Math.min(100, Math.max(0, pct)) } : c)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const recallCart = useCallback((held: HeldCart) => {
    setCart(held.items);
    deleteHeldMutation.mutate(held.id);
    setHeldCartDialog(false);
  }, [deleteHeldMutation]);

  // Calculations
  const subtotal = cart.reduce((sum, c) => {
    const lineTotal = c.unitPrice * c.quantity;
    const discount = lineTotal * (c.discountPercent / 100);
    return sum + (lineTotal - discount);
  }, 0);
  const totalDiscount = cart.reduce((sum, c) => {
    return sum + (c.unitPrice * c.quantity * (c.discountPercent / 100));
  }, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const cashChange = paymentMethod === "cash" && cashReceived
    ? parseFloat(cashReceived) - total
    : 0;

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    const body: Record<string, unknown> = {
      items: cart.map((c) => ({
        productId: c.productId,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountPercent: c.discountPercent,
      })),
      paymentMethod,
      subtotal,
      taxAmount: tax,
      total,
    };
    if (paymentMethod === "cash") {
      body.cashReceived = parseFloat(cashReceived) || 0;
      body.changeGiven = Math.max(0, cashChange);
    } else if (paymentMethod === "card") {
      body.cardTransactionId = cardTransactionId;
    } else if (paymentMethod === "split") {
      body.splitCash = parseFloat(splitCash) || 0;
      body.splitCardId = splitCardId;
    }
    saleMutation.mutate(body);
  };

  const canComplete = cart.length > 0 && (
    (paymentMethod === "cash" && parseFloat(cashReceived) >= total) ||
    (paymentMethod === "card" && cardTransactionId.trim().length > 0) ||
    (paymentMethod === "split" && parseFloat(splitCash) >= 0 && splitCardId.trim().length > 0)
  );

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-52px)]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Session info bar */}
      {session && (
        <div className="bg-card border-b px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Session {session.sessionNumber}
            </span>
            <span className="text-muted-foreground">
              Opened {format(new Date(session.openedAt), "h:mm a")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/pos/reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Reports
            </Link>
            <button
              onClick={() => setCloseRegisterDialog(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Close Register
            </button>
          </div>
        </div>
      )}

      {/* Main POS interface */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-52px-41px)] overflow-hidden">
        {/* Left column: Search + Cart */}
        <div className="flex-1 lg:w-[60%] flex flex-col border-r overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b bg-card relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchRef}
                placeholder="Search by name or part number..."
                className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
              />
            </div>
            {/* Search results dropdown */}
            {showResults && debouncedQuery.length >= 2 && searchResults && searchResults.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-card border rounded-md shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{product.partNumber}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold">{formatPrice(product.price)}</p>
                      <p className="text-xs text-muted-foreground">{product.stockQty} in stock</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && debouncedQuery.length >= 2 && searchResults && searchResults.length === 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-card border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
                No products found
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Search for a product to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/40">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-center p-3 font-medium text-muted-foreground w-28">Qty</th>
                    <th className="text-center p-3 font-medium text-muted-foreground w-20">Disc %</th>
                    <th className="text-right p-3 font-medium text-muted-foreground w-24">Price</th>
                    <th className="text-right p-3 font-medium text-muted-foreground w-28">Total</th>
                    <th className="w-10 p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const lineTotal = item.unitPrice * item.quantity;
                    const discountAmt = lineTotal * (item.discountPercent / 100);
                    const netTotal = lineTotal - discountAmt;
                    return (
                      <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.partNumber}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.productId, -1)}
                              className="p-1 hover:bg-accent rounded transition-colors"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              className="w-12 text-center border rounded px-1 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.productId, parseInt(e.target.value, 10) || 0)}
                            />
                            <button
                              onClick={() => updateQuantity(item.productId, 1)}
                              className="p-1 hover:bg-accent rounded transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="w-14 text-center border rounded px-1 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            value={item.discountPercent || ""}
                            onChange={(e) => setDiscount(item.productId, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{formatPrice(item.unitPrice)}</td>
                        <td className="p-3 text-right font-medium">{formatPrice(netTotal)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cart footer */}
          {cart.length > 0 && (
            <div className="border-t bg-card px-4 py-3 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => holdMutation.mutate()}
                  disabled={holdMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Pause className="h-3.5 w-3.5" /> Hold Cart
                </button>
                <button
                  onClick={() => setHeldCartDialog(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors"
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Recall
                </button>
              </div>
              <div className="text-right">
                <span className="text-sm text-muted-foreground">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
                <span className="ml-3 text-lg font-bold">{formatPrice(subtotal)}</span>
              </div>
            </div>
          )}
          {cart.length === 0 && (
            <div className="border-t bg-card px-4 py-3">
              <button
                onClick={() => setHeldCartDialog(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-accent transition-colors"
              >
                <PlayCircle className="h-3.5 w-3.5" /> Recall Held Cart
              </button>
            </div>
          )}
        </div>

        {/* Right column: Payment */}
        <div className="lg:w-[40%] flex flex-col bg-card overflow-auto">
          <div className="flex-1 p-5 space-y-5">
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotal + totalDiscount)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">-{formatPrice(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-3">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-col items-center gap-1.5 p-3 border rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <Banknote className="h-5 w-5" />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center gap-1.5 p-3 border rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === "card" ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  Card
                </button>
                <button
                  onClick={() => setPaymentMethod("split")}
                  className={`flex flex-col items-center gap-1.5 p-3 border rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === "split" ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent"
                  }`}
                >
                  <Split className="h-5 w-5" />
                  Split
                </button>
              </div>
            </div>

            {/* Payment inputs */}
            <div className="space-y-3">
              {paymentMethod === "cash" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Amount Received</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>
                  </div>
                  {cashReceived && parseFloat(cashReceived) >= total && (
                    <div className="flex justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-sm font-medium text-green-700">Change</span>
                      <span className="text-sm font-bold text-green-700">{formatPrice(cashChange)}</span>
                    </div>
                  )}
                </>
              )}
              {paymentMethod === "card" && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Card Transaction ID</label>
                  <input
                    placeholder="Enter transaction reference"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={cardTransactionId}
                    onChange={(e) => setCardTransactionId(e.target.value)}
                  />
                </div>
              )}
              {paymentMethod === "split" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Cash Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                      />
                    </div>
                  </div>
                  {splitCash && parseFloat(splitCash) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Card portion: {formatPrice(Math.max(0, total - parseFloat(splitCash)))}
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Card Transaction ID</label>
                    <input
                      placeholder="Enter transaction reference"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={splitCardId}
                      onChange={(e) => setSplitCardId(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Complete sale button */}
          <div className="p-5 border-t space-y-2">
            <button
              onClick={handleCompleteSale}
              disabled={!canComplete || saleMutation.isPending}
              className="w-full py-3.5 bg-green-600 text-white rounded-md text-base font-bold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saleMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <DollarSign className="h-5 w-5" />
              )}
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {/* Open Register Dialog */}
      {openRegisterDialog && !session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4">
            <h3 className="text-lg font-bold">Open Register</h3>
            <p className="text-sm text-muted-foreground">Enter the opening cash amount to start a new POS session.</p>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Opening Cash Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              onClick={() => openSessionMutation.mutate(parseFloat(openingCash) || 0)}
              disabled={openSessionMutation.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Open Register
            </button>
          </div>
        </div>
      )}

      {/* Close Register Dialog */}
      {closeRegisterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCloseRegisterDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Close Register</h3>
            <p className="text-sm text-muted-foreground">Count the cash in the drawer and enter the closing amount.</p>
            {session && (
              <div className="text-sm space-y-1 p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between"><span className="text-muted-foreground">Session</span><span className="font-medium">{session.sessionNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Opened</span><span>{format(new Date(session.openedAt), "h:mm a")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Opening Cash</span><span>{formatPrice(session.openingCash)}</span></div>
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Closing Cash Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCloseRegisterDialog(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => closeSessionMutation.mutate(parseFloat(closingCash) || 0)}
                disabled={closeSessionMutation.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Carts Dialog */}
      {heldCartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setHeldCartDialog(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-md shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Held Carts</h3>
              <button onClick={() => setHeldCartDialog(false)} className="p-1 hover:bg-accent rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {!heldCarts || heldCarts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No held carts</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {heldCarts.map((held) => (
                  <div key={held.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{held.label || `${held.items.length} items`}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(held.heldAt), "MMM d, h:mm a")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => recallCart(held)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Recall
                      </button>
                      <button
                        onClick={() => deleteHeldMutation.mutate(held.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
