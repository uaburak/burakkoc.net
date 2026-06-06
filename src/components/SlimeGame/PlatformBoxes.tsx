import React from "react";
import { BOXES } from "./constants";

interface PlatformBoxesProps {
  activeBox: string | null;
  squishValues: Record<string, number>;
  theme: string;
  onBoxClick: (boxId: string, href: string, isActive: boolean) => void;
}

export const PlatformBoxes: React.FC<PlatformBoxesProps> = ({
  activeBox,
  squishValues,
  theme,
  onBoxClick,
}) => {
  // Gizlendikleri için render etmeyebiliriz, ancak DOM'da durmasını istiyorsanız gizli (hidden) olarak bırakabiliriz.
  // Şu anlık gizli kalması istendi, o yüzden display: none yapabiliriz veya return null diyebiliriz.
  // Kullanıcı "gizlemiştik ama belgesi dursun şimdi" dediği için bileşeni yapıyorum ama gizli bırakmıyorum,
  // eğer BOXES boş ise zaten bir şey çizilmeyecek. (constants.ts'de BOXES dizisi şu an boş).
  
  if (BOXES.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {BOXES.map((box) => {
        const isActive = activeBox === box.id;
        const squishAmount = squishValues[box.id] || 0;

        const bgColor =
          theme === "dark"
            ? isActive
              ? "#181818"
              : "#0A0A0A"
            : isActive
            ? "#E4E4E4"
            : "#F2F2F2";
        const textColor =
          theme === "dark"
            ? isActive
              ? "#f5f5f5"
              : "#8a8a8a"
            : isActive
            ? "#1a1a1a"
            : "#757575";

        return (
          <div
            key={box.id}
            onClick={() => onBoxClick(box.id, box.href, isActive)}
            style={{
              left: "50%",
              transform: `translateX(calc(-50% + ${box.xOffset}px))`,
              width: `${box.width}px`,
              height: `${box.height - squishAmount}px`,
              backgroundColor: bgColor,
              color: textColor,
              transition: "background-color 0.3s ease, color 0.3s ease",
            }}
            className="platform-box absolute bottom-0 flex items-center justify-center cursor-pointer font-medium pointer-events-auto"
          >
            {box.label}
          </div>
        );
      })}
    </div>
  );
};
