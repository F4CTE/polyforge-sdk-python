import * as React from "react";
import { Toaster as SonnerToaster } from "sonner";

export interface ToasterProps {
  theme?: "light" | "dark" | "system";
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
}

function Toaster({ theme = "dark", position = "top-right" }: ToasterProps) {
  return (
    <SonnerToaster
      theme={theme}
      position={position}
      toastOptions={{
        className: "bg-elevated border border-default text-primary",
      }}
    />
  );
}

export { Toaster };
