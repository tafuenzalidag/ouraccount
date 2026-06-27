"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getHouseholdId } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    router.replace(getHouseholdId() ? "/dashboard" : "/settings");
  }, [router]);
  return null;
}
