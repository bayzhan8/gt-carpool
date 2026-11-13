import { ImageResponse } from "next/og";

export const alt = "GT Carpool — Split the ride to ATL and back.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#ffffff",
        color: "#003057",
        display: "flex",
        height: "100%",
        justifyContent: "space-between",
        padding: "80px 96px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div
          style={{
            background: "#b3a369",
            height: 8,
            width: 112,
          }}
        />
        <div style={{ fontSize: 82, fontWeight: 700 }}>GT Carpool</div>
        <div style={{ fontSize: 38, maxWidth: 680 }}>
          Split the ride to ATL and back.
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          background: "#f4f5f6",
          borderRadius: 120,
          display: "flex",
          height: 240,
          justifyContent: "center",
          width: 240,
        }}
      >
        <svg height="130" viewBox="0 0 120 120" width="130">
          <path
            d="M10 60 108 18 75 108 58 70 10 60Zm50 8 17 23 22-62-39 39Z"
            fill="#b3a369"
          />
        </svg>
      </div>
    </div>,
    size,
  );
}
