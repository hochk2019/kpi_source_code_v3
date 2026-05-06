import * as React from "react"

import { Slot } from "@radix-ui/react-slot"



import { cn } from "@/lib/utils"

import { buttonVariants } from "./button-variants.js"



function Button({

  className,

  variant,

  size,

  asChild = false,

  ...props

}: {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {

  const Comp = asChild ? Slot : "button"



  return (

    <Comp

      data-slot="button"

      className={cn(buttonVariants({ variant, size, className }))}

      {...props} />

  );

}



export { Button }

