import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedSupply Flow Prototype",
    short_name: "MedSupply",
    description:
      "Internal prototype for medical supply order intake, review, and vendor dispatch.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fbff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

