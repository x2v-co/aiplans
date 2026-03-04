"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface CompareFiltersProps {
  region: string;
  billingType: string;
  sortBy: string;
  currency: string;
  showYearly: boolean;
  onRegionChange: (value: string) => void;
  onBillingTypeChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onShowYearlyChange: (checked: boolean) => void;
}

export function CompareFilters({
  region,
  billingType,
  sortBy,
  currency,
  showYearly,
  onRegionChange,
  onBillingTypeChange,
  onSortByChange,
  onCurrencyChange,
  onShowYearlyChange,
}: CompareFiltersProps) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 mb-8">
      <h3 className="font-semibold mb-4">⚙️ Filters & Settings</h3>

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Region */}
        <div>
          <Label htmlFor="region" className="text-sm font-medium mb-2 block">
            Region
          </Label>
          <Select value={region} onValueChange={onRegionChange}>
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="global">🌍 International</SelectItem>
              <SelectItem value="china">🇨🇳 China</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing Type */}
        <div>
          <Label htmlFor="billing" className="text-sm font-medium mb-2 block">
            Billing Model
          </Label>
          <Select value={billingType} onValueChange={onBillingTypeChange}>
            <SelectTrigger id="billing">
              <SelectValue placeholder="Select billing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="pay_as_you_go">Pay as You Go</SelectItem>
              <SelectItem value="prepaid">Prepaid Packs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort By */}
        <div>
          <Label htmlFor="sortBy" className="text-sm font-medium mb-2 block">
            Sort By
          </Label>
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger id="sortBy">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price_asc">💰 Price (Low to High)</SelectItem>
              <SelectItem value="price_desc">💰 Price (High to Low)</SelectItem>
              <SelectItem value="rpm_desc">🔢 RPM (High to Low)</SelectItem>
              <SelectItem value="qps_desc">⚡ QPS (High to Low)</SelectItem>
              <SelectItem value="value">📊 Best Value</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div>
          <Label htmlFor="currency" className="text-sm font-medium mb-2 block">
            Currency
          </Label>
          <Select value={currency} onValueChange={onCurrencyChange}>
            <SelectTrigger id="currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD $</SelectItem>
              <SelectItem value="CNY">CNY ¥</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show Yearly */}
        <div>
          <Label htmlFor="yearly" className="text-sm font-medium mb-2 block">
            Display Options
          </Label>
          <div className="flex items-center space-x-2 h-10">
            <Switch
              id="yearly"
              checked={showYearly}
              onCheckedChange={onShowYearlyChange}
            />
            <Label htmlFor="yearly" className="text-sm font-normal">
              Show yearly discount
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
