"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

interface UsageEstimatorProps {
  onEstimateChange: (estimate: {
    monthlyRequests: number;
    avgInputTokens: number;
    avgOutputTokens: number;
  }) => void;
}

export function UsageEstimator({ onEstimateChange }: UsageEstimatorProps) {
  const [monthlyRequests, setMonthlyRequests] = useState(10000);
  const [avgInputTokens, setAvgInputTokens] = useState(1000);
  const [avgOutputTokens, setAvgOutputTokens] = useState(500);

  const handleRecalculate = () => {
    onEstimateChange({
      monthlyRequests,
      avgInputTokens,
      avgOutputTokens,
    });
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-6 mb-8">
      <h3 className="font-semibold mb-4">📊 Usage Estimator (Optional)</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Enter your expected usage to see personalized cost estimates for each plan
      </p>

      <div className="grid md:grid-cols-4 gap-4 items-end">
        <div>
          <Label htmlFor="requests" className="text-sm font-medium mb-2 block">
            Monthly Requests
          </Label>
          <Input
            id="requests"
            type="number"
            value={monthlyRequests}
            onChange={(e) => setMonthlyRequests(Number(e.target.value))}
            min={0}
          />
        </div>

        <div>
          <Label htmlFor="inputTokens" className="text-sm font-medium mb-2 block">
            Avg Input Tokens
          </Label>
          <Input
            id="inputTokens"
            type="number"
            value={avgInputTokens}
            onChange={(e) => setAvgInputTokens(Number(e.target.value))}
            min={0}
          />
        </div>

        <div>
          <Label htmlFor="outputTokens" className="text-sm font-medium mb-2 block">
            Avg Output Tokens
          </Label>
          <Input
            id="outputTokens"
            type="number"
            value={avgOutputTokens}
            onChange={(e) => setAvgOutputTokens(Number(e.target.value))}
            min={0}
          />
        </div>

        <div>
          <Button onClick={handleRecalculate} className="w-full gap-2">
            <RefreshCcw className="w-4 h-4" />
            Calculate
          </Button>
        </div>
      </div>
    </div>
  );
}
