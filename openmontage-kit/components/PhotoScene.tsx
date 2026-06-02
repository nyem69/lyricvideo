import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

function resolveAsset(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return src;
  const clean = src.replace(/^file:\/\/\/?/, "");
  if (clean.startsWith("/") || /^[A-Za-z]:[/\\]/.test(clean)) {
    return `file:///${clean.replace(/\\/g, "/")}`;
  }
  return staticFile(clean);
}

/**
 * PhotoScene — warm memory-book still with blur-fill + Ken Burns.
 *
 * The photo is shown WHOLE (objectFit: contain) so faces are never cropped,
 * over a blurred, zoomed copy of itself that fills the 16:9 frame. Both layers
 * get a gentle, shared Ken Burns drift so the still feels alive. Designed for
 * mixed portrait/landscape personal photos.
 *
 * Cut shape: { type: "photo", source, in_seconds, out_seconds, animation }
 *   animation: "ken-burns" | "ken-burns-slow-zoom" | "zoom-in" | "zoom-out" |
 *              "pan-left" | "pan-right" (default cycles via builder)
 */
export const PhotoScene: React.FC<{ src: string; animation?: string }> = ({
  src,
  animation,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const resolved = resolveAsset(src);

  const fadeIn = spring({ frame, fps, config: { damping: 200, stiffness: 60, mass: 0.6 } });
  const fadeOutStart = durationInFrames - 12;
  const fadeOut = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let scale = 1;
  let tx = 0;
  let ty = 0;
  const anim = animation || "ken-burns";
  if (anim === "zoom-in") {
    scale = 1 + progress * 0.12;
  } else if (anim === "zoom-out") {
    scale = 1.12 - progress * 0.12;
  } else if (anim === "pan-left") {
    scale = 1.08;
    tx = interpolate(progress, [0, 1], [22, -22]);
  } else if (anim === "pan-right") {
    scale = 1.08;
    tx = interpolate(progress, [0, 1], [-22, 22]);
  } else {
    // ken-burns family — gentle zoom + diagonal drift
    scale = 1 + progress * 0.12;
    tx = interpolate(progress, [0, 1], [0, -14]);
    ty = interpolate(progress, [0, 1], [0, -9]);
  }

  // Blur-fill background counter-drifts slightly for parallax depth
  const bgScale = 1.18 + progress * 0.06;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#1a120b", opacity }}>
      {/* Blurred fill — rendered at quarter resolution then upscaled 4x. The
          fill is heavily blurred anyway, so running blur(7px) over 1/16th the
          pixels looks identical to blur(28px) at full res but renders far
          faster (the blur was the 1080p bottleneck). */}
      <AbsoluteFill style={{ transform: `scale(${bgScale})`, willChange: "transform" }}>
        <Img
          src={resolved}
          style={{
            width: "25%",
            height: "25%",
            objectFit: "cover",
            transform: "scale(4)",
            transformOrigin: "top left",
            filter: "blur(7px) saturate(1.05) brightness(0.55)",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(26, 18, 11, 0.18)" }} />

      {/* Sharp photo — whole, contained, with Ken Burns */}
      <Img
        src={resolved}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
          willChange: "transform",
        }}
      />

      {/* Warm grade + soft vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(20,12,6,0.34) 100%)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,238,210,0.05) 0%, rgba(255,238,210,0) 22%, rgba(255,238,210,0) 78%, rgba(120,70,30,0.06) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
