import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("playbackState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();
  },
});

export const setActiveSlide = mutation({
  args: {
    orgId: v.id("organizations"),
    activeSlideId: v.optional(v.string()),
    activeBackgroundId: v.optional(v.string()),
    isBlackedOut: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("playbackState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        activeSlideId: args.activeSlideId ?? existing.activeSlideId,
        activeBackgroundId: args.activeBackgroundId ?? existing.activeBackgroundId,
        isBlackedOut: args.isBlackedOut ?? existing.isBlackedOut,
        updatedAt: now,
      });
      return existing._id;
    }

    const playbackId = await ctx.db.insert("playbackState", {
      orgId: args.orgId,
      isBlackedOut: args.isBlackedOut ?? false,
      updatedAt: now,
      ...(args.activeSlideId !== undefined
        ? { activeSlideId: args.activeSlideId }
        : {}),
      ...(args.activeBackgroundId !== undefined
        ? { activeBackgroundId: args.activeBackgroundId }
        : {}),
    });
    return playbackId;
  },
});
