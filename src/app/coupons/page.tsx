"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Gift, Copy, Check, ExternalLink, Sparkles, Shield, Clock, Tag } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  provider_id: number;
  description: string;
  discount_type: string;
  discount_value: number;
  expires_at: string;
  is_verified: boolean;
  providers: {
    id: number;
    name: string;
    slug: string;
    logo: string;
  };
}

// Provider info
const providerMeta: Record<number, { name: string; logo: string; color: string; website: string }> = {
  1: { name: "OpenAI", logo: "🤖", color: "bg-green-600", website: "https://openai.com" },
  2: { name: "Anthropic", logo: "🧠", color: "bg-orange-600", website: "https://anthropic.com" },
  3: { name: "DeepSeek", logo: "🔮", color: "bg-purple-600", website: "https://www.deepseek.com" },
  8: { name: "火山引擎", logo: "🌋", color: "bg-red-600", website: "https://www.volcengine.com" },
  10: { name: "硅基流动", logo: "💧", color: "bg-blue-600", website: "https://siliconflow.cn" },
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCoupons() {
      try {
        const res = await fetch("/api/coupons");
        const data = await res.json();
        setCoupons(data);
      } catch (error) {
        console.error("Error fetching coupons:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCoupons();
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}% OFF`;
    } else if (coupon.discount_type === 'fixed') {
      return `$${coupon.discount_value} CREDIT`;
    }
    return `${coupon.discount_value}`;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const verifiedCoupons = coupons.filter(c => c.is_verified && !isExpired(c.expires_at));
  const otherCoupons = coupons.filter(c => !c.is_verified || isExpired(c.expires_at));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 dark:bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-xl font-bold">PlanPrice.ai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/compare/plans" className="text-sm font-medium hover:text-blue-600">
              Compare Plans
            </Link>
            <Link href="/compare/models" className="text-sm font-medium hover:text-blue-600">
              Model Compare
            </Link>
            <Link href="/coupons" className="text-sm font-medium text-blue-600">
              Coupons
            </Link>
            <Link href="/api-pricing" className="text-sm font-medium hover:text-blue-600">
              API Pricing
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
          <Link href="/" className="flex items-center gap-1 hover:text-blue-600">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full mb-4">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">AI Service Coupons & Deals</h1>
          <p className="text-lg text-zinc-600 max-w-2xl mx-auto">
            Find the latest discount codes and promotional offers for ChatGPT, Claude, DeepSeek and more.
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-green-600">{verifiedCoupons.length}</div>
              <div className="text-sm text-zinc-600">Verified Coupons</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {verifiedCoupons.reduce((acc, c) => acc + (c.discount_type === 'percentage' ? c.discount_value : 0), 0)}%
              </div>
              <div className="text-sm text-zinc-600">Max Discount</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="py-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                ${verifiedCoupons.reduce((acc, c) => acc + (c.discount_type === 'fixed' ? c.discount_value : 0), 0)}
              </div>
              <div className="text-sm text-zinc-600">Total Credits</div>
            </CardContent>
          </Card>
        </div>

        {/* Verified Coupons */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Verified Coupons
            <Badge className="bg-green-100 text-green-800">{verifiedCoupons.length}</Badge>
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {verifiedCoupons.map((coupon) => {
              const provider = providerMeta[coupon.provider_id] || { name: "Unknown", logo: "🏢", color: "bg-gray-600", website: "#" };
              const daysLeft = getDaysLeft(coupon.expires_at);

              return (
                <Card key={coupon.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Provider Logo */}
                      <div className={`${provider.color} w-24 flex items-center justify-center rounded-l-lg`}>
                        <span className="text-3xl">{provider.logo}</span>
                      </div>

                      {/* Coupon Details */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{provider.name}</span>
                              {coupon.is_verified && (
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <Check className="w-3 h-3 mr-1" /> Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">{coupon.description}</p>
                          </div>
                          <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                            {formatDiscount(coupon)}
                          </Badge>
                        </div>

                        {/* Code & Actions */}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded px-3 py-2 font-mono text-sm flex items-center gap-2">
                            <Tag className="w-4 h-4 text-zinc-500" />
                            {coupon.code}
                          </div>
                          <Button
                            size="sm"
                            variant={copiedCode === coupon.code ? "secondary" : "default"}
                            onClick={() => handleCopy(coupon.code)}
                            className="gap-1"
                          >
                            {copiedCode === coupon.code ? (
                              <>
                                <Check className="w-4 h-4" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> Copy
                              </>
                            )}
                          </Button>
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline" className="gap-1">
                              Visit <ExternalLink className="w-3 h-3" />
                            </Button>
                          </a>
                        </div>

                        {/* Expiry */}
                        <div className="flex items-center gap-1 mt-2 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expiring soon'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Other Coupons */}
        {otherCoupons.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-zinc-400" />
              Other Offers
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {otherCoupons.map((coupon) => {
                const provider = providerMeta[coupon.provider_id] || { name: "Unknown", logo: "🏢", color: "bg-gray-600", website: "#" };

                return (
                  <Card key={coupon.id} className="opacity-60 hover:opacity-80 transition-opacity">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{provider.logo}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            {isExpired(coupon.expires_at) && (
                              <Badge variant="outline" className="text-xs">Expired</Badge>
                            )}
                            {!coupon.is_verified && (
                              <Badge variant="outline" className="text-xs">Unverified</Badge>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500">{coupon.description}</p>
                        </div>
                        <Badge variant="outline">
                          {formatDiscount(coupon)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Submit Coupon CTA */}
        <Card className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
          <CardContent className="py-8 text-center">
            <h3 className="font-bold text-xl mb-2">Have a coupon code?</h3>
            <p className="text-zinc-600 mb-4">
              Share your discount code with the community and help others save money on AI services.
            </p>
            <Button size="lg" className="gap-2">
              <Gift className="w-4 h-4" /> Submit a Coupon
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="font-medium">PlanPrice.ai</span>
          </div>
          <p className="text-sm text-zinc-500">© 2026 PlanPrice.ai - Compare AI pricing & save money</p>
        </div>
      </footer>
    </div>
  );
}
