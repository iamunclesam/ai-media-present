"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export function useOrganization() {
  const { isSignedIn } = useAuth();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const current = useQuery(api.users.getCurrentWithOrg);
  const [orgId, setOrgId] = useState<Id<"organizations"> | null>(null);

  // Initialize user on sign-in
  useEffect(() => {
    if (isSignedIn && !current) {
      void ensureCurrent();
    }
  }, [isSignedIn, current, ensureCurrent]);

  // Set orgId from current user
  useEffect(() => {
    if (current?.org) {
      setOrgId(current.org._id);
    }
  }, [current]);

  const effectiveOrgId = orgId ?? current?.org?._id ?? null;

  return {
    isSignedIn,
    current,
    orgId: effectiveOrgId,
    organization: current?.org ?? null,
  };
}
