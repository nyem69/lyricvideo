import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: playfair } = loadPlayfair("italic", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

/**
 * TitleCard — warm, elegant opening/closing card for the memory montage.
 *
 * Large Playfair italic title (cream) over a gold divider and a smaller
 * subtitle, centered on a warm-dark ground. Gentle fade in/out within its
 * Sequence. Cut shape: { type: "title_card", title, subtitle, in_seconds, out_seconds }
 */
export interface TitleCardProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  backgroundColor?: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  accentColor = "#D8A657",
  backgroundColor = "#160E07",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeInF = Math.round(0.8 * fps);
  const fadeOutF = Math.round(0.9 * fps);
  const fadeIn = interpolate(frame, [0, fadeInF], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durationInFrames - fadeOutF, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  const rise = interpolate(fadeIn, [0, 1], [16, 0]);
  const lineGrow = interpolate(frame, [0, fadeInF + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cream = "#F6ECD2";

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, #20140b 0%, ${backgroundColor} 70%)`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center", transform: `translateY(${rise}px)`, padding: "0 120px" }}>
        <div
          style={{
            fontFamily: playfair,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 104,
            lineHeight: 1.08,
            color: cream,
            letterSpacing: "0.01em",
            textShadow: "0 2px 30px rgba(0,0,0,0.6)",
          }}
        >
          {title}
        </div>

        <div
          style={{
            margin: "34px auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 140 * lineGrow,
              height: 1.4,
              background: `linear-gradient(90deg, rgba(216,166,87,0) 0%, ${accentColor} 100%)`,
            }}
          />
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: accentColor,
              opacity: lineGrow,
              boxShadow: `0 0 14px ${accentColor}`,
            }}
          />
          <div
            style={{
              width: 140 * lineGrow,
              height: 1.4,
              background: `linear-gradient(90deg, ${accentColor} 0%, rgba(216,166,87,0) 100%)`,
            }}
          />
        </div>

        {subtitle ? (
          <div
            style={{
              fontFamily: playfair,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 40,
              lineHeight: 1.25,
              color: "rgba(246, 236, 210, 0.82)",
              letterSpacing: "0.02em",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
