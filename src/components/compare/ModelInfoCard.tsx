"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface ModelInfoCardProps {
  model: {
    slug: string;
    name: string;
    provider: {
      slug: string;
      name: string;
      logo: string;
      website: string | null;
      inviteUrl: string | null;
    };
    contextWindow: number;
    maxOutput: number;
    benchmarkArena: number;
    releaseDate: string | null;
  };
  planCount: number;
  lowestPrice: number;
}

export function ModelInfoCard({ model, planCount, lowestPrice }: ModelInfoCardProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-4">
          {model.provider.logo && (
            <img
              src={model.provider.logo}
              alt={model.provider.name}
              className="w-16 h-16 object-contain"
            />
          )}
          <div className="flex-1">
            <CardTitle className="text-3xl mb-2">{model.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <span className="font-medium">Provider:</span>
                <span>{model.provider.name}</span>
                {(model.provider.inviteUrl || model.provider.website) && (
                  <a
                    href={model.provider.inviteUrl || model.provider.website || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                    title="Visit website"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div>
                <span className="font-medium">Context:</span> {(model.contextWindow / 1000).toFixed(0)}K tokens
              </div>
              <div>
                <span className="font-medium">Max Output:</span> {model.maxOutput?.toLocaleString()} tokens
              </div>
              {model.benchmarkArena > 0 && (
                <div>
                  <span className="font-medium">Arena:</span>{" "}
                  <Badge variant="secondary">{Math.round(model.benchmarkArena)}</Badge>
                </div>
              )}
              {model.releaseDate && (
                <div>
                  <span className="font-medium">Released:</span> {new Date(model.releaseDate).toLocaleDateString()}
                </div>
              )}
              <div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  ✅ Active
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-zinc-600 dark:text-zinc-400">
          Available in <span className="font-semibold">{planCount} plans</span> across multiple providers ·{" "}
          Starting from <span className="font-semibold">${lowestPrice.toFixed(2)}</span> per million input tokens
        </p>
      </CardContent>
    </Card>
  );
}
