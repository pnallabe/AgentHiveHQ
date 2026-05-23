
"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

// Skip Firebase auth gate in local development so the Lab is accessible
// without a Firebase account. Never true in production builds.
const DEV_SKIP_AUTH =
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export function withAuth<P extends object>(WrappedComponent: ComponentType<P>) {
  const ComponentWithAuth = (props: P): ReactNode => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (DEV_SKIP_AUTH) return;
      if (!loading && !user) {
        router.replace("/login");
      }
    }, [user, loading, router]);

    if (!DEV_SKIP_AUTH && (loading || !user)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
  ComponentWithAuth.displayName = `WithAuth(${getDisplayName(WrappedComponent)})`;
  return ComponentWithAuth;
}

function getDisplayName<P>(WrappedComponent: ComponentType<P>) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}
