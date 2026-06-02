import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: playfair } = loadPlayfair("italic", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

/**
 * LyricBand — a tasteful bilingual lyric line for warm photo montages.
 *
 * Renders a primary line (e.g. Javanese) over a lighter secondary line
 * (e.g. its Malay rendering) in a bottom band, Playfair italic with a soft
 * dark scrim for readability over photos. Fades in/out within its Sequence.
 *
 * Used as an Explainer overlay (`overlay.type === "lyric_band"`):
 *   text     -> primary (top) line
 *   subtitle -> secondary (bottom) line, smaller and dimmer
 *   position -> "bottom" (default) | "lower-third"
 */
export interface LyricBandProps {
  text: string;
  subtitle?: string;
  bottomY?: number; // 0..1, vertical center of the band (default 0.84)
  accentColor?: string;
}

export const LyricBand: React.FC<LyricBandProps> = ({
  text,
  subtitle,
  bottomY = 0.84,
  accentColor = "rgba(255, 214, 150, 0.9)",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, height } = useVideoConfig();

  const fadeInFrames = Math.round(0.5 * fps);
  const fadeOutFrames = Math.round(0.7 * fps);
  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fadeOutFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);
  const yRise = interpolate(fadeIn, [0, 1], [12, 0]);
  const lineProgress = interpolate(frame, [0, fadeInFrames + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cream = "#F6ECD2";

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: height * (1 - bottomY),
        opacity,
      }}
    >
      {/* Soft scrim for readability */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.66) 100%)",
        }}
      />
      <div
        style={{
          transform: `translateY(${yRise}px)`,
          textAlign: "center",
          padding: "0 80px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Primary line (Javanese) */}
        <div
          style={{
            fontFamily: playfair,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 52,
            lineHeight: 1.18,
            color: cream,
            letterSpacing: "0.01em",
            textShadow: "0 2px 18px rgba(0,0,0,0.88), 0 0 22px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </div>

        {/* Gold divider */}
        <div
          style={{
            margin: "14px auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 80 * lineProgress,
              height: 1.1,
              background: `linear-gradient(90deg, rgba(246,236,210,0) 0%, ${accentColor} 100%)`,
            }}
          />
          <div
            style={{
              width: 4.5,
              height: 4.5,
              borderRadius: 999,
              background: accentColor,
              opacity: lineProgress,
              boxShadow: `0 0 10px ${accentColor}`,
            }}
          />
          <div
            style={{
              width: 80 * lineProgress,
              height: 1.1,
              background: `linear-gradient(90deg, ${accentColor} 0%, rgba(246,236,210,0) 100%)`,
            }}
          />
        </div>

        {/* Secondary line (Malay) */}
        {subtitle ? (
          <div
            style={{
              fontFamily: playfair,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 34,
              lineHeight: 1.2,
              color: "rgba(246, 236, 210, 0.78)",
              letterSpacing: "0.01em",
              textShadow: "0 2px 14px rgba(0,0,0,0.85)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
