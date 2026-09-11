"use client";

import * as React from "react";
import Link from "next/link";
import { TicketPercent, ChevronDown, Tag, ExternalLink, Copy, Check } from "lucide-react";
import { useTranslations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  couponCopyTarget,
  couponLinkLabel,
  formatCouponDiscount,
} from "@/lib/coupon-format";
import type { CouponOffer } from "@/lib/coupon-format";
import { cn } from "@/lib/utils";

/**
 * Site-wide coupon reminder shown NEXT TO an unmodified provider CTA
 * (Visit/Subscribe). One coupon = direct link to its offer; several =
 * popover listing them. Plan-scoped and api-scoped offers are passed in
 * already filtered by the server page (see getActiveCouponMap).
 */
export interface CouponBadgeProps {
  coupons: CouponOffer[];
  locale: string;
  size?: "xs" | "sm";
  align?: "start" | "center" | "end";
  className?: string;
}

const pillBase =
  "inline-flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-full border font-medium transition-colors " +
  "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 " +
  "dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-300 dark:hover:bg-pink-950/70";

const pillSizes = {
  xs: "h-5 px-1.5 text-[11px]",
  sm: "px-2 py-0.5 text-xs",
};

export function CouponBadge({ coupons, locale, size = "sm", align = "center", className }: CouponBadgeProps) {
  const t = useTranslations("coupons");
  if (!coupons.length) return null;

  const label = formatCouponDiscount(coupons[0], locale, t, "badgeToken");

  if (coupons.length === 1) {
    const coupon = coupons[0];
    const shared = cn(pillBase, pillSizes[size], className);
    return coupon.offerUrl ? (
      <a
        href={coupon.offerUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={shared}
        title={coupon.description}
      >
        <TicketPercent className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    ) : (
      <Link href={`/${locale}/coupons`} className={shared} title={coupon.description}>
        <TicketPercent className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("availableDeals", { count: coupons.length })}
          className={cn(pillBase, pillSizes[size], className)}
        >
          <TicketPercent className="size-3 shrink-0" />
          <span className="truncate">{t("dealsCount", { count: coupons.length })}</span>
          <ChevronDown className="size-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[19rem]">
        <div className="divide-y">
          {coupons.map((coupon) => (
            <CouponOfferRow key={coupon.id} coupon={coupon} locale={locale} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CouponOfferRow({ coupon, locale }: { coupon: CouponOffer; locale: string }) {
  const t = useTranslations("coupons");
  const [copied, setCopied] = React.useState(false);
  const target = couponCopyTarget(coupon);
  const targetIsLink = target.startsWith("http");
  const label = formatCouponDiscount(coupon, locale, t);

  const handleCopy = () => {
    navigator.clipboard.writeText(target);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-2 p-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-pink-700 dark:text-pink-300">{label}</div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{coupon.description}</p>
        <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          {targetIsLink ? (
            <ExternalLink className="size-3 shrink-0" />
          ) : (
            <Tag className="size-3 shrink-0" />
          )}
          <span className="truncate" title={target}>
            {targetIsLink ? couponLinkLabel(target) : target}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          aria-label={targetIsLink ? t("copyLink") : t("copy")}
          title={targetIsLink ? t("copyLink") : t("copy")}
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </Button>
        {coupon.offerUrl ? (
          <Button asChild size="icon-xs" variant="ghost" aria-label={t("visit")} title={t("visit")}>
            <a href={coupon.offerUrl} target="_blank" rel="sponsored noopener noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : (
          <Button asChild size="icon-xs" variant="ghost" aria-label={t("visit")} title={t("visit")}>
            <Link href={`/${locale}/coupons`}>
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
