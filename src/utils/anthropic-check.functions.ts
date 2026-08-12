
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listAnthropicModels = createServerFn({ method: "POST" })
  .handler(async () => {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) return { error: "ANTHROPIC_API_KEY not found" };

    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        }
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: `Anthropic API error (${response.status}): ${error}` };
      }

      return response.json();
    } catch (e: any) {
      return { error: e.message };
    }
  });
