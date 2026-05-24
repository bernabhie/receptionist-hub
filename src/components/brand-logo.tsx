import logo from "@/assets/logo.jpg";

export function BrandLogo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="B. Dent Care Center HQ"
        width={size}
        height={size}
        className="rounded-xl object-cover shadow-soft"
        style={{ width: size, height: size }}
      />
      {withText && (
        <div className="leading-tight">
          <div className="font-bold text-brand-gradient text-base">B. Dent Care HQ</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Your smile. Our pride.
          </div>
        </div>
      )}
    </div>
  );
}
